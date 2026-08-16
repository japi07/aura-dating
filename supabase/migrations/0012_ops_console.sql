-- Ops console: let the concierge see dates that need planning, read both
-- people's constraints, and write in the venue and time.
--
-- Matching and planning are inherently cross-user, and RLS correctly hides
-- other people's rows from any single user. Rather than pushing this work
-- into a service-role tool outside the app, this adds a narrow admin role so
-- the console can live inside the app the founder already has on their phone.
--
-- Run in the Supabase SQL Editor. Idempotent.

/* ─── 1. The admin flag ────────────────────────────────────────────── */

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- SECURITY DEFINER so the policies below can check admin status without the
-- caller needing to be able to read other rows in profiles. STABLE so it is
-- evaluated once per statement rather than per row.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$fn$;

grant execute on function public.is_admin() to authenticated;

/* ─── 2. Admin read/write over the planning surface ────────────────── */

-- Dates: admins see and edit every date, members keep their existing access.
drop policy if exists dates_admin_all on public.dates;
create policy dates_admin_all on public.dates
  for all using (public.is_admin()) with check (public.is_admin());

-- Blind signups: admins need both sides' constraints to book anything sane.
drop policy if exists blind_signups_admin_read on public.blind_date_signups;
create policy blind_signups_admin_read on public.blind_date_signups
  for select using (public.is_admin());

-- Calls: admins can see call outcomes for support and safety review.
drop policy if exists calls_admin_read on public.calls;
create policy calls_admin_read on public.calls
  for select using (public.is_admin());

/* ─── 3. One query that gives ops everything for a date ────────────── */
-- Returns the date plus both participants and, for blind dates, the
-- constraints each of them signed up with. SECURITY DEFINER + an explicit
-- admin guard, so a non-admin calling it gets nothing rather than an error
-- that leaks whether rows exist.

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
  accessibility  text
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
    -- Intersect both people's constraints: ops must satisfy both, so the
    -- overlap is what actually matters when picking a venue.
    coalesce(sa.areas, '{}') || coalesce(sb.areas, '{}'),
    coalesce(sa.date_styles, '{}') || coalesce(sb.date_styles, '{}'),
    -- The lower budget wins; never book beyond what one of them agreed to
    least(coalesce(sa.budget, 'mid'), coalesce(sb.budget, 'mid')),
    greatest(sa.available_from, sb.available_from),
    least(sa.available_to, sb.available_to),
    coalesce(sa.time_bands, '{}') || coalesce(sb.time_bands, '{}'),
    nullif(concat_ws(' | ', sa.dietary, sb.dietary), ''),
    nullif(concat_ws(' | ', sa.accessibility, sb.accessibility), '')
  from public.dates d
  join public.profiles a on a.id = d.user_a_id
  join public.profiles b on b.id = d.user_b_id
  left join public.blind_date_signups sa
         on sa.matched_date_id = d.id and sa.user_id = d.user_a_id
  left join public.blind_date_signups sb
         on sb.matched_date_id = d.id and sb.user_id = d.user_b_id
  where public.is_admin()
    and d.status = 'planning'
  order by d.created_at asc;
$fn$;

grant execute on function public.ops_planning_queue() to authenticated;

/* ─── 4. Confirm a planned date ────────────────────────────────────── */
-- Sets the venue and time and flips the date to 'upcoming' in one call, so a
-- half-filled date can never reach a member's Dates tab.

create or replace function public.ops_confirm_date(
  p_date_id   uuid,
  p_starts_at timestamptz,
  p_venue     text,
  p_address   text default null,
  p_postcode  text default null,
  p_lat       double precision default null,
  p_lng       double precision default null
) returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if not public.is_admin() then
    raise exception 'Not authorised';
  end if;
  if p_venue is null or length(trim(p_venue)) = 0 then
    raise exception 'A venue is required to confirm a date';
  end if;
  if p_starts_at is null then
    raise exception 'A start time is required to confirm a date';
  end if;

  update public.dates
     set starts_at      = p_starts_at,
         venue_name     = p_venue,
         venue_address  = p_address,
         venue_postcode = p_postcode,
         venue_lat      = p_lat,
         venue_lng      = p_lng,
         status         = 'upcoming'
   where id = p_date_id
     and status = 'planning';
end;
$fn$;

grant execute on function public.ops_confirm_date(uuid, timestamptz, text, text, text, double precision, double precision) to authenticated;
