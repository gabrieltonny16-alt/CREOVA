# CREOVA moderation foundation

This feature is being built on the existing React + TypeScript + Vite + Supabase project. It is not a NestJS service and does not assume a migration 007 exists.

## First-stage behaviour

- Users can report an Anchor or Iteration with a category and optional explanation.
- One reporter can have only one open report for a given contribution at a time.
- Three distinct open reporters trigger an automatic hold by default. The threshold is stored in \`private.moderation_settings\` and can be changed by a database administrator.
- Held and removed contributions are hidden from other users by row-level security. The creator and authorized moderators can still see them.
- Only a contribution's creator can appeal it, and only while it is held or removed.
- Moderators review through the permission-checked \`public.review_moderation\` RPC.
- Automated holds and staff actions are recorded in \`public.moderation_audit_log\`.
- Application users cannot directly edit moderation state, report status, appeal status, staff roles, or audit entries.

## First moderator setup

The migration deliberately does not make the first registered user a moderator. That would create a privilege-escalation window. After the intended staff account has registered, a project owner must add that account in the Supabase SQL Editor:

\`\`\`sql
insert into private.moderator_roles (user_id, role)
values ('THE_AUTH_USERS_ID', 'admin');
\`\`\`

Get the UUID from **Supabase → Authentication → Users**. Do not put a service-role key in the browser or in this repository.

## Tests

Run the database test file with the Supabase CLI test runner:

\`\`\`sh
supabase test db
\`\`\`

The pgTAP suite checks RLS, privileges, the staff RPC boundary, the auto-hold trigger, and the active-report uniqueness index. The end-to-end flow still needs authenticated test users: report → auto-hold → remove → appeal → overturn.

## Known scope limits in this first migration

- The target types are Anchors and Iterations. Account reports are a later extension.
- Auto-hold uses a distinct-reporter count; rate limiting and coordinated-report abuse protection are separate work.
- The first-stage staff role is assigned by the project owner, not self-service.
- The threshold is 3 by default and is stored in the private settings table.
