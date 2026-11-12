# CREOVA — Instagram + TikTok Feature-Parity Checklist

**Purpose:** Track feature parity with the major Instagram and TikTok experiences before prioritizing CREOVA-exclusive innovations.

**Product decision:** CREOVA is intended to provide the broad functionality users expect from both platforms, improve weaknesses in those experiences, and later add original CREOVA capabilities. This checklist does not approve or define the final CREOVA-exclusive feature set.

**Working branch at audit start:** `rebuild/android-bottom-safe-area`  
**Audit date:** 2026-11-09  
**Audit type:** Preliminary source inspection. No end-to-end runtime verification was performed as part of this checklist creation.

## Status legend

- [x] **Code present:** Relevant implementation was found in the inspected source. This does not mean runtime or production readiness is verified.
- [~] **Partial / placeholder:** Some groundwork or a limited version exists; the complete experience is not present or not established.
- [ ] **Missing / not established:** No implementation was established during this preliminary inspection.
- [?] **Needs verification:** Source or backend behavior must be inspected and tested before status can be upgraded.

Do not mark a feature complete based only on a visible screen or button. Completion requires UI, backend persistence, server-side authorization, validation, error/retry behavior, accessibility, Android/Web behavior, and automated tests.

---

## 1. Accounts, identity and profiles

| Feature | Initial status | Evidence / next verification |
|---|---|---|
| Registration and sign-in | [~] | AuthGate integration is present; test full registration and sign-in flows. |
| Sign out and session persistence | [?] | Inspect AuthGate/session lifecycle and test restart/expiry. |
| Email verification | [?] | Verify provider configuration and enforcement. |
| Phone verification | [ ] | Not established. |
| Password reset / recovery | [?] | Inspect and test recovery/deep-link flow. |
| Multi-factor authentication | [ ] | Not established. |
| Public and private accounts | [~] | Profile privacy field and follower request logic exist; verify RLS and all access paths. |
| Profile photo upload/change/remove | [x] | Source and storage migration were added; verify storage policies, Android upload, cache refresh and deletion. |
| Display name, username, bio and links | [~] | Basic profile editing exists; username changes, links and validation need review. |
| Profile grid and media tabs | [~] | Basic profile post list exists; verify complete profile experience. |
| Followers/following lists and counts | [~] | Counts and follow service exist; list screens and edge cases need verification. |
| Follow requests and approvals | [~] | Request status logic exists; acceptance/rejection UX and authorization need testing. |
| Account switching / multiple profiles | [ ] | Not established. |
| Creator/business account modes | [ ] | Not established. |
| Verification/badges | [ ] | Not established. |
| Deactivation, deletion and data export | [ ] | Not established. |

## 2. Social graph and relationships

| Feature | Initial status | Evidence / next verification |
|---|---|---|
| Follow / unfollow | [~] | Basic follow insertion exists; UI currently needs complete following-state and unfollow behavior. |
| Remove follower | [ ] | Not established. |
| Mutual connections | [ ] | Not established. |
| Block / unblock | [ ] | Not established. |
| Mute / unmute | [ ] | Not established. |
| Restrict accounts | [ ] | Not established. |
| Close Friends / custom audiences | [ ] | Not established. |
| Suggested accounts | [ ] | Not established. |
| Relationship privacy controls | [ ] | Not established. |

## 3. Home feeds and publishing

