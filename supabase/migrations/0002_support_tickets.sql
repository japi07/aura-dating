-- Support tickets for the in-app Help & Support contact form.
-- Run this in the Supabase SQL Editor (or via `supabase db push`).
-- Idempotent: safe to re-run.

create table if not exists public.support_tickets (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  subject         text,
  message         text not null,
  status          text default 'open' check (status in ('open', 'resolved', 'closed')),
  created_at      timestamptz default now()
);

create index if not exists support_tickets_user_idx on public.support_tickets(user_id, created_at desc);

alter table public.support_tickets enable row level security;

drop policy if exists support_tickets_insert on public.support_tickets;
create policy support_tickets_insert on public.support_tickets
  for insert with check (auth.uid() = user_id);

drop policy if exists support_tickets_select_own on public.support_tickets;
create policy support_tickets_select_own on public.support_tickets
  for select using (auth.uid() = user_id);
