-- Private image storage for CREOVA posts.
-- Applied only to CREOVA-DEV; no public bucket and no destructive changes.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'creova-media',
  'creova-media',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do nothing;

create policy "creova_media_upload_to_owned_post"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'creova-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1
    from public.posts parent
    where parent.id::text = (storage.foldername(name))[2]
      and parent.author_id = (select auth.uid())
  )
);

create policy "creova_media_read_visible_post"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'creova-media'
  and exists (
    select 1
    from public.post_media media
    where media.object_path = storage.objects.name
  )
);

create policy "creova_media_delete_owned_post"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'creova-media'
  and exists (
    select 1
    from public.post_media media
    join public.posts parent on parent.id = media.post_id
    where media.object_path = storage.objects.name
      and parent.author_id = (select auth.uid())
  )
);
