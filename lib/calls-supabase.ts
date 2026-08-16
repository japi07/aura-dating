/**
 * Call dates data layer.
 *
 * The privacy promise on the call screen — "if they don't feel the same, they
 * never find out you said yes" — is enforced in the database, not here.
 * Migration 0013 revokes UPDATE on public.calls and revokes SELECT on the two
 * answer columns, so everything below goes through SECURITY DEFINER functions
 * that work out which column belongs to the caller from their JWT. There is no
 * client-side path to the other person's answer, deliberately.
 */
import { getSupabase, supabaseEnabled } from './supabase';
import { getSessionUserId } from './proposals-supabase';

export type CallMedium = 'audio' | 'video';

export interface CallState {
  id: string;
  status: 'ringing' | 'active' | 'ended' | 'missed' | 'failed';
  medium: CallMedium;
  roomUrl: string | null;
  roomName: string | null;
  startedAt: string | null;
  expiresAt: string | null;
  /** First name only — you are meant to hear a voice, not read a profile */
  otherName: string;
  /** Your own answer. Never theirs. */
  myAnswer: boolean | null;
  /** Only ever set once you have said yes yourself */
  resultingDateId: string | null;
}

export interface CallCredentials {
  token: string;
  roomUrl: string;
  medium: CallMedium;
  expiresAt: string;
}

/* ─── the queue ─── */

/**
 * Join the queue and immediately try to match. The two are one action on
 * purpose: with no scheduler in this project, somebody being present is the
 * only thing that can drive matching, so whoever arrives second is the one
 * whose request actually finds a partner.
 *
 * Returns a call id if that happened to be you.
 */
export async function joinCallQueue(
  medium: CallMedium = 'audio',
  topics: string[] = [],
): Promise<{ callId: string | null }> {
  if (!supabaseEnabled) throw new Error('Not connected');
  const uid = await getSessionUserId();
  if (!uid) throw new Error('Please sign in again');

  const sb = getSupabase();

  // A partial unique index allows exactly one waiting row per person, so an
  // enthusiastic double tap is a no-op rather than an error.
  const { error } = await sb
    .from('call_queue')
    .insert({ user_id: uid, medium, topics, status: 'waiting' });
  if (error && error.code !== '23505') throw error;

  return { callId: await runCallMatcher() };
}

export async function leaveCallQueue(): Promise<void> {
  if (!supabaseEnabled) return;
  const uid = await getSessionUserId();
  if (!uid) return;
  await getSupabase()
    .from('call_queue')
    .update({ status: 'left' })
    .eq('user_id', uid)
    .eq('status', 'waiting');
}

/**
 * How many people are waiting right now.
 *
 * Goes through an RPC rather than a count on the table: call_queue is
 * own-rows-only under RLS, so counting it directly would only ever return
 * yourself.
 */
export async function fetchQueueSize(): Promise<number> {
  if (!supabaseEnabled) return 0;
  const { data, error } = await getSupabase().rpc('call_queue_size');
  if (error) return 0;
  return (data as number | null) ?? 0;
}

/**
 * Ask the server to try pairing. Safe to call repeatedly — it is a no-op
 * unless the caller is waiting and somebody compatible is too.
 */
export async function runCallMatcher(): Promise<string | null> {
  try {
    const { data, error } = await getSupabase().functions.invoke('call-match', { body: {} });
    if (error) return null;
    return data?.matched ? (data.callId ?? null) : null;
  } catch {
    // A failed match attempt is not worth interrupting the wait for
    return null;
  }
}

/* ─── an individual call ─── */

/** The id of whatever live call I am in, if any. Used to resume after a crash. */
export async function fetchMyActiveCallId(): Promise<string | null> {
  if (!supabaseEnabled) return null;
  const { data, error } = await getSupabase().rpc('my_active_call');
  if (error) return null;
  return (data as string | null) ?? null;
}

export async function fetchCallState(callId: string): Promise<CallState | null> {
  if (!supabaseEnabled) return null;
  const { data, error } = await getSupabase().rpc('call_my_state', { p_call_id: callId });
  if (error) throw error;

  const r = Array.isArray(data) ? data[0] : data;
  if (!r) return null;

  return {
    id: r.id,
    status: r.status,
    medium: r.medium,
    roomUrl: r.room_url ?? null,
    roomName: r.room_name ?? null,
    startedAt: r.started_at ?? null,
    expiresAt: r.expires_at ?? null,
    otherName: r.other_name ?? 'Someone',
    myAnswer: r.my_answer ?? null,
    resultingDateId: r.resulting_date_id ?? null,
  };
}

/**
 * Mint this device's way into the room. Never cached — the token is a bearer
 * credential that expires with the call.
 */
export async function fetchCallCredentials(callId: string): Promise<CallCredentials> {
  const { data, error } = await getSupabase().functions.invoke('call-token', {
    body: { callId },
  });
  if (error) throw new Error(await readableError(error, data));
  if (!data?.token) throw new Error(data?.error || 'Could not join the call');
  return {
    token: data.token,
    roomUrl: data.roomUrl,
    medium: data.medium ?? 'audio',
    expiresAt: data.expiresAt,
  };
}

export async function markCallStarted(callId: string): Promise<void> {
  try { await getSupabase().rpc('call_mark_started', { p_call_id: callId }); } catch { /* best effort */ }
}

export async function markCallEnded(callId: string): Promise<void> {
  try { await getSupabase().rpc('call_mark_ended', { p_call_id: callId }); } catch { /* best effort */ }
}

/**
 * Record whether you'd like to meet. Returns a date id only when you said yes
 * AND so did they — so a null return is genuinely ambiguous from your side,
 * which is the point.
 */
export async function submitCallOutcome(
  callId: string,
  wantsToMeet: boolean,
): Promise<string | null> {
  const { data, error } = await getSupabase().rpc('call_submit_outcome', {
    p_call_id: callId,
    p_wants: wantsToMeet,
  });
  if (error) throw error;
  return (data as string | null) ?? null;
}

/** Clean up rooms and queue rows nobody closed. There is no scheduler. */
export async function expireStaleCalls(): Promise<void> {
  try { await getSupabase().rpc('expire_stale_calls'); } catch { /* best effort */ }
}

/** Seconds left on the shared clock, floored at zero. */
export function secondsRemaining(expiresAt?: string | null): number {
  if (!expiresAt) return 0;
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

export function formatRemaining(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Edge Function errors arrive as a generic "non-2xx status code" with data
 * set to null, so the message the function actually returned is only
 * reachable through the Response hanging off error.context.
 */
async function readableError(error: any, data: any): Promise<string> {
  if (data?.error) return data.error;
  try {
    const body = await error?.context?.json?.();
    if (body?.error) return body.error;
  } catch {
    // not JSON, or the body was already consumed
  }
  return error?.message || 'Could not join the call';
}
