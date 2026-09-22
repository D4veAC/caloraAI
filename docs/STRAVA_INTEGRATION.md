# Strava Integration Status

Status: **disabled and not implemented**. `STRAVA_INTEGRATION_ENABLED=false` and the adaptive capability guard is always false.

The official [Strava API Policy effective June 1, 2026](https://www.strava.com/legal/api_policy) prohibits using Strava Data in operating an AI application and prohibits combining Strava Data with other customer data for analytics or insight generation. That conflicts directly with Calora's intended adaptive catering use. The official [API Agreement](https://www.strava.com/legal/api) also restricts display to the authenticated athlete and requires privacy/security controls.

Therefore Calora does not initiate OAuth, store Strava tokens, import activities, show Strava data to admins, send it to Kimi/another LLM, or use it in catering plans. Working code alone would not establish compliance.

## Required future flow—only after written policy/compliance approval

- OAuth 2.0 authorization with minimum `activity:read` scope and validated `state`.
- Server-only encrypted access/refresh tokens; persist every rotated refresh token.
- Handle expiry, 401, revocation, scope changes, disconnect and deletion confirmation.
- Idempotent import keyed by athlete/user, provider and activity ID.
- Prefer official [Webhook Events API](https://developers.strava.com/docs/webhooks/) for activity create/update/delete and authorization revocation rather than polling.
- Acknowledge webhook quickly, validate subscription/current official requirements, then process idempotently.
- Respect current rate limits and the account's access tier shown by Strava response headers/developer portal.
- Display data only to the authenticated athlete; never expose it to catering admins.

## Compliance unblock condition

Do not enable until Strava's then-current written terms or express written approval permit Calora's exact data combination and adaptive-catering purpose, legal counsel accepts the use, and deletion/consent/retention procedures are operational. Even then, Strava Data must remain outside every LLM pipeline unless the policy explicitly permits it.
