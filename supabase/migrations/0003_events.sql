-- Curated London events + RSVPs for the Events tab.
-- Run this in the Supabase SQL Editor (or via `supabase db push`).
-- Idempotent: safe to re-run.
--
-- The ops team adds events directly in the dashboard (service role / Table
-- Editor). Members can only read events and manage their own RSVPs.

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

-- ─── RLS ───
alter table public.events enable row level security;
alter table public.event_rsvps enable row level security;

-- Anyone (signed in) can read events
drop policy if exists events_select on public.events;
create policy events_select on public.events for select using (true);

-- RSVPs: owner reads + writes their own
drop policy if exists event_rsvps_owner on public.event_rsvps;
create policy event_rsvps_owner on public.event_rsvps
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Keep events.reserved_count in sync ───
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
