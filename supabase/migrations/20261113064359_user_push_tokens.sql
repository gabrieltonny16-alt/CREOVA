create table if not exists public.user_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('android', 'ios')),
  device_name text,
  is_active boolean not null default true,
  last_registered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_push_tokens_user_active_idx
  on public.user_push_tokens (user_id, is_active);

alter table public.user_push_tokens enable row level security;

create policy "Users can read their own push tokens"
  on public.user_push_tokens
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can register their own push tokens"
  on public.user_push_tokens
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own push tokens"
  on public.user_push_tokens
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can remove their own push tokens"
  on public.user_push_tokens
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.user_push_tokens to authenticated;
