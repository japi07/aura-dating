-- ───────────────────────────────────────────────────────────────────
-- AURA — Database schema
-- Run this in the Supabase SQL Editor on a fresh project.
-- Idempotent: safe to re-run for incremental changes.
-- ───────────────────────────────────────────────────────────────────

-- Required extensions
create extension if not exists "pgcrypto";

-- ───────────────────────────────────────────────────────────────────
-- profiles — extends auth.users with public profile data
-- ───────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  email          text unique not null,
  name           text not null,
  birthday       date,
  age            int check (age >= 18 and age <= 120),
  gender         text check (gender in ('male', 'female', 'non-binary')),
  gender_interest text check (gender_interest in ('male', 'female', 'everyone')),
  city           text,
  bio            text,
  interests      text[] default '{}',
  photo_url      text,
  photos         text[] default '{}',
  verification_status text default 'unverified'
    check (verification_status in ('unverified', 'submitting', 'pending', 'verified', 'rejected')),
  verified_at    timestamptz,
  verification_reason text,
  profile_complete boolean default false,
  -- Aura Gold subscription (kept in sync by the RevenueCat webhook)
  is_gold         boolean default false,
  gold_expires_at timestamptz,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- Backfill for projects created before the Gold columns existed
alter table public.profiles add column if not exists is_gold boolean default false;
alter table public.profiles add column if not exists gold_expires_at timestamptz;

create index if not exists profiles_gender_idx on public.profiles(gender);
create index if not exists profiles_city_idx on public.profiles(city);
create index if not exists profiles_verified_at_idx on public.profiles(verified_at);

-- ───────────────────────────────────────────────────────────────────
-- proposals — date proposals between users
-- ───────────────────────────────────────────────────────────────────
create table if not exists public.proposals (
  id              uuid primary key default gen_random_uuid(),
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  recipient_id    uuid not null references public.profiles(id) on delete cascade,
  status          text default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'expired', 'cancelled')),

  -- Date plan
  venue_name      text not null,
  venue_area      text,
  venue_address   text,
  venue_postcode  text,
  venue_tube      text,
  venue_lat       double precision,
  venue_lng       double precision,
  venue_emoji     text,
  date_type       text not null,
  starts_at       timestamptz not null,
  payment         text default 'split' check (payment in ('he-pays', 'split', 'she-pays')),

  -- Content
  message         text not null,
  video_url       text not null,                  -- public URL in proposal-videos bucket
  video_duration_sec int,
  video_poster_url text,

  -- Match metadata (computed by the matchmaking pipeline)
  match_score     int default 0,
  match_reason    text,

  created_at      timestamptz default now(),
  expires_at      timestamptz default (now() + interval '24 hours'),
  decided_at      timestamptz,

  constraint sender_not_recipient check (sender_id <> recipient_id)
);

create index if not exists proposals_recipient_idx on public.proposals(recipient_id, status, created_at desc);
create index if not exists proposals_sender_idx on public.proposals(sender_id, created_at desc);

-- ───────────────────────────────────────────────────────────────────
-- dates — confirmed dates (created when a proposal is accepted)
-- ───────────────────────────────────────────────────────────────────
create table if not exists public.dates (
  id              uuid primary key default gen_random_uuid(),
  proposal_id     uuid unique references public.proposals(id) on delete set null,
  user_a_id       uuid not null references public.profiles(id) on delete cascade,
  user_b_id       uuid not null references public.profiles(id) on delete cascade,

  starts_at       timestamptz not null,
  venue_name      text not null,
  venue_address   text,
  venue_postcode  text,
  venue_lat       double precision,
  venue_lng       double precision,
  payment         text default 'split',

  status          text default 'upcoming'
    check (status in ('upcoming', 'completed', 'cancelled', 'no-show')),
  cancellation_reason text,
  cancelled_by    uuid references public.profiles(id),

  -- Ratings (each user can rate their date independently)
  user_a_rating   int check (user_a_rating between 1 and 5),
  user_b_rating   int check (user_b_rating between 1 and 5),
  rated_at        timestamptz,

  created_at      timestamptz default now()
);

create index if not exists dates_user_a_idx on public.dates(user_a_id, starts_at desc);
create index if not exists dates_user_b_idx on public.dates(user_b_id, starts_at desc);
create index if not exists dates_status_idx on public.dates(status, starts_at);

-- ───────────────────────────────────────────────────────────────────
-- blocks — blocked users
-- ───────────────────────────────────────────────────────────────────
create table if not exists public.blocks (
  id              uuid primary key default gen_random_uuid(),
  blocker_id      uuid not null references public.profiles(id) on delete cascade,
  blocked_id      uuid not null references public.profiles(id) on delete cascade,
  reason          text,
  created_at      timestamptz default now(),

  unique (blocker_id, blocked_id),
  constraint cannot_block_self check (blocker_id <> blocked_id)
);

