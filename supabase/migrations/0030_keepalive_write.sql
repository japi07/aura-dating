-- A stronger keep-alive.
--
-- A daily read of now() (0029) ran every day from 13 Nov, yet on 20 Nov
-- Supabase still emailed that the project had "not seen sufficient activity"
-- and would be paused. keepalive() now also writes a row, so each call is real
-- database work, and the workflow runs several times a day.

create table if not exists public.heartbeat (
  id      int primary key default 1 check (id = 1),
  beat_at timestamptz not null default now(),
  beats   bigint not null default 0
);

alter table public.heartbeat enable row level security;
revoke all on public.heartbeat from anon, authenticated;

create or replace function public.keepalive()
returns timestamptz
language sql
volatile
security definer
set search_path = public
as $$
  insert into public.heartbeat (id, beat_at, beats) values (1, now(), 1)
  on conflict (id) do update set beat_at = now(), beats = public.heartbeat.beats + 1
  returning beat_at;
$$;

revoke all on function public.keepalive() from public;
grant execute on function public.keepalive() to anon, authenticated;
