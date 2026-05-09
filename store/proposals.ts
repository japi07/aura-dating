/**
 * Proposals store — persists per-day proposals received from the matchmaking
 * backend, plus the user's accept/decline state.
 * Backed by AsyncStorage so user state survives app restarts.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Venue } from '@/constants/london';

// v2 — bumped when we made videoUrl required so old cached proposals
// (without videoUrl) are wiped on next hydrate.
const STORAGE_KEY_PROPOSALS = 'aura.proposals.v2';
const STORAGE_KEY_DECISIONS = 'aura.decisions.v2';

export interface ProposalUser {
  id: string;
  name: string;
  age: number;
  area: string;
  job: string;
  photoUrl: string;
  verified: boolean;
  lat: number;
  lng: number;
}

export interface Proposal {
  id: string;
  createdAt: string; // ISO
  expiresAt: string; // ISO
  from: ProposalUser;
  matchScore: number;
  matchReason: string;
  venue: Venue;
  startsAt: string; // ISO datetime
  payment: 'he-pays' | 'split' | 'she-pays';
  message: string;
  /** Mandatory short video introduction recorded by the proposer */
  videoUrl: string;
  /** Optional poster frame shown before playback */
  videoPoster?: string;
  /** Video duration in seconds (recorded) */
  videoDurationSec?: number;
}

export type Decision = 'accepted' | 'declined' | 'expired';

export interface DecisionRecord {
  proposalId: string;
  decision: Decision;
  decidedAt: string;
}

interface ProposalsState {
  proposals: Proposal[];
  decisions: Record<string, DecisionRecord>;
  isLoading: boolean;
  isHydrated: boolean;
  error: string | null;

  hydrate: () => Promise<void>;
  refreshProposals: () => Promise<void>;
  acceptProposal: (id: string) => Promise<Proposal | null>;
  declineProposal: (id: string) => Promise<void>;
  pendingForToday: () => Proposal[];
}

/* ─── store ─── */

export const useProposalsStore = create<ProposalsState>((set, get) => ({
  proposals: [],
  decisions: {},
  isLoading: false,
  isHydrated: false,
  error: null,

  hydrate: async () => {
    try {
      const [propRaw, decRaw] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY_PROPOSALS),
        AsyncStorage.getItem(STORAGE_KEY_DECISIONS),
      ]);
      const proposals: Proposal[] = propRaw ? JSON.parse(propRaw) : [];
      const decisions: Record<string, DecisionRecord> = decRaw ? JSON.parse(decRaw) : {};

      // Defensive: drop any proposals that don't have the required video field
      // (might be left over from older app versions)
      const valid = proposals.filter(p => !!p.videoUrl);
      set({ proposals: valid, decisions, isHydrated: true });
    } catch (e: any) {
      set({ error: e?.message || 'Failed to load proposals', isHydrated: true });
    }
  },

  /**
   * Pulls today's proposals from the matchmaking backend.
   * In production this calls the API; if no backend is reachable
   * (offline / no server) the existing local list is kept and the user
   * sees the appropriate empty / error state.
   */
  refreshProposals: async () => {
    set({ isLoading: true, error: null });
    try {
      // TODO: replace with real API call when the backend is ready:
      //   const { proposals: fresh } = await proposalsApi.getProposals();
      //   set({ proposals: fresh, isLoading: false });
      //   await AsyncStorage.setItem(STORAGE_KEY_PROPOSALS, JSON.stringify(fresh));
      set({ isLoading: false });
    } catch (e: any) {
      set({ isLoading: false, error: e?.message || 'Could not refresh' });
    }
  },

  acceptProposal: async (id: string) => {
    const p = get().proposals.find(x => x.id === id);
    if (!p) return null;
    const decisions = {
      ...get().decisions,
      [id]: { proposalId: id, decision: 'accepted' as const, decidedAt: new Date().toISOString() },
    };
    set({ decisions });
    await AsyncStorage.setItem(STORAGE_KEY_DECISIONS, JSON.stringify(decisions));
    return p;
  },

  declineProposal: async (id: string) => {
    const decisions = {
      ...get().decisions,
      [id]: { proposalId: id, decision: 'declined' as const, decidedAt: new Date().toISOString() },
    };
    set({ decisions });
    await AsyncStorage.setItem(STORAGE_KEY_DECISIONS, JSON.stringify(decisions));
  },

  pendingForToday: () => {
    const { proposals, decisions } = get();
    return proposals.filter(p => !decisions[p.id]);
  },
}));
