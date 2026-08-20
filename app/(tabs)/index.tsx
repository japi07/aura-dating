import React, { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  StatusBar, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import { useAuthStore } from '@/store/auth';
import { useUsersStore } from '@/store/users';
import { useProposalsStore } from '@/store/proposals';
import { canSendProposals } from '@/lib/roles';
import { fetchMyBlindSignup, fetchPoolSize, type BlindSignup } from '@/lib/blind-supabase';
import { callTransportAvailable } from '@/lib/call-transport';
import { fetchQueueSize } from '@/lib/calls-supabase';
import { WindowCountdown, useDailyWindow } from '@/components/WindowCountdown';
import { formatShort, WINDOW_LABEL } from '@/lib/daily-window';
import { useTokensStore } from '@/store/tokens';

/**
 * "Meet" — the hub where you choose how you want to meet someone.
 *
 * This replaces the old Discover tab rather than adding a sixth tab: the tab
 * bar is already five items at 11pt labels, and Discover's implicit question
 * was always "how do I meet someone" — it just had exactly one answer. Its
 * member-browsing body now lives at /meet/browse as step 1 of proposals.
 */
export default function MeetScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { candidatesFor, hydrate, isHydrated, refreshFromServer } = useUsersStore();
  const proposals = useProposalsStore((s) => s.proposals);
  const decisions = useProposalsStore((s) => s.decisions);
  // Meet is the launch screen now that Today is gone, so it owns loading the
  // proposals store. Without this the inbox count reads zero on a cold start
  // and a woman with a proposal waiting is told there is nothing pending.
  const hydrateProposals = useProposalsStore((s) => s.hydrate);
  const refreshProposals = useProposalsStore((s) => s.refreshProposals);
  const proposalsHydrated = useProposalsStore((s) => s.isHydrated);

  const [refreshing, setRefreshing] = useState(false);
  const [blind, setBlind] = useState<BlindSignup | null>(null);
  const [pool, setPool] = useState<{ bucket: string; enough: boolean } | null>(null);
  const [callQueue, setCallQueue] = useState(0);
  const w = useDailyWindow();
  const {
    balance, prices, hasEntry, isHydrated: tokensReady,
    hydrate: hydrateTokens, refresh: refreshTokens,
  } = useTokensStore();
  const [loading, setLoading] = useState(true);

  const isSender = canSendProposals(user);
  const myEmail = (user?.email || '').toLowerCase().trim();

  const load = useCallback(async () => {
    try {
      const [signup, size, queued] = await Promise.all([
        fetchMyBlindSignup(),
        fetchPoolSize(),
        callTransportAvailable ? fetchQueueSize() : Promise.resolve(0),
      ]);
      setBlind(signup);
      setPool(size);
      setCallQueue(queued);
    } catch {
      // offline — cards fall back to their idle copy
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) hydrate(); else refreshFromServer();
    if (!proposalsHydrated) hydrateProposals(); else refreshProposals();
    if (!tokensReady) hydrateTokens(); else refreshTokens();
    (async () => { await load(); setLoading(false); })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshFromServer(), refreshProposals(), refreshTokens(), load()]);
    setRefreshing(false);
  }, [load, refreshFromServer, refreshProposals, refreshTokens]);

  const people = myEmail
    ? candidatesFor(myEmail, { genderInterest: user?.genderInterest, myGender: user?.gender })
    : [];

  // Cross-mode status, so someone participating in several at once can see it
  const pendingInbound = proposals.filter(
    (p) => p?.recipientEmail?.toLowerCase?.() === myEmail && !decisions[p.id],
  ).length;
  const pendingOutbound = proposals.filter(
    (p) => p?.from?.email?.toLowerCase?.() === myEmail && !decisions[p.id],
  ).length;

  // Choosing a mode goes through the payment screen; once tonight is paid
  // for, the card is a straight way back in rather than a second charge.
  const choose = (mode: 'call' | 'blind' | 'proposal', destination: string) => {
    if (hasEntry(mode)) router.push(destination as any);
    else router.push(`/pay/${mode}` as any);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Meet</Text>
          <TouchableOpacity
            style={styles.wallet}
            onPress={() => router.push('/wallet')}
            activeOpacity={0.85}
          >
            <Ionicons name="diamond" size={13} color={COLORS.GOLD_DEEP} />
            <Text style={styles.walletText}>{balance}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.sub}>
          {w.open
            ? 'Three ways to meet someone. Choose one before the window closes.'
            : 'Three ways to meet someone. Everything opens together at ' + WINDOW_LABEL + '.'}
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.BRAND} />
        }
      >
        <WindowCountdown variant="hero" />

        {loading ? (
          <View style={{ paddingTop: 40 }}><ActivityIndicator color={COLORS.BRAND} /></View>
        ) : (
          <>
            {/* ── Mode A — Call ── */}
            <ModeCard
              emoji="🎙️"
              title="Call first"
              tagline="A short live call before you commit to a whole evening."
              status={
                !callTransportAvailable
                  ? 'Arrives in the next app update'
                  : hasEntry('call')
                    ? 'Queued for tonight ✓'
                  : !w.open
                    ? `Opens at ${WINDOW_LABEL} · ${formatShort(w.secondsUntilOpen)}`
                    : callQueue > 0
                      ? `${callQueue} waiting right now`
                      : 'Tap to join the queue'
              }
              statusTone={!callTransportAvailable || !w.open ? 'soon' : 'ready'}
              disabled={!callTransportAvailable}
              onPress={() => choose('call', '/meet/call')}
            />

            {/* ── Mode B — Blind date ── */}
            <ModeCard
              emoji="🎭"
              title="Blind date"
              tagline="One tap. We find someone, pick the place, and book it."
              status={
                hasEntry('blind') && blind?.status !== 'waiting' && blind?.status !== 'matched'
                  ? 'Queued for tonight ✓'
                  : blind?.status === 'waiting'
                  ? 'You\'re in the pool — we\'re looking'
                  : blind?.status === 'matched'
                    ? 'Matched — see your Dates tab'
                    : !w.open
                      ? `Opens at ${WINDOW_LABEL} · ${formatShort(w.secondsUntilOpen)}`
                      : pool?.enough
                        ? `${pool.bucket} people waiting`
                        : 'Be one of the first to join'
              }
              statusTone={
                blind?.status === 'waiting' ? 'active' : !w.open ? 'soon' : 'ready'
              }
              onPress={() => choose('blind', '/meet/blind')}
            />

            {/* ── Mode C — Curated proposal ── */}
            <ModeCard
              emoji="💌"
              title={isSender ? 'Ask someone out' : 'Proposals for you'}
              tagline={
                isSender
                  ? 'Choose someone, plan a real date, record a video introduction.'
                  : 'Invitations arrive here. You choose which to accept.'
              }
              status={
                pendingInbound > 0
                  ? `${pendingInbound} waiting for you`
                  : pendingOutbound > 0
                    ? `${pendingOutbound} awaiting a reply`
                    : isSender && !w.open
                      ? `Opens at ${WINDOW_LABEL} · ${formatShort(w.secondsUntilOpen)}`
                      : isSender
                        ? `${people.length} ${people.length === 1 ? 'person' : 'people'} to choose from`
                        : 'Nothing pending right now'
              }
              statusTone={
                pendingInbound > 0 || pendingOutbound > 0 ? 'active'
                  : isSender && !w.open ? 'soon' : 'ready'
              }
              onPress={() =>
                isSender ? choose('proposal', '/meet/browse') : router.push('/meet/proposals')
              }
            />

            <Text style={styles.foot}>
              However you meet, we plan the date itself — venue, time, the lot.
              {'\n'}Everything opens together each evening, so you are choosing
              alongside everyone else rather than scrolling alone.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ModeCard({
  emoji, title, tagline, status, statusTone, onPress, disabled,
}: {
  emoji: string;
  title: string;
  tagline: string;
  status: string;
  statusTone: 'ready' | 'active' | 'soon';
  onPress: () => void;
  disabled?: boolean;
}) {
  const toneStyle =
    statusTone === 'active' ? styles.statusActive
    : statusTone === 'soon' ? styles.statusSoon
    : styles.statusReady;

  return (
    <TouchableOpacity
      style={[styles.card, disabled && styles.cardDisabled]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <View style={styles.cardTop}>
        <View style={styles.emojiBox}><Text style={styles.emoji}>{emoji}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardTagline}>{tagline}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={COLORS.BORDER} />
      </View>
      <View style={[styles.statusPill, toneStyle]}>
        {statusTone === 'active' && <View style={styles.liveDot} />}
        <Text style={[styles.statusText, statusTone === 'active' && { color: COLORS.LIKE }]}>
          {status}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wallet: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.GOLD_MUTED, borderRadius: 13,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  walletText: { fontSize: 13.5, fontWeight: '800', color: COLORS.GOLD_DEEP },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.TEXT, letterSpacing: -0.5 },
  sub: { fontSize: 13, color: COLORS.TEXT_MUTED, marginTop: 3, lineHeight: 18 },

  list: { paddingHorizontal: 16, paddingBottom: 32, gap: 14 },

  card: {
    backgroundColor: COLORS.SURFACE, borderRadius: 22, padding: 18, gap: 14,
    shadowColor: '#1A0F26', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08,
    shadowRadius: 16, elevation: 5,
  },
  cardDisabled: { opacity: 0.72 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  emojiBox: {
    width: 52, height: 52, borderRadius: 17, backgroundColor: COLORS.BRAND_MUTED,
    justifyContent: 'center', alignItems: 'center',
  },
  emoji: { fontSize: 26 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: COLORS.TEXT, marginBottom: 3 },
  cardTagline: { fontSize: 13, color: COLORS.TEXT_SECONDARY, lineHeight: 18 },

  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, alignSelf: 'flex-start',
  },
  statusReady: { backgroundColor: COLORS.BG },
  statusActive: { backgroundColor: COLORS.LIKE_BG },
  statusSoon: { backgroundColor: COLORS.GOLD_MUTED },
  statusText: { fontSize: 12, fontWeight: '700', color: COLORS.TEXT_SECONDARY },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.LIKE },

  foot: {
    fontSize: 12, color: COLORS.TEXT_MUTED, textAlign: 'center',
    marginTop: 6, paddingHorizontal: 24, lineHeight: 17, fontStyle: 'italic',
  },
});
