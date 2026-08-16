/**
 * Blind dates — the user states their constraints, joins a pool, and the
 * concierge pairs them and plans the date. They never choose the person.
 *
 * Deliberately reuses public.dates: a match creates a normal date row with
 * mode='blind' and status='planning', so the Dates tab, reminders, ratings
 * and the post-date follow-up all work unchanged.
 */
import { getSupabase, supabaseEnabled } from './supabase';
import { getSessionUserId } from './proposals-supabase';

export type BlindStatus = 'waiting' | 'matched' | 'cancelled' | 'expired';
export type Budget = 'low' | 'mid' | 'high';

/** Broad slots rather than exact times — ops needs latitude to book a venue. */
export const TIME_BANDS = [
  { key: 'weekday_lunch', label: 'Weekday lunch' },
  { key: 'weekday_evening', label: 'Weekday evening' },
  { key: 'weekend_day', label: 'Weekend daytime' },
  { key: 'weekend_evening', label: 'Weekend evening' },
] as const;

export const BUDGETS: { key: Budget; label: string; hint: string }[] = [
  { key: 'low', label: '£', hint: 'Coffee, a walk, something free' },
  { key: 'mid', label: '££', hint: 'Drinks or a casual dinner' },
  { key: 'high', label: '£££', hint: 'A proper night out' },
];

export interface BlindSignup {
  id: string;
  status: BlindStatus;
  areas: string[];
  dateStyles: string[];
  budget: Budget;
  availableFrom: string;
  availableTo: string;
  timeBands: string[];
  dietary?: string;
  accessibility?: string;
  matchedDateId?: string;
  createdAt: string;
  matchedAt?: string;
}

function rowToSignup(r: any): BlindSignup {
  return {
    id: r.id,
    status: r.status,
    areas: r.areas ?? [],
    dateStyles: r.date_styles ?? [],
    budget: r.budget ?? 'mid',
    availableFrom: r.available_from,
    availableTo: r.available_to,
    timeBands: r.time_bands ?? [],
    dietary: r.dietary ?? undefined,
    accessibility: r.accessibility ?? undefined,
    matchedDateId: r.matched_date_id ?? undefined,
    createdAt: r.created_at,
    matchedAt: r.matched_at ?? undefined,
  };
}

/**
 * My current signup, if any. Returns the waiting one in preference to a
 * historical matched/cancelled one.
 */
export async function fetchMyBlindSignup(): Promise<BlindSignup | null> {
  if (!supabaseEnabled) return null;
  const uid = await getSessionUserId();
  if (!uid) return null;

  const { data, error } = await getSupabase()
    .from('blind_date_signups')
    .select('*')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
    .limit(5);
  if (error) throw error;

  const rows = (data ?? []).map(rowToSignup);
  return rows.find((r) => r.status === 'waiting')
    ?? rows.find((r) => r.status === 'matched')
    ?? null;
}

export interface JoinBlindInput {
  areas: string[];
  dateStyles: string[];
  budget: Budget;
  availableFrom: string; // YYYY-MM-DD
  availableTo: string;   // YYYY-MM-DD
  timeBands: string[];
  dietary?: string;
  accessibility?: string;
}

/**
 * Join the pool. A partial unique index enforces one waiting signup per
 * person, so a double-tap surfaces as a friendly error rather than a
 * duplicate row.
 */
export async function joinBlindPool(input: JoinBlindInput): Promise<BlindSignup> {
  const uid = await getSessionUserId();
  if (!uid) throw new Error('You need to be signed in to join');
  if (input.areas.length === 0) throw new Error('Pick at least one area');
  if (input.timeBands.length === 0) throw new Error('Pick when you\'re free');

  const { data, error } = await getSupabase()
    .from('blind_date_signups')
    .insert({
      user_id: uid,
      areas: input.areas,
      date_styles: input.dateStyles,
      budget: input.budget,
      available_from: input.availableFrom,
      available_to: input.availableTo,
      time_bands: input.timeBands,
      dietary: input.dietary?.trim() || null,
      accessibility: input.accessibility?.trim() || null,
    })
    .select('*')
    .single();

  if (error) {
    if ((error as any).code === '23505') {
      throw new Error('You\'re already in the blind date pool.');
    }
    throw error;
  }
  return rowToSignup(data);
}

/** Leave the pool. Only meaningful while still waiting. */
export async function leaveBlindPool(signupId: string): Promise<void> {
  const uid = await getSessionUserId();
  if (!uid) throw new Error('You need to be signed in');
  const { error } = await getSupabase()
    .from('blind_date_signups')
    .update({ status: 'cancelled' })
    .eq('id', signupId)
    .eq('user_id', uid)
    .eq('status', 'waiting');
  if (error) throw error;
}

/**
 * How many other people are waiting. Bucketed, never exact at low numbers —
 * "3 people waiting" in a new market reads as failure.
 */
export async function fetchPoolSize(): Promise<{ bucket: string; enough: boolean }> {
  if (!supabaseEnabled) return { bucket: 'a few', enough: false };
  const { count, error } = await getSupabase()
    .from('blind_date_signups')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'waiting');
  if (error) return { bucket: 'a few', enough: false };

  const n = count ?? 0;
  if (n < 10) return { bucket: 'a few', enough: n >= 2 };
  if (n < 30) return { bucket: 'a dozen or so', enough: true };
  if (n < 100) return { bucket: 'dozens of', enough: true };
  return { bucket: 'hundreds of', enough: true };
}
