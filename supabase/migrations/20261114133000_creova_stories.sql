-- CREOVA Stories: private media, 24-hour visibility, and owner-only viewer lists.
create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  object_path text not null unique,
  media_type text not null check (media_type in ('image', 'video')),
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 26214400),
  duration_seconds numeric(6,2),
  caption text not null default '' check (char_length(caption) <= 500),
  visibility text not null default 'public' check (visibility in ('public', 'followers')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  constraint stories_expiry_window check (expires_at > created_at and expires_at <= created_at + interval '24 hours'),
  constraint stories_media_duration check (
    (media_type = 'image' and duration_seconds is null)
    or (media_type = 'video' and duration_seconds > 0 and duration_seconds <= 30)
  )
);

create index if not exists stories_user_expiry_created_idx
  on public.stories (user_id, expires_at desc, created_at desc);
create index if not exists stories_expiry_idx on public.stories (expires_at);

create table if not exists public.story_views (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  constraint story_views_story_viewer_unique unique (story_id, viewer_id)
);
create index if not exists story_views_story_viewed_idx on public.story_views (story_id, viewed_at desc);

alter table public.stories enable row level security;
alter table public.story_views enable row level security;

drop policy if exists "stories_read_visible" on public.stories;
create policy "stories_read_visible" on public.stories
for select to authenticated
using (
  user_id = (select auth.uid())
  or (
    expires_at > now()
    and exists (
      select 1 from public.profiles p
      where p.id = stories.user_id
        and (
          (p.is_private = false and stories.visibility = 'public')
          or exists (
            select 1 from public.user_follows f
            where f.follower_id = (select auth.uid())
              and f.following_id = stories.user_id
              and f.status = 'accepted'
          )
        )
    )
  )
);

drop policy if exists "stories_insert_own" on public.stories;
create policy "stories_insert_own" on public.stories
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and expires_at > now()
  and expires_at <= now() + interval '24 hours'
);

drop policy if exists "stories_delete_own" on public.stories;
create policy "stories_delete_own" on public.stories
for delete to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "story_views_read_owner_or_viewer" on public.story_views;
create policy "story_views_read_owner_or_viewer" on public.story_views
for select to authenticated
using (
  viewer_id = (select auth.uid())
  or exists (
    select 1 from public.stories s
    where s.id = story_views.story_id and s.user_id = (select auth.uid())
  )
);

drop policy if exists "story_views_insert_visible_story" on public.story_views;
create policy "story_views_insert_visible_story" on public.story_views
for insert to authenticated
with check (
  viewer_id = (select auth.uid())
  and exists (
    select 1 from public.stories s
    where s.id = story_views.story_id
      and s.user_id <> (select auth.uid())
      and s.expires_at > now()
      and exists (
        select 1 from public.profiles p
        where p.id = s.user_id
          and (
            (p.is_private = false and s.visibility = 'public')
            or exists (
              select 1 from public.user_follows f
              where f.follower_id = (select auth.uid())
                and f.following_id = s.user_id
                and f.status = 'accepted'
            )
          )
      )
  )
);

grant select, insert, delete on public.stories to authenticated;
grant select, insert on public.story_views to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'creova-stories',
  'creova-stories',
  false,
  26214400,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "creova_story_media_insert_own" on storage.objects;
create policy "creova_story_media_insert_own" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'creova-stories'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "creova_story_media_read_visible" on storage.objects;
create policy "creova_story_media_read_visible" on storage.objects
for select to authenticated
using (
  bucket_id = 'creova-stories'
  and exists (
    select 1 from public.stories s
    where s.object_path = storage.objects.name
      and (
        s.user_id = (select auth.uid())
        or (
          s.expires_at > now()
          and exists (
            select 1 from public.profiles p
            where p.id = s.user_id
              and (
                (p.is_private = false and s.visibility = 'public')
                or exists (
                  select 1 from public.user_follows f
                  where f.follower_id = (select auth.uid())
                    and f.following_id = s.user_id
                    and f.status = 'accepted'
                )
              )
          )
        )
      )
  )
);

drop policy if exists "creova_story_media_delete_own" on storage.objects;
create policy "creova_story_media_delete_own" on storage.objects
for delete to authenticated
using (
  bucket_id = 'creova-stories'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
