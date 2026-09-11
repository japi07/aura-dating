-- Does buying a token pack actually add tokens, exactly once?
--
-- The grant runs server-side off a RevenueCat webhook, after Apple has
-- verified the receipt. The two things that matter: a client cannot call it,
-- and a webhook delivered twice does not pay twice.
create temp table tp(line text);
grant insert, select on tp to authenticated;

do $$
declare
  v_user uuid := gen_random_uuid();
  v_txn  text := 'txn_' || left(v_user::text, 12);
  v_got  int;
  v_bal  int;
  v_ok   int := 0;
  v_bad  int := 0;
  v_err  text;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values (v_user, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', 'tp-' || left(v_user::text, 8) || '@example.test',
          '', now(), now(), now());
  insert into public.profiles (id, email, name)
  values (v_user, 'tp-' || left(v_user::text, 8) || '@example.test', 'tp')
  on conflict (id) do nothing;

  select balance into v_bal from public.token_accounts where user_id = v_user;
  insert into tp values (format('starting balance (signup grant): %s', coalesce(v_bal, 0)));

  ------------------------------------------------ the purchase lands
  v_got := public.grant_tokens_from_purchase(v_user, 'com.auradating.tokens.15', v_txn);
  if v_got = 15 then
    v_ok := v_ok + 1; insert into tp values ('PASS  a 15-token pack granted 15');
  else
    v_bad := v_bad + 1; insert into tp values (format('FAIL  granted %s, expected 15', v_got));
  end if;

  ------------------------------------------------ and the balance moved
  select balance into v_bal from public.token_accounts where user_id = v_user;
  if v_bal = 25 then
    v_ok := v_ok + 1; insert into tp values ('PASS  balance is 10 signup + 15 bought = 25');
  else
    v_bad := v_bad + 1; insert into tp values (format('FAIL  balance %s, expected 25', v_bal));
  end if;

  --------------------------------- the webhook is delivered again (it will be)
  v_got := public.grant_tokens_from_purchase(v_user, 'com.auradating.tokens.15', v_txn);
  select balance into v_bal from public.token_accounts where user_id = v_user;
  if v_got = 0 and v_bal = 25 then
    v_ok := v_ok + 1; insert into tp values ('PASS  redelivery granted nothing, balance held at 25');
  else
    v_bad := v_bad + 1;
    insert into tp values (format('FAIL  redelivery granted %s, balance %s', v_got, v_bal));
  end if;

  ------------------------------------------------ a different purchase does pay
  v_got := public.grant_tokens_from_purchase(v_user, 'com.auradating.tokens.5', v_txn || '_b');
  select balance into v_bal from public.token_accounts where user_id = v_user;
  if v_got = 5 and v_bal = 30 then
    v_ok := v_ok + 1; insert into tp values ('PASS  a second, different purchase does grant');
  else
    v_bad := v_bad + 1; insert into tp values (format('FAIL  second purchase %s, balance %s', v_got, v_bal));
  end if;

  ------------------------------------------------ an unknown product grants nothing
  v_got := public.grant_tokens_from_purchase(v_user, 'com.auradating.gold.monthly', v_txn || '_c');
  select balance into v_bal from public.token_accounts where user_id = v_user;
  if v_got = 0 and v_bal = 30 then
    v_ok := v_ok + 1; insert into tp values ('PASS  a subscription id arriving here grants nothing');
  else
    v_bad := v_bad + 1; insert into tp values (format('FAIL  unknown product granted %s', v_got));
  end if;

  ------------------------------------------------ a client cannot call it
  set local role authenticated;
  begin
    perform public.grant_tokens_from_purchase(v_user, 'com.auradating.tokens.40', 'forged');
    v_bad := v_bad + 1; insert into tp values ('HOLE  a client granted itself 40 tokens');
  exception when others then
    get stacked diagnostics v_err = MESSAGE_TEXT;
    v_ok := v_ok + 1; insert into tp values (format('PASS  client refused (%s)', left(v_err, 46)));
  end;
  reset role;

  ------------------------------------------------ the ledger explains each one
  if (select count(*) from public.token_ledger
       where user_id = v_user and reason = 'purchase') = 2 then
    v_ok := v_ok + 1; insert into tp values ('PASS  two purchase rows in the ledger, not three');
  else
    v_bad := v_bad + 1; insert into tp values ('FAIL  ledger does not match the purchases');
  end if;

  ---------------------------------------------------------------- cleanup
  delete from public.token_ledger   where user_id = v_user;
  delete from public.token_accounts where user_id = v_user;
  delete from public.profiles       where id = v_user;
  delete from auth.users            where id = v_user;

  insert into tp values ('------------------------------------------');
  insert into tp values (format('RESULT  %s passed, %s failed', v_ok, v_bad));
end $$;

select line from tp;
