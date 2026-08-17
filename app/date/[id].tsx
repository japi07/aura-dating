import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity, StatusBar,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import { DatePlanner, type DayPlan } from '@/components/DatePlanner';
import { DateRoadmap } from '@/components/DateRoadmap';
import { useDatesStore } from '@/store/dates';
import {
  fetchDatePlanState, submitDateAvailability, instantsToPlan, buildRoadmap,
  type DatePlanState,
} from '@/lib/date-plan-supabase';
import { formatDate, formatTime } from '@/lib/format';

/**
 * A date that is still being planned.
 *
 * Blind and call dates arrive with two people and nothing else — no venue, no
 * time. This is where that gets resolved: both sides post the evenings that
 * work, we book inside the overlap, and the roadmap shows whose turn it is
 * while that happens.
 *
 * Curated proposals reach this screen already confirmed, so it degrades into
 * a read-only summary rather than asking for times nobody needs.
 */
export default function DateDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const dates = useDatesStore((st) => st.dates);
  const date = useMemo(() => dates.find((d) => d.id === id), [dates, id]);

  const [plan, setPlan] = useState<DatePlanState | null>(null);
  const [draft, setDraft] = useState<DayPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const st = await fetchDatePlanState(id);
      setPlan(st);
      if (st?.mySlots?.length) setDraft(instantsToPlan(st.mySlots));
    } catch {
      // Offline. The roadmap still renders from what the store knows.
    }
  }, [id]);

  useEffect(() => { (async () => { await load(); setLoading(false); })(); }, [load]);

  const save = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await submitDateAvailability(id, draft);
      setEditing(false);
      await load();
      Alert.alert(
        'Sent',
        plan?.theySubmitted
          ? 'You have both sent your times. We will book something and confirm here.'
          : 'We will let you know as soon as they send theirs.',
      );
    } catch (e: any) {
      Alert.alert('Could not send', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const stages = buildRoadmap({
    mode: (plan?.mode ?? date?.mode ?? 'blind') as 'proposal' | 'blind' | 'call',
    status: plan?.status ?? date?.status ?? 'planning',
    iSubmitted: !!plan?.iSubmitted,
    theySubmitted: !!plan?.theySubmitted,
    hasTime: !!(plan?.startsAt ?? date?.startsAt),
    followUpDue: false,
  });

  const needsAvailability =
    (plan?.status ?? 'planning') === 'planning' && !(plan?.startsAt ?? date?.startsAt);
  const showPlanner = needsAvailability && (editing || !plan?.iSubmitted);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <View style={s.header}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/connections'))}
          style={s.backBtn}
        >
          <Ionicons name="chevron-back" size={26} color={COLORS.TEXT} />
        </TouchableOpacity>
        <Text style={s.title}>Your date</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={s.centered}><ActivityIndicator color={COLORS.BRAND} /></View>
      ) : (
        <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
          {/* Who */}
          {date && (
            <View style={s.whoCard}>
              {date.mode === 'blind' ? (
                <View style={[s.avatar, s.avatarBlind]}>
                  <Text style={{ fontSize: 24 }}>🎭</Text>
                </View>
              ) : date.with.photoUrl ? (
                <Image source={{ uri: date.with.photoUrl }} style={s.avatar} />
              ) : (
                <View style={[s.avatar, s.avatarBlind]}>
                  <Ionicons name="person" size={22} color={COLORS.TEXT_MUTED} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={s.whoName}>
                  {date.mode === 'blind' ? 'A blind date' : date.with.name}
                </Text>
                <Text style={s.whoSub}>
                  {date.mode === 'blind'
                    ? 'You will meet them on the night'
                    : date.mode === 'call'
                      ? 'You both said yes after your call'
                      : 'Curated date'}
                </Text>
              </View>
            </View>
          )}

          {/* Confirmed details, once there are any */}
          {(plan?.startsAt || date?.startsAt) && (
            <View style={s.confirmedCard}>
              <View style={s.confirmedRow}>
                <Ionicons name="calendar" size={15} color={COLORS.BRAND} />
                <Text style={s.confirmedText}>
                  {formatDate((plan?.startsAt ?? date!.startsAt)!)} ·{' '}
                  {formatTime((plan?.startsAt ?? date!.startsAt)!)}
                </Text>
              </View>
              {!!(plan?.venueName ?? date?.venue?.name) && (
                <View style={s.confirmedRow}>
                  <Ionicons name="location" size={15} color={COLORS.BRAND} />
                  <Text style={s.confirmedText}>{plan?.venueName ?? date?.venue?.name}</Text>
                </View>
              )}
            </View>
          )}

          {/* The roadmap */}
          <Text style={s.sectionLabel}>How this works</Text>
          <View style={s.roadmapCard}>
            <DateRoadmap stages={stages} />
          </View>

          {/* Availability */}
          {needsAvailability && (
            <>
              <Text style={s.sectionLabel}>
                {showPlanner ? 'When are you free?' : 'Your times'}
              </Text>

              {showPlanner ? (
                <>
                  <Text style={s.hint}>
                    Add every evening that genuinely works. The more you give,
                    the more likely we find one you both share.
                  </Text>
                  <DatePlanner value={draft} onChange={setDraft} />

                  <TouchableOpacity
                    style={[s.primaryBtn, saving && { opacity: 0.7 }]}
                    onPress={save}
                    disabled={saving}
                    activeOpacity={0.88}
                  >
                    {saving ? <ActivityIndicator color="#fff" /> : (
                      <Text style={s.primaryText}>
                        {plan?.iSubmitted ? 'Update my times' : 'Send my times'}
                      </Text>
                    )}
                  </TouchableOpacity>

                  {plan?.iSubmitted && (
                    <TouchableOpacity style={s.ghostBtn} onPress={() => setEditing(false)}>
                      <Text style={s.ghostText}>Cancel</Text>
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                <View style={s.sentCard}>
                  <View style={s.sentTop}>
                    <Ionicons name="checkmark-circle" size={18} color={COLORS.LIKE} />
                    <Text style={s.sentTitle}>
                      {plan?.theySubmitted
                        ? 'You have both sent your times'
                        : 'Sent — waiting on them'}
                    </Text>
                  </View>

                  {plan!.overlap.length > 0 ? (
                    <>
                      <Text style={s.sentSub}>
                        {plan!.overlap.length === 1
                          ? 'One time works for you both:'
                          : `${plan!.overlap.length} times work for you both:`}
                      </Text>
                      <View style={s.chipWrap}>
                        {plan!.overlap.slice(0, 6).map((iso) => (
                          <View key={iso} style={s.chip}>
                            <Text style={s.chipText}>
                              {formatDate(iso)} · {formatTime(iso)}
                            </Text>
                          </View>
                        ))}
                      </View>
                      <Text style={s.sentFoot}>
                        We will book one of these and confirm the venue here.
                      </Text>
                    </>
                  ) : plan?.theySubmitted ? (
                    <Text style={s.sentSub}>
                      None of your times overlapped. Add a few more and we will
                      keep looking.
                    </Text>
                  ) : (
                    <Text style={s.sentSub}>
                      We will nudge them. As soon as they answer we will find a
                      time you both have free.
                    </Text>
                  )}

                  <TouchableOpacity style={s.ghostBtn} onPress={() => setEditing(true)}>
                    <Ionicons name="create-outline" size={15} color={COLORS.BRAND} />
                    <Text style={[s.ghostText, { color: COLORS.BRAND }]}>Change my times</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
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

  whoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: COLORS.SURFACE, borderRadius: 20, padding: 16, marginBottom: 16,
    shadowColor: '#1A0F26', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06,
    shadowRadius: 12, elevation: 3,
  },
  avatar: { width: 52, height: 52, borderRadius: 18 },
  avatarBlind: {
    backgroundColor: COLORS.BRAND_MUTED, justifyContent: 'center', alignItems: 'center',
  },
  whoName: { fontSize: 17, fontWeight: '800', color: COLORS.TEXT },
  whoSub: { fontSize: 12.5, color: COLORS.TEXT_MUTED, marginTop: 2 },

  confirmedCard: {
    backgroundColor: COLORS.BRAND_MUTED, borderRadius: 16, padding: 14, gap: 8, marginBottom: 16,
  },
  confirmedRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  confirmedText: { flex: 1, fontSize: 13.5, fontWeight: '700', color: COLORS.TEXT },

  sectionLabel: {
    fontSize: 11, fontWeight: '800', color: COLORS.TEXT_MUTED,
    letterSpacing: 0.9, textTransform: 'uppercase', marginBottom: 10, marginTop: 6,
  },
  roadmapCard: {
    backgroundColor: COLORS.SURFACE, borderRadius: 20, padding: 18, marginBottom: 12,
    shadowColor: '#1A0F26', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05,
    shadowRadius: 10, elevation: 2,
  },

  hint: { fontSize: 12.5, color: COLORS.TEXT_SECONDARY, lineHeight: 18, marginBottom: 14 },

  primaryBtn: {
    backgroundColor: COLORS.BRAND, borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', marginTop: 16,
  },
  primaryText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  ghostBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 14, marginTop: 6,
  },
  ghostText: { fontSize: 14, fontWeight: '700', color: COLORS.TEXT_MUTED },

  sentCard: {
    backgroundColor: COLORS.SURFACE, borderRadius: 20, padding: 18,
    shadowColor: '#1A0F26', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05,
    shadowRadius: 10, elevation: 2,
  },
  sentTop: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 8 },
  sentTitle: { flex: 1, fontSize: 14.5, fontWeight: '800', color: COLORS.TEXT },
  sentSub: { fontSize: 13, color: COLORS.TEXT_SECONDARY, lineHeight: 19 },
  sentFoot: { fontSize: 12, color: COLORS.TEXT_MUTED, lineHeight: 17, marginTop: 10 },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    backgroundColor: COLORS.LIKE_BG, borderRadius: 11,
    paddingHorizontal: 11, paddingVertical: 7,
  },
  chipText: { fontSize: 12, fontWeight: '700', color: COLORS.LIKE },
});
