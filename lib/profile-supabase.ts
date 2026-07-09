/**
 * Supabase data layer for profile, verification, blocks and reports.
 *
 * Mirrors the pattern in proposals-supabase.ts: every call runs under the
 * signed-in user's session, so RLS keeps users to their own rows. All
 * functions no-op or throw a friendly error when offline / not signed in,
 * so the screens can fall back to local-only behaviour.
 */
import { getSupabase, supabaseEnabled, BUCKETS } from './supabase';
import { uploadLocalFile, isLocalUri } from './storage-upload';
import { getSessionUserId } from './proposals-supabase';

/* ─── profile ─── */

export interface ProfilePatch {
  name?: string;
  bio?: string;
  city?: string;
  birthday?: string;
  age?: number;
  interests?: string[];
  photoUrl?: string;
  /** Full gallery — local URIs are uploaded + moderated; remote URLs pass through */
  photos?: string[];
  gender?: string;
  genderInterest?: string;
  profileComplete?: boolean;
}

/**
 * Run an uploaded (public) image URL through content moderation.
 * Returns true if the image is acceptable. Fails open (returns true) when
 * moderation isn't configured or errors, so uploads aren't blocked before
 * the OPENAI_API_KEY is set.
 */
export async function moderateImageUrl(imageUrl: string): Promise<{ ok: boolean; categories?: string[] }> {
  if (!supabaseEnabled) return { ok: true };
  try {
    const { data, error } = await getSupabase().functions.invoke('moderate-image', { body: { imageUrl } });
    if (error) return { ok: true }; // function missing / not deployed — don't block
    return { ok: !data?.flagged, categories: data?.categories };
  } catch {
    return { ok: true };
  }
}

/**
 * Upload a profile photo to the public profile-photos bucket, screen it with
 * content moderation, and return its public URL. Throws if the image is
 * rejected (and removes the rejected upload).
 */
export async function uploadMyProfilePhoto(localUri: string): Promise<string> {
  const uid = await getSessionUserId();
  if (!uid) throw new Error('You need to be signed in to upload a photo');
  const path = `${uid}/avatar_${Date.now()}.jpg`;
  const url = await uploadLocalFile({
    bucket: BUCKETS.PROFILE_PHOTOS,
    path,
    localUri,
    contentType: 'image/jpeg',
  });

  const moderation = await moderateImageUrl(url);
  if (!moderation.ok) {
    // Remove the rejected image so it isn't left in storage
    try { await getSupabase().storage.from(BUCKETS.PROFILE_PHOTOS).remove([path]); } catch {}
    throw new Error('That photo didn\'t pass our content guidelines. Please choose another.');
  }
  return url;
}

/**
 * Persist profile field changes to the profiles table.
 * If `photoUrl` is still a local file:// URI it's uploaded first and the
 * resulting public URL is returned (so the caller can update local state).
 */
export async function updateMyProfile(patch: ProfilePatch): Promise<{ photoUrl?: string; photos?: string[] }> {
  const supabase = getSupabase();
  const uid = await getSessionUserId();
  if (!uid) throw new Error('You need to be signed in to update your profile');

  let photoUrl = patch.photoUrl;
  if (isLocalUri(photoUrl)) {
    photoUrl = await uploadMyProfilePhoto(photoUrl!);
  }

  // Gallery: upload+moderate any local photos, keep remote ones as-is.
  let photos: string[] | undefined;
  if (patch.photos !== undefined) {
    photos = [];
    for (const p of patch.photos) {
      if (!p) continue;
      photos.push(isLocalUri(p) ? await uploadMyProfilePhoto(p) : p);
    }
  }

  const row: Record<string, any> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.bio !== undefined) row.bio = patch.bio;
  if (patch.city !== undefined) row.city = patch.city;
  if (patch.birthday !== undefined) row.birthday = patch.birthday || null;
  if (patch.age !== undefined) row.age = patch.age ?? null;
  if (patch.interests !== undefined) row.interests = patch.interests;
  if (patch.gender !== undefined) row.gender = patch.gender;
  if (patch.genderInterest !== undefined) row.gender_interest = patch.genderInterest;
  if (patch.profileComplete !== undefined) row.profile_complete = patch.profileComplete;
  if (photos !== undefined) {
    row.photos = photos;
    // Keep the primary photo column in sync with the first gallery photo
    row.photo_url = photos[0] ?? photoUrl ?? null;
  } else if (photoUrl !== undefined) {
    row.photo_url = photoUrl;
  }

  if (Object.keys(row).length > 0) {
    const { error } = await supabase.from('profiles').update(row).eq('id', uid);
    if (error) throw error;
  }
  return { photoUrl: photos ? photos[0] : photoUrl, photos };
}

