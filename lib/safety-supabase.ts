/**
 * Reporting, blocking, text screening, terms and account state.
 *
 * Every decision that matters is made by the database (migration 0026): who
 * the "other person" is, whether they are hidden from you, whether a word is
 * allowed, whether an account is suspended. This file only asks. That is what
 * lets a call be reported without the app ever learning who was on the line:
 * it sends the call id, and the server works out the rest.
 */
import { getSupabase, supabaseEnabled } from './supabase';

/** Where members reach a human. Shown next to every report and block. */
export const SUPPORT_EMAIL = 'azpiazujavier@gmail.com';

/** Bump when the terms change materially; everyone is asked to agree again. */
export const TERMS_VERSION = '2026-09-21';
export const TERMS_URL = 'https://japi07.github.io/aura-dating/legal/terms.html';

export const REPORT_REASONS = [
  'Harassment or abuse',
  'Sexual or inappropriate content',
  'Hate speech or discrimination',
  'Threats or safety concern',
  'Fake profile or scam',
  'May be under 18',
  'Something else',
] as const;

/**
 * Whatever the member is looking at. Exactly one of the ids is used, in this
 * order: call, date, proposal, user.
 */
export interface SafetyTarget {
  /** What to call them in the sheet. A first name is enough. */
  name: string;
  userId?: string;
  callId?: string;
  dateId?: string;
  proposalId?: string;
}

function targetArgs(t: SafetyTarget) {
  return {
    p_user: t.userId ?? null,
    p_call: t.callId ?? null,
    p_date: t.dateId ?? null,
    p_proposal: t.proposalId ?? null,
  };
}

/** Report someone. Also blocks them, which removes them from every list at once. */
export async function reportMember(t: SafetyTarget, reason: string, details?: string): Promise<void> {
  const { error } = await getSupabase().rpc('safety_report', {
    p_reason: reason,
    p_details: details?.trim() || null,
    ...targetArgs(t),
    p_block: true,
  });
  if (error) throw new Error(friendlyError(error));

  // Wake whoever is on moderation duty. Best effort: the report is already
  // filed, and the queue is the record, not the push.
  getSupabase().functions.invoke('notify', { body: { event: 'report' } }).catch(() => {});
}

export async function blockMember(t: SafetyTarget): Promise<void> {
  const { error } = await getSupabase().rpc('safety_block', {
    ...targetArgs(t),
    p_reason: 'Blocked',
  });
  if (error) throw new Error(friendlyError(error));
}

export interface BlockedMember {
  /** The block itself. Unblocking goes by this, never by the person's id. */
  id: string;
  /** Absent when the block was made from a call or blind date. */
  blockedId?: string;
  anonymous: boolean;
  name: string;
  age?: number;
  photoUrl?: string;
  reason?: string;
  createdAt: string;
}

export async function fetchMyBlocks(): Promise<BlockedMember[]> {
  if (!supabaseEnabled) return [];
  const { data, error } = await getSupabase().rpc('my_blocks');
  if (error) throw error;
  return ((data as any[]) ?? []).map((r) => ({
    id: r.id,
    blockedId: r.blocked_id ?? undefined,
    anonymous: !!r.anonymous,
    name: r.name ?? 'Member',
    age: r.age ?? undefined,
    photoUrl: r.photo_url ?? undefined,
    reason: r.reason ?? undefined,
    createdAt: r.created_at,
  }));
}

export async function unblock(blockId: string): Promise<void> {
  const { error } = await getSupabase().from('blocks').delete().eq('id', blockId);
  if (error) throw error;
}

/* ─── account state ─── */

export interface SafetyState {
  termsAcceptedAt: string | null;
  termsVersion: string | null;
  bannedAt: string | null;
}

/** null when there is no profile row yet (a sign-up still settling). */
export async function fetchMySafetyState(): Promise<SafetyState | null> {
  const { data, error } = await getSupabase().rpc('my_safety_state');
  if (error) throw error;
  if (!data) return null;
  const d = data as any;
  return {
    termsAcceptedAt: d.terms_accepted_at ?? null,
    termsVersion: d.terms_version ?? null,
    bannedAt: d.banned_at ?? null,
  };
}

export function termsCurrent(s: SafetyState | null): boolean {
  return !!s?.termsAcceptedAt && s.termsVersion === TERMS_VERSION;
}

export async function acceptTerms(): Promise<SafetyState | null> {
  const { error } = await getSupabase().rpc('accept_terms', {
    p_version: TERMS_VERSION,
    p_confirm_adult: true,
  });
  if (error) throw new Error(friendlyError(error));
  return fetchMySafetyState();
}

/* ─── text screening ─── */

export const TEXT_REJECTED_MESSAGE =
  "That wording isn't allowed on Aura. Please keep it respectful. Harassment, hate and explicit content are removed.";

