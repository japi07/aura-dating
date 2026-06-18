import React, { useEffect, useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  Switch, StatusBar, Alert, Share,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import { useSettingsStore } from '@/store/settings';
import { useAuthStore } from '@/store/auth';
import { useProposalsStore } from '@/store/proposals';
import { useDatesStore } from '@/store/dates';
import { deleteMyAccount } from '@/lib/profile-supabase';
import { getSessionUserId } from '@/lib/proposals-supabase';
import { useIsGold } from '@/store/subscription';

const VISIBILITY_OPTIONS: { key: 'all' | 'verifiedOnly' | 'paused'; label: string; desc: string; icon: string }[] = [
  { key: 'all', label: 'All verified men', desc: 'Maximum visibility — recommended', icon: 'eye' },
  { key: 'verifiedOnly', label: 'Only highly verified men', desc: 'Both biometric + ID verified', icon: 'shield-checkmark' },
  { key: 'paused', label: 'Pause my profile', desc: 'You\'ll receive zero proposals', icon: 'pause' },
];

export default function PrivacyScreen() {
  const router = useRouter();
  const { privacy, hydrate, isHydrated, updatePrivacy } = useSettingsStore();
  const settings = useSettingsStore();
  const { logout, user } = useAuthStore();
  const proposals = useProposalsStore((s) => s.proposals);
  const dates = useDatesStore((s) => s.dates);
  const isGold = useIsGold();
  const [exporting, setExporting] = useState(false);

  useEffect(() => { if (!isHydrated) hydrate(); }, []);

  const visibility = privacy.visibility;
  const setVisibility = (v: typeof privacy.visibility) => updatePrivacy({ visibility: v });
  const showLastSeen = privacy.showLastSeen;
  const setShowLastSeen = (v: boolean) => updatePrivacy({ showLastSeen: v });
  const readReceipts = privacy.readReceipts;
  const setReadReceipts = (v: boolean) => updatePrivacy({ readReceipts: v });
  const hideAge = privacy.hideAge;
  const setHideAge = (v: boolean) => updatePrivacy({ hideAge: v });
  const hideJob = privacy.hideJob;
  const setHideJob = (v: boolean) => updatePrivacy({ hideJob: v });
  const incognito = privacy.incognito;
  const setIncognito = (v: boolean) => {
    // Incognito is an Aura Gold perk — gate turning it on
    if (v && !isGold) {
      Alert.alert(
        'Aura Gold feature',
        'Incognito mode lets you browse without being seen. It\'s included with Aura Gold.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'See Aura Gold', onPress: () => router.push('/settings/subscription') },
        ],
      );
      return;
    }
    updatePrivacy({ incognito: v });
  };
  const shareAnalytics = privacy.shareAnalytics;
  const setShareAnalytics = (v: boolean) => updatePrivacy({ shareAnalytics: v });

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account?',
      'All your data — profile, proposals and dates — will be permanently removed. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            const signedIn = await getSessionUserId();
            if (signedIn) {
              try {
                // Server-side deletion via the delete-account Edge Function
                await deleteMyAccount();
              } catch (e: any) {
                Alert.alert(
                  'Could not delete account',
                  e?.message || 'Please try again, or contact support if this continues.',
                );
                return;
              }
            }
            // Clear local session + cached state and return to login
            await logout();
            router.replace('/auth/login');
          },
        },
      ],
    );
  };

  const handleDownloadData = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const myEmail = (user?.email || '').toLowerCase().trim();
      const archive = {
        exportedAt: new Date().toISOString(),
        profile: user ?? null,
        settings: {
          notifications: settings.notifications,
          privacy: settings.privacy,
          dates: settings.dates,
          safety: settings.safety,
        },
        proposals: proposals.filter(
          (p) => p?.recipientEmail?.toLowerCase?.() === myEmail || p?.from?.email?.toLowerCase?.() === myEmail,
        ),
        dates,
      };
      const json = JSON.stringify(archive, null, 2);
      const fileUri = `${FileSystem.cacheDirectory}aura-my-data.json`;
      await FileSystem.writeAsStringAsync(fileUri, json, { encoding: FileSystem.EncodingType.UTF8 });
      await Share.share(
        { url: fileUri, title: 'My Aura data', message: 'My Aura data export' },
        { subject: 'My Aura data export' },
      );
    } catch (e: any) {
      Alert.alert('Could not export', e?.message || 'Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={COLORS.TEXT} />
        </TouchableOpacity>
        <Text style={styles.title}>Privacy</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Profile visibility */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Who can send me proposals</Text>
          <View style={styles.card}>
            {VISIBILITY_OPTIONS.map((opt, i) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.optionRow, i < VISIBILITY_OPTIONS.length - 1 && styles.rowBorder]}
                onPress={() => setVisibility(opt.key)}
                activeOpacity={0.7}
              >
                <View style={[styles.optionIcon, visibility === opt.key && { backgroundColor: COLORS.BRAND }]}>
                  <Ionicons name={opt.icon as any} size={18} color={visibility === opt.key ? '#fff' : COLORS.BRAND} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionLabel}>{opt.label}</Text>
                  <Text style={styles.optionDesc}>{opt.desc}</Text>
                </View>
                <View style={[styles.radio, visibility === opt.key && styles.radioOn]}>
                  {visibility === opt.key && <View style={styles.radioDot} />}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Profile details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile details</Text>
          <View style={styles.card}>
            <ToggleRow icon="briefcase" label="Hide my job title" desc="Won't show on your profile" value={hideJob} onChange={setHideJob} border />
            <ToggleRow icon="calendar" label="Hide my exact age" desc="Show '20s' or '30s' instead" value={hideAge} onChange={setHideAge} />
          </View>
        </View>

        {/* Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activity</Text>
          <View style={styles.card}>
            <ToggleRow icon="time" label="Show last active" desc="Let others see when you're online" value={showLastSeen} onChange={setShowLastSeen} border />
            <ToggleRow icon="checkmark-done" label="Read receipts on proposals" desc="Senders see when you've viewed their proposal" value={readReceipts} onChange={setReadReceipts} border />
            <ToggleRow icon="eye-off" label="Incognito mode" desc="Browse profiles without being seen" value={incognito} onChange={setIncognito} premium />
          </View>
        </View>

        {/* Data */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data</Text>
          <View style={styles.card}>
            <ToggleRow icon="analytics" label="Help improve Aura" desc="Anonymous usage analytics" value={shareAnalytics} onChange={setShareAnalytics} border />
            <ActionRow icon="download" label="Download my data" onPress={handleDownloadData} />
            <ActionRow icon="trash" label="Delete my account" onPress={handleDeleteAccount} danger />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ToggleRow({ icon, label, desc, value, onChange, border, premium }: any) {
  return (
    <View style={[styles.row, border && styles.rowBorder]}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon as any} size={18} color={COLORS.BRAND} />
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowLabelRow}>
          <Text style={styles.rowLabel}>{label}</Text>
          {premium && (
            <View style={styles.premiumBadge}>
              <Ionicons name="diamond" size={9} color={COLORS.GOLD} />
              <Text style={styles.premiumText}>GOLD</Text>
            </View>
          )}
        </View>
        <Text style={styles.rowDesc}>{desc}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: COLORS.BORDER, true: COLORS.BRAND }}
        thumbColor="#fff"
      />
    </View>
  );
}