| Feature | Initial status | Evidence / next verification |
|---|---|---|
| Home feed | [~] | Feed service and rendering exist; currently basic following feed. |
| Personalized recommendation feed | [ ] | Not established. |
| Chronological feed option | [ ] | Not established. |
| Text/photo posts | [~] | Basic caption and single-image publishing exist. |
| Multiple-photo carousel posts | [ ] | Not established. |
| Video posts | [ ] | Not established in inspected composer. |
| Captions and hashtags | [~] | Caption exists; hashtag parsing/search not established. |
| Mentions and tagging people | [ ] | Not established. |
| Location/topic tagging | [ ] | Not established. |
| Alt text / accessibility descriptions | [ ] | Not established. |
| Likes / unlike | [~] | Like service and feed action exist; concurrency and duplicate-action tests needed. |
| Comments and threaded replies | [~] | Comment list, posting and reply threading are implemented in the Home feed; Android/Web runtime and authorization tests remain. |
| Comment likes / reactions | [~] | Six reaction types, one reaction per user/comment, Supabase storage/RLS and feed comment controls added; Android/Web runtime, duplicate-action, visibility and automated tests remain. |
| Reposts / reshares | [~] | Repost storage, ownership policies, feed inclusion and repost controls added; Android/Web behavior, duplicate/concurrency and privacy tests remain. |
| Share to user, chat or external app | [~] | Native external share sheet and `creova://post/{id}` link handling added; in-app chat sharing awaits messaging, and platform/deep-link tests remain. |
| Save/bookmark posts | [~] | Private per-user save storage, save/unsave controls and a private Saved posts profile view added; Android/Web and authorization tests remain. |
| Collections/folders for saved posts | [ ] | Not established. |
| Pin posts | [ ] | Not established. |
| Collaborative posts / co-authors | [ ] | Not established. |
| Drafts | [ ] | Not established. |
| Scheduled publishing | [ ] | Not established. |
| Archive / restore / delete posts | [ ] | Not established. |
| Post insights | [ ] | Not established. |

## 4. Stories

| Feature | Initial status | Evidence / next verification |
|---|---|---|
| Story photo publishing | [ ] | Not established. |
| Story video publishing | [ ] | Not established. |
| Story viewer / sequence | [ ] | Not established. |
| Story expiry | [ ] | Not established. |
| Story archive and highlights | [ ] | Not established. |
| Viewer list | [ ] | Not established. |
| Story replies and reactions | [ ] | Not established. |
| Close Friends / audience controls | [ ] | Not established. |
| Mentions, links and location stickers | [ ] | Not established. |
| Polls, questions, quizzes and countdowns | [ ] | Not established. |
| Music/sound stickers | [ ] | Not established. |

## 5. Short-form video and creator editing

| Feature | Initial status | Evidence / next verification |
|---|---|---|
| Full-screen vertical swipe feed | [ ] | Not established. |
| For You / personalized video feed | [ ] | Not established. |
| Following video feed | [ ] | Not established. |
| Video capture and upload | [ ] | Not established in inspected composer. |
| Video transcoding and adaptive playback | [ ] | Not established. |
| Thumbnails and cover selection | [ ] | Not established. |
| Multi-clip recording | [ ] | Not established. |
| Trim, cut, merge and reorder clips | [ ] | Not established. |
| Text overlays, captions and stickers | [ ] | Not established. |
| Voiceover and audio mixing | [ ] | Not established. |
| Speed controls, transitions and effects | [ ] | Not established. |
| Filters and AR effects | [ ] | Not established. |
| Music/sounds library and attribution | [ ] | Not established. |
| Original audio pages | [ ] | Not established. |
| Duet / split-screen | [ ] | Not established. |
| Stitch / remix | [ ] | Not established. |
| Video replies | [ ] | Not established. |
| Video playlists | [ ] | Not established. |
| Repost and favourite videos | [ ] | Not established. |
| Captions/subtitles and accessibility | [ ] | Not established. |
| Video analytics | [ ] | Not established. |

## 6. LIVE experiences

| Feature | Initial status | Evidence / next verification |
|---|---|---|
| LIVE creation and eligibility | [ ] | Not established. |
| LIVE playback and discovery | [ ] | Not established. |
| Real-time chat and reactions | [ ] | Not established. |
| Co-host / guest requests | [ ] | Not established. |
| LIVE moderation tools | [ ] | Not established. |
| Stream health and reconnect | [ ] | Not established. |
| Replays and clips | [ ] | Not established. |
| Gifts, paid badges and payouts | [ ] | Not established; requires separate provider, legal, fraud, tax and owner approval. |

