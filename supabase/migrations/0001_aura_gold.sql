-- Aura Gold subscription columns on profiles.
-- Run this in the Supabase SQL Editor (or via `supabase db push`).
-- Idempotent: safe to re-run.

alter table public.profiles add column if not exists is_gold boolean default false;
alter table public.profiles add column if not exists gold_expires_at timestamptz;

-- Note: profiles already allows public select + owner update via existing RLS.
-- The RevenueCat webhook writes these columns with the service role, which
-- bypasses RLS, so no extra policy is needed.
