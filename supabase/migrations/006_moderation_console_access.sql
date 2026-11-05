-- Small authenticated read-only check for the moderation console.
-- The actual staff permission check remains in private.is_moderator().

create or replace function public.current_user_is_moderator()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_moderator();
$$;

revoke all on function public.current_user_is_moderator() from public, anon, authenticated;
grant execute on function public.current_user_is_moderator() to authenticated;

comment on function public.current_user_is_moderator() is
  'Returns only whether the current authenticated user has a moderator role.';
