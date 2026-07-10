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
- `trust_verification.read`, `trust_verification.review`, `trust_verification.media.read`, `trust_verification.approve`, `trust_verification.reject`
- `creator_kyc.read`, `creator_kyc.review`, `creator_kyc.approve`, `creator_kyc.reject`, `creator_kyc.sensitive.read`
- `payout_review.read`, `payout_review.approve`, `payout_review.reject`
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
- Keep Trust Verification permissions separate from Creator Payout KYC permissions.
- Do not grant `creator_kyc.sensitive.read` to moderators or content reviewers.
- Use `settings.manage` for admin user invites and app config.
- `SUPER_ADMIN` bypasses permission checks.
