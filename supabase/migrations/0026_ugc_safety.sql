-- User-generated content safety — App Review guideline 1.2.
--
-- Apple rejected build 7 because members can reach strangers anonymously
-- (a voice call with no profile, a blind date with no photo) without the
-- safeguards that requires. This migration is the server half of the fix.
-- The rule throughout: a safeguard that only lives in the app is a
-- suggestion, so every one of these is enforced by the database.
--
--   1. Privileged profile columns can no longer be written by their owner.
--      Before this, any member could make themselves an admin
--      (`update profiles set is_admin = true`) or mark themselves verified.
--      Both were confirmed against the live database.
--   2. Profiles are no longer readable without signing in. The publishable
--      key alone returned every member's name and email.
--   3. Blocking works everywhere, both ways, immediately: someone you block,
--      or who blocks you, disappears from browse, proposals, messages, dates
--      and calls. Banned members disappear for everyone.
--   4. A banned member can't queue, propose or message.
--   5. Slurs, sexual solicitation and threats are refused at write time on
--      names, bios, proposal messages and thread captions.
--   6. Reporting resolves the other person on the server, so a call can be
--      reported without the app ever learning who was on the other end.
--   7. Admins get a report queue and a ban that removes the member's content
--      from every feed at once.
--   8. Members must accept the terms, and confirm they are 18+, before using
--      the app. Recorded server-side, not in the app.
--
-- Run in the Supabase SQL Editor. Idempotent.

/* ─── 1. New columns ─────────────────────────────────────────────────── */

alter table public.profiles
  add column if not exists banned_at         timestamptz,
  add column if not exists banned_reason     text,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version     text;

alter table public.reports
  add column if not exists related_call_id uuid references public.calls(id) on delete set null,
  add column if not exists action_note     text;

-- A block made from a call or a blind date must not de-anonymise the other
-- person in your own blocked list.
alter table public.blocks
  add column if not exists anonymous boolean not null default false;

create index if not exists reports_open_idx on public.reports(created_at) where status = 'open';
create index if not exists blocks_blocked_idx on public.blocks(blocked_id);

/* ─── 2. Privileged columns: members can't write them ───────────────── */
-- A trigger rather than grants alone: grants cover UPDATE, but the table-level
-- INSERT grant would still let a brand-new member insert their own row with
-- is_admin = true. The trigger covers insert, update and upsert alike.
--
-- current_user is 'authenticated' or 'anon' only for requests arriving through
-- the API. SECURITY DEFINER functions run as their owner, and the service role
-- and migrations are their own roles, so none of those are constrained.

create or replace function public.profiles_guard_privileged()
returns trigger
language plpgsql
as $fn$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.is_admin            := false;
    new.is_gold             := false;
    new.gold_expires_at     := null;
    new.verification_status := 'unverified';
    new.verified_at         := null;
    new.verification_reason := null;
    new.banned_at           := null;
    new.banned_reason       := null;
    new.terms_accepted_at   := null;
    new.terms_version       := null;
    return new;
  end if;

  new.is_admin            := old.is_admin;
  new.is_gold             := old.is_gold;
  new.gold_expires_at     := old.gold_expires_at;
  new.verified_at         := old.verified_at;
  new.verification_reason := old.verification_reason;
  new.banned_at           := old.banned_at;
  new.banned_reason       := old.banned_reason;
  new.terms_accepted_at   := old.terms_accepted_at;
  new.terms_version       := old.terms_version;

  -- The one move a member may make on their own status is to ask for review.
  -- The app does exactly this after a verification submission.
  if new.verification_status is distinct from old.verification_status
     and not (new.verification_status = 'pending'
              and coalesce(old.verification_status, 'unverified') <> 'verified') then
    new.verification_status := old.verification_status;
  end if;

  return new;
end;
$fn$;

drop trigger if exists profiles_guard_privileged on public.profiles;
create trigger profiles_guard_privileged
  before insert or update on public.profiles
  for each row execute function public.profiles_guard_privileged();

-- Belt and braces: these three carried explicit column UPDATE grants.
revoke update (is_admin, verified_at, verification_reason) on public.profiles from authenticated, anon;

