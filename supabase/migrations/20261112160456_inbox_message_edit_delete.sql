-- Secure sender-only editing and soft deletion for Inbox messages.
alter table public.conversation_messages
  add column edited_at timestamptz,
  add column deleted_at timestamptz;

alter table public.conversation_messages
  drop constraint if exists conversation_messages_content_check;

alter table public.conversation_messages
  add constraint conversation_messages_content_check
  check (
    deleted_at is not null
    or nullif(trim(coalesce(body, '')), '') is not null
    or attachment_path is not null
  );

create or replace function public.creova_edit_conversation_message(p_message_id uuid, p_body text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_body text := nullif(trim(coalesce(p_body, '')), '');
begin
  if v_user_id is null then raise exception 'Sign in to edit messages'; end if;
  if v_body is null or char_length(v_body) > 5000 then raise exception 'Messages must contain 1 to 5,000 characters'; end if;
  update public.conversation_messages message_row
  set body = v_body, edited_at = now()
  where message_row.id = p_message_id
    and message_row.sender_id = v_user_id
    and message_row.deleted_at is null
    and exists (
      select 1 from public.conversation_members member_row
      where member_row.conversation_id = message_row.conversation_id
        and member_row.user_id = v_user_id
        and member_row.membership_status = 'accepted'
    );
  if not found then raise exception 'Message not found or you cannot edit it'; end if;
end;
$$;
revoke all on function public.creova_edit_conversation_message(uuid, text) from public, anon;
grant execute on function public.creova_edit_conversation_message(uuid, text) to authenticated;

create or replace function public.creova_delete_conversation_message(p_message_id uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_attachment_path text;
begin
  if v_user_id is null then raise exception 'Sign in to delete messages'; end if;
  update public.conversation_messages message_row
  set body = null, deleted_at = now()
  where message_row.id = p_message_id
    and message_row.sender_id = v_user_id
    and message_row.deleted_at is null
    and exists (
      select 1 from public.conversation_members member_row
      where member_row.conversation_id = message_row.conversation_id
        and member_row.user_id = v_user_id
        and member_row.membership_status = 'accepted'
    )
  returning message_row.attachment_path into v_attachment_path;
  if not found then raise exception 'Message not found or you cannot delete it'; end if;
  return v_attachment_path;
end;
$$;
revoke all on function public.creova_delete_conversation_message(uuid) from public, anon;
grant execute on function public.creova_delete_conversation_message(uuid) to authenticated;

drop policy if exists creova_chat_media_select_member on storage.objects;
create policy creova_chat_media_select_member on storage.objects for select to authenticated
using (
  bucket_id = 'creova-chat-media'
  and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and private.creova_is_conversation_member(split_part(name, '/', 1)::uuid)
  and exists (
    select 1 from public.conversation_messages message_row
    where message_row.conversation_id = split_part(objects.name, '/', 1)::uuid
      and message_row.attachment_path = objects.name
      and message_row.deleted_at is null
  )
);
comment on column public.conversation_messages.edited_at is 'Timestamp of the most recent sender-authorized text edit.';
comment on column public.conversation_messages.deleted_at is 'Soft-delete timestamp; deleted message content is hidden from every conversation member.';
