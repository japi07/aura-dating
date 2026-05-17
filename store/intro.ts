/**
 * Tracks whether the user has seen the welcome intro carousel.
 * Backed by AsyncStorage AND reactive via Zustand so the root layout
 * re-renders the moment the flag changes (no stale state).
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const HAS_SEEN_INTRO_KEY = 'aura.hasSeenIntro.v1';

interface IntroState {
  hasSeenIntro: boolean;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  markSeen: () => Promise<void>;
  /** Wipe the flag — useful for testing, also called on logout */
  reset: () => Promise<void>;
}

export const useIntroStore = create<IntroState>((set) => ({
  // Default to TRUE so the intro doesn't flash for returning users
  // while we read AsyncStorage at boot.
  hasSeenIntro: true,
  hydrated: false,

  hydrate: async () => {
    try {
      const seen = await AsyncStorage.getItem(HAS_SEEN_INTRO_KEY);
      set({ hasSeenIntro: seen === '1', hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },

  markSeen: async () => {
    try { await AsyncStorage.setItem(HAS_SEEN_INTRO_KEY, '1'); } catch {}
    set({ hasSeenIntro: true });
  },

  reset: async () => {
    try { await AsyncStorage.removeItem(HAS_SEEN_INTRO_KEY); } catch {}
    set({ hasSeenIntro: false });
  },
}));
