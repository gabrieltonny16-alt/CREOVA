# CREOVA infrastructure audit — 2026-11-27

Project inspected: `CREOVA-DEV` (`dnbkxtqnojjsntxteuqu`)
Repository branch inspected: `creova/clean-foundation`
Scope: read-only inspection. No Supabase schema, policy, bucket, publication, or function was changed.

## Database

- 23 tables in the exposed `public` schema.
- All 23 currently have Row Level Security enabled.
- Existing policy sets cover identity/profiles, follows, posts, media metadata, likes, comments, reposts, saves, comment reactions, stories/highlights/views/replies/reactions, conversations/members/messages/reactions, notifications, notification preferences, presence settings, and push-token records.
- Most policies are scoped to `authenticated` and include ownership, participant, follow, or visibility checks. Table existence and policy presence do not prove each application workflow or every policy edge case is correct; targeted allow/deny tests remain required.
- **Least-privilege finding:** the `anon` role still has broad table grants on seven tables: `notification_preferences`, `stories`, `story_highlight_items`, `story_highlights`, `story_reactions`, `story_replies`, and `story_views`. No anon policies were found in the public policy inventory, so RLS currently denies anon row access, but the grants should be narrowed to only intended operations. Do not change until a migration and explicit anonymous-access decision are reviewed.

## Storage

Five buckets exist:
- `creova-media` — private, 50 MiB limit, image/video MIME allowlist.
- `creova-stories` — private, 50 MiB limit, image/video MIME allowlist.
- `creova-highlights` — private, 50 MiB limit, image/video MIME allowlist.
- `creova-chat-media` — private, 25 MiB limit, image/video/audio MIME allowlist.
- `profile-avatars` — public, 5 MiB limit, JPEG/PNG/WebP allowlist.

There are 15 policies on `storage.objects`. They scope post media to owned posts and visible posts, story media to story visibility/expiry, highlights to visible highlights, chat attachments to conversation membership, and avatar writes to the user's own folder. Public avatar delivery is intentionally world-readable by URL; never place private media in that bucket. Supabase documents that public buckets bypass read access controls for file retrieval, while private buckets require policy-checked access or signed URLs.

## Realtime

The `supabase_realtime` publication currently contains only:
- `conversation_members`
- `conversation_message_reactions`
- `conversation_messages`
- `notifications`

Posts, follows, stories and other feed surfaces are not currently in the Postgres Changes publication. Realtime subscriptions for those surfaces must be designed deliberately. For private or sensitive events, evaluate private Broadcast channels and authorization rather than broadly publishing tables. Supabase recommends Broadcast for scalability/security in many cases; Postgres Changes is simpler but has per-subscriber RLS authorization costs.

## Edge Functions

One active Edge Function was listed: `luxora-otp`. It is not treated as a CREOVA social-platform backend and must not be reused for CREOVA features without a separate security and ownership review.

## Client/repository

- App currently renders Home/Create through `FeedScreen`.
- Explore and Inbox are explicitly placeholder panels.
- Profile is a basic session/account panel, not a social profile.
- Existing feed supports text posts, following filter, likes and comments at code level; full device and authorization acceptance is still outstanding.
- The current Expo app dependencies do not yet include a media picker, video player/editor, or a realtime-specific feature layer. Package additions must be checked for Expo SDK 58 compatibility and committed with a real generated lockfile.

## Required next actions

1. Create a least-privilege migration to revoke unnecessary `anon` grants on the seven tables, after confirming no anonymous use case requires them. Keep intended signed-in grants and RLS policies intact.
2. Add automated RLS allow/deny tests for every exposed table and storage bucket, including cross-user access attempts.
3. Build shared media upload/playback services against the existing private buckets and storage paths. Never put service-role keys in the app.
4. Implement Explore, Profile, Stories, media publishing, Inbox and messaging surfaces against existing schema; inspect each table's full columns and constraints before writing client code.
5. Add realtime subscriptions selectively; test private conversation membership and notification recipient isolation.
6. Keep all provider activation, live email/push delivery, payment processing and paid infrastructure gated behind explicit approval.

## Documentation references checked

- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
- [Supabase Storage buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals)
- [Supabase Realtime Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)
- [Supabase Realtime authorization](https://supabase.com/docs/guides/realtime/authorization)
- [Supabase subscribing to database changes](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes)
