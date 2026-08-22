-- A switch that makes every mode testable, at any hour, with two accounts.
--
-- Three separate gates were stopping a two-person test from ever matching,
-- and none of them was the clock:
--
--   1. Both test profiles are `unverified`, and both matchers require
--      verification_status = 'verified' on BOTH sides. That alone is a total
--      block on calls and blind dates.
--   2. The age gate added in 0015 is mutual and strict. One tester asking for
--      28-38 while the other is 26 means they can never be paired, however
--      long they wait.
--   3. The blind matcher only runs when someone presses "Run matcher" in the
--      ops console -- there is no scheduler in this project -- so the pool
--      just sits there.
--
-- test_mode relaxes 1 and 2. It does NOT relax anything about who can see
-- whom, what is written, or who may spend tokens: it only stops the matcher
-- refusing a pair it would otherwise accept. The third is fixed in the client,
-- which now runs the matcher while you wait.
--
-- Turn it off before real members arrive:
--   update public.token_settings set value = 0 where key = 'test_mode';
--
-- Run in the Supabase SQL Editor. Idempotent.

insert into public.token_settings (key, value, note) values
  ('test_mode', 1, 'Matchers ignore verification and age. Set to 0 for real members.')
on conflict (key) do nothing;

-- Readable without a round trip through token_settings' shape, and callable
-- from the Edge Functions with the service role.
create or replace function public.is_test_mode()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce((select value from public.token_settings where key = 'test_mode'), 0) = 1;
$fn$;

grant execute on function public.is_test_mode() to authenticated, anon;
