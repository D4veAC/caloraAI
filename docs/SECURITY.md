# Security

- Passwords are stored as salted scrypt hashes in SQLite. Plain seed passwords exist only in local configuration during first-time creation.
- Production has no fallback users; `CALORA_USERS_JSON` is required to seed accounts.
- Sessions are opaque, in-memory, 30-minute HttpOnly cookies with SameSite=Strict and Secure in production.
- State-changing browser requests reject a mismatched Origin and are rate limited. JSON is limited to 1 MB.
- Browser food/profile/weight/activity ownership comes from the session, not request `user_id`. Telegram food ownership comes only from a bound immutable sender ID.
- Admin APIs require a server-side ADMIN role.
- Telegram binding tokens are random, hashed, short-lived and single-use; Telegram identity uses immutable sender ID.
- Static serving is allowlisted. Data, SQLite, `.env`, server and bot source are not public.
- Adaptive decisions and status changes create or retain audit records/snapshots.
- AI output is normalized and user-confirmed before becoming a food log.

Known limits: sessions are lost on restart; the importer uses one shared bearer secret; SQLite encryption at rest is delegated to host storage; there is no password reset or MFA. Rotate the Telegram and vision credentials that were pasted into chat before deployment.
