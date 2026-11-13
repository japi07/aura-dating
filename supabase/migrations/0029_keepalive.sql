-- Keep the project awake.
--
-- On Supabase's free plan a project with no database activity for a week is
-- paused, and a paused project answers nothing: in November 2026 App Review
-- tried to sign in with the demo account while it was paused, got an error,
-- and rejected the build under 2.1(a). .github/workflows/keepalive.yml calls
-- this once a day so there is always recent activity.
--
-- Returns nothing about anyone: just the server time.

create or replace function public.keepalive()
returns timestamptz
language sql
stable
set search_path = public
as $$
  select now();
$$;

revoke all on function public.keepalive() from public;
grant execute on function public.keepalive() to anon, authenticated;
