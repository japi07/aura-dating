-- The pre-date chat (migration 0030), checked against the live database the
-- way PostgREST would run it. One transaction, rolled back at the end.
--
--   npx supabase db query --linked -f supabase/tests/date-chat.sql

begin;

create temp table t   (n serial primary key, ok boolean, check_name text, detail text) on commit drop;
create temp table ids (k text primary key, id uuid) on commit drop;
grant select on ids to authenticated, anon;

create function pg_temp.act_as(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', p::text, 'role', 'authenticated')::text, true),
         set_config('role', 'authenticated', true);
$$;
create function pg_temp.act_as_owner() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.id(p_k text) returns uuid language sql stable as $$
  select id from ids where k = p_k;
$$;
-- Try to post as someone; returns 'sent' or the error.
create function pg_temp.post(p_who text, p_date text, p_body text) returns text language plpgsql as $$
begin
  perform pg_temp.act_as(pg_temp.id(p_who));
  begin
    insert into public.date_messages (date_id, sender_id, body)
    values (pg_temp.id(p_date), pg_temp.id(p_who), p_body);
    perform pg_temp.act_as_owner();
    return 'sent';
  exception when others then
    perform pg_temp.act_as_owner();
    return sqlerrm;
  end;
end $$;
create function pg_temp.visible(p_who text, p_date text) returns int language plpgsql as $$
declare n int;
begin
  perform pg_temp.act_as(pg_temp.id(p_who));
  select count(*) into n from public.date_messages where date_id = pg_temp.id(p_date);
  perform pg_temp.act_as_owner();
  return n;
end $$;

/* ─── fixtures ───────────────────────────────────────────────────────── */
do $$
declare k text; v uuid; e text;
begin
  foreach k in array array['A', 'B', 'C', 'X'] loop
    v := gen_random_uuid();
    e := 'chat-' || lower(k) || '-' || left(v::text, 8) || '@example.test';
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                            email_confirmed_at, created_at, updated_at)
    values (v, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            e, '', now(), now(), now());
    insert into public.profiles (id, email, name, gender, gender_interest, age)
    values (v, e, 'Chat ' || k, 'female', 'male', 30)
    on conflict (id) do update set email = excluded.email, name = excluded.name;
    insert into ids values (k, v);
  end loop;

  -- A and B: tonight in two hours (open). A and C: tomorrow night (not yet),
  -- one that started four hours ago (closed), and a cancelled one tonight.
  with x as (insert into public.dates (user_a_id, user_b_id, starts_at, status, mode)
    values (pg_temp.id('A'), pg_temp.id('B'), now() + interval '2 hours', 'upcoming', 'proposal') returning id)
  insert into ids select 'TONIGHT', id from x;
  with x as (insert into public.dates (user_a_id, user_b_id, starts_at, status, mode)
    values (pg_temp.id('A'), pg_temp.id('C'), now() + interval '30 hours', 'upcoming', 'proposal') returning id)
  insert into ids select 'TOMORROW', id from x;
  with x as (insert into public.dates (user_a_id, user_b_id, starts_at, status, mode)
    values (pg_temp.id('A'), pg_temp.id('C'), now() - interval '4 hours', 'upcoming', 'proposal') returning id)
  insert into ids select 'EARLIER', id from x;
  with x as (insert into public.dates (user_a_id, user_b_id, starts_at, status, mode)
    values (pg_temp.id('A'), pg_temp.id('C'), now() + interval '1 hour', 'cancelled', 'proposal') returning id)
  insert into ids select 'CANCELLED', id from x;
  with x as (insert into public.dates (user_a_id, user_b_id, status, mode)
    values (pg_temp.id('A'), pg_temp.id('C'), 'planning', 'blind') returning id)
  insert into ids select 'UNTIMED', id from x;
end $$;

/* ─── the window ─────────────────────────────────────────────────────── */
do $$
declare r text; st jsonb;
begin
  r := pg_temp.post('A', 'TONIGHT', 'Hi! Looking forward to tonight');
  insert into t (ok, check_name, detail) values (r = 'sent', 'A can write two hours before the date', r);
  r := pg_temp.post('B', 'TONIGHT', 'Me too. My number is 07700 900123');
  insert into t (ok, check_name, detail) values (r = 'sent', 'B can answer, and share a number', r);
  r := pg_temp.post('A', 'TOMORROW', 'Too early');
  insert into t (ok, check_name, detail) values (r <> 'sent', 'nothing can be sent more than eight hours before', r);
  r := pg_temp.post('A', 'EARLIER', 'Too late');
  insert into t (ok, check_name, detail) values (r <> 'sent', 'nothing can be sent three hours after the start', r);
  r := pg_temp.post('A', 'CANCELLED', 'Cancelled');
  insert into t (ok, check_name, detail) values (r <> 'sent', 'nothing can be sent on a cancelled date', r);
  r := pg_temp.post('A', 'UNTIMED', 'No time yet');
  insert into t (ok, check_name, detail) values (r <> 'sent', 'nothing can be sent before the date has a time', r);

  perform pg_temp.act_as(pg_temp.id('A'));
  st := public.date_chat_state(pg_temp.id('TONIGHT'));
  perform pg_temp.act_as_owner();
  insert into t (ok, check_name, detail) values ((st->>'open')::boolean, 'date_chat_state says tonight is open', st::text);
  perform pg_temp.act_as(pg_temp.id('A'));
  st := public.date_chat_state(pg_temp.id('TOMORROW'));
  perform pg_temp.act_as_owner();
  insert into t (ok, check_name, detail) values (not (st->>'open')::boolean
    and (st->>'opens_at')::timestamptz between now() + interval '21 hours' and now() + interval '23 hours',
    'date_chat_state says tomorrow opens 8h before', st::text);
