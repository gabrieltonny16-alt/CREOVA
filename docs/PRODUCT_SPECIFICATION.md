# CREOVA — Master Product Specification

**Status:** Product direction approved; implementation scope defined  
**Product:** CREOVA  
**Platforms:** Android and Web  
**Product category:** Social networking, short-form video, creator tools, communities, and active-skill execution  
**Working branch:** `product/full-social-platform-spec`  
**Starting codebase:** `feature/moderation-foundation`

## 1. Product vision

CREOVA is one integrated social platform combining the broad social-networking capabilities people expect from Instagram, the short-form video and creator capabilities people expect from TikTok, and CREOVA's own execution-centered identity.

The product is inspired by familiar user experiences, but all code, visual identity, recommendation logic, and implementation must be original. Do not copy proprietary source code, protected branding, or assets.

**CREOVA's core loop:** ACTION → EXECUTION → EVOLUTION → PROOF → DISCOVERY.

The platform must support both casual social participation and deeper creation, collaboration, and skill development. The Anchor/Iteration system is a first-class product pillar, not a separate app.

## 2. Product principles

1. Real functionality only: no dead controls, fake activity, simulated messaging, or demo data presented as live.
2. Preserve existing working code, migrations, and project configuration.
3. Android and Web share identity, data contracts, permissions, and backend services.
4. Privacy and security are enforced server-side; client-side checks are never the security boundary.
5. Media, messaging, LIVE, payments, advertising, and commerce integrations must be built with provider-appropriate controls and explicit owner approval before any paid or live activation.
6. Ship in tested increments. A feature is not complete because its screen renders.
7. Build for accessibility, localization, low-bandwidth conditions, and progressive enhancement.
8. Never claim a test, migration, deployment, or integration succeeded unless its result has been verified.

## 3. Product surfaces and navigation

### Android application
- Home feed
- Reels / short-video feed
- Create
- Explore / Search
- Inbox
- Notifications
- Profile
- Stories viewer and composer
- LIVE viewer / creator studio when enabled
- CREOVA Anchors and Iteration trees
- Settings, privacy, safety, and account management

### Web application
- Responsive social experience
- Creator Studio and analytics
- Profile and publishing tools
- Messaging and notifications
- Explore and search
- Anchor / Iteration workspaces
- Business and advertiser tools
- Staff moderation and platform administration

Navigation may adapt by device, but must not create separate identities or duplicate content systems.

## 4. Functional scope

### 4.1 Identity, accounts, and profiles
- Email and phone registration where configured; secure sign-in and sign-out.
- Password reset, email/phone verification, session management, and optional MFA.
- Unique usernames, display names, avatars, bios, links, profile categories, and profile editing.
- Personal, creator, and business account modes.
- Public/private profiles and follow requests.
- Followers, following, mutual connections, account switching, and account deactivation/deletion.
- Verification application and review workflow; verification is never automatically granted.
- Profile grids, tagged content, saved collections, highlights, and creator/business contact controls.

### 4.2 Social graph and feed
- Follow, unfollow, follow requests, remove follower, block, mute, and restrict.
- Home feed with ranked and chronological/following options.
- Photo, single-video, and multi-item carousel posts.
- Captions, alt text, mentions, hashtags, topic tags, and optional location tags.
- Like/unlike, comments, threaded replies, reactions, pinning, editing, and deletion.
- Reposts/shares, bookmarks, collections, and post-level privacy/audience controls.
- Collaborative posts and tagged contributors.
- Drafts, scheduled publishing, post archives, and content insights.
- Feed controls: hide, not interested, unfollow, snooze, and explain/retrain recommendations.

### 4.3 Stories
- Photo/video stories with a configurable 24-hour lifetime.
- Story viewer, progress, navigation, reactions, replies, and sharing controls.
- Audience selection, close-friends lists, hide-story controls, and reply permissions.
- Stickers and interactive elements: polls, questions, quizzes, countdowns, links, and mentions.
- Story drafts, archive, highlights, and highlight cover management.
- Expiry and deletion must be enforced server-side.

### 4.4 Short-form video and Reels
- Full-screen vertical swipe feed with preloading and adaptive playback.
- For You / recommended and Following feeds.
- Video capture/upload, trim, clip sequencing, crop, cover selection, captions, text overlays, voiceover, speed, and basic transitions.
- Filters/effects and audio attachment, subject to licensing and provider terms.
- Original sounds, sound discovery, saved sounds, and audio attribution.
- Duet/split-screen, stitch/remix, video reply, and creator attribution.
- Likes, comments, shares, reposts, saves, playlists, hashtags, topics, and content controls.
- Drafts, upload progress, processing status, transcoding, thumbnails, and playback quality selection.
- Content reporting, copyright complaints, age/audience controls, and creator analytics.

