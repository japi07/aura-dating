-- Exercises the token functions as a real signed-in user, then removes every
-- row it created so the database is left exactly as it was found.
create temp table tres(line text);

do $$
declare
  v_uid  uuid := 'a9980614-47dc-4936-a664-f92ec00d7179';  -- throwaway test profile
  v_bal  int;
  v_bal2 int;
  v_eid  uuid;
  v_json jsonb;
  v_fail int := 0;
  v_ok   int := 0;
  v_err  text;
  v_sum  int;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid)::text, true);

  delete from public.token_ledger   where user_id = v_uid;
  delete from public.window_entries where user_id = v_uid;
  delete from public.token_accounts where user_id = v_uid;

  ---------------------------------------------------------------- trial grant
  v_bal := public.ensure_token_account();
  if v_bal = 10 then v_ok := v_ok + 1; insert into tres values (format('PASS  trial grant -> %s', v_bal));
  else v_fail := v_fail + 1; insert into tres values (format('FAIL  trial grant expected 10 got %s', v_bal)); end if;

  v_bal := public.ensure_token_account();
  if v_bal = 10 then v_ok := v_ok + 1; insert into tres values (format('PASS  second launch does not re-grant -> %s', v_bal));
  else v_fail := v_fail + 1; insert into tres values (format('FAIL  second launch changed balance to %s', v_bal)); end if;

  -- third, because the double-subtract bug only showed on repeat calls
  v_bal := public.ensure_token_account();
  if v_bal = 10 then v_ok := v_ok + 1; insert into tres values (format('PASS  third launch still %s', v_bal));
  else v_fail := v_fail + 1; insert into tres values (format('FAIL  third launch drifted to %s', v_bal)); end if;

  ---------------------------------------------------------------- buy a ticket
  v_json := public.purchase_window_entry('call');
  if (v_json->>'balance')::int = 9 and (v_json->>'alreadyHad')::boolean = false then
    v_ok := v_ok + 1; insert into tres values (format('PASS  buy call -> balance %s paid %s',
      v_json->>'balance', v_json->>'tokensPaid'));
  else
    v_fail := v_fail + 1; insert into tres values (format('FAIL  buy call -> %s', v_json));
  end if;

  ---------------------------------------------------- double tap must not charge
  v_json := public.purchase_window_entry('call');
  if (v_json->>'balance')::int = 9 and (v_json->>'alreadyHad')::boolean = true then
    v_ok := v_ok + 1; insert into tres values ('PASS  double tap is idempotent, balance held at 9');
  else
    v_fail := v_fail + 1; insert into tres values (format('FAIL  double tap -> %s', v_json));
  end if;

  ------------------------------------------------- other modes are independent
  v_json := public.purchase_window_entry('blind');
  v_json := public.purchase_window_entry('proposal');
  if (v_json->>'balance')::int = 7 then
    v_ok := v_ok + 1; insert into tres values ('PASS  three modes bought independently -> 7');
  else
    v_fail := v_fail + 1; insert into tres values (format('FAIL  three modes -> %s', v_json));
  end if;

  ---------------------------------------------------------------- bad mode
  begin
    v_json := public.purchase_window_entry('nonsense');
    v_fail := v_fail + 1; insert into tres values ('FAIL  unknown mode was accepted');
  exception when others then
    v_ok := v_ok + 1; insert into tres values ('PASS  unknown mode rejected');
  end;

  ---------------------------------------------------------------- refund
  select id into v_eid from public.window_entries
   where user_id = v_uid and mode = 'blind' and status = 'queued' limit 1;
  v_json := public.refund_window_entry(v_eid); v_bal := (v_json->>'balance')::int;
  if v_bal = 8 then v_ok := v_ok + 1; insert into tres values (format('PASS  refund -> %s', v_bal));
  else v_fail := v_fail + 1; insert into tres values (format('FAIL  refund expected 8 got %s', v_bal)); end if;

  v_json := public.refund_window_entry(v_eid); v_bal := (v_json->>'balance')::int;
  if v_bal = 8 and not (v_json->>'refunded')::boolean then v_ok := v_ok + 1; insert into tres values ('PASS  double refund is a no-op and says so');
  else v_fail := v_fail + 1; insert into tres values (format('FAIL  double refund paid twice -> %s', v_bal)); end if;

  v_json := public.purchase_window_entry('blind');
  if (v_json->>'balance')::int = 7 and (v_json->>'alreadyHad')::boolean = false then
    v_ok := v_ok + 1; insert into tres values ('PASS  can re-buy after a refund');
  else
    v_fail := v_fail + 1; insert into tres values (format('FAIL  re-buy after refund -> %s', v_json));
  end if;

  ---------------------------------------------------------- empty wallet
  update public.token_accounts set balance = 0 where user_id = v_uid;
  delete from public.window_entries where user_id = v_uid and mode = 'call';
  begin
    v_json := public.purchase_window_entry('call');
    v_fail := v_fail + 1; insert into tres values (format('FAIL  bought on an empty wallet -> %s', v_json));
  exception when others then
    get stacked diagnostics v_err = MESSAGE_TEXT;
    if v_err = 'NOT_ENOUGH_TOKENS' then
      v_ok := v_ok + 1; insert into tres values ('PASS  empty wallet blocked with NOT_ENOUGH_TOKENS');
    else
      v_fail := v_fail + 1; insert into tres values (format('FAIL  wrong error on empty wallet: %s', v_err));
    end if;
  end;

  if not exists (select 1 from public.window_entries
                  where user_id = v_uid and mode = 'call' and status = 'queued') then
    v_ok := v_ok + 1; insert into tres values ('PASS  failed purchase left no orphan ticket');
  else
    v_fail := v_fail + 1; insert into tres values ('FAIL  orphan ticket after a failed purchase');
  end if;

  ---------------------------------------------------------------- consume
  update public.token_accounts set balance = 7 where user_id = v_uid;
  if public.consume_window_entry('blind') then
    v_ok := v_ok + 1; insert into tres values ('PASS  consume marked the ticket used');
  else
    v_fail := v_fail + 1; insert into tres values ('FAIL  consume found no ticket');
  end if;

  select id into v_eid from public.window_entries
   where user_id = v_uid and mode = 'blind' and status = 'used' limit 1;
  v_json := public.refund_window_entry(v_eid); v_bal := (v_json->>'balance')::int;
  if v_bal = 7 and not (v_json->>'refunded')::boolean then v_ok := v_ok + 1; insert into tres values ('PASS  a used ticket cannot be refunded, and says so');
  else v_fail := v_fail + 1; insert into tres values (format('FAIL  used ticket refunded -> %s', v_bal)); end if;

  ---------------------------------------------------------------- token_state
  v_json := public.token_state();
  if (v_json->>'balance')::int = 7
     and (v_json->'prices'->>'call')::int = 1
     and (v_json->'entries'->'blind'->>'status') = 'used' then
    v_ok := v_ok + 1; insert into tres values ('PASS  token_state reports balance, prices and entries');
  else
    v_fail := v_fail + 1; insert into tres values (format('FAIL  token_state -> %s', v_json));
  end if;

  ---------------------------------------------------------------- monthly
  v_bal  := public.claim_monthly_tokens();
  v_bal2 := public.claim_monthly_tokens();
  if v_bal = v_bal2 and v_bal = 7 then
    v_ok := v_ok + 1; insert into tres values (format('PASS  free tier monthly claim is a no-op at %s', v_bal));
  else
    v_fail := v_fail + 1; insert into tres values (format('FAIL  monthly claim %s then %s', v_bal, v_bal2));
  end if;

  -- as a Gold member the allowance lands, and only once
  update public.profiles set is_gold = true where id = v_uid;
  v_bal  := public.claim_monthly_tokens();
  v_bal2 := public.claim_monthly_tokens();
  update public.profiles set is_gold = false where id = v_uid;
  if v_bal = 37 and v_bal2 = 37 then
    v_ok := v_ok + 1; insert into tres values (format('PASS  gold allowance granted once -> %s', v_bal));
  else
    v_fail := v_fail + 1; insert into tres values (format('FAIL  gold allowance %s then %s (want 37, 37)', v_bal, v_bal2));
  end if;

  ------------------------------------------------ ledger reconciles to balance
  select sum(delta) into v_sum from public.token_ledger where user_id = v_uid;
  select balance into v_bal2 from public.token_accounts where user_id = v_uid;
  if v_sum = v_bal2 then
    v_ok := v_ok + 1; insert into tres values (format('PASS  ledger sums to the balance (%s)', v_sum));
  else
    v_fail := v_fail + 1; insert into tres values (format('FAIL  ledger %s but balance %s', v_sum, v_bal2));
  end if;

  ---------------------------------------------------------------- cleanup
  delete from public.token_ledger   where user_id = v_uid;
  delete from public.window_entries where user_id = v_uid;
  delete from public.token_accounts where user_id = v_uid;

  insert into tres values ('------------------------------------------');
  insert into tres values (format('RESULT  %s passed, %s failed', v_ok, v_fail));
end $$;

select line from tres;
