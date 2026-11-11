-- CREOVA Stories foundation: private media, 24-hour stories, views, reactions and replies.
-- Applied only to the CREOVA-DEV project.

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  media_path text not null unique,
  media_type text not null check (media_type in ('image', 'video')),
  caption text not null default '' check (char_length(caption) <= 500),
  visibility text not null default 'followers' check (visibility in ('public', 'followers')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  constraint stories_expiry_window check (
    expires_at > created_at and expires_at <= created_at + interval '24 hours'
  ),
  constraint stories_media_path_owner check (
    media_path like user_id::text || '/' || id::text || '/%'
  )
);

create index stories_active_user_idx on public.stories (user_id, created_at desc)
  where expires_at > now();
create index stories_active_expiry_idx on public.stories (expires_at);

create table public.story_views (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  unique (story_id, viewer_id)
);
create index story_views_story_time_idx on public.story_views (story_id, viewed_at desc);

create table public.story_reactions (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null check (reaction in ('❤️', '😂', '😮', '😢', '🔥', '👏')),
  created_at timestamptz not null default now(),
  unique (story_id, user_id)
);
create index story_reactions_story_idx on public.story_reactions (story_id, created_at desc);

create table public.story_replies (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index story_replies_story_idx on public.story_replies (story_id, created_at desc);

alter table public.stories enable row level security;
alter table public.story_views enable row level security;
alter table public.story_reactions enable row level security;
alter table public.story_replies enable row level security;

create policy stories_select_visible on public.stories
for select to authenticated
using (
  expires_at > now()
  and (
    user_id = (select auth.uid())
    or (
      visibility = 'public'
      and exists (
        select 1 from public.profiles author
        where author.id = stories.user_id and author.is_private = false
      )
    )
    or exists (
      select 1 from public.user_follows relation
      where relation.follower_id = (select auth.uid())
        and relation.following_id = stories.user_id
        and relation.status = 'accepted'
    )
  )
);

create policy stories_insert_self on public.stories
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and expires_at > created_at
  and expires_at <= created_at + interval '24 hours'
);

create policy stories_update_self on public.stories
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy stories_delete_self on public.stories
for delete to authenticated
using (user_id = (select auth.uid()));

create policy story_views_select_participant on public.story_views
for select to authenticated
using (
  viewer_id = (select auth.uid())
  or exists (
    select 1 from public.stories story
    where story.id = story_views.story_id and story.user_id = (select auth.uid())
  )
);

create policy story_views_insert_visible_story on public.story_views
for insert to authenticated
with check (
  viewer_id = (select auth.uid())
  and exists (
    select 1 from public.stories story
    where story.id = story_views.story_id
      and story.expires_at > now()
      and story.user_id <> (select auth.uid())
      and (
        (story.visibility = 'public' and exists (
          select 1 from public.profiles author
          where author.id = story.user_id and author.is_private = false
        ))
        or exists (
          select 1 from public.user_follows relation
          where relation.follower_id = (select auth.uid())
            and relation.following_id = story.user_id
            and relation.status = 'accepted'
        )
      )
  )
);

create policy story_views_update_self on public.story_views
for update to authenticated
using (viewer_id = (select auth.uid()))
with check (viewer_id = (select auth.uid()));

create policy story_reactions_select_participant on public.story_reactions
for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.stories story
    where story.id = story_reactions.story_id and story.user_id = (select auth.uid())
  )
);

create policy story_reactions_insert_visible_story on public.story_reactions
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.stories story
    where story.id = story_reactions.story_id
      and story.expires_at > now()
      and story.user_id <> (select auth.uid())
      and (
        (story.visibility = 'public' and exists (
          select 1 from public.profiles author
          where author.id = story.user_id and author.is_private = false
        ))
        or exists (
          select 1 from public.user_follows relation
          where relation.follower_id = (select auth.uid())
            and relation.following_id = story.user_id
            and relation.status = 'accepted'
        )
      )
  )
);

create policy story_reactions_delete_self on public.story_reactions
for delete to authenticated
using (user_id = (select auth.uid()));

create policy story_replies_select_participant on public.story_replies
for select to authenticated
using (
  sender_id = (select auth.uid())
  or exists (
    select 1 from public.stories story
    where story.id = story_replies.story_id and story.user_id = (select auth.uid())
  )
);

create policy story_replies_insert_visible_story on public.story_replies
for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1 from public.stories story
    where story.id = story_replies.story_id
      and story.expires_at > now()
      and story.user_id <> (select auth.uid())
      and (
        (story.visibility = 'public' and exists (
          select 1 from public.profiles author
          where author.id = story.user_id and author.is_private = false
        ))
        or exists (
          select 1 from public.user_follows relation
          where relation.follower_id = (select auth.uid())
            and relation.following_id = story.user_id
            and relation.status = 'accepted'
        )
      )
  )
);

create policy story_replies_delete_self on public.story_replies
for delete to authenticated
using (sender_id = (select auth.uid()));

-- Stories use a separate private bucket so existing post-media rules remain unchanged.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'creova-stories',
  'creova-stories',
  false,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm']
)
on conflict (id) do nothing;

create policy creova_stories_upload_own on storage.objects
for insert to authenticated
with check (
  bucket_id = 'creova-stories'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.stories story
    where story.id::text = (storage.foldername(name))[2]
      and story.user_id = (select auth.uid())
      and story.media_path = name
  )
);

create policy creova_stories_read_visible on storage.objects
for select to authenticated
using (
  bucket_id = 'creova-stories'
  and exists (
    select 1 from public.stories story
    where story.media_path = objects.name
      and story.expires_at > now()
      and (
        story.user_id = (select auth.uid())
        or (
          story.visibility = 'public'
          and exists (
            select 1 from public.profiles author
            where author.id = story.user_id and author.is_private = false
          )
        )
        or exists (
          select 1 from public.user_follows relation
          where relation.follower_id = (select auth.uid())
            and relation.following_id = story.user_id
            and relation.status = 'accepted'
        )
      )
  )
);

create policy creova_stories_delete_own on storage.objects
for delete to authenticated
using (
  bucket_id = 'creova-stories'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.stories story
    where story.media_path = objects.name and story.user_id = (select auth.uid())
  )
);
