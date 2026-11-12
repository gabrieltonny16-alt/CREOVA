# CREOVA — Current Build and Integration Plan

## Product decision

CREOVA is being built in a strict three-stage sequence:

1. Match the core features and functionality people expect from Instagram and TikTok.
2. Improve their weak points and deliver a better, more modern experience.
3. Introduce CREOVA's distinctive systems after parity and improvements are established.

Do not build the old Anchor/Iteration concept ahead of parity. Keep every feature tied to a real user need and a verifiable acceptance test.

## Current engineering baseline

The repository contains an Expo + React Native + TypeScript application for Android and Web, Supabase-backed social/profile/messaging services, and versioned Supabase migrations.

The current integrated source includes identity and profiles, social graph, posts and feeds, Stories, short-form video playback, Explore, creator profile views, direct/group messaging, realtime inbox behavior, read receipts, and conversation message search.

Automated CI currently validates dependency installation, Expo compatibility, TypeScript, and web export. A passing CI run is not proof of authenticated Supabase behavior, applied migrations, native Android playback, or complete end-to-end workflows.

## Phase 1 — Parity completion

Use docs/FEATURE_PARITY_CHECKLIST.md as the source of truth. Continue feature-by-feature through:

- Accounts, verification, recovery, sessions, profiles, privacy, and social graph.
- Feed modes, publishing, media, likes, comments, reactions, reposts, sharing, saves, and notifications.
- Stories, video capture/editing, vertical playback, sounds, creator tools, and analytics.
- Direct/group messaging, requests, search, reactions, typing/presence, editing/deletion, calls where supported.
- Explore, unified search, trends, recommendation controls, and user feedback.
- Safety, reporting, blocking, moderation, accessibility, and administration.

For each feature: inspect current implementation, identify gaps, implement the complete workflow, add tests, run CI, fix failures, and integrate the change. Do not leave routine completed features waiting in draft branches.

## Phase 2 — Outperform existing platforms

Run a documented weakness audit and improve:

- User control over recommendations and feed tuning.
- Creator discovery, fair reach, transparent insights, and sustainable value.
- Privacy by default, understandable audience controls, and reliable enforcement.
- Safety, anti-abuse, human appeals, and age-appropriate experiences.
- Accessibility, localization, and inclusive interaction design.
- Startup speed, scrolling, media loading, battery use, low-end Android performance, and poor-network resilience.
- Search quality, content portability, interoperability, and user control over personal data.

## Phase 3 — CREOVA original systems

Only after parity and improvement foundations are working, finalize and build the Anchor/Iteration, execution-tree, proof-of-execution, skill graph, collaborative evolution, and related original capabilities.

## Verification gates

- TypeScript, Expo dependency compatibility, and Web export must pass.
- Android and Web workflows must be exercised on supported real devices/browsers.
- Supabase migrations must be applied only to the intended development project, then verified with test accounts and RLS/storage tests.
- Test privacy boundaries using multiple accounts and public/private profiles.
- Verify failure, retry, offline, loading, empty, and permission-denied states.
- Record unverified native/runtime behavior honestly; never claim success based only on CI.

## Integration and release rules

Routine code changes should be integrated after required checks pass; no extra approval pause is needed for ordinary implementation or feature merges. Keep paid services, production deployment, live payments, ad spend, external messaging, and destructive data changes behind explicit authorization.

No feature is called complete without evidence. Do not silently deploy or spend money.
