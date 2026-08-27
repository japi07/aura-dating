/**
 * Concierge / ops data layer.
 *
 * Planning a date means reading two different people's constraints and writing
 * to a row neither of them owns, which RLS deliberately forbids. Rather than a
 * separate service-role tool, this goes through SECURITY DEFINER functions
 * guarded by profiles.is_admin, so the console can live inside the app the
 * founder already carries.
 */
import { getSupabase, supabaseEnabled } from './supabase';
import { getSessionUserId } from './proposals-supabase';

export interface PlanningDate {
  dateId: string;
  mode: 'proposal' | 'blind' | 'call' | 'event';
  status: string;
  createdAt: string;
  startsAt: string | null;
  venueName: string | null;
  a: { id: string; name: string; photoUrl?: string };
  b: { id: string; name: string; photoUrl?: string };
  /** Merged constraints from both signups — ops must satisfy both */
  areas: string[];
  dateStyles: string[];
  budget: string | null;
  availableFrom: string | null;
  availableTo: string | null;
  timeBands: string[];
  dietary?: string;
  accessibility?: string;
  /** Instants BOTH people said they are free. Book inside these. */
  agreedSlots: string[];
  aSubmitted: boolean;
  bSubmitted: boolean;
}

/** Whether the signed-in user is an ops admin. False on any error. */
export async function amIAdmin(): Promise<boolean> {
  if (!supabaseEnabled) return false;
  try {
    const uid = await getSessionUserId();
    if (!uid) return false;
    const { data, error } = await getSupabase()
      .from('profiles')
      .select('is_admin')
      .eq('id', uid)
      .maybeSingle();
    if (error) return false;
    return !!data?.is_admin;
  } catch {
    return false;
  }
}

/** Every date waiting to be planned, oldest first. Empty for non-admins. */
export async function fetchPlanningQueue(): Promise<PlanningDate[]> {
  if (!supabaseEnabled) return [];
  const { data, error } = await getSupabase().rpc('ops_planning_queue');
  if (error) throw error;

  return (data ?? []).map((r: any) => ({
    dateId: r.date_id,
    mode: r.mode,
    status: r.status,
    createdAt: r.created_at,
    startsAt: r.starts_at ?? null,
    venueName: r.venue_name ?? null,
    a: { id: r.a_id, name: r.a_name, photoUrl: r.a_photo ?? undefined },
    b: { id: r.b_id, name: r.b_name, photoUrl: r.b_photo ?? undefined },
    // The SQL concatenates both people's arrays; dedupe for display
    areas: Array.from(new Set(r.areas ?? [])) as string[],
    dateStyles: Array.from(new Set(r.date_styles ?? [])) as string[],
    budget: r.budget ?? null,
    availableFrom: r.available_from ?? null,
    availableTo: r.available_to ?? null,
    timeBands: Array.from(new Set(r.time_bands ?? [])) as string[],
    dietary: r.dietary ?? undefined,
    accessibility: r.accessibility ?? undefined,
    agreedSlots: r.agreed_slots ?? [],
    aSubmitted: !!r.a_submitted,
    bSubmitted: !!r.b_submitted,
  }));
}

export interface ConfirmDateInput {
  dateId: string;
  startsAt: string; // ISO
  venue: string;
  address?: string;
  postcode?: string;
  lat?: number;
  lng?: number;
}

/**
 * Set the venue and time and flip the date to 'upcoming' in one call, so a
 * half-planned date can never surface on a member's Dates tab.
 */
export async function confirmPlannedDate(input: ConfirmDateInput): Promise<void> {
  const { error } = await getSupabase().rpc('ops_confirm_date', {
    p_date_id: input.dateId,
    p_starts_at: input.startsAt,
    p_venue: input.venue,
    p_address: input.address ?? null,
    p_postcode: input.postcode ?? null,
    p_lat: input.lat ?? null,
    p_lng: input.lng ?? null,
  });
  if (error) throw error;
}

/** Trigger the blind-date matcher. Ops-only; there is no scheduler. */
export async function runBlindMatcher(): Promise<{ matched: number }> {
  const { data, error } = await getSupabase().functions.invoke('blind-match', {
    body: {},
  });
  if (error) throw error;
  return { matched: data?.matched ?? 0 };
}
