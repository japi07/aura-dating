-- Ticket Tailor integration (Tier 1): buy real event tickets without leaving
-- the app. Aura is the organizer, so the ticket price already includes
-- Aura's margin — no extra commission logic needed here.
--
-- Run in the Supabase SQL Editor. Idempotent.

-- Link an Aura event to its Ticket Tailor event + hosted checkout page.
-- checkout_url is the exact link from Ticket Tailor's dashboard for that
-- event (Box office -> Events -> ... -> Copy link), pasted in by Aura when
-- the event is created — safer than guessing Ticket Tailor's URL pattern.
alter table public.events add column if not exists tickettailor_event_id text;
alter table public.events add column if not exists ticket_checkout_url text;

-- Records of confirmed ticket purchases, matched back to the buyer by email
-- from the Ticket Tailor webhook (order.completed). Idempotent on order id
-- so a retried webhook delivery can't double-count a purchase.
create table if not exists public.ticket_purchases (
  id                  uuid primary key default gen_random_uuid(),
  event_id            uuid references public.events(id) on delete set null,
  user_id             uuid references public.profiles(id) on delete set null,
  tickettailor_order_id text not null unique,
  buyer_email         text not null,
  quantity            int default 1,
  status              text default 'completed' check (status in ('completed', 'refunded', 'cancelled')),
  created_at          timestamptz default now()
);

create index if not exists ticket_purchases_user_idx on public.ticket_purchases(user_id);
create index if not exists ticket_purchases_event_idx on public.ticket_purchases(event_id);

alter table public.ticket_purchases enable row level security;

-- Owner reads their own purchase history
drop policy if exists ticket_purchases_select_own on public.ticket_purchases;
create policy ticket_purchases_select_own on public.ticket_purchases
  for select using (auth.uid() = user_id);

-- Written only by the webhook (service role bypasses RLS) — no insert
-- policy for regular users, so this table can't be faked client-side.
