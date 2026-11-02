-- CREOVA initial identity and execution schema
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (char_length(username) between 3 and 24),
  display_name text not null check (char_length(display_name) between 1 and 60),
  bio text not null default '' check (char_length(bio) <= 280),
  skills text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.anchors (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 4 and 100),
  description text not null check (char_length(description) between 10 and 2000),
  skill text not null check (char_length(skill) between 2 and 50),
  status text not null default 'active' check (status in ('active','completed','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.iterations (
  id uuid primary key default gen_random_uuid(),
  anchor_id uuid not null references public.anchors(id) on delete cascade,
  parent_iteration_id uuid references public.iterations(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 4 and 100),
  description text not null check (char_length(description) between 10 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists anchors_created_idx on public.anchors(created_at desc);
create index if not exists anchors_creator_idx on public.anchors(creator_id);
create index if not exists iterations_anchor_idx on public.iterations(anchor_id, created_at);

alter table public.profiles enable row level security;
alter table public.anchors enable row level security;
alter table public.iterations enable row level security;

create policy "Profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Users create their own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users update their own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "Active anchors are viewable" on public.anchors for select using (status = 'active' or creator_id = auth.uid());
create policy "Authenticated users create anchors" on public.anchors for insert to authenticated with check (creator_id = auth.uid());
create policy "Creators update their anchors" on public.anchors for update to authenticated using (creator_id = auth.uid()) with check (creator_id = auth.uid());
create policy "Creators delete their anchors" on public.anchors for delete to authenticated using (creator_id = auth.uid());

create policy "Iterations are viewable through active anchors" on public.iterations for select using (
  exists (select 1 from public.anchors a where a.id = anchor_id and (a.status = 'active' or a.creator_id = auth.uid()))
);
create policy "Authenticated users create iterations" on public.iterations for insert to authenticated with check (creator_id = auth.uid());
create policy "Creators update their iterations" on public.iterations for update to authenticated using (creator_id = auth.uid()) with check (creator_id = auth.uid());
create policy "Creators delete their iterations" on public.iterations for delete to authenticated using (creator_id = auth.uid());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  desired_username text;
  desired_name text;
begin
  desired_username := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)), '[^a-z0-9_]', '', 'g'));
  desired_username := left(desired_username, 20);
  if char_length(desired_username) < 3 then desired_username := 'creator_' || left(replace(new.id::text,'-',''),8); end if;
  desired_name := coalesce(nullif(new.raw_user_meta_data->>'display_name',''), desired_username);
  insert into public.profiles(id, username, display_name)
  values(new.id, desired_username, desired_name)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();