## 7. Direct messaging and communication

| Feature | Initial status | Evidence / next verification |
|---|---|---|
| One-to-one messages | [ ] | Inbox is currently a placeholder screen. |
| Group chats | [ ] | Not established. |
| Text, image and video messages | [ ] | Not established. |
| File sharing and voice notes | [ ] | Not established. |
| Message reactions and replies | [ ] | Not established. |
| Forwarding and sharing posts to chat | [ ] | Not established. |
| Message requests and spam controls | [ ] | Not established. |
| Read receipts and typing indicators | [ ] | Not established. |
| Presence / activity status controls | [ ] | Not established. |
| Edit / unsend / delete messages | [ ] | Not established. |
| Group roles, invites and management | [ ] | Not established. |
| Audio/video calls | [ ] | Not established. |
| End-to-end encryption | [ ] | Not established; must not be claimed until separately designed, implemented and independently reviewed. |

## 8. Search, Explore and recommendations

| Feature | Initial status | Evidence / next verification |
|---|---|---|
| Search usernames | [~] | Basic username search exists. |
| Search posts and captions | [ ] | Not established. |
| Search videos | [ ] | Not established. |
| Search hashtags and topics | [ ] | Not established. |
| Search sounds | [ ] | Not established. |
| Search Anchors/projects | [ ] | Not established. |
| Explore landing page | [~] | Basic search screen only; full Explore not established. |
| Trending content and topics | [ ] | Not established. |
| Personalized recommendations | [ ] | Not established. |
| Recommendation controls / Not interested | [ ] | Not established. |
| Reset or tune feed preferences | [ ] | Not established. |
| Discovery filters and diversity controls | [ ] | Not established. |

## 9. Notifications

| Feature | Initial status | Evidence / next verification |
|---|---|---|
| In-app notification centre | [ ] | Not established. |
| Push notifications | [ ] | Not established. |
| Follow and follow-request alerts | [ ] | Not established. |
| Likes, comments, mentions and repost alerts | [ ] | Not established. |
| Message and group alerts | [ ] | Not established. |
| LIVE and creator alerts | [ ] | Not established. |
| Security and moderation alerts | [ ] | Not established. |
| Per-category notification settings | [ ] | Not established. |
| Quiet hours, batching and deduplication | [ ] | Not established. |
| Deep links to relevant content | [ ] | Not established. |

## 10. Creator, business and monetization tools

| Feature | Initial status | Evidence / next verification |
|---|---|---|
| Creator dashboard | [ ] | Not established. |
| Reach, views, watch-time and engagement analytics | [ ] | Not established. |
| Audience insights | [ ] | Not established. |
| Content performance breakdown | [ ] | Not established. |
| Drafts and scheduling tools | [ ] | Not established. |
| Collaboration requests | [ ] | Not established. |
| Sponsorship / branded-content disclosures | [ ] | Not established. |
| Business profiles and contact actions | [ ] | Not established. |
| Product/catalogue tagging | [ ] | Not established. |
| Advertising and campaign manager | [ ] | Not established; requires explicit approval before paid spend or activation. |
| Subscriptions, gifts and payouts | [ ] | Not established; requires explicit approval and compliance review. |
| Affiliate/commerce capabilities | [ ] | Not established; requires explicit approval. |

## 11. Safety, privacy, moderation and trust

