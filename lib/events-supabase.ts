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