/* ─── 3. Who is hidden from whom ─────────────────────────────────────── */
-- Phrased from the caller's side on purpose. A general "are A and B blocked"
-- function would let anyone probe block relationships between strangers.

create or replace function public.hidden_from_me(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select p_other is not null
     and p_other is distinct from auth.uid()
     and (
       exists (select 1 from public.profiles where id = p_other and banned_at is not null)
       or exists (
         select 1 from public.blocks b
          where (b.blocker_id = auth.uid() and b.blocked_id = p_other)
             or (b.blocker_id = p_other   and b.blocked_id = auth.uid())
       )
     );
$fn$;

revoke all on function public.hidden_from_me(uuid) from public;
grant execute on function public.hidden_from_me(uuid) to anon, authenticated;

-- Restrictive policies AND with the existing permissive ones, so they only
-- ever take rows away. Messages need none of their own: their select policy
-- looks the proposal up, and that lookup is itself filtered below.

drop policy if exists profiles_hide_blocked_banned on public.profiles;
create policy profiles_hide_blocked_banned on public.profiles
  as restrictive for select
  using (
    auth.uid() is not null
    and (id = auth.uid() or public.is_admin() or not public.hidden_from_me(id))
  );

drop policy if exists proposals_hide_blocked_banned on public.proposals;
create policy proposals_hide_blocked_banned on public.proposals
  as restrictive for select
  using (
    public.is_admin()
    or not public.hidden_from_me(case when auth.uid() = sender_id then recipient_id else sender_id end)
  );

drop policy if exists proposals_no_blocked_recipient on public.proposals;
create policy proposals_no_blocked_recipient on public.proposals
  as restrictive for insert
  with check (not public.hidden_from_me(recipient_id));

drop policy if exists dates_hide_blocked_banned on public.dates;
create policy dates_hide_blocked_banned on public.dates
  as restrictive for select
  using (
    public.is_admin()
    or not public.hidden_from_me(case when auth.uid() = user_a_id then user_b_id else user_a_id end)
  );

drop policy if exists calls_hide_blocked_banned on public.calls;
create policy calls_hide_blocked_banned on public.calls
  as restrictive for select
  using (
    public.is_admin()
    or not public.hidden_from_me(case when auth.uid() = user_a_id then user_b_id else user_a_id end)
  );

-- A call is anonymous until both people say yes, but the participant policy
-- let either caller read the row, other person's id included, and with that
-- id look up their full profile. The app never reads this table directly:
-- every call screen goes through SECURITY DEFINER functions that return a
-- first name only. So direct reads go.
revoke select on public.calls from anon, authenticated;

/* ─── 4. Banned members can't start anything ─────────────────────────── */

create or replace function public.reject_if_banned()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_row  jsonb := to_jsonb(new);
  v_user uuid  := coalesce((v_row->>'sender_id')::uuid, (v_row->>'user_id')::uuid);
begin
  if exists (select 1 from public.profiles where id = v_user and banned_at is not null) then
    raise exception 'This account has been suspended.'
      using errcode = 'P0001', hint = 'account_suspended';
  end if;
  return new;
end;
$fn$;

do $$
declare t text;
begin
  foreach t in array array['proposals', 'proposal_messages', 'call_queue', 'blind_date_signups', 'window_entries'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_reject_if_banned', t);
    execute format(
      'create trigger %I before insert on public.%I for each row execute function public.reject_if_banned()',
      t || '_reject_if_banned', t);
  end loop;
end $$;

/* ─── 5. Objectionable text ──────────────────────────────────────────── */
-- A deterministic floor that can't be bypassed by calling the API directly.
-- The app additionally screens text with OpenAI's moderation model before
-- sending, which catches harassment a word list never will; this list is what
-- holds when that call is skipped or fails open.
--
-- Deliberately narrow: slurs, sexual solicitation, anything involving minors,
-- and self-harm incitement. Ordinary swearing between adults is not blocked.
-- British usage was considered: "fag" (a cigarette) is left alone.

create or replace function public.objectionable_text(p text)
returns boolean
language sql
immutable
as $fn$
  select coalesce(lower(p), '') ~ (
    '\m('
    -- racial and ethnic slurs
    || 'nigg(er|a|ah|uh)s?|chinks?|gooks?|spics?|kikes?|wetbacks?|ragheads?|towelheads?'
    || '|pakis?|coons?|pikeys?|gyppos?|sand ?n[i1]gg(er|a)s?'
    -- homophobic, transphobic and ableist slurs
    || '|faggots?|fagg?ots?|dykes?|trann(y|ies)|shemales?|retards?|retarded|spaz(zes)?'
    -- sexual solicitation and misogynist abuse
    || '|whores?|sluts?|cunts?|send (me )?(your )?nudes|nudes? for|escort service'
    -- minors
    -- ("pedo" alone is ordinary Mexican Spanish, so only the unambiguous forms)
    || '|child ?porn|cp links?|lol[i1]s?|lolita|paedos?|pa?edophil(e|es|ia)|underage (girls?|boys?|sex)'
    -- incitement to self-harm
    || '|kill yourself|kys|go die'
    || ')\M'
  );
$fn$;

create or replace function public.reject_objectionable_text()
returns trigger
language plpgsql
as $fn$
declare
  v_new jsonb := to_jsonb(new);
  v_old jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  v_col text;
begin
  foreach v_col in array tg_argv loop
    -- Only text that is changing. An old bio that predates this list must not
    -- stop a member saving an unrelated change to their profile.
    if (v_new->>v_col) is distinct from (v_old->>v_col)
       and public.objectionable_text(v_new->>v_col) then
      raise exception 'That wording isn''t allowed on Aura.'
        using errcode = 'P0001', hint = 'objectionable_text';
    end if;
  end loop;
  return new;
end;
$fn$;

drop trigger if exists profiles_reject_objectionable on public.profiles;
create trigger profiles_reject_objectionable
  before insert or update on public.profiles
  for each row execute function public.reject_objectionable_text('name', 'bio');

drop trigger if exists proposals_reject_objectionable on public.proposals;
create trigger proposals_reject_objectionable
  before insert or update on public.proposals
  for each row execute function public.reject_objectionable_text('message');

drop trigger if exists proposal_messages_reject_objectionable on public.proposal_messages;
create trigger proposal_messages_reject_objectionable
  before insert or update on public.proposal_messages
  for each row execute function public.reject_objectionable_text('caption');

/* ─── 6. Reporting and blocking ──────────────────────────────────────── */
-- Who is "the other person" is decided here, from whatever the app is looking
-- at: a profile, a call, a date or a proposal. For a call the app only ever
-- has the call id, so reporting never tells it who was on the line.

create or replace function public.safety_counterpart(
  p_user uuid, p_call uuid, p_date uuid, p_proposal uuid
) returns uuid
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_me    uuid := auth.uid();
  v_other uuid;
begin
  if v_me is null then
    raise exception 'You need to be signed in';
  end if;

  if p_call is not null then
    select case when c.user_a_id = v_me then c.user_b_id
                when c.user_b_id = v_me then c.user_a_id end
      into v_other from public.calls c where c.id = p_call;
  elsif p_date is not null then
    select case when d.user_a_id = v_me then d.user_b_id
                when d.user_b_id = v_me then d.user_a_id end
      into v_other from public.dates d where d.id = p_date;
  elsif p_proposal is not null then
    select case when p.sender_id    = v_me then p.recipient_id
                when p.recipient_id = v_me then p.sender_id end
      into v_other from public.proposals p where p.id = p_proposal;
  else
    v_other := p_user;
  end if;

  if v_other is null then
    raise exception 'There is no one to report here';
  end if;
  if v_other = v_me then
    raise exception 'You can''t report yourself';
  end if;
  return v_other;
end;
$fn$;

revoke all on function public.safety_counterpart(uuid, uuid, uuid, uuid) from public;

create or replace function public.safety_block(
  p_user uuid default null, p_call uuid default null,
  p_date uuid default null, p_proposal uuid default null,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_me    uuid := auth.uid();
  v_other uuid := public.safety_counterpart(p_user, p_call, p_date, p_proposal);
begin
  insert into public.blocks (blocker_id, blocked_id, reason, anonymous)
  values (v_me, v_other, left(p_reason, 120), p_call is not null or p_date is not null)
  on conflict (blocker_id, blocked_id) do nothing;

  -- Blocking someone ends anything live between you, on both phones.
  update public.calls
     set status = 'ended', ended_at = coalesce(ended_at, now())
   where status in ('ringing', 'active')
     and ((user_a_id = v_me and user_b_id = v_other) or (user_a_id = v_other and user_b_id = v_me));

  return jsonb_build_object('blocked', true);
end;
$fn$;

create or replace function public.safety_report(
  p_reason text, p_details text default null,
  p_user uuid default null, p_call uuid default null,
  p_date uuid default null, p_proposal uuid default null,
  p_block boolean default true
) returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_me    uuid := auth.uid();
  v_other uuid := public.safety_counterpart(p_user, p_call, p_date, p_proposal);
begin
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Choose a reason';
  end if;

  insert into public.reports (
    reporter_id, reported_id, reason, details,
    related_call_id, related_date_id, related_proposal_id, status
  ) values (
    v_me, v_other, left(trim(p_reason), 80), left(p_details, 2000),
    p_call, p_date, p_proposal, 'open'
  );

  if p_block then
    perform public.safety_block(p_user, p_call, p_date, p_proposal, 'Reported: ' || left(trim(p_reason), 80));
  end if;

  return jsonb_build_object('reported', true, 'blocked', p_block);
end;
$fn$;

-- Your own blocked list. Read through here rather than a join on profiles,
-- because the profiles policy now hides exactly these people. A block made
-- from a call or a blind date shows a first name only, no photo, and not
-- their id either: with the id, unblocking would let you look them up. Unblock
-- is by the block row's own id for that reason.
create or replace function public.my_blocks()
returns jsonb
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id',         b.id,
           'blocked_id', case when b.anonymous then null else b.blocked_id end,
           'anonymous',  b.anonymous,
           'reason',     b.reason,
           'created_at', b.created_at,
           'name',       case when b.anonymous then split_part(coalesce(p.name, 'Member'), ' ', 1)
                              else coalesce(p.name, 'Member') end,
           'age',        case when b.anonymous then null else p.age end,
           'photo_url',  case when b.anonymous then null else p.photo_url end
         ) order by b.created_at desc), '[]'::jsonb)
    from public.blocks b
    left join public.profiles p on p.id = b.blocked_id
   where b.blocker_id = auth.uid();
