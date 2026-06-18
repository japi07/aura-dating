/**
 * Supabase-backed auth helpers.
 * All auth flows in the app call into these functions.
 */
import { getSupabase, supabaseEnabled } from './supabase';
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
    photo_url: input.photoUrl || null,
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
    photoUrl: input.photoUrl,
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
    photoUrl: data.photo_url ?? undefined,
    verified: data.verification_status === 'verified',
    verifiedAt: data.verified_at ?? undefined,
    verificationStatus: data.verification_status ?? 'unverified',
    verificationReason: data.verification_reason ?? undefined,
  };
}

/** Sign the user out of Supabase */
export async function signOutSupabase(): Promise<void> {
  if (!supabaseEnabled) return;
  try { await getSupabase().auth.signOut(); } catch {}
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
 * Parse an incoming recovery deep link and establish the recovery session so
 * the user can set a new password. Returns true when the URL was a recovery link.
 */
export async function handleRecoveryUrl(url: string): Promise<boolean> {
  if (!url) return false;
  const hashIndex = url.indexOf('#');
  if (hashIndex === -1) return false;
  const params = new URLSearchParams(url.substring(hashIndex + 1));
  if (params.get('type') !== 'recovery') return false;
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) return false;
  const { error } = await getSupabase().auth.setSession({ access_token, refresh_token });
  if (error) throw error;
  return true;
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
