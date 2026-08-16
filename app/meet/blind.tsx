import React, { useEffect, useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  StatusBar, Alert, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import { LONDON_AREAS, VENUE_THEMES } from '@/constants/london';
import { DateField } from '@/components/DateField';
import {
  fetchMyBlindSignup, joinBlindPool, leaveBlindPool,
  TIME_BANDS, BUDGETS, type BlindSignup, type Budget,
} from '@/lib/blind-supabase';

const todayISO = () => new Date().toISOString().slice(0, 10);
const inDaysISO = (n: number) =>
  new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

/**
 * Blind date opt-in. The user never picks a person — they state the
 * constraints the concierge must work within, then wait.
 */
export default function BlindDateScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signup, setSignup] = useState<BlindSignup | null>(null);

  const [areas, setAreas] = useState<string[]>([]);
  const [styles_, setStyles_] = useState<string[]>([]);
  const [budget, setBudget] = useState<Budget>('mid');
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(inDaysISO(21));
  const [bands, setBands] = useState<string[]>([]);
  const [dietary, setDietary] = useState('');
  const [accessibility, setAccessibility] = useState('');

  useEffect(() => {
    (async () => {
      try { setSignup(await fetchMyBlindSignup()); } catch {}
      setLoading(false);
    })();
  }, []);

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const join = async () => {
    setSaving(true);
    try {
      const s = await joinBlindPool({
        areas, dateStyles: styles_, budget,
        availableFrom: from, availableTo: to, timeBands: bands,
        dietary, accessibility,
      });
      setSignup(s);
      Alert.alert(
        'You\'re in',
        'We\'ll find someone compatible and plan the whole date. You\'ll hear from us before it\'s confirmed.',
      );
    } catch (e: any) {
      Alert.alert('Could not join', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const leave = () => {
    if (!signup) return;
    Alert.alert('Leave the pool?', 'We\'ll stop looking for a match for you.', [
      { text: 'Stay in', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            await leaveBlindPool(signup.id);
            setSignup(null);
          } catch (e: any) {
            Alert.alert('Could not leave', e?.message || 'Please try again.');
          }
        },
      },
    ]);
  };

  const dateStyleOptions = Array.from(
    new Map(VENUE_THEMES.map((t) => [t.label, t])).values(),
  );

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <View style={s.header}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/discover'))}
          style={s.backBtn}
        >
          <Ionicons name="chevron-back" size={26} color={COLORS.TEXT} />
        </TouchableOpacity>
        <Text style={s.title}>Blind date</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={COLORS.BRAND} /></View>
      ) : signup?.status === 'waiting' ? (
        /* ── Already in the pool ── */
        <ScrollView contentContainerStyle={s.body}>
          <View style={s.waitingHero}>
            <Text style={s.waitingEmoji}>🎭</Text>
            <Text style={s.waitingTitle}>We're looking</Text>
            <Text style={s.waitingSub}>
              You're in the pool. When we find someone compatible we'll plan the
              date and let you know — you'll see who they are 24 hours before.
            </Text>
          </View>

          <View style={s.summaryCard}>
            <Row label="Areas" value={signup.areas.join(', ') || 'Anywhere'} />
            <Row label="When" value={signup.timeBands
              .map((b) => TIME_BANDS.find((t) => t.key === b)?.label ?? b).join(', ')} />
            <Row label="Between" value={`${signup.availableFrom} and ${signup.availableTo}`} />
            <Row label="Budget" value={BUDGETS.find((b) => b.key === signup.budget)?.label ?? ''} />
          </View>

          <TouchableOpacity style={s.leaveBtn} onPress={leave}>
            <Text style={s.leaveText}>Leave the pool</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : signup?.status === 'matched' ? (
        /* ── Matched ── */
        <View style={s.center}>
          <Text style={s.waitingEmoji}>✨</Text>
          <Text style={s.waitingTitle}>You've been matched</Text>
          <Text style={[s.waitingSub, { textAlign: 'center' }]}>
            We're planning your date now. Check the Dates tab for details.
          </Text>
          <TouchableOpacity style={s.primaryBtn} onPress={() => router.replace('/(tabs)/connections')}>
            <Text style={s.primaryText}>See my dates</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* ── Opt-in form ── */
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
            <Text style={s.intro}>
              You won't choose the person. Tell us what works for you and we'll
              find someone compatible and plan the whole thing.
            </Text>

            <Section title="Where would suit you?" hint="Pick as many as you like.">
              <Chips
                options={LONDON_AREAS.slice(0, 18)}
                selected={areas}
                onToggle={(v) => toggle(areas, setAreas, v)}
              />
            </Section>

            <Section title="When are you free?" hint="Broad bands — we'll pick the exact time.">
              <Chips
                options={TIME_BANDS.map((b) => b.label)}
                selected={bands.map((b) => TIME_BANDS.find((t) => t.key === b)?.label ?? b)}
                onToggle={(label) => {
                  const key = TIME_BANDS.find((t) => t.label === label)?.key;
                  if (key) toggle(bands, setBands, key);
                }}
              />
            </Section>

            <Section title="Between which dates?">
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <DateField label="From" value={from} onChange={setFrom} mode="future" />
                </View>
                <View style={{ flex: 1 }}>
                  <DateField label="Until" value={to} onChange={setTo} mode="future" />
                </View>
              </View>
            </Section>

            <Section title="What kind of date?" hint="Optional — helps us pick well.">
              <Chips
                options={dateStyleOptions.map((t) => t.label)}
                selected={styles_}
                onToggle={(v) => toggle(styles_, setStyles_, v)}
              />
            </Section>

            <Section title="Budget">
              <View style={s.budgetRow}>
                {BUDGETS.map((b) => {
                  const on = budget === b.key;
                  return (
                    <TouchableOpacity
                      key={b.key}
                      style={[s.budgetCard, on && s.budgetCardOn]}
                      onPress={() => setBudget(b.key)}
                    >
                      <Text style={[s.budgetLabel, on && { color: COLORS.BRAND }]}>{b.label}</Text>
                      <Text style={s.budgetHint}>{b.hint}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Section>

            <Section title="Anything we should know?" hint="Dietary needs, accessibility — we'll brief the venue.">
              <TextInput
                style={s.input}
                placeholder="e.g. vegetarian, no nuts"
                placeholderTextColor={COLORS.TEXT_MUTED}
                value={dietary}
                onChangeText={setDietary}
              />
              <TextInput
                style={[s.input, { marginTop: 10 }]}
                placeholder="e.g. step-free access needed"
                placeholderTextColor={COLORS.TEXT_MUTED}
                value={accessibility}
                onChangeText={setAccessibility}
              />
            </Section>

            <View style={s.commitCard}>
              <Ionicons name="hand-right-outline" size={18} color={COLORS.BRAND} />
              <Text style={s.commitText}>
                If we find you a match, you're committing to turn up. Cancelling
                late or not showing affects future matches.
              </Text>
            </View>

            <TouchableOpacity
              style={[s.primaryBtn, saving && { opacity: 0.7 }]}
              onPress={join}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.primaryText}>Join the pool</Text>}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {!!hint && <Text style={s.sectionHint}>{hint}</Text>}
      {children}
    </View>
  );
}

function Chips({ options, selected, onToggle }: {
  options: readonly string[]; selected: string[]; onToggle: (v: string) => void;
}) {
  return (
    <View style={s.chipWrap}>
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <TouchableOpacity key={o} style={[s.chip, on && s.chipOn]} onPress={() => onToggle(o)}>
            <Text style={[s.chipText, on && s.chipTextOn]}>{o}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.summaryRow}>
      <Text style={s.summaryLabel}>{label}</Text>
      <Text style={s.summaryValue}>{value}</Text>
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 8 },
  body: { padding: 20, paddingBottom: 40 },
  intro: { fontSize: 14, color: COLORS.TEXT_SECONDARY, lineHeight: 21, marginBottom: 22 },

  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.TEXT, marginBottom: 4 },
  sectionHint: { fontSize: 12, color: COLORS.TEXT_MUTED, marginBottom: 10 },
  row: { flexDirection: 'row', gap: 10 },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  chip: {
    paddingHorizontal: 13, paddingVertical: 9, borderRadius: 14,
    backgroundColor: COLORS.SURFACE, borderWidth: 1.5, borderColor: COLORS.BORDER_LIGHT,
  },
  chipOn: { backgroundColor: COLORS.BRAND_MUTED, borderColor: COLORS.BRAND },
  chipText: { fontSize: 13, fontWeight: '700', color: COLORS.TEXT_SECONDARY },
  chipTextOn: { color: COLORS.BRAND },

  budgetRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  budgetCard: {
    flex: 1, padding: 12, borderRadius: 14, alignItems: 'center', gap: 4,
    backgroundColor: COLORS.SURFACE, borderWidth: 1.5, borderColor: COLORS.BORDER_LIGHT,
  },
  budgetCardOn: { borderColor: COLORS.BRAND, backgroundColor: COLORS.BRAND_MUTED },
  budgetLabel: { fontSize: 17, fontWeight: '900', color: COLORS.TEXT },
  budgetHint: { fontSize: 10, color: COLORS.TEXT_MUTED, textAlign: 'center', lineHeight: 13 },

  input: {
    backgroundColor: COLORS.SURFACE, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13,
    borderWidth: 1.5, borderColor: COLORS.BORDER, fontSize: 14, color: COLORS.TEXT,
  },

  commitCard: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: COLORS.BRAND_MUTED, borderRadius: 16, padding: 14, marginBottom: 18,
  },
  commitText: { flex: 1, fontSize: 12, color: COLORS.TEXT_SECONDARY, lineHeight: 17 },

  primaryBtn: {
    backgroundColor: COLORS.BRAND, borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', marginTop: 8,
  },
  primaryText: { fontSize: 15, fontWeight: '800', color: '#fff' },

  waitingHero: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  waitingEmoji: { fontSize: 48 },
  waitingTitle: { fontSize: 22, fontWeight: '900', color: COLORS.TEXT },
  waitingSub: { fontSize: 14, color: COLORS.TEXT_SECONDARY, lineHeight: 21, textAlign: 'center' },

  summaryCard: {
    backgroundColor: COLORS.SURFACE, borderRadius: 18, padding: 16, marginTop: 20, gap: 12,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  summaryLabel: { fontSize: 12, fontWeight: '800', color: COLORS.TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryValue: { flex: 1, fontSize: 13, color: COLORS.TEXT, textAlign: 'right' },

  leaveBtn: { paddingVertical: 16, alignItems: 'center', marginTop: 18 },
  leaveText: { fontSize: 14, fontWeight: '700', color: COLORS.TEXT_MUTED, textDecorationLine: 'underline' },
});
