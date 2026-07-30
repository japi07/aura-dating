// Supabase Edge Function: tickettailor-webhook
//
// Receives Ticket Tailor order events and records the purchase, matching the
// buyer back to an Aura account by email. Also upserts an event_rsvp so the
// person shows as "going" in the app the moment they've paid — no manual
// confirmation needed.
//
// Setup:
//   supabase secrets set TICKETTAILOR_WEBHOOK_SECRET=<from Ticket Tailor>
//   npx supabase functions deploy tickettailor-webhook --no-verify-jwt
//   Ticket Tailor -> Box office settings -> Webhooks -> add:
//     https://<ref>.supabase.co/functions/v1/tickettailor-webhook
//
// Deployed with verify_jwt = false (Ticket Tailor doesn't send a Supabase
// JWT). Ticket Tailor signs webhook payloads with a secret configured in
// their dashboard — check developers.tickettailor.com/docs for the current
// header/signature scheme and adjust verifyDeliverySecret() to match if it
// differs from the shared-secret header assumed below.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const rawBody = await req.text();

  const expectedSecret = Deno.env.get('TICKETTAILOR_WEBHOOK_SECRET');
  if (expectedSecret) {
    // Ticket Tailor sends the configured secret back in a header so you can
    // confirm the call really came from them. Confirm the exact header name
    // in their dashboard when you set up the webhook and adjust if needed.
    const got = req.headers.get('Webhook-Secret') || req.headers.get('X-Webhook-Secret');
    if (got !== expectedSecret) return new Response('Unauthorized', { status: 401 });
  }

  try {
    const body = JSON.parse(rawBody);
    // Ticket Tailor wraps the order under different keys depending on event
    // type; handle the common shapes defensively.
    const eventName: string = body?.event ?? body?.type ?? '';
    const order = body?.payload?.order ?? body?.order ?? body?.payload ?? body;

    if (!/order/i.test(eventName) && !order?.id) {
      return json({ ok: true, note: 'ignored non-order event' });
    }

    const ttOrderId: string | undefined = order?.id ?? order?.order_id;
    const buyerEmail: string | undefined =
      order?.buyer_details?.email ?? order?.email ?? order?.buyer_email;
    const ttEventId: string | undefined = order?.event_id ?? order?.event?.id;
    const quantity: number =
      Array.isArray(order?.issued_tickets) ? order.issued_tickets.length
      : Array.isArray(order?.tickets) ? order.tickets.length
      : 1;
    const isCancelled = /cancel|refund/i.test(eventName);

    if (!ttOrderId || !buyerEmail) {
      return json({ ok: true, note: 'missing order id or buyer email' });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Match the buyer to an Aura account and the order to an Aura event
    const [{ data: profile }, { data: auraEvent }] = await Promise.all([
      admin.from('profiles').select('id').eq('email', buyerEmail.toLowerCase().trim()).maybeSingle(),
      ttEventId
        ? admin.from('events').select('id').eq('tickettailor_event_id', ttEventId).maybeSingle()
        : Promise.resolve({ data: null } as any),
    ]);

    const { error: upsertError } = await admin
      .from('ticket_purchases')
      .upsert({
        tickettailor_order_id: ttOrderId,
        buyer_email: buyerEmail.toLowerCase().trim(),
        event_id: auraEvent?.id ?? null,
        user_id: profile?.id ?? null,
        quantity,
        status: isCancelled ? 'refunded' : 'completed',
      }, { onConflict: 'tickettailor_order_id' });
    if (upsertError) throw upsertError;

    // If we recognised both the buyer and the event, mark them as going
    if (profile?.id && auraEvent?.id && !isCancelled) {
      await admin.from('event_rsvps').upsert(
        { event_id: auraEvent.id, user_id: profile.id },
        { onConflict: 'event_id,user_id' },
      );
    }

    return json({ ok: true, matchedUser: !!profile, matchedEvent: !!auraEvent });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
}
