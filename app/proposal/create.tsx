import React, { useEffect, useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, KeyboardAvoidingView,
  Platform, Alert, TouchableOpacity, Image, Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { COLORS } from '@/constants/colors';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { DatePlanner, planToISO, type DayPlan } from '@/components/DatePlanner';
import { MemberCard } from '@/components/MemberCard';
import { MemberDetailSheet } from '@/components/MemberDetailSheet';
import { pickAttachment, iconForMime, type PickedAttachment } from '@/lib/attachment-picker';
import { canSendProposals } from '@/lib/roles';
import { WindowClosedNotice, useDailyWindow } from '@/components/WindowCountdown';
import { useAuthStore } from '@/store/auth';
import { useProposalsStore } from '@/store/proposals';
import { useUsersStore, type DirectoryUser } from '@/store/users';
import { LONDON_VENUES, VENUE_THEMES, type Venue } from '@/constants/london';

const DATE_TYPES = [
  { key: 'Dinner', emoji: '🍽️', label: 'Dress-up Dinner' },
  { key: 'Coffee', emoji: '☕', label: 'Coffee Date' },
  { key: 'Nature', emoji: '🌿', label: 'Nature Walk' },
  { key: 'Activity', emoji: '🎨', label: 'Activity' },
];

// Card slightly narrower than the screen so the next profile peeks in
const CARD_W = Dimensions.get('window').width - 84;

const PAYMENT_OPTIONS = [
  { key: 'I\'ll Pay', icon: 'gift-outline', label: 'I\'ll treat you', desc: 'The bill\'s on me' },
  { key: 'Split Equally', icon: 'git-branch-outline', label: 'We split equally', desc: 'Halves, no awkwardness' },
  { key: 'They\'ll Pay', icon: 'wallet-outline', label: 'Whatever you prefer', desc: 'We\'ll sort it on the day' },
  { key: 'Nothing To Pay', icon: 'leaf-outline', label: 'Nothing to pay', desc: 'A walk, a free exhibition…' },
];

export default function CreateProposalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ recipientEmail?: string }>();
  const { user } = useAuthStore();
  const { sendProposal } = useProposalsStore();
  const {
    candidatesFor, hydrate: hydrateUsers, isHydrated: usersHydrated,
    refreshFromServer: refreshUsersFromServer,
  } = useUsersStore();
  const [loading, setLoading] = useState(false);
  // Read before the early return below, so the hook order never changes
  const w = useDailyWindow();
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Safety net: the entry points are already hidden for non-proposers, but
  // guard the screen itself so it can't be reached by a stale deep link.
  if (user && !canSendProposals(user)) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
        <Ionicons name="mail-open-outline" size={44} color={COLORS.BRAND} />
        <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.TEXT, marginTop: 16, textAlign: 'center' }}>
          Proposals come to you
        </Text>
        <Text style={{ fontSize: 14, color: COLORS.TEXT_MUTED, marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
          On Aura you receive curated date proposals rather than sending them.
          They'll appear under Proposals on your Meet tab.
        </Text>
        <TouchableOpacity
          style={{ marginTop: 22, paddingHorizontal: 22, paddingVertical: 13, borderRadius: 14, backgroundColor: COLORS.BRAND }}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
        >
          <Text style={{ color: '#fff', fontWeight: '800' }}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Refresh on open so newly-joined members are immediately proposable
  useEffect(() => {
    if (!usersHydrated) hydrateUsers();
    else refreshUsersFromServer();
  }, []);

  const recipients: DirectoryUser[] = user?.email
    ? candidatesFor(user.email, { genderInterest: user.genderInterest, myGender: user.gender })
    : [];

  const [selectedRecipient, setSelectedRecipient] = useState<DirectoryUser | null>(
    params.recipientEmail
      ? recipients.find(r => r.email === (params.recipientEmail as string)?.toLowerCase()) ?? null
      : null,
  );
  // Full-profile preview before committing to a proposal
  const [previewing, setPreviewing] = useState<DirectoryUser | null>(null);

  const [message, setMessage] = useState('');
  const [dateType, setDateType] = useState('');
  const [venue, setVenue] = useState('');
  const [area, setArea] = useState('');
  const [alternativePlan, setAlternativePlan] = useState('');
  // Days + the times you're free on each, so she can pick what suits her
  const [dayPlans, setDayPlans] = useState<DayPlan[]>([]);
  const [paymentArrangement, setPaymentArrangement] = useState('');

  // Mandatory video introduction
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [recording, setRecording] = useState(false);

  // Optional attachment — a deck, PDF, or image with the date plan
  const [attachment, setAttachment] = useState<PickedAttachment | null>(null);

  const chooseAttachment = async () => {
    try {
      const picked = await pickAttachment();
      if (picked) setAttachment(picked);
    } catch (e: any) {
      Alert.alert('Could not attach', e?.message || 'Please try again.');
    }
  };

  const previewPlayer = useVideoPlayer(videoUri ?? '', (p) => {
    p.loop = true;
    p.muted = true;
  });

  const recordVideo = async () => {
    setRecording(true);
    try {
      const cam = await ImagePicker.requestCameraPermissionsAsync();
      if (!cam.granted) {
        Alert.alert('Camera permission needed', 'We need camera access so you can record your video introduction.');
        return;
      }
      // Not in expo-image-picker's types on every SDK — call defensively
      const mic = await (ImagePicker as any).requestMicrophonePermissionsAsync?.();
      if (mic && !mic.granted) {
        Alert.alert('Microphone permission needed', 'A silent video isn\'t much of an introduction — we need mic access.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['videos'],
        videoMaxDuration: 30,
        videoQuality: 1,
        cameraType: ImagePicker.CameraType.front,
      });
      if (!result.canceled && result.assets[0]) {
        const a = result.assets[0];
        setVideoUri(a.uri);
        setVideoDuration(a.duration ? Math.round(a.duration / 1000) : null);
        try { previewPlayer.replace(a.uri); previewPlayer.play(); } catch {}
      }
    } catch (e: any) {
      Alert.alert('Could not record', e?.message || 'Please try again.');
    } finally {
      setRecording(false);
    }
  };

  const validateForm = () => {
    const e: Record<string, string> = {};
    if (!selectedRecipient) e.recipient = 'Pick someone to propose to';
    if (!videoUri) e.video = 'A video introduction is required for every proposal';
    if (!message.trim()) e.message = 'Please write a short caption to go with your video';
    else if (message.length < 10) e.message = 'At least 10 characters';
    if (!dateType) e.dateType = 'Select a date type';
    if (!venue.trim()) e.venue = 'Tell her where you\'re taking her';
    if (parseSlots().length === 0) {
      e.slot0 = 'Add at least one day and time you\'re free';
    }
    // Payment is intentionally optional — plenty of good dates cost nothing.
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /** Every offered slot as an ISO datetime, earliest first */
  const parseSlots = (): string[] => planToISO(dayPlans);

  /** Try to parse a date+time pair into a real ISO datetime */
  const parseOne = (preferredDate: string, preferredTime: string): string => {
    const dStr = preferredDate.trim();
    // dd/mm/yyyy or yyyy-mm-dd
    const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dStr);
    let d: Date;
    if (ddmmyyyy) {
      d = new Date(`${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`);
    } else {
      d = new Date(dStr);
    }
    if (isNaN(d.getTime())) d = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    // Time: "7:30 PM" / "19:30" / "19:30:00"
    const t = preferredTime.trim();
    const ampm = /^(\d{1,2}):?(\d{2})?\s*(am|pm)$/i.exec(t);
    if (ampm) {
      let h = parseInt(ampm[1], 10);
      const m = ampm[2] ? parseInt(ampm[2], 10) : 0;
      if (/pm/i.test(ampm[3]) && h < 12) h += 12;
      if (/am/i.test(ampm[3]) && h === 12) h = 0;
      d.setHours(h, m, 0, 0);
    } else {
      const hm = /^(\d{1,2}):(\d{2})/.exec(t);
      if (hm) d.setHours(parseInt(hm[1], 10), parseInt(hm[2], 10), 0, 0);
    }
    return d.toISOString();
  };

  /**
   * Curated venues that fit the chosen date type. Tapping one fills the
   * meeting point with an exact match, so the proposal carries the real
   * address, postcode and tube stop rather than free text.
   */
  const themesForType = React.useMemo(() => {
    if (!dateType) return VENUE_THEMES;
    // Dinner also offers drinks themes — a bar is a perfectly good dinner date
    const types = dateType === 'Dinner' ? ['Dinner', 'Drinks'] : [dateType];
    return VENUE_THEMES.filter((t) => types.includes(t.dateType));
  }, [dateType]);

  /** Map UI date type to a venue category, then resolve a real London venue */
  const resolveVenue = () => {
    const cat: any = dateType === 'Dinner' ? 'dinner'
      : dateType === 'Coffee' ? 'coffee'
      : dateType === 'Nature' ? 'walk'
      : 'gallery';
    // The proposal now carries a *type* of place rather than a booked venue —
    // the exact spot is agreed between the two of them afterwards.
    const theme = VENUE_THEMES.find((t) => t.label === venue);
    return {
      id: `theme_${theme?.key ?? 'custom'}_${Date.now()}`,
      name: venue.trim(),
      category: cat,
      emoji: theme?.emoji
        ?? (dateType === 'Dinner' ? '🍽️' : dateType === 'Coffee' ? '☕' : dateType === 'Nature' ? '🌿' : '🎨'),
      area: area.trim() || 'London',
      address: area.trim() || 'To be arranged together',
      postcode: '',
      tube: '',
      priceRange: '££' as const,
      lat: 51.5074,
      lng: -0.1278,
    };
  };

  const paymentToEnum = (): 'he-pays' | 'split' | 'she-pays' | 'free' => {
    if (paymentArrangement === 'I\'ll Pay') return 'he-pays';
    if (paymentArrangement === 'They\'ll Pay') return 'she-pays';
    if (paymentArrangement === 'Nothing To Pay') return 'free';
    return 'split'; // also the sensible default when they skip the question
  };

  /**
   * Real compatibility from actual profile data: shared interests, same area,
   * and mutual verification. No random numbers — if there's nothing in common
   * it's simply framed as a direct invitation.
   */
  const computeMatch = (recipient: DirectoryUser): { score: number; reason: string } => {
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    const firstPart = (c?: string) => (c || '').toLowerCase().split(',')[0].trim();
    const reasons: string[] = [];
    let score = 60; // baseline for an intentional, hand-picked invite

    const mine = (user?.interests ?? []).map((s) => s.toLowerCase());
    const theirs = (recipient.interests ?? []).map((s) => s.toLowerCase());
    const shared = mine.filter((i) => theirs.includes(i));
    if (shared.length) {
      score += Math.min(shared.length * 8, 28);
      reasons.push(`You both love ${shared.slice(0, 3).map(cap).join(', ')}`);
    }

    if (user?.city && recipient.city && firstPart(user.city) === firstPart(recipient.city)) {
      score += 8;
      reasons.push(`Both in ${cap(firstPart(recipient.city))}`);
    }

    if (user?.verified && recipient.verified) {
      score += 4;
      reasons.push('Both verified members');
    }

    score = Math.max(55, Math.min(score, 99));
    const reason = reasons.length ? reasons.join(' · ') : 'A direct invitation, chosen just for you';
    return { score, reason };
  };

  const handleSend = async () => {
    if (!w.open) return;
    if (!validateForm()) return;
    setLoading(true);
    try {
      const resolvedVenue = resolveVenue();
      const r = selectedRecipient!;
      const match = computeMatch(r);
      const offered = parseSlots();

      await sendProposal({
        from: {
          id: user?.id || `user_${Date.now()}`,
          name: user?.name || 'Anonymous',
          age: user?.age || 0,
          area: user?.city?.split(',')[0]?.trim() || 'London',
          job: '',
          photoUrl: user?.photoUrl || '',
          verified: !!user?.verified,
          lat: 51.5074,
          lng: -0.1278,
          email: user?.email,
        },
        recipientEmail: r.email,
        matchScore: match.score,
        matchReason: match.reason,
        venue: resolvedVenue as any,
        startsAt: offered[0],
        dateOptions: offered,
        payment: paymentToEnum(),
        message: message.trim(),
        videoUrl: videoUri!,
        videoPoster: undefined,
        videoDurationSec: videoDuration ?? undefined,
        attachmentUrl: attachment?.uri,
        attachmentName: attachment?.name,
        attachmentType: attachment?.mimeType,
      });

      Alert.alert(
        '✨ Proposal sent',
        `Your video and date plan have been delivered to ${r.name}. They have 24 hours to accept or pass.`,
        [{ text: 'Done', onPress: () => (router.canGoBack() ? router.back() : router.replace('/(tabs)')) }],
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send proposal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={styles.backBtn}>
          <Ionicons name="close" size={18} color={COLORS.TEXT} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Propose a Date</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Recipient — pick from the people who have signed up on this device */}
        <View style={[styles.card, errors.recipient && { borderWidth: 1.5, borderColor: COLORS.ERROR }]}>
          <Text style={styles.sectionLbl}>To</Text>

          {recipients.length === 0 ? (
            <View style={styles.noCandidates}>
              <Ionicons name="people-outline" size={28} color={COLORS.TEXT_MUTED} />
              <Text style={styles.noCandidatesTitle}>No one to propose to yet</Text>
              <Text style={styles.noCandidatesSub}>
                Once another user signs up, you'll be able to send them a proposal.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.swipeHint}>
                {recipients.length > 1 ? 'Swipe to browse · tap to choose' : 'Tap to choose'}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={CARD_W + 12}
                decelerationRate="fast"
                contentContainerStyle={styles.cardRail}
              >
                {recipients.map((r) => {
                  const isOn = selectedRecipient?.email === r.email;
                  return (
                    <MemberCard
                      key={r.email}
                      width={CARD_W}
                      person={r}
                      selected={isOn}
                      onPress={() => setPreviewing(r)}
                      footer={
                        <View style={{ gap: 8 }}>
                          <TouchableOpacity
                            style={styles.viewBtn}
                            onPress={() => setPreviewing(r)}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="expand-outline" size={15} color={COLORS.TEXT_SECONDARY} />
                            <Text style={styles.viewText}>View full profile</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.chooseBtn, isOn && styles.chooseBtnOn]}
                            onPress={() => setSelectedRecipient(r)}
                            activeOpacity={0.85}
                          >
                            <Ionicons
                              name={isOn ? 'checkmark-circle' : 'heart-outline'}
                              size={17}
                              color={isOn ? '#fff' : COLORS.BRAND}
                            />
                            <Text style={[styles.chooseText, isOn && styles.chooseTextOn]}>
                              {isOn ? 'Selected' : 'Propose to ' + r.name.split(' ')[0]}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      }
                    />
                  );
                })}
              </ScrollView>
            </>
          )}

          {errors.recipient && <Text style={styles.err}>{errors.recipient}</Text>}
        </View>

        {/* Mandatory video introduction — sits first because every proposal needs it */}
        <View style={[styles.videoCard, errors.video && { borderColor: COLORS.ERROR }]}>
          <View style={styles.videoHeader}>
            <View style={styles.videoIcon}>
              <Ionicons name="videocam" size={16} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.videoTitle}>Record a video introduction</Text>
              <Text style={styles.videoSubtitle}>
                Required · 5–30 seconds. Show your face — say hello, why this date, why her.
              </Text>
            </View>
            <View style={styles.requiredBadge}>
              <Text style={styles.requiredText}>REQUIRED</Text>
            </View>
          </View>

          {videoUri ? (
            <View style={styles.videoPreview}>
              <VideoView
                player={previewPlayer}
                style={StyleSheet.absoluteFillObject}
                contentFit="cover"
                nativeControls={false}
              />
              <View style={styles.videoOverlay}>
                <View style={styles.videoBadge}>
                  <Ionicons name="checkmark" size={12} color="#fff" />
                  <Text style={styles.videoBadgeText}>
                    Recorded{videoDuration ? ` · ${videoDuration}s` : ''}
                  </Text>
                </View>
                <TouchableOpacity style={styles.retakeBtn} onPress={recordVideo}>
                  <Ionicons name="refresh" size={14} color="#fff" />
                  <Text style={styles.retakeText}>Retake</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.recordBtn, recording && { opacity: 0.6 }]}
              onPress={recordVideo}
              disabled={recording}
              activeOpacity={0.85}
            >
              <View style={styles.recordIconWrap}>
                <View style={styles.recordIconDot} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.recordTitle}>{recording ? 'Opening camera…' : 'Tap to record'}</Text>
                <Text style={styles.recordHint}>Front camera · max 30 seconds</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.BRAND} />
            </TouchableOpacity>
          )}

          {errors.video && <Text style={styles.err}>{errors.video}</Text>}

          <View style={styles.tipsRow}>
            <View style={styles.tipChip}><Ionicons name="happy-outline" size={11} color={COLORS.GOLD_DEEP} /><Text style={styles.tipText}>Be yourself</Text></View>
            <View style={styles.tipChip}><Ionicons name="sunny-outline" size={11} color={COLORS.GOLD_DEEP} /><Text style={styles.tipText}>Good light</Text></View>
            <View style={styles.tipChip}><Ionicons name="time-outline" size={11} color={COLORS.GOLD_DEEP} /><Text style={styles.tipText}>Keep it short</Text></View>
          </View>
        </View>

        {/* Optional attachment — a deck / PDF / image with the plan */}
        <View style={styles.card}>
          <Text style={styles.sectionLbl}>Attach your plan (optional)</Text>
          <Text style={styles.hintText}>
            Going the extra mile? Attach a little deck, an itinerary, a playlist screenshot — anything that shows you put thought in.
          </Text>

          {attachment ? (
            <View style={styles.attachRow}>
              <View style={styles.attachIcon}>
                <Ionicons name={iconForMime(attachment.mimeType) as any} size={20} color={COLORS.BRAND} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.attachName} numberOfLines={1}>{attachment.name}</Text>
                <Text style={styles.attachMeta}>Attached</Text>
              </View>
              <TouchableOpacity onPress={() => setAttachment(null)} style={styles.attachRemove}>
                <Ionicons name="close" size={16} color={COLORS.ERROR} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.attachBtn} onPress={chooseAttachment} activeOpacity={0.8}>
              <Ionicons name="attach" size={18} color={COLORS.BRAND} />
              <Text style={styles.attachBtnText}>Add a file</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Caption to accompany the video */}
        <View style={styles.card}>
          <Input
            label="Caption to go with your video"
            placeholder="Two sentences that match your video — what you said, why this place..."
            value={message} onChangeText={setMessage} multiline numberOfLines={3} error={errors.message}
          />
        </View>

        {/* Date Type */}
        <View style={styles.card}>
          <Text style={styles.sectionLbl}>Type of Date</Text>
          <View style={styles.typeGrid}>
            {DATE_TYPES.map((type) => (
              <TouchableOpacity
                key={type.key}
                style={[styles.typeCard, dateType === type.key && styles.typeCardOn]}
                onPress={() => setDateType(type.key)}
              >
                <Text style={styles.typeEmoji}>{type.emoji}</Text>
                <Text style={[styles.typeLbl, dateType === type.key && styles.typeLblOn]}>{type.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {errors.dateType && <Text style={styles.err}>{errors.dateType}</Text>}

          {/* What kind of place — the exact venue is arranged later */}
          <Text style={styles.sectionLbl}>What kind of place</Text>
          <Text style={styles.fieldHint}>
            Pick the vibe rather than a specific venue — you'll sort the exact
            spot together once she's said yes.
          </Text>
          <View style={styles.themeWrap}>
            {themesForType.map((t) => {
              const on = venue === t.label;
              return (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.themeChip, on && styles.themeChipOn]}
                  onPress={() => setVenue(on ? '' : t.label)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.themeEmoji}>{t.emoji}</Text>
                  <Text style={[styles.themeLabel, on && styles.themeLabelOn]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {errors.venue && <Text style={styles.err}>{errors.venue}</Text>}

          <Input
            label="Area (optional)"
            placeholder="e.g. Shoreditch, Soho, South Bank"
            value={area}
            onChangeText={setArea}
            icon="location-outline"
          />


          <Input label="Alternative plan (optional)" placeholder="A backup idea in case that doesn't suit them" value={alternativePlan} onChangeText={setAlternativePlan} icon="repeat-outline" />

          {/* Availability planner — she picks whichever slot suits her */}
          <Text style={styles.sectionLbl}>When are you free?</Text>
          <Text style={styles.fieldHint}>
            Offer a few days and times. She'll pick whichever fits her week,
            so the date doesn't hinge on one take-it-or-leave-it slot.
          </Text>
          <DatePlanner value={dayPlans} onChange={setDayPlans} error={errors.slot0} />
        </View>

        {/* Payment */}
        <View style={styles.card}>
          <Text style={styles.sectionLbl}>Who pays? (optional)</Text>
          <Text style={styles.fieldHint}>
            Setting expectations up front avoids the awkward moment at the end. Skip it if you'd
            rather not say — or pick "Nothing to pay" for a walk or a free exhibition.
          </Text>
          <View style={[styles.payList, { marginTop: 12 }]}>
            {PAYMENT_OPTIONS.map((opt) => {
              const on = paymentArrangement === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.payRow, on && styles.payRowOn]}
                  onPress={() => setPaymentArrangement(on ? '' : opt.key)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.payIcon, on && styles.payIconOn]}>
                    <Ionicons name={opt.icon as any} size={15} color={on ? '#fff' : COLORS.PRIMARY} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.payLbl, on && styles.payLblOn]}>{opt.label}</Text>
                    <Text style={styles.payDesc}>{opt.desc}</Text>
                  </View>
                  {on && <Ionicons name="checkmark-circle" size={17} color={COLORS.PRIMARY} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {w.open ? (
          <Button title="Send Proposal" onPress={handleSend} loading={loading} size="lg" style={{ width: '100%', marginTop: 4 }} />
        ) : (
          <WindowClosedNotice secondsUntilOpen={w.secondsUntilOpen} />
        )}
      </ScrollView>

      {/* Full profile preview */}
      <MemberDetailSheet
        person={previewing}
        visible={!!previewing}
        onClose={() => setPreviewing(null)}
        ctaLabel={previewing ? `Propose to ${previewing.name.split(' ')[0]}` : undefined}
        onCta={() => {
          if (previewing) setSelectedRecipient(previewing);
          setPreviewing(null);
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12, backgroundColor: COLORS.SURFACE,
    borderBottomWidth: 1, borderBottomColor: COLORS.BORDER_LIGHT,
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 12, backgroundColor: COLORS.BG,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.TEXT, letterSpacing: -0.3 },
  content: { paddingHorizontal: 14, paddingVertical: 16, paddingBottom: 40 },

  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.PRIMARY_MUTED, borderRadius: 14, padding: 14, marginBottom: 12,
  },
  bannerIcon: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.SURFACE,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#1A1A2E', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  bannerLbl: { fontSize: 10, color: COLORS.PRIMARY_LIGHT, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  bannerName: { fontSize: 16, fontWeight: '800', color: COLORS.PRIMARY, letterSpacing: -0.3 },

  card: {
    backgroundColor: COLORS.SURFACE, borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: '#1A1A2E', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  sectionLbl: { fontSize: 10, fontWeight: '800', color: COLORS.TEXT_MUTED, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  hintText: { fontSize: 11, color: COLORS.TEXT_MUTED, lineHeight: 16, marginTop: 4 },
  row: { flexDirection: 'row', gap: 10 },

  /* Attachment */
  attachBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 14, marginTop: 10,
    backgroundColor: COLORS.BRAND_MUTED,
    borderWidth: 1.5, borderColor: COLORS.BRAND, borderStyle: 'dashed',
  },
  attachBtnText: { fontSize: 13, fontWeight: '800', color: COLORS.BRAND },
  attachRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10,
    padding: 12, borderRadius: 14, backgroundColor: COLORS.BG,
    borderWidth: 1, borderColor: COLORS.BORDER_LIGHT,
  },
  attachIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.BRAND_MUTED,
    justifyContent: 'center', alignItems: 'center',
  },
  attachName: { fontSize: 13, fontWeight: '700', color: COLORS.TEXT },
  attachMeta: { fontSize: 11, color: COLORS.LIKE, fontWeight: '700', marginTop: 2 },
  attachRemove: {
    width: 30, height: 30, borderRadius: 10, backgroundColor: COLORS.ERROR_LIGHT,
    justifyContent: 'center', alignItems: 'center',
  },

  /* Recipient picker — browsable profile cards */
  swipeHint: { fontSize: 11, color: COLORS.TEXT_MUTED, marginBottom: 10, fontWeight: '600' },
  cardRail: { gap: 12, paddingRight: 4, paddingBottom: 4 },
  chooseBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 12, borderRadius: 14,
    backgroundColor: COLORS.BRAND_MUTED, borderWidth: 1.5, borderColor: COLORS.BRAND,
  },
  chooseBtnOn: { backgroundColor: COLORS.BRAND, borderColor: COLORS.BRAND },
  chooseText: { fontSize: 13, fontWeight: '800', color: COLORS.BRAND },
  chooseTextOn: { color: '#fff' },
  viewBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 12,
    backgroundColor: COLORS.BG, borderWidth: 1, borderColor: COLORS.BORDER,
  },
  viewText: { fontSize: 12, fontWeight: '700', color: COLORS.TEXT_SECONDARY },

  recipientList: { gap: 8 },
  recipientRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14,
    borderWidth: 1.5, borderColor: COLORS.BORDER_LIGHT, backgroundColor: COLORS.SURFACE,
  },
  recipientRowOn: { borderColor: COLORS.BRAND, backgroundColor: COLORS.BRAND_MUTED },
  recipientAvatar: { width: 44, height: 44, borderRadius: 14 },
  recipientAvatarPlaceholder: {
    backgroundColor: COLORS.BORDER_LIGHT, justifyContent: 'center', alignItems: 'center',
  },
  recipientNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  recipientName: { fontSize: 14, fontWeight: '700', color: COLORS.TEXT },
  recipientMeta: { fontSize: 11, color: COLORS.TEXT_MUTED, marginTop: 2, textTransform: 'capitalize' },
  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: COLORS.BORDER,
    justifyContent: 'center', alignItems: 'center',
  },
  radioOn: { borderColor: COLORS.BRAND },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.BRAND },
  noCandidates: { alignItems: 'center', paddingVertical: 16, gap: 6 },
  noCandidatesTitle: { fontSize: 14, fontWeight: '700', color: COLORS.TEXT },
  noCandidatesSub: { fontSize: 12, color: COLORS.TEXT_MUTED, textAlign: 'center', paddingHorizontal: 16 },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  typeCard: {
    flex: 1, minWidth: '44%', alignItems: 'center', paddingVertical: 12, borderRadius: 14,
    borderWidth: 1.5, borderColor: COLORS.BORDER_LIGHT, backgroundColor: COLORS.SURFACE, gap: 4,
  },
  typeCardOn: { borderColor: COLORS.PRIMARY, backgroundColor: COLORS.PRIMARY_MUTED },
  typeEmoji: { fontSize: 22 },
  typeLbl: { fontSize: 11, fontWeight: '700', color: COLORS.TEXT_SECONDARY, textAlign: 'center' },
  typeLblOn: { color: COLORS.PRIMARY },
  err: { fontSize: 11, color: COLORS.ERROR, marginTop: -6, marginBottom: 10 },

  payList: { gap: 8, marginBottom: 8 },
  payRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14,
    borderWidth: 1.5, borderColor: COLORS.BORDER_LIGHT, backgroundColor: COLORS.SURFACE,
  },
  payRowOn: { borderColor: COLORS.PRIMARY_LIGHT, backgroundColor: COLORS.PRIMARY_MUTED },
  payIcon: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: COLORS.PRIMARY_MUTED,
    justifyContent: 'center', alignItems: 'center',
  },
  payIconOn: { backgroundColor: COLORS.PRIMARY },
  payLbl: { fontSize: 13, fontWeight: '600', color: COLORS.TEXT_SECONDARY },
  payLblOn: { color: COLORS.PRIMARY, fontWeight: '700' },
  payDesc: { fontSize: 11, color: COLORS.TEXT_MUTED, marginTop: 2 },
  fieldHint: { fontSize: 11, color: COLORS.TEXT_MUTED, lineHeight: 16, marginTop: -6, marginBottom: 12 },

  /* Venue themes */
  themeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  themeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14,
    backgroundColor: COLORS.BG, borderWidth: 1.5, borderColor: COLORS.BORDER_LIGHT,
  },
  themeChipOn: { backgroundColor: COLORS.BRAND_MUTED, borderColor: COLORS.BRAND },
  themeEmoji: { fontSize: 15 },
  themeLabel: { fontSize: 13, fontWeight: '700', color: COLORS.TEXT_SECONDARY },
  themeLabelOn: { color: COLORS.BRAND },

  /* Date/time slots */
  slotBlock: { marginBottom: 4 },
  slotLabel: {
    fontSize: 11, fontWeight: '800', color: COLORS.TEXT_MUTED,
    letterSpacing: 0.5, marginBottom: 6,
  },

  /* Video introduction block */
  videoCard: {
    backgroundColor: COLORS.SURFACE, borderRadius: 18, padding: 16, marginBottom: 12,
    borderWidth: 1.5, borderColor: COLORS.BRAND_MUTED,
    shadowColor: '#1A0F26', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  videoHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  videoIcon: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.BRAND,
    justifyContent: 'center', alignItems: 'center',
  },
  videoTitle: { fontSize: 15, fontWeight: '800', color: COLORS.TEXT, letterSpacing: -0.2 },
  videoSubtitle: { fontSize: 11, color: COLORS.TEXT_MUTED, marginTop: 2, lineHeight: 15 },
  requiredBadge: {
    backgroundColor: COLORS.BRAND, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  requiredText: { fontSize: 9, fontWeight: '900', color: '#fff', letterSpacing: 1 },

  recordBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 16, paddingHorizontal: 14, borderRadius: 14,
    backgroundColor: COLORS.BRAND_MUTED,
    borderWidth: 1.5, borderColor: COLORS.BRAND, borderStyle: 'dashed',
  },
  recordIconWrap: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.BRAND,
  },
  recordIconDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: COLORS.BRAND },
  recordTitle: { fontSize: 14, fontWeight: '800', color: COLORS.BRAND },
  recordHint: { fontSize: 11, color: COLORS.TEXT_MUTED, marginTop: 2 },

  videoPreview: {
    width: '100%', aspectRatio: 9 / 13, borderRadius: 14, overflow: 'hidden',
    backgroundColor: '#15121F',
  },
  videoOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    padding: 10, justifyContent: 'space-between', flexDirection: 'column',
  },
  videoBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    backgroundColor: COLORS.LIKE, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
  },
  videoBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  retakeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14,
  },
  retakeText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  tipsRow: { flexDirection: 'row', gap: 6, marginTop: 12, flexWrap: 'wrap' },
  tipChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.GOLD_MUTED, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10,
  },
  tipText: { fontSize: 11, fontWeight: '700', color: COLORS.GOLD_DEEP },
});
