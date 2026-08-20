-- The payment layer stops being decorative.
--
-- 0016 put a price on every way of meeting, but nothing on the server ever
-- checked for a ticket. `consume_window_entry` was advisory: the client called
-- it *after* the action and was free not to. Every real gate lived in
-- JavaScript on the member's own device, so anyone willing to POST to the REST
-- API directly got all three modes for nothing:
--
--   POST /rest/v1/rpc/join_blind_pool     -- never looked at window_entries
--   POST /rest/v1/call_queue              -- policy only checked auth.uid()
--   POST /rest/v1/proposals               -- policy only checked sender_id
--
-- The threat model was always "a member with the anon key and their own JWT",
-- which is exactly the person this failed to stop. Fixed by moving the check
-- to the place the action actually happens, in the same transaction.
--
-- Two primitives, because "may I start this" and "this is now spent" are
-- different questions and conflating them is what broke the refund promise:
--
--   require_window_entry  -- gate. Does not consume. Leaves refunds possible.
--   spend_window_entry    -- point of no return. Consumes, atomically.
--
-- Blind dates require on joining the pool and spend when the matcher pairs
-- you, so "leave and get your token back" is true for the whole wait. Calls
-- require on queueing and spend on connect. Proposals spend on send, and are
-- deliberately not refundable -- a proposal refunded on rejection would make
-- spraying them free, which is the behaviour the price exists to discourage.
--
-- Run in the Supabase SQL Editor. Idempotent.

/* --- 1. The two primitives ------------------------------------------ */

