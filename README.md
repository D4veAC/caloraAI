# Calora

Calora is a multi-user nutrition catering app. Users set a weight target, eat one kitchen lunch per day, photograph other meals, and get a tonight recommendation plus tomorrow's calorie target.

## Run with Docker

```
cp .env.example .env
docker compose up --build
```

Open `http://localhost:3005`. Admins use `http://localhost:3005/admin`.

## Local development

Postgres 16 and Node 22.5+ are required. Start Postgres, then run the API on the host.

```
docker compose up postgres
```

```
cp .env.example .env
npm install
npx prisma migrate deploy
npx prisma generate
npm run css:build
npm run dev
```

Open `http://localhost:3005`.

Dave/1234, Alex/5678, Aifih/1414, and Admin/2468 are created when `NODE_ENV` is not production and `CALORA_USERS_JSON` is unset. When that variable is set, those names are not created.

## Telegram bot

```
cd telegram-bot
npm install
npm start
```

The bot calls Nest `/api/analyze`, `/api/food`, and `/api/food/summary`.

## Tests

```
npm test
```
