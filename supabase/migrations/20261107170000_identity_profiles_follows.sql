-- CREOVA v1 identity and follow graph.
-- Apply only to the new development Supabase project after it is provisioned.
-- Never apply this migration to the legacy CREOVA production project.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null check (char_length(display_name) between 1 and 60),
  bio text not null default '' check (char_length(bio) <= 160),
  avatar_url text,
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint user_follows_no_self_follow check (follower_id <> following_id)
);

create index if not exists user_follows_following_status_idx
  on public.user_follows (following_id, status);
create index if not exists user_follows_follower_status_idx
  on public.user_follows (follower_id, status);
create index if not exists profiles_username_search_idx
  on public.profiles (username text_pattern_ops);

alter table public.profiles enable row level security;
alter table public.user_follows enable row level security;

create policy "profiles_select_visible"
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or not is_private
  or exists (
    select 1 from public.user_follows f
    where f.follower_id = (select auth.uid())
      and f.following_id = profiles.id
      and f.status = 'accepted'
  )
);

create policy "profiles_insert_self"
on public.profiles for insert to authenticated
with check (id = (select auth.uid()));

create policy "profiles_update_self"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "follows_select_participant"
on public.user_follows for select to authenticated
using (follower_id = (select auth.uid()) or following_id = (select auth.uid()));

create policy "follows_insert_self"
on public.user_follows for insert to authenticated
with check (
  follower_id = (select auth.uid())
  and exists (
    select 1 from public.profiles target
    where target.id = following_id
      and (
        (target.is_private = true and status = 'pending')
        or (target.is_private = false and status = 'accepted')
      )
  )
);

create policy "follows_update_recipient"
on public.user_follows for update to authenticated
using (following_id = (select auth.uid()) and status = 'pending')
with check (following_id = (select auth.uid()) and status in ('accepted', 'rejected'));

create policy "follows_delete_follower_or_recipient"
on public.user_follows for delete to authenticated
using (follower_id = (select auth.uid()) or following_id = (select auth.uid()));

create or replace function public.handle_new_creova_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text;
  requested_display_name text;
begin
  requested_username := lower(coalesce(new.raw_user_meta_data ->> 'username', ''));
  requested_display_name := coalesce(new.raw_user_meta_data ->> 'display_name', requested_username);
  if requested_username !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'A valid CREOVA username is required';
  end if;
  insert into public.profiles (id, username, display_name)
  values (new.id, requested_username, requested_display_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_creova on auth.users;
create trigger on_auth_user_created_creova
  after insert on auth.users
  for each row execute procedure public.handle_new_creova_user();

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.user_follows to authenticated;
