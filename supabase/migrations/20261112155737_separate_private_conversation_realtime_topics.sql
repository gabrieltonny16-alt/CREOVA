drop policy if exists creova_conversation_presence_read on realtime.messages;
drop policy if exists creova_conversation_presence_write on realtime.messages;

create policy creova_conversation_message_channel_read
on realtime.messages
for select to authenticated
using (
  private.creova_is_conversation_member(
    substring((select realtime.topic()) from '^creova:conversation-messages:([0-9a-fA-F-]{36})$')::uuid
  )
  and (select realtime.topic()) ~ '^creova:conversation-messages:[0-9a-fA-F-]{36}$'
);

create policy creova_conversation_presence_read
on realtime.messages
for select to authenticated
using (
  realtime.messages.extension = 'presence'
  and private.creova_can_use_conversation_presence(
    substring((select realtime.topic()) from '^creova:conversation-presence:([0-9a-fA-F-]{36})$')::uuid
  )
);

create policy creova_conversation_presence_write
on realtime.messages
for insert to authenticated
with check (
  realtime.messages.extension = 'presence'
  and private.creova_can_use_conversation_presence(
    substring((select realtime.topic()) from '^creova:conversation-presence:([0-9a-fA-F-]{36})$')::uuid
  )
);
