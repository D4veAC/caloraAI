# Calora Repository Audit

Audit date: 2026-09-22

## Existing stack

- Frontend: static HTML, CSS, and browser ES modules. There is no frontend framework or build step.
- Backend: one zero-dependency CommonJS Node HTTP server.
- Persistence: one JSON file per configured user under `data/users/`; no database or ORM.
- Authentication: in-memory opaque sessions in an HttpOnly, SameSite=Strict cookie. Users originate from `CALORA_USERS_JSON`, with Dave/1234 and Alex/5678 as development fallbacks.
- State: server data is mirrored into a browser `StateStore`; legacy food, workout, timer, and profile values are also cached in `localStorage`.
- Telegram: Telegraf bot, OpenAI-compatible Kimi K3 vision call, user review/edit, then an authenticated Calora import request.

## Existing data and request flow

Food entries are validated by `server.js`, appended to the authenticated user's JSON document, fetched into browser state, and aggregated by `js/domain/nutrition.mjs`. Workout imports follow the same document model. Profile updates overwrite the current profile in that document. Historical targets are not snapshotted.

The browser never supplies a user ID for normal authenticated food/profile reads. Delete operations filter the authenticated user's own document. Importers authenticate with one shared bearer secret plus `X-Calora-User`.

## Current nutrition and adaptive logic

- `calculateNutritionTargets`: Mifflin-St Jeor BMR, activity multiplier, bounded goal adjustment, and deterministic macro targets.
- `calculateDailyNutritionState`: today's consumed, remaining, and over-target amounts.
- `recommendNextMeal`: ranks five hardcoded meal templates against today's remaining calories/protein and filters diet/allergy conflicts.
- `buildAdaptiveInsight`: produces a same-day message from current intake ratios.

This is a daily calorie-tracker model. It has no rolling state, weight trajectory, completeness confidence, catering allocation, plan version, kitchen cutoff, or persistent adaptive plan. A single unusual day can strongly affect the displayed next meal even though it does not alter the base target.

## APIs

- `POST/GET/DELETE /api/session`
- `GET/PUT /api/profile`
- `GET/POST/DELETE /api/food[/id]`
- `GET/POST/DELETE /api/workout[/id]`
- `GET /api/health`

There are no admin, weight, catering, trend, integration, or Telegram-binding APIs.

## AI boundary

`telegram-bot/gemini.js` calls an OpenAI-compatible `/chat/completions` endpoint with Kimi K3. It parses food images into candidate nutrition values. The result is normalized and must be confirmed or edited before persistence. The LLM does not calculate the user's base target, but its estimated food nutrients currently flow into daily totals after user confirmation.

## Hardcoded and mock values

- Dave/1234 and Alex/5678 are server development fallbacks.
- `js/config.js` duplicates Dave and Alex profile defaults in the browser.
- Telegram defaults every request to `CALORA_USER_ID=dave`; sender identity is not bound.
- Five meal templates are embedded in the nutrition domain module and have no inventory state.
- The dashboard contains static placeholder values before the first render.
- `HealthConnect` is a label on a generic webhook importer; it is not an official provider connection.

## Security findings

- Passwords are plaintext configuration values and compared directly; there is no password hash at rest.
- Sessions disappear on restart and have no explicit CSRF token. SameSite=Strict reduces but does not replace a deliberate CSRF strategy.
- Import identity trusts `X-Calora-User` after one shared bearer token. A leaked importer token can target any configured account.
- Telegram does not bind immutable Telegram sender IDs to Calora accounts.
- No roles or server-side admin guard exist.
- No audit events exist for profile, plan, binding, or operational changes.
- JSON writes are atomic per file but have no transaction isolation across related entities.
- Static serving is allowlisted and does not expose `.env`, bot source, data, or server source.
- Food/model output is validated numerically and rendered through escaping in lists, reducing mass-assignment and XSS risk.

## Duplication and migration risks

- Profiles and demo users exist in both server configuration and browser configuration.
- Browser localStorage remains a second copy of server-owned health data and can become stale.
- Moving JSON data to normalized records must preserve IDs, timestamps, sources, and the Dave legacy import without reassigning ownership.
- Changing a profile currently changes the interpretation of old days because historical daily targets are not stored.
- Existing Telegram imports have no trustworthy Telegram-to-user ownership record.

## Reusable components

- Food/profile forms, dashboard progress components, modal/toast/router utilities.
- Deterministic target and daily aggregation functions.
- Server input size limits, static allowlist, security headers, cookie sessions, and atomic migration source files.
- Vision normalization and explicit user confirmation flow.

## Components requiring refactoring

- Replace JSON documents with normalized persistent records and migrations.
- Remove browser user/profile defaults as an authorization or identity source.
- Introduce roles and server-side admin authorization.
- Replace daily next-meal emphasis with rolling state and Tomorrow's Catering.
- Add weight/activity records, plan snapshots, menus, cutoff locking, explanation codes, and audit events.
- Replace `X-Calora-User` Telegram ownership with single-use binding to immutable Telegram `user.id`.
- Keep Strava disabled: the current 2026 policy prohibits using Strava Data in AI applications and combining it with customer data for analytics/insight generation. Any future display-only integration requires a separate compliance review.

## Audit conclusion

The current code is a useful prototype and can be migrated incrementally. The UI and deterministic nutrition utilities are reusable, but persistence, identity, rolling-state calculation, and operational catering are foundational changes. The safest path is SQLite using Node's built-in driver, server-owned adaptive computation, and a compatibility layer for the existing frontend while localStorage is reduced to non-authoritative caching.
