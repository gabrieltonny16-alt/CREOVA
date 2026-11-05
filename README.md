# CREOVA

**An Active Skill Execution Network**

CREOVA is built around one core loop:

**ACTION → EXECUTION → EVOLUTION → PROOF → DISCOVERY**

## Product foundation

- **Anchor:** an idea, challenge, skill, or original contribution.
- **Iteration:** someone builds on an Anchor with execution, improvement, or a new interpretation.
- **Execution Tree:** the connected history of how an Anchor evolves through contributions.

CREOVA is not intended to be a generic scrolling-first social network. The product should help people create, execute, collaborate, develop skills, and show proof of progress.

## Brand direction

The selected visual direction is a premium planetary emblem: Earth in deep space, wrapped by a metallic-gold orbital C and a central play mark. The full artwork and a simplified launcher icon are separate brand assets.

## Development principles

- Preserve existing work; inspect before changing.
- Build and test real functionality, not mock screens.
- Develop on feature branches; keep \`main\` protected from unfinished work.
- Do not enable paid services, live payments, or external messaging without explicit approval.
- Verify every test before reporting its result.
- Use Supabase Row Level Security as the authorization boundary; never put service-role credentials in the client.

## Current implementation

The working foundation is **React 19 + TypeScript + Vite + Supabase**.

The \`feature/moderation-foundation\` branch contains:
- account registration/sign-in and profile bootstrap;
- the initial Anchor and Iteration schema;
- report submission for Anchors and Iterations;
- a configurable auto-hold threshold (3 distinct reporters by default);
- staff-only review actions through a permission-checked RPC;
- an append-only moderation audit log;
- creator appeals and staff overturn/uphold decisions;
- user-facing report/appeal controls and a staff moderation desk.

Database migrations applied to the CREOVA Supabase project:
- \`initial_core\`
- \`validate_iteration_parent\`
- \`index_iteration_parent\`
- \`moderation_foundation\`
- \`moderation_security_and_indexes\`
- \`moderation_console_access\`

The moderation end-to-end test is executed with temporary test users inside a transaction and rolls back the fixtures. No test users or example content are retained in the project.

## Still to build

CREOVA remains an early-stage build. Iteration creation and tree browsing, profiles/onboarding, discovery, messaging, notifications, media/proof uploads, block/mute, broader account moderation, and production deployment still need implementation and testing.

The initial moderator role must be assigned by the project owner after the intended staff account registers. The app does not promote the first user automatically.
