-- Affiliate-booked experiences in the Events tab.
--
-- These are third-party experiences (Viator now; DesignMyNight / Fever once
-- those affiliate applications are approved). Aura earns a referral
-- commission — the partner handles checkout, tracking and payout, so there's
-- no API key or webhook needed here, just a tracked link.
--
-- Run in the Supabase SQL Editor. Idempotent.

alter table public.events add column if not exists booking_url text;
alter table public.events add column if not exists booking_partner text;

comment on column public.events.booking_url is
  'Full partner URL for booking. Affiliate/campaign params are appended by the app.';
comment on column public.events.booking_partner is
  'Display name of the partner, e.g. Viator, DesignMyNight, Fever.';