end $$;

/* ─── who can see and write ──────────────────────────────────────────── */
do $$
declare r text; st jsonb; n int; spoof text;
begin
  insert into t (ok, check_name, detail) values
    (pg_temp.visible('A', 'TONIGHT') = 2, 'A sees both messages', ''),
    (pg_temp.visible('B', 'TONIGHT') = 2, 'B sees both messages', ''),
    (pg_temp.visible('X', 'TONIGHT') = 0, 'a stranger sees nothing', '');

  r := pg_temp.post('X', 'TONIGHT', 'Hello from a stranger');
  insert into t (ok, check_name, detail) values (r <> 'sent', 'a stranger cannot write in it', r);

  -- Posting in A's name as B.
  perform pg_temp.act_as(pg_temp.id('B'));
  begin
    insert into public.date_messages (date_id, sender_id, body) values (pg_temp.id('TONIGHT'), pg_temp.id('A'), 'Spoofed');
    spoof := 'sent';
  exception when others then spoof := sqlerrm;
  end;
  perform pg_temp.act_as(pg_temp.id('X'));
  st := public.date_chat_state(pg_temp.id('TONIGHT'));
  perform pg_temp.act_as_owner();
  insert into t (ok, check_name, detail) values
    (spoof <> 'sent', 'nobody can write as the other person', spoof),
    (st is null, 'date_chat_state is empty for a stranger', coalesce(st::text, 'null'));

  r := pg_temp.post('A', 'TONIGHT', 'you stupid slut');
  insert into t (ok, check_name, detail) values (r <> 'sent', 'the word list applies', r);
  r := pg_temp.post('A', 'TONIGHT', '   ');
  insert into t (ok, check_name, detail) values (r <> 'sent', 'an empty message is refused', r);
end $$;

/* ─── deleting ───────────────────────────────────────────────────────── */
do $$
declare n_other int; n_own int;
begin
  perform pg_temp.act_as(pg_temp.id('A'));
  with d as (delete from public.date_messages
              where date_id = pg_temp.id('TONIGHT') and sender_id = pg_temp.id('B') returning 1)
  select count(*) into n_other from d;
  with d as (delete from public.date_messages
              where date_id = pg_temp.id('TONIGHT') and sender_id = pg_temp.id('A') returning 1)
  select count(*) into n_own from d;
  perform pg_temp.act_as_owner();
  insert into t (ok, check_name, detail) values
    (n_other = 0, 'A cannot delete B''s message', n_other || ''),
    (n_own = 1, 'A can delete their own message', n_own || '');
end $$;

/* ─── blocking and banning ───────────────────────────────────────────── */
do $$
declare r text;
begin
  insert into public.blocks (blocker_id, blocked_id) values (pg_temp.id('B'), pg_temp.id('A'));
  r := pg_temp.post('A', 'TONIGHT', 'Are you still coming?');
  insert into t (ok, check_name, detail) values
    (r <> 'sent', 'once B blocks A, A cannot write', r),
    (pg_temp.visible('A', 'TONIGHT') = 0, 'and A no longer sees the chat', '');
  delete from public.blocks where blocker_id = pg_temp.id('B');

  update public.profiles set banned_at = now(), banned_reason = 'test' where id = pg_temp.id('B');
  r := pg_temp.post('B', 'TONIGHT', 'Still here');
  insert into t (ok, check_name, detail) values (r <> 'sent', 'a banned member cannot write', r);
  r := pg_temp.post('A', 'TONIGHT', 'Hello?');
  insert into t (ok, check_name, detail) values (r <> 'sent', 'nobody can write to a banned member', r);
  update public.profiles set banned_at = null, banned_reason = null where id = pg_temp.id('B');
end $$;

/* ─── deletion cascades ──────────────────────────────────────────────── */
do $$
declare n int;
begin
  delete from auth.users where id = pg_temp.id('B');
  select count(*) into n from public.date_messages where sender_id = pg_temp.id('B') or date_id = pg_temp.id('TONIGHT');
  insert into t (ok, check_name, detail) values (n = 0, 'deleting an account removes their chats', n || '');
end $$;

select n, case when ok then 'PASS' else 'FAIL' end as result, check_name, detail from t order by n;

rollback;
