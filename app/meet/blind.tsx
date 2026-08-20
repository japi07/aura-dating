import React, { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, StatusBar, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import { WindowClosedNotice, useDailyWindow } from '@/components/WindowCountdown';
import { useTokensStore } from '@/store/tokens';
import {
  fetchMyBlindSignup, fetchPoolSize, joinBlindPool, leaveBlindPool,
  type BlindSignup,
} from '@/lib/blind-supabase';

/**
 * Blind dates.
 *
 * One button. The previous version asked for areas, budget, a date range,
 * time bands, styles and dietary needs before you could join — a lot of form
 * for a mode whose entire pitch is that you don't have to decide anything.
 * Worse, every extra axis was a way for two people to fail to overlap, which
 * in a small pool is most of them.
 *
 * What you're actually agreeing to is stated plainly instead, because that
 * part does matter: a real evening, a real stranger, and you turn up.
 */
export default function BlindScreen() {
  const router = useRouter();
  const w = useDailyWindow();
  const { hasEntry, markUsed, giveBack } = useTokensStore();

  const [signup, setSignup] = useState<BlindSignup | null>(null);
  const [pool, setPool] = useState<{ bucket: string; enough: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [mine, size] = await Promise.all([fetchMyBlindSignup(), fetchPoolSize()]);
      setSignup(mine);
      setPool(size);
    } catch {
      // offline — the idle state is still correct
    }
  }, []);

  useEffect(() => { (async () => { await load(); setLoading(false); })(); }, [load]);

  const join = async () => {
    setBusy(true);
    try {
      setSignup(await joinBlindPool());
      // The token went at the payment screen; this marks the ticket spent
      // so backing out later cannot claim it back.
      await markUsed('blind');
      await load();
    } catch (e: any) {
      Alert.alert('Could not join', e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    if (!signup) return;
    Alert.alert(
      'Leave the pool?',
      'Your token comes back, and you can join again any time.',
      [
        { text: 'Stay in', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await leaveBlindPool(signup.id);
              await giveBack('blind');
              setSignup(null);
              await load();
            }
            catch (e: any) { Alert.alert('Could not leave', e?.message || 'Please try again.'); }
            finally { setBusy(false); }
          },
        },
      ],
    );
  };

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
        <Text style={s.title}>Blind date</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={s.centered}><ActivityIndicator color={COLORS.BRAND} /></View>
      ) : signup?.status === 'matched' ? (
        <Matched onDates={() => router.replace('/(tabs)/connections')} />
      ) : signup?.status === 'waiting' ? (
        <Waiting pool={pool} busy={busy} onLeave={leave} />
      ) : (
        <Idle
          pool={pool}
          busy={busy}
          windowOpen={w.open}
          paid={hasEntry('blind')}
          secondsUntilOpen={w.secondsUntilOpen}
          onJoin={join}
          onPay={() => router.push('/pay/blind')}
        />
      )}
    </SafeAreaView>
  );
}

function Idle({ pool, busy, windowOpen, paid, secondsUntilOpen, onJoin, onPay }: {
  pool: { bucket: string; enough: boolean } | null;
  busy: boolean; windowOpen: boolean; paid: boolean; secondsUntilOpen: number;
  onJoin: () => void; onPay: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={s.body}>
      <View style={s.hero}>
        <Text style={s.emoji}>🎭</Text>
        <Text style={s.heroTitle}>Leave it to us</Text>
        <Text style={s.heroSub}>
          No profile to read, no photos to judge, nothing to choose. We pair you
          with someone, pick the place, and book the table.
        </Text>
      </View>

      <View style={s.promiseCard}>
        <Assurance icon="eye-off-outline" text="You won't see who it is until you're there" />
        <Assurance icon="restaurant-outline" text="We choose the venue and the time" />
        <Assurance icon="shield-checkmark-outline" text="Everyone is ID-verified before they can join" />
        <Assurance icon="calendar-outline" text="You'll get the details in your Dates tab" />
      </View>

      {pool?.enough && (
        <Text style={s.poolLine}>{pool.bucket} people are in the pool right now</Text>
      )}

      {!paid ? (
        <TouchableOpacity style={s.primaryBtn} onPress={onPay} activeOpacity={0.88}>
          <Ionicons name="diamond" size={17} color="#fff" />
          <Text style={s.primaryText}>See tonight's price</Text>
        </TouchableOpacity>
      ) : windowOpen ? (
        <TouchableOpacity
          style={[s.primaryBtn, busy && { opacity: 0.7 }]}
          onPress={onJoin}
          disabled={busy}
          activeOpacity={0.88}
        >
          {busy ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="sparkles" size={18} color="#fff" />
              <Text style={s.primaryText}>Join tonight's pool</Text>
            </>
          )}
        </TouchableOpacity>
      ) : (
        <>
          <View style={s.queuedNotice}>
            <Ionicons name="checkmark-circle" size={17} color={COLORS.LIKE} />
            <Text style={s.queuedText}>Your place is booked for tonight</Text>
          </View>
          <WindowClosedNotice secondsUntilOpen={secondsUntilOpen} />
        </>
      )}

      <Text style={s.smallPrint}>
        Joining means you're genuinely willing to go. You can leave the pool any
        time before we match you.
      </Text>
    </ScrollView>
  );
}