### 4.5 Live streaming
- Creator eligibility and account standing checks.
- Stream creation, preview, scheduling, start/end, and stream health.
- Viewer playback, real-time chat, moderation tools, pinned messages, co-host/guest participation, and audience controls.
- Gifts/rewards and subscriptions only after legal, provider, fraud, tax, and payout requirements are satisfied.
- Replay policy, reporting, safety escalation, and stream interruption handling.
- LIVE is a separately gated capability; no paid streaming provider may be activated without approval.

### 4.6 Direct messaging and calls
- One-to-one and group conversations.
- Text, images, videos, files, links, voice notes, reactions, replies, forwarding, and shared media.
- Message requests, inbox filtering, group roles, invite links, and group moderation.
- Read receipts, typing indicators, presence controls, and notification preferences.
- Edit/delete/unsend rules, retention settings, spam controls, and abuse reporting.
- Audio/video calling where supported by an approved real-time provider.
- End-to-end encryption is a distinct security project requiring reviewed key management, recovery, multi-device behavior, and abuse/reporting design; do not label ordinary transport encryption as E2EE.

### 4.7 Search, Explore, and recommendations
- Search people, posts, videos, hashtags, topics, sounds, and Anchors.
- Search suggestions, recent searches, filters, and history controls.
- Explore categories, trending content, creator discovery, and topic pages.
- Separate recommendation surfaces for general posts, short video, and CREOVA execution content.
- Ranking signals must be documented, privacy-aware, and tunable.
- User controls: not interested, hide, block, mute, reset/retrain recommendations, and sensitive-content settings.
- Safety, integrity, freshness, diversity, and creator distribution constraints must be considered alongside engagement.

### 4.8 Notifications
- In-app and push notifications for follows, requests, likes, comments, mentions, messages, LIVE events, creator updates, safety actions, and account security.
- Notification preferences by category and channel.
- Deduplication, batching, quiet hours, deep links, delivery status, and device-token management.
- No external messaging campaigns without explicit approval.

### 4.9 Creator Studio and monetization
- Creator dashboard, content library, drafts, scheduling, and publishing status.
- Analytics for views, reach, watch time, retention, engagement, audience, and follower growth.
- Brand collaboration discovery, partnership requests, sponsored-content labels, and campaign reporting.
- Subscriptions, gifts, tips, affiliate links, and revenue reporting as optional modules.
- Eligibility, fraud controls, payout identity checks, tax/compliance workflows, dispute handling, and audit trails.
- Monetization remains disabled until provider, legal, and owner approvals are complete.

### 4.10 Business, advertising, and commerce
- Business profiles, contact actions, catalogues, product tagging, and business insights.
- Ad accounts, campaign creation, budgets, targeting controls, creative review, reporting, and billing integration.
- Sponsored-content disclosure and ad transparency.
- Shopping surfaces, merchant catalogues, orders, refunds, and payment integrations as separately gated modules.
- No live charges, payment processing, or paid advertising without explicit approval.

### 4.11 CREOVA original system
- **Anchor:** a public or private starting point for an idea, skill, challenge, project, or contribution.
- **Iteration:** a contribution that extends, improves, remixes, or responds to an Anchor or another Iteration.
- **Execution Tree:** the parent/child graph and chronological history of related work.
- **Tap to Iterate:** a clear action to create a new Iteration from eligible content.
- **Proof of Execution:** evidence, milestones, media, links, or outcomes attached to an Iteration.
- **Evolution Profile:** a view of a person's skills, contributions, progress, and completed work.
- **Skill Graph:** user-declared and evidence-supported skills with privacy and dispute controls.
- **Collaborative Evolution:** multiple contributors, attribution, roles, and contribution history.
- **Execution analytics:** progress, iteration depth, completion, collaboration, and outcomes.
- Preserve attribution and provenance across remixes and descendants; allow creators to set reuse permissions.

### 4.12 Safety, moderation, and trust
- User reports for accounts, posts, comments, messages, Anchors, Iterations, and LIVE sessions.
- Block, mute, restrict, hidden words, comment controls, and privacy settings.
- Automated detection as assistive triage, with human review for consequential actions.
- Configurable thresholds, temporary holds, moderator queues, staff permissions, appeals, and overturn/uphold decisions.
- Append-only moderation audit trail with actor, action, reason, timestamp, and target.
- Copyright/IP complaint and counter-notice workflows.
- Spam, impersonation, bot, scam, and coordinated-abuse detection.
- Age-appropriate experiences, sensitive-content controls, and regional legal compliance.
- Clear policy explanations and appeal status for affected users.

### 4.13 Administration and operations
- Staff roles and least-privilege permissions.
- User, content, report, appeal, and LIVE moderation queues.
- Audit logs, operational dashboards, feature flags, rate limits, and abuse monitoring.
- Data export/deletion workflows and retention controls.
- Service health, error reporting, job queues, media processing status, and incident controls.
- Emergency pause/kill switches for uploads, messaging, LIVE, payments, and recommendations.

