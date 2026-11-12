# CREOVA

**Create. Connect. Evolve.**

CREOVA is a next-generation social platform built to deliver the core experiences people expect from Instagram and TikTok, improve on the weaknesses of today's social platforms, and then introduce original CREOVA capabilities.

## Product sequence

1. **Parity first:** accounts, profiles, social graph, feeds, photo/video publishing, Stories, Explore, messaging, notifications, and creator tools.
2. **Outperform:** improve discovery controls, creator value, privacy, safety, accessibility, performance, reliability, and user control.
3. **CREOVA originals:** introduce the Anchor/Iteration and execution ecosystem after the parity and improvement foundations are strong.

CREOVA will use original code, architecture, algorithms, and visual identity. Feature parity means comparable user-facing capabilities, not copying proprietary source code, trademarks, or protected assets.

## Current implementation

The repository contains the cross-platform Expo/React Native application, Supabase-backed social and messaging services, and versioned database/storage/security migrations.

Current automated CI validates dependency installation, Expo compatibility, TypeScript, and web export. Those checks do not replace authenticated Supabase tests, migration application, Android device testing, or end-to-end verification.

## Product and engineering standards

- Build for modern mobile and web experiences, not the constraints of older platform generations.
- Real functionality only: no fake success states or demo-only controls presented as complete.
- Enforce privacy and authorization on the server, not only in the UI.
- Verify every feature across its UI, persistence, failure handling, accessibility, and Android/Web behavior.
- Integrate routine feature work when required checks pass; do not leave completed work sitting in draft branches.
- Keep paid services, production rollout, live payments, advertising spend, and external messaging behind explicit authorization.

See:
- [Product specification](docs/PRODUCT_SPECIFICATION.md)
- [Parity checklist](docs/FEATURE_PARITY_CHECKLIST.md)
- [Current build plan](docs/REBUILD_PLAN.md)
