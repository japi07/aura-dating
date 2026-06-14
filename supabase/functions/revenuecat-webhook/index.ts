// Supabase Edge Function: revenuecat-webhook
//
// Receives RevenueCat webhook events and keeps profiles.is_gold /
// gold_expires_at in sync, so server-side gating and other devices always
// know the user's true subscription state.
//
// This is the authoritative sync (the client also writes optimistically for
// instant feedback, but RevenueCat → here is the source of truth).
//
// Setup:
//   1. supabase secrets set REVENUECAT_WEBHOOK_SECRET=<a-long-random-string>
//   2. Deploy: npx supabase functions deploy revenuecat-webhook --no-verify-jwt
//   3. In RevenueCat → Project → Webhooks, add:
//        URL: https://<ref>.supabase.co/functions/v1/revenuecat-webhook
//        Authorization header: <the same long-random-string>
//
// RevenueCat does NOT send a Supabase JWT, so this function must be deployed
// with verify_jwt = false (see supabase/config.toml).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ENTITLEMENT = Deno.env.get('REVENUECAT_ENTITLEMENT') ?? 'gold';

// Event types that mean the subscription is no longer active
const INACTIVE_TYPES = new Set(['EXPIRATION', 'SUBSCRIPTION_PAUSED']);
// Event types that grant access (when no explicit expiry is present)
const ACTIVE_TYPES = new Set([
  'INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE',
  'UNCANCELLATION', 'NON_RENEWING_PURCHASE', 'SUBSCRIPTION_EXTENDED',
]);

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Shared-secret auth — must match the header configured in RevenueCat
  const expectedSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  if (expectedSecret) {
    const got = req.headers.get('Authorization') ?? '';
    if (got !== expectedSecret) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  try {
    const payload = await req.json();
    const event = payload?.event ?? payload; // RC wraps in { event: {...} }
    const appUserId: string | undefined = event?.app_user_id;
    const type: string = event?.type ?? '';
    const entitlementIds: string[] | undefined = event?.entitlement_ids;
    const expirationMs: number | null = event?.expiration_at_ms ?? null;

    if (!appUserId) {
      return json({ ok: true, note: 'No app_user_id; ignored' });
    }
    // Ignore anonymous RevenueCat ids (user wasn't signed in)
    if (appUserId.startsWith('$RCAnonymousID')) {
      return json({ ok: true, note: 'Anonymous id; ignored' });
    }
    // If the event names entitlements and ours isn't among them, ignore it
    if (entitlementIds && entitlementIds.length > 0 && !entitlementIds.includes(ENTITLEMENT)) {
      return json({ ok: true, note: 'Different entitlement; ignored' });
    }

    // Decide active state
    const now = Date.now();
    let isGold: boolean;
    if (INACTIVE_TYPES.has(type)) {
      isGold = false;
    } else if (expirationMs != null) {
      isGold = expirationMs > now; // CANCELLATION stays active until expiry
    } else {
      isGold = ACTIVE_TYPES.has(type);
    }
    const goldExpiresAt = expirationMs != null ? new Date(expirationMs).toISOString() : null;

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { error } = await admin
      .from('profiles')
      .update({ is_gold: isGold, gold_expires_at: goldExpiresAt })
      .eq('id', appUserId);
    if (error) {
      return json({ ok: false, error: error.message }, 500);
    }

    return json({ ok: true, isGold, type });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
