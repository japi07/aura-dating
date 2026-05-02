/**
 * Confirmed dates store — persists upcoming + past dates.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Proposal } from './proposals';

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
}

interface DatesState {
  dates: ConfirmedDate[];
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  addDate: (proposal: Proposal, reminderIds: string[]) => Promise<ConfirmedDate>;
  cancelDate: (id: string) => Promise<void>;
  rateDate: (id: string, rating: 1 | 2 | 3 | 4 | 5) => Promise<void>;
  upcoming: () => ConfirmedDate[];
  past: () => ConfirmedDate[];
}

const persist = async (dates: ConfirmedDate[]) =>
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(dates));

export const useDatesStore = create<DatesState>((set, get) => ({
  dates: [],
  isHydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const dates: ConfirmedDate[] = raw ? JSON.parse(raw) : [];
      // Auto-mark dates as completed if their start time has passed
      const now = Date.now();
      const updated = dates.map(d =>
        d.status === 'upcoming' && new Date(d.startsAt).getTime() < now - 60 * 60 * 1000
          ? { ...d, status: 'completed' as const }
          : d
      );
      set({ dates: updated, isHydrated: true });
      if (updated.some((d, i) => d.status !== dates[i]?.status)) await persist(updated);
    } catch {
      set({ isHydrated: true });
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
    return newDate;
  },

  cancelDate: async (id) => {
    const dates = get().dates.map(d => d.id === id ? { ...d, status: 'cancelled' as const } : d);
    set({ dates });
    await persist(dates);
  },

  rateDate: async (id, rating) => {
    const dates = get().dates.map(d =>
      d.id === id ? { ...d, rating, ratedAt: new Date().toISOString() } : d
    );
    set({ dates });
    await persist(dates);
  },

  upcoming: () => get().dates
    .filter(d => d.status === 'upcoming')
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),

  past: () => get().dates
    .filter(d => d.status === 'completed' || d.status === 'cancelled')
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()),
}));
