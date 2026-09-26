import React, { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  Image, StatusBar, Alert, ActivityIndicator, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import {
  fetchMyBlocks, unblock as unblockOnServer, SUPPORT_EMAIL, type BlockedMember,
  fetchRecentContacts, contactTarget, type RecentContact,
} from '@/lib/safety-supabase';
import { SafetySheet } from '@/components/SafetySheet';
import { useDatesStore } from '@/store/dates';
import { useProposalsStore } from '@/store/proposals';
import { useSettingsStore } from '@/store/settings';

const SAFETY_TIPS = [
  { icon: 'people', title: 'Always meet in public', desc: 'Restaurants, cafés, parks. We pre-vet every venue our matchmakers suggest.' },
  { icon: 'share-social', title: 'Share your location', desc: 'Send a friend your live location during the date.' },
  { icon: 'wallet', title: 'Get there yourself', desc: 'Don\'t accept rides. Use your own transport.' },
  { icon: 'wine', title: 'Trust your gut', desc: 'Don\'t leave drinks unattended. Leave anytime — no judgment.' },
  { icon: 'call', title: 'Have an exit plan', desc: 'Use our in-app SOS button. We can call you a ride or alert your contacts.' },
];

export default function SafetyScreen() {
  const router = useRouter();
  const { safety, hydrate: hydrateSettings, isHydrated: settingsHydrated } = useSettingsStore();
  const [blocked, setBlocked] = useState<BlockedMember[]>([]);
  const [loadingBlocks, setLoadingBlocks] = useState(true);
  /** Everyone you could report: recent calls, dates and invitations. */
  const [contacts, setContacts] = useState<RecentContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [reporting, setReporting] = useState<RecentContact | null>(null);

  useEffect(() => { if (!settingsHydrated) hydrateSettings(); }, []);
  const contactCount = safety.emergencyContacts.length;

  const loadLists = async () => {
    const [b, c] = await Promise.allSettled([fetchMyBlocks(), fetchRecentContacts()]);
    if (b.status === 'fulfilled') setBlocked(b.value);
    if (c.status === 'fulfilled') setContacts(c.value);
    setLoadingBlocks(false);
    setLoadingContacts(false);
  };

  // Load the real blocked list, and who you could report, from Supabase
  useEffect(() => { loadLists(); }, []);

  const emailReport = () =>
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Safety%20report`).catch(() =>
      Alert.alert('No mail app', `You can email us at ${SUPPORT_EMAIL}`));

  // By the block's own id: a block made from a call never gave us theirs.
  const unblock = (blockId: string, name: string) => {
    Alert.alert(`Unblock ${name}?`, 'You\'ll be able to see each other on Aura again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock',
        onPress: async () => {
          // Optimistic removal, then persist
          const prev = blocked;
          setBlocked((b) => b.filter(x => x.id !== blockId));
          try {
            await unblockOnServer(blockId);
          } catch (e: any) {
            setBlocked(prev); // revert on failure
            Alert.alert('Could not unblock', e?.message || 'Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={COLORS.TEXT} />
        </TouchableOpacity>
        <Text style={styles.title}>Safety</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Report someone: works with nothing else on screen */}
        <View style={[styles.section, { marginTop: 4 }]}>
          <Text style={styles.sectionTitle}>Report someone</Text>
          <View style={styles.card}>
            <Text style={styles.reportIntro}>
              Report anyone you've had a call, a date or an invitation with. Reporting blocks them at once, and
              a person on our team reviews every report within 24 hours and removes anyone who breaks our rules.
            </Text>
            {loadingContacts ? (
              <View style={{ padding: 18, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={COLORS.BRAND} />
              </View>
            ) : contacts.length === 0 ? (
              <Text style={styles.reportEmpty}>
                No one yet. Anyone you meet through Aura will appear here. You can also report from their profile,
                an invitation, a conversation, a date card or during a call.
              </Text>
            ) : (
              contacts.map((c) => (
                <View key={`${c.kind}:${c.id}`} style={[styles.contactRow, styles.rowBorderTop]}>
                  <View style={[styles.rowIcon, { backgroundColor: COLORS.BG }]}>
                    <Ionicons
                      name={c.kind === 'call' ? 'call-outline' : c.kind === 'date' ? 'calendar-outline' : 'mail-outline'}
                      size={17}
                      color={COLORS.TEXT_SECONDARY}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>{c.name}</Text>
                    <Text style={styles.rowDesc}>{c.detail} · {new Date(c.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.reportBtn}
                    onPress={() => setReporting(c)}
                    accessibilityLabel={`Report or block ${c.name}`}
                  >
                    <Ionicons name="flag-outline" size={14} color={COLORS.ERROR} />
                    <Text style={styles.reportBtnText}>Report</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
            <TouchableOpacity style={[styles.row, styles.rowBorderTop]} onPress={emailReport} activeOpacity={0.7}>
              <View style={[styles.rowIcon, { backgroundColor: COLORS.ERROR_LIGHT }]}>
                <Ionicons name="mail" size={17} color={COLORS.ERROR} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowLabel, { color: COLORS.ERROR }]}>Report something else</Text>
                <Text style={styles.rowDesc}>{SUPPORT_EMAIL} · we reply within 24 hours</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.BORDER} />
            </TouchableOpacity>
          </View>
          <Text style={styles.filterNote}>
            Names, bios, messages, photos and videos are screened automatically, and objectionable content is
            refused before anyone sees it.
          </Text>
        </View>

        {/* SOS card */}
        <View style={styles.sosCard}>
          <View style={styles.sosIconWrap}>
            <Ionicons name="warning" size={28} color="#fff" />
          </View>
          <Text style={styles.sosTitle}>SOS button</Text>
          <Text style={styles.sosDesc}>
            On a date and feel uncomfortable? Tap SOS to call emergency services or alert your trusted contacts with your location.
          </Text>
          <TouchableOpacity style={styles.sosBtn} onPress={() => router.push('/sos')} activeOpacity={0.85}>
            <Text style={styles.sosBtnText}>Open SOS</Text>
            <Ionicons name="arrow-forward" size={16} color={COLORS.ERROR} />
          </TouchableOpacity>
        </View>

        {/* Emergency contacts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Emergency contacts</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={() => router.push('/settings/emergency-contacts')}>
              <View style={[styles.rowIcon, { backgroundColor: COLORS.LIKE + '18' }]}>
                <Ionicons name="person-add" size={18} color={COLORS.LIKE} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>{contactCount > 0 ? 'Manage trusted contacts' : 'Add a trusted contact'}</Text>
                <Text style={styles.rowDesc}>
                  {contactCount > 0
                    ? `${contactCount} contact${contactCount > 1 ? 's' : ''} · alerted if you trigger SOS`
                    : 'They\'ll be notified if you trigger SOS'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.BORDER} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Safety tips */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Safety tips for first dates</Text>
          <View style={styles.card}>
            {SAFETY_TIPS.map((t, i) => (
              <View key={t.title} style={[styles.tipRow, i < SAFETY_TIPS.length - 1 && styles.rowBorder]}>
                <View style={styles.tipIcon}>
                  <Ionicons name={t.icon as any} size={20} color={COLORS.BRAND} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tipTitle}>{t.title}</Text>
                  <Text style={styles.tipDesc}>{t.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Blocked users */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Blocked ({blocked.length})</Text>
          {loadingBlocks ? (
            <View style={[styles.card, { padding: 24, alignItems: 'center' }]}>
              <ActivityIndicator size="small" color={COLORS.BRAND} />
            </View>
          ) : blocked.length === 0 ? (
            <View style={[styles.card, { padding: 24, alignItems: 'center' }]}>
              <Text style={styles.emptyText}>No one is blocked.</Text>
            </View>
          ) : (
            <View style={styles.card}>
              {blocked.map((u, i) => (
                <View key={u.id} style={[styles.blockRow, i < blocked.length - 1 && styles.rowBorder]}>
                  {u.photoUrl ? (
                    <Image source={{ uri: u.photoUrl }} style={styles.blockAvatar} />
                  ) : (
                    <View style={[styles.blockAvatar, styles.blockAvatarPlaceholder]}>
                      <Ionicons name="person" size={20} color={COLORS.TEXT_MUTED} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.blockName}>{u.name}{u.age ? `, ${u.age}` : ''}</Text>
                    {!!u.reason && <Text style={styles.blockMeta}>{u.reason}</Text>}
                  </View>
                  <TouchableOpacity style={styles.unblockBtn} onPress={() => unblock(u.id, u.name)}>
                    <Text style={styles.unblockText}>Unblock</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

      </ScrollView>

      <SafetySheet
        target={reporting ? contactTarget(reporting) : null}
        onClose={() => setReporting(null)}
        onDone={() => {
          // The server already hides them; drop them from the other tabs'
          // cached lists too, so the Dates card or the inbox don't linger.
          const c = reporting;
          if (c?.kind === 'date') {
            useDatesStore.setState((st: any) => ({ dates: st.dates.filter((d: any) => d.id !== c.id) }));
          } else if (c?.kind === 'proposal') {
            useProposalsStore.setState((st: any) => ({ proposals: st.proposals.filter((p: any) => p.id !== c.id) }));
          }
          useDatesStore.getState().refreshDates().catch(() => {});
          useProposalsStore.getState().refreshProposals().catch(() => {});
          setReporting(null);
          loadLists();
        }}
      />
    </SafeAreaView>
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

  sosCard: {
    marginHorizontal: 16, marginTop: 8, padding: 20, borderRadius: 22,
    backgroundColor: COLORS.ERROR, alignItems: 'center',
    shadowColor: COLORS.ERROR, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
  },
  sosIconWrap: {
    width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  sosTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 6 },
  sosDesc: { fontSize: 13, color: 'rgba(255,255,255,0.9)', textAlign: 'center', lineHeight: 19, marginBottom: 14 },
  sosBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fff', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12,
  },
  sosBtnText: { fontSize: 13, fontWeight: '800', color: COLORS.ERROR },

  section: { marginTop: 22 },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: COLORS.TEXT_MUTED, letterSpacing: 1, textTransform: 'uppercase', paddingHorizontal: 24, marginBottom: 8 },
  card: {
    marginHorizontal: 16, backgroundColor: COLORS.SURFACE, borderRadius: 18, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.BORDER_LIGHT },
  rowIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.BRAND_MUTED, justifyContent: 'center', alignItems: 'center' },
  rowLabel: { fontSize: 14, fontWeight: '600', color: COLORS.TEXT },
  rowDesc: { fontSize: 12, color: COLORS.TEXT_MUTED, marginTop: 2 },

  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  tipIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.BRAND_MUTED, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  tipTitle: { fontSize: 14, fontWeight: '700', color: COLORS.TEXT, marginBottom: 3 },
  tipDesc: { fontSize: 12, color: COLORS.TEXT_SECONDARY, lineHeight: 17 },

  blockRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  blockAvatar: { width: 46, height: 46, borderRadius: 23 },
  blockAvatarPlaceholder: { backgroundColor: COLORS.BRAND_MUTED, justifyContent: 'center', alignItems: 'center' },
  blockName: { fontSize: 14, fontWeight: '700', color: COLORS.TEXT },
  blockMeta: { fontSize: 11, color: COLORS.TEXT_MUTED, marginTop: 2 },
  unblockBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: COLORS.BG, borderWidth: 1, borderColor: COLORS.BORDER },
  unblockText: { fontSize: 12, fontWeight: '700', color: COLORS.TEXT_SECONDARY },

  emptyText: { fontSize: 14, color: COLORS.TEXT_MUTED },
  reportIntro: { fontSize: 13, color: COLORS.TEXT_SECONDARY, lineHeight: 19, padding: 14, paddingBottom: 10 },
  reportEmpty: { fontSize: 13, color: COLORS.TEXT_MUTED, lineHeight: 19, paddingHorizontal: 14, paddingBottom: 12 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  rowBorderTop: { borderTopWidth: 1, borderTopColor: COLORS.BORDER_LIGHT },
  reportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 36, paddingHorizontal: 12,
    borderRadius: 18, backgroundColor: COLORS.ERROR_LIGHT,
  },
  reportBtnText: { fontSize: 13, fontWeight: '800', color: COLORS.ERROR },
  filterNote: { fontSize: 12, color: COLORS.TEXT_MUTED, lineHeight: 17, paddingHorizontal: 24, marginTop: 8 },
});
