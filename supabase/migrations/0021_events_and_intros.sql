-- Events that are actually happening, and a reason to go to them.
--
-- Two problems. The events table held fifteen rows and every single one was
-- in the past, so the Events tab was empty in a way that looked like a bug
-- rather than an empty calendar. And an event was a dead end: you could book
-- a ticket, turn up, and the app that put you in the room had nothing to say
-- about the fact that people you would actually want to meet were standing
-- next to you.
--
-- So: a set of upcoming events to test against, a count of how many people at
-- each one match you, and a double opt-in introduction for the people who
-- want it.
--
-- The count is the interesting half. "4 members matching your criteria are
-- attending" is a real reason to buy a ticket, and it has to be true without
-- naming anybody -- event_rsvps is own-rows-only under RLS, so the count
-- crosses that boundary through a SECURITY DEFINER function that returns an
-- integer and nothing else. Same shape as blind_pool_size and
-- call_queue_size.
--
-- Run in the Supabase SQL Editor. Idempotent.

/* --- 1. An event can now produce a date -------------------------------- */

alter table public.dates drop constraint if exists dates_mode_check;
alter table public.dates add constraint dates_mode_check
  check (mode = any (array['proposal', 'blind', 'call', 'event']));

/* --- 2. Would you like to be introduced? ------------------------------- */
-- Default false, because turning up to an event is not consent to be
-- introduced to strangers. Asked explicitly after the RSVP.

alter table public.event_rsvps
  add column if not exists open_to_intros boolean not null default false,
  add column if not exists intros_made_at timestamptz;

/* --- 3. Upcoming events to test against -------------------------------- */
-- Dated relative to now() so this stays useful whenever it is run, and keyed
-- on title so re-running does not duplicate them.

insert into public.events
  (title, date, venue, area, address, postcode, tube, type,
   total_spots, reserved_count, emoji, price, description, featured, lat, lng)
select * from (values
  ('Natural Wine & Small Plates',
   now() + interval '2 days' + interval '19 hours',
   'Sager + Wilde', 'Hackney', '250 Paradise Row', 'E2 9LE', 'Bethnal Green',
   'Dinner', 18, 11, '🍷',
   '£38',
   'Six wines, six plates, one long table. You will be seated next to someone you have not met.',
   true, 51.5273, -0.0559),

  ('Life Drawing at the Old Church',
   now() + interval '4 days' + interval '18 hours 30 minutes',
   'St Leonard''s', 'Shoreditch', 'Shoreditch High St', 'E1 6JN', 'Shoreditch High Street',
   'Culture', 20, 9, '🎨',
   '£22',
   'Charcoal, a model, and absolutely no requirement to be any good at it.',
   false, 51.5245, -0.0778),

  ('Sunrise Swim & Coffee',
   now() + interval '6 days' + interval '7 hours',
   'Hampstead Ponds', 'Hampstead', 'Millfield Lane', 'N6 6JD', 'Gospel Oak',
   'Activity', 14, 6, '🏊',
   '£12',
   'Cold water, warm pastries. The talking happens afterwards, which is the point.',
   false, 51.5675, -0.1600),

  ('Supper Club: Sicilian Long Lunch',
   now() + interval '9 days' + interval '13 hours',
   'Norma', 'Fitzrovia', '9 Charlotte St', 'W1T 1RG', 'Goodge Street',
   'Dinner', 16, 12, '🍝',
   '£45',
   'Four courses, shared, at one table. Nobody eats alone and nobody sits still.',
   true, 51.5183, -0.1358),

  ('Pottery Wheel for Beginners',
   now() + interval '11 days' + interval '18 hours',
   'Turning Earth', 'Hoxton', '11 Argall Ave', 'E10 7QE', 'Lea Bridge',
   'Workshop', 12, 5, '🏺',
   '£48',
   'Two hours, one wheel each, and something lopsided to take home.',
   false, 51.5720, -0.0210),

  ('Jazz in the Basement',
   now() + interval '13 days' + interval '20 hours',
   'Ronnie Scott''s', 'Soho', '47 Frith St', 'W1D 4HT', 'Tottenham Court Road',
   'Culture', 30, 21, '🎷',
   '£28',
   'Late set, small room. Arrive early, stay for the second half.',
   true, 51.5136, -0.1315),

  ('Sunday Roast & Pub Quiz',
   now() + interval '16 days' + interval '14 hours',
   'The Camberwell Arms', 'Camberwell', '65 Camberwell Church St', 'SE5 8TR', 'Denmark Hill',
   'Social', 24, 10, '🍖',
   '£32',
   'Teams of four, drawn at random. You will be on a team with strangers by design.',
   false, 51.4740, -0.0930),

  ('Rooftop Films: Something in Black & White',
   now() + interval '19 days' + interval '20 hours 30 minutes',
   'Bussey Building', 'Peckham', '133 Rye Ln', 'SE15 4ST', 'Peckham Rye',
   'Culture', 40, 17, '🎬',
   '£16',
   'Blankets provided. The bar stays open an hour after the credits, which is the actual event.',
   false, 51.4690, -0.0690)
) as v(title, date, venue, area, address, postcode, tube, type,
       total_spots, reserved_count, emoji, price, description, featured, lat, lng)
where not exists (
  select 1 from public.events e where e.title = v.title and e.date > now()
);

