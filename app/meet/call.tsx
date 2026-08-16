import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, StatusBar, ScrollView,
  ActivityIndicator, Alert, Animated, Easing, AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import {
  callTransportAvailable, createCallSession, type CallSession,
} from '@/lib/call-transport';
import {
  joinCallQueue, leaveCallQueue, runCallMatcher, fetchQueueSize,
  fetchMyActiveCallId, fetchCallState, fetchCallCredentials,
  markCallStarted, markCallEnded, submitCallOutcome,
  expireStaleCalls, secondsRemaining, formatRemaining,
  type CallState,
} from '@/lib/calls-supabase';

type Phase = 'intro' | 'waiting' | 'connecting' | 'live' | 'outcome' | 'done';

const POLL_MS = 4000;

/**
 * Call dates.
 *
 * One screen, five states, because the whole point is that it feels like one
 * continuous thing: you press a button, you wait, you talk, you say whether
 * you'd like to meet. Anything that navigates away mid-flow gives someone a
 * chance to lose the call.
 *
 * The countdown is read from calls.expires_at rather than counted locally, so
 * both phones show the same number and it agrees with the instant Daily
 * actually ends the room.
 */
export default function CallScreen() {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('intro');
  const [queueSize, setQueueSize] = useState(0);
  const [call, setCall] = useState<CallState | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const [partnerHere, setPartnerHere] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outcomeDateId, setOutcomeDateId] = useState<string | null>(null);
  const [myAnswer, setMyAnswer] = useState<boolean | null>(null);

  const session = useRef<CallSession | null>(null);
  // Held in a ref as well as state so the unmount cleanup, which captures the
  // first render, can still close out the right call.
  const liveCallId = useRef<string | null>(null);
  // leave() fires the left-meeting event, so finishing would otherwise
  // re-enter itself once through the handler.
  const ending = useRef(false);
  const phaseRef = useRef<Phase>('intro');
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  /* ─── resume anything already in flight ─── */
  useEffect(() => {
    (async () => {
      await expireStaleCalls();
      setQueueSize(await fetchQueueSize().catch(() => 0));
      const active = await fetchMyActiveCallId();
      if (active) {
        const state = await fetchCallState(active).catch(() => null);
        if (state) { setCall(state); connect(state); }
      }
    })();
    // Leaving the screen must not leave a room open or a queue row waiting
    return () => { teardown(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── waiting: poll for a partner ─── */
  useEffect(() => {
    if (phase !== 'waiting') return;
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      // Every poll is also a match attempt. With no scheduler, presence is the
      // only thing that can pair people.
      const matchedId = await runCallMatcher();
      const id = matchedId ?? (await fetchMyActiveCallId());
      if (cancelled) return;

      if (id) {
        const state = await fetchCallState(id).catch(() => null);
        if (state && !cancelled) { setCall(state); connect(state); return; }
      }
      setQueueSize(await fetchQueueSize().catch(() => 0));
    };

    const t = setInterval(tick, POLL_MS);
    tick();
    return () => { cancelled = true; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  /* ─── live: the shared countdown ─── */
  useEffect(() => {
    if (phase !== 'live' || !call?.expiresAt) return;
    const t = setInterval(() => {
      const left = secondsRemaining(call.expiresAt);
      setRemaining(left);
      // Daily ejects on its own at zero; this is just so the UI does not sit
      // on 0:00 waiting for the event to arrive.
      if (left <= 0) endCall();
    }, 1000);
    setRemaining(secondsRemaining(call.expiresAt));
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, call?.expiresAt]);

  /* ─── connect ─── */
  const connect = useCallback(async (state: CallState) => {
    if (!callTransportAvailable) return;
    ending.current = false;
    liveCallId.current = state.id;
    setPhase('connecting');
    try {
      const creds = await fetchCallCredentials(state.id);
      const s = await createCallSession(creds.medium);
      session.current = s;

      s.on('joined', () => {
        setPhase('live');
        markCallStarted(state.id);
      });
      s.on('participant-joined', () => setPartnerHere(true));
      s.on('participant-left', () => setPartnerHere(false));
      // Fires on leave() and on Daily's own ejection at the deadline
      s.on('left', () => finishCall(state.id));
      s.on('error', (e: any) => {
        Alert.alert('Call dropped', e?.errorMsg || 'The connection failed.');
        finishCall(state.id);
      });

      await s.join({
        roomUrl: creds.roomUrl,
        token: creds.token,
        video: creds.medium === 'video',
      });
    } catch (e: any) {
      Alert.alert('Could not connect', e?.message || 'Please try again.');
      await markCallEnded(state.id);
      liveCallId.current = null;
      setPhase('intro');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── leaving ─── */
  const finishCall = useCallback(async (callId: string) => {
    if (ending.current) return;
    ending.current = true;
    liveCallId.current = null;
    await markCallEnded(callId);
    const s = session.current;
    session.current = null;
    if (s) { await s.leave(); await s.destroy(); }
    setPhase('outcome');
  }, []);

  const endCall = useCallback(() => {
    if (!call) return;
    finishCall(call.id);
  }, [call, finishCall]);

  const teardown = useCallback(() => {
    const s = session.current;
    session.current = null;
    if (s) { s.leave().then(() => s.destroy()).catch(() => {}); }
    // Navigating away ends the call for both people rather than leaving a
    // room open that only expire_stale_calls would ever close.
    if (liveCallId.current) markCallEnded(liveCallId.current).catch(() => {});
    liveCallId.current = null;
    leaveCallQueue().catch(() => {});
  }, []);

  /* ─── background: a call keeps running, a queue place does not ─── */
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background' && phaseRef.current === 'waiting') {
        leaveCallQueue().catch(() => {});
        setPhase('intro');
      }
    });
    return () => sub.remove();
  }, []);

  /* ─── actions ─── */
  const join = async () => {
    if (!callTransportAvailable) return;
    setBusy(true);
    try {
      const { callId } = await joinCallQueue('audio');
      if (callId) {
        const state = await fetchCallState(callId);
        if (state) { setCall(state); await connect(state); return; }
      }
      setPhase('waiting');
    } catch (e: any) {
      Alert.alert('Could not join', e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const cancelWaiting = async () => {
    await leaveCallQueue();
    setPhase('intro');
  };

  const answer = async (wants: boolean) => {
    if (!call) return;
    setBusy(true);
    try {
      const dateId = await submitCallOutcome(call.id, wants);
      setMyAnswer(wants);
      setOutcomeDateId(dateId);
      setPhase('done');
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const toggleMute = () => {
    const s = session.current;
    if (!s) return;
    const next = !muted;
    s.setMuted(next);
    setMuted(next);
  };

  const toggleSpeaker = async () => {
    const s = session.current;
    if (!s) return;
    const next = !speaker;
    await s.setSpeakerOn(next);
    setSpeaker(next);
  };

  /* ─── render ─── */

  const showHeader = phase !== 'live';

  return (
    <SafeAreaView style={[s.container, phase === 'live' && s.containerLive]} edges={['top']}>
      <StatusBar barStyle={phase === 'live' ? 'light-content' : 'dark-content'} />

      {showHeader && (
        <View style={s.header}>
          <TouchableOpacity
            onPress={() => {
              if (phase === 'waiting') { cancelWaiting(); return; }
              router.canGoBack() ? router.back() : router.replace('/(tabs)/discover');
            }}
            style={s.backBtn}
          >
            <Ionicons name="chevron-back" size={26} color={COLORS.TEXT} />
          </TouchableOpacity>
          <Text style={s.title}>Call first</Text>
          <View style={{ width: 40 }} />
        </View>
      )}

      {phase === 'intro' && (
        <Intro
          available={callTransportAvailable}
          queueSize={queueSize}
          busy={busy}
          onJoin={join}
          onBlind={() => router.replace('/meet/blind')}
        />
      )}

      {phase === 'waiting' && <Waiting queueSize={queueSize} onCancel={cancelWaiting} />}

      {phase === 'connecting' && (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={COLORS.BRAND} />
          <Text style={s.connectingText}>Connecting you…</Text>
        </View>
      )}

      {phase === 'live' && call && (
        <Live
          name={call.otherName}
          partnerHere={partnerHere}
          remaining={remaining}
          muted={muted}
          speaker={speaker}
          onMute={toggleMute}
          onSpeaker={toggleSpeaker}
          onEnd={endCall}
        />
      )}

      {phase === 'outcome' && call && (
        <Outcome name={call.otherName} busy={busy} onAnswer={answer} />
      )}

      {phase === 'done' && (
        <Done
          name={call?.otherName ?? 'them'}
          saidYes={myAnswer === true}
          dateId={outcomeDateId}
          onDates={() => router.replace('/(tabs)/dates')}
          onAgain={() => { setCall(null); setPartnerHere(false); setPhase('intro'); }}
        />
      )}
    </SafeAreaView>
  );
}

/* ─── states ─── */

function Intro({ available, queueSize, busy, onJoin, onBlind }: {
  available: boolean; queueSize: number; busy: boolean;
  onJoin: () => void; onBlind: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={s.body}>
      <View style={s.hero}>
        <Text style={s.emoji}>🎙️</Text>
        <Text style={s.heroTitle}>{available ? 'Ready when you are' : 'Almost here'}</Text>
        <Text style={s.heroSub}>
          {available
            ? 'Seven minutes with someone compatible. No profiles, no photos — just a conversation.'
            : 'Live calls need a new version of the app — they can\'t be switched on remotely. Everything else is already built and waiting.'}
        </Text>
      </View>

      <View style={s.steps}>
        <Step n={1} text="We match you with someone compatible" />
        <Step n={2} text="Seven minutes — the timer is the same on both phones" />
        <Step n={3} text="You each privately say if you'd like to meet" />
        <Step n={4} text="If you both say yes, we plan the date" />
      </View>

      <View style={s.privacyCard}>
        <Ionicons name="lock-closed-outline" size={16} color={COLORS.BRAND} />
        <Text style={s.privacyText}>
          Your answer stays private. If they don't feel the same, they never
          find out you said yes.
        </Text>
      </View>

      {available ? (
        <>
          <TouchableOpacity
            style={[s.primaryBtn, busy && { opacity: 0.7 }]}
            activeOpacity={0.88}
            onPress={onJoin}
            disabled={busy}
          >
            {busy ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="call" size={18} color="#fff" />
                <Text style={s.primaryText}>Join the queue</Text>
              </>
            )}
          </TouchableOpacity>
          {queueSize > 0 && (
            <Text style={s.queueHint}>
              {queueSize === 1 ? '1 person is waiting right now' : `${queueSize} people are waiting right now`}
            </Text>
          )}
        </>
      ) : (
        <View style={s.soonCard}>
          <Text style={s.soonText}>Coming in the next app update</Text>
        </View>
      )}

      <TouchableOpacity style={s.altBtn} onPress={onBlind}>
        <Text style={s.altText}>Try a blind date instead</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Waiting({ queueSize, onCancel }: { queueSize: number; onCancel: () => void }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });

  return (
    <View style={s.centered}>
      <View style={s.pulseWrap}>
        <Animated.View style={[s.pulseRing, { transform: [{ scale }], opacity }]} />
        <View style={s.pulseCore}><Ionicons name="call" size={30} color="#fff" /></View>
      </View>
      <Text style={s.waitTitle}>Looking for someone</Text>
      <Text style={s.waitSub}>
        {queueSize > 1
          ? `${queueSize} people in the queue — hang tight.`
          : 'This can take a few minutes. We\'ll connect you the moment someone compatible joins.'}
      </Text>
      <TouchableOpacity style={s.cancelBtn} onPress={onCancel}>
        <Text style={s.cancelText}>Leave the queue</Text>
      </TouchableOpacity>
    </View>
  );
}

function Live({ name, partnerHere, remaining, muted, speaker, onMute, onSpeaker, onEnd }: {
  name: string; partnerHere: boolean; remaining: number;
  muted: boolean; speaker: boolean;
  onMute: () => void; onSpeaker: () => void; onEnd: () => void;
}) {
  const lowTime = remaining <= 60;

  return (
    <View style={s.live}>
      <View style={s.liveTop}>
        <Text style={s.liveName}>{name}</Text>
        <Text style={s.liveStatus}>
          {partnerHere ? 'Connected' : 'Waiting for them to join…'}
        </Text>
        <Text style={[s.liveTimer, lowTime && { color: COLORS.BRAND_LIGHT }]}>
          {formatRemaining(remaining)}
        </Text>
        {lowTime && <Text style={s.liveWarn}>Wrapping up soon</Text>}
      </View>

      <View style={s.liveControls}>
        <ControlBtn icon={muted ? 'mic-off' : 'mic'} label={muted ? 'Unmute' : 'Mute'} on={muted} onPress={onMute} />
        <TouchableOpacity style={s.endBtn} onPress={onEnd} activeOpacity={0.85}>
          <Ionicons name="call" size={26} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
        </TouchableOpacity>
        <ControlBtn icon="volume-high" label="Speaker" on={speaker} onPress={onSpeaker} />
      </View>
    </View>
  );
}

function Outcome({ name, busy, onAnswer }: {
  name: string; busy: boolean; onAnswer: (wants: boolean) => void;
}) {
  return (
    <ScrollView contentContainerStyle={s.body}>
      <View style={s.hero}>
        <Text style={s.emoji}>💭</Text>
        <Text style={s.heroTitle}>How was it?</Text>
        <Text style={s.heroSub}>
          Would you like to meet {name} in person? Only you will ever see this
          answer.
        </Text>
      </View>

      <TouchableOpacity
        style={[s.primaryBtn, busy && { opacity: 0.7 }]}
        onPress={() => onAnswer(true)}
        disabled={busy}
        activeOpacity={0.88}
      >
        <Ionicons name="heart" size={18} color="#fff" />
        <Text style={s.primaryText}>Yes, I'd like to meet</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[s.secondaryBtn, busy && { opacity: 0.7 }]}
        onPress={() => onAnswer(false)}
        disabled={busy}
        activeOpacity={0.88}
      >
        <Text style={s.secondaryText}>Not this time</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Done({ name, saidYes, dateId, onDates, onAgain }: {
  name: string; saidYes: boolean; dateId: string | null;
  onDates: () => void; onAgain: () => void;
}) {
  const matched = saidYes && !!dateId;

  return (
    <ScrollView contentContainerStyle={s.body}>
      <View style={s.hero}>
        <Text style={s.emoji}>{matched ? '🎉' : saidYes ? '🤞' : '👋'}</Text>
        <Text style={s.heroTitle}>
          {matched ? 'You both said yes' : saidYes ? 'Noted' : 'All done'}
        </Text>
        <Text style={s.heroSub}>
          {matched
            ? `We're planning a date for you and ${name}. It'll appear in your Dates tab once we've picked the spot.`
            : saidYes
              ? 'If they feel the same, a date will appear in your Dates tab. Either way, you\'ll never be told who said no.'
              : 'Thanks for being honest — nobody is told either way.'}
        </Text>
      </View>

      {matched ? (
        <TouchableOpacity style={s.primaryBtn} onPress={onDates} activeOpacity={0.88}>
          <Text style={s.primaryText}>See my dates</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={s.primaryBtn} onPress={onAgain} activeOpacity={0.88}>
          <Ionicons name="call" size={18} color="#fff" />
          <Text style={s.primaryText}>Another call</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

function ControlBtn({ icon, label, on, onPress }: {
  icon: any; label: string; on: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={s.controlWrap} onPress={onPress} activeOpacity={0.8}>
      <View style={[s.controlBtn, on && s.controlOn]}>
        <Ionicons name={icon} size={22} color={on ? COLORS.PLUM : '#fff'} />
      </View>
      <Text style={s.controlLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <View style={s.stepRow}>
      <View style={s.stepNum}><Text style={s.stepNumText}>{n}</Text></View>
      <Text style={s.stepText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },
  containerLive: { backgroundColor: COLORS.PLUM },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 12,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: COLORS.TEXT },

  body: { padding: 24, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 },
  connectingText: { fontSize: 15, fontWeight: '700', color: COLORS.TEXT_SECONDARY, marginTop: 6 },

  hero: { alignItems: 'center', gap: 10, marginBottom: 28 },
  emoji: { fontSize: 52 },
  heroTitle: { fontSize: 24, fontWeight: '900', color: COLORS.TEXT, letterSpacing: -0.5, textAlign: 'center' },
  heroSub: { fontSize: 14, color: COLORS.TEXT_SECONDARY, textAlign: 'center', lineHeight: 21 },

  steps: { gap: 14, marginBottom: 22 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepNum: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.BRAND,
    justifyContent: 'center', alignItems: 'center',
  },
  stepNumText: { fontSize: 13, fontWeight: '900', color: '#fff' },
  stepText: { flex: 1, fontSize: 14, color: COLORS.TEXT, lineHeight: 19 },

  privacyCard: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: COLORS.BRAND_MUTED, borderRadius: 16, padding: 14, marginBottom: 24,
  },
  privacyText: { flex: 1, fontSize: 12, color: COLORS.TEXT_SECONDARY, lineHeight: 17 },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.BRAND, borderRadius: 16, paddingVertical: 16,
  },
  primaryText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  secondaryBtn: {
    borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 12,
    backgroundColor: COLORS.SURFACE, borderWidth: 1.5, borderColor: COLORS.BORDER,
  },
  secondaryText: { fontSize: 15, fontWeight: '800', color: COLORS.TEXT_SECONDARY },
  queueHint: { textAlign: 'center', fontSize: 12, color: COLORS.TEXT_MUTED, marginTop: 12, fontWeight: '600' },

  soonCard: {
    backgroundColor: COLORS.GOLD_MUTED, borderRadius: 16, paddingVertical: 16, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.GOLD_LIGHT,
  },
  soonText: { fontSize: 14, fontWeight: '800', color: COLORS.GOLD_DEEP },

  altBtn: { paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  altText: { fontSize: 14, fontWeight: '700', color: COLORS.BRAND },

  // waiting
  pulseWrap: { width: 120, height: 120, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  pulseRing: { position: 'absolute', width: 76, height: 76, borderRadius: 38, backgroundColor: COLORS.BRAND },
  pulseCore: {
    width: 76, height: 76, borderRadius: 38, backgroundColor: COLORS.BRAND,
    justifyContent: 'center', alignItems: 'center',
  },
  waitTitle: { fontSize: 21, fontWeight: '900', color: COLORS.TEXT },
  waitSub: { fontSize: 14, color: COLORS.TEXT_SECONDARY, textAlign: 'center', lineHeight: 20, paddingHorizontal: 12 },
  cancelBtn: { paddingVertical: 14, paddingHorizontal: 24, marginTop: 12 },
  cancelText: { fontSize: 14, fontWeight: '700', color: COLORS.TEXT_MUTED },

  // live
  live: { flex: 1, justifyContent: 'space-between', paddingVertical: 60, paddingHorizontal: 28 },
  liveTop: { alignItems: 'center', gap: 6, marginTop: 40 },
  liveName: { fontSize: 30, fontWeight: '900', color: '#fff', letterSpacing: -0.6 },
  liveStatus: { fontSize: 13, color: 'rgba(255,255,255,0.65)', fontWeight: '600' },
  liveTimer: {
    fontSize: 56, fontWeight: '200', color: '#fff', marginTop: 26,
    fontVariant: ['tabular-nums'], letterSpacing: 1,
  },
  liveWarn: { fontSize: 12, color: COLORS.BRAND_GLOW, fontWeight: '700', letterSpacing: 0.4 },

  liveControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  controlWrap: { alignItems: 'center', gap: 8 },
  controlBtn: {
    width: 58, height: 58, borderRadius: 29, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  controlOn: { backgroundColor: '#fff' },
  controlLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '700' },
  endBtn: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.BRAND,
    justifyContent: 'center', alignItems: 'center',
  },
});
