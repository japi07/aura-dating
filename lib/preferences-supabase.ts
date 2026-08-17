/**
 * Date preferences, synced to the profile.
 *
 * These used to live only in AsyncStorage, which meant the Preferences screen
 * was purely cosmetic as far as matching was concerned — the blind matcher
 * runs on the server and could not see a word of it. That is why blind signup
 * had its own duplicate form asking the same questions again.
 *
 * Now the profile is the source of truth for matching and the phone keeps a
 * copy for instant rendering. Writes go to both; reads prefer the server and
 * fall back to the cache offline.
 */
import { getSupabase, supabaseEnabled } from './supabase';
import { getSessionUserId } from './proposals-supabase';

export interface ServerDatePrefs {
  dateTypes: string[];
  availableDays: string[];
  ageMin: number;
  ageMax: number;
  radiusKm: number;
  intention: 'serious' | 'dating' | 'open';
}

/**
 * Push preferences to the profile. Best effort by design: a failed sync must
 * never block the toggle the member just tapped, and the next change or the
 * next launch will carry the whole set again.
 */
export async function pushDatePreferences(prefs: Partial<ServerDatePrefs>): Promise<void> {
  if (!supabaseEnabled) return;
  try {
    const uid = await getSessionUserId();
    if (!uid) return;

    const row: Record<string, unknown> = {};
    if (prefs.dateTypes !== undefined) row.date_types = prefs.dateTypes;
    if (prefs.availableDays !== undefined) row.available_days = prefs.availableDays;
    if (prefs.ageMin !== undefined) row.age_min = prefs.ageMin;
    if (prefs.ageMax !== undefined) row.age_max = prefs.ageMax;
    if (prefs.radiusKm !== undefined) row.radius_km = prefs.radiusKm;
    if (prefs.intention !== undefined) row.intention = prefs.intention;
    if (Object.keys(row).length === 0) return;

    await getSupabase().from('profiles').update(row).eq('id', uid);
  } catch {
    // Offline, or signed out mid-edit. The cache still has it.
  }
}

/** Read preferences back, for a fresh install or a second device. */
export async function fetchDatePreferences(): Promise<Partial<ServerDatePrefs> | null> {
  if (!supabaseEnabled) return null;
  try {
    const uid = await getSessionUserId();
    if (!uid) return null;

    const { data, error } = await getSupabase()
      .from('profiles')
      .select('date_types, available_days, age_min, age_max, radius_km, intention')
      .eq('id', uid)
      .maybeSingle();
    if (error || !data) return null;

    const out: Partial<ServerDatePrefs> = {};
    // Only report what the server actually holds. An empty array here is
    // "never set", not "wants nothing" — treating those the same would wipe
    // a member's real answers on first launch after an update.
    if (data.date_types?.length) out.dateTypes = data.date_types;
    if (data.available_days?.length) out.availableDays = data.available_days;
    if (data.age_min != null) out.ageMin = data.age_min;
    if (data.age_max != null) out.ageMax = data.age_max;
    if (data.radius_km != null) out.radiusKm = data.radius_km;
    if (data.intention) out.intention = data.intention;
    return out;
  } catch {
    return null;
  }
}
