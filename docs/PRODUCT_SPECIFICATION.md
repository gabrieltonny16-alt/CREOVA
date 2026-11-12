# CREOVA — Product Specification

**Status:** Current approved product direction.  
**Platforms:** Android and Web, with architecture that can expand to iOS and other clients.  
**Product:** A next-generation social platform that first delivers expected Instagram/TikTok functionality, then improves on their weaknesses, then introduces CREOVA's original ecosystem.

## Vision

CREOVA should outshine established social platforms across the important dimensions of the experience: creation, publishing, discovery, communication, creator value, privacy, safety, accessibility, performance, reliability, and user control.

The age of existing platforms is not a reason to copy their implementation. CREOVA should use modern architecture and original code to deliver familiar capabilities better. Do not copy proprietary source code, trademarks, protected assets, or trade dress.

## Product delivery rule

The sequence is mandatory:

1. **Parity:** implement the core features and functionality users already expect from Instagram and TikTok.
2. **Improvement:** identify and fix weaknesses in those experiences, including opaque recommendations, weak user controls, creator-value gaps, privacy/safety problems, accessibility barriers, performance issues, and unreliable workflows.
3. **CREOVA differentiation:** introduce original CREOVA systems after parity and improvement foundations are established.

Do not prioritize distinctive features ahead of the parity work. Do not add features merely to increase feature count; each feature must solve a real user problem or create a measurable advantage.

## Product requirements

### 1. Accounts and profiles
Registration and login; email/phone verification where configured; password recovery; sessions and optional MFA; public/private accounts; profile editing; avatars, bios, links; personal/creator/business modes; account switching; verification review; deactivation and deletion.

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
Search people, posts, videos, messages, hashtags, topics, sounds, and creators; suggestions and filters; Explore; trends; creator discovery; recommendation controls; hide/not-interested; reset/retrain preferences; diversity, safety, freshness, and privacy-aware ranking.

### 9. Notifications
In-app and push notifications; follows, requests, likes, comments, mentions, messages, LIVE events, creator updates, safety/security alerts; per-category preferences; deduplication; batching; quiet hours; deep links.

### 10. Creator and business tools
Creator Studio; drafts and scheduling; performance analytics; audience insights; collaboration requests; sponsorship disclosures; business profiles; catalogues; product tagging; campaigns; ad reporting; affiliate and commerce capabilities. Billing, ads, commerce, subscriptions, and payouts remain gated until separately approved.

### 11. CREOVA original ecosystem — Phase 3 only
This is the distinctive CREOVA layer, not a substitute for the parity roadmap. Its final scope should be developed after Phases 1 and 2 are established.

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

Use the isolated CREOVA-DEV environment for development migrations and runtime verification. Its 27 applied migrations now match the repository filenames and versions one-to-one. For future schema changes, add a new reviewed migration and verify it on CREOVA-DEV; never replay existing migrations or apply development changes to production by assumption.

## Delivery phases

### Phase 1 — Instagram/TikTok parity
Complete the core account, profile, social graph, feed, publishing, media, Stories, Explore/search, messaging, notifications, creator and safety capabilities. Track each feature against the parity checklist and verify it rather than relying on screen presence.

### Phase 2 — Fix platform weaknesses
Improve recommendation transparency and controls; creator fairness and value; user privacy and safety; moderation and appeals; accessibility and inclusion; low-end-device performance; network resilience; media quality; search relevance; interoperability and data portability.

### Phase 3 — CREOVA differentiation
Build the original Anchor/Iteration, execution-tree, proof-of-execution, skill-discovery, and collaborative-evolution systems after the parity and improvement foundations are working.

### Phase 4 — Scale and commercial capabilities
LIVE, ads, commerce, subscriptions, gifts, and payouts only after reliability, moderation, legal/compliance, fraud, provider, and owner-authorization gates are satisfied.

## Definition of done

A feature is complete only when UI, API, persistence, server-side authorization, validation, failure/retry handling, accessibility, Android/Web behavior, integration tests, and relevant security/abuse tests pass. No placeholder buttons, hard-coded demo records, or fake success states may be represented as complete.
