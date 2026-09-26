-- App Review demo content for review.a@auradating.app. Run before EVERY
-- submission, and again after each review (reporting or blocking a demo
-- member hides it, which is the point, so it has to be put back).
--
--   npx supabase db query --linked -f supabase/review_demo.sql
--
-- Why this exists: build 8 was rejected under 1.2 a second time. The reviewer
-- signed in as review.a -- the account in App Review's Sign-In Information --
-- at 10:31 London time, and review.a had nothing on screen from anyone else:
-- no invitation, no date, no call. Every Report and Block control in the app
-- sits on another member's content, so the reviewer could not find one.
--
-- After this runs, review.a has, at any hour:
--   Meet > Proposals for you  two pending invitations with a video (Tom, Sam)
--   Dates                     an upcoming date with a message thread (Leo),
--                             including one message of review.a's own to delete,
--                             and a blind date (Max)
--   Profile > Safety          all of the above plus yesterday's voice call (Ash)
--                             under "Report someone"
-- Everything is reportable and blockable, and blocking makes it vanish.
--
-- The demo senders were created through the normal sign-up, are male and
-- interested in women, and are visible only to review.a: women don't browse,
-- and men browse only women.
--
-- Idempotent. Touches only rows that involve review.a and the demo senders.

do $$
declare
  a      uuid := (select id from public.profiles where email = 'review.a@auradating.app');
  b      uuid := (select id from public.profiles where email = 'review.b@auradating.app');
  tom    uuid := (select id from public.profiles where email = 'review.demo.tom@auradating.app');
  sam    uuid := (select id from public.profiles where email = 'review.demo.sam@auradating.app');
  leo    uuid := (select id from public.profiles where email = 'review.demo.leo@auradating.app');
  max_   uuid := (select id from public.profiles where email = 'review.demo.max@auradating.app');
  ash    uuid := (select id from public.profiles where email = 'review.demo.ash@auradating.app');
  demos  uuid[];
  video  text := 'https://krkibouizxurqboyahon.supabase.co/storage/v1/object/public/proposal-videos/192e869f-f3c1-4928-8db9-779fde2f5193/aura-demo-intro.mp4';
  -- 19:30 London on a Friday three weeks out, so it's always in the future.
  friday timestamptz := (date_trunc('week', (now() at time zone 'Europe/London')::date + 21) + interval '4 days 19 hours 30 minutes') at time zone 'Europe/London';
  saturday timestamptz := (date_trunc('week', (now() at time zone 'Europe/London')::date + 14) + interval '5 days 19 hours 30 minutes') at time zone 'Europe/London';
  p_leo  uuid;
