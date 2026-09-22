# Admin Operations

Configure an account with `role: "ADMIN"`, sign in at `/admin`, and use the Tomorrow's Kitchen view.

The page shows tomorrow order count, confirmed/draft counts, lunch/dinner portions, user catering target, selected menu IDs, dietary restrictions, allergen flags, explanation codes and operational plan status. Admins can set DRAFT, CONFIRMED, LOCKED, FULFILLED or CANCELLED.

It deliberately excludes raw activity-provider data, Telegram identifiers, weight history and food timeline. The current minimal UI combines dashboard/plans/orders/kitchen needs into one operational route; split routes when the operational team needs distinct workflows.