| Feature | Initial status | Evidence / next verification |
|---|---|---|
| Report user/post/comment/message | [ ] | Not established. |
| Block, mute and restrict enforcement | [ ] | Not established. |
| Moderation queue and staff tools | [ ] | Not established. |
| Human review and appeals | [ ] | Not established. |
| Spam, bot and impersonation controls | [ ] | Not established. |
| Copyright/IP reporting workflow | [ ] | Not established. |
| Age-appropriate experience and protections | [ ] | Not established. |
| Sensitive-content controls | [ ] | Not established. |
| Account/session security controls | [ ] | Not established. |
| Privacy and audience enforcement in backend | [?] | Review all database policies and storage access; UI settings alone are insufficient. |
| Data export and deletion | [ ] | Not established. |
| Audit logs and admin access controls | [ ] | Not established. |
| Rate limits and abuse prevention | [ ] | Not established. |

## 12. Platform quality and accessibility

| Feature | Initial status | Evidence / next verification |
|---|---|---|
| Android experience | [?] | Build and test on real Android devices and different screen sizes. |
| Web experience | [?] | Run browser-based end-to-end tests. |
| Responsive layouts and safe areas | [~] | Safe-area work exists; verify all screens and navigation. |
| Accessibility labels and screen-reader support | [ ] | Not established. |
| Dynamic text sizing and contrast | [?] | Audit design system and screens. |
| Localization / language support | [ ] | Not established. |
| Media upload retry/resume | [ ] | Not established. |
| Offline/poor-network handling | [ ] | Not established. |
| Performance and battery usage | [?] | Benchmark on real devices. |
| Crash/error reporting and observability | [?] | Verify instrumentation. |
| Backups and restore testing | [?] | Verify backend operational plan. |
| Automated unit/integration/E2E/security tests | [?] | Inspect CI and test coverage; passing tests required before completion. |

## 13. CREOVA original ecosystem — tracked separately, not part of parity sign-off

These are already part of the broad CREOVA product direction, but their final scope and additional distinctive features must be discussed and approved together. This section is deliberately not an invitation to add unapproved ideas.

- [ ] Anchors
- [ ] Iterations
- [ ] Execution Trees
- [ ] TAP TO ITERATE
- [ ] Proof of Execution
- [ ] Evolution Profiles
- [ ] Skill discovery and related systems

## Preliminary audit summary

Based on a limited inspection of the current branch source:

- **Code present in some form:** authentication integration, profile read/edit, avatar management, basic follow/search, basic feed, text/single-image posts and likes.
- **Partial or placeholder:** account/auth flows, profile/social graph, feed/publishing and Explore/search.
- **Clearly placeholder:** Inbox/messaging screen.
- **Not established in inspected source:** Stories, short-form video pipeline/editor, LIVE, full messaging, robust discovery/recommendations, notification centre, creator analytics, monetization, and most safety/admin capabilities.
- **Not runtime-verified:** the above code-present items. Their end-to-end behavior, backend policies and Android/Web reliability still need tests.

This is a preliminary audit, not a complete codebase or database security review. Re-audit each section against implementation, schema, RLS/storage policies, CI and real-device/browser behavior as work proceeds.

## Build sequence proposed for the parity programme

1. **Foundation and trust:** auth/session recovery, profiles, privacy, social graph, blocks/reports and test infrastructure.
2. **Core social loop:** create/publish, feed, likes, comments/replies, repost/share, saves, profile media and notifications.
3. **Stories:** media capture/upload, audience controls, viewer, replies/reactions, expiry, archive and highlights.
4. **Short-form video:** media pipeline, vertical playback, creator editor, sounds, effects, remix/duet/stitch, recommendations and analytics.
5. **Messaging:** one-to-one and group conversations, media, requests, delivery states, privacy and moderation.
6. **Discovery:** unified search, Explore, trends and controllable recommendation systems.
7. **LIVE and advanced creator/business tools:** only after architecture, moderation and operational readiness; monetization and paid activation remain approval-gated.
8. **Parity verification:** feature-by-feature acceptance tests on Android and Web, security/abuse tests, performance and accessibility.

**Rule:** This document tracks parity scope and evidence. It does not authorize paid services, live payments, external messaging, ad spend, or production cutover. Keep work on the development branch; do not modify or merge into `main` without explicit approval.
