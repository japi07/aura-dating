import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity, TextInput, StatusBar,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import { useDatesStore } from '@/store/dates';
import { SafetySheet } from '@/components/SafetySheet';
import { getSessionUserId } from '@/lib/proposals-supabase';
import {
  fetchDateChatState, fetchDateMessages, sendDateMessage, deleteDateMessage,
  chatWindow, type DateChatMessage, type DateChatState,
} from '@/lib/date-chat-supabase';
import { formatDate, formatTime } from '@/lib/format';

const POLL_MS = 4000;

/**
 * The pre-date chat. Opens eight hours before the date, closes three hours
 * after it starts; read-only either side of that. Plain text, so two people
 * can say hello, swap numbers if they want, and find each other on the night.
 */
export default function DateChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const dateId = String(id);
  const router = useRouter();

  const date = useDatesStore((st) => st.dates.find((d) => d.id === dateId));
  const refreshDates = useDatesStore((st) => st.refreshDates);
  const blind = date?.mode === 'blind';
  const otherName = blind ? 'Your date' : (date?.with.name?.split(' ')[0] || 'Your date');

  const meRef = useRef<string | null>(null);
  const [state, setState] = useState<DateChatState | null>(null);
  const [messages, setMessages] = useState<DateChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    try {
      const uid = meRef.current ?? (await getSessionUserId());
      if (!uid) return;
      meRef.current = uid;
      const st = await fetchDateChatState(dateId);
      if (!st) { setMissing(true); return; }
      setState(st);
      setMessages(await fetchDateMessages(dateId, uid));
    } catch {
      // Offline: keep what is on screen and try again on the next tick.
    }
  }, [dateId]);

  useEffect(() => { (async () => { await load(); setLoading(false); })(); }, [load]);

  // Poll while the screen is in front and the app is active. A chat that
  // lives for eleven hours between two people doesn't need a socket.
  useFocusEffect(
    useCallback(() => {
      let active = AppState.currentState === 'active';
      const sub = AppState.addEventListener('change', (s) => {
        active = s === 'active';
        if (active) load();
      });
      const t = setInterval(() => { if (active) load(); }, POLL_MS);
      return () => { clearInterval(t); sub.remove(); };
    }, [load]),
  );

  const count = messages.length;
  useEffect(() => {
    if (count) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }, [count]);

  const win = useMemo(
    () => chatWindow(state?.startsAt ?? date?.startsAt),
    [state?.startsAt, date?.startsAt],
  );
  const open = !!state?.open;
  const notYet = !open && !!win && Date.now() < win.opensAt.getTime();

  const send = async () => {
    const me = meRef.current;
    if (!me || !draft.trim() || sending) return;
    setSending(true);
    try {
      const m = await sendDateMessage(dateId, me, draft);
      setMessages((prev) => [...prev, m]);
      setDraft('');
    } catch (e: any) {
      Alert.alert('Not sent', e?.message || 'Please try again.');
      load();
    } finally {
      setSending(false);
    }
  };

  const removeMine = (m: DateChatMessage) => {
    Alert.alert('Delete this message?', `It disappears for ${blind ? 'your date' : otherName} too.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDateMessage(m.id);
            setMessages((prev) => prev.filter((x) => x.id !== m.id));
          } catch (e: any) {
            Alert.alert('Could not delete', e?.message || 'Please try again.');
          }
        },
      },
    ]);
  };

  const afterSafety = async () => {
    useDatesStore.setState((st: any) => ({ dates: st.dates.filter((d: any) => d.id !== dateId) }));
    await refreshDates().catch(() => {});
    router.canGoBack() ? router.back() : router.replace('/(tabs)/connections');
  };

  const banner = !win
    ? 'The chat opens once your date has a time.'
    : open
      ? `Open until ${formatTime(win.closesAt.toISOString())}. Only share what you're comfortable with.`
      : notYet
        ? `Opens ${formatDate(win.opensAt.toISOString())} at ${formatTime(win.opensAt.toISOString())}, eight hours before your date.`
        : 'This chat has closed.';

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />

      <View style={s.header}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/connections'))}
          style={s.backBtn}
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={26} color={COLORS.TEXT} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={s.title} numberOfLines={1}>{otherName}</Text>
          {!!date?.venue?.name && <Text style={s.subtitle} numberOfLines={1}>{date.venue.name}</Text>}
        </View>
        <TouchableOpacity
          style={s.headerReport}
          onPress={() => setSafetyOpen(true)}
          accessibilityLabel={`Report or block ${blind ? 'your date' : otherName}`}
        >
          <Ionicons name="flag-outline" size={16} color={COLORS.ERROR} />
          <Text style={s.headerReportText}>Report</Text>
        </TouchableOpacity>
      </View>

      <SafetySheet
        target={safetyOpen ? { name: blind ? 'your date' : otherName, dateId } : null}
        onClose={() => setSafetyOpen(false)}
        onDone={afterSafety}
      />

      <View style={[s.banner, open && s.bannerOpen]}>
        <Ionicons
          name={open ? 'chatbubbles-outline' : notYet ? 'time-outline' : 'lock-closed-outline'}
          size={15}
          color={open ? COLORS.LIKE : COLORS.TEXT_MUTED}
        />
        <Text style={[s.bannerText, open && { color: COLORS.LIKE }]}>{banner}</Text>
      </View>

      {loading ? (
        <View style={s.centered}><ActivityIndicator color={COLORS.BRAND} /></View>
      ) : missing ? (
        <View style={s.centered}>
          <Text style={s.empty}>This chat isn't available.</Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={s.list}
            keyboardShouldPersistTaps="handled"
          >
            {messages.length === 0 ? (
              <Text style={s.empty}>
                {open
                  ? `Say hello to ${blind ? 'your date' : otherName}. You can swap numbers here if you'd like.`
                  : 'No messages.'}
              </Text>
            ) : (
              messages.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  activeOpacity={0.9}
                  onLongPress={m.mine ? () => removeMine(m) : undefined}
                  style={[s.bubble, m.mine ? s.bubbleMine : s.bubbleTheirs]}
                  accessibilityHint={m.mine ? 'Long press to delete' : undefined}
                >
                  <Text style={[s.bubbleText, m.mine && { color: '#fff' }]}>{m.body}</Text>
                  <Text style={[s.bubbleTime, m.mine && { color: 'rgba(255,255,255,0.75)' }]}>
                    {formatTime(m.createdAt)}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>

          {open && (
            <View style={s.composer}>
              <TextInput
                style={s.input}
                value={draft}
                onChangeText={setDraft}
                placeholder="Message"
                placeholderTextColor={COLORS.TEXT_MUTED}
                multiline
                maxLength={1000}
              />
              <TouchableOpacity
                style={[s.sendBtn, (!draft.trim() || sending) && { opacity: 0.5 }]}
                onPress={send}
                disabled={!draft.trim() || sending}
                accessibilityLabel="Send"
              >
                {sending ? <ActivityIndicator color="#fff" /> : <Ionicons name="arrow-up" size={20} color="#fff" />}
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 17, fontWeight: '800', color: COLORS.TEXT },
  subtitle: { fontSize: 12, color: COLORS.TEXT_MUTED, marginTop: 1 },
  headerReport: {
    flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 40, paddingHorizontal: 12,
    borderRadius: 20, backgroundColor: COLORS.ERROR_LIGHT,
  },
  headerReportText: { fontSize: 13, fontWeight: '800', color: COLORS.ERROR },

  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 6, paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 13, backgroundColor: COLORS.SURFACE,
    borderWidth: 1, borderColor: COLORS.BORDER_LIGHT,
  },
  bannerOpen: { backgroundColor: COLORS.LIKE_BG, borderColor: COLORS.LIKE_BG },
  bannerText: { flex: 1, fontSize: 12.5, fontWeight: '700', color: COLORS.TEXT_SECONDARY, lineHeight: 17 },

  list: { padding: 16, paddingBottom: 12, gap: 8, flexGrow: 1 },
  empty: { fontSize: 13.5, color: COLORS.TEXT_MUTED, textAlign: 'center', marginTop: 24, lineHeight: 19 },

  bubble: { maxWidth: '80%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: COLORS.BRAND, borderBottomRightRadius: 6 },
  bubbleTheirs: { alignSelf: 'flex-start', backgroundColor: COLORS.SURFACE, borderBottomLeftRadius: 6 },
  bubbleText: { fontSize: 15, color: COLORS.TEXT, lineHeight: 20 },
  bubbleTime: { fontSize: 10.5, color: COLORS.TEXT_MUTED, marginTop: 3, alignSelf: 'flex-end' },

  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8,
    borderTopWidth: 1, borderTopColor: COLORS.BORDER_LIGHT, backgroundColor: COLORS.BG,
  },
  input: {
    flex: 1, minHeight: 42, maxHeight: 120, borderRadius: 21,
    paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11,
    backgroundColor: COLORS.SURFACE, fontSize: 15, color: COLORS.TEXT,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.BRAND,
    justifyContent: 'center', alignItems: 'center',
  },
});
