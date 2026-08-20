import React, { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity, StatusBar,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '@/constants/colors';
import { useTokensStore } from '@/store/tokens';
import { useSubscriptionStore } from '@/store/subscription';
import {
  fetchTokenHistory, describeReason, MODE_LABEL, MODE_EMOJI,
  type LedgerRow, type DateMode,
} from '@/lib/tokens-supabase';
import { formatDate } from '@/lib/format';

const MODES: DateMode[] = ['call', 'blind', 'proposal'];

/**
 * The wallet.
 *
 * Balance, tonight's tickets, and every movement that produced the number.
 * The history is not decoration: a balance someone cannot explain is a
 * support ticket, and "where did my tokens go" is the single most likely
 * question once anything costs anything.
 */
export default function WalletScreen() {
  const router = useRouter();
  const { balance, prices, entries, isHydrated, hydrate, refresh } = useTokensStore();
  const isGold = useSubscriptionStore((st) => st.isGold);

  const [history, setHistory] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setHistory(await fetchTokenHistory(40)); } catch { /* offline */ }
  }, []);

  useEffect(() => {
    (async () => {
      if (!isHydrated) await hydrate();
      await load();
      setLoading(false);
    })();
  }, [isHydrated, hydrate, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refresh(), load()]);
    setRefreshing(false);
  }, [refresh, load]);

  const queued = MODES.filter((m) => !!entries[m]);

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
        <Text style={s.title}>Tokens</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={s.centered}><ActivityIndicator color={COLORS.BRAND} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={s.body}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.BRAND} />
          }
        >
          <LinearGradient
            colors={[COLORS.PLUM, '#2A1C38']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.balanceCard}
          >
            <Text style={s.balanceLabel}>Your balance</Text>
            <View style={s.balanceRow}>
              <Ionicons name="diamond" size={30} color={COLORS.GOLD_LIGHT} />
              <Text style={s.balanceValue}>{balance}</Text>
            </View>
            <Text style={s.balanceSub}>
              {isGold ? 'Gold — topped up every month' : 'Free plan'}
            </Text>
          </LinearGradient>

          {queued.length > 0 && (
            <>
              <Text style={s.sectionLabel}>Booked for tonight</Text>
              <View style={s.card}>
                {queued.map((m, i) => (
                  <View key={m} style={[s.queuedRow, i === queued.length - 1 && { marginBottom: 0 }]}>
                    <Text style={s.queuedEmoji}>{MODE_EMOJI[m]}</Text>
                    <Text style={s.queuedName}>{MODE_LABEL[m]}</Text>
                    <View style={s.queuedPill}>
                      <Ionicons name="checkmark" size={12} color={COLORS.LIKE} />
                      <Text style={s.queuedPillText}>
                        {entries[m]!.status === 'used' ? 'In play' : 'Queued'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}

          <Text style={s.sectionLabel}>What things cost</Text>
          <View style={s.card}>
            {MODES.map((m, i) => (
              <View key={m} style={[s.priceRow, i === MODES.length - 1 && { marginBottom: 0 }]}>
                <Text style={s.queuedEmoji}>{MODE_EMOJI[m]}</Text>
                <Text style={s.queuedName}>{MODE_LABEL[m]}</Text>
                <View style={s.costPill}>
                  <Ionicons name="diamond" size={11} color={COLORS.GOLD_DEEP} />
                  <Text style={s.costText}>{prices[m] ?? 1}</Text>
                </View>
              </View>
            ))}
          </View>

          {!isGold && (
            <TouchableOpacity
              style={s.upsell}
              onPress={() => router.push('/settings/subscription')}
              activeOpacity={0.88}
            >
              <Ionicons name="sparkles" size={17} color={COLORS.GOLD_DEEP} />
              <View style={{ flex: 1 }}>
                <Text style={s.upsellTitle}>Get more tokens</Text>
                <Text style={s.upsellSub}>Gold tops you up every month</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={COLORS.GOLD_DEEP} />
            </TouchableOpacity>
          )}

          <Text style={s.sectionLabel}>History</Text>
          {history.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyText}>Nothing yet.</Text>
            </View>
          ) : (
            <View style={s.card}>
              {history.map((h, i) => (
                <View
                  key={`${h.createdAt}-${i}`}
                  style={[s.histRow, i === history.length - 1 && { marginBottom: 0 }]}
                >
                  <View style={[s.histIcon, h.delta > 0 ? s.histIconIn : s.histIconOut]}>
                    <Ionicons
                      name={h.delta > 0 ? 'arrow-down' : 'arrow-up'}
                      size={13}
                      color={h.delta > 0 ? COLORS.LIKE : COLORS.TEXT_MUTED}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.histTitle}>{describeReason(h.reason)}</Text>
                    <Text style={s.histDate}>{formatDate(h.createdAt)}</Text>
                  </View>
                  <Text style={[s.histDelta, h.delta > 0 && { color: COLORS.LIKE }]}>
                    {h.delta > 0 ? '+' : ''}{h.delta}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 12,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: COLORS.TEXT },

  body: { padding: 20, paddingBottom: 44 },

  balanceCard: {
    borderRadius: 22, paddingVertical: 24, alignItems: 'center', marginBottom: 8,
    shadowColor: '#1A0F26', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.16,
    shadowRadius: 16, elevation: 6,
  },
  balanceLabel: {
    fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1, textTransform: 'uppercase',
  },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  balanceValue: { fontSize: 46, fontWeight: '300', color: '#fff', letterSpacing: 1 },
  balanceSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2, fontWeight: '600' },

  sectionLabel: {
    fontSize: 11, fontWeight: '800', color: COLORS.TEXT_MUTED,
    letterSpacing: 0.9, textTransform: 'uppercase', marginTop: 22, marginBottom: 10,
  },
  card: {
    backgroundColor: COLORS.SURFACE, borderRadius: 20, padding: 16,
    shadowColor: '#1A0F26', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05,
    shadowRadius: 10, elevation: 2,
  },

  queuedRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  queuedEmoji: { fontSize: 20 },
  queuedName: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.TEXT },
  queuedPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.LIKE_BG, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5,
  },
  queuedPillText: { fontSize: 11.5, fontWeight: '800', color: COLORS.LIKE },
  costPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.GOLD_MUTED, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5,
  },
  costText: { fontSize: 12, fontWeight: '800', color: COLORS.GOLD_DEEP },

  upsell: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14,
    backgroundColor: COLORS.GOLD_MUTED, borderRadius: 16, padding: 15,
    borderWidth: 1, borderColor: COLORS.GOLD_LIGHT,
  },
  upsellTitle: { fontSize: 14, fontWeight: '800', color: COLORS.GOLD_DEEP },
  upsellSub: { fontSize: 12, color: COLORS.TEXT_SECONDARY, marginTop: 1 },

  histRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  histIcon: { width: 30, height: 30, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  histIconIn: { backgroundColor: COLORS.LIKE_BG },
  histIconOut: { backgroundColor: COLORS.BG },
  histTitle: { fontSize: 13.5, fontWeight: '700', color: COLORS.TEXT },
  histDate: { fontSize: 11.5, color: COLORS.TEXT_MUTED, marginTop: 1 },
  histDelta: { fontSize: 15, fontWeight: '800', color: COLORS.TEXT_MUTED },

  emptyCard: {
    backgroundColor: COLORS.SURFACE, borderRadius: 20, padding: 24, alignItems: 'center',
  },
  emptyText: { fontSize: 13, color: COLORS.TEXT_MUTED },
});
