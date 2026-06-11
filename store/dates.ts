/**
 * Confirmed dates store — server-backed via Supabase with a local cache.
 *
 * Date rows are created by a DB trigger when a proposal is accepted, so this
 * store mostly reads. Local-only extras (calendar reminder ids) are merged
 * onto server rows by proposal id. Signed out, it behaves like the original
 * device-local store.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Proposal } from './proposals';
import {
  fetchMyDates,
  cancelDateOnServer,
  rateDateOnServer,
  getSessionUserId,
} from '@/lib/proposals-supabase';

const STORAGE_KEY = 'aura.dates.v1';

export interface ConfirmedDate {
  id: string;
  proposalId: string;
  with: { id: string; name: string; age: number; photoUrl: string; verified: boolean };
  venue: {
    id: string; name: string; address: string; postcode: string;
    area: string; tube: string; lat: number; lng: number; emoji: string;
  };
  category: string;
  startsAt: string; // ISO
  payment: 'he-pays' | 'split' | 'she-pays';
  reminderIds: string[];
  status: 'upcoming' | 'completed' | 'cancelled';
  rating?: 1 | 2 | 3 | 4 | 5;
  ratedAt?: string;
  /** Which side of the server row I am — needed to write my rating column */
  serverRole?: 'a' | 'b';
}

interface DatesState {
  dates: ConfirmedDate[];
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  refreshDates: () => Promise<void>;
  addDate: (proposal: Proposal, reminderIds: string[]) => Promise<ConfirmedDate>;
  cancelDate: (id: string) => Promise<void>;
  rateDate: (id: string, rating: 1 | 2 | 3 | 4 | 5) => Promise<void>;
  upcoming: () => ConfirmedDate[];
  past: () => ConfirmedDate[];
}

const persist = async (dates: ConfirmedDate[]) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(dates));
  } catch {
    // cache write failures are non-fatal
  }
};

/** Auto-mark dates as completed once their start time is >1h in the past */
const withAutoComplete = (dates: ConfirmedDate[]): ConfirmedDate[] => {
  const now = Date.now();
  return dates.map(d =>
    d.status === 'upcoming' && new Date(d.startsAt).getTime() < now - 60 * 60 * 1000
      ? { ...d, status: 'completed' as const }
      : d
  );
};

/**
 * Server rows win, but device-local extras (reminder ids, rich venue info
 * captured at accept time) are merged in by proposal id. Local-only rows
 * (created while offline) are kept.
 */
const mergeServerAndLocal = (server: ConfirmedDate[], local: ConfirmedDate[]): ConfirmedDate[] => {
  const byProposal = new Map(local.filter(l => l.proposalId).map(l => [l.proposalId, l]));
  const merged = server.map(s => {
    const l = s.proposalId ? byProposal.get(s.proposalId) : undefined;
    if (!l) return s;
    return {
      ...s,
      reminderIds: l.reminderIds?.length ? l.reminderIds : s.reminderIds,
      venue: l.venue?.tube || l.venue?.emoji !== '📍' ? { ...s.venue, ...l.venue } : s.venue,
      category: l.category || s.category,
    };
  });
  const serverProposalIds = new Set(server.map(s => s.proposalId).filter(Boolean));
  const localOnly = local.filter(l => l.id.startsWith('date_') && !serverProposalIds.has(l.proposalId));
  return [...merged, ...localOnly];
};

export const useDatesStore = create<DatesState>((set, get) => ({
  dates: [],
  isHydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const dates: ConfirmedDate[] = raw ? JSON.parse(raw) : [];
      const updated = withAutoComplete(dates);
      set({ dates: updated, isHydrated: true });
      if (updated.some((d, i) => d.status !== dates[i]?.status)) await persist(updated);
    } catch {
      set({ isHydrated: true });
    }
    await get().refreshDates();
  },

  refreshDates: async () => {
    try {
      const uid = await getSessionUserId();
      if (!uid) return;
      const server = await fetchMyDates();
      const merged = withAutoComplete(mergeServerAndLocal(server, get().dates));
      set({ dates: merged });
      await persist(merged);
    } catch {
      // offline — keep the cached list
    }
  },

  addDate: async (proposal, reminderIds) => {
    const newDate: ConfirmedDate = {
      id: `date_${Date.now()}`,
      proposalId: proposal.id,
      with: {
        id: proposal.from.id,
        name: proposal.from.name,
        age: proposal.from.age,
        photoUrl: proposal.from.photoUrl,
        verified: proposal.from.verified,
      },
      venue: {
        id: proposal.venue.id,
        name: proposal.venue.name,
        address: proposal.venue.address,
        postcode: proposal.venue.postcode,
        area: proposal.venue.area,
        tube: proposal.venue.tube,
        lat: proposal.venue.lat,
        lng: proposal.venue.lng,
        emoji: proposal.venue.emoji,
      },
      category: proposal.venue.category,
      startsAt: proposal.startsAt,
      payment: proposal.payment,
      reminderIds,
      status: 'upcoming',
    };
    const dates = [newDate, ...get().dates];
    set({ dates });
    await persist(dates);
    // The server creates its own row via the acceptance trigger — pull it in
    // so this local placeholder is replaced by the canonical version.
    get().refreshDates().catch(() => {});
    return newDate;
  },

  cancelDate: async (id) => {
    const dates = get().dates.map(d => d.id === id ? { ...d, status: 'cancelled' as const } : d);
    set({ dates });
    await persist(dates);
    if (!id.startsWith('date_')) {
      try { await cancelDateOnServer(id); } catch {}
    }
  },

  rateDate: async (id, rating) => {
    const target = get().dates.find(d => d.id === id);
    const dates = get().dates.map(d =>
      d.id === id ? { ...d, rating, ratedAt: new Date().toISOString() } : d
    );
    set({ dates });
    await persist(dates);
    if (target && !id.startsWith('date_') && target.serverRole) {
      try { await rateDateOnServer(id, target.serverRole, rating); } catch {}
    }
  },

  upcoming: () => get().dates
    .filter(d => d.status === 'upcoming')
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),

  past: () => get().dates
    .filter(d => d.status === 'completed' || d.status === 'cancelled')
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()),
}));
