/**
 * Supabase data layer for proposals and dates.
 *
 * Maps between the app's local models (store/proposals.ts, store/dates.ts)
 * and the Postgres schema in supabase/schema.sql. All calls run under the
 * signed-in user's session, so RLS guarantees users only see their own rows.
 */
import { getSupabase, supabaseEnabled, BUCKETS } from './supabase';
import { uploadLocalFile, isLocalUri } from './storage-upload';
import type { Proposal } from '@/store/proposals';
import type { ConfirmedDate } from '@/store/dates';
import type { Venue } from '@/constants/london';

const PROFILE_COLS = 'id, email, name, age, city, bio, photo_url, verification_status';

/** The signed-in Supabase user id, or null when offline / not configured */
export async function getSessionUserId(): Promise<string | null> {
  if (!supabaseEnabled) return null;
  try {
    const { data } = await getSupabase().auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

/* ─── row mapping ─── */

type ProfileRow = {
  id: string; email: string; name: string; age: number | null; city: string | null;
  bio: string | null; photo_url: string | null; verification_status: string | null;
};

function rowToProposal(row: any): Proposal {
  const sender: Partial<ProfileRow> = row.sender ?? {};
  const recipient: Partial<ProfileRow> = row.recipient ?? {};
  const venue: Venue = {
    id: `srv_${row.id}`,
    name: row.venue_name,
    category: (row.date_type || 'dinner') as Venue['category'],
    emoji: row.venue_emoji || '📍',
    area: row.venue_area || '',
    address: row.venue_address || '',
    postcode: row.venue_postcode || '',
    tube: row.venue_tube || '',
    priceRange: '££',
    lat: row.venue_lat ?? 51.5072,
    lng: row.venue_lng ?? -0.1276,
  };
  return {
    id: row.id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    from: {
      id: sender.id ?? row.sender_id,
      name: sender.name ?? 'Member',
      age: sender.age ?? 0,
      area: sender.city ?? 'London',
      job: '',
      photoUrl: sender.photo_url ?? '',
      verified: sender.verification_status === 'verified',
      lat: 51.5072,
      lng: -0.1276,
      email: sender.email,
    },
    recipientEmail: recipient.email ?? '',
    matchScore: row.match_score ?? 0,
    matchReason: row.match_reason ?? '',
    venue,
    startsAt: row.starts_at,
    payment: row.payment ?? 'split',
    message: row.message,
    videoUrl: row.video_url,
    videoPoster: row.video_poster_url ?? undefined,
    videoDurationSec: row.video_duration_sec ?? undefined,
  };
}

export interface ServerProposal {
  proposal: Proposal;
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';
  decidedAt: string | null;
  senderId: string;
  recipientId: string;
}

/* ─── proposals ─── */

/** All proposals visible to me (sent + received), newest first */
export async function fetchMyProposals(): Promise<ServerProposal[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('proposals')
    .select(`*,
      sender:profiles!proposals_sender_id_fkey(${PROFILE_COLS}),
      recipient:profiles!proposals_recipient_id_fkey(${PROFILE_COLS})`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    proposal: rowToProposal(row),
    status: row.status,
    decidedAt: row.decided_at,
    senderId: row.sender_id,
    recipientId: row.recipient_id,
  }));
}

/**
 * Create a proposal on the server.
 * Uploads the intro video to storage first if it's still a local file.
 */
export async function createProposalOnServer(input: {
  recipientEmail: string;
  venue: Venue;
  startsAt: string;
  payment: 'he-pays' | 'split' | 'she-pays';
  message: string;
  videoUrl: string;
  videoDurationSec?: number;
  matchScore?: number;
  matchReason?: string;
}): Promise<Proposal> {
  const supabase = getSupabase();
  const uid = await getSessionUserId();
  if (!uid) throw new Error('You need to be signed in to send a proposal');

  // Resolve the recipient — they must already have an Aura account
  const email = input.recipientEmail.toLowerCase().trim();
  const { data: rec, error: recError } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('email', email)
    .maybeSingle();
  if (recError) throw recError;
  if (!rec) throw new Error(`No Aura account found for ${email} yet — ask them to sign up first.`);
  if (rec.id === uid) throw new Error("You can't send a proposal to yourself.");

  // The intro video is mandatory; push it to storage if it's still on-device
  let videoUrl = input.videoUrl;
  if (isLocalUri(videoUrl)) {
    videoUrl = await uploadLocalFile({
      bucket: BUCKETS.PROPOSAL_VIDEOS,
      path: `${uid}/${Date.now()}.mp4`,
      localUri: videoUrl,
      contentType: 'video/mp4',
    });
  }

  const { data, error } = await supabase
    .from('proposals')
    .insert({
      sender_id: uid,
      recipient_id: rec.id,
      venue_name: input.venue.name,
      venue_area: input.venue.area,
      venue_address: input.venue.address,
      venue_postcode: input.venue.postcode,
      venue_tube: input.venue.tube,
      venue_lat: input.venue.lat,
      venue_lng: input.venue.lng,
      venue_emoji: input.venue.emoji,
      date_type: input.venue.category,
      starts_at: input.startsAt,
      payment: input.payment,
      message: input.message,
      video_url: videoUrl,
      video_duration_sec: input.videoDurationSec ?? null,
      match_score: input.matchScore ?? 0,
      match_reason: input.matchReason ?? null,
    })
    .select(`*,
      sender:profiles!proposals_sender_id_fkey(${PROFILE_COLS}),
      recipient:profiles!proposals_recipient_id_fkey(${PROFILE_COLS})`)
    .single();
  if (error) throw error;
  return rowToProposal(data);
}

