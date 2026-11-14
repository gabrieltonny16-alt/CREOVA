-- Keep message edit/delete RPCs under ordinary caller privileges and RLS.
drop policy if exists conversation_messages_update_own on public.conversation_messages;
create policy conversation_messages_update_own on public.conversation_messages for update to authenticated
using (
  sender_id = (select auth.uid())
  and deleted_at is null
  and exists (
    select 1 from public.conversation_members member_row
    where member_row.conversation_id = conversation_messages.conversation_id
      and member_row.user_id = (select auth.uid())
      and member_row.membership_status = 'accepted'
  )
)
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1 from public.conversation_members member_row
    where member_row.conversation_id = conversation_messages.conversation_id
      and member_row.user_id = (select auth.uid())
      and member_row.membership_status = 'accepted'
  )
);
grant update (body, edited_at, deleted_at) on public.conversation_messages to authenticated;

create or replace function public.creova_edit_conversation_message(p_message_id uuid, p_body text)
returns void language plpgsql security invoker set search_path = ''
as $$
declare v_body text := nullif(trim(coalesce(p_body, '')), '');
begin
  if auth.uid() is null then raise exception 'Sign in to edit messages'; end if;
  if v_body is null or char_length(v_body) > 5000 then raise exception 'Messages must contain 1 to 5,000 characters'; end if;
  update public.conversation_messages message_row
  set body = v_body, edited_at = now()
  where message_row.id = p_message_id and message_row.deleted_at is null;
  if not found then raise exception 'Message not found or you cannot edit it'; end if;
end;
$$;

create or replace function public.creova_delete_conversation_message(p_message_id uuid)
returns text language plpgsql security invoker set search_path = ''
as $$
declare v_attachment_path text;
begin
  if auth.uid() is null then raise exception 'Sign in to delete messages'; end if;
  update public.conversation_messages message_row
  set body = null, deleted_at = now()
  where message_row.id = p_message_id and message_row.deleted_at is null
  returning message_row.attachment_path into v_attachment_path;
  if not found then raise exception 'Message not found or you cannot delete it'; end if;
  return v_attachment_path;
end;
$$;

revoke all on function public.creova_edit_conversation_message(uuid, text) from public, anon;
grant execute on function public.creova_edit_conversation_message(uuid, text) to authenticated;
revoke all on function public.creova_delete_conversation_message(uuid) from public, anon;
grant execute on function public.creova_delete_conversation_message(uuid) to authenticated;