/* ─── verification ─── */

export interface VerificationResult {
  verificationId: string;
  status: 'pending' | 'verified' | 'rejected';
  estimatedReviewMinutes: number;
}

/**
 * Submit identity verification: upload the selfie + liveness video to the
 * private buckets, insert a verifications row, and mark the profile as
 * 'pending'. Review happens out-of-band (admin / automated pipeline).
 */
export async function submitVerificationToServer(args: {
  photoUri: string;
  videoUri: string;
  videoDurationSec?: number;
}): Promise<VerificationResult> {
  const supabase = getSupabase();
  const uid = await getSessionUserId();
  if (!uid) throw new Error('You need to be signed in to verify');

  const stamp = Date.now();
  // Private buckets — store the path, not a public URL
  const photoPath = await uploadLocalFile({
    bucket: BUCKETS.VERIFICATION_PHOTOS,
    path: `${uid}/selfie_${stamp}.jpg`,
    localUri: args.photoUri,
    contentType: 'image/jpeg',
    publicUrl: false,
  });
  const videoPath = await uploadLocalFile({
    bucket: BUCKETS.VERIFICATION_VIDEOS,
    path: `${uid}/liveness_${stamp}.mp4`,
    localUri: args.videoUri,
    contentType: 'video/mp4',
    publicUrl: false,
  });

  const { data, error } = await supabase
    .from('verifications')
    .insert({
      user_id: uid,
      photo_path: photoPath,
      video_path: videoPath,
      video_duration_sec: args.videoDurationSec ?? null,
    })
    .select('id, status, estimated_review_minutes')
    .single();
  if (error) throw error;

  // Flag the profile as pending review
  await supabase
    .from('profiles')
    .update({ verification_status: 'pending' })
    .eq('id', uid);

  return {
    verificationId: data.id,
    status: data.status,
    estimatedReviewMinutes: data.estimated_review_minutes ?? 60,
  };
}

/* ─── blocks ─── */

export interface BlockedMember {
  id: string;           // block row id
  blockedId: string;    // the blocked user's profile id
  name: string;
  age?: number;
  photoUrl?: string;
  reason?: string;
  createdAt: string;
}

export async function fetchMyBlocks(): Promise<BlockedMember[]> {
  if (!supabaseEnabled) return [];
  const supabase = getSupabase();
  const uid = await getSessionUserId();
  if (!uid) return [];
  const { data, error } = await supabase
    .from('blocks')
    .select('id, blocked_id, reason, created_at, blocked:profiles!blocks_blocked_id_fkey(name, age, photo_url)')
    .eq('blocker_id', uid)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    blockedId: row.blocked_id,
    name: row.blocked?.name ?? 'Member',
    age: row.blocked?.age ?? undefined,
    photoUrl: row.blocked?.photo_url ?? undefined,
    reason: row.reason ?? undefined,
    createdAt: row.created_at,
  }));
}

export async function blockUserOnServer(blockedId: string, reason?: string): Promise<void> {
  const supabase = getSupabase();
  const uid = await getSessionUserId();
  if (!uid) throw new Error('You need to be signed in to block someone');
  const { error } = await supabase
    .from('blocks')
    .upsert(
      { blocker_id: uid, blocked_id: blockedId, reason: reason ?? null },
      { onConflict: 'blocker_id,blocked_id' },
    );
  if (error) throw error;
}

