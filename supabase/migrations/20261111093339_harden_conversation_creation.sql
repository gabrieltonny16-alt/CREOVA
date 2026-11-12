-- Tighten validation in the CREOVA-DEV conversation creation RPC.
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