create or replace function public.require_window_entry(p_mode text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;

  if not exists (
    select 1 from public.window_entries we
     where we.user_id = v_uid
       and we.mode = p_mode
       and we.window_date = public.current_window_date()
       and we.status = 'queued'
  ) then
    raise exception 'NO_ENTRY';
  end if;
end;
$fn$;

grant execute on function public.require_window_entry(text) to authenticated;

-- Consumes. The UPDATE ... where status = 'queued' is the whole lock: two
-- concurrent attempts cannot both match the row, so a ticket is spent once.
create or replace function public.spend_window_entry(p_mode text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;

  update public.window_entries we
     set status = 'used', used_at = now()
   where we.user_id = v_uid
     and we.mode = p_mode
     and we.window_date = public.current_window_date()
     and we.status = 'queued';

  if not found then
    raise exception 'NO_ENTRY';
  end if;
end;
$fn$;

grant execute on function public.spend_window_entry(text) to authenticated;

/* --- 2. Blind pool: require, do not spend --------------------------- */
-- Replaces the 0014 body. The ticket stays 'queued' for the whole wait, which
-- is what makes leaving the pool refundable. The matcher spends it.

create or replace function public.join_blind_pool()
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  existing uuid;
  created  uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select id into existing
    from public.blind_date_signups
   where user_id = auth.uid() and status = 'waiting'
   limit 1;
  if existing is not null then
    return existing;
  end if;

  -- The gate. Raises NO_ENTRY, which the client turns into the pay screen.
  perform public.require_window_entry('blind');

  insert into public.blind_date_signups (user_id, status)
  values (auth.uid(), 'waiting')
  returning id into created;

  return created;
end;
$fn$;

grant execute on function public.join_blind_pool() to authenticated;

/* --- 3. Calls and proposals: triggers ------------------------------- */
-- These two are written by direct table INSERTs from the client, so the check
-- has to live where the row lands rather than in a function the client can
-- decline to call. A BEFORE INSERT trigger runs inside the caller's own
-- transaction: if it raises, the row never exists.

create or replace function public.tg_call_queue_requires_entry()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  -- Service-role inserts (the matcher, ops tooling) carry no JWT and are not
  -- the thing being guarded here.
  if auth.uid() is null then
    return new;
  end if;
  if new.user_id <> auth.uid() then
    return new;
  end if;

  perform public.require_window_entry('call');
  return new;
end;
$fn$;

drop trigger if exists call_queue_requires_entry on public.call_queue;
create trigger call_queue_requires_entry
  before insert on public.call_queue
  for each row execute function public.tg_call_queue_requires_entry();

-- A proposal is the point of no return: it is sent, it cannot be unsent, and
-- it is deliberately not refunded. So this spends rather than requires.
create or replace function public.tg_proposal_spends_entry()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.sender_id <> auth.uid() then
    return new;
  end if;

  perform public.spend_window_entry('proposal');
  return new;
end;
$fn$;

drop trigger if exists proposal_spends_entry on public.proposals;
create trigger proposal_spends_entry
  before insert on public.proposals
  for each row execute function public.tg_proposal_spends_entry();

/* --- 4. Tickets that were never used -------------------------------- */
-- 'expired' was a legal status that nothing ever wrote, and token_state only
-- reports the current night, so a ticket bought at 20:45 and left unused
-- became invisible AND unrefundable the moment the clock rolled: the client
-- no longer knew its id, and consume/refund both key on the current date. The
-- token was destroyed silently, with a ledger showing a spend and no refund.
--
-- There is no scheduler in this project, so the sweep is lazy: it runs on
-- launch, inside a function every client already calls. Refunding rather than
-- merely expiring is the honest choice -- they did not get what they paid for.

create or replace function public.sweep_stale_entries()
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid   uuid := auth.uid();
  v_row   record;
  v_after int;
  v_n     int := 0;
begin
  if v_uid is null then
    return 0;
  end if;

  for v_row in
    select id, tokens_paid, mode
      from public.window_entries
     where user_id = v_uid
       and status = 'queued'
       and window_date < public.current_window_date()
     for update
  loop
    update public.window_entries set status = 'expired' where id = v_row.id;

    if v_row.tokens_paid > 0 then
      update public.token_accounts
         set balance = balance + v_row.tokens_paid, updated_at = now()
       where user_id = v_uid
      returning balance into v_after;

      insert into public.token_ledger
        (user_id, delta, reason, ref_type, ref_id, balance_after)
      values
        (v_uid, v_row.tokens_paid, 'refund_unused', 'entry', v_row.id::text, v_after);
    end if;

    v_n := v_n + 1;
  end loop;

  return v_n;
end;
$fn$;

grant execute on function public.sweep_stale_entries() to authenticated;

/* --- 5. Launch does the sweep --------------------------------------- */

create or replace function public.ensure_token_account()
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid    uuid := auth.uid();
  v_amount int;
  v_after  int;
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;

  insert into public.token_accounts (user_id, balance)
  values (v_uid, 0)
  on conflict (user_id) do nothing;

  select value into v_amount from public.token_settings where key = 'grant_signup';
  v_amount := coalesce(v_amount, 0);

  if v_amount > 0 then
    begin
      update public.token_accounts
         set balance = balance + v_amount, updated_at = now()
       where user_id = v_uid
      returning balance into v_after;

      insert into public.token_ledger (user_id, delta, reason, ref_type, ref_id, balance_after)
      values (v_uid, v_amount, 'signup_grant', 'signup', v_uid::text, v_after);
    exception when unique_violation then
      -- Already granted on an earlier launch.
      --
      -- Nothing to undo, and undoing would be the bug: an exception handler in
      -- PL/pgSQL rolls its whole BEGIN block back to an implicit savepoint, so
      -- the balance bump above is already gone by the time we get here. A
      -- compensating subtraction would take the tokens a second time and zero
      -- a real balance on the member's second launch.
      null;
    end;
  end if;

  -- Give back anything bought for a night that has since passed.
  perform public.sweep_stale_entries();

  select balance into v_after from public.token_accounts where user_id = v_uid;
  return coalesce(v_after, 0);
end;
$fn$;

grant execute on function public.ensure_token_account() to authenticated;

/* --- 6. Refunds, hardened ------------------------------------------- */
-- Was the only mutation in 0016 without user_id in its WHERE clause, and had
-- no null-uid guard -- it failed closed only by accident, via a NOT NULL two
-- statements downstream. Now it says so, scopes the UPDATE, takes the row lock
-- explicitly, and reports whether it actually refunded so the client can stop
-- claiming a refund that did not happen.

drop function if exists public.refund_window_entry(uuid);

create or replace function public.refund_window_entry(p_entry_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid   uuid := auth.uid();
  v_entry public.window_entries%rowtype;
  v_after int;
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;

  select we.* into v_entry
    from public.window_entries we
   where we.id = p_entry_id and we.user_id = v_uid
   for update;

  if not found then
    raise exception 'Entry not found';
  end if;

  if v_entry.status <> 'queued' then
    -- Already used, refunded or expired. Not an error, but say plainly that
    -- no money moved: the caller was about to tell someone otherwise.
    select ta.balance into v_after
      from public.token_accounts ta where ta.user_id = v_uid;
    return jsonb_build_object('refunded', false, 'balance', coalesce(v_after, 0));
  end if;

  update public.window_entries set status = 'refunded' where id = p_entry_id;

  update public.token_accounts ta
     set balance = ta.balance + v_entry.tokens_paid, updated_at = now()
   where ta.user_id = v_uid
  returning ta.balance into v_after;

  insert into public.token_ledger (user_id, delta, reason, ref_type, ref_id, balance_after)
  values (v_uid, v_entry.tokens_paid, 'refund_' || v_entry.mode, 'entry', p_entry_id::text, v_after);

  return jsonb_build_object('refunded', true, 'balance', v_after);
end;
$fn$;

grant execute on function public.refund_window_entry(uuid) to authenticated;
revoke execute on function public.refund_window_entry(uuid) from public, anon;

/* --- 7. Gold has to still be Gold ----------------------------------- */
-- gold_expires_at exists precisely to express lapse and was being ignored, so
-- a subscription that ended -- or a webhook delivery that was missed -- kept
-- paying out an allowance every month, indefinitely.

create or replace function public.claim_monthly_tokens()
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid    uuid := auth.uid();
  v_gold   boolean;
  v_amount int;
  v_after  int;
  v_period text := to_char(now() at time zone 'Europe/London', 'YYYY-MM');
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;

  select coalesce(p.is_gold, false)
         and (p.gold_expires_at is null or p.gold_expires_at > now())
    into v_gold
    from public.profiles p
   where p.id = v_uid;

  select value into v_amount
    from public.token_settings
   where key = case when coalesce(v_gold, false) then 'grant_monthly_gold' else 'grant_monthly_free' end;
  v_amount := coalesce(v_amount, 0);

  if v_amount = 0 then
    select balance into v_after from public.token_accounts where user_id = v_uid;
    return coalesce(v_after, 0);
  end if;

  insert into public.token_accounts (user_id, balance) values (v_uid, 0)
  on conflict (user_id) do nothing;

  begin
    update public.token_accounts
       set balance = balance + v_amount, updated_at = now()
     where user_id = v_uid
    returning balance into v_after;

    insert into public.token_ledger (user_id, delta, reason, ref_type, ref_id, balance_after)
    values (v_uid, v_amount, 'monthly_grant', 'period', v_period, v_after);
  exception when unique_violation then
    -- This month is already paid. The failed ledger insert took the balance
    -- bump down with it, so there is deliberately nothing to compensate for.
    null;
  end;

  select balance into v_after from public.token_accounts where user_id = v_uid;
  return coalesce(v_after, 0);
end;
$fn$;

grant execute on function public.claim_monthly_tokens() to authenticated;
