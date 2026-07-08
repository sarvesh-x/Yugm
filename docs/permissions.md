# Admin Permissions

Admin permission constants live in:

```text
backend-server/apps/api/src/modules/admin/permissions.ts
```

Important permissions:

- `users.read`, `users.update`, `users.suspend`, `users.ban`, `users.delete`
- `profiles.review`, `profiles.verify`
- `rooms.read`, `rooms.end`, `rooms.feature`, `rooms.moderate`
- `reports.read`, `reports.resolve`
- `messages.read`, `messages.read_private`, `messages.delete`
- `wallet.read`, `wallet.adjust`
- `payments.read`, `payments.refund`
- `withdrawals.read`, `withdrawals.approve`, `withdrawals.reject`
- `gifts.manage`
- `notifications.send`
- `support.read`, `support.reply`
- `audit.read`
- `analytics.read`
- `settings.manage`

Guidelines:

- Use the narrowest permission per route.
- Use `messages.read_private` for private DM access.
- Use `wallet.adjust` only for immutable ledger changes.
- Use `settings.manage` for admin user invites and app config.
- `SUPER_ADMIN` bypasses permission checks.
