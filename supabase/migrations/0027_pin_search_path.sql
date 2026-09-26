-- Supabase's security advisor flagged these as having a role-mutable
-- search_path (lint 0011). None of them is exploitable as written -- they
-- qualify what they call -- but pinning costs nothing and keeps the advisor
-- clean, so a real warning isn't lost among false ones.
alter function public.profiles_guard_privileged()   set search_path = public;
alter function public.objectionable_text(text)      set search_path = public;
alter function public.reject_objectionable_text()   set search_path = public;
alter function public.touch_updated_at()            set search_path = public;
