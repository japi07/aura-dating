-- Curated Viator experiences that actually work as dates (no bus tours,
-- no Stonehenge, no Harry Potter). Pulled from the Viator Partner API and
-- filtered by hand; every URL carries Aura's affiliate pid so bookings are
-- attributed and earn commission.
--
-- Run in the Supabase SQL Editor AFTER migration 0009 (booking_url columns).
-- Re-running adds duplicates — run once, or clear first with:
--   delete from public.events where booking_partner = 'Viator';
--
-- NOTE: dates are placeholders spread over the next few weeks. These are
-- bookable-any-day experiences, so the date is really just "when we're
-- suggesting it" — adjust freely.

insert into public.events
  (title, date, venue, area, address, postcode, tube, type, total_spots,
   emoji, price, description, featured, lat, lng, booking_url, booking_partner)
values
  ('Italian Cocktail Making Class', now() + interval '6 days',
   'Central London', 'Soho', 'Central London', 'W1D', 'Piccadilly Circus',
   'Workshop', 20, '🍸', '£55',
   'Shake Italy''s best-loved cocktails together, then drink them. Hands-on, lively, and impossible to be awkward at.',
   true, 51.5136, -0.1365,
   'https://www.viator.com/en-GB/tours/London/Italian-Cocktail-Making-Class-in-Central-London/d737-177953P9?pid=P00290761&medium=link&campaign=aura-app',
   'Viator'),

  ('Pasta Making & Unlimited Prosecco', now() + interval '8 days',
   'Pasta Academy', 'Central London', 'Central London', 'WC2', 'Covent Garden',
   'Workshop', 16, '🍝', '£68',
   'Roll fresh pasta side by side with bottomless prosecco. Messy, funny, and you eat what you make.',
   false, 51.5117, -0.1240,
   'https://www.viator.com/en-GB/tours/London/Pasta-Academy/d737-368493P1?pid=P00290761&medium=link&campaign=aura-app',
   'Viator'),

  ('Gin Tasting & Masterclass', now() + interval '5 days',
   'Central London', 'Central London', 'Central London', 'EC1', 'Farringdon',
   'Social', 24, '🍸', '£26',
   'Four award-winning gins, a welcome G&T and the story behind each one. Low commitment, easy conversation.',
   false, 51.5200, -0.1050,
   'https://www.viator.com/en-GB/tours/London/London-Gin-tasting-and-masterclass/d737-5561608P1?pid=P00290761&medium=link&campaign=aura-app',
   'Viator'),

  ('Make Your Own Chocolate', now() + interval '11 days',
   'Notting Hill', 'Notting Hill', 'Notting Hill', 'W11', 'Notting Hill Gate',
   'Workshop', 14, '🍫', '£54',
   'Temper, mould and decorate your own chocolates in Notting Hill, then wander the neighbourhood afterwards.',
   false, 51.5090, -0.1960,
   'https://www.viator.com/en-GB/tours/London/Make-your-own-amazing-chocolate-in-Notting-Hill/d737-131802P2?pid=P00290761&medium=link&campaign=aura-app',
   'Viator'),

  ('Indian Cooking Masterclass', now() + interval '13 days',
   'Central London', 'Central London', 'Central London', 'W1', 'Oxford Circus',
   'Workshop', 12, '🥘', '£89',
   'Cook a full Indian meal with award-winning author Monisha Bharadwaj, then sit down and eat it together.',
   false, 51.5150, -0.1420,
   'https://www.viator.com/en-GB/tours/London/Indian-Cooking-Masterclass-London/d737-5525742P1?pid=P00290761&medium=link&campaign=aura-app',
   'Viator'),

  ('Twinings Tea Tasting Masterclass', now() + interval '7 days',
   'Twinings, 216 Strand', 'Strand', '216 Strand', 'WC2R 1AP', 'Temple',
   'Culture', 18, '🫖', '£50',
   'Two hours of proper tea tasting at Twinings'' flagship store. Genuinely charming, and daytime — no pressure.',
   false, 51.5133, -0.1130,
   'https://www.viator.com/en-GB/tours/London/Tea-Tasting-Masterclass/d737-315903P1?pid=P00290761&medium=link&campaign=aura-app',
   'Viator'),

  ('Royal Historic Pubs Walking Tour', now() + interval '9 days',
   'Central London', 'Westminster', 'Central London', 'SW1', 'Westminster',
   'Social', 20, '🍺', '£32',
   'Four hidden royal pubs, centuries of stories, and a pint in each. Walking and talking — the easiest first date there is.',
   false, 51.5010, -0.1250,
   'https://www.viator.com/en-GB/tours/London/Royal-Historic-Pubs-Tour/d737-285621P3?pid=P00290761&medium=link&campaign=aura-app',
   'Viator'),

  ('Scone Making & Tea Workshop', now() + interval '15 days',
   'Central London', 'Central London', 'Central London', 'EC2', 'Liverpool Street',
   'Workshop', 16, '🧁', '£30',
   'Bake proper British scones, then eat them warm with clotted cream and tea. Cheap, cheerful and very lovely.',
   false, 51.5180, -0.0810,
   'https://www.viator.com/en-GB/tours/London/London-Traditional-English-Scone-Making-and-Tea-Workshop/d737-426591P3?pid=P00290761&medium=link&campaign=aura-app',
   'Viator');
