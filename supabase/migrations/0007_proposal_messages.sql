-- Video / file exchange between the two people on a proposal.
--
-- Deliberately NOT a chat table: each message carries a short video or an
-- attachment (with an optional one-line caption), so the exchange stays in
-- the spirit of Aura — show yourself, don't type at each other for weeks.
--
-- Run in the Supabase SQL Editor. Idempotent.

create table if not exists public.proposal_messages (
  id              uuid primary key default gen_random_uuid(),
  proposal_id     uuid not null references public.proposals(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  caption         text,
  video_url       text,
  video_duration_sec int,
  attachment_url  text,
  attachment_name text,
  attachment_type text,
  created_at      timestamptz default now(),
  -- A message must actually carry something
  constraint message_has_content check (video_url is not null or attachment_url is not null)
);

create index if not exists proposal_messages_proposal_idx
  on public.proposal_messages(proposal_id, created_at);

alter table public.proposal_messages enable row level security;

-- Only the two people on the proposal can read the exchange
drop policy if exists proposal_messages_select on public.proposal_messages;
create policy proposal_messages_select on public.proposal_messages
  for select using (
    exists (
      select 1 from public.proposals p
      where p.id = proposal_id and auth.uid() in (p.sender_id, p.recipient_id)
    )
  );

-- …and only as themselves
drop policy if exists proposal_messages_insert on public.proposal_messages;
create policy proposal_messages_insert on public.proposal_messages
  for insert with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.proposals p
      where p.id = proposal_id and auth.uid() in (p.sender_id, p.recipient_id)
    )
  );
