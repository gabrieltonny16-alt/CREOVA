# ACC-001 — Account registration and authentication

**Status:** INTEGRATION BUILDING

## User outcome
A person can register, verify their email, sign in, keep a secure session on their device, request a password reset, update their password, and sign out.

## Implemented in this branch
- Registration validates name, username, email, password, confirmation and terms before calling Supabase Auth.
- Username validation matches the live database constraint: 3–24 lowercase letters, numbers or underscores.
- Registration passes username and display name as Auth metadata. The existing database trigger creates the profile row.
- Email/password sign-in uses Supabase Auth.
- Password recovery requests a reset link and provides a password-update screen.
- PKCE callback handling exchanges the verification/recovery code for a session.
- Auth sessions persist using AsyncStorage and refresh automatically.
- The app restores the session on launch and listens for Auth state changes.
- The mobile client uses only the Supabase publishable key. No service-role or secret key is included.

## Backend facts verified
- CREOVA-DEV is active and healthy.
- `public.profiles` has RLS enabled.
- Profile insert policy requires `id = auth.uid()`.
- The `on_auth_user_created_creova` trigger calls `handle_new_creova_user()`.
- The trigger reads `username` and `display_name` from `raw_user_meta_data`, validates the username, then creates the profile.
- The database username constraint accepts `^[a-z0-9_]{3,24}$`.

## Verification still required
- Install and Expo compatibility checks for the pinned SDK dependencies.
- TypeScript and web export checks.
- Confirm Supabase Auth email provider settings and redirect allowlist.
- End-to-end registration, verification deep link, sign-in, session restore, password recovery/update, and sign-out on a real device.
- Duplicate username/email, rate-limit and abuse-resistance tests.
- Acceptance checks remain NOT RUN until tested.

## Safety
No test registration, sign-in or password-reset email was sent during implementation. Do not send live test emails or alter production email settings without explicit approval. Never put a service-role key in the mobile app.
