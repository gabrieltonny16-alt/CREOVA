# ACC-001 — Account registration

**Status:** BUILDING  
**Requirement source note:** ACC-001 is part of the reconstructed Category A mapping. The exact wording from the unavailable original v2.0 register was not recoverable; this working definition must remain traceable as a reconstruction rather than being represented as a verbatim original.

## User outcome

A new person can begin creating a CREOVA account using a name, unique-style username, email address and password, understand what is required, correct invalid entries, and proceed to email verification once the secure account service is connected.

## Current slice delivered

- Registration entry point from the CREOVA home shell.
- Name, username, email, password and confirm-password fields.
- Inline validation and accessible labels.
- Password visibility controls.
- Terms acceptance control.
- Clear local-only completion message.
- No network request, persistence, account creation, email delivery or provider activation.

## Validation rules in this UI slice

- Name: 2–60 trimmed characters.
- Username: 3–24 characters, stored in lowercase; starts with a letter, then lowercase letters, numbers or underscores. This matches the current database username constraint; dots are not accepted.
- Email: basic syntax validation; server-side verification and uniqueness checks remain required.
- Password: minimum 12 characters in this first UI slice.
- Confirmation: must exactly match.
- Terms: must be accepted before local validation passes.

These client-side checks are usability checks, not security boundaries. The server must repeat and strengthen validation.

## Acceptance checks

| ID | Check | Expected result | Status |
|---|---|---|---|
| ACC-001-T01 | Open registration from home | Registration screen opens and back returns home | NOT RUN |
| ACC-001-T02 | Submit empty form | Required-field errors appear | NOT RUN |
| ACC-001-T03 | Enter malformed email | Email error appears | NOT RUN |
| ACC-001-T04 | Enter invalid username | Username rule is explained and matches the database constraint | NOT RUN |
| ACC-001-T05 | Enter password shorter than 12 characters | Password error appears | NOT RUN |
| ACC-001-T06 | Enter mismatched confirmation | Confirmation error appears | NOT RUN |
| ACC-001-T07 | Leave terms unchecked | Terms error appears | NOT RUN |
| ACC-001-T08 | Enter locally valid values and accept terms | Local-only notice appears; no account is claimed | NOT RUN |
| ACC-001-T09 | Toggle password visibility | Password visibility changes without changing its value | NOT RUN |
| ACC-001-T10 | Inspect network and persistence | No user data is transmitted or persisted by this preview | NOT RUN |

## Backend work still required

- Secure registration endpoint and server-side validation.
- Unique username/email enforcement with safe error handling.
- Password hashing using a modern password-hashing algorithm; never store plaintext passwords.
- Email verification token generation, expiry, single-use semantics and resend rate limits.
- Abuse prevention, rate limiting and account-enumeration-resistant responses.
- Terms/privacy version recording and consent timestamp.
- Data minimisation, deletion and retention rules.
- Secure session issuance only after the required verification policy is satisfied.
- Automated tests and real-device tests.

## Exit criteria for VERIFIED

All acceptance checks must pass on a supported runtime; backend tests must prove secure account creation, duplicate handling, verification-token lifecycle, abuse controls and safe failure behaviour. A visible form alone is not completion.
