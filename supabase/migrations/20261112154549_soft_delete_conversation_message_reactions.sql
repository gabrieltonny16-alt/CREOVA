-- Use UPDATE for reaction removal so Realtime can safely filter by conversation_id.
-- DELETE events cannot be authorized with row-level security in Supabase Realtime.
alter table public.conversation_message_reactions
  add column if not exists deleted_at timestamptz;

revoke delete on table public.conversation_message_reactions from authenticated;

drop policy if exists conversation_message_reactions_delete_self_member
  on public.conversation_message_reactions;