export async function unblockUserOnServer(blockedId: string): Promise<void> {
  const supabase = getSupabase();
  const uid = await getSessionUserId();
  if (!uid) throw new Error('You need to be signed in to unblock someone');
  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('blocker_id', uid)
    .eq('blocked_id', blockedId);
  if (error) throw error;
}

/* ─── reports ─── */

export async function reportUserOnServer(args: {
  reportedId: string;
  reason: string;
  details?: string;
  relatedProposalId?: string;
  relatedDateId?: string;
}): Promise<void> {
  const supabase = getSupabase();
  const uid = await getSessionUserId();
  if (!uid) throw new Error('You need to be signed in to report someone');
  const { error } = await supabase.from('reports').insert({
    reporter_id: uid,
    reported_id: args.reportedId,
    reason: args.reason,
    details: args.details ?? null,
    related_proposal_id: args.relatedProposalId ?? null,
    related_date_id: args.relatedDateId ?? null,
  });
  if (error) throw error;
}

/* ─── push tokens ─── */

/**
 * Persist this device's Expo push token so the server can send the user
 * notifications. Upserts on (user_id, expo_push_token) so re-running is safe.
 */
export async function savePushTokenToServer(expoPushToken: string): Promise<void> {
  if (!supabaseEnabled || !expoPushToken) return;
  const supabase = getSupabase();
  const uid = await getSessionUserId();
  if (!uid) return;
  const { error } = await supabase
    .from('push_tokens')
    .upsert(
      { user_id: uid, expo_push_token: expoPushToken, last_used_at: new Date().toISOString() },
      { onConflict: 'user_id,expo_push_token' },
    );
  if (error) throw error;
}

/* ─── Aura Gold status ─── */

export interface GoldRow {
  isGold: boolean;
  expiresAt: string | null;
}

/** Read the server's view of the user's Gold status (set by RC webhook). */
export async function fetchMyGoldStatus(): Promise<GoldRow> {
  if (!supabaseEnabled) return { isGold: false, expiresAt: null };
  const supabase = getSupabase();
  const uid = await getSessionUserId();
  if (!uid) return { isGold: false, expiresAt: null };
  const { data, error } = await supabase
    .from('profiles')
    .select('is_gold, gold_expires_at')
    .eq('id', uid)
    .maybeSingle();
  if (error) throw error;
  return { isGold: !!data?.is_gold, expiresAt: data?.gold_expires_at ?? null };
}

/**
 * Best-effort client-side write of Gold status for instant feedback after a
 * purchase. The RevenueCat webhook is the authoritative sync; this just makes
 * the change visible immediately on this and other devices.
 */
export async function setMyGoldStatus(isGold: boolean, expiresAt: string | null): Promise<void> {
  if (!supabaseEnabled) return;
  const supabase = getSupabase();
  const uid = await getSessionUserId();
  if (!uid) return;
  const { error } = await supabase
    .from('profiles')
    .update({ is_gold: isGold, gold_expires_at: expiresAt })
    .eq('id', uid);
  if (error) throw error;
}

/* ─── support tickets ─── */

/**
 * Submit a help/support request. Saved to the support_tickets table where
 * the team can read and reply (the user's email is joinable via user_id).
 */
export async function submitSupportTicket(args: { subject?: string; message: string }): Promise<void> {
  const supabase = getSupabase();
  const uid = await getSessionUserId();
  if (!uid) throw new Error('Please sign in to contact support');
  const { error } = await supabase.from('support_tickets').insert({
    user_id: uid,
    subject: args.subject?.trim() || null,
    message: args.message.trim(),
  });
  if (error) throw error;
}

/* ─── account deletion ─── */

/**
 * Permanently delete the signed-in user's account. Calls the
 * `delete-account` Edge Function which runs under the service role and
 * removes the auth user (cascading to all their rows). Apple requires
 * in-app account deletion for accounts created in-app.
 */
export async function deleteMyAccount(): Promise<void> {
  const supabase = getSupabase();
  const uid = await getSessionUserId();
  if (!uid) throw new Error('You need to be signed in to delete your account');
  const { error } = await supabase.functions.invoke('delete-account');
  if (error) throw error;
}
