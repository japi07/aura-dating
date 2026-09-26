import React from 'react';
import { View, Text, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import { SUPPORT_EMAIL } from '@/lib/safety-supabase';

/**
 * Shown on the two features where you meet someone before you know who they
 * are: a voice call and a blind date. They are the reason App Review reads
 * Aura as a place to "post content anonymously", so the precautions sit right
 * here, visible at any hour, not only once something goes wrong.
 */
export function AnonymousSafetyCard({ mode }: { mode: 'call' | 'blind' }) {
  const lines = mode === 'call'
    ? [
        { icon: 'person-circle-outline', text: 'Anonymous to each other, never to us: everyone is a signed-in member who agreed to our zero-tolerance rules.' },
        { icon: 'flag-outline', text: 'End & report stays on screen for the whole call. It hangs up at once and blocks them.' },
        { icon: 'ban-outline', text: 'After the call you can still report or block them, here or in Profile › Safety.' },
        { icon: 'time-outline', text: 'A person reviews every report within 24 hours and removes anyone who breaks the rules.' },
      ]
    : [
        { icon: 'person-circle-outline', text: 'Anonymous to each other, never to us: everyone is a signed-in member who agreed to our zero-tolerance rules.' },
        { icon: 'flag-outline', text: 'Report or block your date from their card in the Dates tab, before or after you meet.' },
        { icon: 'storefront-outline', text: 'First dates are always in a public venue we choose.' },
        { icon: 'time-outline', text: 'A person reviews every report within 24 hours and removes anyone who breaks the rules.' },
      ];

  return (
    <View style={s.card}>
      <View style={s.head}>
        <Ionicons name="shield-checkmark" size={16} color={COLORS.SUCCESS} />
        <Text style={s.title}>Your safety</Text>
      </View>
      {lines.map((l) => (
        <View key={l.text} style={s.row}>
          <Ionicons name={l.icon as any} size={15} color={COLORS.TEXT_SECONDARY} style={{ marginTop: 1 }} />
          <Text style={s.text}>{l.text}</Text>
        </View>
      ))}
      <Text style={s.contact}>
        Something wrong? Email{' '}
        <Text style={s.link} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Safety%20report`).catch(() => {})}>
          {SUPPORT_EMAIL}
        </Text>
        . In danger, call 999.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: COLORS.SURFACE, borderRadius: 16, padding: 14, gap: 8,
    borderWidth: 1, borderColor: COLORS.BORDER_LIGHT, marginBottom: 20,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  title: { fontSize: 14, fontWeight: '800', color: COLORS.TEXT },
  row: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  text: { flex: 1, fontSize: 12.5, color: COLORS.TEXT_SECONDARY, lineHeight: 17.5 },
  contact: { fontSize: 12, color: COLORS.TEXT_MUTED, lineHeight: 17, marginTop: 2 },
  link: { color: COLORS.BRAND, fontWeight: '700' },
});
