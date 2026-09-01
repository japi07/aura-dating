-- Can I see their availability while I am still choosing mine?
--
-- The screen now shows their times inside the picker so you can deliberately
-- pick a matching one. That only works if date_plan_state hands them over
-- BEFORE I have submitted anything - which is the exact case 0015 withheld.
create temp table tt(line text);

do $$
declare
  v_me   uuid;   -- made below, so the suite
  v_them uuid;   -- survives accounts being recreated
  v_date uuid;
  v_slot timestamptz := date_trunc('hour', now()) + interval '3 days' + interval '19 hours';
  v_r    record;
  v_ok   int := 0;
  v_bad  int := 0;
begin
  v_me := gen_random_uuid();
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values (v_me, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', 'tt-a-' || left(v_me::text, 8) || '@example.test',
          '', now(), now(), now());
  insert into public.profiles (id, email, name, gender, gender_interest, age,
                               verification_status)
  values (v_me, 'tt-a-' || left(v_me::text, 8) || '@example.test',
          'tt-a', 'male', 'female', 30, 'verified')
  on conflict (id) do nothing;

  v_them := gen_random_uuid();
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values (v_them, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', 'tt-b-' || left(v_them::text, 8) || '@example.test',
          '', now(), now(), now());
  insert into public.profiles (id, email, name, gender, gender_interest, age,
                               verification_status)
  values (v_them, 'tt-b-' || left(v_them::text, 8) || '@example.test',
          'tt-b', 'female', 'male', 30, 'verified')
  on conflict (id) do nothing;

  -- a blind date between them that still needs a time
  select id into v_date from public.dates
   where mode = 'blind'
     and ((user_a_id = v_me and user_b_id = v_them) or (user_a_id = v_them and user_b_id = v_me))
   limit 1;
  if v_date is null then
    insert into public.dates (user_a_id, user_b_id, mode, status)
    values (v_me, v_them, 'blind', 'planning') returning id into v_date;
  end if;

  delete from public.date_availability where date_id = v_date;

  ---------------------------------------------- they submit, I have not
  perform set_config('request.jwt.claims', json_build_object('sub', v_them)::text, true);
  perform public.submit_date_availability(v_date, array[v_slot, v_slot + interval '1 day']);

  perform set_config('request.jwt.claims', json_build_object('sub', v_me)::text, true);
  select * into v_r from public.date_plan_state(v_date);

  if not v_r.i_submitted and v_r.they_submitted then
    v_ok := v_ok + 1; insert into tt values ('PASS  state says they have answered and I have not');
  else
    v_bad := v_bad + 1;
    insert into tt values (format('FAIL  i_submitted=%s they_submitted=%s',
      v_r.i_submitted, v_r.they_submitted));
  end if;

  -- the point of the whole change
  if coalesce(array_length(v_r.their_slots, 1), 0) = 2 then
    v_ok := v_ok + 1;
    insert into tt values ('PASS  I can see their 2 times before committing to mine');
  else
    v_bad := v_bad + 1;
    insert into tt values (format('FAIL  their_slots had %s entries, expected 2',
      coalesce(array_length(v_r.their_slots, 1), 0)));
  end if;

  if coalesce(array_length(v_r.overlap, 1), 0) = 0 then
    v_ok := v_ok + 1; insert into tt values ('PASS  no overlap yet, since I have picked nothing');
  else
    v_bad := v_bad + 1; insert into tt values ('FAIL  overlap reported before I answered');
  end if;

  ---------------------------------------------- I pick one of theirs
  perform public.submit_date_availability(v_date, array[v_slot]);
  select * into v_r from public.date_plan_state(v_date);

  if coalesce(array_length(v_r.overlap, 1), 0) = 1 and v_r.overlap[1] = v_slot then
    v_ok := v_ok + 1;
    insert into tt values ('PASS  copying one of their times produces a real overlap');
  else
    v_bad := v_bad + 1;
    insert into tt values (format('FAIL  overlap was %s', v_r.overlap));
  end if;

  ---------------------------------------------- they still cannot see mine early
  -- (symmetry check: the reveal is mutual, not one-sided)
  perform set_config('request.jwt.claims', json_build_object('sub', v_them)::text, true);
  select * into v_r from public.date_plan_state(v_date);
  if coalesce(array_length(v_r.their_slots, 1), 0) = 1 then
    v_ok := v_ok + 1; insert into tt values ('PASS  the reveal is symmetric - they see mine too');
  else
    v_bad := v_bad + 1; insert into tt values ('FAIL  reveal is one-sided');
  end if;

  ---------------------------------------------- a stranger sees nothing
  perform set_config('request.jwt.claims',
    json_build_object('sub', '00000000-0000-0000-0000-000000000001')::text, true);
  if not exists (select 1 from public.date_plan_state(v_date)) then
    v_ok := v_ok + 1; insert into tt values ('PASS  someone not on the date gets no row at all');
  else
    v_bad := v_bad + 1; insert into tt values ('FAIL  a stranger could read the plan');
  end if;

  ---------------------------------------------- cleanup
  perform set_config('request.jwt.claims', json_build_object('sub', v_me)::text, true);
  delete from public.date_availability where date_id = v_date;
  delete from public.dates where id = v_date;
  delete from public.profiles where id in (v_me, v_them);
  delete from auth.users where id in (v_me, v_them);

  insert into tt values ('------------------------------------------');
  insert into tt values (format('RESULT  %s passed, %s failed', v_ok, v_bad));
end $$;

select line from tt;
