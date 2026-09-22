# Calora Revision Report

## 1. What existed before

A static calorie/workout dashboard, JSON-per-user storage, in-memory sessions, development credentials, same-day remaining/next-meal logic, a shared-token Health Connect importer, and a Telegram Kimi K3 photo flow hardwired to one configured Calora user.

## 2. What changed

Calora now centers Tomorrow's Catering, keeps today's remaining values secondary, exposes 7-day trends, stores normalized user-owned records, and creates deterministic/reproducible plans with confidence and explanations.

## 3. Database migrations

Migration 1 creates normalized SQLite tables and seeded menus. Migration 2 imports existing user JSON once. SQLite is ignored by Git. No ORM was added because Node's standard driver covers current requirements.

## 4. Adaptive engine behavior

`adaptive-v2` calculates rolling completeness, nutrition averages, permitted activity context and weight trajectory. Sparse data freezes energy. Protein deficits prioritize menu composition. Energy changes require high completeness, persistent deviation and off-target weight trend, with a ±100 kcal bound. Plans lock at the kitchen cutoff.

## 5. Authentication architecture

Passwords are scrypt-hashed. Sessions identify users server-side. USER and ADMIN roles are enforced by API guards. Production has no default credential path.

## 6. Telegram architecture

Authenticated users create short-lived, hashed, single-use binding tokens. Telegram immutable sender IDs resolve to Calora users. Photo estimates require confirmation/correction before persistence.

## 7. Admin architecture

`/admin` is a separate operational view backed by ADMIN-only APIs. It shows catering requirements/statuses while excluding raw activity data.

## 8. Activity provider architecture

Provider-neutral activity records use an idempotency key. Estimated energy remains separate from food energy and is not eaten back 1:1. Manual activity is the allowed baseline.

## 9. Strava implementation status

Not implemented and disabled. No fake OAuth, token, webhook, or activity records were added.

## 10. Strava compliance blocker/status

The official 2026 API Policy blocks the intended combination/analytics/AI use. The capability guard is false. Written approval or a policy change plus legal review is required before implementation.

## 11. Security fixes

Hashed passwords, role guards, user-scoped SQL, Origin validation, static allowlist, input validation, short-lived Telegram binding, audit events and locked plan preservation.

## 12. Tests added

Rolling confidence, no daily calorie debt, protein-first behavior, weight-trajectory override, bounded persistent adjustment, cutoff locking, Strava policy guard, multi-user ownership, admin authorization, Telegram token expiry/reuse/conflict/hijack resistance, activity idempotency, validation and static-source denial.

## 13. Known limitations

- SQLite/synchronous server is single-process.
- Sessions are in-memory and lack MFA/password reset.
- Menu inventory is seeded, not yet editable in the admin UI.
- Manual activity creation is API-backed; the existing workout UI remains the primary input surface.
- Plan timezone currently follows server local time.
- No real Strava integration is permitted/implemented.
- Nutrition rules are wellness/product heuristics, not medical treatment.

## 14. Recommended next steps

Rotate exposed Telegram/vision credentials, configure production users, add menu/inventory editing, add automated backups, introduce persistent sessions and password reset, validate catering cutoff timezone, and conduct a nutrition/legal/security review before public deployment.
