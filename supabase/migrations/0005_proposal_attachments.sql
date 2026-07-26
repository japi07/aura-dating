-- Proposal attachments: let senders attach a PDF/PPT/image with their date
-- plan (an itinerary deck, a hand-drawn map, a playlist screenshot…).
-- Run this in the Supabase SQL Editor. Idempotent.

alter table public.proposals add column if not exists attachment_url  text;
alter table public.proposals add column if not exists attachment_name text;
alter table public.proposals add column if not exists attachment_type text;

-- Public bucket for the attachments (same model as proposal videos)
insert into storage.buckets (id, name, public)
values ('proposal-attachments', 'proposal-attachments', true)
on conflict (id) do nothing;

-- Anyone signed in can read attachments; owners write to their own folder.
drop policy if exists attachments_read on storage.objects;
create policy attachments_read on storage.objects
  for select using (bucket_id = 'proposal-attachments');

drop policy if exists attachments_write on storage.objects;
create policy attachments_write on storage.objects
  for insert with check (
    bucket_id = 'proposal-attachments'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists attachments_update on storage.objects;
create policy attachments_update on storage.objects
  for update using (
    bucket_id = 'proposal-attachments'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
