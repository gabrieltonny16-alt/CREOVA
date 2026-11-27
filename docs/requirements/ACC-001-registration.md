# ACC-001 — Account registration and authentication

**Status:** BUILD CHECKS PASSED; AUTH CONFIGURATION AND DEVICE TESTS PENDING

## User outcome
A person can register, verify their email, sign in, keep a secure session on their device, request a password reset, update their password, and sign out.

## Implemented in this branch
- Registration validates name, username, email, a strong password (12+ characters with uppercase, lowercase, number and symbol), confirmation and terms before calling Supabase Auth.
- Password recovery applies the same password-strength rule before submitting a password update.
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

## Password security configuration
- CREOVA-DEV organization is on the Supabase Free plan.
- Supabase documentation states that HaveIBeenPwned leaked-password blocking is available on Pro and above; it cannot be enabled on the current Free plan.
- The app now enforces a stronger password rule in its registration and password-update screens. This client-side validation improves feedback but is not a substitute for server-side Auth policy.
- In Supabase Dashboard, set the Email provider password minimum length to 12 and require uppercase, lowercase, digits and symbols. Keep leaked-password protection as a planned upgrade item if CREOVA moves to Pro or above.

## Verification still required
- Install and Expo compatibility checks for the pinned SDK dependencies.
- TypeScript and web export checks.
- Confirm Supabase Auth email provider settings and redirect allowlist.
- End-to-end registration, verification deep link, sign-in, session restore, password recovery/update, and sign-out on a real device.
- Duplicate username/email, rate-limit and abuse-resistance tests.
- Acceptance checks remain NOT RUN until tested.

## Safety
No test registration, sign-in or password-reset email was sent during implementation. No live Auth configuration was changed. Do not send live test emails or alter production email settings without explicit approval. Never put a service-role key in the mobile app.