function ActionRow({ icon, label, onPress, danger }: any) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.rowIcon, danger && { backgroundColor: COLORS.ERROR_LIGHT }]}>
        <Ionicons name={icon as any} size={18} color={danger ? COLORS.ERROR : COLORS.BRAND} />
      </View>
      <Text style={[styles.rowLabel, { flex: 1 }, danger && { color: COLORS.ERROR }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={COLORS.BORDER} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 12,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: COLORS.TEXT },

  section: { marginTop: 20 },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: COLORS.TEXT_MUTED, letterSpacing: 1, textTransform: 'uppercase', paddingHorizontal: 24, marginBottom: 8 },
  card: {
    marginHorizontal: 16, backgroundColor: COLORS.SURFACE, borderRadius: 18, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.BORDER_LIGHT },
  optionIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.BRAND_MUTED, justifyContent: 'center', alignItems: 'center' },
  optionLabel: { fontSize: 14, fontWeight: '600', color: COLORS.TEXT },
  optionDesc: { fontSize: 12, color: COLORS.TEXT_MUTED, marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: COLORS.BORDER, justifyContent: 'center', alignItems: 'center' },
  radioOn: { borderColor: COLORS.BRAND },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.BRAND },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.BRAND_MUTED, justifyContent: 'center', alignItems: 'center' },
  rowBody: { flex: 1 },
  rowLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowLabel: { fontSize: 14, fontWeight: '600', color: COLORS.TEXT },
  rowDesc: { fontSize: 12, color: COLORS.TEXT_MUTED, marginTop: 2, lineHeight: 16 },
  premiumBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: COLORS.GOLD + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  premiumText: { fontSize: 9, fontWeight: '900', color: COLORS.GOLD, letterSpacing: 0.5 },
});
