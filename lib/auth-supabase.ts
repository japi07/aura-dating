/**
 * Supabase-backed auth helpers.
 * All auth flows in the app call into these functions.
 */
import { getSupabase, supabaseEnabled, BUCKETS } from './supabase';
import { uploadLocalFile, isLocalUri, remoteOnly } from './storage-upload';
import type { User } from '@/store/auth';

export interface SignUpInput {
  email: string;
  password: string;
  name: string;
  birthday?: string;
  city?: string;
  gender?: string;
  genderInterest?: string;
  bio?: string;
  interests?: string[];
  photoUrl?: string;
}

/** Sign up with email + password and create the public profile row */
export async function signUpWithEmail(input: SignUpInput): Promise<{ user: User; token: string }> {
  if (!supabaseEnabled) throw new Error('Supabase not configured');
  const supabase = getSupabase();

  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: { name: input.name },
    },
  });
  if (error) throw error;
  if (!data.user || !data.session) throw new Error('Sign-up succeeded but no session was returned');

  // Compute age client-side so we always have a verifiable value
  const age = computeAge(input.birthday);

  // The picker gives us a device-local file:// path. That's meaningless to
  // every other phone, so upload it now that we have a session and store the
  // public URL instead.
  let photoUrl = input.photoUrl;
  if (isLocalUri(photoUrl)) {
    try {
      const path = `${data.user.id}/avatar_${Date.now()}.jpg`;
      photoUrl = await uploadLocalFile({
        bucket: BUCKETS.PROFILE_PHOTOS,
        path,
        localUri: photoUrl!,
        contentType: 'image/jpeg',
      });
      // Screen the sign-up photo the same way as later profile photos.
      // If it's rejected we drop it rather than failing the whole sign-up —
      // the account is already created at this point, and they'll get a clear
      // explanation when they add a photo from Edit Profile.
      const { moderateImageUrl } = await import('./profile-supabase');
      const check = await moderateImageUrl(photoUrl);
      if (!check.ok) {
        try { await supabase.storage.from(BUCKETS.PROFILE_PHOTOS).remove([path]); } catch {}
        photoUrl = undefined;
      }
    } catch {
      // Upload failed (offline?) — better no photo than an unusable local path
      photoUrl = undefined;
    }
  }

  // Upsert profile with the rest of the details
  const { error: profileError } = await supabase.from('profiles').upsert({
    id: data.user.id,
    email: input.email.toLowerCase().trim(),
    name: input.name,
    birthday: input.birthday || null,
    age: age ?? null,
    gender: input.gender?.toLowerCase() || null,
    gender_interest: input.genderInterest?.toLowerCase() || null,
    city: input.city || null,
    bio: input.bio || null,
    interests: input.interests || [],
    photo_url: photoUrl || null,
    photos: photoUrl ? [photoUrl] : [],
    profile_complete: true,
  });
  if (profileError) throw profileError;

  const user: User = {
    id: data.user.id,
    email: input.email,
    name: input.name,
    profileComplete: true,
    age,
    birthday: input.birthday,
    city: input.city,
    bio: input.bio,
    interests: input.interests,
    gender: input.gender?.toLowerCase(),
    genderInterest: input.genderInterest?.toLowerCase(),
    photoUrl,
    photos: photoUrl ? [photoUrl] : [],
    verificationStatus: 'unverified',
  };
  return { user, token: data.session.access_token };
}

/** Sign in with email + password and load the profile */
export async function signInWithEmail(email: string, password: string): Promise<{ user: User; token: string }> {
  if (!supabaseEnabled) throw new Error('Supabase not configured');
  const supabase = getSupabase();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.session || !data.user) throw new Error('Invalid credentials');

  const profile = await fetchProfile(data.user.id);
  return { user: profile, token: data.session.access_token };
}

/** Sign in with Apple — token comes from expo-apple-authentication */
export async function signInWithApple(args: {
  identityToken: string;
  /** Optional, only present on first sign-in */
  fullName?: { givenName?: string | null; familyName?: string | null } | null;
  email?: string | null;
}): Promise<{ user: User; token: string }> {
  if (!supabaseEnabled) throw new Error('Supabase not configured');
  const supabase = getSupabase();

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: args.identityToken,
  });
  if (error) throw error;
  if (!data.session || !data.user) throw new Error('Apple sign-in failed');

  // First time Apple signs us in, we get the name fields once — populate
  // the profile with whatever we have.
  const displayName = [args.fullName?.givenName, args.fullName?.familyName]
    .filter(Boolean).join(' ').trim() || data.user.email?.split('@')[0] || 'New member';

  await supabase.from('profiles').upsert({
    id: data.user.id,
    email: data.user.email || args.email || `${data.user.id}@private.apple`,
    name: displayName,
    profile_complete: false,
  }, { onConflict: 'id', ignoreDuplicates: true });

  const profile = await fetchProfile(data.user.id);
  return { user: profile, token: data.session.access_token };
}

