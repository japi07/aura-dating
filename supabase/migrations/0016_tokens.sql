-- Tokens: you buy your place in tonight's window.
--
-- The shape of the product changes slightly here, and it is worth being
-- explicit about it. Until now the window gated the *action*: outside the
-- hours you simply could not join a queue. Now you can commit at any hour --
-- you pick a mode, you see the price, you pay, and that buys you a ticket for
-- the next window. The window stops being a lock on the button and becomes
-- the moment the thing you already paid for actually happens.
--
-- That is a better fit for a two-hour evening slot: deciding at three in the
-- afternoon that you want a blind date tonight is exactly the commitment the
-- product wants, and making someone remember to reopen the app at seven to
-- express it was throwing that intent away.
--
-- Everything tunable lives in token_settings rather than in code, because the
-- three prices are explicitly meant to diverge later (calls cheapest, blind
-- dates more, curated dates most) and that should be an UPDATE, not a deploy.
--
-- Run in the Supabase SQL Editor. Idempotent.

/* --- 1. Every knob in one place ------------------------------------- */

create table if not exists public.token_settings (
  key   text primary key,
  value int  not null check (value >= 0),
  note  text
);

-- Seeded, never overwritten: re-running this migration must not undo a price
-- change made in production.
insert into public.token_settings (key, value, note) values
  ('price_call',           1, 'Cost to queue for a live call'),
  ('price_blind',          1, 'Cost to enter the blind date pool'),
  ('price_proposal',       1, 'Cost to send a curated proposal'),
  ('grant_signup',        10, 'Free tokens on first launch, for the trial'),
  ('grant_monthly_free',   0, 'Monthly allowance, no subscription'),
  ('grant_monthly_gold',  30, 'Monthly allowance, Gold subscribers')
on conflict (key) do nothing;

alter table public.token_settings enable row level security;

-- Prices are public knowledge; the payment screen has to show them.
drop policy if exists token_settings_read on public.token_settings;
create policy token_settings_read on public.token_settings
  for select using (auth.uid() is not null);

/* --- 2. The balance ------------------------------------------------- */
-- The non-negative invariant is a column constraint rather than a rule the
-- application remembers to apply. Spending is a conditional UPDATE, so two
-- concurrent spends cannot both pass the check.

create table if not exists public.token_accounts (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  balance    int  not null default 0 check (balance >= 0),
  updated_at timestamptz default now()
);

alter table public.token_accounts enable row level security;

-- Readable by its owner, writable by nobody: every mutation goes through the
-- functions below, which are the only things that also write the ledger.
drop policy if exists token_accounts_own on public.token_accounts;
create policy token_accounts_own on public.token_accounts
  for select using (auth.uid() = user_id);

revoke insert, update, delete on public.token_accounts from authenticated;

/* --- 3. The ledger -------------------------------------------------- */
-- Append-only, and the balance is reconstructible from it. Anything that
-- touches money needs to be able to answer "why is it this number" months
-- later, and a bare integer column cannot.

create table if not exists public.token_ledger (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  delta         int  not null,
  reason        text not null,
  -- Never null: every row is keyed to something, which is what makes the
  -- idempotency index below total rather than partial.
  ref_type      text not null,
  ref_id        text not null,
  balance_after int  not null,
  created_at    timestamptz default now()
);

create index if not exists token_ledger_user_idx
  on public.token_ledger(user_id, created_at desc);

-- The one thing protecting against double-charging. A retried request, a
-- double tap, a webhook delivered twice: all collide here instead of costing
-- someone tokens twice.
create unique index if not exists token_ledger_idem
  on public.token_ledger(user_id, reason, ref_type, ref_id);

alter table public.token_ledger enable row level security;

drop policy if exists token_ledger_own on public.token_ledger;
create policy token_ledger_own on public.token_ledger
  for select using (auth.uid() = user_id);

revoke insert, update, delete on public.token_ledger from authenticated;

/* --- 4. The ticket -------------------------------------------------- */

create table if not exists public.window_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  mode        text not null check (mode in ('call', 'blind', 'proposal')),
  -- Which night this buys. Not a timestamp: two people who paid nine hours
  -- apart are queued for the same window and must compare equal.
  window_date date not null,
  status      text not null default 'queued'
                check (status in ('queued', 'used', 'expired', 'refunded')),
  tokens_paid int  not null,
  created_at  timestamptz default now(),
  used_at     timestamptz
);

create index if not exists window_entries_lookup_idx
  on public.window_entries(user_id, window_date, mode);

-- One live ticket per mode per night. Partial, so a refunded ticket does not
-- stop someone buying again.
create unique index if not exists window_entries_one_per_night
  on public.window_entries(user_id, mode, window_date)
  where status in ('queued', 'used');

