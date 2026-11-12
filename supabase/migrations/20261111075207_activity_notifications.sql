-- CREOVA activity notifications. Additive migration for CREOVA-DEV only.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  notification_type text not null check (notification_type in (
    'follow_request', 'new_follower', 'follow_accepted',
    'post_like', 'post_comment', 'comment_reply', 'post_repost'
  )),
  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.post_comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint notifications_no_self_activity check (recipient_id <> actor_id)
);

create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);
create index if not exists notifications_unread_recipient_idx
  on public.notifications (recipient_id, created_at desc)
  where read_at is null;

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy notifications_select_recipient
on public.notifications for select to authenticated
using (recipient_id = (select auth.uid()));

create policy notifications_update_recipient
on public.notifications for update to authenticated
using (recipient_id = (select auth.uid()))
with check (recipient_id = (select auth.uid()));

create policy notifications_delete_recipient
on public.notifications for delete to authenticated
using (recipient_id = (select auth.uid()));

-- Trigger-only writers. SECURITY DEFINER is narrowly scoped, uses an empty
-- search_path, qualifies every object, and validates the acting user.
create or replace function public.creova_notify_follow_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.follower_id = auth.uid() and new.follower_id <> new.following_id then
      if new.status = 'pending' then
        insert into public.notifications (recipient_id, actor_id, notification_type)
        values (new.following_id, new.follower_id, 'follow_request');
      elsif new.status = 'accepted' then
        insert into public.notifications (recipient_id, actor_id, notification_type)
        values (new.following_id, new.follower_id, 'new_follower');
      end if;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.status = 'pending'
     and new.status = 'accepted'
     and new.following_id = auth.uid()
     and new.follower_id <> new.following_id then
    insert into public.notifications (recipient_id, actor_id, notification_type)
    values (new.follower_id, new.following_id, 'follow_accepted');
  end if;
  return new;
end;
$$;

create or replace function public.creova_notify_post_like()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_author_id uuid;
begin
  if new.user_id <> auth.uid() then
    raise exception 'Invalid activity actor';
  end if;
  select author_id into v_author_id from public.posts where id = new.post_id;
  if v_author_id is not null and v_author_id <> new.user_id then
    insert into public.notifications (recipient_id, actor_id, notification_type, post_id)
    values (v_author_id, new.user_id, 'post_like', new.post_id);
  end if;
  return new;
end;
$$;

create or replace function public.creova_notify_post_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post_author uuid;
  v_parent_author uuid;
begin
  if new.user_id <> auth.uid() then
    raise exception 'Invalid activity actor';
  end if;
  select author_id into v_post_author from public.posts where id = new.post_id;

  if new.parent_comment_id is not null then
    select user_id into v_parent_author
    from public.post_comments where id = new.parent_comment_id;
  end if;

  if v_post_author is not null and v_post_author <> new.user_id then
    insert into public.notifications (recipient_id, actor_id, notification_type, post_id, comment_id)
    values (
      v_post_author,
      new.user_id,
      case when new.parent_comment_id is null then 'post_comment' else 'comment_reply' end,
      new.post_id,
      new.id
    );
  end if;

  if v_parent_author is not null
     and v_parent_author <> new.user_id
     and v_parent_author is distinct from v_post_author then
    insert into public.notifications (recipient_id, actor_id, notification_type, post_id, comment_id)
    values (v_parent_author, new.user_id, 'comment_reply', new.post_id, new.id);
  end if;
  return new;
end;
$$;

create or replace function public.creova_notify_post_repost()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_author_id uuid;
begin
  if new.user_id <> auth.uid() then
    raise exception 'Invalid activity actor';
  end if;
  select author_id into v_author_id from public.posts where id = new.post_id;
  if v_author_id is not null and v_author_id <> new.user_id then
    insert into public.notifications (recipient_id, actor_id, notification_type, post_id)
    values (v_author_id, new.user_id, 'post_repost', new.post_id);
  end if;
  return new;
end;
$$;

revoke all on function public.creova_notify_follow_change() from public, anon, authenticated;
revoke all on function public.creova_notify_post_like() from public, anon, authenticated;
revoke all on function public.creova_notify_post_comment() from public, anon, authenticated;
revoke all on function public.creova_notify_post_repost() from public, anon, authenticated;

drop trigger if exists creova_follow_activity_notification on public.user_follows;
create trigger creova_follow_activity_notification
after insert or update of status on public.user_follows
for each row execute function public.creova_notify_follow_change();

drop trigger if exists creova_post_like_notification on public.post_likes;
create trigger creova_post_like_notification
after insert on public.post_likes
for each row execute function public.creova_notify_post_like();

drop trigger if exists creova_post_comment_notification on public.post_comments;
create trigger creova_post_comment_notification
after insert on public.post_comments
for each row execute function public.creova_notify_post_comment();

drop trigger if exists creova_post_repost_notification on public.post_reposts;
create trigger creova_post_repost_notification
after insert on public.post_reposts
for each row execute function public.creova_notify_post_repost();
