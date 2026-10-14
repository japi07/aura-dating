import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import { chatPhase, chatWindow, CHAT_OPENS_HOURS_BEFORE } from '@/lib/date-chat-supabase';
import { formatDate, formatTime } from '@/lib/format';

/**
 * The way into a date's chat, from a date card or the date screen.
 *
 * Says when the chat opens until it does, then becomes the button. Nothing at
 * all for a date without a time yet, or one that only exists on this device.
 */
export function DateChatButton({ date, onlyWhenOpen }: {
  date: { id: string; startsAt: string | null; mode: string; with: { name: string } };
  /** Past dates: show the button while the chat is open, nothing otherwise. */
  onlyWhenOpen?: boolean;
}) {
  const router = useRouter();
  const [now, setNow] = useState(Date.now());

  // Re-check once a minute so "opens at 11:30" turns into the button on time.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  if (!date.startsAt || date.id.startsWith('date_')) return null;
  const phase = chatPhase(date.startsAt, now);
  const win = chatWindow(date.startsAt);
  if (phase === 'none' || !win) return null;
  if (onlyWhenOpen && phase !== 'open') return null;

  const name = date.mode === 'blind' ? 'your date' : (date.with.name?.split(' ')[0] || 'your date');
  const go = () => router.push({ pathname: '/chat/[id]', params: { id: date.id } });

  if (phase === 'open') {
    return (
      <TouchableOpacity style={s.open} onPress={go} activeOpacity={0.85}>
        <Ionicons name="chatbubbles" size={16} color="#fff" />
        <Text style={s.openText}>Chat with {name}</Text>
        <Ionicons name="chevron-forward" size={15} color="#fff" />
      </TouchableOpacity>
    );
  }

  const opens = win.opensAt.toISOString();
  const sameDay = new Date(opens).toDateString() === new Date(now).toDateString();
  return (
    <TouchableOpacity style={s.waiting} onPress={go} activeOpacity={0.85}>
      <Ionicons
        name={phase === 'soon' ? 'time-outline' : 'chatbubbles-outline'}
        size={15}
        color={COLORS.TEXT_MUTED}
      />
      <Text style={s.waitingText}>
        {phase === 'soon'
          ? `Chat with ${name} opens ${sameDay ? 'today' : formatDate(opens)} at ${formatTime(opens)}, ${CHAT_OPENS_HOURS_BEFORE} hours before`
          : 'Chat closed · view messages'}
      </Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  open: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.BRAND, borderRadius: 14, paddingVertical: 13, marginTop: 10,
  },
  openText: { fontSize: 14.5, fontWeight: '800', color: '#fff' },
  waiting: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.BG, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 11, marginTop: 10,
    borderWidth: 1, borderColor: COLORS.BORDER_LIGHT,
  },
  waitingText: { flex: 1, fontSize: 12.5, fontWeight: '700', color: COLORS.TEXT_SECONDARY, lineHeight: 17 },
});
