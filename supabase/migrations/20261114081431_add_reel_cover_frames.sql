alter table public.post_media
  add column if not exists cover_object_path text;

alter table public.post_media
  add constraint post_media_cover_only_for_video
  check (cover_object_path is null or media_type = 'video');

create unique index if not exists post_media_cover_object_path_unique
  on public.post_media (cover_object_path)
  where cover_object_path is not null;

comment on column public.post_media.cover_object_path is
  'Private creova-media object path for the selected video cover frame.';

drop policy if exists creova_media_read_visible_post on storage.objects;

create policy creova_media_read_visible_post
on storage.objects
for select
to authenticated
using (
  bucket_id = 'creova-media'
  and exists (
    select 1
    from public.post_media media
    join public.posts parent on parent.id = media.post_id
    join public.profiles author on author.id = parent.author_id
    where (
      media.object_path = storage.objects.name
      or media.cover_object_path = storage.objects.name
    )
    and (
      parent.author_id = (select auth.uid())
      or (author.is_private = false and parent.visibility = 'public')
      or exists (
        select 1
        from public.user_follows relation
        where relation.follower_id = (select auth.uid())
          and relation.following_id = parent.author_id
          and relation.status = 'accepted'
      )
    )
  )
);
