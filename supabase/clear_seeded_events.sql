-- Removes the six invented events from seed_events.sql.
--
-- Those six hung made-up nights off real London venues, with those venues'
-- real addresses and postcodes: a member could have travelled to Hackney Wick
-- for a warehouse party nobody was throwing. That is not placeholder content,
-- it is a listing that misrepresents a real business.
--
-- The Viator rows are deliberately left alone. They are genuinely bookable,
-- any day, through a real partner with our affiliate id on the URL — the only
-- invented thing about them is the suggested date. Whether to show them is a
-- product decision, not a correctness one, so this script does not make it.
-- To clear those too:
--   delete from public.events where booking_partner = 'Viator';
--
-- event_rsvps cascades, so test RSVPs go with them. ticket_purchases keeps its
-- record with a null event_id, which is what we want: a purchase is money that
-- changed hands and should never vanish because a listing did.
--
-- Run in the Supabase SQL Editor. Idempotent.

begin;

-- Reported before, so you can see what you are about to remove.
select id, title, venue, date
  from public.events
 where booking_partner is null
   and title in (
     'Pint of Knowledge',
     'Debate Club: Unpopular Opinions',
     'Warehouse Rave: Sunset Session',
     'Life Drawing & Wine',
     'Sunday Roast Supper Club',
     'Hampstead Heath Morning Walk'
   );

delete from public.events
 where booking_partner is null
   and title in (
     'Pint of Knowledge',
     'Debate Club: Unpopular Opinions',
     'Warehouse Rave: Sunset Session',
     'Life Drawing & Wine',
     'Sunday Roast Supper Club',
     'Hampstead Heath Morning Walk'
   );

commit;

-- What is left.
select coalesce(booking_partner, 'Aura (own)') as source, count(*)
  from public.events
 group by 1
 order by 1;
