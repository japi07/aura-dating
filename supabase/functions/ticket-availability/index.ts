// Supabase Edge Function: ticket-availability
//
// Reads live ticket types (price, quantity remaining) for a Ticket Tailor
// event, so the Events tab can show real "£8 · 12 left" instead of a static
// number. The Ticket Tailor API key stays server-side — never shipped to
// the app.
//
// Setup:
//   supabase secrets set TICKETTAILOR_API_KEY=<key from Box office -> API>
//   npx supabase functions deploy ticket-availability
//
// Until the key is set, this returns { available: false } so the Events
// tab falls back to the static price/spots already stored in our own table.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const TT_BASE = 'https://api.tickettailor.com/v1';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get('TICKETTAILOR_API_KEY');
    const { ticketTailorEventId } = await req.json();
    if (!ticketTailorEventId) return json({ error: 'ticketTailorEventId required' }, 400);

    if (!apiKey) return json({ available: false, configured: false });

    // HTTP Basic Auth: API key as the username, blank password
    const auth = 'Basic ' + btoa(`${apiKey}:`);

    const res = await fetch(`${TT_BASE}/ticket_types?event_id=${encodeURIComponent(ticketTailorEventId)}`, {
      headers: { Authorization: auth },
    });
    if (!res.ok) {
      const text = await res.text();
      return json({ available: false, configured: true, error: `ticket tailor ${res.status}: ${text}` }, 200);
    }

    const body = await res.json();
    const types = (body?.data ?? []).map((t: any) => ({
      id: t.id,
      name: t.name,
      priceMinor: t.price ?? 0, // minor units (pence)
      currency: t.currency ?? 'GBP',
      quantityRemaining: t.quantity_remaining ?? null,
      soldOut: !!t.sold_out,
    }));

    const totalRemaining = types.reduce((sum: number, t: any) => sum + (t.quantityRemaining ?? 0), 0);
    const cheapest = types.length ? Math.min(...types.map((t: any) => t.priceMinor)) : null;

    return json({
      available: true,
      configured: true,
      ticketTypes: types,
      totalRemaining,
      fromPriceMinor: cheapest,
    });
  } catch (e) {
    return json({ available: false, error: String(e) }, 200);
  }
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
