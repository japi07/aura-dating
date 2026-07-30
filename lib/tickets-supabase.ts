/**
 * Ticket Tailor integration (Tier 1).
 *
 * Aura is the event organizer, so the ticket price already carries Aura's
 * margin. The app never sees the Ticket Tailor API key — availability comes
 * from an Edge Function, and payment happens on Ticket Tailor's hosted
 * checkout opened in an in-app browser (Apple guideline 3.1.3(e): real-world
 * event tickets must NOT use in-app purchase).
 */
import { Linking } from 'react-native';
import { getSupabase, supabaseEnabled } from './supabase';
import { getSessionUserId } from './proposals-supabase';

// Native module — only present in builds made after it was installed, so
// lazy-require it and fall back to the system browser.
let WebBrowser: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  WebBrowser = require('expo-web-browser');
} catch {
  WebBrowser = null;
}

export interface TicketType {
  id: string;
  name: string;
  priceMinor: number;
  currency: string;
  quantityRemaining: number | null;
  soldOut: boolean;
}

export interface TicketAvailability {
  available: boolean;
  ticketTypes: TicketType[];
  totalRemaining: number | null;
  fromPriceMinor: number | null;
}

const UNAVAILABLE: TicketAvailability = {
  available: false, ticketTypes: [], totalRemaining: null, fromPriceMinor: null,
};

/** Format minor units (pence) as a display price. */
export function formatTicketPrice(minor: number | null, currency = 'GBP'): string {
  if (minor === null) return '';
  if (minor === 0) return 'Free';
  const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '';
  const major = minor / 100;
  return `${symbol}${major % 1 === 0 ? major.toFixed(0) : major.toFixed(2)}`;
}

/**
 * Live ticket availability for an event. Falls back to "unavailable" (so the
 * UI uses our own stored price/spots) whenever Ticket Tailor isn't configured
 * or is unreachable — never blocks the Events tab from rendering.
 */
export async function fetchTicketAvailability(ticketTailorEventId: string): Promise<TicketAvailability> {
  if (!supabaseEnabled || !ticketTailorEventId) return UNAVAILABLE;
  try {
    const { data, error } = await getSupabase().functions.invoke('ticket-availability', {
      body: { ticketTailorEventId },
    });
    if (error || !data?.available) return UNAVAILABLE;
    return {
      available: true,
      ticketTypes: data.ticketTypes ?? [],
      totalRemaining: data.totalRemaining ?? null,
      fromPriceMinor: data.fromPriceMinor ?? null,
    };
  } catch {
    return UNAVAILABLE;
  }
}

/**
 * Open Ticket Tailor's hosted checkout in an in-app browser so buying never
 * feels like leaving Aura. The user's email is prefilled when we know it, so
 * the webhook can match the purchase back to their Aura account.
 *
 * Returns true if the sheet was opened (not whether they completed payment —
 * that arrives via the webhook).
 */
export async function openTicketCheckout(args: {
  checkoutUrl: string;
  email?: string;
}): Promise<boolean> {
  if (!args.checkoutUrl) throw new Error('Tickets aren\'t on sale for this event yet.');

  let url = args.checkoutUrl;
  if (args.email) {
    // Prefill the buyer email so the purchase links to their Aura account
    const sep = url.includes('?') ? '&' : '?';
    url = `${url}${sep}email=${encodeURIComponent(args.email)}`;
  }

  if (WebBrowser?.openBrowserAsync) {
    await WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle?.PAGE_SHEET,
      dismissButtonStyle: 'done',
    });
  } else {
    await Linking.openURL(url);
  }
  return true;
}

/** Event ids the signed-in user has actually bought a ticket for. */
export async function fetchMyTicketedEventIds(): Promise<string[]> {
  if (!supabaseEnabled) return [];
  const uid = await getSessionUserId();
  if (!uid) return [];
  const { data, error } = await getSupabase()
    .from('ticket_purchases')
    .select('event_id')
    .eq('user_id', uid)
    .eq('status', 'completed');
  if (error) return [];
  return (data ?? []).map((r: any) => r.event_id).filter(Boolean);
}
