-- Guideline 1.2 safeguards, checked against the live database.
--
-- Every check acts as a member exactly the way PostgREST does (role
-- `authenticated`, the member's id in request.jwt.claims), so row-level
-- security and grants apply for real. The whole run is one transaction that
-- is rolled back: fixtures, reports, bans and blocks all disappear afterwards.
--
--   npx supabase db query --linked -f supabase/tests/ugc-safety.sql

begin;

create temp table t   (n serial primary key, ok boolean, check_name text, detail text) on commit drop;
create temp table ids (k text primary key, id uuid) on commit drop;
grant select on ids to authenticated, anon;

create function pg_temp.act_as(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', p::text, 'role', 'authenticated')::text, true),
         set_config('role', 'authenticated', true);
$$;
create function pg_temp.act_as_anon() returns void language sql as $$
  select set_config('request.jwt.claims', '', true), set_config('role', 'anon', true);
$$;
create function pg_temp.act_as_owner() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.id(p_k text) returns uuid language sql stable as $$
  select id from ids where k = p_k;
$$;

/* ─── fixtures ───────────────────────────────────────────────────────── */
do $$
declare k text; v uuid; e text;
begin
  foreach k in array array['A', 'B', 'C', 'D', 'E', 'F', 'ADMIN', 'NEWBIE'] loop
    v := gen_random_uuid();
    e := 'ugc-' || lower(k) || '-' || left(v::text, 8) || '@example.test';
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                            email_confirmed_at, created_at, updated_at)
    values (v, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            e, '', now(), now(), now());
    -- A trigger on auth.users already creates the profile row.
    if k = 'NEWBIE' then
      -- NEWBIE inserts their own below, as a client-side sign-up would.
      delete from public.profiles where id = v;
    else
      insert into public.profiles (id, email, name, gender, gender_interest, age, photo_url)
      values (v, e, 'Test ' || k || ' Person', 'female', 'male', 30, 'https://example.test/' || k || '.jpg')
      on conflict (id) do update
        set email = excluded.email, name = excluded.name, gender = excluded.gender,
            gender_interest = excluded.gender_interest, age = excluded.age, photo_url = excluded.photo_url;
    end if;
    insert into ids values (k, v);
  end loop;
  update public.profiles set is_admin = true where id = pg_temp.id('ADMIN');

  with x as (
    insert into public.proposals (sender_id, recipient_id, venue_name, date_type, starts_at, message, video_url)
    values (pg_temp.id('A'), pg_temp.id('B'), 'Test venue', 'dinner', now() + interval '3 days',
            'Dinner on Friday?', 'https://example.test/v.mp4')
    returning id)
  insert into ids select 'PROPOSAL', id from x;
  insert into public.proposal_messages (proposal_id, sender_id, caption, video_url)
  values (pg_temp.id('PROPOSAL'), pg_temp.id('A'), 'Looking forward to it', 'https://example.test/m.mp4');
  with x as (
    insert into public.dates (user_a_id, user_b_id) values (pg_temp.id('A'), pg_temp.id('B')) returning id)
  insert into ids select 'DATE', id from x;
  with x as (
    insert into public.calls (user_a_id, user_b_id, status, started_at)
    values (pg_temp.id('C'), pg_temp.id('D'), 'active', now()) returning id)
  insert into ids select 'CALL', id from x;
end $$;

/* ─── 1. privileged columns ──────────────────────────────────────────── */
do $$
declare v_admin boolean; v_status text; v_err text := 'none';
begin
  perform pg_temp.act_as(pg_temp.id('A'));
  begin
    update public.profiles set is_admin = true where id = pg_temp.id('A');
  exception when others then v_err := sqlerrm;
  end;
  update public.profiles set verification_status = 'verified' where id = pg_temp.id('A');
  perform pg_temp.act_as_owner();
  select is_admin, verification_status into v_admin, v_status from public.profiles where id = pg_temp.id('A');
  insert into t (ok, check_name, detail) values
    (not v_admin, 'a member cannot make themselves admin', 'is_admin=' || v_admin || ' (' || v_err || ')'),
    (v_status = 'unverified', 'a member cannot mark themselves verified', 'status=' || v_status);

  perform pg_temp.act_as(pg_temp.id('A'));
  update public.profiles set verification_status = 'pending' where id = pg_temp.id('A');
  perform pg_temp.act_as_owner();
  select verification_status into v_status from public.profiles where id = pg_temp.id('A');
  insert into t (ok, check_name, detail) values
    (v_status = 'pending', 'a member may still ask for review (pending)', 'status=' || v_status);
end $$;

do $$
declare r record;
begin
  perform pg_temp.act_as(pg_temp.id('NEWBIE'));
  insert into public.profiles (id, email, name, is_admin, verification_status, terms_accepted_at, is_gold)
  values (pg_temp.id('NEWBIE'), 'ugc-newbie@example.test', 'New Person', true, 'verified', now(), true);
  perform pg_temp.act_as_owner();
  select is_admin, verification_status, terms_accepted_at, is_gold into r
    from public.profiles where id = pg_temp.id('NEWBIE');
  insert into t (ok, check_name, detail) values
    (not r.is_admin and r.verification_status = 'unverified' and r.terms_accepted_at is null and not r.is_gold,
     'a new profile cannot be inserted already privileged',
     format('admin=%s status=%s terms=%s gold=%s', r.is_admin, r.verification_status, r.terms_accepted_at, r.is_gold));
end $$;

/* ─── 2. profiles are not public ─────────────────────────────────────── */
do $$
declare v_n int;
begin
  perform pg_temp.act_as_anon();
  select count(*) into v_n from public.profiles;
  perform pg_temp.act_as_owner();
  insert into t (ok, check_name, detail) values (v_n = 0, 'signed-out callers read no profiles', v_n || ' rows');
end $$;

/* ─── 3. blocking hides everything, both ways ────────────────────────── */
do $$
declare
  a uuid := pg_temp.id('A'); b uuid := pg_temp.id('B');
  v_before int; v_prof_ab int; v_prof_ba int; v_prop_a int; v_prop_b int;
  v_msg int; v_date int; v_hidden boolean; v_blocks jsonb;
begin
  perform pg_temp.act_as(a);
  select count(*) into v_before from public.profiles where id = b;
  perform public.safety_block(p_user => b, p_reason => 'test');
  select count(*) into v_prof_ab from public.profiles where id = b;
  select count(*) into v_prop_a from public.proposals where id = pg_temp.id('PROPOSAL');
  select count(*) into v_msg from public.proposal_messages where proposal_id = pg_temp.id('PROPOSAL');
  select count(*) into v_date from public.dates where id = pg_temp.id('DATE');
  v_hidden := public.hidden_from_me(b);
  v_blocks := public.my_blocks();

  perform pg_temp.act_as(b);
  select count(*) into v_prof_ba from public.profiles where id = a;
  select count(*) into v_prop_b from public.proposals where id = pg_temp.id('PROPOSAL');

  perform pg_temp.act_as_owner();
  insert into t (ok, check_name, detail) values
    (v_before = 1,  'before blocking, B is visible to A', v_before || ''),
    (v_prof_ab = 0, 'after A blocks B, B''s profile is gone for A', v_prof_ab || ''),
    (v_prof_ba = 0, '...and A''s profile is gone for B', v_prof_ba || ''),
    (v_prop_a = 0 and v_prop_b = 0, 'their proposal is gone for both', v_prop_a || '/' || v_prop_b),
    (v_msg = 0,     'its messages are gone', v_msg || ''),
    (v_date = 0,    'their date is gone', v_date || ''),
    (v_hidden,      'A can no longer send B a proposal (insert policy check)', v_hidden::text),
    (v_blocks->0->>'name' = 'Test B Person' and v_blocks->0->>'photo_url' is not null,
     'A''s blocked list still names B (a profile block is not anonymous)', v_blocks->0->>'name');
end $$;

/* ─── 4. reporting a call never reveals who was on it ────────────────── */
do $$
declare
  c uuid := pg_temp.id('C'); d uuid := pg_temp.id('D');
  v_result jsonb; v_blocks jsonb; r record; v_call text; v_block_anon boolean; v_err text := 'none';
  v_row_read text := 'readable';
begin
  perform pg_temp.act_as(c);
  -- Before anything else: the call row itself must not hand over D's id.
  begin
    perform user_b_id from public.calls where id = pg_temp.id('CALL');
  exception when others then v_row_read := sqlerrm;
  end;
  v_result := public.safety_report(p_reason => 'Harassment', p_details => 'test', p_call => pg_temp.id('CALL'));
  v_blocks := public.my_blocks();

  perform pg_temp.act_as(pg_temp.id('E'));
  begin
    perform public.safety_report(p_reason => 'x', p_call => pg_temp.id('CALL'));
  exception when others then v_err := sqlerrm;
  end;

  perform pg_temp.act_as_owner();
  select * into r from public.reports where reporter_id = c order by created_at desc limit 1;
  select status into v_call from public.calls where id = pg_temp.id('CALL');
  select anonymous into v_block_anon from public.blocks where blocker_id = c and blocked_id = d;

  insert into t (ok, check_name, detail) values
    (r.reported_id = d and r.related_call_id = pg_temp.id('CALL') and r.status = 'open',
     'a call report is filed against the other caller', coalesce(r.status, 'no report')),
    (v_row_read <> 'readable',
     'a caller can''t read the call row (and the other caller''s id) directly', v_row_read),
    (position(d::text in v_result::text) = 0 and position(d::text in v_blocks::text) = 0,
     'the reporter is never told the other caller''s id', v_blocks::text),
    (v_blocks->0->>'name' = 'Test' and v_blocks->0->>'photo_url' is null and v_block_anon,
     'their blocked list shows a first name only, no photo', v_blocks->0->>'name'),
    (v_call = 'ended', 'reporting ends the live call', v_call),
    (v_err <> 'none', 'someone who wasn''t on the call can''t report it', v_err);
end $$;

/* ─── 5. objectionable text ──────────────────────────────────────────── */
do $$
declare
  e uuid := pg_temp.id('E');
  v_bio text := 'rejected'; v_caption text := 'rejected';
  v_brit text := 'rejected'; v_es text := 'rejected'; v_raccoon text := 'rejected';
begin
  perform pg_temp.act_as(e);
  begin update public.profiles set bio = 'honestly you are a retard' where id = e; v_bio := 'accepted';
  exception when others then null; end;
  begin update public.profiles set bio = 'Fancy a fag break and a pint after?' where id = e; v_brit := 'accepted';
  exception when others then null; end;
  begin update public.profiles set bio = 'Qué pedo, ¿vamos por tacos?' where id = e; v_es := 'accepted';
  exception when others then null; end;
  begin update public.profiles set bio = 'Raccoon enthusiast, tycoon in training' where id = e; v_raccoon := 'accepted';
  exception when others then null; end;

  perform pg_temp.act_as(pg_temp.id('A'));
  begin
    insert into public.proposal_messages (proposal_id, sender_id, caption, video_url)
    values (pg_temp.id('PROPOSAL'), pg_temp.id('A'), 'send me your nudes', 'https://example.test/m.mp4');
    v_caption := 'accepted';
  exception when others then null; end;

  perform pg_temp.act_as_owner();
  insert into t (ok, check_name, detail) values
    (v_bio = 'rejected',     'a slur in a bio is refused', v_bio),
    (v_caption = 'rejected', 'sexual solicitation in a message is refused', v_caption),
    (v_brit = 'accepted',    'British "fag" (a cigarette) is not caught', v_brit),
    (v_es = 'accepted',      'Spanish "qué pedo" is not caught', v_es),
    (v_raccoon = 'accepted', 'words containing a slur ("raccoon") are not caught', v_raccoon);
end $$;

/* ─── 6. terms and age ───────────────────────────────────────────────── */
do $$
declare f uuid := pg_temp.id('F'); v_minor text := 'accepted'; v_direct timestamptz; v_state jsonb;
begin
  perform pg_temp.act_as(f);
  begin perform public.accept_terms('2026-09-21', false); exception when others then v_minor := sqlerrm; end;
  begin update public.profiles set terms_accepted_at = now() where id = f; exception when others then null; end;
  perform pg_temp.act_as_owner();
  select terms_accepted_at into v_direct from public.profiles where id = f;

  perform pg_temp.act_as(f);
  v_state := public.accept_terms('2026-09-21', true);
  perform pg_temp.act_as_owner();

  insert into t (ok, check_name, detail) values
    (v_minor <> 'accepted', 'terms can''t be accepted without confirming 18+', v_minor),
    (v_direct is null, 'a member can''t stamp terms_accepted_at themselves', coalesce(v_direct::text, 'null')),
    (v_state->>'terms_version' = '2026-09-21' and v_state->>'terms_accepted_at' is not null,
     'accept_terms records the version and time', v_state::text);
end $$;

/* ─── 7. the report queue and the ban ────────────────────────────────── */
do $$
declare
  d uuid := pg_temp.id('D');
  v_nonadmin text := 'allowed'; v_nonadmin_ban text := 'allowed';
  v_queue jsonb; v_report uuid; v_banned timestamptz; v_open int;
  v_f_sees int; v_admin_sees int; v_suspended text := 'allowed'; v_state jsonb;
begin
  perform pg_temp.act_as(pg_temp.id('A'));
  begin perform public.admin_reports('open'); exception when others then v_nonadmin := sqlerrm; end;
  begin perform public.admin_ban_user(pg_temp.id('B'), 'x'); exception when others then v_nonadmin_ban := sqlerrm; end;

  perform pg_temp.act_as(pg_temp.id('ADMIN'));
  v_queue := public.admin_reports('open');
  select (e->>'id')::uuid into v_report
    from jsonb_array_elements(v_queue) e where (e->'reported'->>'id')::uuid = d limit 1;
  perform public.admin_resolve_report(v_report, 'ban', 'test ban');
  select count(*) into v_admin_sees from public.profiles where id = d;

  perform pg_temp.act_as(pg_temp.id('F'));
  select count(*) into v_f_sees from public.profiles where id = d;

  perform pg_temp.act_as(d);
  begin
    insert into public.call_queue (user_id, status) values (d, 'waiting');
  exception when others then
    get stacked diagnostics v_suspended = pg_exception_hint;
  end;
  v_state := public.my_safety_state();

  perform pg_temp.act_as_owner();
  select banned_at into v_banned from public.profiles where id = d;
  select count(*) into v_open from public.reports where reported_id = d and status = 'open';

  insert into t (ok, check_name, detail) values
    (v_nonadmin <> 'allowed',     'a member can''t read the report queue', v_nonadmin),
    (v_nonadmin_ban <> 'allowed', 'a member can''t ban anyone', v_nonadmin_ban),
    (v_report is not null,        'the admin sees the call report in the queue', coalesce(v_report::text, 'missing')),
    (v_banned is not null and v_open = 0, 'a ban closes every open report against them', v_open || ' still open'),
    (v_f_sees = 0,                'a banned member disappears for everyone', v_f_sees || ''),
    (v_admin_sees = 1,            '...except the admin', v_admin_sees || ''),
    (v_suspended = 'account_suspended', 'a banned member can''t queue for a call', v_suspended),
    (v_state->>'banned_at' is not null, 'the app is told the account is suspended', v_state::text);
end $$;

/* ─── 8. Report from anywhere, remove what you posted (0028) ─────────── */
do $$
declare
  e uuid := pg_temp.id('E'); f uuid := pg_temp.id('F');
  v_prop uuid; v_msg_e uuid; v_msg_f uuid; v_call uuid;
  v_contacts jsonb; v_after jsonb; v_other_del int; v_own_del int;
  v_withdraw_other text := 'allowed'; v_status text; v_f_sees int;
begin
  -- E sends F an invitation; they swap a message each; they had a call.
  insert into public.proposals (sender_id, recipient_id, venue_name, date_type, starts_at, message, video_url, expires_at)
  values (e, f, 'Venue', 'coffee', now() + interval '5 days', 'Coffee?', 'https://example.test/v.mp4', now() + interval '5 days')
  returning id into v_prop;
  insert into public.proposal_messages (proposal_id, sender_id, caption, video_url)
  values (v_prop, e, 'hi', 'https://example.test/m.mp4') returning id into v_msg_e;
  insert into public.proposal_messages (proposal_id, sender_id, caption, video_url)
  values (v_prop, f, 'hello', 'https://example.test/m.mp4') returning id into v_msg_f;
  insert into public.calls (user_a_id, user_b_id, status, started_at, ended_at)
  values (e, f, 'ended', now() - interval '1 hour', now() - interval '50 minutes') returning id into v_call;

  perform pg_temp.act_as(f);
  v_contacts := public.my_recent_contacts();
  -- F may not delete E's message, and may not withdraw E's invitation.
  with d as (delete from public.proposal_messages where id = v_msg_e returning 1) select count(*) into v_other_del from d;
  begin perform public.withdraw_proposal(v_prop); exception when others then v_withdraw_other := sqlerrm; end;
  -- F deletes her own message.
  with d as (delete from public.proposal_messages where id = v_msg_f returning 1) select count(*) into v_own_del from d;

  -- E withdraws the invitation: F no longer sees it.
  perform pg_temp.act_as(e);
  perform public.withdraw_proposal(v_prop);
  perform pg_temp.act_as_owner();
  select status into v_status from public.proposals where id = v_prop;

  -- F blocks E: E drops out of F's report list too.
  perform pg_temp.act_as(f);
  perform public.safety_block(p_user => e, p_reason => 'test');
  v_after := public.my_recent_contacts();
  perform pg_temp.act_as_owner();

  insert into t (ok, check_name, detail) values
    (jsonb_array_length(v_contacts) = 2
       and exists (select 1 from jsonb_array_elements(v_contacts) c where c->>'kind' = 'call' and c->>'id' = v_call::text)
       and exists (select 1 from jsonb_array_elements(v_contacts) c where c->>'kind' = 'proposal'),
     'Report someone lists the call and the invitation', v_contacts::text),
    (position(e::text in v_contacts::text) = 0,
     'the report list never contains the other member''s id', 'checked'),
    (v_other_del = 0, 'a member cannot delete someone else''s message', v_other_del || ''),
    (v_own_del = 1, 'a member can delete their own message', v_own_del || ''),
    (v_withdraw_other <> 'allowed', 'only the sender can withdraw an invitation', v_withdraw_other),
    (v_status = 'cancelled', 'the sender can withdraw an unanswered invitation', v_status),
    (jsonb_array_length(v_after) = 0, 'after blocking, that person is gone from the report list', v_after::text);
end $$;

select n, case when ok then 'PASS' else 'FAIL' end as result, check_name, detail from t order by n;

rollback;
