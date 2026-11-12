-- Record the indexes already applied to CREOVA-DEV.
-- These indexes support joins and deletes on the user foreign keys for social reactions.
create index if not exists comment_reactions_user_id_idx
  on public.comment_reactions using btree (user_id);

create index if not exists story_reactions_user_id_idx
  on public.story_reactions using btree (user_id);
