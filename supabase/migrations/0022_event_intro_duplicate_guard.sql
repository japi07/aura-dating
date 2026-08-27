-- Refines the duplicate guard in make_event_intros.
--
-- It excluded any pair with ANY date between them, ever. Two people whose
-- date was cancelled in March should still be introducible at an event in
-- August -- a cancelled or completed date is history, not a standing
-- arrangement. Only a LIVE date (planning or upcoming) means "you are already
-- going to meet, we do not need to introduce you."
--
-- The same-event guard is separate and always on, so running this twice can
-- never produce two introductions for one event. test_mode relaxes only the
-- cross-event history, exactly as the call and blind matchers do, so the same
-- two accounts can be tested over and over.

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
       -- Always: never two introductions for the same event.
       and not exists (
         select 1 from public.dates d
          where d.mode = 'event' and d.starts_at = v_ev.date
            and ((d.user_a_id = a.user_id and d.user_b_id = b.user_id)
              or (d.user_a_id = b.user_id and d.user_b_id = a.user_id))
       )
       -- Already arranged to meet? Then there is nothing to introduce. A
       -- cancelled or completed date does not count -- that is history.
       and (v_test or not exists (
         select 1 from public.dates d
          where d.status in ('planning', 'upcoming')
            and ((d.user_a_id = a.user_id and d.user_b_id = b.user_id)
              or (d.user_a_id = b.user_id and d.user_b_id = a.user_id))
       ))
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
