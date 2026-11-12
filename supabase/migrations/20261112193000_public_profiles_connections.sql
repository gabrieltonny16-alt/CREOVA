-- CREOVA public profile views and connection lists.
-- Commit to the isolated development branch; apply only to CREOVA-DEV after explicit approval.
-- Never apply this migration to the legacy/production project.

create or replace function public.get_creova_profile_overview(target_username text)
returns table (
  id uuid,
  username text,
  display_name text,
  bio text,
  avatar_url text,
  is_private boolean,
  followers bigint,
  following bigint,
  follow_state text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  target_id uuid;
begin
  if viewer_id is null then
    raise exception 'You must be signed in.';
  end if;

  select p.id into target_id
  from public.profiles p
  where p.username = lower(trim(target_username));

  if target_id is null then
    raise exception 'CREOVA profile not found.';
  end if;

  return query
  select
    p.id,
    p.username,
    p.display_name,
    p.bio,
    p.avatar_url,
    p.is_private,
    (select count(*) from public.user_follows f where f.following_id = p.id and f.status = 'accepted'),
    (select count(*) from public.user_follows f where f.follower_id = p.id and f.status = 'accepted'),
    coalesce((
      select f.status
      from public.user_follows f
      where f.follower_id = viewer_id and f.following_id = p.id
    ), 'not_following')
  from public.profiles p
  where p.id = target_id;
end;
$$;

create or replace function public.get_creova_profile_connections(
  target_profile_id uuid,
  connection_type text
)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  is_private boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  target_private boolean;
  viewer_is_approved boolean;
begin
  if viewer_id is null then
    raise exception 'You must be signed in.';
  end if;
  if connection_type not in ('followers', 'following') then
    raise exception 'Connection type must be followers or following.';
  end if;

  select p.is_private into target_private
  from public.profiles p
  where p.id = target_profile_id;

  if target_private is null then
    raise exception 'CREOVA profile not found.';
  end if;

  select exists (
    select 1 from public.user_follows f
    where f.follower_id = viewer_id
      and f.following_id = target_profile_id
      and f.status = 'accepted'
  ) into viewer_is_approved;

  if target_private and viewer_id <> target_profile_id and not viewer_is_approved then
    raise exception 'Follow this private account to view its connections.';
  end if;

  if connection_type = 'followers' then
    return query
    select p.id, p.username, p.display_name, p.avatar_url, p.is_private
    from public.user_follows f
    join public.profiles p on p.id = f.follower_id
    where f.following_id = target_profile_id and f.status = 'accepted'
    order by p.username;
  else
    return query
    select p.id, p.username, p.display_name, p.avatar_url, p.is_private
    from public.user_follows f
    join public.profiles p on p.id = f.following_id
    where f.follower_id = target_profile_id and f.status = 'accepted'
    order by p.username;
  end if;
end;
$$;

revoke all on function public.get_creova_profile_overview(text) from public;
revoke all on function public.get_creova_profile_connections(uuid, text) from public;
grant execute on function public.get_creova_profile_overview(text) to authenticated;
grant execute on function public.get_creova_profile_connections(uuid, text) to authenticated;
