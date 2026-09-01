-- Does a brand-new account get its trial tokens without the app asking?
--
-- The old answer was no: the grant only happened if the client's RPC landed
-- at a moment when the session was ready, and when it did not the failure was
-- swallowed and the member simply had an empty wallet. This proves the tokens
-- now arrive with the row.
create temp table sg(line text);

do $$
declare
  v_auth uuid := gen_random_uuid();
  v_bal  int;
  v_ok   int := 0;
  v_bad  int := 0;
  v_gr   int;
begin
  select value into v_gr from public.token_settings where key = 'grant_signup';

  -- A profile needs a matching auth.users row for its foreign key.
  insert into auth.users (id, instance_id, aud, role, email,
                          encrypted_password, email_confirmed_at,
                          created_at, updated_at)
  values (v_auth, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', 'grant-test-' || left(v_auth::text, 8) || '@example.test',
          '', now(), now(), now());

  -- handle_new_user may already have made the profile; if not, make it.
  insert into public.profiles (id, email, name)
  values (v_auth, 'grant-test-' || left(v_auth::text, 8) || '@example.test', 'Grant Test')
  on conflict (id) do nothing;

  ------------------------------------------------ the account exists at all
  select balance into v_bal from public.token_accounts where user_id = v_auth;
  if v_bal is not null then
    v_ok := v_ok + 1; insert into sg values ('PASS  a token account was opened with the profile');
  else
    v_bad := v_bad + 1; insert into sg values ('FAIL  no token account for a new profile');
  end if;

  ------------------------------------------------ and it is funded
  if coalesce(v_bal, 0) = v_gr then
    v_ok := v_ok + 1;
    insert into sg values (format('PASS  funded with the trial grant of %s', v_gr));
  else
    v_bad := v_bad + 1;
    insert into sg values (format('FAIL  balance %s, expected %s', coalesce(v_bal,-1), v_gr));
  end if;

  ------------------------------------------------ the ledger explains it
  if exists (select 1 from public.token_ledger
              where user_id = v_auth and reason = 'signup_grant' and delta = v_gr) then
    v_ok := v_ok + 1; insert into sg values ('PASS  a ledger row records why');
  else
    v_bad := v_bad + 1; insert into sg values ('FAIL  balance with no ledger entry behind it');
  end if;

  ------------------------- the app calling in later must not grant a second time
  perform set_config('request.jwt.claims', json_build_object('sub', v_auth)::text, true);
  v_bal := public.ensure_token_account();
  if v_bal = v_gr then
    v_ok := v_ok + 1;
    insert into sg values (format('PASS  the client path is now a no-op, still %s', v_bal));
  else
    v_bad := v_bad + 1;
    insert into sg values (format('FAIL  client path changed it to %s', v_bal));
  end if;

  -- and again, since the old bug only showed on repeat calls
  v_bal := public.ensure_token_account();
  if v_bal = v_gr then
    v_ok := v_ok + 1; insert into sg values ('PASS  still stable on a third call');
  else
    v_bad := v_bad + 1; insert into sg values (format('FAIL  drifted to %s', v_bal)); end if;

  ---------------------------------------------------------------- cleanup
  delete from public.token_ledger   where user_id = v_auth;
  delete from public.token_accounts where user_id = v_auth;
  delete from public.profiles       where id = v_auth;
  delete from auth.users            where id = v_auth;

  insert into sg values ('------------------------------------------');
  insert into sg values (format('RESULT  %s passed, %s failed', v_ok, v_bad));
end $$;

select line from sg;
