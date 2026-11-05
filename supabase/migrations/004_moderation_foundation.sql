-- CREOVA moderation foundation
-- Report, auto-hold, staff review, audit and appeals for Anchors and Iterations.

create schema if not exists private;

alter table public.anchors
  add column if not exists moderation_status text not null default 'visible'
  check (moderation_status in ('visible', 'held', 'removed'));

alter table public.iterations
  add column if not exists moderation_status text not null default 'visible'
  check (moderation_status in ('visible', 'held', 'removed'));

create index if not exists anchors_moderation_feed_idx
  on public.anchors (moderation_status, status, created_at desc);
create index if not exists iterations_moderation_feed_idx
  on public.iterations (anchor_id, moderation_status, created_at desc);

create table if not exists private.moderator_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('moderator', 'admin')),
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists private.moderation_settings (
  singleton boolean primary key default true check (singleton),
  auto_hold_threshold integer not null default 3 check (auto_hold_threshold between 2 and 20),
  updated_at timestamptz not null default now()
);

insert into private.moderation_settings (singleton, auto_hold_threshold)
values (true, 3)
on conflict (singleton) do nothing;

create table public.moderation_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('anchor', 'iteration')),
  target_id uuid not null,
  category text not null check (category in (
    'spam',
    'harassment',
    'hate_or_abuse',
    'violence_or_threats',
    'sexual_content',
    'self_harm',
    'misinformation',
    'impersonation',
    'other'
  )),
  details text not null default '' check (char_length(details) <= 1000),
  status text not null default 'open'
    check (status in ('open', 'in_review', 'dismissed', 'actioned')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 1000),
  created_at timestamptz not null default now()
);

create unique index moderation_reports_one_open_per_reporter_idx
  on public.moderation_reports (reporter_id, target_type, target_id)
  where status in ('open', 'in_review');

create index moderation_reports_queue_idx
  on public.moderation_reports (status, created_at);
create index moderation_reports_target_idx
  on public.moderation_reports (target_type, target_id, status);

create table public.moderation_appeals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('anchor', 'iteration')),
  target_id uuid not null,
  reason text not null check (char_length(trim(reason)) between 10 and 2000),
  status text not null default 'pending'
    check (status in ('pending', 'upheld', 'overturned')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 1000),
  created_at timestamptz not null default now()
);

create unique index moderation_appeals_one_pending_idx
  on public.moderation_appeals (user_id, target_type, target_id)
  where status = 'pending';

create index moderation_appeals_queue_idx
  on public.moderation_appeals (status, created_at);

create table public.moderation_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in (
    'auto_hold',
    'hold',
    'remove',
    'restore',
    'dismiss_report',
    'confirm_report',
    'overturn_appeal',
    'uphold_appeal'
  )),
  target_type text not null check (target_type in ('anchor', 'iteration')),
  target_id uuid not null,
  report_id uuid references public.moderation_reports(id) on delete set null,
  appeal_id uuid references public.moderation_appeals(id) on delete set null,
  reason text check (reason is null or char_length(reason) <= 1000),
  details jsonb not null default '{}'::jsonb
    check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);

create index moderation_audit_target_idx
  on public.moderation_audit_log (target_type, target_id, created_at desc);
create index moderation_audit_actor_idx
  on public.moderation_audit_log (actor_id, created_at desc);

alter table private.moderator_roles enable row level security;
alter table private.moderation_settings enable row level security;
alter table public.moderation_reports enable row level security;
alter table public.moderation_appeals enable row level security;
alter table public.moderation_audit_log enable row level security;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to anon, authenticated, service_role;

revoke all on table private.moderator_roles from public, anon, authenticated;
revoke all on table private.moderation_settings from public, anon, authenticated;
grant all on table private.moderator_roles, private.moderation_settings to service_role;

revoke all on table public.moderation_reports from public, anon, authenticated;
revoke all on table public.moderation_appeals from public, anon, authenticated;
revoke all on table public.moderation_audit_log from public, anon, authenticated;

grant select on public.moderation_reports, public.moderation_appeals,
  public.moderation_audit_log to authenticated;
