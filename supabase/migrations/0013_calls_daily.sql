-- Live calls, part 2: room lifetime, and making the private answer actually
-- private.
--
-- 0011 created the calls table with a participant SELECT policy and a
-- participant UPDATE policy. Both are too generous for what the product
-- promises. RLS filters rows, not columns, so a participant selecting the row
-- could read a_wants_to_meet / b_wants_to_meet and learn the other person's
-- answer -- the exact thing the call screen tells them stays hidden. The open
-- UPDATE policy is worse: either side could write the other side's answer and
-- manufacture a match.
--
-- This migration takes both privileges away and routes every write through
-- SECURITY DEFINER functions that decide which column belongs to the caller.
--
-- Run in the Supabase SQL Editor. Idempotent.

/* --- 1. Room lifetime ---------------------------------------------- */
-- Daily enforces the call length server-side (room exp + eject_at_room_exp).
-- Storing the same instant here is what both phones count down to, so the
-- timer on screen and the moment the audio actually cuts are the same thing.

alter table public.calls
  add column if not exists expires_at timestamptz;

/* --- 2. Lock the table down ---------------------------------------- */

-- Writes go through the functions below.
drop policy if exists calls_participant_update on public.calls;
revoke update on public.calls from authenticated;

-- Reads: keep the row visible, but never the two answer columns. The client
-- selects explicit columns; `select *` on this table is now a privilege error
-- for members, which is the intended failure mode.
revoke select (a_wants_to_meet, b_wants_to_meet) on public.calls from authenticated;

/* --- 3. The call as its own participant sees it --------------------- */
-- Returns the shared facts plus *your* answer only. The other person's answer
-- is never in the result set, mutual or not; a match is communicated by
-- resulting_date_id appearing, which reveals nothing on its own if you said no.

create or replace function public.call_my_state(p_call_id uuid)
returns table (
  id                uuid,
  status            text,
  medium            text,
  room_url          text,
  room_name         text,
  started_at        timestamptz,
  expires_at        timestamptz,
  other_name        text,
  my_answer         boolean,
  resulting_date_id uuid
)
language sql
stable
security definer
set search_path = public
as $fn$
  select
    c.id, c.status, c.medium, c.room_url, c.room_name, c.started_at, c.expires_at,
    -- First name only. You are meant to hear a voice, not read a profile.
    split_part(coalesce(o.name, 'Someone'), ' ', 1),
    case when auth.uid() = c.user_a_id then c.a_wants_to_meet else c.b_wants_to_meet end,
    -- Only surfaced once you have said yes yourself, so the absence of a date
    -- can never be read as "they turned me down".
    case
      when auth.uid() = c.user_a_id and c.a_wants_to_meet is true then c.resulting_date_id
      when auth.uid() = c.user_b_id and c.b_wants_to_meet is true then c.resulting_date_id
      else null
    end
  from public.calls c
  join public.profiles o
    on o.id = case when auth.uid() = c.user_a_id then c.user_b_id else c.user_a_id end
  where c.id = p_call_id
    and auth.uid() in (c.user_a_id, c.user_b_id);
$fn$;

grant execute on function public.call_my_state(uuid) to authenticated;

/* --- 4. Writing your own answer, and only your own ------------------ */

