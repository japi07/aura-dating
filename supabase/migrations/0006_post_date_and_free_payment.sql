-- 1. Allow "nothing to pay" dates (a walk, a free exhibition).
-- 2. Post-date follow-up: after the date, each person says within 24h whether
--    they'd like to exchange numbers. Kept per-user so neither sees the
--    other's answer unless both said yes.
-- Run this in the Supabase SQL Editor. Idempotent.

alter table public.proposals drop constraint if exists proposals_payment_check;
alter table public.proposals add constraint proposals_payment_check
  check (payment in ('he-pays', 'split', 'she-pays', 'free'));

alter table public.dates add column if not exists user_a_interest text;
alter table public.dates add column if not exists user_b_interest text;

alter table public.dates drop constraint if exists dates_user_a_interest_check;
alter table public.dates add constraint dates_user_a_interest_check
  check (user_a_interest is null or user_a_interest in ('yes', 'no', 'already'));

alter table public.dates drop constraint if exists dates_user_b_interest_check;
alter table public.dates add constraint dates_user_b_interest_check
  check (user_b_interest is null or user_b_interest in ('yes', 'no', 'already'));
