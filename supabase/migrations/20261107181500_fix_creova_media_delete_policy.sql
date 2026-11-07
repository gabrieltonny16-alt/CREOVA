-- Allow the post owner to clean up an uploaded object even if media metadata insertion fails.
drop policy if exists "creova_media_delete_owned_post" on storage.objects;

create policy "creova_media_delete_owned_post"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'creova-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1
    from public.posts parent
    where parent.id::text = (storage.foldername(name))[2]
      and parent.author_id = (select auth.uid())
  )
);
