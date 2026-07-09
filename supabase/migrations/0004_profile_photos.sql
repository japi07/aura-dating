-- Multiple profile photos.
-- Run this in the Supabase SQL Editor. Idempotent.
--
-- `photos` holds the full gallery (public URLs); `photo_url` stays as the
-- primary photo (photos[1]) for backward compatibility with existing queries.

alter table public.profiles add column if not exists photos text[] default '{}';
