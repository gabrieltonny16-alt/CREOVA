-- CREOVA profile avatars.
-- This migration is committed for the isolated development project only.
-- Do not apply it to the legacy/production CREOVA database without approval.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'creova-avatars',
  'creova-avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "creova_avatar_upload_own_folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'creova-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "creova_avatar_delete_own_folder"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'creova-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