-- ───────────────────────────────────────────────────────────────────
-- reports — user-reported abuse
-- ───────────────────────────────────────────────────────────────────
create table if not exists public.reports (
  id              uuid primary key default gen_random_uuid(),
  reporter_id     uuid not null references public.profiles(id) on delete cascade,
  reported_id     uuid not null references public.profiles(id) on delete cascade,
  reason          text not null,
  details         text,
  related_proposal_id uuid references public.proposals(id),
  related_date_id uuid references public.dates(id),
  status          text default 'open' check (status in ('open', 'reviewed', 'actioned', 'dismissed')),
  reviewed_at     timestamptz,
  created_at      timestamptz default now()
);

-- ───────────────────────────────────────────────────────────────────
-- verifications — submitted identity verification artifacts
-- ───────────────────────────────────────────────────────────────────
create table if not exists public.verifications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  photo_path      text not null,            -- path in verification-photos bucket
  video_path      text not null,            -- path in verification-videos bucket
  video_duration_sec int,
  status          text default 'pending' check (status in ('pending', 'verified', 'rejected')),
  reviewer_notes  text,
  rejection_reason text,
  reviewed_at     timestamptz,
  reviewed_by     uuid,                     -- admin user id
  estimated_review_minutes int default 60,
  created_at      timestamptz default now()
);

create index if not exists verifications_user_idx on public.verifications(user_id, created_at desc);
create index if not exists verifications_status_idx on public.verifications(status, created_at);

-- ───────────────────────────────────────────────────────────────────
-- support_tickets — in-app help & support messages
-- ───────────────────────────────────────────────────────────────────
create table if not exists public.support_tickets (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  subject         text,
  message         text not null,
  status          text default 'open' check (status in ('open', 'resolved', 'closed')),
  created_at      timestamptz default now()
);

create index if not exists support_tickets_user_idx on public.support_tickets(user_id, created_at desc);

-- ───────────────────────────────────────────────────────────────────
-- events + event_rsvps — curated London events (ops-managed)
-- ───────────────────────────────────────────────────────────────────
create table if not exists public.events (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  date            timestamptz not null,
  venue           text not null,
  area            text,
  address         text,
  postcode        text,
  tube            text,
  type            text default 'Social' check (type in ('Social', 'Activity', 'Culture', 'Dinner', 'Workshop')),
  total_spots     int not null default 20,
  reserved_count  int not null default 0,
  emoji           text default '🎉',
  price           text default 'Free',
  description     text,
  featured        boolean default false,
  lat             double precision,
  lng             double precision,
  created_at      timestamptz default now()
);
create index if not exists events_date_idx on public.events(date);

create table if not exists public.event_rsvps (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.events(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  created_at      timestamptz default now(),
  unique (event_id, user_id)
);
create index if not exists event_rsvps_user_idx on public.event_rsvps(user_id);

-- ───────────────────────────────────────────────────────────────────
-- push_tokens — for sending notifications
-- ───────────────────────────────────────────────────────────────────
create table if not exists public.push_tokens (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  expo_push_token text not null,
  device_id       text,
  created_at      timestamptz default now(),
  last_used_at    timestamptz default now(),
  unique (user_id, expo_push_token)
);

-- ───────────────────────────────────────────────────────────────────
-- Row Level Security
-- ───────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.proposals enable row level security;
alter table public.dates enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.verifications enable row level security;
alter table public.push_tokens enable row level security;
alter table public.support_tickets enable row level security;
alter table public.events enable row level security;
alter table public.event_rsvps enable row level security;

-- profiles: everyone can read public columns; only owner can write
drop policy if exists profiles_select_public on public.profiles;
create policy profiles_select_public on public.profiles
  for select using (true);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert with check (auth.uid() = id);

-- proposals: sender + recipient can read; sender can insert; recipient can update (decide)
drop policy if exists proposals_select on public.proposals;
create policy proposals_select on public.proposals
  for select using (auth.uid() in (sender_id, recipient_id));
drop policy if exists proposals_insert on public.proposals;
create policy proposals_insert on public.proposals
  for insert with check (auth.uid() = sender_id);
drop policy if exists proposals_decide on public.proposals;
create policy proposals_decide on public.proposals
  for update using (auth.uid() = recipient_id);

-- dates: both participants can read; either can update (cancel, rate)
drop policy if exists dates_select on public.dates;
create policy dates_select on public.dates
  for select using (auth.uid() in (user_a_id, user_b_id));
drop policy if exists dates_update on public.dates;
create policy dates_update on public.dates
  for update using (auth.uid() in (user_a_id, user_b_id));

-- blocks: only owner reads/writes
drop policy if exists blocks_owner on public.blocks;
create policy blocks_owner on public.blocks
  for all using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);