/* --- 4. How many people there are worth meeting ------------------------ */
-- Returns one row per upcoming event with a count of OTHER attendees who
-- pass the same test the blind matcher applies. Never returns an identity.
--
-- The criteria are deliberately the same ones used for matching elsewhere,
-- because a count that means something different from the matches it implies
-- is worse than no count at all.

create or replace function public.event_match_counts()
returns table (event_id uuid, match_count int, open_count int)
language sql
stable
security definer
set search_path = public
as $fn$
  with me as (
    select p.id, p.gender, p.gender_interest, p.age, p.age_min, p.age_max,
           coalesce(p.verification_status, '') as verification_status
      from public.profiles p
     where p.id = auth.uid()
  ),
  test as (select public.is_test_mode() as on)
  select e.id,
         count(*) filter (where true)::int,
         count(*) filter (where r.open_to_intros)::int
    from public.events e
    join public.event_rsvps r on r.event_id = e.id
    join public.profiles o    on o.id = r.user_id
    cross join me
    cross join test
   where e.date > now()
     and o.id <> me.id
     -- Reciprocal interest: each wants the other's gender
     and (me.gender_interest is null or o.gender = me.gender_interest)
     and (o.gender_interest  is null or me.gender = o.gender_interest)
     -- Mutual age range, when either has stated one
     and (me.age_min is null or o.age  is null or o.age  >= me.age_min)
     and (me.age_max is null or o.age  is null or o.age  <= me.age_max)
     and (o.age_min  is null or me.age is null or me.age >= o.age_min)
     and (o.age_max  is null or me.age is null or me.age <= o.age_max)
     -- Both verified, unless we are testing
     and (test.on or (o.verification_status = 'verified'
                      and me.verification_status = 'verified'))
     -- Never anyone either of us has blocked
     and not exists (
       select 1 from public.blocks b
        where (b.blocker_id = me.id and b.blocked_id = o.id)
           or (b.blocker_id = o.id  and b.blocked_id = me.id)
     )
   group by e.id;
$fn$;

grant execute on function public.event_match_counts() to authenticated;

/* --- 5. Opting in ------------------------------------------------------ */

create or replace function public.set_event_intro_opt_in(
  p_event_id uuid,
  p_open     boolean
) returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  update public.event_rsvps
     set open_to_intros = coalesce(p_open, false)
   where event_id = p_event_id and user_id = auth.uid();

  if not found then
    raise exception 'You are not going to this event';
  end if;
end;
$fn$;

grant execute on function public.set_event_intro_opt_in(uuid, boolean) to authenticated;

/* --- 6. Making the introduction ---------------------------------------- */
-- Both sides must have opted in, and they must pass the same test as the
-- count. Produces a normal date row at the event's own venue and time, so the
-- Dates tab, reminders, the roadmap and the post-date follow-up all work
-- with no special cases.
--
-- Runs for one event at a time and is safe to call repeatedly: a pair that
-- already has a date is skipped.

create or replace function public.make_event_intros(p_event_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_ev    public.events%rowtype;
  v_pair  record;
  v_made  int := 0;
  v_test  boolean := public.is_test_mode();
begin
  select * into v_ev from public.events where id = p_event_id;
  if not found then
    raise exception 'Event not found';
  end if;

  for v_pair in
    select a.user_id as a_id, b.user_id as b_id
      from public.event_rsvps a
      join public.event_rsvps b
        on b.event_id = a.event_id and b.user_id > a.user_id
      join public.profiles pa on pa.id = a.user_id
      join public.profiles pb on pb.id = b.user_id
     where a.event_id = p_event_id
       and a.open_to_intros and b.open_to_intros
       and (pa.gender_interest is null or pb.gender = pa.gender_interest)
       and (pb.gender_interest is null or pa.gender = pb.gender_interest)
       and (pa.age_min is null or pb.age is null or pb.age >= pa.age_min)
       and (pa.age_max is null or pb.age is null or pb.age <= pa.age_max)
       and (pb.age_min is null or pa.age is null or pa.age >= pb.age_min)
       and (pb.age_max is null or pa.age is null or pa.age <= pb.age_max)
       and (v_test or (coalesce(pa.verification_status,'') = 'verified'
                       and coalesce(pb.verification_status,'') = 'verified'))
       and not exists (
         select 1 from public.blocks bl
          where (bl.blocker_id = a.user_id and bl.blocked_id = b.user_id)
             or (bl.blocker_id = b.user_id and bl.blocked_id = a.user_id)
       )
       and not exists (
         select 1 from public.dates d
          where (d.user_a_id = a.user_id and d.user_b_id = b.user_id)
             or (d.user_a_id = b.user_id and d.user_b_id = a.user_id)
       )
  loop
    insert into public.dates
      (user_a_id, user_b_id, mode, status, starts_at,
       venue_name, venue_address, venue_postcode, venue_lat, venue_lng)
    values
      (v_pair.a_id, v_pair.b_id, 'event', 'upcoming', v_ev.date,
       v_ev.venue, v_ev.address, v_ev.postcode, v_ev.lat, v_ev.lng);

    v_made := v_made + 1;
  end loop;

  update public.event_rsvps
     set intros_made_at = now()
   where event_id = p_event_id and open_to_intros;

  return v_made;
end;
$fn$;

grant execute on function public.make_event_intros(uuid) to authenticated;