alter table public.window_entries enable row level security;

drop policy if exists window_entries_own on public.window_entries;
create policy window_entries_own on public.window_entries
  for select using (auth.uid() = user_id);

drop policy if exists window_entries_admin on public.window_entries;
create policy window_entries_admin on public.window_entries
  for select using (public.is_admin());

revoke insert, update, delete on public.window_entries from authenticated;

/* --- 5. Which night are we selling? --------------------------------- */
-- Mirrors WINDOW_CLOSE_HOUR in lib/daily-window.ts. Only the closing hour
-- matters here: before it, tonight's window is still ahead or in progress and
-- a ticket is for today; after it, the next one is tomorrow. The opening hour
-- decides whether the window is *open*, which is a different question and one
-- the client already answers.
--
-- Keep the 21 below in step with WINDOW_CLOSE_HOUR if that ever moves.

create or replace function public.current_window_date()
returns date
language sql
stable
set search_path = public
as $fn$
  select case
    when extract(hour from (now() at time zone 'Europe/London')) < 21
      then (now() at time zone 'Europe/London')::date
    else ((now() at time zone 'Europe/London') + interval '1 day')::date
  end;
$fn$;

grant execute on function public.current_window_date() to authenticated;

/* --- 6. Opening an account, and the trial grant --------------------- */
-- Called on launch. Creates the account if missing and pays in the free
-- tokens exactly once -- the ledger's unique index is what makes "exactly
-- once" true even if two launches race.

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
      -- Nothing to undo, and undoing would be the bug: an exception handler
      -- in PL/pgSQL rolls its whole BEGIN block back to an implicit
      -- savepoint, so the balance bump above is already gone by the time we
      -- get here. A compensating subtraction would take the tokens a second
      -- time and zero a real balance on the user's second launch.
      null;
    end;
  end if;

  select balance into v_after from public.token_accounts where user_id = v_uid;
  return coalesce(v_after, 0);
end;
$fn$;

grant execute on function public.ensure_token_account() to authenticated;

/* --- 7. The monthly allowance --------------------------------------- */
-- Tier-aware, though today there are only two tiers. Idempotent per calendar
-- month via the ledger key, so calling it on every launch is harmless.

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

  select coalesce(is_gold, false) into v_gold from public.profiles where id = v_uid;

  select value into v_amount
    from public.token_settings
   where key = case when v_gold then 'grant_monthly_gold' else 'grant_monthly_free' end;
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
    -- bump down with it -- see the note in ensure_token_account -- so there
    -- is deliberately nothing to compensate for here.
    null;
  end;

  select balance into v_after from public.token_accounts where user_id = v_uid;
  return coalesce(v_after, 0);
end;
$fn$;

grant execute on function public.claim_monthly_tokens() to authenticated;

/* --- 8. Buying a ticket --------------------------------------------- */
-- The whole thing is one transaction: if the spend fails for want of balance,
-- the ticket insert above it rolls back with it and nobody is half-queued.
--
-- Deliberately idempotent rather than erroring on a second call. A double tap
-- on "Pay" means "I want to be queued", and the honest answer to the second
-- one is the ticket bought by the first.

-- The old RETURNS TABLE signature has to be dropped before the new one can
-- land: Postgres will not replace a function whose OUT parameters changed.
drop function if exists public.purchase_window_entry(text);
-- Returns jsonb rather than a table. RETURNS TABLE would put "mode",
-- "status" and "balance" in scope as OUT parameters, where they silently
-- shadow the identically-named columns of window_entries and
-- token_accounts -- Postgres rejects the ambiguity at runtime, and only on
-- the paths that touch them. One object avoids the whole class of it.

