-- Permit any accepted group member to send the group's first welcome message.
drop policy if exists conversation_messages_insert_member on public.conversation_messages;
create policy conversation_messages_insert_member
on public.conversation_messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and private.creova_is_conversation_member(conversation_id)
  and exists (
    select 1 from public.conversation_members own_membership
    where own_membership.conversation_id = conversation_messages.conversation_id
      and own_membership.user_id = (select auth.uid())
      and own_membership.membership_status = 'accepted'
  )
  and not exists (
    select 1 from public.conversation_members declined_member
    where declined_member.conversation_id = conversation_messages.conversation_id
      and declined_member.membership_status = 'declined'
  )
  and (
    not exists (
      select 1 from public.conversation_members pending_member
      where pending_member.conversation_id = conversation_messages.conversation_id
        and pending_member.membership_status = 'pending'
    )
    or (
      exists (
        select 1 from public.conversations thread
        where thread.id = conversation_messages.conversation_id
          and (thread.created_by = (select auth.uid()) or thread.kind = 'group')
      )
      and not exists (
        select 1 from public.conversation_messages prior_message
        where prior_message.conversation_id = conversation_messages.conversation_id
      )
    )
  )
);
