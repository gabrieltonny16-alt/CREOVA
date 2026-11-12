-- Replace broad default table grants with the minimum privileges required by CREOVA.
-- RLS controls rows; SQL grants must also prevent TRUNCATE and other unnecessary operations.

revoke all privileges on table
  public.profiles,
  public.posts,
  public.post_media,
  public.post_likes,
  public.post_comments
from anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.posts to authenticated;
grant select, insert, update, delete on public.post_media to authenticated;
grant select, insert, delete on public.post_likes to authenticated;
grant select, insert, update, delete on public.post_comments to authenticated;
