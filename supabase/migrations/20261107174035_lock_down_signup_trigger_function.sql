-- Revoke direct execution of the auth signup trigger function.
-- This migration is already applied to CREOVA-DEV; the file restores the
-- migration history to source control so future deploys do not replay it.
revoke execute on function public.handle_new_creova_user() from public, anon, authenticated;