create or replace function public.call_submit_outcome(p_call_id uuid, p_wants boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  c public.calls%rowtype;
begin
  select * into c from public.calls where id = p_call_id;
  if not found then
    raise exception 'Call not found';
  end if;
  if auth.uid() not in (c.user_a_id, c.user_b_id) then
    raise exception 'Not your call';
  end if;

  -- Which column is yours is decided here, from the JWT, not from anything
  -- the client sends.
  if auth.uid() = c.user_a_id then
    update public.calls set a_wants_to_meet = p_wants where id = p_call_id;
  else
    update public.calls set b_wants_to_meet = p_wants where id = p_call_id;
  end if;

  -- on_call_interest fires on that update and creates the date when both said
  -- yes. Re-read to pick up what it wrote.
  select * into c from public.calls where id = p_call_id;

  -- Same rule as call_my_state: you only learn about the date if you asked
  -- for one.
  if (auth.uid() = c.user_a_id and c.a_wants_to_meet is true)
     or (auth.uid() = c.user_b_id and c.b_wants_to_meet is true) then
    return c.resulting_date_id;
  end if;
  return null;
end;
$fn$;

grant execute on function public.call_submit_outcome(uuid, boolean) to authenticated;

/* --- 5. Call lifecycle ---------------------------------------------- */

create or replace function public.call_mark_started(p_call_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  update public.calls
     set started_at = coalesce(started_at, now()),
         status     = case when status = 'ringing' then 'active' else status end
   where id = p_call_id
     and auth.uid() in (user_a_id, user_b_id);
end;
$fn$;

grant execute on function public.call_mark_started(uuid) to authenticated;

create or replace function public.call_mark_ended(p_call_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  update public.calls
     set ended_at     = coalesce(ended_at, now()),
         duration_sec = coalesce(
           duration_sec,
           greatest(0, extract(epoch from (now() - coalesce(started_at, created_at)))::int)
         ),
         -- A call nobody ever joined is 'missed', not 'ended'
         status       = case when started_at is null then 'missed' else 'ended' end
   where id = p_call_id
     and auth.uid() in (user_a_id, user_b_id)
     and status in ('ringing', 'active');

  -- Leaving the call also leaves the queue, so a stale 'matched' row can
  -- never block the next join.
  update public.call_queue
     set status = 'left'
   where user_id = auth.uid()
     and call_id = p_call_id
     and status <> 'left';
end;
$fn$;

grant execute on function public.call_mark_ended(uuid) to authenticated;

/* --- 6. Whatever call I am currently in ----------------------------- */
-- The client polls this while waiting in the queue. Returns nothing until the
-- matcher has both created the room and pointed the queue row at it, so a
-- half-built call is never handed to a phone.

create or replace function public.my_active_call()
returns uuid
language sql
stable
security definer
set search_path = public
as $fn$
  select c.id
    from public.calls c
   where auth.uid() in (c.user_a_id, c.user_b_id)
     and c.status in ('ringing', 'active')
     and c.room_url is not null
     and (c.expires_at is null or c.expires_at > now())
   order by c.created_at desc
   limit 1;
$fn$;

grant execute on function public.my_active_call() to authenticated;

/* --- 6b. How many people are in the queue ---------------------------- */
-- call_queue is own-rows-only under RLS, so a plain count from the client
-- can only ever return 0 or 1 -- it would be counting yourself. This is the
-- one aggregate that has to cross the boundary, and it returns a single
-- integer, so it leaks nothing about who is waiting.

create or replace function public.call_queue_size()
returns int
language sql
stable
security definer
set search_path = public
as $fn$
  select count(*)::int
    from public.call_queue
   where status = 'waiting'
     and created_at > now() - interval '15 minutes';
$fn$;

grant execute on function public.call_queue_size() to authenticated;

/* --- 7. Housekeeping ------------------------------------------------ */
-- No scheduler in this project, so the client calls this when it opens the
-- call screen. Clears rooms that expired without anyone pressing leave.

create or replace function public.expire_stale_calls()
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare
  n int;
begin
  update public.calls
     set status   = case when started_at is null then 'missed' else 'ended' end,
         ended_at = coalesce(ended_at, expires_at, now())
   where status in ('ringing', 'active')
     and expires_at is not null
     and expires_at < now();
  get diagnostics n = row_count;

  -- A queue row older than fifteen minutes is someone who closed the app.
  update public.call_queue
     set status = 'expired'
   where status = 'waiting'
     and created_at < now() - interval '15 minutes';

  return n;
end;
$fn$;

grant execute on function public.expire_stale_calls() to authenticated;
