/**
 * Proposals store — persists per-day proposals received from the matchmaking
 * backend, plus the user's accept/decline state.
 * Backed by AsyncStorage so user state survives app restarts.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Venue } from '@/constants/london';

// v3 — bumped when we added recipientEmail (mandatory) for cross-account routing.
// Older cached proposals are wiped on next hydrate.
const STORAGE_KEY_PROPOSALS = 'aura.proposals.v3';
const STORAGE_KEY_DECISIONS = 'aura.decisions.v3';

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
  /** Sender's email — used to track who sent what for the local routing model */
  email?: string;
}

export interface Proposal {
  id: string;
  createdAt: string; // ISO
  expiresAt: string; // ISO
  from: ProposalUser;
  /** Email of the recipient — used to route proposals between local accounts */
  recipientEmail: string;
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
  /** Persist a new outgoing proposal — visible to its recipient on this device */
  sendProposal: (p: Omit<Proposal, 'id' | 'createdAt' | 'expiresAt'>) => Promise<Proposal>;
  acceptProposal: (id: string) => Promise<Proposal | null>;
  declineProposal: (id: string) => Promise<void>;
  /** Pending proposals received by the given email (the current user) */
  pendingForUser: (email: string) => Proposal[];
  /** Proposals sent by the given email (so the sender can see what's out) */
  sentByUser: (email: string) => Proposal[];
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

      // Defensive: drop proposals missing the required fields, in case
      // older cached data is still lying around.
      const valid = proposals.filter(p => !!p?.videoUrl && !!p?.recipientEmail);
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
      // Real backend would re-fetch here; locally we just clear the loading flag
      set({ isLoading: false });
    } catch (e: any) {
      set({ isLoading: false, error: e?.message || 'Could not refresh' });
    }
  },

  sendProposal: async (data) => {
    const proposal: Proposal = {
      ...data,
      id: `prop_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
    const next = [proposal, ...get().proposals];
    set({ proposals: next });
    await AsyncStorage.setItem(STORAGE_KEY_PROPOSALS, JSON.stringify(next));
    return proposal;
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

  pendingForUser: (email: string) => {
    const { proposals, decisions } = get();
    if (!email) return [];
    const lc = email.toLowerCase().trim();
    return proposals
      .filter(p => p?.recipientEmail?.toLowerCase?.() === lc && !decisions[p.id])
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  sentByUser: (email: string) => {
    if (!email) return [];
    const lc = email.toLowerCase().trim();
    return get().proposals
      .filter(p => p?.from?.email?.toLowerCase?.() === lc)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },
}));
