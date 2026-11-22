# CREOVA build protocol

## Delivery loop

For each feature or tightly related feature slice:

1. Define the behaviour and user value.
2. Design the interaction and states.
3. Build the smallest complete vertical slice.
4. Test normal, edge, failure and permission cases.
5. Verify against acceptance criteria.
6. Record evidence, limitations and status.
7. Move to the next slice.

Do not write a huge specification and postpone all implementation. Do not build screens that pretend unfinished backend behaviour is live.

## Engineering safeguards

- Work only on `creova/clean-foundation` unless explicitly approved otherwise.
- Keep `main`, the prior rebuild branch and the backup branch untouched.
- Never reset, force-push, delete branches, or alter unrelated files without explicit approval.
- No production credentials, paid providers, live payments, live messages or deployment without explicit approval.
- Keep secrets out of source control. Use documented environment variables and safe examples.
- Use migrations for schema changes; review access policies and data deletion behaviour before applying them to a real project.
- Keep dependencies minimal and justify additions.
- Do not claim tests passed unless they were actually run and results are recorded.

## Current foundation status

- Product direction: RECORDED
- Clean application shell: IMPLEMENTED IN SOURCE
- ACC-001 registration UI and local validation: IMPLEMENTED IN SOURCE; TESTING NOT RUN
- Dependency installation: NOT RUN
- Type checking: NOT RUN
- Web export: NOT RUN
- Backend/authentication and email verification: NOT CONNECTED
- Production readiness: NOT VERIFIED

## First implementation sequence

1. Clean project shell and navigation foundation.
2. Accounts and identity (registration, login, recovery, sessions, profile identity, privacy controls).
3. Feed and content publishing foundation.
4. Short-form and long-form video.
5. Stories.
6. Social interactions.
7. Messaging and notifications.
8. Creator, business and commerce capabilities.
9. Safety, moderation, security, privacy, operations and reliability throughout every phase.

The sequence is an execution order, not permission to omit or downgrade requirements from the complete parity inventory.