function Waiting({ pool, busy, onLeave }: {
  pool: { bucket: string; enough: boolean } | null; busy: boolean; onLeave: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={s.body}>
      <View style={s.hero}>
        <Text style={s.emoji}>🔎</Text>
        <Text style={s.heroTitle}>You're in</Text>
        <Text style={s.heroSub}>
          We're looking for the right person. When we find them, we'll plan the
          whole evening and it'll appear in your Dates tab.
        </Text>
      </View>

      <View style={s.statusCard}>
        <View style={s.liveDot} />
        <Text style={s.statusText}>
          {pool?.enough
            ? `In the pool with ${pool.bucket} others`
            : 'In the pool — we\'ll be in touch'}
        </Text>
      </View>

      <Text style={s.smallPrint}>
        Matching runs during each evening window. Most people wait a night or
        two, sometimes a little longer while the pool builds.
      </Text>

      <TouchableOpacity style={s.leaveBtn} onPress={onLeave} disabled={busy}>
        <Text style={s.leaveText}>Leave the pool</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Matched({ onDates }: { onDates: () => void }) {
  return (
    <ScrollView contentContainerStyle={s.body}>
      <View style={s.hero}>
        <Text style={s.emoji}>🎉</Text>
        <Text style={s.heroTitle}>We found someone</Text>
        <Text style={s.heroSub}>
          We're picking the venue and the time now. The details land in your
          Dates tab as soon as it's booked.
        </Text>
      </View>

      <TouchableOpacity style={s.primaryBtn} onPress={onDates} activeOpacity={0.88}>
        <Text style={s.primaryText}>See my dates</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Assurance({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={s.promiseRow}>
      <View style={s.promiseIcon}>
        <Ionicons name={icon} size={15} color={COLORS.BRAND} />
      </View>
      <Text style={s.promiseText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 12,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: COLORS.TEXT },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  body: { padding: 24, paddingBottom: 44 },
  hero: { alignItems: 'center', gap: 10, marginBottom: 26 },
  emoji: { fontSize: 54 },
  heroTitle: { fontSize: 26, fontWeight: '900', color: COLORS.TEXT, letterSpacing: -0.6 },
  heroSub: { fontSize: 14, color: COLORS.TEXT_SECONDARY, textAlign: 'center', lineHeight: 21 },

  promiseCard: {
    backgroundColor: COLORS.SURFACE, borderRadius: 20, padding: 18, gap: 15, marginBottom: 20,
    shadowColor: '#1A0F26', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06,
    shadowRadius: 12, elevation: 3,
  },
  promiseRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  promiseIcon: {
    width: 30, height: 30, borderRadius: 10, backgroundColor: COLORS.BRAND_MUTED,
    justifyContent: 'center', alignItems: 'center',
  },
  promiseText: { flex: 1, fontSize: 13.5, color: COLORS.TEXT, lineHeight: 19 },

  poolLine: {
    textAlign: 'center', fontSize: 12, color: COLORS.TEXT_MUTED,
    fontWeight: '700', marginBottom: 16,
  },

  queuedNotice: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.LIKE_BG, borderRadius: 16, paddingVertical: 14, marginBottom: 10,
  },
  queuedText: { fontSize: 13.5, fontWeight: '800', color: COLORS.LIKE },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.BRAND, borderRadius: 16, paddingVertical: 17,
  },
  primaryText: { fontSize: 15.5, fontWeight: '800', color: '#fff' },

  statusCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    backgroundColor: COLORS.LIKE_BG, borderRadius: 16, paddingVertical: 15, marginBottom: 18,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.LIKE },
  statusText: { fontSize: 13.5, fontWeight: '800', color: COLORS.LIKE },

  smallPrint: {
    fontSize: 12, color: COLORS.TEXT_MUTED, textAlign: 'center',
    lineHeight: 18, marginTop: 16, paddingHorizontal: 8,
  },

  leaveBtn: { paddingVertical: 16, alignItems: 'center', marginTop: 10 },
  leaveText: { fontSize: 14, fontWeight: '700', color: COLORS.TEXT_MUTED },
});
