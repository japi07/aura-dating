-- The other person's times become visible.
--
-- 0015 deliberately hid them: "seeing the other person's raw availability
-- before you post your own invites mirroring, and the only thing either of
-- you needs is the overlap." That held up until there is no overlap at all --
-- at which point the honest answer is not "keep guessing", it is "here is
-- what they said, pick one that matches or don't."
--
-- The mirroring risk this was guarding against no longer applies once BOTH
-- sides have already submitted: nobody can retroactively copy an answer they
-- already committed to before seeing this. So their_slots is populated only
-- when they_submitted is true, which is also exactly the case where it is
-- useful -- you have nothing to react to until then anyway.
--
-- Run in the Supabase SQL Editor. Idempotent.

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
  -- Only ever non-empty once they have committed their own answer. See the
  -- header comment for why that timing is what makes revealing it safe.
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
    select a.slots from public.date_availability a, d
     where a.date_id = d.id and a.user_id <> auth.uid()
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
