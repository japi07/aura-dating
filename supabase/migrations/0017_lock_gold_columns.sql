-- Subscription status stops being something a member can assert.
--
-- Found by probing the token system as a real `authenticated` role: the
-- policy `profiles_update_own` permits UPDATE on the whole row, so a member
-- could run
--
--   update profiles set is_gold = true where id = auth.uid();
--   select claim_monthly_tokens();
--
-- and mint the Gold allowance for free. Verified: a balance of 10 became 40.
--
-- The token tables themselves were already sound -- token_accounts,
-- token_ledger and window_entries all revoke writes from authenticated, and
-- the probe confirmed each one refuses. The hole was upstream, in a column
-- those functions trusted.
--
-- RLS filters rows, never columns, so a policy cannot express "this row is
-- yours except for these two fields". Column-level privileges can.
--
-- The subtlety that makes this a two-step fix: a TABLE-level UPDATE grant
-- covers every column, and revoking individual columns does not subtract from
-- it. Postgres keeps the two as separate grants, so
--
--   revoke update (is_gold) on profiles from authenticated;
--
-- silently does nothing while the table-level grant stands. The table-level
-- grant has to go first, then every column except the protected pair is
-- granted back.
--
-- Generated from the catalogue rather than hardcoded, so a column added to
-- profiles later stays writable by its owner without anyone remembering to
-- edit this list -- and, more importantly, so this migration cannot silently
-- take away a permission it was never meant to touch.
--
-- The legitimate writer is supabase/functions/revenuecat-webhook, which holds
-- the service role and bypasses all of this. The client also mirror-writes via
-- setMyGoldStatus in lib/profile-supabase.ts; all three call sites in
-- store/subscription.ts already wrap it in try/catch, so it degrades to a
-- silent no-op -- the correct fate for a claim that was never trustworthy.
--
-- Run in the Supabase SQL Editor. Idempotent.

do $$
declare
  v_cols text;
begin
  -- Everything a member may still write on their own row
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into v_cols
    from information_schema.columns
   where table_schema = 'public'
     and table_name   = 'profiles'
     and column_name not in ('is_gold', 'gold_expires_at');

  -- Drop the blanket grant, then hand back the safe columns.
  execute 'revoke update on public.profiles from authenticated';
  execute format('grant update (%s) on public.profiles to authenticated', v_cols);

  -- anon should never have had write access at all.
  execute 'revoke update on public.profiles from anon';
end $$;
