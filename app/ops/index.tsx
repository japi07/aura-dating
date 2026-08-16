import React, { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity, TextInput,
  StatusBar, Alert, ActivityIndicator, RefreshControl, Image,
  KeyboardAvoidingView, Platform, Modal, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import { LONDON_VENUES } from '@/constants/london';
import { DateField } from '@/components/DateField';
import { TimeField } from '@/components/TimeField';
import {
  amIAdmin, fetchPlanningQueue, confirmPlannedDate, runBlindMatcher,
  type PlanningDate,
} from '@/lib/ops-supabase';

/**
 * Concierge console.
 *
 * Every date that two people have committed to but nobody has booked yet.
 * Shows the merged constraints of both participants — ops has to satisfy
 * both, so the intersection is what matters — and lets a venue and time be
 * written in one action.
 */
export default function OpsScreen() {
  const router = useRouter();
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [queue, setQueue] = useState<PlanningDate[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [matching, setMatching] = useState(false);
  const [editing, setEditing] = useState<PlanningDate | null>(null);

  const load = useCallback(async () => {
    try { setQueue(await fetchPlanningQueue()); } catch { /* keep what we have */ }
  }, []);

  useEffect(() => {
    (async () => {
      const ok = await amIAdmin();
      setAdmin(ok);
      if (ok) await load();
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const runMatcher = async () => {
    setMatching(true);
    try {
      const { matched } = await runBlindMatcher();
      await load();
      Alert.alert(
        matched > 0 ? `${matched} pair${matched > 1 ? 's' : ''} matched` : 'No new matches',
        matched > 0
          ? 'They\'re in the planning queue below.'
          : 'Not enough compatible people waiting yet.',
      );
    } catch (e: any) {
      Alert.alert('Matcher failed', e?.message || 'Please try again.');
    } finally {
      setMatching(false);
    }
  };

  if (admin === null) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.center}><ActivityIndicator color={COLORS.BRAND} /></View>
      </SafeAreaView>
    );
  }

  if (!admin) {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <View style={s.center}>
          <Ionicons name="lock-closed-outline" size={40} color={COLORS.TEXT_MUTED} />
          <Text style={s.deniedTitle}>Ops only</Text>
          <Text style={s.deniedSub}>This area is for the Aura team.</Text>
          <TouchableOpacity style={s.primaryBtn} onPress={() => router.replace('/(tabs)')}>
            <Text style={s.primaryText}>Back to Aura</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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
          <Text style={s.title}>Concierge</Text>
          <Text style={s.sub}>
            {queue.length === 0 ? 'Nothing to plan' : `${queue.length} to plan`}
          </Text>
        </View>
        <TouchableOpacity style={s.matchBtn} onPress={runMatcher} disabled={matching}>
          {matching
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="git-merge-outline" size={18} color="#fff" />}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.BRAND} />}
      >
        {queue.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyEmoji}>☕</Text>
            <Text style={s.emptyTitle}>Queue is clear</Text>
            <Text style={s.emptySub}>
              Run the matcher to pair anyone waiting in the blind date pool.
            </Text>
          </View>
        ) : (
          queue.map((d) => (
            <TouchableOpacity
              key={d.dateId}
              style={s.card}
              onPress={() => setEditing(d)}
              activeOpacity={0.9}
            >
              <View style={s.cardTop}>
                <View style={s.modePill}>
                  <Text style={s.modePillText}>{d.mode}</Text>
                </View>
                <Text style={s.waited}>waiting {waitedFor(d.createdAt)}</Text>
              </View>

              <View style={s.pairRow}>
                <Person p={d.a} />
                <Ionicons name="heart" size={15} color={COLORS.BRAND} />
                <Person p={d.b} />
              </View>

              <View style={s.constraints}>
                <Constraint icon="location-outline" text={d.areas.join(', ') || 'Any area'} />
                <Constraint
                  icon="calendar-outline"
                  text={d.availableFrom && d.availableTo
                    ? `${d.availableFrom} → ${d.availableTo}`
                    : 'No window given'}
                />
                <Constraint icon="time-outline" text={d.timeBands.join(', ') || 'Any time'} />
                <Constraint icon="card-outline" text={`Budget ${d.budget ?? 'mid'}`} />
                {!!d.dateStyles.length && (
                  <Constraint icon="sparkles-outline" text={d.dateStyles.join(', ')} />
                )}
                {!!d.dietary && <Constraint icon="restaurant-outline" text={d.dietary} warn />}
                {!!d.accessibility && <Constraint icon="accessibility-outline" text={d.accessibility} warn />}
              </View>

              <View style={s.planCta}>
                <Text style={s.planCtaText}>Plan this date</Text>
                <Ionicons name="chevron-forward" size={16} color={COLORS.BRAND} />
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <PlanSheet
        date={editing}
        onClose={() => setEditing(null)}
        onDone={async () => { setEditing(null); await load(); }}
      />
    </SafeAreaView>
  );
}

/* ─── the planning sheet ─── */

function PlanSheet({ date, onClose, onDone }: {
  date: PlanningDate | null; onClose: () => void; onDone: () => void;
}) {
  const [venue, setVenue] = useState('');
  const [address, setAddress] = useState('');
  const [postcode, setPostcode] = useState('');
  const [day, setDay] = useState('');
  const [time, setTime] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (date) { setVenue(''); setAddress(''); setPostcode(''); setDay(''); setTime(''); }
  }, [date?.dateId]);

  if (!date) return null;

  // Suggest venues that actually sit in an area both people asked for
  const suggestions = LONDON_VENUES.filter(
    (v) => date.areas.length === 0 || date.areas.some((a) => v.area.toLowerCase() === a.toLowerCase()),
  ).slice(0, 8);

  const pick = (name: string, addr: string, pc: string) => {
    setVenue(name); setAddress(addr); setPostcode(pc);
  };

  const save = async () => {
    if (!venue.trim()) { Alert.alert('Venue needed', 'Enter or pick a venue.'); return; }
    if (!day || !time) { Alert.alert('Time needed', 'Pick a date and a time.'); return; }
    const startsAt = new Date(`${day}T${time}:00`);
    if (isNaN(startsAt.getTime())) { Alert.alert('Invalid time', 'Check the date and time.'); return; }

    setSaving(true);
    try {
      const match = LONDON_VENUES.find((v) => v.name === venue);
      await confirmPlannedDate({
        dateId: date.dateId,
        startsAt: startsAt.toISOString(),
        venue: venue.trim(),
        address: address.trim() || undefined,
        postcode: postcode.trim() || undefined,
        lat: match?.lat,
        lng: match?.lng,
      });
      Alert.alert('Confirmed', `${date.a.name} and ${date.b.name} can now see the details.`);
      onDone();
    } catch (e: any) {
      Alert.alert('Could not confirm', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={s.sheetTitle}>{date.a.name} & {date.b.name}</Text>
              <Text style={s.sheetSub}>
                Both must work: {date.areas.join(', ') || 'any area'} ·{' '}
                {date.timeBands.join(', ') || 'any time'} · budget {date.budget ?? 'mid'}
                {date.dietary ? ` · ${date.dietary}` : ''}
              </Text>

              {suggestions.length > 0 && (
                <>
                  <Text style={s.fieldLabel}>Suggested venues in their areas</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.suggestRail}>
                    {suggestions.map((v) => (
                      <TouchableOpacity
                        key={v.id}
                        style={[s.suggestCard, venue === v.name && s.suggestOn]}
                        onPress={() => pick(v.name, v.address, v.postcode)}
                      >
                        <Text style={s.suggestEmoji}>{v.emoji}</Text>
                        <Text style={s.suggestName} numberOfLines={2}>{v.name}</Text>
                        <Text style={s.suggestMeta}>{v.area} · {v.priceRange}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              <Text style={s.fieldLabel}>Venue</Text>
              <TextInput style={s.input} value={venue} onChangeText={setVenue}
                placeholder="Venue name" placeholderTextColor={COLORS.TEXT_MUTED} />
              <View style={s.row}>
                <TextInput style={[s.input, { flex: 2 }]} value={address} onChangeText={setAddress}
                  placeholder="Address" placeholderTextColor={COLORS.TEXT_MUTED} />
                <TextInput style={[s.input, { flex: 1 }]} value={postcode} onChangeText={setPostcode}
                  placeholder="Postcode" placeholderTextColor={COLORS.TEXT_MUTED} autoCapitalize="characters" />
              </View>

              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <DateField label="Date" value={day} onChange={setDay} mode="future" placeholder="Pick a day" />
                </View>
                <View style={{ flex: 1 }}>
                  <TimeField label="Time" value={time} onChange={setTime} placeholder="Pick a time" />
                </View>
              </View>

              <TouchableOpacity style={[s.primaryBtn, saving && { opacity: 0.7 }]} onPress={save} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" />
                  : <Text style={s.primaryText}>Confirm and notify both</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
                <Text style={s.cancelText}>Not now</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Person({ p }: { p: { name: string; photoUrl?: string } }) {
  return (
    <View style={s.person}>
      {p.photoUrl
        ? <Image source={{ uri: p.photoUrl }} style={s.avatar} />
        : <View style={[s.avatar, s.avatarEmpty]}><Ionicons name="person" size={16} color={COLORS.TEXT_MUTED} /></View>}
      <Text style={s.personName} numberOfLines={1}>{p.name}</Text>
    </View>
  );
}

function Constraint({ icon, text, warn }: { icon: any; text: string; warn?: boolean }) {
  return (
    <View style={s.constraintRow}>
      <Ionicons name={icon} size={13} color={warn ? COLORS.WARNING : COLORS.TEXT_MUTED} />
      <Text style={[s.constraintText, warn && { color: COLORS.WARNING, fontWeight: '700' }]}>{text}</Text>
    </View>
  );
}

function waitedFor(iso: string): string {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  if (h < 1) return 'under an hour';
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, padding: 32 },
  deniedTitle: { fontSize: 20, fontWeight: '800', color: COLORS.TEXT, marginTop: 8 },
  deniedSub: { fontSize: 14, color: COLORS.TEXT_MUTED },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 12,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.TEXT },
  sub: { fontSize: 12, color: COLORS.TEXT_MUTED },
  matchBtn: {
    width: 44, height: 44, borderRadius: 15, backgroundColor: COLORS.BRAND,
    justifyContent: 'center', alignItems: 'center',
  },

  list: { padding: 16, paddingBottom: 40, gap: 14 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 8, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 42 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: COLORS.TEXT },
  emptySub: { fontSize: 14, color: COLORS.TEXT_MUTED, textAlign: 'center', lineHeight: 20 },

  card: {
    backgroundColor: COLORS.SURFACE, borderRadius: 20, padding: 16, gap: 14,
    shadowColor: '#1A0F26', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07,
    shadowRadius: 12, elevation: 3,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modePill: {
    backgroundColor: COLORS.BRAND_MUTED, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  modePillText: { fontSize: 11, fontWeight: '900', color: COLORS.BRAND, textTransform: 'uppercase' },
  waited: { fontSize: 11, color: COLORS.TEXT_MUTED, fontWeight: '600' },

  pairRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  person: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 34, height: 34, borderRadius: 12 },
  avatarEmpty: { backgroundColor: COLORS.BRAND_MUTED, justifyContent: 'center', alignItems: 'center' },
  personName: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.TEXT },

  constraints: { gap: 6, backgroundColor: COLORS.BG, borderRadius: 14, padding: 12 },
  constraintRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  constraintText: { flex: 1, fontSize: 12, color: COLORS.TEXT_SECONDARY },

  planCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  planCtaText: { fontSize: 14, fontWeight: '800', color: COLORS.BRAND },

  backdrop: { flex: 1, backgroundColor: 'rgba(20,16,40,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.SURFACE, borderTopLeftRadius: 26, borderTopRightRadius: 26,
    padding: 22, paddingBottom: 34, maxHeight: '92%',
  },
  sheetTitle: { fontSize: 20, fontWeight: '900', color: COLORS.TEXT },
  sheetSub: { fontSize: 12, color: COLORS.TEXT_MUTED, marginTop: 4, marginBottom: 18, lineHeight: 17 },

  fieldLabel: {
    fontSize: 11, fontWeight: '800', color: COLORS.TEXT_MUTED,
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginTop: 6,
  },
  suggestRail: { gap: 10, paddingBottom: 14 },
  suggestCard: {
    width: 140, padding: 12, borderRadius: 14, gap: 3,
    backgroundColor: COLORS.BG, borderWidth: 1.5, borderColor: COLORS.BORDER_LIGHT,
  },
  suggestOn: { borderColor: COLORS.BRAND, backgroundColor: COLORS.BRAND_MUTED },
  suggestEmoji: { fontSize: 18 },
  suggestName: { fontSize: 12, fontWeight: '800', color: COLORS.TEXT, lineHeight: 16 },
  suggestMeta: { fontSize: 10, color: COLORS.TEXT_MUTED, fontWeight: '600' },

  input: {
    backgroundColor: COLORS.BG, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    borderWidth: 1.5, borderColor: COLORS.BORDER, fontSize: 14, color: COLORS.TEXT, marginBottom: 10,
  },
  row: { flexDirection: 'row', gap: 10 },

  primaryBtn: {
    backgroundColor: COLORS.BRAND, borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', marginTop: 10,
  },
  primaryText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  cancelBtn: { paddingVertical: 14, alignItems: 'center' },
  cancelText: { fontSize: 14, fontWeight: '700', color: COLORS.TEXT_MUTED },
});
