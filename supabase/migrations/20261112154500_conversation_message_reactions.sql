create table if not exists public.conversation_message_reactions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  message_id uuid not null references public.conversation_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (emoji in ('❤️', '😂', '😮', '😢', '👍', '🔥')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversation_message_reactions_one_per_user unique (message_id, user_id)
);

create index if not exists conversation_message_reactions_conversation_message_idx
  on public.conversation_message_reactions (conversation_id, message_id);

alter table public.conversation_message_reactions enable row level security;
revoke all on public.conversation_message_reactions from anon, authenticated;
grant select, insert, update, delete on public.conversation_message_reactions to authenticated;

drop policy if exists conversation_message_reactions_select_member on public.conversation_message_reactions;
create policy conversation_message_reactions_select_member
on public.conversation_message_reactions for select to authenticated
using (
  exists (
    select 1
    from public.conversation_messages message
    join public.conversation_members membership
      on membership.conversation_id = message.conversation_id
    where message.id = conversation_message_reactions.message_id
      and message.conversation_id = conversation_message_reactions.conversation_id
      and membership.user_id = (select auth.uid())
      and membership.membership_status = 'accepted'
  )
);

drop policy if exists conversation_message_reactions_insert_self_member on public.conversation_message_reactions;
create policy conversation_message_reactions_insert_self_member
on public.conversation_message_reactions for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.conversation_messages message
    join public.conversation_members membership
      on membership.conversation_id = message.conversation_id
    where message.id = conversation_message_reactions.message_id
      and message.conversation_id = conversation_message_reactions.conversation_id
      and membership.user_id = (select auth.uid())
      and membership.membership_status = 'accepted'
  )
);

drop policy if exists conversation_message_reactions_update_self_member on public.conversation_message_reactions;
create policy conversation_message_reactions_update_self_member
on public.conversation_message_reactions for update to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.conversation_members membership
    where membership.conversation_id = conversation_message_reactions.conversation_id
      and membership.user_id = (select auth.uid())
      and membership.membership_status = 'accepted'
  )
)
with check (
  user_id = (select auth.uid())
  and emoji in ('❤️', '😂', '😮', '😢', '👍', '🔥')
  and exists (
    select 1 from public.conversation_messages message
    join public.conversation_members membership
      on membership.conversation_id = message.conversation_id
    where message.id = conversation_message_reactions.message_id
      and message.conversation_id = conversation_message_reactions.conversation_id
      and membership.user_id = (select auth.uid())
      and membership.membership_status = 'accepted'
  )
);

drop policy if exists conversation_message_reactions_delete_self_member on public.conversation_message_reactions;
create policy conversation_message_reactions_delete_self_member
on public.conversation_message_reactions for delete to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.conversation_members membership
    where membership.conversation_id = conversation_message_reactions.conversation_id
      and membership.user_id = (select auth.uid())
      and membership.membership_status = 'accepted'
  )
);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'conversation_message_reactions'
  ) then
    alter publication supabase_realtime add table public.conversation_message_reactions;
  end if;
end $$;

comment on table public.conversation_message_reactions is
  'One emoji reaction per accepted conversation member per message; all access is scoped to accepted conversation membership.';