create or replace function public.purchase_window_entry(p_mode text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid   uuid := auth.uid();
  v_date  date := public.current_window_date();
  v_cost  int;
  v_entry public.window_entries%rowtype;
  v_after int;
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;
  if p_mode not in ('call', 'blind', 'proposal') then
    raise exception 'Unknown mode: %', p_mode;
  end if;

  -- Already holding a ticket for tonight? Hand it back unchanged.
  select we.* into v_entry
    from public.window_entries we
   where we.user_id = v_uid and we.mode = p_mode and we.window_date = v_date
     and we.status in ('queued', 'used')
   limit 1;

  if found then
    select ta.balance into v_after
      from public.token_accounts ta where ta.user_id = v_uid;
    return jsonb_build_object(
      'entryId', v_entry.id,
      'mode', v_entry.mode,
      'windowDate', v_entry.window_date,
      'status', v_entry.status,
      'tokensPaid', v_entry.tokens_paid,
      'balance', coalesce(v_after, 0),
      'alreadyHad', true
    );
  end if;

  select ts.value into v_cost
    from public.token_settings ts
   where ts.key = 'price_' || p_mode;
  v_cost := coalesce(v_cost, 1);

  insert into public.token_accounts (user_id, balance) values (v_uid, 0)
  on conflict (user_id) do nothing;

  -- Conditional UPDATE rather than read-then-write: the row lock and the
  -- balance test happen together, so two taps racing cannot both succeed on
  -- the last token.
  update public.token_accounts ta
     set balance = ta.balance - v_cost, updated_at = now()
   where ta.user_id = v_uid and ta.balance >= v_cost
  returning ta.balance into v_after;

  if not found then
    raise exception 'NOT_ENOUGH_TOKENS';
  end if;

  insert into public.window_entries (user_id, mode, window_date, tokens_paid)
  values (v_uid, p_mode, v_date, v_cost)
  returning * into v_entry;

  insert into public.token_ledger (user_id, delta, reason, ref_type, ref_id, balance_after)
  values (v_uid, -v_cost, 'spend_' || p_mode, 'entry', v_entry.id::text, v_after);

  return jsonb_build_object(
    'entryId', v_entry.id,
    'mode', v_entry.mode,
    'windowDate', v_entry.window_date,
    'status', v_entry.status,
    'tokensPaid', v_entry.tokens_paid,
    'balance', v_after,
    'alreadyHad', false
  );
end;
$fn$;

grant execute on function public.purchase_window_entry(text) to authenticated;

/* --- 9. Giving it back ---------------------------------------------- */
-- For leaving the blind pool before being matched, or a call queue that never
-- found anyone. Refunding is a new ledger row, never an edit to the old one.

create or replace function public.refund_window_entry(p_entry_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid   uuid := auth.uid();
  v_entry public.window_entries%rowtype;
  v_after int;
begin
  select * into v_entry from public.window_entries where id = p_entry_id;
  if not found then
    raise exception 'Entry not found';
  end if;
  if v_entry.user_id <> v_uid then
    raise exception 'Not your entry';
  end if;
  if v_entry.status <> 'queued' then
    -- Already used or already refunded. Not an error: the caller wanted the
    -- ticket gone and it is.
    select balance into v_after from public.token_accounts where user_id = v_uid;
    return coalesce(v_after, 0);
  end if;

  update public.window_entries set status = 'refunded' where id = p_entry_id;

  update public.token_accounts
     set balance = balance + v_entry.tokens_paid, updated_at = now()
   where user_id = v_uid
  returning balance into v_after;

  insert into public.token_ledger (user_id, delta, reason, ref_type, ref_id, balance_after)
  values (v_uid, v_entry.tokens_paid, 'refund_' || v_entry.mode, 'entry', p_entry_id::text, v_after);

  return v_after;
end;
$fn$;

grant execute on function public.refund_window_entry(uuid) to authenticated;

/* --- 10. Everything the app needs in one round trip ----------------- */

create or replace function public.token_state()
returns jsonb
language sql
stable
security definer
set search_path = public
as $fn$
  select jsonb_build_object(
    'balance', coalesce((select balance from public.token_accounts where user_id = auth.uid()), 0),
    'windowDate', public.current_window_date(),
    'prices', coalesce((
      select jsonb_object_agg(replace(key, 'price_', ''), value)
        from public.token_settings where key like 'price_%'
    ), '{}'::jsonb),
    'entries', coalesce((
      select jsonb_object_agg(mode, jsonb_build_object(
               'id', id, 'status', status, 'tokensPaid', tokens_paid))
        from public.window_entries
       where user_id = auth.uid()
         and window_date = public.current_window_date()
         and status in ('queued', 'used')
    ), '{}'::jsonb)
  );
$fn$;

grant execute on function public.token_state() to authenticated;

create or replace function public.token_history(p_limit int default 40)
returns table (
  delta      int,
  reason     text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $fn$
  select delta, reason, created_at
    from public.token_ledger
   where user_id = auth.uid()
   order by created_at desc
   limit least(coalesce(p_limit, 40), 200);
$fn$;

grant execute on function public.token_history(int) to authenticated;

/* --- 11. Marking a ticket spent ------------------------------------- */
-- Called when the thing actually happens: a call connects, the blind pool
-- takes you, a proposal goes out. Keeps a used ticket from being refunded
-- afterwards.

create or replace function public.consume_window_entry(p_mode text)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return false;
  end if;

  update public.window_entries
     set status = 'used', used_at = now()
   where user_id = v_uid
     and mode = p_mode
     and window_date = public.current_window_date()
     and status = 'queued';

  return found;
end;
$fn$;

grant execute on function public.consume_window_entry(text) to authenticated;
