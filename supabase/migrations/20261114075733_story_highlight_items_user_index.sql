-- Cover the story_highlight_items.user_id foreign key for efficient owner cleanup and lookups.
create index story_highlight_items_user_id_idx on public.story_highlight_items(user_id);