/**
 * Accept or decline a proposal I received.
 * Accepting fires a DB trigger that creates the confirmed date row.
 */
export async function decideProposalOnServer(
  proposalId: string,
  decision: 'accepted' | 'declined',
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('proposals')
    .update({ status: decision })
    .eq('id', proposalId);
  if (error) throw error;
}

/* ─── dates ─── */

function rowToDate(row: any, myId: string): ConfirmedDate {
  const amUserA = row.user_a_id === myId;
  const other: Partial<ProfileRow> = (amUserA ? row.b : row.a) ?? {};
  const myRating = amUserA ? row.user_a_rating : row.user_b_rating;
  return {
    id: row.id,
    proposalId: row.proposal_id ?? '',
    with: {
      id: other.id ?? '',
      name: other.name ?? 'Member',
      age: other.age ?? 0,
      photoUrl: other.photo_url ?? '',
      verified: other.verification_status === 'verified',
    },
    venue: {
      id: `srv_${row.id}`,
      name: row.venue_name,
      address: row.venue_address ?? '',
      postcode: row.venue_postcode ?? '',
      area: '',
      tube: '',
      lat: row.venue_lat ?? 51.5072,
      lng: row.venue_lng ?? -0.1276,
      emoji: '📍',
    },
    category: 'dinner',
    startsAt: row.starts_at,
    payment: row.payment ?? 'split',
    reminderIds: [],
    status: (row.status === 'no-show' ? 'completed' : row.status) as ConfirmedDate['status'],
    rating: myRating ?? undefined,
    ratedAt: row.rated_at ?? undefined,
    serverRole: amUserA ? 'a' : 'b',
  };
}

/** All confirmed dates I'm part of */
export async function fetchMyDates(): Promise<ConfirmedDate[]> {
  const supabase = getSupabase();
  const uid = await getSessionUserId();
  if (!uid) return [];
  const { data, error } = await supabase
    .from('dates')
    .select(`*,
      a:profiles!dates_user_a_id_fkey(${PROFILE_COLS}),
      b:profiles!dates_user_b_id_fkey(${PROFILE_COLS})`)
    .order('starts_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => rowToDate(row, uid));
}

export async function cancelDateOnServer(dateId: string): Promise<void> {
  const supabase = getSupabase();
  const uid = await getSessionUserId();
  const { error } = await supabase
    .from('dates')
    .update({ status: 'cancelled', cancelled_by: uid })
    .eq('id', dateId);
  if (error) throw error;
}

export async function rateDateOnServer(
  dateId: string,
  role: 'a' | 'b',
  rating: number,
): Promise<void> {
  const supabase = getSupabase();
  const col = role === 'a' ? 'user_a_rating' : 'user_b_rating';
  const { error } = await supabase
    .from('dates')
    .update({ [col]: rating, rated_at: new Date().toISOString() })
    .eq('id', dateId);
  if (error) throw error;
}

/* ─── member directory ─── */

export interface ServerProfile {
  id: string;
  email: string;
  name: string;
  age?: number;
  city?: string;
  bio?: string;
  gender?: string;
  genderInterest?: string;
  photoUrl?: string;
  verified?: boolean;
}

/** Browse other members (powers the recipient picker) */
export async function fetchMembers(limit = 100): Promise<ServerProfile[]> {
  const supabase = getSupabase();
  const uid = await getSessionUserId();
  if (!uid) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name, age, city, bio, gender, gender_interest, photo_url, verification_status')
    .neq('id', uid)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((p: any) => ({
    id: p.id,
    email: p.email,
    name: p.name,
    age: p.age ?? undefined,
    city: p.city ?? undefined,
    bio: p.bio ?? undefined,
    gender: p.gender ?? undefined,
    genderInterest: p.gender_interest ?? undefined,
    photoUrl: p.photo_url ?? undefined,
    verified: p.verification_status === 'verified',
  }));
}
