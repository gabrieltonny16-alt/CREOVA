# CREOVA — Product Specification

**Status:** Approved direction; implementation begins from a clean application baseline.  
**Platforms:** Android and Web.  
**Product:** A complete social networking and creator platform with CREOVA's own execution and evolution system.

## Vision

CREOVA brings together three connected experiences: a full social network, a short-form entertainment and creator platform, and an original creation/execution network. Build original code, product design, algorithms, and visual identity. Use common interaction patterns as inspiration; do not copy proprietary source code, trademarks, or protected assets.

## Product requirements

### 1. Accounts and profiles
Registration and login; email/phone verification where configured; password recovery; sessions and optional MFA; public/private accounts; profile editing; avatars, bios, links; personal/creator/business modes; account switching; follow requests; verification review; deactivation and deletion.

### 2. Social graph
Follow/unfollow; follower/following lists; mutual connections; remove follower; block, mute, restrict; close-friends and audience lists; privacy controls.

### 3. Feed and publishing
Personalized and chronological feeds; photo posts; single videos; carousels; captions; alt text; hashtags; mentions; topic/location tags; likes; comments and threaded replies; reactions; pins; reposts; sharing; bookmarks; collections; collaborative posts; drafts; scheduled publishing; archives; post insights.

### 4. Stories
Temporary photo/video stories; viewer; reactions and replies; audience controls; close friends; stickers; polls; questions; quizzes; countdowns; links; mentions; archives; highlights; expiry enforcement.

### 5. Short-form video
Vertical swipe feed; For You and Following; capture and upload; multi-clip creation; trim/cut/merge; cover selection; captions and overlays; voiceover; speed and transitions; filters/effects; original audio and licensed sounds; audio attribution; duet/split-screen; stitch/remix; video replies; playlists; reposts; favourites; creator analytics; reporting and age/audience controls.

### 6. LIVE
Creator eligibility; stream setup and preview; playback; real-time chat; co-hosting; moderation; stream health; replays; reporting. Gifts, paid subscriptions, and payouts require provider, legal, fraud, tax, and owner approval.

### 7. Messaging and communication
One-to-one and group chats; text, media, files, voice notes, reactions, replies, forwarding; message requests; group roles; read receipts; typing and presence controls; editing/deletion; spam controls; reporting; audio/video calls where supported. End-to-end encryption must be separately designed and reviewed before being claimed.

### 8. Search and discovery
Search people, posts, videos, hashtags, topics, sounds, and Anchors; suggestions and filters; Explore; trends; creator discovery; recommendation controls; hide/not-interested; reset/retrain preferences; diversity, safety, freshness, and privacy-aware ranking.

### 9. Notifications
In-app and push notifications; follows, requests, likes, comments, mentions, messages, LIVE events, creator updates, safety/security alerts; per-category preferences; deduplication; batching; quiet hours; deep links.

### 10. Creator and business tools
Creator Studio; drafts and scheduling; performance analytics; audience insights; collaboration requests; sponsorship disclosures; business profiles; catalogues; product tagging; campaigns; ad reporting; affiliate and commerce capabilities. Billing, ads, commerce, subscriptions, and payouts remain gated until separately approved.

### 11. CREOVA original system
- **Anchor:** original idea, objective, challenge, skill, or creation.
- **Iteration:** attributable contribution that develops an Anchor or another Iteration.
- **Execution Tree:** connected parent/child history and provenance.
- **Tap to Iterate:** create a permitted new contribution from eligible content.
- **Proof of Execution:** attach evidence, milestones, media, links, or outcomes.
- **Evolution Profile:** display a person's progress and contributions.
- **Skill Graph:** connect demonstrated and self-declared skills with privacy/dispute controls.
- **Collaborative Evolution:** multiple contributors, roles, and contribution history.
- **Execution Analytics:** progress, completion, iteration depth, collaboration, and outcomes.

### 12. Safety and administration
Reports; blocking and privacy controls; automated triage with human review; moderation queues; staff roles; appeals; audit logs; copyright/IP processes; spam, impersonation and fraud controls; age-appropriate experiences; data export/deletion; retention controls; operational dashboards; emergency feature pause switches.

## Platform architecture direction

- Android and Web clients with shared contracts and identity.
- PostgreSQL relational data and server-enforced authorization.
- Auth provider with secure session lifecycle and MFA support.
- Object storage for media binaries; relational metadata in database.
- Background processing for video transcoding, thumbnails, notifications, moderation, and feed tasks.
- Real-time messaging/presence infrastructure.
- CDN/adaptive video delivery as scale and budget require.
- Observability, backups, restore tests, rate limits, secrets management, and staged deployment.

The existing Supabase project may be retained as infrastructure only after security/configuration review. Do not reuse old application tables or apply destructive production migrations during this clean rebuild. Design a new versioned schema and isolated development environment first.

## Delivery phases

0. Clean baseline, repository setup, environment strategy, CI, architecture and threat model.
1. Design system, navigation, authentication integration, profiles, privacy and social graph.
2. Posts, feed, likes, comments, sharing, saves, search and notifications.
3. Stories, media upload pipeline, vertical video playback and creator tools.
4. Messaging, groups, communities and real-time services.
5. Explore, search and recommendation systems.
6. Anchor/Iteration engine, execution tree, proof, collaboration and skill graph.
7. LIVE, business, ads, commerce and monetization behind approval gates.
8. Moderation, security, accessibility, localization, performance and launch readiness.

## Definition of done

A feature is complete only when UI, API, persistence, server-side authorization, validation, failure/retry handling, accessibility, Android/Web behavior, integration tests, and relevant security/abuse tests pass. No placeholder buttons, hard-coded demo records, or fake success states may be represented as complete.
