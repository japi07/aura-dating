/**
 * Agreeing a time for a date that doesn't have one yet.
 *
 * Curated proposals already work this way in one direction: he offers several
 * slots, she picks one. A blind date has no sender, so it runs in both — each
 * person posts when they're free and the concierge books inside the overlap.
 *
 * You never see their raw availability, only the overlap. That is enforced in
 * the database (date_availability is own-rows-only under RLS) rather than
 * here, and it matters: shown the other person's answer first, most people
 * would simply mirror it, and the overlap would stop meaning anything.
 */
import { getSupabase, supabaseEnabled } from './supabase';
import type { DayPlan } from '@/components/DatePlanner';

export interface DatePlanState {
  dateId: string;
  mode: 'proposal' | 'blind' | 'call';
  status: string;
  /** The instants you offered */
  mySlots: string[];
  iSubmitted: boolean;
  theySubmitted: boolean;
  /** Instants you both offered. Empty until you both have. */
  overlap: string[];
  startsAt: string | null;
  venueName: string | null;
}

/** DayPlan[] -> ISO instants, matching what the proposal composer sends. */
export function planToInstants(plan: DayPlan[]): string[] {
  const out: string[] = [];
  for (const day of plan) {
    for (const slot of day.slots) {
      const d = new Date(`${day.date}T${slot}:00`);
      if (!isNaN(d.getTime())) out.push(d.toISOString());
    }
  }
  return Array.from(new Set(out)).sort();
}

/** ISO instants -> DayPlan[], so an existing answer reopens in the picker. */
export function instantsToPlan(instants: string[]): DayPlan[] {
  const byDay = new Map<string, Set<string>>();
  for (const iso of instants) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) continue;
    const pad = (n: number) => String(n).padStart(2, '0');
    const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    if (!byDay.has(day)) byDay.set(day, new Set());
    byDay.get(day)!.add(time);
  }
  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, slots]) => ({ date, slots: Array.from(slots).sort() }));
}

export async function fetchDatePlanState(dateId: string): Promise<DatePlanState | null> {
  if (!supabaseEnabled) return null;
  const { data, error } = await getSupabase().rpc('date_plan_state', { p_date_id: dateId });
  if (error) throw error;

  const r = Array.isArray(data) ? data[0] : data;
  if (!r) return null;

  return {
    dateId: r.date_id,
    mode: r.mode,
    status: r.status,
    mySlots: r.my_slots ?? [],
    iSubmitted: !!r.i_submitted,
    theySubmitted: !!r.they_submitted,
    overlap: r.overlap ?? [],
    startsAt: r.starts_at ?? null,
    venueName: r.venue_name ?? null,
  };
}

export async function submitDateAvailability(dateId: string, plan: DayPlan[]): Promise<void> {
  const slots = planToInstants(plan);
  if (slots.length === 0) throw new Error('Pick at least one time that works');

  const { error } = await getSupabase().rpc('submit_date_availability', {
    p_date_id: dateId,
    p_slots: slots,
  });
  if (error) throw error;
}

/* ─── the roadmap ─── */

export type RoadmapStageKey =
  | 'matched' | 'availability' | 'booking' | 'confirmed' | 'date' | 'followup';

export interface RoadmapStage {
  key: RoadmapStageKey;
  title: string;
  detail: string;
  state: 'done' | 'current' | 'todo';
}

/**
 * Where a date has got to, as a sequence someone can read at a glance.
 *
 * A blind date spends its first stretch as a row with no venue and no time,
 * which on its own looks like nothing happening. Naming the steps is the
 * difference between "we're planning it" and knowing whose turn it is.
 */
export function buildRoadmap(input: {
  mode: 'proposal' | 'blind' | 'call';
  status: string;
  iSubmitted: boolean;
  theySubmitted: boolean;
  hasTime: boolean;
  followUpDue: boolean;
}): RoadmapStage[] {
  const { mode, status, iSubmitted, theySubmitted, hasTime, followUpDue } = input;
  const done = status === 'completed';
  const planning = status === 'planning' || !hasTime;

  const firstTitle =
    mode === 'blind' ? 'Matched' : mode === 'call' ? 'You both said yes' : 'Proposal accepted';
  const firstDetail =
    mode === 'blind'
      ? 'We found someone we think you will get on with'
      : mode === 'call'
        ? 'You each said you would like to meet'
        : 'You accepted the invitation';

  const stages: RoadmapStage[] = [
    { key: 'matched', title: firstTitle, detail: firstDetail, state: 'done' },
    {
      key: 'availability',
      title: 'When you are free',
      detail: !iSubmitted
        ? 'Tell us which evenings work for you'
        : !theySubmitted
          ? 'Sent. Waiting on them'
          : 'You have both sent your times',
      state: iSubmitted && theySubmitted ? 'done' : 'current',
    },
    {
      key: 'booking',
      title: 'We book it',
      detail: 'We pick somewhere you will both like and reserve the table',
      state: !planning ? 'done' : iSubmitted && theySubmitted ? 'current' : 'todo',
    },
    {
      key: 'confirmed',
      title: 'Details confirmed',
      detail: hasTime ? 'Venue and time are set' : 'You will get the venue and time here',
      state: hasTime ? 'done' : 'todo',
    },
    {
      key: 'date',
      title: 'Date night',
      detail: 'Turn up, be yourself',
      state: done ? 'done' : hasTime ? 'current' : 'todo',
    },
    {
      key: 'followup',
      title: 'Swap numbers?',
      detail: 'If you both want to, we put you in touch',
      state: done && followUpDue ? 'current' : done ? 'done' : 'todo',
    },
  ];

  // Only ever one 'current' — the earliest unfinished stage owns it, so the
  // roadmap reads as a single position rather than several things at once.
  let seenCurrent = false;
  for (const s of stages) {
    if (s.state === 'current') {
      if (seenCurrent) s.state = 'todo';
      seenCurrent = true;
    }
  }
  return stages;
}
