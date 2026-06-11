import React, { useEffect, useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, KeyboardAvoidingView,
  Platform, Alert, TouchableOpacity, Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { COLORS } from '@/constants/colors';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { useAuthStore } from '@/store/auth';
import { useProposalsStore } from '@/store/proposals';
import { useUsersStore, type DirectoryUser } from '@/store/users';
import { LONDON_VENUES } from '@/constants/london';

const DATE_TYPES = [
  { key: 'Dinner', emoji: '🍽️', label: 'Dress-up Dinner' },
  { key: 'Coffee', emoji: '☕', label: 'Coffee Date' },
  { key: 'Nature', emoji: '🌿', label: 'Nature Walk' },
  { key: 'Activity', emoji: '🎨', label: 'Activity' },
];

const PAYMENT_OPTIONS = [
  { key: 'I\'ll Pay', icon: 'gift-outline', label: 'I\'ll treat you' },
  { key: 'Split Equally', icon: 'git-branch-outline', label: 'We split equally' },
  { key: 'They\'ll Pay', icon: 'wallet-outline', label: 'Your preference' },
];

export default function CreateProposalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ recipientEmail?: string }>();
  const { user } = useAuthStore();
  const { sendProposal } = useProposalsStore();
  const { candidatesFor, hydrate: hydrateUsers, isHydrated: usersHydrated } = useUsersStore();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => { if (!usersHydrated) hydrateUsers(); }, []);

  const recipients: DirectoryUser[] = user?.email
    ? candidatesFor(user.email, { genderInterest: user.genderInterest })
    : [];

  const [selectedRecipient, setSelectedRecipient] = useState<DirectoryUser | null>(
    params.recipientEmail
      ? recipients.find(r => r.email === (params.recipientEmail as string)?.toLowerCase()) ?? null
      : null,
  );
  const [message, setMessage] = useState('');
  const [dateType, setDateType] = useState('');
  const [venue, setVenue] = useState('');
  const [alternativePlan, setAlternativePlan] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [paymentArrangement, setPaymentArrangement] = useState('');

  // Mandatory video introduction
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [recording, setRecording] = useState(false);

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
    if (!preferredDate.trim()) e.preferredDate = 'Date is required';
    if (!preferredTime.trim()) e.preferredTime = 'Time is required';
    if (!paymentArrangement) e.paymentArrangement = 'Select a payment option';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /** Try to parse the typed date+time into a real ISO datetime */
  const parseStartsAt = (): string => {
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

  /** Map UI date type to a venue category, then resolve a real London venue */
  const resolveVenue = () => {
    const cat: any = dateType === 'Dinner' ? 'dinner'
      : dateType === 'Coffee' ? 'coffee'
      : dateType === 'Nature' ? 'walk'
      : 'gallery';
    // If user typed an exact venue name we have, use it; otherwise pick first in category
    const lcVenue = venue.trim().toLowerCase();
    const exact = LONDON_VENUES.find(v => v.name.toLowerCase() === lcVenue);
    if (exact) return exact;
    // Otherwise return a "free-form" venue using the user's typed value
    return {
      id: `custom_${Date.now()}`,
      name: venue.trim(),
      category: cat,
      emoji: dateType === 'Dinner' ? '🍽️' : dateType === 'Coffee' ? '☕' : dateType === 'Nature' ? '🌿' : '🎨',
      area: 'London',
      address: venue.trim(),
      postcode: '',
      tube: '',
      priceRange: '££' as const,
      lat: 51.5074,
      lng: -0.1278,
    };
  };

  const paymentToEnum = (): 'he-pays' | 'split' | 'she-pays' => {
    if (paymentArrangement === 'I\'ll Pay') return 'he-pays';
    if (paymentArrangement === 'They\'ll Pay') return 'she-pays';
    return 'split';
  };

  const handleSend = async () => {
    if (!validateForm()) return;
    setLoading(true);
    try {
      const resolvedVenue = resolveVenue();
      const r = selectedRecipient!;

      await sendProposal({
        from: {
          id: user?.id || `user_${Date.now()}`,
          name: user?.name || 'Anonymous',
          age: user?.age || 0,
          area: user?.city?.split(',')[0]?.trim() || 'London',
          job: '',
          photoUrl: user?.photoUrl || `https://i.pravatar.cc/400?u=${encodeURIComponent(user?.email || 'anon')}`,
          verified: !!user?.verified,
          lat: 51.5074,
          lng: -0.1278,
          email: user?.email,
        },
        recipientEmail: r.email,
        matchScore: 90,
        matchReason: 'Sent directly to you',
        venue: resolvedVenue as any,
        startsAt: parseStartsAt(),
        payment: paymentToEnum(),
        message: message.trim(),
        videoUrl: videoUri!,
        videoPoster: undefined,
        videoDurationSec: videoDuration ?? undefined,
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
            <View style={styles.recipientList}>
              {recipients.map((r) => {
                const selected = selectedRecipient?.email === r.email;
                return (
                  <TouchableOpacity
                    key={r.email}
                    style={[styles.recipientRow, selected && styles.recipientRowOn]}
                    onPress={() => setSelectedRecipient(r)}
                    activeOpacity={0.85}
                  >
                    {r.photoUrl ? (
                      <Image source={{ uri: r.photoUrl }} style={styles.recipientAvatar} />
                    ) : (
                      <View style={[styles.recipientAvatar, styles.recipientAvatarPlaceholder]}>
                        <Ionicons name="person" size={18} color={COLORS.TEXT_MUTED} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <View style={styles.recipientNameRow}>
                        <Text style={styles.recipientName}>
                          {r.name}{r.age ? `, ${r.age}` : ''}
                        </Text>
                        {r.verified && <Ionicons name="shield-checkmark" size={13} color={COLORS.LIKE} />}
                      </View>
                      {(r.city || r.gender) ? (
                        <Text style={styles.recipientMeta} numberOfLines={1}>
                          {[r.gender, r.city].filter(Boolean).join(' · ')}
                        </Text>
                      ) : null}
                    </View>
                    <View style={[styles.radio, selected && styles.radioOn]}>
                      {selected && <View style={styles.radioDot} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
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

          <Input label="Venue / Restaurant" placeholder="e.g., Balthazar, SoHo" value={venue} onChangeText={setVenue} icon="restaurant-outline" />
          <Input label="Alternative Plan (Optional)" placeholder="Backup idea if she has another preference..." value={alternativePlan} onChangeText={setAlternativePlan} icon="repeat-outline" />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Input label="Date" placeholder="April 12, 2026" value={preferredDate} onChangeText={setPreferredDate} error={errors.preferredDate} icon="calendar-outline" />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="Time" placeholder="7:30 PM" value={preferredTime} onChangeText={setPreferredTime} error={errors.preferredTime} icon="time-outline" />
            </View>
          </View>
        </View>

        {/* Payment */}
        <View style={styles.card}>
          <Text style={styles.sectionLbl}>Payment</Text>
          <View style={styles.payList}>
            {PAYMENT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.payRow, paymentArrangement === opt.key && styles.payRowOn]}
                onPress={() => setPaymentArrangement(opt.key)}
              >
                <View style={[styles.payIcon, paymentArrangement === opt.key && styles.payIconOn]}>
                  <Ionicons name={opt.icon as any} size={15} color={paymentArrangement === opt.key ? '#fff' : COLORS.PRIMARY} />
                </View>
                <Text style={[styles.payLbl, paymentArrangement === opt.key && styles.payLblOn]}>{opt.label}</Text>
                {paymentArrangement === opt.key && (
                  <Ionicons name="checkmark-circle" size={17} color={COLORS.PRIMARY} />
                )}
              </TouchableOpacity>
            ))}
          </View>
          {errors.paymentArrangement && <Text style={styles.err}>{errors.paymentArrangement}</Text>}
        </View>

        <Button title="Send Proposal" onPress={handleSend} loading={loading} size="lg" style={{ width: '100%', marginTop: 4 }} />
      </ScrollView>
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

  /* Recipient picker */
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
  payLbl: { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.TEXT_SECONDARY },
  payLblOn: { color: COLORS.PRIMARY, fontWeight: '700' },

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
