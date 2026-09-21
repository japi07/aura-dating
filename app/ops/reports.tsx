import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, RefreshControl,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import { fetchReports, resolveReport, type ReportRow } from '@/lib/safety-supabase';

type Tab = 'open' | 'actioned' | 'dismissed';

const CONTEXT_LABEL: Record<ReportRow['context'], string> = {
  call: 'During a call',
  date: 'About a date',
  proposal: 'On a proposal',
  profile: 'From their profile',
};

/**
 * The safety queue. Apple's guideline 1.2 asks that every report is acted on
 * within 24 hours, so the oldest open report is first and anything past 24
 * hours says so. Everything here is admin-only on the server; a member who
 * found this screen would get an empty list and an error, not the reports.
 */
export default function ReportsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('open');
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async (which: Tab) => {
    try {
      setRows(await fetchReports(which));
    } catch (e: any) {
      Alert.alert('Could not load reports', e?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { setLoading(true); load(tab); }, [tab, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(tab);
    setRefreshing(false);
  };

  const ban = (r: ReportRow) => {
    Alert.alert(
      `Remove ${r.reported.name}?`,
      'They are banned at once: their profile, proposals and messages disappear for every member, anything queued or live is ended, and every open report against them is closed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove and ban',
          style: 'destructive',
          onPress: async () => {
            setActing(r.id);
            try {
              await resolveReport(r.id, 'ban', `Removed after report: ${r.reason}`);
              await load(tab);
            } catch (e: any) {
              Alert.alert('Could not ban', e?.message || 'Please try again.');
            } finally {
              setActing(null);
            }
          },
        },
      ],
    );
  };

  const dismiss = (r: ReportRow) => {
    Alert.alert('Dismiss this report?', 'Use this when nothing broke the rules. The reporter keeps them blocked either way.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Dismiss',
        onPress: async () => {
          setActing(r.id);
          try {
            await resolveReport(r.id, 'dismiss', 'No breach found');
            await load(tab);
          } catch (e: any) {
            Alert.alert('Could not dismiss', e?.message || 'Please try again.');
          } finally {
            setActing(null);
          }
        },
      },
    ]);
  };

  const overdue = rows.filter((r) => hoursSince(r.createdAt) >= 24).length;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <View style={s.header}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          style={s.backBtn}
        >
          <Ionicons name="chevron-back" size={26} color={COLORS.TEXT} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Safety reports</Text>
          <Text style={[s.sub, tab === 'open' && overdue > 0 && { color: COLORS.ERROR }]}>
            {tab !== 'open'
              ? `${rows.length} ${tab}`
              : rows.length === 0
                ? 'Nothing waiting'
                : overdue > 0
                  ? `${rows.length} open · ${overdue} past 24 hours`
                  : `${rows.length} open · act within 24 hours`}
          </Text>
        </View>
      </View>

      <View style={s.tabs}>
        {(['open', 'actioned', 'dismissed'] as Tab[]).map((t) => (
          <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabOn]} onPress={() => setTab(t)}>
            <Text style={[s.tabText, tab === t && s.tabTextOn]}>{t[0].toUpperCase() + t.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.BRAND} />}
      >
        {loading ? (
          <View style={s.empty}><ActivityIndicator color={COLORS.BRAND} /></View>
        ) : rows.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="shield-checkmark-outline" size={40} color={COLORS.SUCCESS} />
            <Text style={s.emptyTitle}>{tab === 'open' ? 'All clear' : `No ${tab} reports`}</Text>
            {tab === 'open' && (
              <Text style={s.emptySub}>New reports arrive here, and as a notification on this phone.</Text>
            )}
          </View>
        ) : (
          rows.map((r) => {
            const h = hoursSince(r.createdAt);
            const late = tab === 'open' && h >= 24;
            return (
              <View key={r.id} style={[s.card, late && s.cardLate]}>
                <View style={s.cardTop}>
                  <View style={[s.pill, late ? s.pillLate : s.pillNeutral]}>
                    <Text style={[s.pillText, late && { color: '#fff' }]}>
                      {tab === 'open' ? (late ? `${Math.floor(h)}h, overdue` : `${Math.floor(h)}h ago`) : formatWhen(r.reviewedAt ?? r.createdAt)}
                    </Text>
                  </View>
                  <Text style={s.context}>{CONTEXT_LABEL[r.context]}</Text>
                </View>

                <Text style={s.reason}>{r.reason}</Text>
                {!!r.details && <Text style={s.details}>“{r.details}”</Text>}

                <View style={s.person}>
                  {r.reported.photoUrl
                    ? <Image source={{ uri: r.reported.photoUrl }} style={s.avatar} />
                    : <View style={[s.avatar, s.avatarEmpty]}><Ionicons name="person" size={18} color={COLORS.TEXT_MUTED} /></View>}
                  <View style={{ flex: 1 }}>
                    <Text style={s.personName}>
                      {r.reported.name}
                      {r.reported.bannedAt ? '  · banned' : ''}
                    </Text>
                    <Text style={s.personMeta}>{r.reported.email}</Text>
                    <Text style={s.personMeta}>
                      {r.reported.openReports} open report{r.reported.openReports === 1 ? '' : 's'} against them
                    </Text>
                    {!!r.reported.bio && <Text style={s.bio} numberOfLines={3}>{r.reported.bio}</Text>}
                  </View>
                </View>

                <Text style={s.reporter}>Reported by {r.reporter.name} · {r.reporter.email}</Text>
                {!!r.actionNote && tab !== 'open' && <Text style={s.reporter}>Note: {r.actionNote}</Text>}

                {tab === 'open' && (
                  <View style={s.actions}>
                    <TouchableOpacity style={s.dismissBtn} onPress={() => dismiss(r)} disabled={acting === r.id}>
                      <Text style={s.dismissText}>Dismiss</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.banBtn} onPress={() => ban(r)} disabled={acting === r.id}>
                      {acting === r.id
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={s.banText}>Remove and ban</Text>}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function hoursSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, gap: 4 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.TEXT, letterSpacing: -0.4 },
  sub: { fontSize: 13, color: COLORS.TEXT_SECONDARY, marginTop: 2, fontWeight: '600' },

  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  tab: {
    paddingHorizontal: 14, minHeight: 36, borderRadius: 18, justifyContent: 'center',
    backgroundColor: COLORS.SURFACE, borderWidth: 1, borderColor: COLORS.BORDER,
  },
  tabOn: { backgroundColor: COLORS.TEXT, borderColor: COLORS.TEXT },
  tabText: { fontSize: 13, fontWeight: '700', color: COLORS.TEXT_SECONDARY },
  tabTextOn: { color: '#fff' },

  list: { padding: 16, gap: 12, paddingBottom: 40 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: COLORS.TEXT },
  emptySub: { fontSize: 13.5, color: COLORS.TEXT_SECONDARY, textAlign: 'center', maxWidth: 260 },

  card: {
    backgroundColor: COLORS.SURFACE, borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: COLORS.BORDER_LIGHT,
  },
  cardLate: { borderColor: COLORS.ERROR },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  pillNeutral: { backgroundColor: COLORS.BG },
  pillLate: { backgroundColor: COLORS.ERROR },
  pillText: { fontSize: 12, fontWeight: '800', color: COLORS.TEXT_SECONDARY, fontVariant: ['tabular-nums'] },
  context: { fontSize: 12, fontWeight: '700', color: COLORS.TEXT_MUTED },

  reason: { fontSize: 17, fontWeight: '800', color: COLORS.TEXT, marginTop: 12 },
  details: { fontSize: 14, color: COLORS.TEXT_SECONDARY, lineHeight: 20, marginTop: 6, fontStyle: 'italic' },

  person: {
    flexDirection: 'row', gap: 12, marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: COLORS.BG,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarEmpty: { backgroundColor: COLORS.BORDER_LIGHT, alignItems: 'center', justifyContent: 'center' },
  personName: { fontSize: 15, fontWeight: '800', color: COLORS.TEXT },
  personMeta: { fontSize: 12.5, color: COLORS.TEXT_SECONDARY, marginTop: 1 },
  bio: { fontSize: 12.5, color: COLORS.TEXT_MUTED, marginTop: 6, lineHeight: 17 },

  reporter: { fontSize: 12, color: COLORS.TEXT_MUTED, marginTop: 10 },

  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  dismissBtn: {
    flex: 1, minHeight: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.BORDER, backgroundColor: COLORS.SURFACE,
  },
  dismissText: { fontSize: 14, fontWeight: '800', color: COLORS.TEXT_SECONDARY },
  banBtn: {
    flex: 1.4, minHeight: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.ERROR,
  },
  banText: { fontSize: 14, fontWeight: '800', color: '#fff' },
});
