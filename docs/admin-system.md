# Yugm Admin System

The admin backend is implemented in the existing Express + Mongoose API under `/api/admin/*`.

## Auth

Admin login is separate from app user login.

- `POST /api/admin/auth/login`
  - Use `{ "firebaseIdToken": "..." }` for Firebase-backed admins.
  - Or use `{ "email": "...", "password": "..." }` for backend admin password auth.
- Access tokens are short-lived admin JWTs.
- Refresh tokens are stored as SHA-256 hashes in `AdminSession`.
- Normal app JWTs are not accepted by admin middleware.

Required production env:

```env
ADMIN_JWT_SECRET=
ADMIN_REFRESH_SECRET=
ADMIN_PANEL_ORIGIN=
SEED_SUPER_ADMIN_EMAIL=
SEED_SUPER_ADMIN_NAME=
SEED_SUPER_ADMIN_FIREBASE_UID=
SEED_SUPER_ADMIN_PASSWORD=
```

Seed:

```bash
cd backend-server
npm run seed:admin
```

## Roles And Permissions

Roles:

- `SUPER_ADMIN`
- `ADMIN`
- `MODERATOR`
- `FINANCE_MANAGER`
- `SUPPORT_AGENT`
- `CONTENT_REVIEWER`
- `ROOM_MODERATOR`
- `ANALYST`

Permissions are defined in `apps/api/src/modules/admin/permissions.ts`. `SUPER_ADMIN` gets every permission. Every admin route uses `requireAdminAuth` plus permission middleware.

## Audit Logging

Sensitive reads and writes create `AdminAuditLog` rows, including:

- admin login/logout
- user detail and private chat views
- user warning/suspension/ban
- profile verification actions
- room moderation
- report resolution
- wallet adjustment/freeze
- payment/refund requests
- gift/config/notification/support changes

Use `auditLog(...)` from `apps/api/src/services/adminAudit.ts` for any new admin action.

## Moderation Workflow

Reports can be reviewed through:

- `GET /api/admin/reports`
- `GET /api/admin/reports/:reportId`
- `POST /api/admin/reports/:reportId/action`
- `GET /api/admin/moderation/queue`

Reports are mirrored into `ModerationQueue` on access. Actions create `AdminModerationAction` rows, update report/queue status, and refresh `UserSafetyStatus`.

## Wallet Safety

Admin wallet changes never edit balances directly. Use:

- `POST /api/admin/wallet/users/:userId/adjust`

This route calls the same wallet ledger services as the app (`creditWallet`/`debitWallet`) and requires `wallet.adjust`.

Wallets can be frozen in `UserSafetyStatus`. Adjustments are blocked while frozen.

## Current Storage

The prompt mentions Firebase SQL Connect/PostgreSQL, but this repository currently uses MongoDB with Mongoose models. Admin entities were implemented as Mongoose collections to match the running backend.

## Main Route Groups

- `/api/admin/dashboard/*`
- `/api/admin/users/*`
- `/api/admin/profiles/*`
- `/api/admin/rooms/*`
- `/api/admin/live/*`
- `/api/admin/reports/*`
- `/api/admin/moderation/queue/*`
- `/api/admin/messages/*`
- `/api/admin/chats/*`
- `/api/admin/wallet/*`
- `/api/admin/payments/*`
- `/api/admin/withdrawals/*`
- `/api/admin/trust-verifications/*`
- `/api/admin/creator-kyc/*`
- `/api/admin/payout-reviews/*`
- `/api/admin/gifts/*`
- `/api/admin/notifications/*`
- `/api/admin/support/*`
- `/api/admin/analytics/*`
- `/api/admin/fraud/*`
- `/api/admin/config/*`
- `/api/admin/audit-logs`
- `/api/admin/admin-users`

## TODOs Before Production

- Add a full admin web panel.
- Add provider-backed refund execution.
- Connect approved withdrawals to the production payout rail and reconciliation process.
- Enforce 2FA after TOTP/SMS provider setup.
- Add privacy/legal review for private chat access workflows.
