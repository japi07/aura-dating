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

  const [refreshing, setRefreshing] = useState(false);
  const [blind, setBlind] = useState<BlindSignup | null>(null);
  const [pool, setPool] = useState<{ bucket: string; enough: boolean } | null>(null);
  const [callQueue, setCallQueue] = useState(0);
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
    (async () => { await load(); setLoading(false); })();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshFromServer(), load()]);
    setRefreshing(false);
  }, [load, refreshFromServer]);

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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <Text style={styles.title}>Meet</Text>
        <Text style={styles.sub}>Three ways to meet someone. Pick what suits you tonight.</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.BRAND} />
        }
      >
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
                  : callQueue > 0
                    ? `${callQueue} waiting right now`
                    : 'Tap to join the queue'
              }
              statusTone={callTransportAvailable ? 'ready' : 'soon'}
              disabled={!callTransportAvailable}
              onPress={() => router.push('/meet/call')}
            />

            {/* ── Mode B — Blind date ── */}
            <ModeCard
              emoji="🎭"
              title="Blind date"
              tagline="Tell us when you're free. We find someone and plan the whole thing."
              status={
                blind?.status === 'waiting'
                  ? 'You\'re in the pool — we\'re looking'
                  : blind?.status === 'matched'
                    ? 'Matched — see your Dates tab'
                    : pool?.enough
                      ? `${pool.bucket} people waiting`
                      : 'Be one of the first to join'
              }
              statusTone={blind?.status === 'waiting' ? 'active' : 'ready'}
              onPress={() => router.push('/meet/blind')}
            />

            {/* ── Mode C — Curated proposal ── */}
            <ModeCard
              emoji="💌"
              title={isSender ? 'Ask someone out' : 'Proposals for you'}
              tagline={
                isSender
                  ? 'Choose someone, plan a real date, record a video introduction.'
                  : 'Invitations arrive on your Today tab. You choose which to accept.'
              }
              status={
                isSender
                  ? pendingOutbound > 0
                    ? `${pendingOutbound} awaiting a reply`
                    : `${people.length} ${people.length === 1 ? 'person' : 'people'} to choose from`
                  : pendingInbound > 0
                    ? `${pendingInbound} waiting for you`
                    : 'Nothing pending right now'
              }
              statusTone={pendingInbound > 0 || pendingOutbound > 0 ? 'active' : 'ready'}
              onPress={() =>
                isSender ? router.push('/meet/browse') : router.push('/(tabs)')
              }
            />

            <Text style={styles.foot}>
              However you meet, we plan the date itself — venue, time, the lot.
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
