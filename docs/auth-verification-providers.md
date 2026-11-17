# CREOVA email and SMS OTP providers

## Chosen architecture

- **Email OTP:** Supabase Auth's native email OTP flow.
- **SMS OTP:** Supabase Auth's HTTP Send SMS Hook, backed by Africa's Talking.
- **OTP generation, expiry, resend throttling and verification:** Supabase Auth. CREOVA does not generate or store a second OTP.
- **Provider credentials:** server-side Supabase Edge Function secrets only. Never put provider credentials or service-role keys in the mobile app.

The existing `luxora-otp` function and its database objects belong to the separate Luxora OTP service. This CREOVA integration does not modify or call them.

## Current implementation

`supabase/functions/creova-send-sms/index.ts` implements the Supabase Auth Send SMS Hook. It verifies the signed Standard Webhooks request, validates the E.164 destination and OTP, calls the Africa's Talking Messaging API, and returns success only when Africa's Talking accepts the message.

It defaults to the **sandbox** endpoint. Production sending requires an explicit environment change and production credentials.

## Required Edge Function secrets

Set these in the CREOVA-DEV Supabase project before deploying/activating the hook:

- `SEND_SMS_HOOK_SECRET` — the signing secret generated when configuring the Supabase Auth Send SMS Hook.
- `AFRICASTALKING_USERNAME` — Africa's Talking sandbox username for development.
- `AFRICASTALKING_API_KEY` — Africa's Talking sandbox API key.
- `AFRICASTALKING_ENV=sandbox`
- `AFRICASTALKING_SENDER_ID` — optional; only set if the account has an approved sender ID.

Do not commit real values to GitHub or place them in `.env.example`.

## Supabase Auth setup

1. Keep email signup confirmation enabled and use the email OTP template containing `{{ .Token }}`.
2. Enable phone signup confirmation.
3. Deploy this Edge Function as `creova-send-sms` with JWT verification disabled. The function authenticates requests using the Supabase-generated Standard Webhooks signature.
4. Configure the Supabase Auth **Send SMS Hook** to call the deployed function URL and attach the matching signing secret.
5. Keep OTP expiry and resend frequency conservative during testing. Supabase Auth remains responsible for validating the code.

The Supabase Auth hook configuration is a separate dashboard/management setting; deploying the function alone does not activate it.

## Development and safety gates

- Start with Africa's Talking sandbox credentials and sandbox endpoint.
- Do not enable production mode or use a paid sender ID without explicit approval.
- Do not send real OTPs as a test without the user's explicit approval.
- Never log OTP values, full phone numbers, API keys, or webhook secrets.
- Test the hook with a signed mock payload before testing an actual phone.
- Confirm that a failed provider response causes the Auth request to fail rather than falsely reporting delivery.

## Client flow still to wire

The current CREOVA signup screen already requests and verifies email OTP. The next client change is to collect a phone number in E.164 format during signup and track both confirmation states. Do not treat an account as fully verified until both email and phone are confirmed.
