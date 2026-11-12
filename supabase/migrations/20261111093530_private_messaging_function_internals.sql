-- Keep SECURITY DEFINER internals outside the exposed Data API schema.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.creova_is_conversation_member(p_conversation_id uuid)
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
revoke all on function private.creova_is_conversation_member(uuid) from public, anon;
grant execute on function private.creova_is_conversation_member(uuid) to authenticated;

create or replace function private.creova_create_conversation_impl(
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
  v_distinct_count integer;
  v_conversation_id uuid;
  v_direct_key text;
  v_member_id uuid;
begin
  if v_user_id is null then
    raise exception 'Sign in to start a conversation';
  end if;
  if p_kind is null or p_kind not in ('direct', 'group') or p_member_ids is null then
    raise exception 'Invalid conversation details';
  end if;
  select count(distinct member_id) into v_distinct_count
  from unnest(p_member_ids) as member_id;
  if cardinality(p_member_ids) < 2
     or cardinality(p_member_ids) > 50
     or cardinality(p_member_ids) <> v_distinct_count
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
revoke all on function private.creova_create_conversation_impl(text, uuid[], text) from public, anon;
grant execute on function private.creova_create_conversation_impl(text, uuid[], text) to authenticated;

-- Public RPC is SECURITY INVOKER; its privileged implementation is private.
create or replace function public.creova_create_conversation(
  p_kind text,
  p_member_ids uuid[],
  p_title text default null
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.creova_create_conversation_impl(p_kind, p_member_ids, p_title);
$$;
revoke all on function public.creova_create_conversation(text, uuid[], text) from public, anon;
grant execute on function public.creova_create_conversation(text, uuid[], text) to authenticated;

drop policy if exists conversations_select_member on public.conversations;
create policy conversations_select_member
on public.conversations for select to authenticated
using (private.creova_is_conversation_member(id));

drop policy if exists conversation_members_select_participant on public.conversation_members;
create policy conversation_members_select_participant
on public.conversation_members for select to authenticated
using (private.creova_is_conversation_member(conversation_id));

drop policy if exists conversation_messages_select_member on public.conversation_messages;
create policy conversation_messages_select_member
on public.conversation_messages for select to authenticated
using (private.creova_is_conversation_member(conversation_id));

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
          and thread.created_by = (select auth.uid())
      )
      and not exists (
        select 1 from public.conversation_messages prior_message
        where prior_message.conversation_id = conversation_messages.conversation_id
      )
    )
  )
);

drop function if exists public.creova_is_conversation_member(uuid);

create index if not exists conversations_created_by_idx on public.conversations (created_by);
create index if not exists conversation_members_invited_by_idx on public.conversation_members (invited_by);
