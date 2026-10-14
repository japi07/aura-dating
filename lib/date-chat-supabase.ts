/**
 * The pre-date chat: plain text between the two people on a date.
 *
 * It opens eight hours before the date and closes three hours after it starts
 * (the server owns that window: see date_chat_window() in migration 0030).
 * Outside it the history is still readable, but nothing can be sent.
 */
import { getSupabase, supabaseEnabled } from './supabase';
import { assertCleanText, friendlyError } from './safety-supabase';

/** Mirrors date_chat_window() so cards can say "opens at 11:30" offline. */
export const CHAT_OPENS_HOURS_BEFORE = 8;
export const CHAT_CLOSES_HOURS_AFTER = 3;

export interface DateChatMessage {
  id: string;
  body: string;
  createdAt: string;
  mine: boolean;
}

export interface DateChatState {
  startsAt: string | null;
  opensAt: string | null;
  closesAt: string | null;
  open: boolean;
}

/** When the chat for a date starting at `startsAt` opens and closes. */
export function chatWindow(startsAt: string | null | undefined) {
  if (!startsAt) return null;
  const t = new Date(startsAt).getTime();
  if (isNaN(t)) return null;
  return {
    opensAt: new Date(t - CHAT_OPENS_HOURS_BEFORE * 3600_000),
    closesAt: new Date(t + CHAT_CLOSES_HOURS_AFTER * 3600_000),
  };
}

/** Where a date's chat stands right now, by the device clock. */
export function chatPhase(startsAt: string | null | undefined, now = Date.now()): 'none' | 'soon' | 'open' | 'closed' {
  const w = chatWindow(startsAt);
  if (!w) return 'none';
  if (now < w.opensAt.getTime()) return 'soon';
  if (now > w.closesAt.getTime()) return 'closed';
  return 'open';
}

/** Null when I'm not on this date (or it's hidden from me). */
export async function fetchDateChatState(dateId: string): Promise<DateChatState | null> {
  if (!supabaseEnabled) return null;
  const { data, error } = await getSupabase().rpc('date_chat_state', { p_date_id: dateId });
  if (error) throw error;
  if (!data) return null;
  return {
    startsAt: data.starts_at ?? null,
    opensAt: data.opens_at ?? null,
    closesAt: data.closes_at ?? null,
    open: !!data.open,
  };
}

export async function fetchDateMessages(dateId: string, me: string): Promise<DateChatMessage[]> {
  if (!supabaseEnabled) return [];
  const { data, error } = await getSupabase()
    .from('date_messages')
    .select('id, sender_id, body, created_at')
    .eq('date_id', dateId)
    .order('created_at', { ascending: true })
    .limit(500);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    body: r.body,
    createdAt: r.created_at,
    mine: r.sender_id === me,
  }));
}

export async function sendDateMessage(dateId: string, me: string, body: string): Promise<DateChatMessage> {
  const text = body.trim();
  if (!text) throw new Error('Write something first.');
  await assertCleanText(text);
  const { data, error } = await getSupabase()
    .from('date_messages')
    .insert({ date_id: dateId, sender_id: me, body: text })
    .select('id, body, created_at')
    .single();
  if (error) {
    // RLS refuses the insert once the window has closed (or before it opens).
    if ((error as any).code === '42501') throw new Error('This chat is closed.');
    throw new Error(friendlyError(error));
  }
  // Tell them. Best effort: the message is sent either way.
  getSupabase().functions.invoke('notify', { body: { event: 'date_message', dateId } }).catch(() => {});
  return { id: data.id, body: data.body, createdAt: data.created_at, mine: true };
}

export async function deleteDateMessage(id: string): Promise<void> {
  const { error } = await getSupabase().from('date_messages').delete().eq('id', id);
  if (error) throw new Error(friendlyError(error));
}
