create table if not exists public.post_reposts (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint post_reposts_pkey primary key (post_id, user_id)
);

create index if not exists post_reposts_user_created_idx
  on public.post_reposts (user_id, created_at desc);
create index if not exists post_reposts_post_created_idx
  on public.post_reposts (post_id, created_at desc);

alter table public.post_reposts enable row level security;
revoke all on public.post_reposts from anon, authenticated;
grant select, insert, delete on public.post_reposts to authenticated;

drop policy if exists post_reposts_select_visible on public.post_reposts;
create policy post_reposts_select_visible
on public.post_reposts for select to authenticated
using (
  exists (select 1 from public.posts p where p.id = post_reposts.post_id)
  and (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.user_follows f
      where f.follower_id = (select auth.uid())
        and f.following_id = post_reposts.user_id
        and f.status = 'accepted'
    )
    or exists (
      select 1 from public.profiles reposter
      where reposter.id = post_reposts.user_id
        and reposter.is_private = false
    )
  )
);

drop policy if exists post_reposts_insert_self_visible on public.post_reposts;
create policy post_reposts_insert_self_visible
on public.post_reposts for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.posts p where p.id = post_reposts.post_id)
);

drop policy if exists post_reposts_delete_self on public.post_reposts;
create policy post_reposts_delete_self
on public.post_reposts for delete to authenticated
using (user_id = (select auth.uid()));

create table if not exists public.post_saves (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint post_saves_pkey primary key (post_id, user_id)
);

create index if not exists post_saves_user_created_idx
  on public.post_saves (user_id, created_at desc);

alter table public.post_saves enable row level security;
revoke all on public.post_saves from anon, authenticated;
grant select, insert, delete on public.post_saves to authenticated;

drop policy if exists post_saves_select_own_visible on public.post_saves;
create policy post_saves_select_own_visible
on public.post_saves for select to authenticated
using (
  user_id = (select auth.uid())
  and exists (select 1 from public.posts p where p.id = post_saves.post_id)
);

drop policy if exists post_saves_insert_own_visible on public.post_saves;
create policy post_saves_insert_own_visible
on public.post_saves for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.posts p where p.id = post_saves.post_id)
);

drop policy if exists post_saves_delete_own on public.post_saves;
create policy post_saves_delete_own
on public.post_saves for delete to authenticated
using (user_id = (select auth.uid()));

comment on table public.post_reposts is
  'A user can repost each visible post once; original authorship remains on posts.';
comment on table public.post_saves is
  'Private per-user post bookmarks; only the saving user can read them.';