$fn$;

/* ─── 7. Terms and account state ─────────────────────────────────────── */

create or replace function public.my_safety_state()
returns jsonb
language sql
stable
security definer
set search_path = public
as $fn$
  select jsonb_build_object(
           'terms_accepted_at', terms_accepted_at,
           'terms_version',     terms_version,
           'banned_at',         banned_at,
           'banned_reason',     banned_reason)
    from public.profiles
   where id = auth.uid();
$fn$;

create or replace function public.accept_terms(p_version text, p_confirm_adult boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if auth.uid() is null then
    raise exception 'You need to be signed in';
  end if;
  if not coalesce(p_confirm_adult, false) then
    raise exception 'You must be 18 or older to use Aura.';
  end if;
  if coalesce(trim(p_version), '') = '' then
    raise exception 'Missing terms version';
  end if;

  update public.profiles
     set terms_accepted_at = now(), terms_version = trim(p_version)
   where id = auth.uid();
  if not found then
    raise exception 'Your profile isn''t ready yet. Try again in a moment.';
  end if;

  return public.my_safety_state();
end;
$fn$;

/* ─── 8. Moderation: the report queue and the ban ────────────────────── */

create or replace function public.admin_ban_user(p_user uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if not public.is_admin() then
    raise exception 'Not allowed';
  end if;
  if p_user = auth.uid() then
    raise exception 'You can''t ban yourself';
  end if;

  update public.profiles
     set banned_at = coalesce(banned_at, now()), banned_reason = p_reason
   where id = p_user;

  -- Eject: out of every queue, nothing pending, nothing live. Their profile,
  -- proposals, messages and dates are already gone from every other member's
  -- view through the policies above; they are kept, not deleted, so there is
  -- something to hand over if a report ever becomes a police matter.
  update public.call_queue         set status = 'left'      where user_id = p_user and status = 'waiting';
  update public.blind_date_signups set status = 'left'      where user_id = p_user and status = 'waiting';
  update public.proposals          set status = 'cancelled' where sender_id = p_user and status = 'pending';
  update public.calls
     set status = 'ended', ended_at = coalesce(ended_at, now())
   where status in ('ringing', 'active') and (user_a_id = p_user or user_b_id = p_user);
end;
$fn$;

create or replace function public.admin_unban_user(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if not public.is_admin() then
    raise exception 'Not allowed';
  end if;
  update public.profiles set banned_at = null, banned_reason = null where id = p_user;
end;
$fn$;

create or replace function public.admin_reports(p_status text default 'open')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  if not public.is_admin() then
    raise exception 'Not allowed';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id',                  r.id,
             'created_at',          r.created_at,
             'status',              r.status,
             'reason',              r.reason,
             'details',             r.details,
             'reviewed_at',         r.reviewed_at,
             'action_note',         r.action_note,
             'related_call_id',     r.related_call_id,
             'related_date_id',     r.related_date_id,
             'related_proposal_id', r.related_proposal_id,
             'reporter', jsonb_build_object('id', rp.id, 'name', rp.name, 'email', rp.email),
             'reported', jsonb_build_object(
               'id', rd.id, 'name', rd.name, 'email', rd.email, 'bio', rd.bio,
               'photo_url', rd.photo_url, 'banned_at', rd.banned_at,
               'open_reports', (select count(*) from public.reports x
                                 where x.reported_id = rd.id and x.status = 'open'))
           ) order by r.created_at asc)
      from public.reports r
      join public.profiles rp on rp.id = r.reporter_id
      join public.profiles rd on rd.id = r.reported_id
     where p_status is null or coalesce(r.status, 'open') = p_status
  ), '[]'::jsonb);
