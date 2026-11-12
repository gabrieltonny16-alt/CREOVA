-- CREOVA direct and group messaging foundation. Apply to CREOVA-DEV only.
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('direct', 'group')),
  title text check (title is null or char_length(title) between 1 and 80),
  created_by uuid not null references public.profiles(id) on delete cascade,
  direct_key text,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  constraint conversations_direct_key_kind check (
    (kind = 'direct' and direct_key is not null and title is null)
    or (kind = 'group' and direct_key is null)
  )
);
create unique index conversations_direct_key_unique on public.conversations (direct_key) where direct_key is not null;
create index conversations_last_message_idx on public.conversations (last_message_at desc);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  membership_status text not null default 'pending' check (membership_status in ('accepted', 'pending', 'declined', 'left')),
  invited_by uuid references public.profiles(id) on delete set null,
  joined_at timestamptz,
  accepted_at timestamptz,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conversation_members_user_status_idx on public.conversation_members (user_id, membership_status, conversation_id);
create index conversation_members_conversation_status_idx on public.conversation_members (conversation_id, membership_status, user_id);

create table public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  client_message_id uuid not null default gen_random_uuid(),
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now(),
  constraint conversation_messages_client_id_unique unique (sender_id, client_message_id)
);
create index conversation_messages_thread_time_idx on public.conversation_messages (conversation_id, created_at desc);
create index conversation_messages_sender_time_idx on public.conversation_messages (sender_id, created_at desc);

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.conversation_messages enable row level security;

-- Narrow helper: policies can test membership without recursive RLS evaluation.
create or replace function public.creova_is_conversation_member(p_conversation_id uuid)
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
      and member_row.membership_status in ('accepted', 'pending')
  );
$$;
revoke all on function public.creova_is_conversation_member(uuid) from public, anon;
grant execute on function public.creova_is_conversation_member(uuid) to authenticated;

-- Create a direct or group conversation atomically. All invitees start as requests.
create or replace function public.creova_create_conversation(
  p_kind text,
  p_member_ids uuid[],
  p_title text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_member_count integer;
  v_conversation_id uuid;
  v_direct_key text;
  v_member_id uuid;
begin
  if v_user_id is null then
    raise exception 'Sign in to start a conversation';
  end if;
  if p_kind not in ('direct', 'group') or p_member_ids is null then
    raise exception 'Invalid conversation details';
  end if;
  select count(*), count(distinct member_id)
    into v_member_count, v_member_count
  from unnest(p_member_ids) as member_id;
  if cardinality(p_member_ids) < 2
     or cardinality(p_member_ids) > 50
     or cardinality(p_member_ids) <> v_member_count
     or not (v_user_id = any(p_member_ids)) then
    raise exception 'Choose 2 to 50 different participants, including yourself';
  end if;
  if p_kind = 'direct' and cardinality(p_member_ids) <> 2 then
    raise exception 'A direct conversation must have exactly two participants';
  end if;
  if p_kind = 'group' and cardinality(p_member_ids) < 3 then
    raise exception 'A group conversation needs at least three participants';
  end if;
  if p_kind = 'group' and char_length(trim(coalesce(p_title, ''))) > 80 then
    raise exception 'Group names must be 80 characters or fewer';
  end if;

  if p_kind = 'direct' then
    v_direct_key := least(p_member_ids[1], p_member_ids[2])::text || ':' ||
                    greatest(p_member_ids[1], p_member_ids[2])::text;
    select id into v_conversation_id
    from public.conversations
    where direct_key = v_direct_key;
  end if;

  if v_conversation_id is null then
    insert into public.conversations (kind, title, created_by, direct_key)
    values (
      p_kind,
      case when p_kind = 'group' then coalesce(nullif(trim(p_title), ''), 'New group') else null end,
      v_user_id,
      v_direct_key
    )
    on conflict (direct_key) where direct_key is not null do nothing
    returning id into v_conversation_id;

    if v_conversation_id is null and p_kind = 'direct' then
      select id into v_conversation_id
      from public.conversations
      where direct_key = v_direct_key;
    end if;

    if v_conversation_id is not null and not exists (
      select 1 from public.conversation_members existing
      where existing.conversation_id = v_conversation_id
    ) then
      foreach v_member_id in array p_member_ids loop
        insert into public.conversation_members (
          conversation_id, user_id, role, membership_status, invited_by, joined_at, accepted_at
        ) values (
          v_conversation_id,
          v_member_id,
          case when v_member_id = v_user_id and p_kind = 'group' then 'admin' else 'member' end,
          case when v_member_id = v_user_id then 'accepted' else 'pending' end,
          v_user_id,
          case when v_member_id = v_user_id then now() else null end,
          case when v_member_id = v_user_id then now() else null end
        );
      end loop;
    end if;
  end if;

  return v_conversation_id;
end;
$$;
revoke all on function public.creova_create_conversation(text, uuid[], text) from public, anon;
grant execute on function public.creova_create_conversation(text, uuid[], text) to authenticated;

create or replace function public.creova_touch_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.sender_id <> (select auth.uid()) then
    raise exception 'Invalid message sender';
  end if;
  update public.conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;
revoke all on function public.creova_touch_conversation_on_message() from public, anon, authenticated;
create trigger conversation_message_updates_thread
after insert on public.conversation_messages
for each row execute function public.creova_touch_conversation_on_message();

create policy conversations_select_member
on public.conversations for select to authenticated
using (public.creova_is_conversation_member(id));

create policy conversation_members_select_participant
on public.conversation_members for select to authenticated
using (public.creova_is_conversation_member(conversation_id));

create policy conversation_members_update_own_request_or_read_state
on public.conversation_members for update to authenticated
using (
  user_id = (select auth.uid())
  and membership_status in ('accepted', 'pending')
)
with check (
  user_id = (select auth.uid())
  and membership_status in ('accepted', 'pending', 'declined')
);

create policy conversation_messages_select_member
on public.conversation_messages for select to authenticated
using (public.creova_is_conversation_member(conversation_id));

create policy conversation_messages_insert_member
on public.conversation_messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and public.creova_is_conversation_member(conversation_id)
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
          and thread.created_by = (select auth.uid())
      )
      and not exists (
        select 1 from public.conversation_messages prior_message
        where prior_message.conversation_id = conversation_messages.conversation_id
      )
    )
  )
);

revoke all on table public.conversations, public.conversation_members, public.conversation_messages from anon, authenticated;
grant select on table public.conversations to authenticated;
grant select, update (membership_status, accepted_at, last_read_at) on table public.conversation_members to authenticated;
grant select, insert on table public.conversation_messages to authenticated;

-- Publish only the tables needed for chat updates. RLS still controls row visibility.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversation_messages'
    ) then
      execute 'alter publication supabase_realtime add table public.conversation_messages';
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversation_members'
    ) then
      execute 'alter publication supabase_realtime add table public.conversation_members';
    end if;
  end if;
end;
$$;
