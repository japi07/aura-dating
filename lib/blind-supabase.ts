/**
 * Blind dates — you join a pool, we pair you, the concierge plans the date.
 * You never choose the person, and as of 0014 you do not choose anything else
 * either: one button, and we work out the rest.
 *
 * Deliberately reuses public.dates: a match creates a normal date row with
 * mode='blind' and status='planning', so the Dates tab, reminders, ratings
 * and the post-date follow-up all work unchanged.
 *
 * The preference columns still exist and are still read by the concierge
 * console. They are simply never written by the app now. That is a deliberate
 * pause rather than a deletion — filtering helps once a pool is big enough to
 * afford it, and hurts badly before then.
 */
import { getSupabase, supabaseEnabled } from './supabase';
import { getSessionUserId } from './proposals-supabase';

export type BlindStatus = 'waiting' | 'matched' | 'cancelled' | 'expired';

export interface BlindSignup {
  id: string;
  status: BlindStatus;
  matchedDateId?: string;
  createdAt: string;
  matchedAt?: string;
}

function rowToSignup(r: any): BlindSignup {
  return {
    id: r.id,
    status: r.status,
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
    .select('id, status, matched_date_id, created_at, matched_at')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
    .limit(5);
  if (error) throw error;

  const rows = (data ?? []).map(rowToSignup);
  return rows.find((r) => r.status === 'waiting')
    ?? rows.find((r) => r.status === 'matched')
    ?? null;
}

/**
 * Join the pool. Idempotent server-side, so a second tap returns the signup
 * you already have rather than an error about duplicates.
 */
export async function joinBlindPool(): Promise<BlindSignup> {
  const uid = await getSessionUserId();
  if (!uid) throw new Error('You need to be signed in to join');

  const { data: id, error } = await getSupabase().rpc('join_blind_pool');
  if (error) throw error;

  const { data } = await getSupabase()
    .from('blind_date_signups')
    .select('id, status, matched_date_id, created_at, matched_at')
    .eq('id', id as string)
    .maybeSingle();

  return data
    ? rowToSignup(data)
    : { id: id as string, status: 'waiting', createdAt: new Date().toISOString() };
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
 * How many people are waiting. Bucketed, never exact at low numbers — "3
 * people waiting" in a new market reads as failure.
 *
 * Goes through an RPC because the table is own-rows-only under RLS; counting
 * it directly would only ever return the caller.
 */
export async function fetchPoolSize(): Promise<{ bucket: string; enough: boolean }> {
  if (!supabaseEnabled) return { bucket: 'a few', enough: false };
  const { data, error } = await getSupabase().rpc('blind_pool_size');
  if (error) return { bucket: 'a few', enough: false };

  const n = (data as number | null) ?? 0;
  if (n < 10) return { bucket: 'a few', enough: n >= 2 };
  if (n < 30) return { bucket: 'a dozen or so', enough: true };
  if (n < 100) return { bucket: 'dozens of', enough: true };
  return { bucket: 'hundreds of', enough: true };
}
