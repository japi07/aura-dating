-- Can a member skip the payment screen entirely and get the three modes free?
--
-- This is the attack 0018 exists to stop: sign in normally, then talk to the
-- REST API directly instead of using the app. Everything below runs as the
-- `authenticated` role with a real uid, which is exactly what a JWT buys you.
create temp table byp(line text);
grant insert, select on byp to authenticated;

do $$
declare
  v_uid  uuid;
  v_other uuid;
  v_ok   int := 0;
  v_bad  int := 0;
  v_err  text;
  v_json jsonb;
  v_eid  uuid;
begin
  v_uid := gen_random_uuid();
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values (v_uid, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', 'byp-a-' || left(v_uid::text, 8) || '@example.test',
          '', now(), now(), now());
  insert into public.profiles (id, email, name, gender, gender_interest, age)
  values (v_uid, 'byp-a-' || left(v_uid::text, 8) || '@example.test',
          'byp-a', 'male', 'female', 30)
  on conflict (id) do nothing;

  v_other := gen_random_uuid();
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values (v_other, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', 'byp-b-' || left(v_other::text, 8) || '@example.test',
          '', now(), now(), now());
  insert into public.profiles (id, email, name, gender, gender_interest, age)
  values (v_other, 'byp-b-' || left(v_other::text, 8) || '@example.test',
          'byp-b', 'female', 'male', 30)
  on conflict (id) do nothing;

  perform set_config('request.jwt.claims', json_build_object('sub', v_uid)::text, true);

  delete from public.token_ledger        where user_id = v_uid;
  delete from public.window_entries      where user_id = v_uid;
  delete from public.token_accounts      where user_id = v_uid;
  delete from public.blind_date_signups  where user_id = v_uid;
  delete from public.call_queue          where user_id = v_uid;
  perform public.ensure_token_account();      -- balance 10, no tickets

  set local role authenticated;

  ---------------------------------------------------- blind, unpaid
  begin
    perform public.join_blind_pool();
    v_bad := v_bad + 1; insert into byp values ('HOLE  joined the blind pool without a ticket');
  exception when others then
    get stacked diagnostics v_err = MESSAGE_TEXT;
    if v_err = 'NO_ENTRY' then
      v_ok := v_ok + 1; insert into byp values ('SAFE  blind pool refused: NO_ENTRY');
    else
      v_ok := v_ok + 1; insert into byp values (format('SAFE  blind pool refused (%s)', left(v_err,40)));
    end if;
  end;

  ---------------------------------------------------- call queue, unpaid
  begin
    insert into public.call_queue (user_id, medium) values (v_uid, 'audio');
    v_bad := v_bad + 1; insert into byp values ('HOLE  joined the call queue without a ticket');
  exception when others then
    get stacked diagnostics v_err = MESSAGE_TEXT;
    v_ok := v_ok + 1; insert into byp values (format('SAFE  call queue refused (%s)', left(v_err,40)));
  end;

  ---------------------------------------------------- proposal, unpaid
  begin
    insert into public.proposals (sender_id, recipient_id, venue_name, date_type, starts_at, message, video_url)
    values (v_uid, v_other, 'Free Lunch', 'dinner', now() + interval '2 days', 'no ticket', 'x');
    v_bad := v_bad + 1; insert into byp values ('HOLE  sent a proposal without a ticket');
  exception when others then
    get stacked diagnostics v_err = MESSAGE_TEXT;
    v_ok := v_ok + 1; insert into byp values (format('SAFE  proposal refused (%s)', left(v_err,40)));
  end;

  ---------------------------------------------------- now pay, and it works
  reset role;
  v_json := public.purchase_window_entry('blind');
  set local role authenticated;
  begin
    perform public.join_blind_pool();
    v_ok := v_ok + 1; insert into byp values ('SAFE  a paid ticket does let you join the pool');
  exception when others then
    get stacked diagnostics v_err = MESSAGE_TEXT;
    v_bad := v_bad + 1; insert into byp values (format('BROKE paid ticket rejected (%s)', left(v_err,40)));
  end;

  ------------------------------------- the ticket survives the wait, refundable
  reset role;
  select id into v_eid from public.window_entries
   where user_id = v_uid and mode = 'blind' and status = 'queued';
  if v_eid is not null then
    v_ok := v_ok + 1; insert into byp values ('SAFE  blind ticket stays queued while waiting (refundable)');
    v_json := public.refund_window_entry(v_eid);
    if (v_json->>'refunded')::boolean and (v_json->>'balance')::int = 10 then
      v_ok := v_ok + 1; insert into byp values ('SAFE  leaving the pool really does refund');
    else
      v_bad := v_bad + 1; insert into byp values (format('BROKE refund said %s', v_json));
    end if;
  else
    v_bad := v_bad + 1; insert into byp values ('BROKE blind ticket was consumed on join, refund impossible');
  end if;

  ------------------------------------ one proposal ticket sends exactly one
  v_json := public.purchase_window_entry('proposal');
  set local role authenticated;
  begin
    insert into public.proposals (sender_id, recipient_id, venue_name, date_type, starts_at, message, video_url)
    values (v_uid, v_other, 'Paid One', 'dinner', now() + interval '2 days', 'first', 'x');
    v_ok := v_ok + 1; insert into byp values ('SAFE  paid proposal went through');
  exception when others then
    get stacked diagnostics v_err = MESSAGE_TEXT;
    v_bad := v_bad + 1; insert into byp values (format('BROKE paid proposal rejected (%s)', left(v_err,40)));
  end;

  begin
    insert into public.proposals (sender_id, recipient_id, venue_name, date_type, starts_at, message, video_url)
    values (v_uid, v_other, 'Free Second', 'dinner', now() + interval '3 days', 'second', 'x');
    v_bad := v_bad + 1; insert into byp values ('HOLE  one ticket sent a SECOND proposal free');
  exception when others then
    get stacked diagnostics v_err = MESSAGE_TEXT;
    v_ok := v_ok + 1; insert into byp values (format('SAFE  second proposal refused (%s)', left(v_err,40)));
  end;

  ---------------------------------------------------- cleanup
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid)::text, true);
  delete from public.proposals            where sender_id = v_uid;
  delete from public.blind_date_signups   where user_id = v_uid;
  delete from public.call_queue           where user_id = v_uid;
  delete from public.token_ledger         where user_id = v_uid;
  delete from public.window_entries       where user_id = v_uid;
  delete from public.token_accounts       where user_id = v_uid;
  delete from public.profiles where id in (v_uid, v_other);
  delete from auth.users where id in (v_uid, v_other);

  insert into byp values ('------------------------------------------');
  insert into byp values (format('RESULT  %s safe, %s HOLES/BROKEN', v_ok, v_bad));
end $$;

select line from byp;