end;
$fn$;

create or replace function public.admin_resolve_report(p_report uuid, p_action text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_reported uuid;
begin
  if not public.is_admin() then
    raise exception 'Not allowed';
  end if;

  select reported_id into v_reported from public.reports where id = p_report;
  if v_reported is null then
    raise exception 'Report not found';
  end if;

  if p_action = 'ban' then
    perform public.admin_ban_user(v_reported, coalesce(nullif(trim(p_note), ''), 'Removed after a member report'));
    -- One ban answers every open report against them.
    update public.reports
       set status = 'actioned', reviewed_at = now(), action_note = p_note
     where reported_id = v_reported and coalesce(status, 'open') = 'open';
  elsif p_action = 'dismiss' then
    update public.reports
       set status = 'dismissed', reviewed_at = now(), action_note = p_note
     where id = p_report;
  else
    raise exception 'Unknown action: %', p_action;
  end if;

  return jsonb_build_object('ok', true, 'action', p_action);
end;
$fn$;

-- Admins may read reports directly too (the edge function counts them).
drop policy if exists reports_admin_all on public.reports;
create policy reports_admin_all on public.reports
  for all using (public.is_admin()) with check (public.is_admin());

/* ─── Grants ─────────────────────────────────────────────────────────── */

do $$
declare f text;
begin
  foreach f in array array[
    'public.safety_block(uuid, uuid, uuid, uuid, text)',
    'public.safety_report(text, text, uuid, uuid, uuid, uuid, boolean)',
    'public.my_blocks()',
    'public.my_safety_state()',
    'public.accept_terms(text, boolean)',
    'public.admin_ban_user(uuid, text)',
    'public.admin_unban_user(uuid)',
    'public.admin_reports(text)',
    'public.admin_resolve_report(uuid, text, text)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

/* ─── Someone has to answer the reports ──────────────────────────────── */
-- There was no admin at all, so the report queue would have been read by no
-- one. The developer's own account, which also receives the in-app reports.
update public.profiles set is_admin = true where lower(email) = 'azpiazujavier@gmail.com';
