/**
 * Proposals store — server-backed via Supabase, with an AsyncStorage cache
 * so the last known state is available offline / before the first fetch.
 *
 * When Supabase is reachable the server is the source of truth: proposals
 * are written there, and accept/decline updates the row (a DB trigger turns
 * an acceptance into a confirmed date). Without a session the store falls
 * back to the original device-local behaviour so nothing breaks offline.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Venue } from '@/constants/london';
import {
  fetchMyProposals,
  createProposalOnServer,
  decideProposalOnServer,
  getSessionUserId,
} from '@/lib/proposals-supabase';

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
  /** Sender's email — used to track who sent what */
  email?: string;
}

export interface Proposal {
  id: string;
  createdAt: string; // ISO
  expiresAt: string; // ISO
  from: ProposalUser;
  /** Email of the recipient — used to route proposals between accounts */
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
  /** Create and send a proposal — stored on the server when signed in */
  sendProposal: (p: Omit<Proposal, 'id' | 'createdAt' | 'expiresAt'>) => Promise<Proposal>;
  acceptProposal: (id: string) => Promise<Proposal | null>;
  declineProposal: (id: string) => Promise<void>;
  /** Pending proposals received by the given email (the current user) */
  pendingForUser: (email: string) => Proposal[];
  /** Proposals sent by the given email (so the sender can see what's out) */
  sentByUser: (email: string) => Proposal[];
}

/* ─── helpers ─── */

const persistCache = async (proposals: Proposal[], decisions: Record<string, DecisionRecord>) => {
  try {
    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEY_PROPOSALS, JSON.stringify(proposals)),
      AsyncStorage.setItem(STORAGE_KEY_DECISIONS, JSON.stringify(decisions)),
    ]);
  } catch {
    // cache write failures are non-fatal
  }
};

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
    // Then pull the latest truth from the server (no-op when signed out)
    await get().refreshProposals();
  },

  /**
   * Pulls my proposals (sent + received) from Supabase and replaces the
   * local view. Offline or signed out, the cached list is kept as-is.
   */
  refreshProposals: async () => {
    set({ isLoading: true, error: null });
    try {
      const uid = await getSessionUserId();
      if (!uid) {
        set({ isLoading: false });
        return;
      }
      const rows = await fetchMyProposals();
      const proposals = rows.map(r => r.proposal);
      // Reflect server-side decisions so decided proposals leave the inbox
      const decisions: Record<string, DecisionRecord> = {};
      for (const r of rows) {
        if (r.status === 'accepted' || r.status === 'declined' || r.status === 'expired') {
          decisions[r.proposal.id] = {
            proposalId: r.proposal.id,
            decision: r.status as Decision,
            decidedAt: r.decidedAt ?? r.proposal.createdAt,
          };
        }
      }
      set({ proposals, decisions, isLoading: false });
      await persistCache(proposals, decisions);
    } catch (e: any) {
      set({ isLoading: false, error: e?.message || 'Could not refresh' });
    }
  },

  sendProposal: async (data) => {
    const uid = await getSessionUserId();

    if (uid) {
      // Server path — the recipient's phone will see it on their next refresh
      const proposal = await createProposalOnServer({
        recipientEmail: data.recipientEmail,
        venue: data.venue,
        startsAt: data.startsAt,
        payment: data.payment,
        message: data.message,
        videoUrl: data.videoUrl,
        videoDurationSec: data.videoDurationSec,
        matchScore: data.matchScore,
        matchReason: data.matchReason,
      });
      const next = [proposal, ...get().proposals.filter(p => p.id !== proposal.id)];
      set({ proposals: next });
      await persistCache(next, get().decisions);
      return proposal;
    }

    // Offline / signed-out fallback: device-local only (original behaviour)
    const proposal: Proposal = {
      ...data,
      id: `prop_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
    const next = [proposal, ...get().proposals];
    set({ proposals: next });
    await persistCache(next, get().decisions);
    return proposal;
  },

  acceptProposal: async (id: string) => {
    const p = get().proposals.find(x => x.id === id);
    if (!p) return null;

    // Optimistic local decision so the UI responds instantly
    const decisions = {
      ...get().decisions,
      [id]: { proposalId: id, decision: 'accepted' as const, decidedAt: new Date().toISOString() },
    };
    set({ decisions });
    await persistCache(get().proposals, decisions);

    // Server update — fires the trigger that creates the confirmed date
    if (!id.startsWith('prop_')) {
      try {
        await decideProposalOnServer(id, 'accepted');
      } catch (e: any) {
        set({ error: e?.message || 'Could not sync your acceptance' });
      }
    }
    return p;
  },

  declineProposal: async (id: string) => {
    const decisions = {
      ...get().decisions,
      [id]: { proposalId: id, decision: 'declined' as const, decidedAt: new Date().toISOString() },
    };
    set({ decisions });
    await persistCache(get().proposals, decisions);

    if (!id.startsWith('prop_')) {
      try {
        await decideProposalOnServer(id, 'declined');
      } catch (e: any) {
        set({ error: e?.message || 'Could not sync your decline' });
      }
    }
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
