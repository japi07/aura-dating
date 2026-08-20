/**
 * Token balance and tonight's tickets.
 *
 * Every screen that shows a price or a "you're queued" state reads from here,
 * so one purchase updates the Meet hub, the mode screen and the wallet at
 * once. The server stays the authority: this store mirrors what it last said
 * and is refreshed after anything that could move the number.
 */
import { create } from 'zustand';
import {
  fetchTokenState, initTokens, purchaseEntry, refundEntry, consumeEntry,
  NotEnoughTokens,
  type DateMode, type TokenState, type WindowEntry,
} from '@/lib/tokens-supabase';

interface TokensStore {
  balance: number;
  windowDate: string;
  prices: Record<DateMode, number>;
  entries: Partial<Record<DateMode, WindowEntry>>;
  isHydrated: boolean;
  busy: boolean;

  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Buy tonight's ticket. Throws NotEnoughTokens when the wallet is short. */
  buy: (mode: DateMode) => Promise<void>;
  giveBack: (mode: DateMode) => Promise<void>;
  markUsed: (mode: DateMode) => Promise<void>;
  /** Do you already hold a ticket for tonight? */
  hasEntry: (mode: DateMode) => boolean;
  priceOf: (mode: DateMode) => number;
}

const apply = (set: any, s: TokenState) =>
  set({
    balance: s.balance,
    windowDate: s.windowDate,
    prices: s.prices,
    entries: s.entries,
    isHydrated: true,
  });

export const useTokensStore = create<TokensStore>((set, get) => ({
  balance: 0,
  windowDate: '',
  prices: { call: 1, blind: 1, proposal: 1 },
  entries: {},
  isHydrated: false,
  busy: false,

  hydrate: async () => {
    try {
      // Opens the account and pays the trial grant the first time only.
      await initTokens();
      apply(set, await fetchTokenState());
    } catch {
      set({ isHydrated: true });
    }
  },

  refresh: async () => {
    try { apply(set, await fetchTokenState()); } catch { /* keep what we have */ }
  },

  buy: async (mode) => {
    set({ busy: true });
    try {
      const r = await purchaseEntry(mode);
      // Trust the purchase's own numbers rather than waiting on a refetch:
      // the button that triggered this is showing the balance next to it.
      set((st: TokensStore) => ({
        balance: r.balance,
        entries: {
          ...st.entries,
          [mode]: { id: r.entryId, status: r.status, tokensPaid: r.tokensPaid },
        },
      }));
    } finally {
      set({ busy: false });
    }
  },

  giveBack: async (mode) => {
    const entry = get().entries[mode];
    if (!entry) return;
    set({ busy: true });
    try {
      const balance = await refundEntry(entry.id);
      set((st: TokensStore) => {
        const next = { ...st.entries };
        delete next[mode];
        return { balance, entries: next };
      });
    } finally {
      set({ busy: false });
    }
  },

  markUsed: async (mode) => {
    const ok = await consumeEntry(mode);
    if (!ok) return;
    set((st: TokensStore) => {
      const entry = st.entries[mode];
      if (!entry) return {} as any;
      return { entries: { ...st.entries, [mode]: { ...entry, status: 'used' as const } } };
    });
  },

  hasEntry: (mode) => {
    const e = get().entries[mode];
    return !!e && (e.status === 'queued' || e.status === 'used');
  },

  priceOf: (mode) => get().prices[mode] ?? 1,
}));

export { NotEnoughTokens };
export type { DateMode };
