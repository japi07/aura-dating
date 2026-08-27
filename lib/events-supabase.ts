/**
 * Supabase data layer for curated events + RSVPs.
 * Events are read-only for members (ops adds them in the dashboard); members
 * manage their own RSVPs, and reserved_count is kept in sync by a DB trigger.
 */
import { getSupabase, supabaseEnabled } from './supabase';
import { getSessionUserId } from './proposals-supabase';

export interface AppEvent {
  id: string;
  title: string;
  date: string; // ISO
  venue: string;
  area: string;
  address: string;
  postcode: string;
  tube: string;
  type: 'Social' | 'Activity' | 'Culture' | 'Dinner' | 'Workshop';
  spotsAvailable: number;
  totalSpots: number;
  emoji: string;
  price: string;
  description: string;
  featured?: boolean;
  lat: number;
  lng: number;
  /** Ticket Tailor event id — enables live availability + in-app checkout */
  ticketTailorEventId?: string;
  /** Hosted checkout URL from Ticket Tailor for this event */
  ticketCheckoutUrl?: string;
  /** Third-party booking URL (Viator, DesignMyNight, Fever…) */
  bookingUrl?: string;
  /** Which partner the booking URL belongs to */
  bookingPartner?: string;
}

function rowToEvent(r: any): AppEvent {
  const total = r.total_spots ?? 0;
  const reserved = r.reserved_count ?? 0;
  return {
    id: r.id,
    title: r.title,
    date: r.date,
    venue: r.venue,
    area: r.area ?? '',
    address: r.address ?? '',
    postcode: r.postcode ?? '',
    tube: r.tube ?? '',
    type: (r.type ?? 'Social') as AppEvent['type'],
    spotsAvailable: Math.max(total - reserved, 0),
    totalSpots: total,
    emoji: r.emoji ?? '🎉',
    price: r.price ?? 'Free',
    description: r.description ?? '',
    featured: !!r.featured,
    lat: r.lat ?? 51.5074,
    lng: r.lng ?? -0.1278,
    ticketTailorEventId: r.tickettailor_event_id ?? undefined,
    ticketCheckoutUrl: r.ticket_checkout_url ?? undefined,
    bookingUrl: r.booking_url ?? undefined,
    bookingPartner: r.booking_partner ?? undefined,
  };
}

/** Upcoming events, soonest first. Returns [] when offline / not configured. */
export async function fetchEvents(): Promise<AppEvent[]> {
  if (!supabaseEnabled) return [];
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .gte('date', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()) // include events starting in the last 6h
    .order('date', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToEvent);
}

/** Event ids the current user has reserved. */
export async function fetchMyEventRsvps(): Promise<string[]> {
  if (!supabaseEnabled) return [];
  const supabase = getSupabase();
  const uid = await getSessionUserId();
  if (!uid) return [];
  const { data, error } = await supabase.from('event_rsvps').select('event_id').eq('user_id', uid);
  if (error) throw error;
  return (data ?? []).map((r: any) => r.event_id);
}

export async function rsvpToEvent(eventId: string): Promise<void> {
  const supabase = getSupabase();
  const uid = await getSessionUserId();
  if (!uid) throw new Error('Please sign in to reserve a spot');
  const { error } = await supabase
    .from('event_rsvps')
    .upsert({ event_id: eventId, user_id: uid }, { onConflict: 'event_id,user_id' });
  if (error) throw error;
}

export async function cancelEventRsvp(eventId: string): Promise<void> {
  const supabase = getSupabase();
  const uid = await getSessionUserId();
  if (!uid) throw new Error('Please sign in');
  const { error } = await supabase.from('event_rsvps').delete().eq('event_id', eventId).eq('user_id', uid);
  if (error) throw error;
}

/* ─── who else is going ─── */

export interface EventMatchCount {
  /** Other attendees who pass the same test the matchers apply */
  matching: number;
  /** How many of those have said they are open to an introduction */
  open: number;
}

/**
 * How many people worth meeting are at each upcoming event.
 *
 * One call for the whole list rather than one per card — the Events tab
 * renders a dozen of these and a round trip each would be visible.
 *
 * Counts only. event_rsvps is own-rows-only under RLS, so this crosses that
 * boundary through a SECURITY DEFINER function that returns integers and
 * never an identity: "4 members matching your criteria are attending" is a
 * reason to buy a ticket, "Sarah is attending" is a privacy incident.
 */
export async function fetchEventMatchCounts(): Promise<Record<string, EventMatchCount>> {
  if (!supabaseEnabled) return {};
  try {
    const { data, error } = await getSupabase().rpc('event_match_counts');
    if (error) return {};
    const out: Record<string, EventMatchCount> = {};
    for (const r of (data ?? []) as any[]) {
      out[r.event_id] = { matching: r.match_count ?? 0, open: r.open_count ?? 0 };
    }
    return out;
  } catch {
    return {};
  }
}

/** Full RSVP rows for the current user, including the introductions choice. */
export async function fetchMyEventRsvpDetails(): Promise<
  Record<string, { openToIntros: boolean }>
> {
  if (!supabaseEnabled) return {};
  const uid = await getSessionUserId();
  if (!uid) return {};
  const { data, error } = await getSupabase()
    .from('event_rsvps')
    .select('event_id, open_to_intros')
    .eq('user_id', uid);
  if (error) return {};
  const out: Record<string, { openToIntros: boolean }> = {};
  for (const r of (data ?? []) as any[]) {
    out[r.event_id] = { openToIntros: !!r.open_to_intros };
  }
  return out;
}

/**
 * Say whether you would like to be introduced to matching people at an event.
 *
 * Defaults to off server-side and is asked explicitly after the RSVP: turning
 * up to an event is not consent to be introduced to strangers.
 */
export async function setEventIntroOptIn(eventId: string, open: boolean): Promise<void> {
  const { error } = await getSupabase().rpc('set_event_intro_opt_in', {
    p_event_id: eventId,
    p_open: open,
  });
  if (error) throw error;
}

/**
 * Pair up everyone at an event who opted in and matches.
 *
 * Double opt-in on both sides, and it produces ordinary date rows at the
 * event's own venue and time — so the Dates tab, reminders and the follow-up
 * all work with no special casing. Safe to call more than once; a pair that
 * already has a date is skipped.
 */
export async function makeEventIntros(eventId: string): Promise<number> {
  const { data, error } = await getSupabase().rpc('make_event_intros', {
    p_event_id: eventId,
  });
  if (error) throw error;
  return (data as number | null) ?? 0;
}
