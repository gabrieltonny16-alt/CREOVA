-- CREOVA moderation security hardening and foreign-key indexes

create index if not exists moderator_roles_granted_by_idx
  on private.moderator_roles (granted_by)
  where granted_by is not null;

create index if not exists moderation_reports_reviewed_by_idx
  on public.moderation_reports (reviewed_by)
  where reviewed_by is not null;

create index if not exists moderation_appeals_reviewed_by_idx
  on public.moderation_appeals (reviewed_by)
  where reviewed_by is not null;

create index if not exists moderation_audit_report_id_idx
  on public.moderation_audit_log (report_id)
  where report_id is not null;

create index if not exists moderation_audit_appeal_id_idx
  on public.moderation_audit_log (appeal_id)
  where appeal_id is not null;

drop policy if exists "No direct access to moderator roles" on private.moderator_roles;
create policy "No direct access to moderator roles"
  on private.moderator_roles for all to anon, authenticated
  using (false) with check (false);

drop policy if exists "No direct access to moderation settings" on private.moderation_settings;
create policy "No direct access to moderation settings"
  on private.moderation_settings for all to anon, authenticated
  using (false) with check (false);

drop function if exists public.review_moderation(text, uuid, text, text, uuid, uuid);

create or replace function private.review_moderation(
  p_target_type text,
  p_target_id uuid,
  p_action text,
  p_reason text default null,
  p_appeal_id uuid default null,
  p_report_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  appeal_status text;
  appeal_target_type text;
  appeal_target_id uuid;
  next_report_status text;
  target_found boolean;
begin
  if actor is null or not private.is_moderator() then
    raise exception 'Moderator access required' using errcode = '42501';
  end if;

  if p_reason is not null and char_length(p_reason) > 1000 then
    raise exception 'Review reason must be 1000 characters or fewer';
  end if;

  if p_action not in (
    'hold', 'remove', 'restore',
    'dismiss_report', 'confirm_report',
    'overturn_appeal', 'uphold_appeal'
  ) then
    raise exception 'Unsupported moderation action';
  end if;

  if p_action in ('dismiss_report', 'confirm_report') then
    if p_report_id is null then
      raise exception 'A report ID is required for this action';
    end if;

    next_report_status := case
      when p_action = 'dismiss_report' then 'dismissed'
      else 'actioned'
    end;

    update public.moderation_reports
      set status = next_report_status,
          reviewed_by = actor,
          reviewed_at = now(),
          resolution_note = p_reason
      where id = p_report_id
        and target_type = p_target_type
        and target_id = p_target_id
        and status in ('open', 'in_review');

    if not found then
      raise exception 'The report is missing, already resolved, or belongs to another target';
    end if;

    if p_action = 'confirm_report' then
      target_found := private.set_target_moderation_status(p_target_type, p_target_id, 'removed');
      if not target_found then raise exception 'Moderation target was not found'; end if;

      update public.moderation_reports
        set status = 'actioned',
            reviewed_by = actor,
            reviewed_at = now(),
            resolution_note = coalesce(p_reason, 'Related report confirmed')
        where target_type = p_target_type
          and target_id = p_target_id
          and status in ('open', 'in_review');
    end if;

  elsif p_action in ('overturn_appeal', 'uphold_appeal') then
    if p_appeal_id is null then
      raise exception 'An appeal ID is required for this action';
    end if;

    select a.status, a.target_type, a.target_id
      into appeal_status, appeal_target_type, appeal_target_id
      from public.moderation_appeals a
      where a.id = p_appeal_id
      for update;

    if not found
      or appeal_status <> 'pending'
      or appeal_target_type <> p_target_type
      or appeal_target_id <> p_target_id then
      raise exception 'The pending appeal was not found for this target';
    end if;

    update public.moderation_appeals
      set status = case when p_action = 'overturn_appeal' then 'overturned' else 'upheld' end,
          reviewed_by = actor,
          reviewed_at = now(),
          resolution_note = p_reason
      where id = p_appeal_id;

    if p_action = 'overturn_appeal' then
      target_found := private.set_target_moderation_status(p_target_type, p_target_id, 'visible');
      if not target_found then raise exception 'Moderation target was not found'; end if;

      update public.moderation_reports
        set status = 'dismissed',
            reviewed_by = actor,
            reviewed_at = now(),
            resolution_note = coalesce(p_reason, 'Appeal overturned')
        where target_type = p_target_type
          and target_id = p_target_id
          and status in ('open', 'in_review');
    end if;

  else
    target_found := private.set_target_moderation_status(
      p_target_type,
      p_target_id,
      case
        when p_action = 'hold' then 'held'
        when p_action = 'remove' then 'removed'
        else 'visible'
      end
    );

    if not target_found then raise exception 'Moderation target was not found'; end if;

    if p_action = 'remove' then
      update public.moderation_reports
        set status = 'actioned',
            reviewed_by = actor,
            reviewed_at = now(),
            resolution_note = coalesce(p_reason, 'Contribution removed by moderation')
        where target_type = p_target_type
          and target_id = p_target_id
          and status in ('open', 'in_review');
    elsif p_action = 'restore' then
      update public.moderation_reports
        set status = 'dismissed',
            reviewed_by = actor,
            reviewed_at = now(),
            resolution_note = coalesce(p_reason, 'Contribution restored after review')
        where target_type = p_target_type
          and target_id = p_target_id
          and status in ('open', 'in_review');
    end if;
  end if;

  insert into public.moderation_audit_log (
    actor_id, action, target_type, target_id, report_id, appeal_id, reason
  ) values (
    actor, p_action, p_target_type, p_target_id, p_report_id, p_appeal_id, p_reason
  );

  return jsonb_build_object(
    'ok', true,
    'action', p_action,
    'target_type', p_target_type,
    'target_id', p_target_id
  );
end;
$$;

revoke all on function private.review_moderation(text, uuid, text, text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.review_moderation(text, uuid, text, text, uuid, uuid)
  to authenticated;

create or replace function public.review_moderation(
  p_target_type text,
  p_target_id uuid,
  p_action text,
  p_reason text default null,
  p_appeal_id uuid default null,
  p_report_id uuid default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.review_moderation(
    p_target_type, p_target_id, p_action, p_reason, p_appeal_id, p_report_id
  );
$$;

revoke all on function public.review_moderation(text, uuid, text, text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.review_moderation(text, uuid, text, text, uuid, uuid)
  to authenticated;

comment on function public.review_moderation(text, uuid, text, text, uuid, uuid) is
  'Invoker RPC wrapper for staff moderation. Authorization and privileged writes are handled in private.review_moderation.';
