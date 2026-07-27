-- Sample London events so the Events tab has real content to browse.
-- Run in the Supabase SQL Editor. Re-running adds duplicates, so run once
-- (or delete first with: delete from public.events;).
--
-- These are group experiences members can reserve a spot at — a low-pressure
-- way to meet in person alongside one-to-one date proposals.

insert into public.events
  (title, date, venue, area, address, postcode, tube, type, total_spots, emoji, price, description, featured, lat, lng)
values
  ('Pint of Knowledge', now() + interval '5 days',
   'The Book Club', 'Shoreditch', '100–106 Leonard St', 'EC2A 4RH', 'Old Street',
   'Social', 30, '🍺', '£8',
   'Three short talks, three pints, zero pretension. Scientists and storytellers explain something fascinating in ten minutes flat.',
   true, 51.5256, -0.0817),

  ('Debate Club: Unpopular Opinions', now() + interval '9 days',
   'The Yard Theatre', 'Hackney Wick', 'Unit 2a Queens Yard', 'E9 5EN', 'Hackney Wick',
   'Culture', 24, '🎤', '£10',
   'Friendly, fast-paced debates on gloriously trivial questions. No experience needed — just opinions and a sense of humour.',
   false, 51.5449, -0.0247),

  ('Warehouse Rave: Sunset Session', now() + interval '12 days',
   'Colour Factory', 'Hackney Wick', '5 Queens Yard', 'E9 5EN', 'Hackney Wick',
   'Social', 60, '🎧', '£15',
   'House and disco until late, with an Aura table so you always have people to dance with.',
   false, 51.5442, -0.0233),

  ('Life Drawing & Wine', now() + interval '7 days',
   'Drink Shop Do', 'Kings Cross', '9 Caledonian Rd', 'N1 9DX', 'Kings Cross',
   'Workshop', 20, '🎨', '£22',
   'No talent required. A relaxed two hours of sketching, a glass in hand, and easy conversation.',
   false, 51.5307, -0.1215),

  ('Sunday Roast Supper Club', now() + interval '14 days',
   'The Camberwell Arms', 'Camberwell', '65 Camberwell Church St', 'SE5 8TR', 'Denmark Hill',
   'Dinner', 16, '🍖', '£35',
   'One long table, one very good roast, and sixteen members who did not know each other at 1pm.',
   false, 51.4740, -0.0930),

  ('Hampstead Heath Morning Walk', now() + interval '4 days',
   'Hampstead Heath', 'Hampstead', 'Parliament Hill entrance', 'NW5 1QR', 'Gospel Oak',
   'Activity', 25, '🌳', 'Free',
   'A proper walk with proper views, ending with coffee. The easiest possible way to meet people.',
   false, 51.5608, -0.1600);
