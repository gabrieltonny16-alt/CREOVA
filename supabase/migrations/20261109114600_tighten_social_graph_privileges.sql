-- Tighten social-graph access for the authenticated CREOVA app.

-- The app is gated behind authentication. Signed-out clients should not have
-- Data API privileges on these social tables; RLS alone is not a substitute
-- for least-privilege grants.
REVOKE ALL ON TABLE
  public.profiles,
  public.user_follows,
  public.posts,
  public.post_media,
  public.post_likes,
  public.post_comments
FROM anon;

-- Follow recipients may change only the request status. This prevents an
-- authenticated recipient from rewriting follower_id/following_id or
-- timestamps while approving/rejecting an incoming request.
REVOKE UPDATE ON TABLE public.user_follows FROM authenticated;
GRANT UPDATE (status) ON TABLE public.user_follows TO authenticated;

-- A user cannot follow their own account, even through a direct API request.
ALTER TABLE public.user_follows
  ADD CONSTRAINT user_follows_no_self_follow
  CHECK (follower_id <> following_id);
