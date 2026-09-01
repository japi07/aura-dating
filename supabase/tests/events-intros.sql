-- Does "N members matching your criteria are attending" tell the truth, and
-- does the double opt-in introduction actually produce a date?
--
-- Makes its own two accounts, then removes everything it created.
create temp table ev(line text);

do $$
declare
  v_me    uuid;
  v_them  uuid;
  v_event uuid;
  v_n     int;
  v_open  int;
  v_made  int;
  v_ok    int := 0;
  v_bad   int := 0;
begin
  v_me := gen_random_uuid();
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values (v_me, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', 'ev-a-' || left(v_me::text, 8) || '@example.test',
          '', now(), now(), now());
  insert into public.profiles (id, email, name, gender, gender_interest, age,
                               verification_status)
  values (v_me, 'ev-a-' || left(v_me::text, 8) || '@example.test',
          'ev-a', 'male', 'female', 30, 'verified')
  on conflict (id) do nothing;

  v_them := gen_random_uuid();
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values (v_them, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', 'ev-b-' || left(v_them::text, 8) || '@example.test',
          '', now(), now(), now());
  insert into public.profiles (id, email, name, gender, gender_interest, age,
                               verification_status)
  values (v_them, 'ev-b-' || left(v_them::text, 8) || '@example.test',
          'ev-b', 'female', 'male', 30, 'verified')
  on conflict (id) do nothing;

  select id into v_event from public.events where date > now() order by date limit 1;

  -- clean slate
  delete from public.event_rsvps where event_id = v_event and user_id in (v_me, v_them);
  delete from public.dates where mode = 'event'
     and ((user_a_id = v_me and user_b_id = v_them) or (user_a_id = v_them and user_b_id = v_me));

  perform set_config('request.jwt.claims', json_build_object('sub', v_me)::text, true);

  ------------------------------------------------ nobody there yet
  select match_count into v_n from public.event_match_counts() where event_id = v_event;
  if coalesce(v_n, 0) = 0 then
    v_ok := v_ok + 1; insert into ev values ('PASS  no attendees -> no count');
  else
    v_bad := v_bad + 1; insert into ev values (format('FAIL  counted %s with an empty event', v_n));
  end if;

  ------------------------------------------------ they book, I should see 1
  insert into public.event_rsvps (event_id, user_id) values (v_event, v_them);
  select match_count, open_count into v_n, v_open
    from public.event_match_counts() where event_id = v_event;
  if v_n = 1 and v_open = 0 then
    v_ok := v_ok + 1; insert into ev values ('PASS  one matching attendee, none open to intros yet');
  else
    v_bad := v_bad + 1;
    insert into ev values (format('FAIL  expected 1 matching / 0 open, got %s / %s',
      coalesce(v_n,-1), coalesce(v_open,-1)));
  end if;

  ------------------------------------------------ I must not count myself
  insert into public.event_rsvps (event_id, user_id) values (v_event, v_me);
  select match_count into v_n from public.event_match_counts() where event_id = v_event;
  if v_n = 1 then
    v_ok := v_ok + 1; insert into ev values ('PASS  I am not counted among my own matches');
  else
    v_bad := v_bad + 1; insert into ev values (format('FAIL  self-counted, got %s', v_n));
  end if;

  ------------------------------------------------ one-sided opt-in makes nothing
  perform public.set_event_intro_opt_in(v_event, true);
  select open_count into v_open from public.event_match_counts() where event_id = v_event;
  v_made := public.make_event_intros(v_event);
  if v_made = 0 then
    v_ok := v_ok + 1; insert into ev values ('PASS  one-sided opt-in introduces nobody');
  else
    v_bad := v_bad + 1; insert into ev values (format('FAIL  made %s intro(s) off one yes', v_made));
  end if;

  ------------------------------------------------ both say yes -> a real date
  perform set_config('request.jwt.claims', json_build_object('sub', v_them)::text, true);
  perform public.set_event_intro_opt_in(v_event, true);

  perform set_config('request.jwt.claims', json_build_object('sub', v_me)::text, true);
  select open_count into v_open from public.event_match_counts() where event_id = v_event;
  if v_open = 1 then
    v_ok := v_ok + 1; insert into ev values ('PASS  their opt-in is visible as a count, not a name');
  else
    v_bad := v_bad + 1; insert into ev values (format('FAIL  open_count %s', coalesce(v_open,-1)));
  end if;

  v_made := public.make_event_intros(v_event);
  if v_made = 1 then
    v_ok := v_ok + 1; insert into ev values ('PASS  mutual opt-in produced one introduction');
  else
    v_bad := v_bad + 1; insert into ev values (format('FAIL  made %s intros', v_made));
  end if;

  ------------------------------------------------ the date carries the event
  if exists (
    select 1 from public.dates d join public.events e on e.id = v_event
     where d.mode = 'event' and d.starts_at = e.date and d.venue_name = e.venue
       and ((d.user_a_id = v_me and d.user_b_id = v_them)
         or (d.user_a_id = v_them and d.user_b_id = v_me))
  ) then
    v_ok := v_ok + 1; insert into ev values ('PASS  the date sits at the event''s own venue and time');
  else
    v_bad := v_bad + 1; insert into ev values ('FAIL  date missing or wrong venue/time');
  end if;

  ------------------------------------------------ running twice must not duplicate
  v_made := public.make_event_intros(v_event);
  if v_made = 0 then
    v_ok := v_ok + 1; insert into ev values ('PASS  re-running introduces nobody twice');
  else
    v_bad := v_bad + 1; insert into ev values (format('FAIL  duplicated %s intro(s)', v_made));
  end if;

  ------------------------------------------------ cleanup
  delete from public.dates where mode = 'event'
     and ((user_a_id = v_me and user_b_id = v_them) or (user_a_id = v_them and user_b_id = v_me));
  delete from public.event_rsvps where event_id = v_event and user_id in (v_me, v_them);
  delete from public.profiles where id in (v_me, v_them);
  delete from auth.users where id in (v_me, v_them);

  insert into ev values ('------------------------------------------');
  insert into ev values (format('RESULT  %s passed, %s failed', v_ok, v_bad));
end $$;

select line from ev;
