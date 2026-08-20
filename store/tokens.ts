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
  /** The last load threw — the balance below is not to be trusted */
  loadFailed: boolean;
  busy: boolean;

  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Buy tonight's ticket. Throws NotEnoughTokens when the wallet is short. */
  buy: (mode: DateMode) => Promise<void>;
  /** Returns whether a token actually came back. */
  giveBack: (mode: DateMode) => Promise<boolean>;
  markUsed: (mode: DateMode) => Promise<void>;
  /**
   * May you START this tonight? Only a queued ticket counts.
   *
   * Distinct from hasTicket on purpose: treating a spent ticket as an
   * entitlement let one token authorise unlimited calls and proposals for
   * the night, because every "am I allowed" check asked the same question
   * as every "show the queued badge" check.
   */
  hasEntry: (mode: DateMode) => boolean;
  /** Did you buy tonight, spent or not? Display only. */
  hasTicket: (mode: DateMode) => boolean;
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
  loadFailed: false,
  busy: false,

  hydrate: async () => {
    try {
      // Opens the account, pays the trial grant the first time only, and
      // refunds any ticket bought for a night that has since passed.
      await initTokens();
      apply(set, await fetchTokenState());
      set({ loadFailed: false });
    } catch {
      // Deliberately does NOT set isHydrated. A balance of zero because
      // the network failed is indistinguishable from a genuinely empty
      // wallet, and latching it would show a funded member the paywall
      // for the rest of the session with no way to retry.
      set({ loadFailed: true });
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
    if (!entry) return false;
    set({ busy: true });
    try {
      const r = await refundEntry(entry.id);
      // Only drop the ticket when money actually moved. A spent ticket
      // refuses politely, and deleting it anyway left the client claiming
      // a refund the server never made.
      set((st: TokensStore) => {
        if (!r.refunded) return { balance: r.balance } as any;
        const next = { ...st.entries };
        delete next[mode];
        return { balance: r.balance, entries: next };
      });
      return r.refunded;
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

  hasEntry: (mode) => get().entries[mode]?.status === 'queued',

  hasTicket: (mode) => {
    const e = get().entries[mode];
    return !!e && (e.status === 'queued' || e.status === 'used');
  },

  priceOf: (mode) => get().prices[mode] ?? 1,
}));

export { NotEnoughTokens };
export type { DateMode };
