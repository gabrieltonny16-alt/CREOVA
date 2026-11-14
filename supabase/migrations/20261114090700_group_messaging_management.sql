-- Secure group administration for CREOVA messaging.
-- All privileged changes run through authenticated SECURITY DEFINER RPCs.
create or replace function public.creova_invite_group_members(
  p_conversation_id uuid,
  p_member_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing_count integer;
  v_new_count integer;
  v_member_id uuid;
begin
  if v_user_id is null then raise exception 'Sign in to manage this group'; end if;
  if not exists (
    select 1 from public.conversations c
    join public.conversation_members m on m.conversation_id = c.id
    where c.id = p_conversation_id and c.kind = 'group'
      and m.user_id = v_user_id and m.role = 'admin' and m.membership_status = 'accepted'
  ) then raise exception 'Only an accepted group admin can invite members'; end if;
  if p_member_ids is null or cardinality(p_member_ids) < 1 or cardinality(p_member_ids) > 49 then
    raise exception 'Choose between 1 and 49 members to invite';
  end if;
  select count(*) into v_existing_count
  from public.conversation_members
  where conversation_id = p_conversation_id and membership_status in ('accepted', 'pending');
  select count(distinct x) into v_new_count
  from unnest(p_member_ids) x
  where x <> v_user_id and not exists (
    select 1 from public.conversation_members m
    where m.conversation_id = p_conversation_id and m.user_id = x
      and m.membership_status in ('accepted', 'pending')
  );
  if v_existing_count + v_new_count > 50 then raise exception 'A group can have up to 50 active or invited members'; end if;
  foreach v_member_id in array (select array_agg(distinct x) from unnest(p_member_ids) x) loop
    if v_member_id <> v_user_id then
      insert into public.conversation_members (
        conversation_id, user_id, role, membership_status, invited_by
      ) values (p_conversation_id, v_member_id, 'member', 'pending', v_user_id)
      on conflict (conversation_id, user_id) do update
        set role = 'member', membership_status = 'pending', invited_by = v_user_id,
            joined_at = null, accepted_at = null, last_read_at = now()
        where public.conversation_members.membership_status = 'left';
    end if;
  end loop;
end;
$$;

create or replace function public.creova_set_group_member_role(
  p_conversation_id uuid,
  p_member_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_admin_count integer;
begin
  if v_user_id is null then raise exception 'Sign in to manage this group'; end if;
  if p_role not in ('admin', 'member') then raise exception 'Choose a valid group role'; end if;
  if not exists (
    select 1 from public.conversations c
    join public.conversation_members m on m.conversation_id = c.id
    where c.id = p_conversation_id and c.kind = 'group'
      and m.user_id = v_user_id and m.role = 'admin' and m.membership_status = 'accepted'
  ) then raise exception 'Only an accepted group admin can change roles'; end if;
  if not exists (
    select 1 from public.conversation_members
    where conversation_id = p_conversation_id and user_id = p_member_id
      and membership_status = 'accepted'
  ) then raise exception 'Only joined members can be given a role'; end if;
  if p_role = 'member' then
    select count(*) into v_admin_count from public.conversation_members
    where conversation_id = p_conversation_id and role = 'admin' and membership_status = 'accepted';
    if v_admin_count <= 1 and exists (
      select 1 from public.conversation_members
      where conversation_id = p_conversation_id and user_id = p_member_id and role = 'admin'
    ) then raise exception 'A group must keep at least one admin'; end if;
  end if;
  update public.conversation_members set role = p_role
  where conversation_id = p_conversation_id and user_id = p_member_id;
end;
$$;

create or replace function public.creova_rename_group(
  p_conversation_id uuid,
  p_title text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Sign in to manage this group'; end if;
  if p_title is null or char_length(trim(p_title)) < 1 or char_length(trim(p_title)) > 80 then
    raise exception 'Group names must contain 1 to 80 characters';
  end if;
  update public.conversations c set title = trim(p_title)
  where c.id = p_conversation_id and c.kind = 'group'
    and exists (
      select 1 from public.conversation_members m
      where m.conversation_id = c.id and m.user_id = v_user_id
        and m.role = 'admin' and m.membership_status = 'accepted'
    );
  if not found then raise exception 'Only an accepted group admin can rename this group'; end if;
end;
$$;

create or replace function public.creova_leave_group(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_admin boolean;
  v_next_admin uuid;
begin
  if v_user_id is null then raise exception 'Sign in to leave this group'; end if;
  select m.role = 'admin' into v_is_admin
  from public.conversation_members m
  join public.conversations c on c.id = m.conversation_id
  where m.conversation_id = p_conversation_id and m.user_id = v_user_id
    and c.kind = 'group' and m.membership_status in ('accepted', 'pending');
  if not found then raise exception 'You are not an active member of this group'; end if;
  if v_is_admin then
    select user_id into v_next_admin
    from public.conversation_members
    where conversation_id = p_conversation_id and user_id <> v_user_id
      and membership_status = 'accepted'
    order by joined_at asc nulls last
    limit 1;
    if v_next_admin is null then raise exception 'Promote another joined member to admin before leaving'; end if;
    update public.conversation_members set role = 'admin'
    where conversation_id = p_conversation_id and user_id = v_next_admin;
  end if;
  update public.conversation_members set membership_status = 'left'
  where conversation_id = p_conversation_id and user_id = v_user_id;
end;
$$;

revoke all on function public.creova_invite_group_members(uuid, uuid[]) from public, anon;
revoke all on function public.creova_set_group_member_role(uuid, text) from public, anon;
revoke all on function public.creova_rename_group(uuid, text) from public, anon;
revoke all on function public.creova_leave_group(uuid) from public, anon;
grant execute on function public.creova_invite_group_members(uuid, uuid[]) to authenticated;
grant execute on function public.creova_set_group_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.creova_rename_group(uuid, text) to authenticated;
grant execute on function public.creova_leave_group(uuid) to authenticated;
