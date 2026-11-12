-- Cover notification foreign keys for cascade operations and actor lookups.
create index if not exists notifications_actor_created_idx
  on public.notifications (actor_id, created_at desc);
create index if not exists notifications_post_id_idx
  on public.notifications (post_id)
  where post_id is not null;
create index if not exists notifications_comment_id_idx
  on public.notifications (comment_id)
  where comment_id is not null;