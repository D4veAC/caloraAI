# Calora

Calora is a multi-user, nutrition-aware catering platform. Food history, weight trajectory, logging completeness and permitted activity context feed a deterministic rolling state that produces **Tomorrow's Catering**.

## Requirements and start

Node.js 22.5 or newer is required for the built-in SQLite driver.

```powershell
Copy-Item .env.example .env
npm start
```

Open `http://localhost:3005`. Catering admins use `http://localhost:3005/admin`.

Development-only Dave/1234, Alex/5678, and Admin/2468 accounts are seeded only when `NODE_ENV` is not `production` and no user configuration is supplied. Production must configure `CALORA_USERS_JSON`; seed passwords are scrypt-hashed into SQLite.

## Product flow

1. User logs food manually or through a securely bound Telegram account.
2. Calora recomputes a 7-day nutrition state and confidence.
3. A deterministic engine selects tomorrow's lunch/dinner from available menus.
4. Allergy and diet restrictions are hard filters.
5. Protein composition can change before total energy changes.
6. Energy adjustment requires complete rolling data plus an off-target weight trajectory and is bounded to 100 kcal.
7. The kitchen cutoff locks tomorrow's plan.

The browser keeps today's remaining intake as secondary context. Estimated activity is displayed separately and never added 1:1 to food allowance. General food endpoints require a browser session; Telegram writes only through its sender-ID binding endpoint.

## Telegram bot

```powershell
Set-Location telegram-bot
Copy-Item .env.example .env
npm install
npm start
```

In Calora, open Nutrition Profile → Integrations → Connect Telegram, then press Start in the bot. Kimi K3 parses food photos, but users must review or edit estimates before saving.

## Verification

```powershell
npm test
```

There is no transpilation/build step or static type system. `node --check` is used for syntax verification. See:

- [Repository audit](CALORA_AUDIT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Adaptive engine](docs/ADAPTIVE_ENGINE.md)
- [Telegram binding](docs/TELEGRAM_BINDING.md)
- [Activity providers](docs/ACTIVITY_PROVIDERS.md)
- [Strava status](docs/STRAVA_INTEGRATION.md)
- [Security](docs/SECURITY.md)
- [Admin operations](docs/ADMIN_OPERATIONS.md)
