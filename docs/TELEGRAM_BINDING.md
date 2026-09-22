# Telegram Binding

1. An authenticated user presses **Connect Telegram**.
2. Calora creates a cryptographically random token, stores only its SHA-256 hash, and returns a bot deep link.
3. Telegram sends `/start bind_<token>` with immutable `ctx.from.id`.
4. The bot authenticates to Calora with the importer bearer secret.
5. Calora validates expiry, unused state and connection conflicts, then binds the Telegram ID to the session-owned user.

Tokens expire after `TELEGRAM_BIND_TTL_MINUTES`, are single-use, and are never application sessions. Food reads/writes resolve the connection from Telegram sender ID; message text and Telegram username cannot choose a Calora user.

Photo results remain estimates. Kimi K3 receives only the image/caption, returns normalized candidate values, and the user must save or edit before persistence.
