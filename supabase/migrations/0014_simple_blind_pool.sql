-- Blind dates become one button.
--
-- 0011 asked for areas, styles, budget, a date range and time bands before
-- anyone could join the pool. That is a lot of form for a mode whose whole
-- pitch is "we decide, you turn up", and it made the pool thin: two people
-- only matched if their answers overlapped on several axes at once, which in
-- a young market means almost never.
--
-- The preferences become optional rather than deleted. Existing signups keep
-- their answers, the concierge console still reads whatever is there, and the
-- columns are free for a later version that asks again once there are enough
-- people for filtering to help rather than hurt.
--
-- Run in the Supabase SQL Editor. Idempotent.

/* --- 1. Nothing is required any more -------------------------------- */

alter table public.blind_date_signups
  alter column available_from drop not null,
  alter column available_to   drop not null;

-- A signup with no stated window means "whenever you plan it", which in
-- practice is the next fortnight. Defaults rather than nulls so the ops
-- console keeps showing a real range to book inside.
alter table public.blind_date_signups
  alter column available_from set default current_date,
  alter column available_to   set default (current_date + 14);

-- The sanity check compares two nullable columns now; a null comparison is
-- null, which passes, so old rows and new ones are both fine.

/* --- 2. Pool size has to cross the RLS boundary --------------------- */
-- blind_signups_own restricts the table to your own rows, so the count the
-- app was doing could only ever return 0 or 1 -- it was counting the caller.
-- Same shape of bug as the call queue, same fix: one integer, no identities.

create or replace function public.blind_pool_size()
returns int
language sql
stable
security definer
set search_path = public
as $fn$
  select count(*)::int
    from public.blind_date_signups
   where status = 'waiting';
$fn$;

grant execute on function public.blind_pool_size() to authenticated;

/* --- 3. Joining is idempotent --------------------------------------- */
-- One tap, and tapping again is not an error. The partial unique index
-- already allows a single waiting row per person; this turns the resulting
-- 23505 into "you are already in", which is what the member means anyway.

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

  insert into public.blind_date_signups (user_id, status)
  values (auth.uid(), 'waiting')
  returning id into created;

  return created;
end;
$fn$;

grant execute on function public.join_blind_pool() to authenticated;
