import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  Image, StatusBar, Alert, RefreshControl, ActivityIndicator,
  Animated, Dimensions, Easing, Linking, Modal, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { COLORS } from '@/constants/colors';
import { VideoMessage } from '@/components/VideoMessage';
import { useAuthStore } from '@/store/auth';
import { useProposalsStore, type Proposal } from '@/store/proposals';
import { useDatesStore } from '@/store/dates';
import { getCurrentLocation, distanceKm, formatDistance } from '@/lib/location';
import { scheduleDateReminders } from '@/lib/notifications';
import { addDateToCalendar } from '@/lib/calendar';
import { blockUserOnServer, reportUserOnServer } from '@/lib/profile-supabase';
import { iconForMime } from '@/lib/attachment-picker';
import { canSendProposals } from '@/lib/roles';
import {
  formatDate, formatTime, formatCountdown,
  paymentLabel,
} from '@/lib/format';

const { width: SW } = Dimensions.get('window');

/**
 * Proposals — the inbox.
 *
 * This was the Today tab. It became a sub-screen of Meet when Today was
 * folded away: the countdown made the standalone landing tab redundant, but
 * the inbox itself is the whole receiving half of the proposal loop, so it
 * moved rather than went. It now sits beside /meet/blind and /meet/call,
 * which is where a reader would look for it.
 */
