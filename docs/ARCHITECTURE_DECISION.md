# Architecture Decision: Cross-platform application foundation

**Decision date:** 2026-11-06  
**Status:** Initial choice; verify with CI before expanding dependencies.

## Decision

Use Expo + React Native + TypeScript as the shared Android and Web application foundation.

- Expo SDK 58
- React 19.3
- React Native 0.88
- React Native Web 0.21
- TypeScript strict mode

## Rationale

Expo officially supports universal applications for Android and Web from one React Native codebase. SDK 58's compatibility matrix pairs Expo 58 with React Native 0.88, React 19.3, and React Native Web 0.21. SDK 58 requires Node.js 22.13 or newer.

This allows shared navigation, UI primitives, accessibility behavior, and business logic while retaining platform-specific modules where native capabilities require them.

## Constraints and follow-up

- Use development builds for native capabilities and validate the supported Expo Go version on the target Android device.
- Add native packages through `npx expo install` so versions match the selected SDK.
- Keep platform-specific code behind small adapters.
- Validate both Android bundling and Web export in CI before adding feature dependencies.
- Do not introduce a second frontend stack without a documented reason.
- Backend, database, storage, media processing, real-time messaging, and recommendation architecture remain separate decisions and must be reviewed before production use.

## Sources

- [Expo SDK reference](https://docs.expo.dev/versions/latest/) — SDK/RN/React/RN Web compatibility and Node.js minimum.
- [Create a project](https://docs.expo.dev/get-started/create-a-project/) — SDK 58 project template.
- [Expo upgrade guidance](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/) — dependency alignment using Expo install and Expo Doctor.
