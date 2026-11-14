-- Private chat media storage and attachment metadata. Apply to CREOVA-DEV only.
alter table public.conversation_messages
  alter column body drop not null;

alter table public.conversation_messages
  add column attachment_type text,
  add column attachment_path text,
  add column attachment_name text,
  add column attachment_mime_type text,
  add column attachment_size bigint,
  add column attachment_duration_ms integer;

alter table public.conversation_messages
  add constraint conversation_messages_body_length_check
    check (body is null or char_length(body) <= 5000),
  add constraint conversation_messages_content_check
    check (nullif(trim(coalesce(body, '')), '') is not null or attachment_path is not null),
  add constraint conversation_messages_attachment_type_check
    check (attachment_type is null or attachment_type in ('image', 'video', 'audio')),
  add constraint conversation_messages_attachment_metadata_check
    check (
      (attachment_path is null and attachment_type is null and attachment_name is null
        and attachment_mime_type is null and attachment_size is null and attachment_duration_ms is null)
      or
      (attachment_path is not null and attachment_type is not null and attachment_name is not null
        and attachment_mime_type is not null and attachment_size between 1 and 26214400
        and (attachment_duration_ms is null or attachment_duration_ms between 1 and 120000))
    );

create index conversation_messages_attachment_idx
  on public.conversation_messages (conversation_id, created_at desc)
  where attachment_path is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'creova-chat-media',
  'creova-chat-media',
  false,
  26214400,
  array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime','video/webm','audio/mp4','audio/m4a','audio/aac','audio/webm','audio/3gpp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 26214400,
  allowed_mime_types = excluded.allowed_mime_types;

create policy creova_chat_media_select_member
on storage.objects for select to authenticated
using (
  bucket_id = 'creova-chat-media'
  and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and private.creova_is_conversation_member(split_part(name, '/', 1)::uuid)
);

create policy creova_chat_media_insert_member
on storage.objects for insert to authenticated
with check (
  bucket_id = 'creova-chat-media'
  and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and split_part(name, '/', 2) = (select auth.uid())::text
  and exists (
    select 1 from public.conversation_members own_member
    where own_member.conversation_id = split_part(name, '/', 1)::uuid
      and own_member.user_id = (select auth.uid())
      and own_member.membership_status = 'accepted'
  )
);

create policy creova_chat_media_delete_sender
on storage.objects for delete to authenticated
using (
  bucket_id = 'creova-chat-media'
  and split_part(name, '/', 2) = (select auth.uid())::text
  and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and private.creova_is_conversation_member(split_part(name, '/', 1)::uuid)
);
