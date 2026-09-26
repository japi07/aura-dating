-- Reporting from anywhere, and removing what you posted.
--
-- App Review rejected build 8 a second time under 1.2. The reviewer signed in
-- with a demo account that had no content, so every Report and Block control
-- -- all of which sit on another member's content -- was out of reach. And a
-- member whose call ended had no way to report the caller afterwards at all.
--
-- 1. my_recent_contacts(): everyone you have actually dealt with recently --
--    calls, dates, proposals either way -- so Profile > Safety > Report
--    someone can list them and report any one of them. A call still returns
--    only the other person's first name and the call id, never their id: the
--    anonymity of a call survives being reported.
-- 2. Members can delete their own thread messages, and withdraw a proposal
--    they sent that hasn't been answered. Both disappear for the other person
--    at once.
--
-- Run in the Supabase SQL Editor. Idempotent.

/* ─── 1. Who you could report ────────────────────────────────────────── */

create or replace function public.my_recent_contacts()
returns jsonb
language sql
stable
security definer
set search_path = public
as $fn$
  with me as (select auth.uid() as id),
  calls as (
    select 'call' as kind, c.id, coalesce(c.started_at, c.created_at) as at,
           split_part(coalesce(p.name, 'Someone'), ' ', 1) as name,
           'Voice call' as detail,
           case when c.user_a_id = me.id then c.user_b_id else c.user_a_id end as other
      from public.calls c
      cross join me
      left join public.profiles p
        on p.id = case when c.user_a_id = me.id then c.user_b_id else c.user_a_id end
     where me.id in (c.user_a_id, c.user_b_id)
       and c.started_at is not null
       and coalesce(c.started_at, c.created_at) > now() - interval '30 days'
  ),
  dts as (
    select 'date' as kind, d.id, coalesce(d.starts_at, d.created_at) as at,
           case when d.mode = 'blind' then 'Your blind date'
                else split_part(coalesce(p.name, 'Your date'), ' ', 1) end as name,
           case when d.mode = 'blind' then 'Blind date'
                when d.mode = 'call'  then 'Date after a call'
                else 'Date' end as detail,
           case when d.user_a_id = me.id then d.user_b_id else d.user_a_id end as other
      from public.dates d
      cross join me
      left join public.profiles p
        on p.id = case when d.user_a_id = me.id then d.user_b_id else d.user_a_id end
     where me.id in (d.user_a_id, d.user_b_id)
       and coalesce(d.starts_at, d.created_at) > now() - interval '60 days'
  ),
  props as (
    select 'proposal' as kind, x.id, x.created_at as at,
           split_part(coalesce(p.name, 'Someone'), ' ', 1) as name,
           case when x.sender_id = me.id then 'Invitation you sent'
                else 'Invitation you received' end as detail,
           case when x.sender_id = me.id then x.recipient_id else x.sender_id end as other
      from public.proposals x
      cross join me
      left join public.profiles p
        on p.id = case when x.sender_id = me.id then x.recipient_id else x.sender_id end
     where me.id in (x.sender_id, x.recipient_id)
       and x.created_at > now() - interval '60 days'
       -- An accepted proposal is already listed as its date.
       and not exists (select 1 from public.dates d where d.proposal_id = x.id)
  ),
  everything as (
    select * from calls union all select * from dts union all select * from props
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'kind',   e.kind,
           'id',     e.id,
           'name',   e.name,
           'detail', e.detail,
           'at',     e.at
         ) order by e.at desc), '[]'::jsonb)
    from everything e
   where e.other is not null
     and not public.hidden_from_me(e.other);
$fn$;

revoke all on function public.my_recent_contacts() from public, anon;
grant execute on function public.my_recent_contacts() to authenticated;

/* ─── 2. Removing what you posted ────────────────────────────────────── */

drop policy if exists proposal_messages_delete_own on public.proposal_messages;
create policy proposal_messages_delete_own on public.proposal_messages
  for delete using (auth.uid() = sender_id);
grant delete on public.proposal_messages to authenticated;

create or replace function public.withdraw_proposal(p_proposal uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  update public.proposals
     set status = 'cancelled', decided_at = now()
   where id = p_proposal
     and sender_id = auth.uid()
     and status = 'pending';
  if not found then
    raise exception 'Only an unanswered invitation you sent can be withdrawn.';
  end if;
end;
$fn$;

revoke all on function public.withdraw_proposal(uuid) from public, anon;
grant execute on function public.withdraw_proposal(uuid) to authenticated;
