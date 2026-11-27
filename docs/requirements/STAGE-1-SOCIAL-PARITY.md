# CREOVA Stage 1 — Instagram + TikTok feature parity

Status: BUILDING
Branch: `creova/clean-foundation`
Scope: one coordinated Stage 1 product milestone. This inventory groups implementation work; it does not imply the features are already built.

## Delivery rule

Build the complete connected feature foundation before moving to Stage 2. Work may be implemented in coherent internal modules and reviewed continuously, but do not present isolated screens as completion. Every capability must have working persistence, authorization, loading/empty/error states, accessibility, and acceptance tests. Do not use mock data as proof of functionality.

## Product surfaces and requirements

### Identity, accounts and profiles
- AUTH-01 Registration, email verification, sign-in/out, recovery, session restore, account deletion and secure credential changes.
- PROF-01 Editable profile: name, unique handle, bio, avatar, links, pronouns optional, location optional, creator category optional.
- PROF-02 Public/private accounts, follow requests, block, mute, restrict, remove follower and profile visibility controls.
- PROF-03 Profile grids and tabs for posts, short videos, tagged content and saved/private content with correct permissions.

### Publishing and media
- PUB-01 Text, single photo, multi-photo carousel, video and mixed-media posts.
- PUB-02 Drafts, edit/delete, captions, mentions, hashtags, alt text, location opt-in, audience and comment controls.
- MEDIA-01 Secure media selection, upload progress, retry/resume, validation, thumbnail generation and playback.
- MEDIA-02 Video processing pipeline for formats, resolutions, aspect ratios, duration limits, poster frames and adaptive playback.
- STORY-01 Stories with image/video, text/stickers, audience controls, view list, replies, reactions, expiry and highlights.
- VIDEO-01 Short-form vertical video feed, swipe navigation, playback controls, captions, sounds/audio attribution, effects and editing workflow.
- VIDEO-02 Creator editing tools: trim, split, reorder, speed, cover, text overlays, captions, audio mix and draft save. Advanced effects require a verified compatible processing path.

### Feed, discovery and interactions
- FEED-01 Personalized and Following feeds, pagination, refresh, ranking signals and content eligibility.
- DISC-01 Search across people, posts, hashtags, audio and topics; suggestions and recent searches.
- DISC-02 Explore, topic pages, trending surfaces and recommendation explanations.
- SOCIAL-01 Likes, comments, threaded replies, mentions, repost/share, saves/collections and view counts where appropriate.
- SOCIAL-02 Follow graph, follower/following lists, recommendations and relationship state.
- LIVE-01 Live video sessions, host/co-host, audience join, chat, moderation, reactions, scheduling and replay where supported.

### Messaging and notifications
- MSG-01 One-to-one and group conversations, message requests, text, media, replies, reactions, forwarding, deletion and read state.
- MSG-02 Realtime delivery, reconnect/offline queue, typing/presence and push notification integration.
- NOTIF-01 In-app notifications and user-configurable push/email preferences for follows, interactions, messages and account events.

### Creator and business capabilities
- CREATOR-01 Professional/creator tools, content management, drafts, scheduling and publishing status.
- CREATOR-02 Analytics for reach, impressions, watch time, retention, engagement and audience, with clear metric definitions.
- CREATOR-03 Monetization eligibility, payouts, subscriptions, branded content and commerce are staged behind compliance, provider and explicit business approvals; never simulate money movement.
- BUSINESS-01 Business profile/contact/action surfaces, catalog/product tagging and campaign tools where supported.

### Safety, privacy and platform controls
- SAFE-01 Report content/accounts/messages, block, mute, restrict, comment filters, keyword filters and appeal/status flows.
- SAFE-02 Moderation queues, policy enforcement, evidence retention, rate limits, spam/abuse detection and audit trail.
- PRIV-01 Granular audience, activity, messaging, tagging, mention, discoverability and data controls.
- PRIV-02 Data export, account deactivation/deletion and retention handling.
- TRUST-01 Age-appropriate safeguards, consent and jurisdiction-aware compliance before public launch.

### Platform quality
- QLTY-01 Accessible controls, screen-reader labels, contrast, dynamic text, captions and reduced-motion support.
- QLTY-02 Responsive compact layouts for small Android phones, tablets and web.
- QLTY-03 Low-bandwidth modes, upload retry, caching, graceful offline and resilient realtime reconnect.
- QLTY-04 Observability for errors, failed requests, upload/processing failures, performance and abuse.
- QLTY-05 Automated unit, integration, authorization/RLS, end-to-end and device acceptance tests.

## Architecture workstreams (integrated)
1. Data contracts and migrations: schema, constraints, indexes, RLS, storage policies and migration rollback.
2. Media infrastructure: private/public buckets, signed access, upload orchestration, processing and delivery.
3. Shared app foundation: navigation, session-aware data layer, design system, error/loading patterns and deep links.
4. Social graph and content: profiles, follows, posts, feed, interactions, discovery and search.
5. Stories and short video: media pipeline, player, editing/publishing and ranking.
6. Messaging and realtime: conversations, delivery, presence, notifications and push.
7. Creator/business: analytics, publishing tools and gated monetization.
8. Trust and safety: reporting, moderation, privacy, abuse controls and audit.
9. Quality: accessibility, performance, security review and automated acceptance coverage.

## Dependency order

- Establish schema and RLS contracts before wiring clients.
- Establish media storage and processing before photo/video/stories/reels publishing.
- Establish follows and permissions before Following feed, private profiles and message requests.
- Establish realtime and notification contracts before messaging/live notifications.
- Establish moderation and privacy controls alongside each publishing and messaging surface, not after public launch.
- Monetization and live provider integrations remain gated; no paid provider, production messaging, payments or external service activation without explicit user approval.

## Acceptance and honest status

A requirement is VERIFIED only when:
- the actual UI action works on supported devices;
- data persists and reloads correctly;
- authorization/RLS prevents cross-user access;
- loading, empty, offline, error and retry states are handled;
- accessibility and responsive checks pass;
- automated tests and relevant manual acceptance evidence are recorded.

A feature is NOT VERIFIED if it is a placeholder, static screen, mocked interaction, untested provider integration or merely typechecks.

## Current verified repository baseline (as of 2026-11-27)

- Expo/React Native application shell and five-tab navigation exist.
- Supabase Auth client integration and account screens exist; end-to-end device flows remain unverified.
- A first text-post feed implementation is committed; its full runtime/security acceptance remains unverified.
- Explore and Inbox are currently placeholder panels; Profile is a basic session/account panel.
- Photo/video media, stories, short-form video editing/player, live, messaging, creator analytics and moderation workflows are not yet implemented in the app.
- Existing database tables must be inspected and mapped before adding migrations; do not assume a table's existence means the client workflow or RLS is correct.

## Stage 1 exit gate

Do not begin Stage 2 (systematically fixing incumbent-platform weaknesses) until the requirements above have been implemented to the agreed scope, tested, security-reviewed and evidenced. This is a feature-parity target, not a claim that every proprietary Instagram/TikTok internal system can be duplicated.
