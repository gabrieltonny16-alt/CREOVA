create table public.profile_presence_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  show_activity_status boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.profile_presence_settings enable row level security;
revoke all on table public.profile_presence_settings from anon, authenticated;
grant select, insert, update on table public.profile_presence_settings to authenticated;

create policy profile_presence_settings_select_own
on public.profile_presence_settings
for select to authenticated
using (user_id = (select auth.uid()));

create policy profile_presence_settings_insert_own
on public.profile_presence_settings
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy profile_presence_settings_update_own
on public.profile_presence_settings
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create or replace function private.creova_can_use_conversation_presence(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_members member_row
    where member_row.conversation_id = p_conversation_id
      and member_row.user_id = (select auth.uid())
      and member_row.membership_status = 'accepted'
  );
$$;

revoke all on function private.creova_can_use_conversation_presence(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.creova_can_use_conversation_presence(uuid) to authenticated;

create policy creova_conversation_presence_read
on realtime.messages
for select to authenticated
using (
  realtime.messages.extension = 'presence'
  and private.creova_can_use_conversation_presence(
    substring((select realtime.topic()) from '^creova:conversation:([0-9a-fA-F-]{36})$')::uuid
  )
);

create policy creova_conversation_presence_write
on realtime.messages
for insert to authenticated
with check (
  realtime.messages.extension = 'presence'
  and private.creova_can_use_conversation_presence(
    substring((select realtime.topic()) from '^creova:conversation:([0-9a-fA-F-]{36})$')::uuid
  )
);

create policy creova_inbox_channel_read
on realtime.messages
for select to authenticated
using ((select realtime.topic()) = 'creova:inbox-updates');
