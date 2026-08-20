-- Can a signed-in member mint themselves tokens with nothing but the anon key?
-- Runs as the `authenticated` role, which is what a JWT-bearing client gets.
create temp table sec(line text);
grant insert, select on sec to authenticated;

do $$
declare
  v_uid uuid := 'a9980614-47dc-4936-a664-f92ec00d7179';
  v_ok  int := 0;
  v_bad int := 0;
  v_err text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid)::text, true);
  delete from public.token_ledger   where user_id = v_uid;
  delete from public.window_entries where user_id = v_uid;
  delete from public.token_accounts where user_id = v_uid;
  perform public.ensure_token_account();   -- balance 10

  -- Drop to the role a real client actually holds
  set local role authenticated;

  ------------------------------------------------ direct balance write
  begin
    update public.token_accounts set balance = 9999 where user_id = v_uid;
    if (select balance from public.token_accounts where user_id = v_uid) = 9999 then
      v_bad := v_bad + 1; insert into sec values ('HOLE  client UPDATEd its own balance to 9999');
    else
      v_ok := v_ok + 1; insert into sec values ('SAFE  UPDATE on token_accounts changed nothing');
    end if;
  exception when others then
    get stacked diagnostics v_err = MESSAGE_TEXT;
    v_ok := v_ok + 1; insert into sec values (format('SAFE  UPDATE token_accounts refused (%s)', left(v_err, 44)));
  end;

  ------------------------------------------------ forge a ledger credit
  begin
    insert into public.token_ledger (user_id, delta, reason, ref_type, ref_id, balance_after)
    values (v_uid, 500, 'gift', 'x', 'y', 500);
    v_bad := v_bad + 1; insert into sec values ('HOLE  client INSERTed a ledger credit');
  exception when others then
    get stacked diagnostics v_err = MESSAGE_TEXT;
    v_ok := v_ok + 1; insert into sec values (format('SAFE  INSERT token_ledger refused (%s)', left(v_err, 44)));
  end;

  ------------------------------------------------ forge a free ticket
  begin
    insert into public.window_entries (user_id, mode, window_date, tokens_paid)
    values (v_uid, 'call', public.current_window_date(), 0);
    v_bad := v_bad + 1; insert into sec values ('HOLE  client INSERTed a free window_entry');
  exception when others then
    get stacked diagnostics v_err = MESSAGE_TEXT;
    v_ok := v_ok + 1; insert into sec values (format('SAFE  INSERT window_entries refused (%s)', left(v_err, 44)));
  end;

  ------------------------------------------------ rewrite the price list
  begin
    update public.token_settings set value = 0 where key = 'price_call';
    if (select value from public.token_settings where key = 'price_call') = 0 then
      v_bad := v_bad + 1; insert into sec values ('HOLE  client set price_call to 0');
    else
      v_ok := v_ok + 1; insert into sec values ('SAFE  UPDATE on token_settings changed nothing');
    end if;
  exception when others then
    get stacked diagnostics v_err = MESSAGE_TEXT;
    v_ok := v_ok + 1; insert into sec values (format('SAFE  UPDATE token_settings refused (%s)', left(v_err, 44)));
  end;

  ------------------------------------------------ raise the signup grant, re-claim
  begin
    update public.token_settings set value = 5000 where key = 'grant_signup';
    if (select value from public.token_settings where key = 'grant_signup') = 5000 then
      v_bad := v_bad + 1; insert into sec values ('HOLE  client raised grant_signup to 5000');
    else
      v_ok := v_ok + 1; insert into sec values ('SAFE  grant_signup not writable by client');
    end if;
  exception when others then
    v_ok := v_ok + 1; insert into sec values ('SAFE  grant_signup write refused');
  end;

  ------------------------------- self-promote to gold, then claim the allowance
  -- profiles_update_own lets a member write any column of their own row, so
  -- this is the realistic attack on a tier-driven grant.
  begin
    update public.profiles set is_gold = true where id = v_uid;
    if (select coalesce(is_gold,false) from public.profiles where id = v_uid) then
      insert into sec values ('NOTE  client CAN set its own is_gold = true');
      perform public.claim_monthly_tokens();
      if (select balance from public.token_accounts where user_id = v_uid) > 10 then
        v_bad := v_bad + 1;
        insert into sec values (format('HOLE  self-granted gold allowance -> balance %s',
          (select balance from public.token_accounts where user_id = v_uid)));
      else
        v_ok := v_ok + 1; insert into sec values ('SAFE  gold allowance did not pay out');
      end if;
    else
      v_ok := v_ok + 1; insert into sec values ('SAFE  client cannot set is_gold');
    end if;
  exception when others then
    get stacked diagnostics v_err = MESSAGE_TEXT;
    insert into sec values (format('NOTE  is_gold path errored (%s)', left(v_err, 40)));
  end;

  ------------------------------------------------ refund someone else's entry
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid)::text, true);

  insert into sec values ('------------------------------------------');
  insert into sec values (format('RESULT  %s safe, %s HOLES', v_ok, v_bad));

  -- put everything back
  update public.profiles set is_gold = false where id = v_uid;
  update public.token_settings set value = 1  where key = 'price_call';
  update public.token_settings set value = 10 where key = 'grant_signup';
  delete from public.token_ledger   where user_id = v_uid;
  delete from public.window_entries where user_id = v_uid;
  delete from public.token_accounts where user_id = v_uid;
end $$;

select line from sec;