/**
 * Screen text before it is sent. Fails open on network or provider errors:
 * the database still refuses the worst of it whatever happens here.
 */
export async function assertCleanText(...texts: (string | undefined | null)[]): Promise<void> {
  const text = texts.filter((t) => t && t.trim()).join('\n');
  if (!text || !supabaseEnabled) return;
  try {
    const { data, error } = await getSupabase().functions.invoke('moderate-image', { body: { text } });
    if (error) return;
    if (data?.flagged) throw new Error(TEXT_REJECTED_MESSAGE);
  } catch (e: any) {
    if (e?.message === TEXT_REJECTED_MESSAGE) throw e;
    // Anything else is the screen being unavailable, not the text being bad.
  }
}

/**
 * The database marks its own refusals with a hint, so the app can say
 * something useful rather than a Postgres message.
 */
export function friendlyError(e: any): string {
  const hint = e?.hint ?? '';
  if (hint === 'objectionable_text') return TEXT_REJECTED_MESSAGE;
  if (hint === 'account_suspended') return `This account has been suspended. Contact ${SUPPORT_EMAIL} if you think this is a mistake.`;
  return e?.message || 'Something went wrong. Please try again.';
}

/* ─── moderation (admins only; the server refuses everyone else) ─── */

export interface ReportRow {
  id: string;
  createdAt: string;
  status: string;
  reason: string;
  details?: string;
  reviewedAt?: string;
  actionNote?: string;
  context: 'call' | 'date' | 'proposal' | 'profile';
  reporter: { id: string; name: string; email: string };
  reported: {
    id: string; name: string; email: string; bio?: string; photoUrl?: string;
    bannedAt?: string; openReports: number;
  };
}

export async function fetchReports(status: 'open' | 'actioned' | 'dismissed' = 'open'): Promise<ReportRow[]> {
  const { data, error } = await getSupabase().rpc('admin_reports', { p_status: status });
  if (error) throw error;
  return ((data as any[]) ?? []).map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    status: r.status,
    reason: r.reason,
    details: r.details ?? undefined,
    reviewedAt: r.reviewed_at ?? undefined,
    actionNote: r.action_note ?? undefined,
    context: r.related_call_id ? 'call' : r.related_date_id ? 'date' : r.related_proposal_id ? 'proposal' : 'profile',
    reporter: { id: r.reporter.id, name: r.reporter.name, email: r.reporter.email },
    reported: {
      id: r.reported.id,
      name: r.reported.name,
      email: r.reported.email,
      bio: r.reported.bio ?? undefined,
      photoUrl: r.reported.photo_url ?? undefined,
      bannedAt: r.reported.banned_at ?? undefined,
      openReports: Number(r.reported.open_reports ?? 0),
    },
  }));
}

export async function resolveReport(reportId: string, action: 'ban' | 'dismiss', note?: string): Promise<void> {
  const { error } = await getSupabase().rpc('admin_resolve_report', {
    p_report: reportId,
    p_action: action,
    p_note: note?.trim() || null,
  });
  if (error) throw error;
}

/* ─── reporting from Profile > Safety, with nothing on screen ─── */

export interface RecentContact {
  kind: 'call' | 'date' | 'proposal';
  id: string;
  /** First name only. A call never reveals more than that. */
  name: string;
  detail: string;
  at: string;
}

/** Everyone you've dealt with lately, newest first, minus anyone already hidden. */
export async function fetchRecentContacts(): Promise<RecentContact[]> {
  if (!supabaseEnabled) return [];
  const { data, error } = await getSupabase().rpc('my_recent_contacts');
  if (error) throw error;
  return ((data as any[]) ?? []).map((r) => ({
    kind: r.kind, id: r.id, name: r.name, detail: r.detail, at: r.at,
  }));
}

export function contactTarget(c: RecentContact): SafetyTarget {
  if (c.kind === 'call') return { name: c.name, callId: c.id };
  if (c.kind === 'date') return { name: c.name, dateId: c.id };
  return { name: c.name, proposalId: c.id };
}

/* ─── removing what you posted ─── */

export async function deleteMyMessage(messageId: string): Promise<void> {
  const { error } = await getSupabase().from('proposal_messages').delete().eq('id', messageId);
  if (error) throw error;
}

export async function withdrawProposal(proposalId: string): Promise<void> {
  const { error } = await getSupabase().rpc('withdraw_proposal', { p_proposal: proposalId });
  if (error) throw new Error(friendlyError(error));
}

/** A stable identity for a target, so a sheet resets only when the person changes. */
export function targetKey(t: SafetyTarget | null): string {
  if (!t) return '';
  return t.callId ? `call:${t.callId}`
    : t.dateId ? `date:${t.dateId}`
    : t.proposalId ? `proposal:${t.proposalId}`
    : t.userId ? `user:${t.userId}` : '';
}
