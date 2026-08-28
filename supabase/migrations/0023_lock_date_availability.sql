-- Nobody can post availability into a date they are not on.
--
-- Found by probing as a real authenticated member who was not a participant.
-- All three of these were reproducible against the live database:
--
--   HOLE  a non-participant inserted availability into someone else's date
--   HOLE  victim is shown the intruder's times as their match's
--   HOLE  planner crashes for both: more than one row returned by a subquery
--
-- Two independent mistakes lined up.
--
-- FIRST, the write side. `date_availability_own` constrains user_id and
-- nothing else:
--
--   for all using (auth.uid() = user_id) with check (auth.uid() = user_id)
--
-- "the row is mine" was mistaken for "the row belongs on a date of mine".
-- submit_date_availability does check participation, but nothing forced
-- writes to go through it -- the default table grants were still live, so
-- the REST endpoint accepted a direct insert naming any date_id.
--
-- Before 0020 that only poisoned the overlap arithmetic. Now the contents
-- are rendered to the victim as "They are free at N times", tappable, and
-- one tap folds a stranger's chosen instants into the victim's own submitted
-- availability -- and from there into what ops books.
--
-- SECOND, the read side, which turned an injection into a denial of service.
-- date_plan_state defines the counterpart as "whoever is not me":
--
--   where a.date_id = d.id and a.user_id <> auth.uid()
--
-- With a foreign row present that matches two rows, and the surrounding
-- scalar subqueries `(select slots from theirs)` raise. The planner screen
-- dies for BOTH real participants, and neither has any way to remove the
-- row that is doing it.
--
-- Fixed on both sides, because either alone leaves a real defect: the read
-- side should never have trusted "not me" to mean "them" even with the write
-- side sealed.
--
-- Run in the Supabase SQL Editor. Idempotent.

/* --- 1. Writes go through the function that checks participation ------- */

revoke insert, update, delete on public.date_availability from authenticated;
revoke insert, update, delete on public.date_availability from anon;

-- The policy still governs reads, and now says what it always meant.
drop policy if exists date_availability_own on public.date_availability;
create policy date_availability_own on public.date_availability
  for select using (
    auth.uid() = user_id
    and exists (
      select 1 from public.dates d
       where d.id = date_id
         and auth.uid() in (d.user_a_id, d.user_b_id)
    )
  );

/* --- 2. "Them" means the other person on the date, not "not me" -------- */

drop function if exists public.date_plan_state(uuid);

create or replace function public.date_plan_state(p_date_id uuid)
returns table (
  date_id         uuid,
  mode            text,
  status          text,
  my_slots        timestamptz[],
  i_submitted     boolean,
  they_submitted  boolean,
  overlap         timestamptz[],
  their_slots     timestamptz[],
  starts_at       timestamptz,
  venue_name      text
)
language sql
stable
security definer
set search_path = public
as $fn$
  with d as (
    select * from public.dates
     where id = p_date_id and auth.uid() in (user_a_id, user_b_id)
  ),
  mine as (
    select a.slots from public.date_availability a, d
     where a.date_id = d.id and a.user_id = auth.uid()
  ),
  theirs as (
    -- Named explicitly. "Anyone who is not me" was one stray row away from
    -- returning two, which the scalar subqueries below cannot survive; and
    -- unique (date_id, user_id) makes this provably single-row.
    select a.slots from public.date_availability a, d
     where a.date_id = d.id
       and a.user_id = case when auth.uid() = d.user_a_id
                            then d.user_b_id else d.user_a_id end
  )
  select
    d.id, d.mode, d.status,
    coalesce((select slots from mine), '{}'),
    exists (select 1 from mine),
    exists (select 1 from theirs),
    coalesce(
      (select array_agg(s order by s)
         from (
           select unnest((select slots from mine))
           intersect
           select unnest((select slots from theirs))
         ) t(s)),
      '{}'
    ),
    coalesce((select slots from theirs), '{}'),
    d.starts_at, d.venue_name
  from d;
$fn$;

grant execute on function public.date_plan_state(uuid) to authenticated;

/* --- 3. Clear anything already injected -------------------------------- */
-- Rows belonging to somebody who is not on the date they point at. There
-- should be none in a healthy database; deleting them is what makes the
-- planner readable again for anyone already affected.

delete from public.date_availability a
 where not exists (
   select 1 from public.dates d
    where d.id = a.date_id
      and a.user_id in (d.user_a_id, d.user_b_id)
 );
