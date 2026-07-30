# Ticket Tailor setup — selling event tickets in Aura

Built and deployed. Ticket buying stays dormant (events just show a free RSVP)
until the steps below are done.

## How the money works

**Aura is the organizer**, so you set the ticket price and keep the margin.
If an event costs you £8/head, list it at £12 and you keep £4 per ticket —
Ticket Tailor's own docs confirm you can add any booking fee you like and keep
the full face value. There's no separate commission code in the app; the margin
is simply your pricing.

**Apple doesn't take a cut.** Event tickets are real-world services consumed
outside the app, so App Store guideline 3.1.3(e) requires normal payment
methods rather than in-app purchase. No 30%.

## What was built

| Piece | What it does |
|-------|--------------|
| `ticket-availability` Edge Function | Reads live price + tickets remaining from Ticket Tailor (API key stays server-side) |
| `tickettailor-webhook` Edge Function | On a completed order, records the purchase and marks the buyer as going |
| `lib/tickets-supabase.ts` | App-side availability, in-app checkout, "did I buy?" lookup |
| Events tab | Shows live price/remaining, a "Ticketed" badge, and "Get tickets · £12" |
| `ticket_purchases` table | Purchase history, unique per Ticket Tailor order (safe against retries) |

The buyer never leaves Aura: checkout opens in an **in-app browser sheet**.

---

## Setup

### 1. Database
Run `supabase/migrations/0008_ticket_tailor.sql` in the SQL Editor.

### 2. Ticket Tailor API key
Ticket Tailor → **Box office settings → API → Generate a new key**, then:
```
npx supabase secrets set TICKETTAILOR_API_KEY=<key> --project-ref krkibouizxurqboyahon
```

### 3. Webhook
Pick a long random string as a secret, then:
```
npx supabase secrets set TICKETTAILOR_WEBHOOK_SECRET=<secret> --project-ref krkibouizxurqboyahon
```
In Ticket Tailor → **Box office settings → Webhooks**, add:
- URL: `https://krkibouizxurqboyahon.supabase.co/functions/v1/tickettailor-webhook`
- Secret: the same string
- Events: order created / completed (and refunded if offered)

⚠️ Confirm the header name Ticket Tailor uses to send the secret. The function
accepts `Webhook-Secret` or `X-Webhook-Secret`; if theirs differs, tell Claude
and it's a one-line change in `verifyDeliverySecret`.

### 4. Link an Aura event to its Ticket Tailor event
Create the event in Ticket Tailor, copy its **event id** and its **public
checkout URL**, then in the SQL Editor:

```sql
update public.events
set tickettailor_event_id = 'ev_XXXXXXXX',
    ticket_checkout_url   = 'https://www.tickettailor.com/events/your-box-office/1234567'
where title = 'Pint of Knowledge';
```

That's it — the event immediately shows live pricing and a "Get tickets"
button. Events without these two fields keep the existing free RSVP flow.

### 5. New build
`expo-web-browser` is a native module, so the in-app checkout sheet needs a
fresh build. Until then the checkout opens in the system browser instead —
functional, just less seamless.

---

## Testing

1. Make a cheap test event in Ticket Tailor (e.g. £0.50) and link it as above.
2. Buy a ticket in the app using the email of an Aura test account.
3. Check `ticket_purchases` for the row, and that the event shows
   "✓ Ticket booked" after a pull-to-refresh.

If the purchase doesn't appear, look at the webhook logs:
Supabase → Functions → `tickettailor-webhook` → Logs.
