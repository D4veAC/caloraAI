# Calora

Calora is a multi-user nutrition catering app. Users set a weight target, eat one kitchen lunch per day, photograph other meals, and get a tonight recommendation plus tomorrow's calorie target.

## Run with Docker

```
cp .env.example .env
docker compose up --build
```

Open `http://localhost:3005`. Admins use `http://localhost:3005/admin`.

## Local development

Postgres 16 and Node 22.5+ are required.

```
cp .env.example .env
npm install
npx prisma migrate deploy
npx prisma generate
npm run css:build
npm run start:dev
```

Development Dave/1234, Alex/5678, and Admin/2468 accounts are seeded when `NODE_ENV` is not production.

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
