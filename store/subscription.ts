/**
 * Aura Gold subscription state.
 *
 * Source of truth precedence:
 *   1. RevenueCat (authoritative, live entitlement) — when the native module
 *      and API key are present.
 *   2. Supabase profiles.is_gold (set by the RevenueCat webhook) — fallback
 *      when purchases aren't available in this build, so other devices and
 *      server-side gating still know the user is Gold.
 *
 * The app keeps working with neither configured: everyone is simply free tier.
 */
import { create } from 'zustand';
import {
  purchasesAvailable, initPurchases, getGoldStatus, getGoldPackages,
  purchaseGold, restoreGold, type GoldPackage, type PlanId,
} from '@/lib/purchases';
import { fetchMyGoldStatus, setMyGoldStatus } from '@/lib/profile-supabase';
import { getSessionUserId } from '@/lib/proposals-supabase';

interface SubscriptionState {
  isGold: boolean;
  expiresAt: string | null;
  packages: GoldPackage[];
  isHydrated: boolean;
  loading: boolean;
  /** Whether real in-app purchases can run in this build */
  canPurchase: boolean;

  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  purchase: (planId: PlanId) => Promise<boolean>;
  restore: () => Promise<boolean>;
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  isGold: false,
  expiresAt: null,
  packages: [],
  isHydrated: false,
  loading: false,
  canPurchase: purchasesAvailable,

  hydrate: async () => {
    try {
      const uid = await getSessionUserId();
      await initPurchases(uid ?? undefined);

      if (purchasesAvailable) {
        // RevenueCat is authoritative
        const [status, packages] = await Promise.all([getGoldStatus(), getGoldPackages()]);
        set({
          isGold: status.isGold,
          expiresAt: status.expiresAt,
          packages,
          canPurchase: true,
          isHydrated: true,
        });
        // Mirror to the server so gating elsewhere agrees
        try { await setMyGoldStatus(status.isGold, status.expiresAt); } catch {}
      } else {
        // Fall back to the server's view
        const server = await fetchMyGoldStatus();
        set({
          isGold: server.isGold,
          expiresAt: server.expiresAt,
          packages: [],
          canPurchase: false,
          isHydrated: true,
        });
      }
    } catch {
      set({ isHydrated: true });
    }
  },

  refresh: async () => {
    if (!purchasesAvailable) {
      try {
        const server = await fetchMyGoldStatus();
        set({ isGold: server.isGold, expiresAt: server.expiresAt });
      } catch {}
      return;
    }
    try {
      const [status, packages] = await Promise.all([getGoldStatus(), getGoldPackages()]);
      set({ isGold: status.isGold, expiresAt: status.expiresAt, packages });
    } catch {}
  },

  purchase: async (planId: PlanId) => {
    const pkg = get().packages.find((p) => p.planId === planId);
    if (!pkg) throw new Error('That plan is not available right now.');
    set({ loading: true });
    try {
      const status = await purchaseGold(pkg.rcPackage);
      set({ isGold: status.isGold, expiresAt: status.expiresAt });
      try { await setMyGoldStatus(status.isGold, status.expiresAt); } catch {}
      return status.isGold;
    } finally {
      set({ loading: false });
    }
  },

  restore: async () => {
    set({ loading: true });
    try {
      const status = await restoreGold();
      set({ isGold: status.isGold, expiresAt: status.expiresAt });
      try { await setMyGoldStatus(status.isGold, status.expiresAt); } catch {}
      return status.isGold;
    } finally {
      set({ loading: false });
    }
  },
}));

/** Convenience hook for gating premium features. */
export const useIsGold = () => useSubscriptionStore((s) => s.isGold);
