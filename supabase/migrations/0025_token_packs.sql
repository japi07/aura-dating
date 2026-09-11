-- Tokens you can actually buy.
--
-- Until now tokens only arrived free: ten at signup, thirty a month with Gold.
-- The pay screen's "Get more tokens" button pointed at the Gold paywall, which
-- is not the same thing and, with RevenueCat unconfigured, told the member the
-- feature was not finished yet.
--
-- Packs are consumable in-app purchases. The money and the receipt are Apple's
-- business; what matters here is that the grant happens on the SERVER, keyed
-- to the transaction, and never on a client's say-so. A client that could ask
-- for tokens by asserting it had paid is a client that can print money.
--
-- Amounts live in a table for the same reason prices do: they will change, and
-- changing them should be an UPDATE rather than a deploy. The App Store price
-- of each pack is set in App Store Connect and is deliberately not duplicated
-- here -- two copies of a price is one copy too many.
--
-- Run in the Supabase SQL Editor. Idempotent.

/* --- 1. What each product is worth ------------------------------------ */

create table if not exists public.token_packs (
  product_id text primary key,
  tokens     int  not null check (tokens > 0),
  label      text not null,
  sort_order int  not null default 0,
  active     boolean not null default true
);

insert into public.token_packs (product_id, tokens, label, sort_order) values
  ('com.auradating.tokens.5',  5,  'A few nights',   1),
  ('com.auradating.tokens.15', 15, 'A fortnight',    2),
  ('com.auradating.tokens.40', 40, 'A proper month', 3)
on conflict (product_id) do nothing;

alter table public.token_packs enable row level security;

-- Readable so the app can show what each pack contains; writable by nobody.
drop policy if exists token_packs_read on public.token_packs;
create policy token_packs_read on public.token_packs
  for select using (auth.uid() is not null);

revoke insert, update, delete on public.token_packs from authenticated, anon;

/* --- 2. Granting what was bought -------------------------------------- */
-- Called only by the RevenueCat webhook, which runs with the service role and
-- has already had Apple verify the receipt. Never exposed to `authenticated`:
-- there is no version of this that a client should be able to call.
--
-- Idempotent on the transaction id, because a webhook that is delivered twice
-- is a webhook working normally, not a reason to pay someone twice.

create or replace function public.grant_tokens_from_purchase(
  p_user           uuid,
  p_product_id     text,
  p_transaction_id text
) returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_tokens int;
  v_after  int;
begin
  if p_user is null or p_transaction_id is null then
    raise exception 'user and transaction are both required';
  end if;

  select tokens into v_tokens
    from public.token_packs
   where product_id = p_product_id and active;

  if v_tokens is null then
    -- An unknown product is not an error worth failing the webhook over --
    -- it is most likely a subscription event arriving here by mistake --
    -- but it must never silently grant anything.
    return 0;
  end if;

  insert into public.token_accounts (user_id, balance) values (p_user, 0)
  on conflict (user_id) do nothing;

  begin
    update public.token_accounts
       set balance = balance + v_tokens, updated_at = now()
     where user_id = p_user
    returning balance into v_after;

    insert into public.token_ledger
      (user_id, delta, reason, ref_type, ref_id, balance_after)
    values
      (p_user, v_tokens, 'purchase', 'transaction', p_transaction_id, v_after);
  exception when unique_violation then
    -- This transaction has already been granted. The failed ledger insert
    -- rolled the balance bump back with it, so there is nothing to undo.
    select balance into v_after from public.token_accounts where user_id = p_user;
    return 0;
  end;

  return v_tokens;
end;
$fn$;

-- Deliberately NOT granted to authenticated. The service role bypasses this.
revoke execute on function public.grant_tokens_from_purchase(uuid, text, text)
  from public, anon, authenticated;
