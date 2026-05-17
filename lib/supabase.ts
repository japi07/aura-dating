/**
 * Supabase client singleton.
 *
 * Configuration is read from EAS env vars (see app.json `extra`) so the
 * URL and anon key can differ between dev / preview / production builds.
 *
 * Setup steps for a new project:
 *   1. Create a Supabase project at https://supabase.com
 *   2. Project Settings → API → copy URL and `anon` public key
 *   3. Add them to:
 *        - .env.local      (for local dev / Expo Go)
 *        - eas.json        (for EAS Build profiles)
 *   4. Run the migrations from supabase/schema.sql in the SQL editor
 */
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

// Fall back to env-style strings so the app doesn't crash before the
// developer has configured Supabase. All API calls will fail gracefully
// (network error) and the offline fallbacks will kick in.
const SUPABASE_URL = extra.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = extra.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabaseEnabled = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_client) {
    _client = createClient(SUPABASE_URL || 'https://placeholder.supabase.co', SUPABASE_ANON_KEY || 'placeholder', {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return _client;
}

/** Storage bucket names — must match the SQL schema */
export const BUCKETS = {
  PROFILE_PHOTOS: 'profile-photos',
  VERIFICATION_PHOTOS: 'verification-photos',  // private
  VERIFICATION_VIDEOS: 'verification-videos',  // private
  PROPOSAL_VIDEOS: 'proposal-videos',
};
