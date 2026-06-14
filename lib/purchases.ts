/**
 * RevenueCat (react-native-purchases) integration for Aura Gold.
 *
 * IMPORTANT: react-native-purchases is a native module. It only exists in a
 * build that was compiled after it was installed. To keep the app running in
 * older builds (and in Expo Go), every call here is guarded — if the native
 * module or API key is missing we degrade gracefully to "not subscribed"
 * instead of crashing.
 *
 * Setup (once you have a RevenueCat account):
 *   1. Create an app in RevenueCat, add your App Store Connect subscriptions.
 *   2. Create an Entitlement called "gold" and attach the products.
 *   3. Create an Offering (default) with monthly / 6-month / yearly packages.
 *   4. Copy the iOS public API key into app.json → extra.revenueCatApiKeyIos.
 *   5. Make a new EAS build (native module needs to be compiled in).
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as {
  revenueCatApiKeyIos?: string;
  revenueCatApiKeyAndroid?: string;
  revenueCatEntitlement?: string;
};

const API_KEY =
  Platform.OS === 'ios'
    ? extra.revenueCatApiKeyIos || ''
    : extra.revenueCatApiKeyAndroid || '';

export const ENTITLEMENT_ID = extra.revenueCatEntitlement || 'gold';

// Lazy-require so a missing native module doesn't crash module evaluation.
let Purchases: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Purchases = require('react-native-purchases').default;
} catch {
  Purchases = null;
}

/** True only when both the native module and an API key are present. */
export const purchasesAvailable = !!Purchases && !!API_KEY;

let _configured = false;

/** Map of our plan ids → the package types RevenueCat returns. */
export type PlanId = 'monthly' | 'sixmonth' | 'yearly';

export interface GoldPackage {
  planId: PlanId;
  /** RevenueCat package, passed back to purchasePackage() */
  rcPackage: any;
  priceString: string;        // localised, e.g. "£19.99"
  title: string;
}

export interface GoldStatus {
  isGold: boolean;
  /** ISO date the entitlement expires / renews, if known */
  expiresAt: string | null;
}

const NOT_GOLD: GoldStatus = { isGold: false, expiresAt: null };

/**
 * Configure RevenueCat for the signed-in user. Safe to call repeatedly.
 * `appUserId` should be the Supabase user id so purchases follow the account.
 */
export async function initPurchases(appUserId?: string): Promise<void> {
  if (!purchasesAvailable) return;
  try {
    if (!_configured) {
      Purchases.configure({ apiKey: API_KEY, appUserID: appUserId ?? null });
      _configured = true;
    } else if (appUserId) {
      // User signed in after configure() — link the purchases to them.
      await Purchases.logIn(appUserId);
    }
  } catch {
    // leave _configured as-is; calls below will no-op
  }
}

/** Current Gold entitlement status. Returns NOT_GOLD when unavailable. */
export async function getGoldStatus(): Promise<GoldStatus> {
  if (!purchasesAvailable || !_configured) return NOT_GOLD;
  try {
    const info = await Purchases.getCustomerInfo();
    return readEntitlement(info);
  } catch {
    return NOT_GOLD;
  }
}

/** Available Gold packages from the default offering. */
export async function getGoldPackages(): Promise<GoldPackage[]> {
  if (!purchasesAvailable || !_configured) return [];
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings?.current;
    if (!current?.availablePackages?.length) return [];
    return current.availablePackages
      .map((pkg: any) => {
        const planId = mapPackageToPlan(pkg);
        if (!planId) return null;
        return {
          planId,
          rcPackage: pkg,
          priceString: pkg.product?.priceString ?? '',
          title: pkg.product?.title ?? planId,
        } as GoldPackage;
      })
      .filter(Boolean) as GoldPackage[];
  } catch {
    return [];
  }
}

/** Purchase a package. Returns the resulting Gold status. */
export async function purchaseGold(rcPackage: any): Promise<GoldStatus> {
  if (!purchasesAvailable || !_configured) {
    throw new Error('In-app purchases are not available in this build yet.');
  }
  const { customerInfo } = await Purchases.purchasePackage(rcPackage);
  return readEntitlement(customerInfo);
}

/** Restore prior purchases (required by Apple). Returns Gold status. */
export async function restoreGold(): Promise<GoldStatus> {
  if (!purchasesAvailable || !_configured) {
    throw new Error('In-app purchases are not available in this build yet.');
  }
  const info = await Purchases.restorePurchases();
  return readEntitlement(info);
}

/* ─── helpers ─── */

function readEntitlement(customerInfo: any): GoldStatus {
  const ent = customerInfo?.entitlements?.active?.[ENTITLEMENT_ID];
  if (!ent) return NOT_GOLD;
  return {
    isGold: true,
    expiresAt: ent.expirationDate ?? null,
  };
}

/** Best-effort mapping from a RevenueCat package to our plan ids. */
function mapPackageToPlan(pkg: any): PlanId | null {
  // RevenueCat's standard package identifiers
  const id = (pkg?.identifier ?? '').toUpperCase();
  const period = pkg?.product?.subscriptionPeriod ?? '';
  if (id.includes('ANNUAL') || id === '$RC_ANNUAL' || period === 'P1Y') return 'yearly';
  if (id.includes('SIX') || id === '$RC_SIX_MONTH' || period === 'P6M') return 'sixmonth';
  if (id.includes('MONTHLY') || id === '$RC_MONTHLY' || period === 'P1M') return 'monthly';
  return null;
}
