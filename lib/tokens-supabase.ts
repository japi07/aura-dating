/**
 * Tokens — you buy your place in tonight's window.
 *
 * The balance lives in its own table rather than on the profile, and that is
 * deliberate: `profiles_update_own` lets a member write any column of their
 * own profile row, so a balance kept there would be mintable from the client
 * with nothing but the anon key. `token_accounts` grants SELECT to its owner
 * and revokes every write, which leaves the SECURITY DEFINER functions below
 * as the only way a number ever moves.
 *
 * Nothing here is trusted to be correct on its own. Every screen reads the
 * balance to decide what to *show*; the server decides what actually happens,
 * and answers NOT_ENOUGH_TOKENS if the two disagree.
 */
import { getSupabase, supabaseEnabled } from './supabase';

export type DateMode = 'call' | 'blind' | 'proposal';

export interface WindowEntry {
  id: string;
  status: 'queued' | 'used';
  tokensPaid: number;
}

export interface TokenState {
  balance: number;
  /** The night these entries belong to, as YYYY-MM-DD in London */
  windowDate: string;
  prices: Record<DateMode, number>;
  /** What you have already paid for tonight, by mode */
  entries: Partial<Record<DateMode, WindowEntry>>;
}

const EMPTY: TokenState = {
  balance: 0,
  windowDate: '',
  prices: { call: 1, blind: 1, proposal: 1 },
  entries: {},
};

/** Human labels, kept next to the modes so copy stays consistent. */
export const MODE_LABEL: Record<DateMode, string> = {
  call: 'Call first',
  blind: 'Blind date',
  proposal: 'Curated date',
};

export const MODE_BLURB: Record<DateMode, string> = {
  call: 'A short live call with someone new, tonight.',
  blind: 'We pair you, pick the place, and book the table.',
  proposal: 'Choose someone and plan a real evening for them.',
};

export const MODE_EMOJI: Record<DateMode, string> = {
  call: '🎙️',
  blind: '🎭',
  proposal: '💌',
};

/**
 * Opens the account and pays in the trial tokens on first ever launch, then
 * tops up the monthly allowance if the tier earns one. Both are idempotent
 * server-side, so calling this on every launch is the intended usage.
 */
export async function initTokens(): Promise<number> {
  if (!supabaseEnabled) return 0;

  // Sweeping stale entries and claiming the monthly allowance are both
  // best-effort: worth doing on launch, never worth blocking on.
  //
  // The trial grant used to live here too, and that was the bug. On a new
  // account this can run while the session is still settling, auth.uid() is
  // null, the function raises, and a catch like this one turned a failed
  // request into a balance of zero that looked like a fact. A trigger on the
  // profile row grants it now, so this cannot cost anyone their first tokens.
  try {
    await getSupabase().rpc('ensure_token_account');
  } catch {
    // The account already exists, granted at signup.
  }

  try {
    const { data } = await getSupabase().rpc('claim_monthly_tokens');
    return (data as number | null) ?? 0;
  } catch {
    return 0;
  }
}

export async function fetchTokenState(): Promise<TokenState> {
  if (!supabaseEnabled) return EMPTY;
  const { data, error } = await getSupabase().rpc('token_state');
  if (error) throw error;

  const d = (data ?? {}) as any;
  return {
    balance: d.balance ?? 0,
    windowDate: d.windowDate ?? '',
    prices: { ...EMPTY.prices, ...(d.prices ?? {}) },
    entries: d.entries ?? {},
  };
}

export interface PurchaseResult {
  entryId: string;
  mode: DateMode;
  windowDate: string;
  status: 'queued' | 'used';
  tokensPaid: number;
  balance: number;
  /** True when you were already queued — a second tap, not a second charge */
  alreadyHad: boolean;
}

/** Raised when the wallet is empty, so callers can offer a top-up instead of an error. */
export class NotEnoughTokens extends Error {
  constructor() {
    super('Not enough tokens');
    this.name = 'NotEnoughTokens';
  }
}

export async function purchaseEntry(mode: DateMode): Promise<PurchaseResult> {
  const { data, error } = await getSupabase().rpc('purchase_window_entry', { p_mode: mode });
  if (error) {
    // The function raises a bare sentinel so this stays a normal, expected
    // branch rather than something that reads like a fault.
    if ((error.message || '').includes('NOT_ENOUGH_TOKENS')) throw new NotEnoughTokens();
    throw error;
  }
  return data as PurchaseResult;
}

/**
 * Give the ticket back — leaving the blind pool, or a call queue that found
 * nobody. Reports whether a token actually moved: a ticket already spent
 * refuses politely rather than erroring, and the caller must not tell
 * someone their token is back when it is not.
 */
export async function refundEntry(entryId: string): Promise<{ refunded: boolean; balance: number }> {
  const { data, error } = await getSupabase().rpc('refund_window_entry', { p_entry_id: entryId });
  if (error) throw error;
  const d = (data ?? {}) as any;
  return { refunded: !!d.refunded, balance: d.balance ?? 0 };
}

/** Mark tonight's ticket as spent, once the thing has actually happened. */
export async function consumeEntry(mode: DateMode): Promise<boolean> {
  try {
    const { data } = await getSupabase().rpc('consume_window_entry', { p_mode: mode });
    return !!data;
  } catch {
    return false;
  }
}

export interface LedgerRow {
  delta: number;
  reason: string;
  createdAt: string;
}

export async function fetchTokenHistory(limit = 40): Promise<LedgerRow[]> {
  if (!supabaseEnabled) return [];
  const { data, error } = await getSupabase().rpc('token_history', { p_limit: limit });
  if (error) return [];
  return (data ?? []).map((r: any) => ({
    delta: r.delta,
    reason: r.reason,
    createdAt: r.created_at,
  }));
}

/** "Blind date" / "Monthly top-up" — the ledger's raw reasons are not for reading. */
export function describeReason(reason: string): string {
  if (reason === 'signup_grant') return 'Welcome tokens';
  if (reason === 'monthly_grant') return 'Monthly top-up';
  if (reason.startsWith('spend_')) {
    return MODE_LABEL[reason.slice(6) as DateMode] ?? 'Entry';
  }
  if (reason === 'refund_unused') return 'Unused — refunded';
  if (reason.startsWith('refund_')) {
    return `Refund — ${MODE_LABEL[reason.slice(7) as DateMode] ?? 'entry'}`;
  }
  return reason;
}
