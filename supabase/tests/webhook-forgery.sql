-- Creates a throwaway profile so the forged-webhook probe has a real target,
-- and prints its id. Cleaned up by forge-cleanup.sql.
create temp table f(line text);
do $$
declare v_u uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values (v_u, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', 'forge-' || left(v_u::text, 8) || '@example.test',
          '', now(), now(), now());
  insert into public.profiles (id, email, name)
  values (v_u, 'forge-' || left(v_u::text, 8) || '@example.test', 'forge-probe')
  on conflict (id) do nothing;

  insert into f values (v_u::text);
  insert into f values (format('balance before: %s',
    coalesce((select balance::text from public.token_accounts where user_id = v_u), '0')));
end $$;
select line from f;
