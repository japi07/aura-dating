-- Let the sender offer up to three date/time slots so the recipient can pick
-- whichever suits their availability.
--
-- starts_at stays the source of truth for the confirmed time: it holds the
-- first proposed slot until the recipient accepts, at which point it's set to
-- the slot they chose (the accept trigger then copies it onto the date row).
--
-- Run in the Supabase SQL Editor. Idempotent.

alter table public.proposals
  add column if not exists date_options timestamptz[] default '{}';

comment on column public.proposals.date_options is
  'All slots offered by the sender. starts_at holds the chosen/first one.';
