-- Trial tokens arrive with the account, not when the app remembers to ask.
--
-- Reported as "new users have no tokens", and the database agreed: one
-- profile, zero token accounts, zero signup grants ever written.
--
-- The function itself was never the problem — called directly it grants ten
-- exactly as intended. The problem is that it was only ever called from the
-- client, at the worst possible moment, through this:
--
--   try {
--     await getSupabase().rpc('ensure_token_account');
--     ...
--   } catch {
--     return 0;   // "the next launch will do it"
--   }
--
-- ensure_token_account raises 'Not signed in' when auth.uid() is null. On a
-- brand-new account the Meet tab can mount while the session is still
-- settling, so the call raises, the catch swallows it, and the store then
-- renders balance 0 as though that were a fact rather than a failed request.
-- Nothing surfaces. The member sees an empty wallet and no explanation, and
-- since the failure is silent nobody knows to retry.
--
-- A grant that depends on a client call succeeding at a specific instant is
-- not a grant, it is a hope. This moves it to the one place that cannot be
-- skipped: the row's own creation.
--
-- Run in the Supabase SQL Editor. Idempotent.

/* --- 1. Opening an account, given a user id ---------------------------- */
-- Separate from ensure_token_account because a trigger has no auth.uid() to
-- read -- it has NEW.id, which is better: it cannot be wrong about who it is
-- granting to.

create or replace function public.open_token_account(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_amount int;
  v_after  int;
begin
  if p_user is null then
    return;
  end if;

  insert into public.token_accounts (user_id, balance)
  values (p_user, 0)
  on conflict (user_id) do nothing;

  select value into v_amount from public.token_settings where key = 'grant_signup';
  v_amount := coalesce(v_amount, 0);
  if v_amount <= 0 then
    return;
  end if;

  begin
    update public.token_accounts
       set balance = balance + v_amount, updated_at = now()
     where user_id = p_user
    returning balance into v_after;

    insert into public.token_ledger (user_id, delta, reason, ref_type, ref_id, balance_after)
    values (p_user, v_amount, 'signup_grant', 'signup', p_user::text, v_after);
  exception when unique_violation then
    -- Already granted. The failed ledger insert took the balance bump down
    -- with it -- an exception handler rolls its whole block back to an
    -- implicit savepoint -- so there is deliberately nothing to undo here.
    null;
  end;
end;
$fn$;

/* --- 2. Every new profile gets one ------------------------------------- */
-- On profiles rather than auth.users, because token_accounts references
-- profiles(id): hanging it off the earlier table would race its own foreign
-- key. handle_new_user already guarantees a profile row exists for every
-- account, so this fires for all of them.

create or replace function public.tg_profile_opens_token_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  perform public.open_token_account(new.id);
  return new;
end;
$fn$;

drop trigger if exists profile_opens_token_account on public.profiles;
create trigger profile_opens_token_account
  after insert on public.profiles
  for each row execute function public.tg_profile_opens_token_account();

/* --- 3. Everyone who already missed out -------------------------------- */
-- Members who signed up while the grant depended on a client call that could
-- fail silently. The ledger key makes this safe to re-run.

do $$
declare
  v_row record;
  v_n   int := 0;
begin
  for v_row in
    select p.id from public.profiles p
     where not exists (
       select 1 from public.token_ledger l
        where l.user_id = p.id and l.reason = 'signup_grant'
     )
  loop
    perform public.open_token_account(v_row.id);
    v_n := v_n + 1;
  end loop;

  raise notice 'backfilled % account(s)', v_n;
end $$;

/* --- 4. Keep the client path, but as a safety net ---------------------- */
-- ensure_token_account stays: it still sweeps expired entries and claims the
-- monthly allowance, and it now finds the account already open. It is no
-- longer the thing standing between a new member and their first token.