grant insert (reporter_id, target_type, target_id, category, details)
  on public.moderation_reports to authenticated;
grant insert (user_id, target_type, target_id, reason)
  on public.moderation_appeals to authenticated;
grant all on public.moderation_reports, public.moderation_appeals,
  public.moderation_audit_log to service_role;

create or replace function private.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.moderator_roles mr
    where mr.user_id = (select auth.uid())
      and mr.role in ('moderator', 'admin')
  );
$$;

revoke all on function private.is_moderator() from public;
grant execute on function private.is_moderator() to anon, authenticated;

create or replace function private.set_target_moderation_status(
  p_target_type text,
  p_target_id uuid,
  p_status text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_rows integer;
begin
  if p_status not in ('visible', 'held', 'removed') then
    raise exception 'Invalid moderation status';
  end if;

  if p_target_type = 'anchor' then
    update public.anchors
      set moderation_status = p_status
      where id = p_target_id;
  elsif p_target_type = 'iteration' then
    update public.iterations
      set moderation_status = p_status
      where id = p_target_id;
  else
    raise exception 'Unsupported moderation target type';
  end if;

  get diagnostics changed_rows = row_count;
  return changed_rows > 0;
end;
$$;

revoke all on function private.set_target_moderation_status(text, uuid, text)
  from public, anon, authenticated;

create or replace function private.validate_moderation_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.reporter_id is distinct from (select auth.uid()) then
    raise exception 'A report must be submitted for the signed-in user';
  end if;

  if new.target_type = 'anchor' then
    if not exists (select 1 from public.anchors a where a.id = new.target_id) then
      raise exception 'The reported Anchor does not exist';
    end if;
  elsif new.target_type = 'iteration' then
    if not exists (select 1 from public.iterations i where i.id = new.target_id) then
      raise exception 'The reported Iteration does not exist';
    end if;
  else
    raise exception 'Unsupported moderation target type';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_moderation_report() from public, anon, authenticated;

create or replace function private.auto_hold_reported_target()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  threshold_value integer;
  reporter_count integer;
  did_hold boolean;
begin
  select s.auto_hold_threshold
    into threshold_value
    from private.moderation_settings s
    where s.singleton = true;

  select count(distinct r.reporter_id)
    into reporter_count
    from public.moderation_reports r
    where r.target_type = new.target_type
      and r.target_id = new.target_id
      and r.status in ('open', 'in_review');

  if reporter_count >= coalesce(threshold_value, 3) then
    did_hold := private.set_target_moderation_status(
      new.target_type, new.target_id, 'held'
    );

    if did_hold then
      insert into public.moderation_audit_log (
        actor_id, action, target_type, target_id, details
      ) values (
        null,
        'auto_hold',
        new.target_type,
        new.target_id,
        jsonb_build_object(
          'distinct_reports', reporter_count,
          'threshold', coalesce(threshold_value, 3)
        )
      );
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.auto_hold_reported_target() from public, anon, authenticated;

create or replace function private.validate_moderation_appeal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_owner uuid;
  target_status text;
begin
  if new.user_id is distinct from (select auth.uid()) then
    raise exception 'An appeal must be submitted for the signed-in user';
  end if;

  if new.target_type = 'anchor' then
    select a.creator_id, a.moderation_status
      into target_owner, target_status
      from public.anchors a
      where a.id = new.target_id;
  elsif new.target_type = 'iteration' then
    select i.creator_id, i.moderation_status
      into target_owner, target_status
      from public.iterations i
      where i.id = new.target_id;
  else
    raise exception 'Unsupported moderation target type';
  end if;

  if not found then
    raise exception 'The appealed contribution does not exist';
  end if;
  if target_owner is distinct from new.user_id then
    raise exception 'Only the contribution creator can appeal';
  end if;
  if target_status not in ('held', 'removed') then
    raise exception 'Only held or removed contributions can be appealed';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_moderation_appeal() from public, anon, authenticated;

drop trigger if exists validate_moderation_report_before_insert on public.moderation_reports;
create trigger validate_moderation_report_before_insert
  before insert on public.moderation_reports
  for each row execute function private.validate_moderation_report();

drop trigger if exists auto_hold_reported_target_after_insert on public.moderation_reports;
create trigger auto_hold_reported_target_after_insert
  after insert on public.moderation_reports
  for each row execute function private.auto_hold_reported_target();

drop trigger if exists validate_moderation_appeal_before_insert on public.moderation_appeals;
create trigger validate_moderation_appeal_before_insert
  before insert on public.moderation_appeals
  for each row execute function private.validate_moderation_appeal();

drop policy if exists "Active anchors are viewable" on public.anchors;
create policy "Visible anchors and owned or staff content"
  on public.anchors for select to anon, authenticated
  using (
    creator_id = (select auth.uid())
    or (select private.is_moderator())
    or (moderation_status = 'visible' and status = 'active')
  );

drop policy if exists "Iterations are viewable through visible anchors" on public.iterations;
create policy "Visible iterations and owned or staff content"
  on public.iterations for select to anon, authenticated
  using (
    creator_id = (select auth.uid())
    or (select private.is_moderator())
    or (
      moderation_status = 'visible'
      and exists (
        select 1
        from public.anchors a
        where a.id = iterations.anchor_id
          and (
            a.creator_id = (select auth.uid())
            or (a.status = 'active' and a.moderation_status = 'visible')
          )
      )
    )
  );

drop policy if exists "Users create valid iterations" on public.iterations;
create policy "Users create valid iterations"
  on public.iterations for insert to authenticated
  with check (
    creator_id = (select auth.uid())
    and exists (
      select 1
      from public.anchors a
      where a.id = iterations.anchor_id
        and a.status = 'active'
        and a.moderation_status = 'visible'
    )
  );

create policy "Reporters and staff can read moderation reports"
  on public.moderation_reports for select to authenticated
  using (
    reporter_id = (select auth.uid())
    or (select private.is_moderator())
  );

create policy "Signed-in users can submit their own reports"
  on public.moderation_reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));

