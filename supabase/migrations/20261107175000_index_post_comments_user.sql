-- Cover the post_comments.user_id foreign key for efficient user-scoped lookups.
create index if not exists post_comments_user_created_idx
  on public.post_comments (user_id, created_at desc);
