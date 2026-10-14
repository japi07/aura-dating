-- Deleting an account must never be blocked by a leftover reference.
--
-- An account is deleted through auth.admin.deleteUser (the delete-account edge
-- function), which cascades from auth.users -> profiles -> everything the
-- member owns. Three things could stop or corrupt that cascade:
--
--   1. dates.cancelled_by, reports.related_date_id and reports.related_proposal_id
--      were plain foreign keys (NO ACTION). A report filed by someone who stays,
--      pointing at a date or invitation of the member who leaves, made the
--      whole deletion fail. The report itself is worth keeping, so the link is
--      cleared instead.
--
--   2. handle_call_mutual_interest() ran on every update of a call and created
--      a date whenever both people had said yes and resulting_date_id was null.
--      When the member's dates are deleted, the cascade sets
--      calls.resulting_date_id to null -- which made the trigger create a fresh
--      date for the very member being deleted. It now fires only when one of
--      the two "wants to meet" answers actually changes.
--
--   3. Nothing else: every other reference cascades or is set null.

alter table public.dates
  drop constraint if exists dates_cancelled_by_fkey,
  add constraint dates_cancelled_by_fkey
    foreign key (cancelled_by) references public.profiles(id) on delete set null;

alter table public.reports
  drop constraint if exists reports_related_date_id_fkey,
  add constraint reports_related_date_id_fkey
    foreign key (related_date_id) references public.dates(id) on delete set null;

alter table public.reports
  drop constraint if exists reports_related_proposal_id_fkey,
  add constraint reports_related_proposal_id_fkey
    foreign key (related_proposal_id) references public.proposals(id) on delete set null;

create or replace function public.handle_call_mutual_interest()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_date_id uuid;
begin
  if new.a_wants_to_meet is true
     and new.b_wants_to_meet is true
     and new.resulting_date_id is null
     and (old.a_wants_to_meet is distinct from new.a_wants_to_meet
          or old.b_wants_to_meet is distinct from new.b_wants_to_meet) then
    insert into public.dates (user_a_id, user_b_id, mode, status, payment)
    values (new.user_a_id, new.user_b_id, 'call', 'planning', 'split')
    returning id into new_date_id;
    new.resulting_date_id := new_date_id;
  end if;
  return new;
end;
$$;