begin
  if a is null or tom is null or sam is null or leo is null or max_ is null or ash is null then
    raise exception 'Missing review.a or a demo account; see the scratch make-demo-accounts script';
  end if;
  demos := array[tom, sam, leo, max_, ash];

  /* ── 1. Wipe what the last review did, and the old demo rows ─────────── */
  delete from public.reports where reporter_id = a or reported_id = any(demos);
  delete from public.blocks
   where blocker_id = a or blocked_id = a
      or blocker_id = any(demos) or blocked_id = any(demos);
  delete from public.proposal_messages
   where proposal_id in (select id from public.proposals where sender_id = any(demos) or recipient_id = any(demos));
  delete from public.dates     where user_a_id = any(demos) or user_b_id = any(demos);
  delete from public.proposals where sender_id = any(demos) or recipient_id = any(demos);
  delete from public.calls     where user_a_id = any(demos) or user_b_id = any(demos);

  /* ── 2. The demo senders, as members ────────────────────────────────── */
  update public.profiles p set
    gender = 'male', gender_interest = 'female', city = 'London',
    age = v.age, birthday = (current_date - make_interval(years => v.age, days => 40)),
    bio = v.bio,
    verification_status = 'verified', verified_at = now(),
    verification_reason = 'App Review demo member',
    profile_complete = true, terms_accepted_at = now(), terms_version = '2026-09-21',
    banned_at = null, banned_reason = null
  from (values
    (tom,  31, 'Demo member for App Review. Architect, Sunday runner, collector of terrible puns.'),
    (sam,  29, 'Demo member for App Review. Chef by day, amateur astronomer by night.'),
    (leo,  33, 'Demo member for App Review. Teaches history, bakes bread, walks everywhere.'),
    (max_, 30, 'Demo member for App Review.'),
    (ash,  28, 'Demo member for App Review.')
  ) as v(id, age, bio)
  where p.id = v.id;

  /* ── 3. Two pending invitations in review.a's inbox ─────────────────── */
  insert into public.proposals
    (sender_id, recipient_id, status, venue_name, venue_area, venue_address, venue_postcode, venue_tube,
     venue_lat, venue_lng, venue_emoji, date_type, starts_at, date_options, payment, message,
     video_url, video_duration_sec, match_score, match_reason, expires_at)
  values
    (tom, a, 'pending', 'Wine bar in Soho', 'Soho', 'Dean Street', 'W1D 3SG', 'Tottenham Court Road',
     51.5134, -0.1325, '🍷', 'dinner', friday, array[friday, friday + interval '1 day'], 'split',
     'Small plates and a glass of something good? I''ve left a couple of evenings open.',
     video, 7, 86, 'You both love long walks and good food', now() + interval '60 days'),
    (sam, a, 'pending', 'Coffee on the South Bank', 'South Bank', 'Belvedere Road', 'SE1 8XX', 'Waterloo',
     51.5055, -0.1160, '☕', 'coffee', saturday, array[saturday], 'he-pays',
     'Coffee and a walk along the river on Saturday? Low-key, easy to leave if it''s not for you.',
     video, 7, 78, 'Both verified members', now() + interval '60 days');

  /* ── 4. An upcoming date with a conversation (Leo) ──────────────────── */
  insert into public.proposals
    (sender_id, recipient_id, status, decided_at, venue_name, venue_area, venue_address, venue_postcode,
     venue_tube, venue_lat, venue_lng, venue_emoji, date_type, starts_at, payment, message,
     video_url, video_duration_sec, match_score, match_reason, expires_at)
  values
    (leo, a, 'accepted', now() - interval '1 day', 'Gallery café in Bloomsbury', 'Bloomsbury',
     'Great Russell Street', 'WC1B 3DG', 'Holborn', 51.5194, -0.1270, '🎨', 'gallery',
     saturday + interval '7 days', 'split', 'An exhibition and a coffee after?',
     video, 7, 81, 'You both like museums', now() + interval '60 days')
  returning id into p_leo;

  insert into public.dates
    (proposal_id, user_a_id, user_b_id, starts_at, venue_name, venue_address, venue_postcode,
     venue_lat, venue_lng, payment, status, mode)
  values
    (p_leo, leo, a, saturday + interval '7 days', 'Gallery café in Bloomsbury', 'Great Russell Street',
     'WC1B 3DG', 51.5194, -0.1270, 'split', 'upcoming', 'proposal');

  insert into public.proposal_messages (proposal_id, sender_id, caption, video_url, video_duration_sec, created_at)
  values
    (p_leo, leo, 'Looking forward to it. The Egyptian rooms first?', video, 7, now() - interval '20 hours'),
    (p_leo, a,   'Sounds perfect, see you at the entrance.',          video, 7, now() - interval '18 hours'),
    (p_leo, leo, 'Great. I''ll be the one with the terrible umbrella.', video, 7, now() - interval '2 hours');

  /* ── 5. A blind date being planned (Max) ─────────────────────────────── */
  insert into public.dates (user_a_id, user_b_id, status, mode)
  values (max_, a, 'planning', 'blind');

  /* ── 6. Yesterday's voice call (Ash): reportable from Profile > Safety ── */
  insert into public.calls
    (user_a_id, user_b_id, medium, status, created_at, started_at, ended_at, duration_sec, expires_at)
  values
    (ash, a, 'audio', 'ended', now() - interval '26 hours', now() - interval '26 hours',
     now() - interval '26 hours' + interval '7 minutes', 420, now() - interval '25 hours');

  /* ── 7. The reviewer starts from the terms screen, as a new member would ── */
  update public.profiles
     set terms_accepted_at = null, terms_version = null, banned_at = null, banned_reason = null
   where id in (a, b);
end $$;

-- What review.a will see.
select 'pending invitations' as what, count(*)::text as n
  from public.proposals where recipient_id = (select id from public.profiles where email = 'review.a@auradating.app') and status = 'pending'
union all
select 'dates', count(*)::text
  from public.dates where (select id from public.profiles where email = 'review.a@auradating.app') in (user_a_id, user_b_id)
union all
select 'thread messages', count(*)::text
  from public.proposal_messages m join public.proposals p on p.id = m.proposal_id
 where p.recipient_id = (select id from public.profiles where email = 'review.a@auradating.app')
union all
select 'recent calls', count(*)::text
  from public.calls where (select id from public.profiles where email = 'review.a@auradating.app') in (user_a_id, user_b_id)
union all
select 'blocks/reports involving review.a', count(*)::text
  from public.blocks where (select id from public.profiles where email = 'review.a@auradating.app') in (blocker_id, blocked_id);
