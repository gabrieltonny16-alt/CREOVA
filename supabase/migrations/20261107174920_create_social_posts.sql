-- CREOVA social publishing foundation.
-- Additive migration for CREOVA-DEV only. No existing data or tables are dropped.

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  caption text not null default '' check (char_length(caption) <= 2200),
  post_type text not null default 'post' check (post_type in ('post', 'anchor', 'iteration')),
  visibility text not null default 'public' check (visibility in ('public', 'followers')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists posts_author_created_idx
  on public.posts (author_id, created_at desc);
create index if not exists posts_created_idx
  on public.posts (created_at desc);

create table if not exists public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  object_path text not null unique,
  media_type text not null check (media_type in ('image', 'video')),
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  duration_seconds numeric(10,2) check (duration_seconds is null or duration_seconds > 0),
  position smallint not null default 0 check (position >= 0),
  alt_text text not null default '' check (char_length(alt_text) <= 300),
  created_at timestamptz not null default now()
);

create index if not exists post_media_post_position_idx
  on public.post_media (post_id, position);

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists post_likes_user_created_idx
  on public.post_likes (user_id, created_at desc);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_comment_id uuid references public.post_comments(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists post_comments_post_created_idx
  on public.post_comments (post_id, created_at);
create index if not exists post_comments_parent_idx
  on public.post_comments (parent_comment_id);

alter table public.posts enable row level security;
alter table public.post_media enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;

create policy "posts_select_visible"
on public.posts for select to authenticated
using (
  author_id = (select auth.uid())
  or exists (
    select 1
    from public.profiles author
    where author.id = posts.author_id
      and author.is_private = false
      and posts.visibility = 'public'
  )
  or exists (
    select 1
    from public.user_follows relation
    where relation.follower_id = (select auth.uid())
      and relation.following_id = posts.author_id
      and relation.status = 'accepted'
  )
);

create policy "posts_insert_self"
on public.posts for insert to authenticated
with check (author_id = (select auth.uid()));

create policy "posts_update_self"
on public.posts for update to authenticated
using (author_id = (select auth.uid()))
with check (author_id = (select auth.uid()));

create policy "posts_delete_self"
on public.posts for delete to authenticated
using (author_id = (select auth.uid()));

create policy "post_media_select_visible"
on public.post_media for select to authenticated
using (
  exists (
    select 1 from public.posts parent
    where parent.id = post_media.post_id
  )
);

create policy "post_media_insert_post_owner"
on public.post_media for insert to authenticated
with check (
  exists (
    select 1 from public.posts parent
    where parent.id = post_media.post_id
      and parent.author_id = (select auth.uid())
  )
);

create policy "post_media_update_post_owner"
on public.post_media for update to authenticated
using (
  exists (
    select 1 from public.posts parent
    where parent.id = post_media.post_id
      and parent.author_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.posts parent
    where parent.id = post_media.post_id
      and parent.author_id = (select auth.uid())
  )
);

create policy "post_media_delete_post_owner"
on public.post_media for delete to authenticated
using (
  exists (
    select 1 from public.posts parent
    where parent.id = post_media.post_id
      and parent.author_id = (select auth.uid())
  )
);

create policy "post_likes_select_visible"
on public.post_likes for select to authenticated
using (
  exists (
    select 1 from public.posts parent
    where parent.id = post_likes.post_id
  )
);

create policy "post_likes_insert_self"
on public.post_likes for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.posts parent
    where parent.id = post_likes.post_id
  )
);

create policy "post_likes_delete_self"
on public.post_likes for delete to authenticated
using (user_id = (select auth.uid()));

create policy "post_comments_select_visible"
on public.post_comments for select to authenticated
using (
  exists (
    select 1 from public.posts parent
    where parent.id = post_comments.post_id
  )
);

create policy "post_comments_insert_self"
on public.post_comments for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.posts parent
    where parent.id = post_comments.post_id
  )
);

create policy "post_comments_update_self"
on public.post_comments for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "post_comments_delete_self"
on public.post_comments for delete to authenticated
using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.posts to authenticated;
grant select, insert, update, delete on public.post_media to authenticated;
grant select, insert, delete on public.post_likes to authenticated;
grant select, insert, update, delete on public.post_comments to authenticated;
