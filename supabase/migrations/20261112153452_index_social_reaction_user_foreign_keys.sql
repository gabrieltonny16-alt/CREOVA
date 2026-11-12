-- Index the user/sender foreign keys used by reactions and story activity.
-- These indexes support participant lookups and efficient referenced-row checks.
create index if not exists comment_reactions_user_id_idx
  on public.comment_reactions (user_id);

create index if not exists story_reactions_user_id_idx
  on public.story_reactions (user_id);

create index if not exists story_replies_sender_id_idx
  on public.story_replies (sender_id);

create index if not exists story_views_viewer_id_idx
  on public.story_views (viewer_id);
