/**
 * Affiliate booking links for third-party experiences.
 *
 * Aura curates date-appropriate experiences and earns a referral commission
 * when a member books. The partner owns checkout and attribution, so there's
 * no API key or webhook here — just the tracked link, opened in an in-app
 * browser so it never feels like leaving Aura.
 *
 * Apple guideline 3.1.3(e): real-world experiences booked outside the app must
 * NOT use in-app purchase, so linking out is the correct (and required) route.
 */
import { Linking } from 'react-native';
import Constants from 'expo-constants';

// expo-web-browser is a native module, so it only exists in a build made
// after it was installed. Lazy-require it and fall back to the system
// browser, otherwise older builds crash the moment this file is imported.
let WebBrowser: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  WebBrowser = require('expo-web-browser');
} catch {
  WebBrowser = null;
}

const extra = (Constants.expoConfig?.extra ?? {}) as {
  viatorAffiliateId?: string;
  designMyNightAffiliateId?: string;
  feverAffiliateId?: string;
};

export type BookingPartner = 'Viator' | 'DesignMyNight' | 'Fever' | string;

/**
 * Append the right tracking parameter for the partner. Each network uses its
 * own param name, so they're handled explicitly rather than guessed.
 * Unknown partners (or missing ids) return the URL untouched — the link still
 * works, it just isn't attributed.
 */
export function buildAffiliateUrl(url: string, partner?: BookingPartner): string {
  if (!url) return url;

  let param: string | null = null;
  let id: string | undefined;

  switch ((partner || '').toLowerCase()) {
    case 'viator':
      // Viator partner links use `pid` for the partner id, plus optional
      // medium/campaign params for reporting.
      param = 'pid';
      id = extra.viatorAffiliateId;
      break;
    case 'designmynight':
      param = 'aff';
      id = extra.designMyNightAffiliateId;
      break;
    case 'fever':
      param = 'utm_source';
      id = extra.feverAffiliateId;
      break;
    default:
      return url;
  }

  if (!param || !id) return url;
  if (url.includes(`${param}=`)) return url; // already tracked

  const sep = url.includes('?') ? '&' : '?';
  const extras = partner?.toLowerCase() === 'viator'
    ? '&medium=link&campaign=aura-app'
    : '';
  return `${url}${sep}${param}=${encodeURIComponent(id)}${extras}`;
}

/** True when we have a tracking id configured for this partner. */
export function isPartnerTracked(partner?: BookingPartner): boolean {
  switch ((partner || '').toLowerCase()) {
    case 'viator': return !!extra.viatorAffiliateId;
    case 'designmynight': return !!extra.designMyNightAffiliateId;
    case 'fever': return !!extra.feverAffiliateId;
    default: return false;
  }
}

/**
 * Open a partner booking page. Uses the in-app browser sheet when available,
 * otherwise the system browser — either way the affiliate tracking is intact.
 */
export async function openBooking(url: string, partner?: BookingPartner): Promise<void> {
  const tracked = buildAffiliateUrl(url, partner);
  if (WebBrowser?.openBrowserAsync) {
    await WebBrowser.openBrowserAsync(tracked, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle?.PAGE_SHEET,
      dismissButtonStyle: 'done',
    });
    return;
  }
  await Linking.openURL(tracked);
}