create policy "Appeal owners and staff can read appeals"
  on public.moderation_appeals for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.is_moderator())
  );

create policy "Creators can submit their own appeals"
  on public.moderation_appeals for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Only moderators can read the audit log"
  on public.moderation_audit_log for select to authenticated
  using ((select private.is_moderator()));

revoke insert, update on public.anchors, public.iterations from authenticated;
grant insert (creator_id, title, description, skill) on public.anchors to authenticated;
grant update (title, description, skill, status) on public.anchors to authenticated;
grant insert (anchor_id, parent_iteration_id, creator_id, title, description)
  on public.iterations to authenticated;
grant update (anchor_id, parent_iteration_id, title, description)
  on public.iterations to authenticated;

create or replace function private.validate_iteration_parent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.anchors a
    where a.id = new.anchor_id
      and a.status = 'active'
      and a.moderation_status = 'visible'
  ) then
    raise exception 'Iterations must belong to a visible active Anchor';
  end if;

  if new.parent_iteration_id is not null and not exists (
    select 1
    from public.iterations parent
    where parent.id = new.parent_iteration_id
      and parent.anchor_id = new.anchor_id
      and parent.moderation_status = 'visible'
  ) then
    raise exception 'Parent Iteration must be visible and belong to the same Anchor';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_iteration_parent() from public, anon, authenticated;

create or replace function public.review_moderation(
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
    next_report_status := null;
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

revoke all on function public.review_moderation(text, uuid, text, text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.review_moderation(text, uuid, text, text, uuid, uuid)
  to authenticated;

comment on table public.moderation_reports is
  'User-submitted reports for CREOVA Anchors and Iterations. Status changes are staff-controlled.';
comment on table public.moderation_appeals is
  'Creator appeals for held or removed Anchors and Iterations.';
comment on table public.moderation_audit_log is
  'Append-only record of automated holds and staff moderation decisions.';
comment on column public.anchors.moderation_status is
  'Moderation visibility state; not directly writable by application users.';
comment on column public.iterations.moderation_status is
  'Moderation visibility state; not directly writable by application users.';
