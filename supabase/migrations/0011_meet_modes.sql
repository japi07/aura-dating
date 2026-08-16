-- Three ways to meet: curated proposals (existing), blind dates, call dates.
--
-- Design note: blind and call dates do NOT get parallel date tables. Both
-- converge into public.dates, which already powers the Dates tab, reminders,
-- ratings and the post-date "swap numbers?" follow-up. They are distinguished
-- by dates.mode and, before ops has picked a venue, by the new 'planning'
-- status.
--
-- Run in the Supabase SQL Editor. Idempotent.

/* ─── 1. dates: origin + a pre-venue state ─────────────────────────── */

alter table public.dates
  add column if not exists mode text not null default 'proposal';

alter table public.dates drop constraint if exists dates_mode_check;
alter table public.dates add constraint dates_mode_check
  check (mode in ('proposal', 'blind', 'call'));

-- Blind and call dates exist before a venue or time is chosen, so 'planning'
-- is a real state rather than a fake venue string.
alter table public.dates drop constraint if exists dates_status_check;
alter table public.dates add constraint dates_status_check
  check (status in ('planning', 'upcoming', 'completed', 'cancelled', 'no-show'));

alter table public.dates alter column starts_at drop not null;
alter table public.dates alter column venue_name drop not null;

create index if not exists dates_mode_status_idx on public.dates(mode, status);

/* ─── 2. Blind date pool ───────────────────────────────────────────── */

create table if not exists public.blind_date_signups (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  status          text not null default 'waiting'
    check (status in ('waiting', 'matched', 'cancelled', 'expired')),

  -- Hard constraints the concierge must respect, not hints.
  areas           text[] not null default '{}',
  date_styles     text[] not null default '{}',
  budget          text default 'mid' check (budget in ('low', 'mid', 'high')),
  available_from  date not null,
  available_to    date not null,
  time_bands      text[] not null default '{}',
  dietary         text,
  accessibility   text,

  matched_date_id uuid references public.dates(id) on delete set null,
  created_at      timestamptz default now(),
  matched_at      timestamptz,

  constraint blind_dates_sane check (available_to >= available_from)
);

-- One active signup per person. Partial index so cancelled/matched signups
-- don't block joining again.
create unique index if not exists blind_signups_one_active
  on public.blind_date_signups(user_id) where status = 'waiting';

create index if not exists blind_signups_waiting_idx
  on public.blind_date_signups(status, created_at) where status = 'waiting';

alter table public.blind_date_signups enable row level security;

drop policy if exists blind_signups_own on public.blind_date_signups;
create policy blind_signups_own on public.blind_date_signups
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

/* ─── 3. Call date queue + calls ───────────────────────────────────── */

create table if not exists public.call_queue (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  status        text not null default 'waiting'
    check (status in ('waiting', 'matched', 'left', 'expired')),
  medium        text not null default 'audio' check (medium in ('audio', 'video')),
  topics        text[] not null default '{}',
  call_id       uuid,
  created_at    timestamptz default now()
);

create unique index if not exists call_queue_one_active
  on public.call_queue(user_id) where status = 'waiting';

alter table public.call_queue enable row level security;

drop policy if exists call_queue_own on public.call_queue;
create policy call_queue_own on public.call_queue
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.calls (
  id              uuid primary key default gen_random_uuid(),
  user_a_id       uuid not null references public.profiles(id) on delete cascade,
  user_b_id       uuid not null references public.profiles(id) on delete cascade,
  medium          text not null default 'audio',
  status          text not null default 'ringing'
    check (status in ('ringing', 'active', 'ended', 'missed', 'failed')),

  -- Provider room details, written by the Edge Function
  room_url        text,
  room_name       text,
  started_at      timestamptz,
  ended_at        timestamptz,
  duration_sec    int,

  -- Private post-call answers. Neither side ever sees the other's.
  a_wants_to_meet boolean,
  b_wants_to_meet boolean,
  resulting_date_id uuid references public.dates(id) on delete set null,

  created_at      timestamptz default now(),
  constraint call_distinct_users check (user_a_id <> user_b_id)
);

create index if not exists calls_user_a_idx on public.calls(user_a_id, created_at desc);
create index if not exists calls_user_b_idx on public.calls(user_b_id, created_at desc);

alter table public.calls enable row level security;

drop policy if exists calls_participant_select on public.calls;
create policy calls_participant_select on public.calls
  for select using (auth.uid() in (user_a_id, user_b_id));

drop policy if exists calls_participant_update on public.calls;
create policy calls_participant_update on public.calls
  for update using (auth.uid() in (user_a_id, user_b_id));

/* ─── 4. Mutual interest after a call creates a real date ──────────── */

create or replace function public.handle_call_mutual_interest() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare
  new_date_id uuid;
begin
  if new.a_wants_to_meet is true
     and new.b_wants_to_meet is true
     and new.resulting_date_id is null then
    insert into public.dates (user_a_id, user_b_id, mode, status, payment)
    values (new.user_a_id, new.user_b_id, 'call', 'planning', 'split')
    returning id into new_date_id;
    new.resulting_date_id := new_date_id;
  end if;
  return new;
end;
$fn$;

drop trigger if exists on_call_interest on public.calls;
create trigger on_call_interest
  before update of a_wants_to_meet, b_wants_to_meet on public.calls
  for each row execute function public.handle_call_mutual_interest();

/* ─── 5. Fix: proposals never actually expired ─────────────────────── */
-- expires_at has existed since day one and 'expired' is a valid status, but
-- nothing ever wrote it, so stale proposals sat pending forever. There is no
-- scheduler in this project, so the client calls this on refresh.

create or replace function public.expire_stale_proposals() returns int
language plpgsql security definer set search_path = public as $fn$
declare
  n int;
begin
  update public.proposals
     set status = 'expired', decided_at = now()
   where status = 'pending' and expires_at < now();
  get diagnostics n = row_count;
  return n;
end;
$fn$;

grant execute on function public.expire_stale_proposals() to authenticated;
