-- The pre-date chat.
--
-- Once a date has a time, the two people can message each other from eight
-- hours before it until three hours after it starts: enough to say hello, swap
-- numbers if they want to, and find each other on the night ("I'm by the
-- window"). Outside that window the chat is read-only, so it stays a tool for
-- the date rather than a messaging app.
--
-- Same safety floor as everything else members write:
--   * only the two people on the date can read or write it, and a block or a
--     ban hides it (the lookup goes through dates, whose restrictive policy
--     already hides blocked and banned counterparts);
--   * banned members can't send (reject_if_banned);
--   * the word list applies (reject_objectionable_text);
--   * members can delete their own messages;
--   * the chat screen has Report, which files against the date.
--
-- The window lives in one function, date_chat_window(), so changing "8 hours"
-- is a one-line migration.

create or replace function public.date_chat_window(p_starts_at timestamptz,
  out opens_at timestamptz, out closes_at timestamptz)
language sql
immutable
set search_path = public
as $$
  select p_starts_at - interval '8 hours', p_starts_at + interval '3 hours';
$$;

create table if not exists public.date_messages (
  id         uuid primary key default gen_random_uuid(),
  date_id    uuid not null references public.dates(id) on delete cascade,
  sender_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists date_messages_date_created_idx
  on public.date_messages (date_id, created_at);

alter table public.date_messages enable row level security;

-- Can the caller write in this date's chat right now?
create or replace function public.date_chat_open(p_date_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.dates d
      cross join lateral public.date_chat_window(d.starts_at) w
     where d.id = p_date_id
       and auth.uid() in (d.user_a_id, d.user_b_id)
       and d.starts_at is not null
       and d.status not in ('cancelled', 'no-show')
       and now() between w.opens_at and w.closes_at
       and not public.hidden_from_me(case when auth.uid() = d.user_a_id then d.user_b_id else d.user_a_id end)
  );
$$;

revoke all on function public.date_chat_open(uuid) from public;
grant execute on function public.date_chat_open(uuid) to authenticated;

-- What the chat screen needs to draw its header: when it opens and closes,
-- and whether it is open now. Null when the caller isn't on this date.
create or replace function public.date_chat_state(p_date_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
           'starts_at', d.starts_at,
           'opens_at',  w.opens_at,
           'closes_at', w.closes_at,
           'open',      public.date_chat_open(d.id),
           'me',        auth.uid())
    from public.dates d
    left join lateral public.date_chat_window(d.starts_at) w on true
   where d.id = p_date_id
     and auth.uid() in (d.user_a_id, d.user_b_id)
     and not public.hidden_from_me(case when auth.uid() = d.user_a_id then d.user_b_id else d.user_a_id end);
$$;

revoke all on function public.date_chat_state(uuid) from public;
grant execute on function public.date_chat_state(uuid) to authenticated;

drop policy if exists date_messages_select on public.date_messages;
create policy date_messages_select on public.date_messages
  for select to authenticated
  using (
    exists (
      select 1 from public.dates d
       where d.id = date_messages.date_id
         and auth.uid() in (d.user_a_id, d.user_b_id)
    )
  );

drop policy if exists date_messages_insert on public.date_messages;
create policy date_messages_insert on public.date_messages
  for insert to authenticated
  with check (sender_id = auth.uid() and public.date_chat_open(date_id));

drop policy if exists date_messages_delete_own on public.date_messages;
create policy date_messages_delete_own on public.date_messages
  for delete to authenticated
  using (sender_id = auth.uid());

revoke all on public.date_messages from anon, authenticated;
grant select, insert, delete on public.date_messages to authenticated;

drop trigger if exists date_messages_reject_if_banned on public.date_messages;
create trigger date_messages_reject_if_banned
  before insert on public.date_messages
  for each row execute function public.reject_if_banned();

drop trigger if exists date_messages_reject_objectionable on public.date_messages;
create trigger date_messages_reject_objectionable
  before insert or update on public.date_messages
  for each row execute function public.reject_objectionable_text('body');
