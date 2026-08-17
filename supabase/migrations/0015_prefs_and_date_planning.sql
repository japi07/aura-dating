-- Two gaps this closes.
--
-- 1. Date preferences never left the phone. store/settings.ts writes them to
--    AsyncStorage and nothing else, so the blind matcher could not see the
--    answers a member had already given on the Preferences screen and had to
--    ask again in the signup flow. That is why blind signup had its own form.
--    With the preferences on the profile, the matcher reads them and the form
--    stays deleted.
--
-- 2. A blind match had no way to agree a time. The concierge picked one out of
--    the air. Curated proposals let the sender offer several slots and the
--    recipient choose; this gives blind dates the same conversation, just in
--    both directions -- each side posts when they are free and the overlap is
--    what the concierge books inside.
--
-- Run in the Supabase SQL Editor. Idempotent.

/* --- 1. Preferences live on the profile ----------------------------- */

alter table public.profiles
  add column if not exists date_types     text[] not null default '{}',
  add column if not exists available_days text[] not null default '{}',
  add column if not exists age_min        int,
  add column if not exists age_max        int,
  add column if not exists radius_km      int,
  add column if not exists intention      text;

-- Sanity, not enforcement: a nonsense range should fail loudly at write time
-- rather than quietly match nobody for weeks.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_age_range_sane'
  ) then
    alter table public.profiles
      add constraint profiles_age_range_sane
      check (age_min is null or age_max is null or age_min <= age_max);
  end if;
end $$;

/* --- 2. Availability for a date that has no time yet ---------------- */

create table if not exists public.date_availability (
  id         uuid primary key default gen_random_uuid(),
  date_id    uuid not null references public.dates(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  -- Exact instants rather than day plus band. Both phones build these from
  -- the same picker, so an intersection is meaningful.
  slots      timestamptz[] not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (date_id, user_id)
);

create index if not exists date_availability_date_idx
  on public.date_availability(date_id);

alter table public.date_availability enable row level security;

-- You may read and write your own row. You may NOT read theirs: seeing the
-- other person's raw availability before you post your own invites mirroring,
-- and the only thing either of you needs is the overlap, which the function
-- below returns.
drop policy if exists date_availability_own on public.date_availability;
create policy date_availability_own on public.date_availability
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists date_availability_admin on public.date_availability;
create policy date_availability_admin on public.date_availability
  for select using (public.is_admin());

/* --- 3. Posting your availability ----------------------------------- */

create or replace function public.submit_date_availability(
  p_date_id uuid,
  p_slots   timestamptz[]
) returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  d public.dates%rowtype;
begin
  select * into d from public.dates where id = p_date_id;
  if not found then
    raise exception 'Date not found';
  end if;
  if auth.uid() not in (d.user_a_id, d.user_b_id) then
    raise exception 'Not your date';
  end if;
  if coalesce(array_length(p_slots, 1), 0) = 0 then
    raise exception 'Pick at least one time';
  end if;

  insert into public.date_availability (date_id, user_id, slots)
  values (p_date_id, auth.uid(), p_slots)
  on conflict (date_id, user_id)
  do update set slots = excluded.slots, updated_at = now();
end;
$fn$;

grant execute on function public.submit_date_availability(uuid, timestamptz[]) to authenticated;

/* --- 4. Where the plan has got to ----------------------------------- */
-- Returns your own slots verbatim, but only a count and the overlap for the
-- other person. Enough to render a roadmap, never enough to copy their answer.

create or replace function public.date_plan_state(p_date_id uuid)
returns table (
  date_id         uuid,
  mode            text,
  status          text,
  my_slots        timestamptz[],
  i_submitted     boolean,
  they_submitted  boolean,
  overlap         timestamptz[],
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
    d.starts_at, d.venue_name
  from d;
$fn$;

grant execute on function public.date_plan_state(uuid) to authenticated;

/* --- 5. The concierge sees the overlap ------------------------------ */
-- Replaces the 0012 version. Same shape plus the agreed times, so ops books
-- inside what both people actually said rather than guessing.
--
-- Dropped rather than replaced: create or replace cannot widen a function
-- whose OUT parameters changed, and three columns are new here.

drop function if exists public.ops_planning_queue();

create or replace function public.ops_planning_queue()
returns table (
  date_id        uuid,
  mode           text,
  status         text,
  created_at     timestamptz,
  starts_at      timestamptz,
  venue_name     text,
  a_id           uuid,
  a_name         text,
  a_photo        text,
  b_id           uuid,
  b_name         text,
  b_photo        text,
  areas          text[],
  date_styles    text[],
  budget         text,
  available_from date,
  available_to   date,
  time_bands     text[],
  dietary        text,
  accessibility  text,
  agreed_slots   timestamptz[],
  a_submitted    boolean,
  b_submitted    boolean
)
language sql
stable
security definer
set search_path = public
as $fn$
  select
    d.id, d.mode, d.status, d.created_at, d.starts_at, d.venue_name,
    a.id, a.name, a.photo_url,
    b.id, b.name, b.photo_url,
    -- Both people's stated constraints; ops has to satisfy both at once
    coalesce(sa.areas, '{}') || coalesce(sb.areas, '{}'),
    -- Date types now come from the profile rather than the blind signup
    coalesce(a.date_types, '{}') || coalesce(b.date_types, '{}'),
    -- The lower budget wins; never book beyond what one of them agreed to
    least(coalesce(sa.budget, 'mid'), coalesce(sb.budget, 'mid')),
    greatest(sa.available_from, sb.available_from),
    least(sa.available_to, sb.available_to),
    coalesce(a.available_days, '{}') || coalesce(b.available_days, '{}'),
    nullif(concat_ws(' | ', sa.dietary, sb.dietary), ''),
    nullif(concat_ws(' | ', sa.accessibility, sb.accessibility), ''),
    coalesce(
      (select array_agg(s order by s)
         from (
           select unnest(av_a.slots)
           intersect
           select unnest(av_b.slots)
         ) t(s)),
      '{}'
    ),
    av_a.slots is not null,
    av_b.slots is not null
  from public.dates d
  join public.profiles a on a.id = d.user_a_id
  join public.profiles b on b.id = d.user_b_id
  left join public.blind_date_signups sa
         on sa.matched_date_id = d.id and sa.user_id = d.user_a_id
  left join public.blind_date_signups sb
         on sb.matched_date_id = d.id and sb.user_id = d.user_b_id
  left join public.date_availability av_a
         on av_a.date_id = d.id and av_a.user_id = d.user_a_id
  left join public.date_availability av_b
         on av_b.date_id = d.id and av_b.user_id = d.user_b_id
  where public.is_admin()
    and d.status = 'planning'
  order by d.created_at asc;
$fn$;

grant execute on function public.ops_planning_queue() to authenticated;
