create temp table h(line text);
grant insert, select on h to authenticated;
do $$
declare
  v_me    uuid := (select id from public.profiles where name='azpiazujavier');
  v_them  uuid := (select id from public.profiles where name='Humber');
  v_third uuid := (select id from public.profiles where id not in (
                     (select id from public.profiles where name='azpiazujavier'),
                     (select id from public.profiles where name='Humber')) limit 1);
  v_date  uuid;
  v_slot  timestamptz := date_trunc('hour', now()) + interval '5 days';
  v_err   text;
begin
  select id into v_date from public.dates
   where (user_a_id=v_me and user_b_id=v_them) or (user_a_id=v_them and user_b_id=v_me) limit 1;
  delete from public.date_availability where date_id=v_date;

  if v_third is null then
    insert into h values ('SKIP  no third profile to attack with');
    return;
  end if;

  -- attacker is a real signed-in member, NOT on this date
  perform set_config('request.jwt.claims', json_build_object('sub', v_third)::text, true);
  set local role authenticated;
  begin
    insert into public.date_availability (date_id, user_id, slots)
    values (v_date, v_third, array[v_slot]);
    insert into h values ('HOLE  a non-participant inserted availability into someone else''s date');
  exception when others then
    get stacked diagnostics v_err = MESSAGE_TEXT;
    insert into h values (format('SAFE  refused (%s)', left(v_err,50)));
  end;
  reset role;

  -- does the victim now see the attacker's times as "theirs"?
  perform set_config('request.jwt.claims', json_build_object('sub', v_me)::text, true);
  if exists (select 1 from public.date_plan_state(v_date)
              where coalesce(array_length(their_slots,1),0) > 0) then
    insert into h values ('HOLE  victim is shown the intruder''s times as their match''s');
  else
    insert into h values ('SAFE  victim sees no foreign times');
  end if;

  -- and if the REAL counterpart also submits, does the screen break?
  perform set_config('request.jwt.claims', json_build_object('sub', v_them)::text, true);
  begin
    perform public.submit_date_availability(v_date, array[v_slot]);
  exception when others then null;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', v_me)::text, true);
  begin
    perform * from public.date_plan_state(v_date);
    insert into h values ('SAFE  planner still readable with two counterpart rows');
  exception when others then
    get stacked diagnostics v_err = MESSAGE_TEXT;
    insert into h values (format('HOLE  planner crashes for both: %s', left(v_err,60)));
  end;

  delete from public.date_availability where date_id=v_date;
end $$;
select line from h;
