import { SafeAreaView } from 'react-native-safe-area-context';
import React from 'react';
import {
  StyleSheet, View, Text, ScrollView,
  Alert, TouchableOpacity, Image, Dimensions, StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/auth';
import { useProposalsStore } from '@/store/proposals';
import { useDatesStore } from '@/store/dates';
import { COLORS } from '@/constants/colors';

const SW = Dimensions.get('window').width;

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const proposals = useProposalsStore((s) => s.proposals);
  const dates = useDatesStore((s) => s.dates);

  // If for any reason we land on Profile without a logged-in user, send them
  // back to login. There is no demo profile any more.
  if (!user) {
    router.replace('/auth/login');
    return null;
  }

  const profile = user;
  const isVerified = !!profile.verified;

  // Real stats from the stores
  const email = (profile.email || '').toLowerCase().trim();
  const receivedCount = proposals.filter((p) => p?.recipientEmail?.toLowerCase?.() === email).length;
  const upcomingCount = dates.filter((d) => d.status === 'upcoming').length;
  const completedCount = dates.filter((d) => d.status === 'completed').length;
  const STATS = [
    { val: String(receivedCount), label: 'Proposals', icon: 'mail-outline', color: COLORS.BRAND },
    { val: String(upcomingCount), label: 'Upcoming', icon: 'calendar', color: COLORS.LIKE },
    { val: String(completedCount), label: 'Dates', icon: 'heart', color: COLORS.GOLD },
  ];

  // Real profile completion — fraction of key fields filled in
  const completionFields = [
    !!profile.photoUrl,
    !!profile.bio,
    !!profile.city,
    (profile.interests?.length ?? 0) > 0,
    !!(profile.birthday || profile.age),
    isVerified,
  ];
  const completionPct = Math.round(
    (completionFields.filter(Boolean).length / completionFields.length) * 100,
  );

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          // Close any open modals first so we don't end up showing the
          // /(tabs) under a stale modal after logout.
          try { (router as any).dismissAll?.(); } catch {}
          await logout();
          // Wipe in-memory store state too so the previous user's proposals
          // / dates don't briefly flash on the next account.
          try {
            useProposalsStore.setState({ proposals: [], decisions: {} } as any);
            useDatesStore.setState({ dates: [] } as any);
          } catch {}
          router.replace('/auth/login');
        },
      },
    ]);
  };

  const settings = [
    { icon: 'videocam-outline', label: 'Send a date proposal', desc: 'Record a video and send it by email', color: COLORS.BRAND, route: '/proposal/create' },
    { icon: 'options-outline', label: 'Date preferences', desc: 'Types, days, distance, age range', color: '#FF9F43', route: '/settings/preferences' },
    { icon: 'notifications-outline', label: 'Notifications', desc: 'Manage all alerts', color: '#FF6B81', route: '/settings/notifications' },
    { icon: 'eye-outline', label: 'Privacy', desc: 'Visibility & data', color: '#2B9FFF', route: '/settings/privacy' },
    { icon: 'shield-outline', label: 'Safety center', desc: 'SOS, blocked, safety tips', color: '#25D997', route: '/settings/safety' },
    { icon: 'diamond-outline', label: 'Aura Gold', desc: 'Premium membership', color: '#FFCF40', route: '/settings/subscription', highlight: true },
    { icon: 'help-circle-outline', label: 'Help & Support', desc: 'FAQ & contact us', color: '#A78BFA', route: null },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.topBar}>
          <Text style={styles.screenTitle}>Profile</Text>
          <View style={styles.topActions}>
            <TouchableOpacity style={styles.topBtn} onPress={() => router.push('/profile/edit')}>
              <Ionicons name="create-outline" size={20} color={COLORS.TEXT_SECONDARY} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.topBtn}>
              <Ionicons name="share-outline" size={20} color={COLORS.TEXT_SECONDARY} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Hero card */}
        <View style={styles.heroCard}>
          <View style={styles.heroPhotoWrap}>
            {profile.photoUrl ? (
              <Image source={{ uri: profile.photoUrl }} style={styles.heroPhoto} />
            ) : (
              <View style={[styles.heroPhoto, styles.heroPhotoPlaceholder]}>
                <Ionicons name="person" size={40} color={COLORS.TEXT_MUTED} />
              </View>
            )}
            <TouchableOpacity style={styles.editPhotoBtn} onPress={() => router.push('/profile/edit')}>
              <Ionicons name="camera" size={16} color="#fff" />
            </TouchableOpacity>
            {isVerified && (
              <View style={styles.verifiedRing}>
                <Ionicons name="shield-checkmark" size={16} color="#fff" />
              </View>
            )}
          </View>

          <View style={styles.heroInfo}>
            <View style={styles.heroNameRow}>
              <Text style={styles.heroName}>{profile.name}, {profile.age}</Text>
              {isVerified && <Ionicons name="shield-checkmark" size={20} color={COLORS.LIKE} />}
            </View>
            <View style={styles.heroMeta}>
              <Ionicons name="location-outline" size={14} color={COLORS.TEXT_MUTED} />
              <Text style={styles.heroCity}>{profile.city}</Text>
            </View>
            <TouchableOpacity style={styles.editProfileBtn} onPress={() => router.push('/profile/edit')}>
              <Text style={styles.editProfileText}>Edit Profile</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Verification CTA — only if not verified */}
        {!isVerified && (
          <TouchableOpacity
            style={styles.verifyCard}
            onPress={() => router.push('/verify')}
            activeOpacity={0.92}
          >
            <View style={styles.verifyLeft}>
              <View style={styles.verifyIconWrap}>
                <Ionicons name="shield-checkmark" size={28} color="#fff" />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.verifyTopRow}>
                <Text style={styles.verifyTitle}>Get the verified badge</Text>
                <View style={styles.newPill}>
                  <Text style={styles.newPillText}>NEW</Text>
                </View>
              </View>
              <Text style={styles.verifyDesc}>
                Quick biometric check. Verified profiles get 4× more proposals.
              </Text>
              <View style={styles.verifyCtaRow}>
                <Text style={styles.verifyCtaText}>Verify now</Text>
                <Ionicons name="arrow-forward" size={14} color={COLORS.BRAND} />
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* Already verified status badge */}
        {isVerified && (
          <View style={styles.verifiedCard}>
            <View style={styles.verifiedIconWrap}>
              <Ionicons name="shield-checkmark" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.verifiedTitle}>You're verified ✨</Text>
              <Text style={styles.verifiedSub}>Verified on {new Date(profile.verifiedAt || '').toLocaleDateString()}</Text>
            </View>
            <Ionicons name="checkmark-circle" size={24} color={COLORS.LIKE} />
          </View>
        )}

        {/* Profile completion */}
        <View style={styles.completionCard}>
          <View style={styles.completionHeader}>
            <Text style={styles.completionTitle}>Profile Strength</Text>
            <Text style={styles.completionPct}>{completionPct}%</Text>
          </View>
          <View style={styles.completionTrack}>
            <View style={[styles.completionFill, { width: `${completionPct}%` }]} />
          </View>
          <Text style={styles.completionHint}>
            {isVerified ? 'Your profile is at full strength ⚡' : 'Verify to reach 100% ⚡'}
          </Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {STATS.map((s, i) => (
            <View key={i} style={[styles.statBox, i === 1 && styles.statBoxMid]}>
              <View style={[styles.statIcon, { backgroundColor: s.color + '18' }]}>
                <Ionicons name={s.icon as any} size={18} color={s.color} />
              </View>
              <Text style={styles.statVal}>{s.val}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* About */}
        {profile.bio && (
          <View style={styles.section}>
            <Text style={styles.secTitle}>About</Text>
            <Text style={styles.bioText}>{profile.bio}</Text>
          </View>
        )}

        {/* Interests */}
        {(profile.interests?.length ?? 0) > 0 && (
          <View style={styles.section}>
            <Text style={styles.secTitle}>Interests</Text>
            <View style={styles.interestGrid}>
              {profile.interests!.map((tag) => (
                <View key={tag} style={styles.interestChip}>
                  <Text style={styles.interestText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Settings */}
        <View style={styles.settingsSection}>
          <Text style={[styles.secTitle, { paddingHorizontal: 20 }]}>Settings</Text>
          <View style={styles.settingsCard}>
            {settings.map((s, i) => (
              <TouchableOpacity
                key={s.label}
                style={[
                  styles.settingRow,
                  i < settings.length - 1 && styles.settingRowBorder,
                  s.highlight && styles.settingRowHighlight,
                ]}
                onPress={() => s.route ? router.push(s.route as any) : Alert.alert(s.label, 'Coming soon!')}
                activeOpacity={0.7}
              >
                <View style={[styles.settingIcon, { backgroundColor: s.color + '18' }]}>
                  <Ionicons name={s.icon as any} size={18} color={s.color} />
                </View>
                <View style={styles.settingBody}>
                  <Text style={[styles.settingLabel, s.highlight && { color: s.color }]}>{s.label}</Text>
                  <Text style={styles.settingDesc}>{s.desc}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={COLORS.BORDER} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color={COLORS.ERROR} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>Aura · v1.0.0</Text>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },

  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16,
  },
  screenTitle: { fontSize: 28, fontWeight: '800', color: COLORS.TEXT, letterSpacing: -0.5 },
  topActions: { flexDirection: 'row', gap: 8 },
  topBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.SURFACE,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: COLORS.SHADOW, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2,
  },

  heroCard: {
    flexDirection: 'row', gap: 16, alignItems: 'center',
    marginHorizontal: 16, backgroundColor: COLORS.SURFACE, borderRadius: 24, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 4,
    marginBottom: 14,
  },
  heroPhotoWrap: { position: 'relative' },
  heroPhoto: { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: COLORS.BRAND_MUTED },
  heroPhotoPlaceholder: { backgroundColor: COLORS.BRAND_MUTED, justifyContent: 'center', alignItems: 'center' },
  editPhotoBtn: {
    position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.BRAND, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.SURFACE,
  },
  verifiedRing: {
    position: 'absolute', top: -2, right: -2, width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.LIKE, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2.5, borderColor: COLORS.SURFACE,
  },
  heroInfo: { flex: 1 },
  heroNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 },
  heroName: { fontSize: 22, fontWeight: '800', color: COLORS.TEXT },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  heroCity: { fontSize: 13, color: COLORS.TEXT_MUTED, fontWeight: '500' },
  editProfileBtn: {
    alignSelf: 'flex-start', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: COLORS.BRAND,
  },
  editProfileText: { fontSize: 13, fontWeight: '700', color: COLORS.BRAND },

  verifyCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 16, padding: 18, borderRadius: 22, backgroundColor: COLORS.BRAND,
    shadowColor: COLORS.BRAND, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 18, elevation: 10,
    marginBottom: 14,
  },
  verifyLeft: {},
  verifyIconWrap: {
    width: 56, height: 56, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  verifyTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  verifyTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  newPill: { backgroundColor: '#fff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  newPillText: { fontSize: 9, fontWeight: '900', color: COLORS.BRAND, letterSpacing: 0.5 },
  verifyDesc: { fontSize: 13, color: 'rgba(255,255,255,0.92)', lineHeight: 18, marginBottom: 8 },
  verifyCtaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, alignSelf: 'flex-start',
  },
  verifyCtaText: { fontSize: 12, fontWeight: '800', color: COLORS.BRAND },

  verifiedCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 16, padding: 16, borderRadius: 18,
    backgroundColor: COLORS.LIKE_BG, borderWidth: 1, borderColor: COLORS.LIKE + '40',
    marginBottom: 14,
  },
  verifiedIconWrap: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.LIKE,
    justifyContent: 'center', alignItems: 'center',
  },
  verifiedTitle: { fontSize: 15, fontWeight: '800', color: COLORS.LIKE },
  verifiedSub: { fontSize: 12, color: COLORS.TEXT_SECONDARY, marginTop: 2 },

  completionCard: {
    marginHorizontal: 16, backgroundColor: COLORS.SURFACE, borderRadius: 18, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
    marginBottom: 14,
  },
  completionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  completionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.TEXT },
  completionPct: { fontSize: 14, fontWeight: '800', color: COLORS.BRAND },
  completionTrack: {
    height: 6, backgroundColor: COLORS.BORDER_LIGHT, borderRadius: 3, overflow: 'hidden', marginBottom: 8,
  },
  completionFill: {
    height: '100%', backgroundColor: COLORS.BRAND, borderRadius: 3,
  },
  completionHint: { fontSize: 12, color: COLORS.TEXT_MUTED },

  statsRow: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 14, backgroundColor: COLORS.SURFACE,
    borderRadius: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 18 },
  statBoxMid: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: COLORS.BORDER_LIGHT },
  statIcon: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  statVal: { fontSize: 20, fontWeight: '900', color: COLORS.TEXT, marginBottom: 3 },
  statLabel: { fontSize: 10, fontWeight: '700', color: COLORS.TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.5 },

  section: {
    marginHorizontal: 16, backgroundColor: COLORS.SURFACE, borderRadius: 20, padding: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
    marginBottom: 14,
  },
  secTitle: { fontSize: 13, fontWeight: '800', color: COLORS.TEXT_MUTED, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },
  bioText: { fontSize: 15, color: COLORS.TEXT_SECONDARY, lineHeight: 24 },
  interestGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  interestChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: COLORS.BRAND_MUTED, borderWidth: 1, borderColor: COLORS.BRAND + '40',
  },
  interestText: { fontSize: 13, fontWeight: '700', color: COLORS.BRAND },

  promptSection: { marginBottom: 14 },
  promptCard: {
    marginHorizontal: 16, marginBottom: 10, backgroundColor: COLORS.SURFACE, borderRadius: 20, padding: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
    borderLeftWidth: 3, borderLeftColor: COLORS.BRAND,
  },
  promptQ: { fontSize: 12, fontWeight: '800', color: COLORS.BRAND, letterSpacing: 0.5, marginBottom: 8 },
  promptA: { fontSize: 15, color: COLORS.TEXT, lineHeight: 23 },

  settingsSection: { marginBottom: 14 },
  settingsCard: {
    marginHorizontal: 16, backgroundColor: COLORS.SURFACE, borderRadius: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  settingRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  settingRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.BORDER_LIGHT },
  settingRowHighlight: { backgroundColor: COLORS.GOLD + '0D' },
  settingIcon: { width: 40, height: 40, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  settingBody: { flex: 1 },
  settingLabel: { fontSize: 15, fontWeight: '600', color: COLORS.TEXT },
  settingDesc: { fontSize: 12, color: COLORS.TEXT_MUTED, marginTop: 2 },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    marginHorizontal: 16, paddingVertical: 16, borderRadius: 18,
    backgroundColor: COLORS.ERROR_LIGHT,
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: COLORS.ERROR },
  versionText: { textAlign: 'center', fontSize: 11, color: COLORS.TEXT_MUTED, marginTop: 16, fontWeight: '500' },
});
