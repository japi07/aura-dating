import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity, StatusBar,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import { type DayPlan } from '@/components/DatePlanner';
import { SharedAvailability } from '@/components/SharedAvailability';
import { DateRoadmap } from '@/components/DateRoadmap';
import { useDatesStore } from '@/store/dates';
import {
  fetchDatePlanState, submitDateAvailability, submitDateAvailabilityInstants,
  instantsToPlan, planToInstants, buildRoadmap,
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
  /**
   * Times taken from THEIR list, kept as the exact instants they arrived as.
   *
   * Deliberately not folded into `draft`. A DayPlan is a local date plus
   * HH:MM, and rebuilding an instant from that is lossy inside a repeated
   * fall-back hour -- it resolves to the offset before the transition, so
   * the time comes back an hour early. Their slots are authored on their
   * device, possibly in another timezone, so they can land in my repeated
   * hour even though my own picker never can. Keeping them separate means
   * they are submitted exactly as received.
   */
  const [tapped, setTapped] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const st = await fetchDatePlanState(id);
      setPlan(st);
      if (st?.mySlots?.length) setDraft(instantsToPlan(st.mySlots));
      // Whatever was tapped is now part of mySlots, so the local set has
      // done its job. Leaving it would double-count on the next save.
      setTapped([]);
    } catch {
      // Offline. The roadmap still renders from what the store knows.
    }
  }, [id]);

  useEffect(() => { (async () => { await load(); setLoading(false); })(); }, [load]);


  /**
   * Compare by INSTANT, never by string.
   *
   * planToInstants produces Date.toISOString() -- "2026-08-25T18:00:00.000Z" --
   * while Postgres serialises the identical timestamptz as
   * "2026-08-25T18:00:00+00:00". Same moment, different text, so a string
   * comparison between one of their slots and my own draft is false even when
   * they are the same evening. Tapping a chip would add it and then refuse to
   * ever remove it, because the removal path could not find what it had put
   * there.
   */
  const sameInstant = (a: string, b: string) => {
    const ta = new Date(a).getTime();
    const tb = new Date(b).getTime();
    return !isNaN(ta) && ta === tb;
  };

  /**
   * Have I already taken this one of theirs?
   *
   * Memoised because SharedAvailability lists it as a useMemo dependency —
   * a fresh closure on every render would rebuild the whole grid on every
   * keystroke and defeat the point of the memo.
   */
  const draftHas = useCallback(
    (iso: string) =>
      tapped.some((x) => sameInstant(x, iso))
      || planToInstants(draft).some((x) => sameInstant(x, iso)),
    [tapped, draft],
  );

  /**
   * Add or remove one of their times from my own selection.
   *
   * Round-trips through the same instants<->DayPlan helpers the picker and
   * the server use, so a slot added by tapping is indistinguishable from
   * one picked by hand -- and the overlap computed server-side will
   * actually contain it, which is the whole point of showing these.
   */
  const toggleTheirTime = (iso: string) => {
    setTapped((prev) =>
      prev.some((x) => sameInstant(x, iso))
        ? prev.filter((x) => !sameInstant(x, iso))
        : [...prev, iso],
    );
  };

  const save = async () => {
    if (!id) return;
    setSaving(true);
    try {
      // The picker contributes wall-clock slots, which is what the member
      // meant; the chips contribute exact instants, which is what they were
      // handed. Merged as instants so neither is reinterpreted.
      await submitDateAvailabilityInstants(id, [...planToInstants(draft), ...tapped]);
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

  const overlapCount = plan?.overlap?.length ?? 0;
  const needsAvailability =
    (plan?.status ?? 'planning') === 'planning' && !(plan?.startsAt ?? date?.startsAt);

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
              <Text style={s.sectionLabel}>When are you both free?</Text>

              {/* Where the plan stands, as a line above the grid rather than
                  a card instead of it.

                  Sending your times used to swap the grid out for a summary,
                  so the one view that shows both people disappeared exactly
                  when it became most useful -- the moment there was something
                  of theirs to compare against. The grid is now the screen,
                  from the first visit to the last, and this only narrates it. */}
              <View style={[s.statusBar, overlapCount > 0 && s.statusBarGood]}>
                <Ionicons
                  name={
                    overlapCount > 0 ? 'checkmark-circle'
                    : plan?.iSubmitted ? 'hourglass-outline'
                    : 'calendar-outline'
                  }
                  size={16}
                  color={overlapCount > 0 ? COLORS.LIKE : COLORS.TEXT_MUTED}
                />
                <Text style={[s.statusText, overlapCount > 0 && s.statusTextGood]}>
                  {overlapCount > 0
                    ? `${overlapCount} ${overlapCount === 1 ? 'time works' : 'times work'} for you both — we will book one`
                    : plan?.iSubmitted && plan?.theySubmitted
                      ? 'No time you have both said yes to yet — tap one of theirs, or add more'
                      : plan?.iSubmitted
                        ? 'Sent. We will nudge them and update this the moment they answer'
                        : plan?.theySubmitted
                          ? 'They have sent theirs — tick the ones that work for you'
                          : 'Add the evenings that work, and theirs will appear here too'}
                </Text>
              </View>

              <SharedAvailability
                value={draft}
                onChange={setDraft}
                theirSlots={plan?.theirSlots ?? []}
                theySubmitted={!!plan?.theySubmitted}
                onToggleTheirInstant={toggleTheirTime}
                isMine={draftHas}
              />

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

              <Text style={s.smallPrintCentre}>
                {plan?.iSubmitted
                  ? 'Change these any time until we book it.'
                  : 'You can change these later.'}
              </Text>
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


  statusBar: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    backgroundColor: COLORS.BG, borderRadius: 13,
    paddingHorizontal: 12, paddingVertical: 11, marginBottom: 14,
    borderWidth: 1, borderColor: COLORS.BORDER_LIGHT,
  },
  statusBarGood: { backgroundColor: COLORS.LIKE_BG, borderColor: COLORS.LIKE_BG },
  statusText: {
    flex: 1, fontSize: 12.5, fontWeight: '700', color: COLORS.TEXT_SECONDARY,
    lineHeight: 17,
  },
  statusTextGood: { color: COLORS.LIKE },
  smallPrintCentre: {
    fontSize: 11.5, color: COLORS.TEXT_MUTED, textAlign: 'center', marginTop: 10,
  },
  primaryBtn: {
    backgroundColor: COLORS.BRAND, borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', marginTop: 16,
  },
  primaryText: { fontSize: 15, fontWeight: '800', color: '#fff' },


});
