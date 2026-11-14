-- CREOVA Story Highlights: persistent private copies of selected 24-hour Stories.
create table public.story_highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 30),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index story_highlights_user_position_idx on public.story_highlights(user_id, position, created_at);
create table public.story_highlight_items (
  id uuid primary key default gen_random_uuid(),
  highlight_id uuid not null references public.story_highlights(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  media_path text not null unique,
  media_type text not null check (media_type in ('image', 'video')),
  caption text not null default '' check (char_length(caption) <= 500),
  duration_seconds numeric(6,2),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  constraint story_highlight_video_duration check (
    (media_type = 'image' and duration_seconds is null)
    or (media_type = 'video' and (duration_seconds is null or duration_seconds between 0.1 and 30))
  ),
  constraint story_highlight_media_path_owner check (media_path like user_id::text || '/' || highlight_id::text || '/%')
);
create index story_highlight_items_highlight_position_idx on public.story_highlight_items(highlight_id, position, created_at);
alter table public.story_highlights enable row level security;
alter table public.story_highlight_items enable row level security;
grant select, insert, update, delete on public.story_highlights to authenticated;
grant select, insert, update, delete on public.story_highlight_items to authenticated;

create policy story_highlights_select_visible on public.story_highlights for select to authenticated using (
  user_id = (select auth.uid())
  or exists (select 1 from public.profiles author where author.id = story_highlights.user_id and author.is_private = false)
  or exists (select 1 from public.user_follows relation where relation.follower_id = (select auth.uid()) and relation.following_id = story_highlights.user_id and relation.status = 'accepted')
);
create policy story_highlights_insert_own on public.story_highlights for insert to authenticated with check (user_id = (select auth.uid()));
create policy story_highlights_update_own on public.story_highlights for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy story_highlights_delete_own on public.story_highlights for delete to authenticated using (user_id = (select auth.uid()));

create policy story_highlight_items_select_visible on public.story_highlight_items for select to authenticated using (
  exists (select 1 from public.story_highlights highlight where highlight.id = story_highlight_items.highlight_id and (
    highlight.user_id = (select auth.uid())
    or exists (select 1 from public.profiles author where author.id = highlight.user_id and author.is_private = false)
    or exists (select 1 from public.user_follows relation where relation.follower_id = (select auth.uid()) and relation.following_id = highlight.user_id and relation.status = 'accepted')
  ))
);
create policy story_highlight_items_insert_own on public.story_highlight_items for insert to authenticated with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.story_highlights highlight where highlight.id = story_highlight_items.highlight_id and highlight.user_id = (select auth.uid()))
);
create policy story_highlight_items_delete_own on public.story_highlight_items for delete to authenticated using (
  user_id = (select auth.uid())
  and exists (select 1 from public.story_highlights highlight where highlight.id = story_highlight_items.highlight_id and highlight.user_id = (select auth.uid()))
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('creova-highlights', 'creova-highlights', false, 52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do nothing;
create policy creova_highlights_upload_own on storage.objects for insert to authenticated with check (
  bucket_id = 'creova-highlights'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.story_highlight_items item join public.story_highlights highlight on highlight.id = item.highlight_id
    where item.media_path = name and item.user_id = (select auth.uid()) and highlight.user_id = (select auth.uid()))
);
create policy creova_highlights_read_visible on storage.objects for select to authenticated using (
  bucket_id = 'creova-highlights'
  and exists (select 1 from public.story_highlight_items item
    join public.story_highlights highlight on highlight.id = item.highlight_id
    join public.profiles author on author.id = highlight.user_id
    where item.media_path = objects.name and (
      highlight.user_id = (select auth.uid()) or author.is_private = false
      or exists (select 1 from public.user_follows relation where relation.follower_id = (select auth.uid()) and relation.following_id = highlight.user_id and relation.status = 'accepted')
    ))
);
create policy creova_highlights_delete_own on storage.objects for delete to authenticated using (
  bucket_id = 'creova-highlights'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.story_highlight_items item join public.story_highlights highlight on highlight.id = item.highlight_id
    where item.media_path = name and item.user_id = (select auth.uid()) and highlight.user_id = (select auth.uid()))
);