/** Load (or create-on-the-fly) the public profile for a user id */
async function fetchProfile(userId: string): Promise<User> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error || !data) throw error || new Error('Profile not found');

  return {
    id: data.id,
    email: data.email,
    name: data.name,
    profileComplete: !!data.profile_complete,
    age: data.age ?? undefined,
    birthday: data.birthday ?? undefined,
    city: data.city ?? undefined,
    bio: data.bio ?? undefined,
    interests: data.interests ?? [],
    gender: data.gender ?? undefined,
    genderInterest: data.gender_interest ?? undefined,
    photoUrl: remoteOnly([data.photo_url])[0],
    photos: remoteOnly(
      Array.isArray(data.photos) && data.photos.length ? data.photos : [data.photo_url],
    ),
    verified: data.verification_status === 'verified',
    verifiedAt: data.verified_at ?? undefined,
    verificationStatus: data.verification_status ?? 'unverified',
    verificationReason: data.verification_reason ?? undefined,
  };
}

/**
 * Re-read the signed-in user's profile from the server. Returns null when
 * signed out or offline, so callers can keep whatever they had cached.
 */
export async function refreshMyProfile(): Promise<User | null> {
  if (!supabaseEnabled) return null;
  try {
    const { data } = await getSupabase().auth.getSession();
    const uid = data.session?.user?.id;
    if (!uid) return null;
    return await fetchProfile(uid);
  } catch {
    return null;
  }
}

/** Sign the user out of Supabase */
export async function signOutSupabase(): Promise<void> {
  if (!supabaseEnabled) return;
  try { await getSupabase().auth.signOut(); } catch {}
}

/* ─── Google (OAuth) ─── */

/** Deep link Google sends the user back to after consenting */
export const OAUTH_REDIRECT = 'auradating://auth-callback';

/**
 * Start Google sign-in. Supabase builds the consent URL; we open it in the
 * system browser and finish in `handleAuthCallbackUrl` when Google redirects
 * back into the app. Deliberately avoids native SDKs so it works over-the-air.
 */
export async function startGoogleSignIn(): Promise<string> {
  if (!supabaseEnabled) throw new Error('Supabase not configured');
  const { data, error } = await getSupabase().auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: OAUTH_REDIRECT,
      skipBrowserRedirect: true,
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) throw error;
  if (!data?.url) throw new Error('Could not start Google sign-in');
  return data.url;
}

/**
 * Make sure a signed-in OAuth user has a profile row (Google users skip the
 * email sign-up path, so nothing has created one yet). Returns the profile.
 */
export async function ensureProfileForCurrentUser(): Promise<User> {
  const supabase = getSupabase();
  const { data: sess } = await supabase.auth.getSession();
  const u = sess.session?.user;
  if (!u) throw new Error('Not signed in');

  const meta = (u.user_metadata ?? {}) as Record<string, any>;
  const displayName = meta.full_name || meta.name || u.email?.split('@')[0] || 'New member';
  const avatar = typeof meta.avatar_url === 'string' ? meta.avatar_url : undefined;

  await supabase.from('profiles').upsert({
    id: u.id,
    email: u.email || `${u.id}@google.local`,
    name: displayName,
    photo_url: avatar ?? null,
    profile_complete: false,
  }, { onConflict: 'id', ignoreDuplicates: true });

  return fetchProfile(u.id);
}

/** Deep link the password-reset email points back to */
export const RESET_REDIRECT = 'auradating://reset-password';

/** Send a password-reset email. The link opens the app at the reset screen. */
export async function sendPasswordReset(email: string): Promise<void> {
  if (!supabaseEnabled) throw new Error('Supabase not configured');
  const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: RESET_REDIRECT,
  });
  if (error) throw error;
}

/** Set a new password for the currently-authenticated (or recovery) session. */
export async function updatePassword(newPassword: string): Promise<void> {
  if (!supabaseEnabled) throw new Error('Supabase not configured');
  const { error } = await getSupabase().auth.updateUser({ password: newPassword });
  if (error) throw error;
}

/**
 * Handle an incoming auth deep link — either a password-recovery link or an
 * OAuth (Google) callback. Both carry the tokens in the URL fragment, so we
 * parse once and report which kind it was.
 */
export async function handleAuthCallbackUrl(url: string): Promise<'recovery' | 'signin' | null> {
  if (!url) return null;
  const hashIndex = url.indexOf('#');
  if (hashIndex === -1) return null;
  const params = new URLSearchParams(url.substring(hashIndex + 1));
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) return null;

  const { error } = await getSupabase().auth.setSession({ access_token, refresh_token });
  if (error) throw error;
  return params.get('type') === 'recovery' ? 'recovery' : 'signin';
}

/** Back-compat wrapper — true only for password-recovery links. */
export async function handleRecoveryUrl(url: string): Promise<boolean> {
  return (await handleAuthCallbackUrl(url)) === 'recovery';
}

/** Compute age from a yyyy-mm-dd, dd/mm/yyyy or any Date-parseable string */
export function computeAge(str?: string): number | undefined {
  if (!str) return undefined;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(str.trim());
  const d = m
    ? new Date(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`)
    : new Date(str);
  if (isNaN(d.getTime())) return undefined;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const mo = now.getMonth() - d.getMonth();
  if (mo < 0 || (mo === 0 && now.getDate() < d.getDate())) age--;
  return age;
}
