-- CREOVA core identity and execution schema
-- Public profile fields are intentionally discoverable; private account data stays in auth.users.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (char_length(username) between 3 and 24),
  display_name text not null check (char_length(display_name) between 1 and 60),
  bio text not null default '' check (char_length(bio) <= 280),
  skills text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.anchors (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 4 and 100),
  description text not null check (char_length(description) between 10 and 2000),
  skill text not null check (char_length(skill) between 2 and 50),
  status text not null default 'active' check (status in ('active','completed','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.iterations (
  id uuid primary key default gen_random_uuid(),
  anchor_id uuid not null references public.anchors(id) on delete cascade,
  parent_iteration_id uuid references public.iterations(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 4 and 100),
  description text not null check (char_length(description) between 10 and 2000),
  created_at timestamptz not null default now()
);

create index anchors_created_idx on public.anchors(created_at desc);
create index anchors_creator_idx on public.anchors(creator_id);
create index iterations_anchor_idx on public.iterations(anchor_id, created_at);
create index iterations_creator_idx on public.iterations(creator_id);

alter table public.profiles enable row level security;
alter table public.anchors enable row level security;
alter table public.iterations enable row level security;

create policy "Public profiles are viewable" on public.profiles
  for select to anon, authenticated using (true);
create policy "Users create their own profile" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "Users update their own profile" on public.profiles
  for update to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Active anchors are viewable" on public.anchors
  for select to anon, authenticated
  using (status = 'active' or creator_id = (select auth.uid()));
create policy "Authenticated users create anchors" on public.anchors
  for insert to authenticated with check (creator_id = (select auth.uid()));
create policy "Creators update their anchors" on public.anchors
  for update to authenticated using (creator_id = (select auth.uid()))
  with check (creator_id = (select auth.uid()));
create policy "Creators delete their anchors" on public.anchors
  for delete to authenticated using (creator_id = (select auth.uid()));

create policy "Iterations are viewable through visible anchors" on public.iterations
  for select to anon, authenticated
  using (exists (
    select 1 from public.anchors a
    where a.id = iterations.anchor_id
      and (a.status = 'active' or a.creator_id = (select auth.uid()))
  ));
create policy "Users create valid iterations" on public.iterations
  for insert to authenticated
  with check (
    creator_id = (select auth.uid())
    and exists (
      select 1 from public.anchors a
      where a.id = iterations.anchor_id and a.status = 'active'
    )
  );
create policy "Creators update their iterations" on public.iterations
  for update to authenticated
  using (creator_id = (select auth.uid()))
  with check (creator_id = (select auth.uid()));
create policy "Creators delete their iterations" on public.iterations
  for delete to authenticated using (creator_id = (select auth.uid()));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  desired_username text;
  desired_name text;
  fallback_username text;
begin
  desired_username := lower(regexp_replace(
    coalesce(new.raw_user_meta_data->>'username', split_part(coalesce(new.email, ''), '@', 1)),
    '[^a-z0-9_]', '', 'g'
  ));
  desired_username := left(desired_username, 20);
  if char_length(desired_username) < 3 then
    desired_username := 'creator_' || left(replace(new.id::text, '-', ''), 8);
  end if;

  desired_name := left(coalesce(
    nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
    desired_username
  ), 60);

  insert into public.profiles(id, username, display_name)
  values(new.id, desired_username, desired_name)
  on conflict (username) do nothing;

  if not found then
    fallback_username := left(desired_username, 15) || '_' || left(replace(new.id::text, '-', ''), 8);
    insert into public.profiles(id, username, display_name)
    values(new.id, fallback_username, desired_name)
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

grant select on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;
grant select on public.anchors, public.iterations to anon, authenticated;
grant insert, update, delete on public.anchors, public.iterations to authenticated;