-- reports: reporter can insert + see their own
drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports
  for insert with check (auth.uid() = reporter_id);
drop policy if exists reports_select_own on public.reports;
create policy reports_select_own on public.reports
  for select using (auth.uid() = reporter_id);

-- verifications: user can read + insert their own; updates only via service role
drop policy if exists verifications_select_own on public.verifications;
create policy verifications_select_own on public.verifications
  for select using (auth.uid() = user_id);
drop policy if exists verifications_insert_own on public.verifications;
create policy verifications_insert_own on public.verifications
  for insert with check (auth.uid() = user_id);

-- push tokens
drop policy if exists push_tokens_owner on public.push_tokens;
create policy push_tokens_owner on public.push_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- support tickets: user can create + read their own
drop policy if exists support_tickets_insert on public.support_tickets;
create policy support_tickets_insert on public.support_tickets
  for insert with check (auth.uid() = user_id);
drop policy if exists support_tickets_select_own on public.support_tickets;
create policy support_tickets_select_own on public.support_tickets
  for select using (auth.uid() = user_id);

-- events: readable by anyone; managed by ops via service role
drop policy if exists events_select on public.events;
create policy events_select on public.events for select using (true);

-- event RSVPs: owner reads + writes their own
drop policy if exists event_rsvps_owner on public.event_rsvps;
create policy event_rsvps_owner on public.event_rsvps
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ───────────────────────────────────────────────────────────────────
-- Triggers
-- ───────────────────────────────────────────────────────────────────

-- Auto-bump updated_at on profile changes
create or replace function public.touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_touch_updated on public.profiles;
create trigger profiles_touch_updated
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Auto-create a profile row when a new auth.users record is created
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- When a proposal is accepted, automatically create a date row
create or replace function public.handle_proposal_accepted() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'accepted' and old.status = 'pending' then
    insert into public.dates (
      proposal_id, user_a_id, user_b_id, starts_at,
      venue_name, venue_address, venue_postcode, venue_lat, venue_lng, payment
    ) values (
      new.id, new.sender_id, new.recipient_id, new.starts_at,
      new.venue_name, new.venue_address, new.venue_postcode,
      new.venue_lat, new.venue_lng, new.payment
    );
    new.decided_at := now();
  elsif new.status in ('declined', 'cancelled') and old.status = 'pending' then
    new.decided_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists on_proposal_status_change on public.proposals;
create trigger on_proposal_status_change
  before update of status on public.proposals
  for each row execute function public.handle_proposal_accepted();

-- Keep events.reserved_count in sync with RSVPs
create or replace function public.bump_event_reserved() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (TG_OP = 'INSERT') then
    update public.events set reserved_count = reserved_count + 1 where id = new.event_id;
    return new;
  elsif (TG_OP = 'DELETE') then
    update public.events set reserved_count = greatest(reserved_count - 1, 0) where id = old.event_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists on_rsvp_change on public.event_rsvps;
create trigger on_rsvp_change
  after insert or delete on public.event_rsvps
  for each row execute function public.bump_event_reserved();

-- ───────────────────────────────────────────────────────────────────
-- Storage buckets
-- ───────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values
  ('profile-photos',       'profile-photos',       true),
  ('proposal-videos',      'proposal-videos',      true),
  ('verification-photos',  'verification-photos',  false),
  ('verification-videos',  'verification-videos',  false)
on conflict (id) do nothing;

-- Public bucket policies (anyone authenticated can read; owner writes)
drop policy if exists public_photos_read on storage.objects;
create policy public_photos_read on storage.objects
  for select using (bucket_id in ('profile-photos', 'proposal-videos'));

drop policy if exists own_photo_write on storage.objects;
create policy own_photo_write on storage.objects
  for insert with check (
    bucket_id in ('profile-photos', 'proposal-videos', 'verification-photos', 'verification-videos')
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists own_photo_update on storage.objects;
create policy own_photo_update on storage.objects
  for update using (
    bucket_id in ('profile-photos', 'proposal-videos', 'verification-photos', 'verification-videos')
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists own_verification_read on storage.objects;
create policy own_verification_read on storage.objects
  for select using (
    bucket_id in ('verification-photos', 'verification-videos')
    and auth.uid()::text = (storage.foldername(name))[1]
  );
