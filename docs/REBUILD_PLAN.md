# CREOVA — Clean Rebuild Plan

## Decision

The old application implementation is being replaced by a new build. This rebuild branch starts from the documentation-only `main` branch, not from the previous application branch.

## Preservation boundary

- Do not delete, rewrite, or force-push the existing feature branches.
- Do not merge the old application into the new baseline.
- Keep the existing Supabase project and its data/schema untouched during the rebuild.
- Reuse only infrastructure after explicit technical review; old application UI, workflows, and schema are not assumed reusable.
- Any eventual production cutover or retirement of old systems requires a separate review and explicit approval.

## Initial build sequence

1. Establish this clean branch and product documentation.
2. Select the Android + Web client architecture and confirm toolchain versions.
3. Establish lint, typecheck, unit, integration, and end-to-end test commands.
4. Create the new application shell, responsive navigation, design tokens, and accessibility baseline.
5. Create isolated development backend/project and versioned schema; do not point new migrations at production.
6. Implement identity and profiles, then social graph and feed in small tested slices.
7. Add stories/video, messaging, discovery, creator tools, and CREOVA execution features.
8. Add LIVE, commerce, monetization, and advertising only after explicit approval.

## First engineering gate

Before coding beyond the shell, record:
- chosen framework and why it supports Android and Web;
- folder/module boundaries;
- environment variable names (never secret values);
- development/staging/production separation;
- database migration and rollback policy;
- media upload/transcoding approach;
- CI and test matrix;
- security and privacy threat model.

## Release rule

No feature is called complete without recorded passing test evidence. No production deployment, destructive migration, paid service, live payment, or external message is authorized by this rebuild plan.