export default function ProposalsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    isHydrated, error, hydrate, refreshProposals,
    pendingForUser, acceptProposal, declineProposal, decisions,
    proposals: allProposals,
  } = useProposalsStore();
  const { addDate, hydrate: hydrateDates } = useDatesStore();
  const [refreshing, setRefreshing] = useState(false);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  // Slot chooser shown when he offered several times
  const [slotPicker, setSlotPicker] = useState<{ proposal: Proposal; options: string[] } | null>(null);

  // Subtle entrance animation
  const fade = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    hydrate();
    hydrateDates();
    getCurrentLocation({ silent: true }).then(({ lat, lng }) => {
      setUserLat(lat); setUserLng(lng);
    });
  }, []);

  useEffect(() => {
    if (isHydrated) {
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(lift, { toValue: 0, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start();
    }
  }, [isHydrated]);

  const firstName = (user?.name || 'there').split(' ')[0];
  const proposals = user?.email ? pendingForUser(user.email) : [];
  const proposal = proposals[0]; // Show one at a time — quality over quantity
  const reviewedToday = !proposal && Object.keys(decisions).length > 0;
  /**
   * Aura is invitation-first: men send proposals, women receive one curated
   * proposal a day. So the "your next proposal arrives in Xh" countdown only
   * makes sense for recipients — senders get a compose-oriented empty state.
   *
   * Gender alone isn't reliable (older accounts never saved one), so we also
   * infer from behaviour: someone who has only ever sent proposals is a sender.
   */
  const myEmail = (user?.email || '').toLowerCase().trim();
  const hasReceivedAny = allProposals.some(p => p?.recipientEmail?.toLowerCase?.() === myEmail);
  const hasSentAny = allProposals.some(p => p?.from?.email?.toLowerCase?.() === myEmail);
  const isSender = canSendProposals(user);
  // Never promise a countdown to someone who has never received a proposal.
  const showCountdown = !isSender && reviewedToday && hasReceivedAny;

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshProposals();
    setRefreshing(false);
  };

  const handleAccept = (p: Proposal) => {
    const options = (p.dateOptions?.length ? p.dateOptions : [p.startsAt])
      .filter(Boolean)
      .sort();

    // More than one slot offered? Let her choose before confirming. A long
    // list goes to a proper sheet — an alert with eight buttons is unusable.
    if (options.length > 1) {
      setSlotPicker({ proposal: p, options });
      return;
    }
    confirmAccept(p, options[0]);
  };

  const confirmAccept = (p: Proposal, chosenStartsAt: string) => {
    Alert.alert(
      `Accept ${p.from.name}'s proposal?`,
      `${p.venue.name}\n${formatDate(chosenStartsAt)} · ${formatTime(chosenStartsAt)}\n\nWe'll add it to your calendar and remind you 2h + 30 min before.`,
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            const accepted = await acceptProposal(p.id, chosenStartsAt);
            if (!accepted) return;
            // Use the slot she actually picked for reminders and the calendar
            const reminderIds = await scheduleDateReminders({
              dateId: p.id,
              with: p.from.name,
              venue: p.venue.name,
              startsAt: new Date(chosenStartsAt),
            });
            await addDate(accepted, reminderIds);
            addDateToCalendar({
              title: `Date with ${p.from.name} — ${p.venue.name}`,
              notes: `${p.venue.category} · ${paymentLabel(p.payment)}\n\n"${p.message}"`,
              location: `${p.venue.name}, ${p.venue.address}, ${p.venue.postcode}, London`,
              startsAt: new Date(chosenStartsAt),
              durationMinutes: 90,
            });
            Alert.alert(
              '🎉 Date confirmed!',
              `${p.venue.name} on ${formatDate(chosenStartsAt)} at ${formatTime(chosenStartsAt)}.\n\nFind details in the Dates tab.`
            );
          },
        },
      ]
    );
  };

  const handleDecline = (p: Proposal) => {
    Alert.alert(
      `Pass on this proposal?`,
      `${p.from.name} won't be told. They'll just receive other proposals.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Pass', style: 'destructive', onPress: () => declineProposal(p.id) },
      ]
    );
  };

  // Overflow menu on the proposal — block or report the sender
  const handleSafetyMenu = (p: Proposal) => {
    Alert.alert(
      p.from.name,
      'What would you like to do?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block this person',
          style: 'destructive',
          onPress: () => confirmBlock(p),
        },
        {
          text: 'Report this person',
          style: 'destructive',
          onPress: () => confirmReport(p),
        },
      ]
    );
  };

  const confirmBlock = (p: Proposal) => {
    Alert.alert(
      `Block ${p.from.name}?`,
      'They won\'t be able to send you proposals. We\'ll also pass on this one.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await blockUserOnServer(p.from.id, 'Blocked from proposal');
              await declineProposal(p.id);
              Alert.alert('Blocked', `${p.from.name} can no longer reach you.`);
            } catch (e: any) {
              Alert.alert('Could not block', e?.message || 'Please try again.');
            }
          },
        },
      ]
    );
  };

  const confirmReport = (p: Proposal) => {
    Alert.alert(
      `Report ${p.from.name}?`,
      'Our trust & safety team will review this. We\'ll also pass on the proposal and block them.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report & block',
          style: 'destructive',
          onPress: async () => {
            try {
              await reportUserOnServer({
                reportedId: p.from.id,
                reason: 'Reported from proposal',
                relatedProposalId: p.id.startsWith('prop_') ? undefined : p.id,
              });
              await blockUserOnServer(p.from.id, 'Reported & blocked');
              await declineProposal(p.id);
              Alert.alert('Thank you', 'Your report has been sent to our safety team.');
            } catch (e: any) {
              Alert.alert('Could not report', e?.message || 'Please try again.');
            }
          },
        },
      ]
    );
  };

  // Hours until tomorrow's 9 AM drop
  const hoursUntilTomorrow = () => {
    const now = new Date();
    const tomorrow9 = new Date();
    tomorrow9.setDate(tomorrow9.getDate() + 1);
    tomorrow9.setHours(9, 0, 0, 0);
    return Math.max(1, Math.round((tomorrow9.getTime() - now.getTime()) / (60 * 60 * 1000)));
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />

      {/* Background ambient gradient */}
      <LinearGradient
        colors={['#FBE8EE', '#FBF5EA', '#FBF6F2']}
        style={styles.bgGradient}
        locations={[0, 0.4, 1]}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 28 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.BRAND}
              colors={[COLORS.BRAND]}
            />
          }
        >
          {/* Header. The greeting and the date pill went with the Today tab;
              a sub-screen needs a way back more than it needs a salutation. */}
          <Animated.View
            style={[styles.screenHead, { opacity: fade, transform: [{ translateY: lift }] }]}
          >
            <TouchableOpacity
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
              style={styles.headBack}
            >
              <Ionicons name="chevron-back" size={26} color={COLORS.TEXT} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headTitle}>Proposals</Text>
              <Text style={styles.headSub}>
                {proposals.length === 0
                  ? 'Nothing waiting right now'
                  : proposals.length === 1
                    ? 'One invitation for you'
                    : `${proposals.length} invitations for you`}
              </Text>
            </View>
          </Animated.View>

          {/* Loading */}
          {!isHydrated && (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={COLORS.BRAND} />
              <Text style={styles.loadingText}>Curating your proposal…</Text>
            </View>
          )}

          {/* Error */}
          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="cloud-offline-outline" size={18} color={COLORS.ERROR} />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={onRefresh} style={styles.retryBtn}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* The single proposal — magazine card */}
          {proposal && (
            <Animated.View style={[styles.proposalCard, { opacity: fade, transform: [{ translateY: lift }] }]}>
              {/* Photo with gradient overlay */}
              <View style={styles.photoSection}>
                {proposal.from.photoUrl ? (
                  <Image source={{ uri: proposal.from.photoUrl }} style={styles.photo} />
                ) : (
                  <View style={[styles.photo, styles.photoPlaceholder]}>
                    <Ionicons name="person" size={90} color="rgba(255,255,255,0.5)" />
                  </View>
                )}
                <LinearGradient
                  colors={['transparent', 'rgba(20,16,40,0.15)', 'rgba(20,16,40,0.85)']}
                  locations={[0, 0.55, 1]}
                  style={StyleSheet.absoluteFillObject}
                />

                {/* Top-left: match score */}
                <View style={styles.matchOver}>
                  <Ionicons name="heart" size={11} color={COLORS.BRAND} />
                  <Text style={styles.matchOverText}>{proposal.matchScore}% Match</Text>
                </View>

                {/* Top-right: verified */}
                {proposal.from.verified && (
                  <View style={styles.verifiedOver}>
                    <Ionicons name="shield-checkmark" size={11} color="#fff" />
                    <Text style={styles.verifiedOverText}>Verified</Text>
                  </View>
                )}

                {/* Overflow: block / report */}
                <TouchableOpacity
                  style={styles.overflowOver}
                  onPress={() => handleSafetyMenu(proposal)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="ellipsis-horizontal" size={18} color="#fff" />
                </TouchableOpacity>

                {/* Bottom-left: name + meta */}
                <View style={styles.photoBottom}>
                  <Text style={styles.nameOver}>{proposal.from.name}</Text>
                  <Text style={styles.ageOver}>
                    {proposal.from.age}  ·  {proposal.from.job}  ·  {proposal.from.area}
                  </Text>
                </View>
              </View>

              {/* Letter section */}
              <View style={styles.letter}>
                {/* Decorative ornament */}
                <View style={styles.ornament}>
                  <View style={styles.ornamentLine} />
                  <Ionicons name="sparkles" size={14} color={COLORS.GOLD} />
                  <View style={styles.ornamentLine} />
                </View>

                {/* Invitation headline */}
                <Text style={styles.invitationLabel}>HE'D LOVE TO TAKE YOU TO</Text>
                <Text style={styles.venueName}>{proposal.venue.name}</Text>
                <View style={styles.subRow}>
                  <Text style={styles.venueArea}>{proposal.venue.area}</Text>
                  {(proposal.dateOptions?.length ?? 1) <= 1 && (
                    <>
                      <View style={styles.miniDot} />
                      <Text style={styles.venueArea}>{formatDate(proposal.startsAt).replace(',', '')}</Text>
                      <View style={styles.miniDot} />
                      <Text style={styles.venueArea}>{formatTime(proposal.startsAt)}</Text>
                    </>
                  )}
                </View>

                {/* Several slots offered — grouped by day so it stays readable */}
                {(proposal.dateOptions?.length ?? 0) > 1 && (
                  <View style={styles.slotsCard}>
                    <Text style={styles.slotsTitle}>He's free at these times</Text>
                    {groupByDay(proposal.dateOptions!).map(({ day, times }) => (
                      <View key={day} style={styles.slotDayRow}>
                        <Text style={styles.slotDay}>{day}</Text>
                        <View style={styles.slotTimes}>
                          {times.map((t) => (
                            <View key={t.iso} style={styles.slotPill}>
                              <Text style={styles.slotPillText}>{t.label}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    ))}
                    <Text style={styles.slotsFoot}>Pick whichever suits you when you accept</Text>
                  </View>
                )}

                {/* Video message — mandatory for every proposal */}
                {proposal.videoUrl ? (
                  <VideoMessage
                    videoUrl={proposal.videoUrl}
                    poster={proposal.videoPoster}
                    durationSec={proposal.videoDurationSec}
                    fromName={proposal.from.name}
                  />
                ) : (
                  <View style={{
                    padding: 16, marginBottom: 18, borderRadius: 16,
                    backgroundColor: COLORS.WARNING_LIGHT, flexDirection: 'row', gap: 10, alignItems: 'center',
                  }}>
                    <Ionicons name="videocam-off-outline" size={20} color={COLORS.WARNING} />
                    <Text style={{ flex: 1, fontSize: 13, color: COLORS.TEXT_SECONDARY }}>
                      Video unavailable. Pull down to refresh.
                    </Text>
                  </View>
                )}

                {/* Caption (his written message accompanying the video) */}
                <View style={styles.captionCard}>
                  <Ionicons name="chatbubble-outline" size={13} color={COLORS.BRAND} />
                  <Text style={styles.captionText}>{proposal.message}</Text>
                </View>

                {/* Attachment — his plan / deck, if he sent one */}
                {!!proposal.attachmentUrl && (
                  <TouchableOpacity
                    style={styles.attachCard}
                    onPress={() => Linking.openURL(proposal.attachmentUrl!).catch(() =>
                      Alert.alert('Could not open', 'This attachment could not be opened.'))}
                    activeOpacity={0.85}
                  >
                    <View style={styles.attachCardIcon}>
                      <Ionicons name={iconForMime(proposal.attachmentType) as any} size={20} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.attachCardTitle} numberOfLines={1}>
                        {proposal.attachmentName || 'He attached his plan'}
                      </Text>
                      <Text style={styles.attachCardSub}>Tap to open</Text>
                    </View>
                    <Ionicons name="open-outline" size={17} color={COLORS.BRAND} />
                  </TouchableOpacity>
                )}

                {/* Why we matched — gold-trim card */}
                <View style={styles.whyCard}>
                  <View style={styles.whyHeader}>
                    <View style={styles.whySparkleWrap}>
                      <Ionicons name="sparkles" size={12} color="#fff" />
                    </View>
                    <Text style={styles.whyLabel}>WHY WE MATCHED YOU</Text>
                  </View>
                  <Text style={styles.whyText}>{proposal.matchReason}</Text>
                </View>

                {/* Practical details — 4 mini rows */}
                <View style={styles.detailGrid}>
                  <DetailMini icon="location-outline" text={`${proposal.venue.address}, ${proposal.venue.postcode}`} />
                  <DetailMini icon="train-outline" text={`${proposal.venue.tube} station`} />
                  <DetailMini icon="card-outline" text={paymentLabel(proposal.payment)} />
                  <DetailMini icon="pricetag-outline" text={`${proposal.venue.priceRange}  ·  ${formatCountdown(proposal.startsAt)}`} accent />
                </View>

                {/* Ask a question before deciding */}
                {!proposal.id.startsWith('prop_') && (
                  <TouchableOpacity
                    style={styles.askBtn}
                    onPress={() => router.push({
                      pathname: '/thread/[id]',
                      params: { id: proposal.id, name: proposal.from.name },
                    })}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="videocam-outline" size={17} color={COLORS.BRAND} />
                    <Text style={styles.askText}>
                      Send {proposal.from.name.split(' ')[0]} a video back
                    </Text>
                    <Ionicons name="chevron-forward" size={15} color={COLORS.BRAND} />
                  </TouchableOpacity>
                )}

                {/* Actions */}
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.passBtn} onPress={() => handleDecline(proposal)} activeOpacity={0.85}>
                    <Ionicons name="close" size={20} color={COLORS.TEXT_SECONDARY} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(proposal)} activeOpacity={0.92}>
                    <LinearGradient
                      colors={[COLORS.BRAND_DARK, COLORS.BRAND, COLORS.BRAND_LIGHT]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFillObject}
                    />
                    <Ionicons name="heart" size={20} color="#fff" />
                    <Text style={styles.acceptText}>Accept date</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>
          )}

          {/* No pending proposal */}
          {isHydrated && !proposal && (
            <Animated.View style={[{ opacity: fade, transform: [{ translateY: lift }] }]}>
              <View style={styles.doneCard}>
                <LinearGradient
                  colors={['#FBE8EE', '#FBF5EA']}
                  style={StyleSheet.absoluteFillObject}
                />
                <View style={styles.doneSparkle}>
                  <Ionicons
                    name={isSender ? 'videocam-outline' : showCountdown ? 'moon' : 'mail-open-outline'}
                    size={36}
                    color={COLORS.BRAND}
                  />
                </View>
                <Text style={styles.doneTitle}>
                  {isSender
                    ? 'Ask someone out'
                    : showCountdown ? 'Until tomorrow' : 'No proposals yet'}
                </Text>
                <Text style={styles.doneSub}>
                  {isSender
                    ? 'Pick someone, plan a real date, and\nrecord a short video introduction.'
                    : showCountdown
                      ? 'Your next curated proposal will arrive in'
                      : 'When someone sends you a proposal,\nit will appear here.'}
                </Text>
                {showCountdown && (
                  <View style={styles.countdownBig}>
                    <Text style={styles.countdownNum}>{hoursUntilTomorrow()}</Text>
                    <Text style={styles.countdownLabel}>hours</Text>
                  </View>
                )}
                <View style={styles.philosophyChip}>
                  <Ionicons name="sparkles" size={12} color={COLORS.GOLD} />
                  <Text style={styles.philosophyText}>Quality over quantity</Text>
                </View>
              </View>

              {/* Composer entry point — senders only */}
              {isSender && (
                <TouchableOpacity
                  style={styles.sendCta}
                  onPress={() => router.push('/proposal/create')}
                  activeOpacity={0.85}
                >
                  <View style={styles.sendCtaIcon}>
                    <Ionicons name="videocam" size={20} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sendCtaTitle}>Send a date proposal</Text>
                    <Text style={styles.sendCtaSub}>Record your video, pick the vibe, offer a few times</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.BRAND} />
                </TouchableOpacity>
              )}
            </Animated.View>
          )}

          {/* Footer pillars */}
          <View style={styles.pillarsFooter}>
            <Pillar icon="checkmark-circle" text="No infinite swiping" />
            <Pillar icon="checkmark-circle" text="No endless chat" />
            <Pillar icon="checkmark-circle" text="Real, tailored connections" />
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Which of his offered slots suits her */}
      <Modal
        visible={!!slotPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setSlotPicker(null)}
      >
        <Pressable style={styles.pickerBackdrop} onPress={() => setSlotPicker(null)}>
          <Pressable style={styles.pickerSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.pickerTitle}>Which time suits you?</Text>
            <Text style={styles.pickerSub}>
              {slotPicker
                ? `${slotPicker.proposal.from.name.split(' ')[0]} is free at these times for ${slotPicker.proposal.venue.name}.`
                : ''}
            </Text>
            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {slotPicker && groupByDay(slotPicker.options).map(({ day, times }) => (
                <View key={day} style={{ marginBottom: 14 }}>
                  <Text style={styles.pickerDay}>{day}</Text>
                  <View style={styles.pickerTimes}>
                    {times.map((t) => (
                      <TouchableOpacity
                        key={t.iso}
                        style={styles.pickerChip}
                        onPress={() => {
                          const p = slotPicker.proposal;
                          setSlotPicker(null);
                          confirmAccept(p, t.iso);
                        }}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.pickerChipText}>{t.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.pickerCancel} onPress={() => setSlotPicker(null)}>
              <Text style={styles.pickerCancelText}>Not yet</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/** Group offered slots by day so a long list stays readable */
function groupByDay(isos: string[]): { day: string; times: { iso: string; label: string }[] }[] {
  const map = new Map<string, { iso: string; label: string }[]>();
  for (const iso of [...isos].sort()) {
    const day = formatDate(iso).replace(',', '');
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push({ iso, label: formatTime(iso) });
  }
  return Array.from(map, ([day, times]) => ({ day, times }));
}

function DetailMini({ icon, text, accent }: { icon: any; text: string; accent?: boolean }) {
  return (
    <View style={[styles.detailMini, accent && styles.detailMiniAccent]}>
      <Ionicons name={icon} size={13} color={accent ? COLORS.BRAND : COLORS.TEXT_SECONDARY} />
      <Text style={[styles.detailMiniText, accent && { color: COLORS.BRAND, fontWeight: '700' }]} numberOfLines={1}>{text}</Text>
    </View>
  );
}

function Pillar({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={styles.pillarRow}>
      <Ionicons name={icon} size={14} color={COLORS.GOLD} />
      <Text style={styles.pillarText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.BG },
  bgGradient: { ...StyleSheet.absoluteFillObject, height: 360 },

  /* Date pill */
  screenHead: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 18,
  },
  headBack: {
    width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center',
  },
  headTitle: { fontSize: 26, fontWeight: '900', color: COLORS.TEXT, letterSpacing: -0.6 },
  headSub: { fontSize: 12.5, color: COLORS.TEXT_MUTED, marginTop: 1, fontWeight: '600' },
  datePillWrap: { alignItems: 'center', paddingTop: 8, paddingBottom: 8 },
  datePill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: 'rgba(253,58,92,0.10)', borderWidth: 1, borderColor: 'rgba(253,58,92,0.18)',
  },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.BRAND },
  dateText: { fontSize: 10, fontWeight: '800', color: COLORS.BRAND, letterSpacing: 1.5 },

  /* Greeting */
  greetingWrap: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24 },
  greetingSmall: {
    fontSize: 17, fontWeight: '400', color: COLORS.TEXT_SECONDARY,
    fontStyle: 'italic', letterSpacing: 0.2,
  },
  greetingBig: {
    fontSize: 42, fontWeight: '800', color: COLORS.TEXT,
    letterSpacing: -1, marginTop: 2,
  },

  /* Loading + error */
  loadingBox: { paddingVertical: 48, alignItems: 'center', gap: 14 },
  loadingText: { fontSize: 13, color: COLORS.TEXT_MUTED, fontStyle: 'italic' },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 20, padding: 14, borderRadius: 14,
    backgroundColor: COLORS.ERROR_LIGHT, marginBottom: 12,
  },
  errorText: { flex: 1, fontSize: 13, color: COLORS.ERROR, fontWeight: '600' },
  retryBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: COLORS.ERROR, borderRadius: 10 },
  retryText: { fontSize: 12, fontWeight: '800', color: '#fff' },

  /* Proposal card */
  proposalCard: {
    marginHorizontal: 16, marginBottom: 12,
    borderRadius: 28, backgroundColor: COLORS.SURFACE, overflow: 'hidden',
    shadowColor: '#1A0F26', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.12,
    shadowRadius: 28, elevation: 16,
  },
  photoSection: {
    height: 360, position: 'relative', backgroundColor: '#222',
  },
  photo: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  photoPlaceholder: { backgroundColor: COLORS.BRAND_MUTED, justifyContent: 'center', alignItems: 'center' },

  matchOver: {
    position: 'absolute', top: 16, left: 16,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.95)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6,
  },
  matchOverText: { fontSize: 12, fontWeight: '900', color: COLORS.BRAND, letterSpacing: 0.3 },

  verifiedOver: {
    position: 'absolute', top: 16, right: 58,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(37,217,151,0.95)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16,
  },
  verifiedOverText: { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },

  overflowOver: {
    position: 'absolute', top: 14, right: 16,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(20,16,40,0.45)',
    justifyContent: 'center', alignItems: 'center',
  },

  photoBottom: { position: 'absolute', bottom: 22, left: 22, right: 22 },
  nameOver: {
    fontSize: 36, fontWeight: '900', color: '#fff',
    letterSpacing: -1, textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 8,
  },
  ageOver: {
    fontSize: 13, color: 'rgba(255,255,255,0.92)', fontWeight: '500', marginTop: 4,
    letterSpacing: 0.2,
  },

  /* Letter section */
  letter: { padding: 24, paddingTop: 22 },

  ornament: { flexDirection: 'row', alignItems: 'center', gap: 12, justifyContent: 'center', marginBottom: 18 },
  ornamentLine: { width: 32, height: 1, backgroundColor: COLORS.GOLD + '60' },

  invitationLabel: {
    fontSize: 10, fontWeight: '800', color: COLORS.TEXT_MUTED, letterSpacing: 1.8,
    textAlign: 'center', marginBottom: 8,
  },
  venueName: {
    fontSize: 30, fontWeight: '800', color: COLORS.TEXT, textAlign: 'center',
    letterSpacing: -0.5, marginBottom: 8,
  },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 22 },
  venueArea: { fontSize: 13, color: COLORS.TEXT_SECONDARY, fontWeight: '600', letterSpacing: 0.2 },
  miniDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: COLORS.BORDER },

  captionCard: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: COLORS.GOLD_MUTED, borderRadius: 14, padding: 12, marginBottom: 18,
    borderWidth: 1, borderColor: COLORS.GOLD_LIGHT + '60',
  },
  captionText: {
    flex: 1, fontSize: 13, color: COLORS.TEXT_SECONDARY, lineHeight: 20,
    fontStyle: 'italic',
  },

  slotsCard: {
    backgroundColor: COLORS.BRAND_MUTED, borderRadius: 16, padding: 14, marginBottom: 18,
    gap: 8, borderWidth: 1, borderColor: COLORS.BRAND + '25',
  },
  slotsTitle: {
    fontSize: 10, fontWeight: '900', color: COLORS.BRAND,
    letterSpacing: 1.2, textTransform: 'uppercase',
  },
  slotDayRow: { gap: 6 },
  slotDay: { fontSize: 13, fontWeight: '800', color: COLORS.TEXT },
  slotTimes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  slotPill: {
    backgroundColor: COLORS.SURFACE, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 10, borderWidth: 1, borderColor: COLORS.BRAND + '30',
  },
  slotPillText: { fontSize: 12, fontWeight: '700', color: COLORS.BRAND },
  slotsFoot: { fontSize: 11, color: COLORS.TEXT_MUTED, fontStyle: 'italic', marginTop: 2 },

  /* Slot chooser */
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(20,16,40,0.5)', justifyContent: 'flex-end' },
  pickerSheet: {
    backgroundColor: COLORS.SURFACE, borderTopLeftRadius: 26, borderTopRightRadius: 26,
    padding: 22, paddingBottom: 34,
  },
  pickerTitle: { fontSize: 20, fontWeight: '900', color: COLORS.TEXT, letterSpacing: -0.4 },
  pickerSub: { fontSize: 13, color: COLORS.TEXT_MUTED, marginTop: 4, marginBottom: 18, lineHeight: 18 },
  pickerDay: { fontSize: 13, fontWeight: '800', color: COLORS.TEXT, marginBottom: 8 },
  pickerTimes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickerChip: {
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14,
    backgroundColor: COLORS.BRAND_MUTED, borderWidth: 1.5, borderColor: COLORS.BRAND,
  },
  pickerChipText: { fontSize: 14, fontWeight: '800', color: COLORS.BRAND },
  pickerCancel: { paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  pickerCancelText: { fontSize: 14, fontWeight: '700', color: COLORS.TEXT_MUTED },

  attachCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.BRAND_MUTED, borderRadius: 16, padding: 14, marginBottom: 18,
    borderWidth: 1, borderColor: COLORS.BRAND + '30',
  },
  attachCardIcon: {
    width: 40, height: 40, borderRadius: 13, backgroundColor: COLORS.BRAND,
    justifyContent: 'center', alignItems: 'center',
  },
  attachCardTitle: { fontSize: 14, fontWeight: '800', color: COLORS.TEXT },
  attachCardSub: { fontSize: 11, color: COLORS.BRAND, fontWeight: '700', marginTop: 2 },

  whyCard: {
    backgroundColor: COLORS.BRAND_MUTED, borderRadius: 18, padding: 16, marginBottom: 18,
    borderLeftWidth: 3, borderLeftColor: COLORS.GOLD,
  },
  whyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  whySparkleWrap: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.BRAND,
    justifyContent: 'center', alignItems: 'center',
  },
  whyLabel: { fontSize: 10, fontWeight: '900', color: COLORS.BRAND, letterSpacing: 1.5 },
  whyText: { fontSize: 15, color: COLORS.TEXT, lineHeight: 22, fontWeight: '500' },

  detailGrid: { gap: 8, marginBottom: 22 },
  detailMini: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.BG, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1, borderColor: COLORS.BORDER_LIGHT,
  },
  detailMiniAccent: { backgroundColor: COLORS.BRAND_MUTED, borderColor: COLORS.BRAND + '30' },
  detailMiniText: { fontSize: 13, color: COLORS.TEXT_SECONDARY, fontWeight: '500', flex: 1 },

  askBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 13, paddingHorizontal: 14, borderRadius: 14, marginBottom: 14,
    backgroundColor: COLORS.SURFACE, borderWidth: 1.5, borderColor: COLORS.BRAND_MUTED,
  },
  askText: { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.BRAND },

  /* Actions */
  actions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  passBtn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.SURFACE, borderWidth: 1.5, borderColor: COLORS.BORDER,
    justifyContent: 'center', alignItems: 'center',
  },
  acceptBtn: {
    flex: 1, height: 56, borderRadius: 28,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    overflow: 'hidden',
    shadowColor: COLORS.BRAND, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 14, elevation: 10,
  },
  acceptText: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },

  /* Done state */
  doneCard: {
    marginHorizontal: 16, marginTop: 12, padding: 36, borderRadius: 28, alignItems: 'center',
    overflow: 'hidden', position: 'relative',
    borderWidth: 1, borderColor: 'rgba(253,58,92,0.15)',
  },
  doneSparkle: {
    width: 84, height: 84, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.85)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 18,
  },
  doneTitle: { fontSize: 26, fontWeight: '800', color: COLORS.TEXT, letterSpacing: -0.5, marginBottom: 8 },
  doneSub: { fontSize: 14, color: COLORS.TEXT_SECONDARY, marginBottom: 18 },
  countdownBig: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 18 },
  countdownNum: { fontSize: 56, fontWeight: '900', color: COLORS.BRAND, letterSpacing: -2 },
  countdownLabel: { fontSize: 16, fontWeight: '700', color: COLORS.TEXT_MUTED, letterSpacing: 0.2 },
  philosophyChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.GOLD_MUTED, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.GOLD_LIGHT,
  },
  philosophyText: { fontSize: 12, fontWeight: '800', color: COLORS.GOLD_DEEP, letterSpacing: 0.5 },

  tomorrowPreview: {
    marginHorizontal: 16, marginTop: 14, padding: 22, borderRadius: 22,
    backgroundColor: COLORS.SURFACE,
    shadowColor: '#1A0F26', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 14, elevation: 4,
  },
  tomorrowLabel: { fontSize: 10, fontWeight: '900', color: COLORS.TEXT_MUTED, letterSpacing: 1.8, marginBottom: 14 },
  expectRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  expectIcon: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: COLORS.BRAND_MUTED,
    justifyContent: 'center', alignItems: 'center',
  },
  expectText: { fontSize: 14, color: COLORS.TEXT, fontWeight: '500', flex: 1 },

  sendCta: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 16, marginTop: 14, padding: 18, borderRadius: 22,
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1.5, borderColor: COLORS.BRAND_MUTED,
    shadowColor: '#1A0F26', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 4,
  },
  sendCtaIcon: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.BRAND,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: COLORS.BRAND, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 4,
  },
  sendCtaTitle: { fontSize: 15, fontWeight: '800', color: COLORS.TEXT, marginBottom: 3 },
  sendCtaSub: { fontSize: 12, color: COLORS.TEXT_MUTED, lineHeight: 16 },

  /* Pillars footer */
  pillarsFooter: { paddingTop: 28, paddingBottom: 8, gap: 8, alignItems: 'center' },
  pillarRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pillarText: { fontSize: 12, color: COLORS.TEXT_MUTED, fontWeight: '600' },
});
