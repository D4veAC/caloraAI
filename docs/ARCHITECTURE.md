# Architecture

Calora is a server-owned adaptive catering application with a static browser client.

## Runtime

- Node.js 22.5+ HTTP server
- Node built-in SQLite (`node:sqlite`), WAL mode and foreign keys
- HTML/CSS/browser ES modules; no build system
- Telegraf process for Telegram food-photo intake
- Kimi K3 through an OpenAI-compatible endpoint for image parsing only

## Ownership boundary

The HttpOnly session cookie resolves the user server-side. Normal browser requests never select a `user_id`. Every query includes the authenticated user ID. Admin endpoints require `role=ADMIN` and return operational catering data, not raw provider activity.

## Data model

`users`, `nutrition_profiles`, `food_logs`, `weight_logs`, `activity_logs`, `menus`, `adaptive_plans`, `catering_meals`, `telegram_connections`, `telegram_bind_tokens`, and `audit_events` are normalized tables. Migration version 2 imports existing per-user JSON once. Historical adaptive plans store their rolling input snapshot, profile version indirectly in the state version, engine version, explanation codes, menu IDs, timestamp, confidence, and status.

## Decision flow

Food/profile/weight/manual-activity change → calculate rolling 7-day state → generate tomorrow plan → preserve an existing LOCKED plan → save auditable snapshot → browser fetches `/api/dashboard`.

SQLite is deliberately synchronous because this is a single-process deployment. Move to PostgreSQL when concurrent writers or horizontal processes become a measured requirement.