## 5. Technical direction

### Verified starting point
The inspected `feature/moderation-foundation` branch documents and contains a React 19 + TypeScript + Vite client using Supabase. It includes account flows, Anchor creation/listing, and moderation UI. Its README documents six migrations applied to the linked Supabase project. These claims must be re-verified against the live project and actual files before further schema changes.

### Architecture principles
- Keep the current React/Vite client while the code audit confirms it remains suitable.
- Supabase Auth for identity, PostgreSQL for relational data, Row Level Security for authorization, and Storage for media if its configuration and policies pass review.
- Use database migrations as the source of truth; never edit production schema manually without a migration.
- Use Edge Functions or a separately deployed service for privileged operations, media orchestration, webhooks, and integrations.
- Use background jobs for transcoding, notifications, feed materialization, and moderation processing.
- Use a dedicated real-time approach for chat/presence and a video pipeline/CDN for large-scale playback when justified.
- Store media metadata and ownership in the database; store media binaries in object storage.
- Keep service-role keys and all privileged secrets off clients.
- Add observability, backups, restore tests, rate limits, and security review before public launch.

### Core data domains
Users/profiles; sessions/devices; follows/blocks/mutes; posts/media/carousels; stories/highlights; videos/sounds/effects; likes/comments/reactions; hashtags/topics; saves/collections; conversations/members/messages/attachments; notifications; reports/moderation actions/appeals; Anchors/Iterations/iteration edges/proof assets/skills; creator analytics; businesses/catalogues/ads/orders; LIVE sessions/chat; audit events; feature flags.

## 6. Delivery roadmap

### Phase 0 — Repository and service audit
- Inspect all branches, source files, migrations, Supabase project state, environment-variable names, deployment configuration, and existing tests.
- Identify which code is complete, partial, broken, or only documented.
- Verify migration history and RLS policies before changing schema.
- Produce an inventory and dependency map. No destructive changes.

### Phase 1 — Product foundation
- Confirm design system, navigation, routing, account lifecycle, profile model, privacy settings, and shared API/data contracts.
- Establish test, preview, and production environments.
- Establish CI, branch protections, migration review, and secrets handling.

### Phase 2 — Social core
- Profiles, follows, blocks/mutes, feed, photo/video posts, carousels, likes, comments, saves, search, and notifications.

### Phase 3 — Stories and short video
- Stories, archives/highlights, video upload/processing/playback, Reels feed, audio attribution, editing, playlists, duet/stitch/remix.

### Phase 4 — Messaging and communities
- Direct/group messaging, attachments, voice notes, message requests, presence, calls, group controls, and community spaces.

### Phase 5 — Discovery and creator studio
- Explore/search, recommendations, creator analytics, scheduling, brand tools, and audience controls.

### Phase 6 — CREOVA execution engine
- Anchor/Iteration creation, execution tree, Tap to Iterate, proof assets, collaboration, skill graph, and evolution profiles.

### Phase 7 — LIVE, business, and monetization
- LIVE infrastructure, business tools, advertising, subscriptions, gifts, commerce, and payouts. Each requires separate approval and readiness review.

### Phase 8 — Safety, scale, and launch
- Moderation expansion, copyright, fraud, privacy compliance, accessibility, localization, load testing, security testing, backups, incident response, and staged rollout.

## 7. Definition of done

Every feature must pass:
1. UI and interaction tests on supported Android and Web viewports.
2. Backend/API behavior tests.
3. Database persistence and migration tests.
4. RLS/authorization tests for owner, follower, non-follower, blocked, and staff roles as applicable.
5. Validation, error, retry, and offline/poor-network behavior.
6. Accessibility and performance checks.
7. Integration tests with dependent features.
8. Security and abuse-case review where user data or public content is involved.
9. Verified deployment/configuration in the intended environment.

A feature is **not complete** if it uses hard-coded demo records, fake success states, placeholder buttons, or bypasses server-side authorization.

## 8. Initial execution tasks

1. Audit every branch and compare the moderation foundation with main.
2. Verify the six documented migrations, actual migration files, and live Supabase migration history.
3. Locate and run the existing moderation tests; capture real results.
4. Inventory existing components and routes, including the current Anchor and moderation experience.
5. Record the gaps against this specification.
6. Propose the smallest safe next implementation slice and its tests.
7. Only then begin feature implementation on a dedicated branch.

## 9. Explicit non-goals for the first release

- Do not attempt to ship every advanced capability in one release.
- Do not activate paid vendors, payment processing, ad billing, or external messaging without approval.
- Do not promise licensed music, E2EE, LIVE gifts, or commerce before the required rights, providers, and security work exist.
- Do not sacrifice safety, privacy, reliability, or attribution to imitate engagement mechanics.

**North-star outcome:** CREOVA feels like a complete, familiar social platform for connection and entertainment while making creation, execution, evolution, and proof uniquely central.
