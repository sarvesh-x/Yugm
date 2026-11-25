# D1 subscriptions routes

## Scope

Mounted all five legacy `/api/subscriptions` HTTP patterns on the shared D1 Worker on 2026-11-25. MongoDB remains authoritative. No deploy, hosted migration, seed or hosted data operation was performed.

| Route | Behavior |
| --- | --- |
| `POST /api/subscriptions/:creatorId` | Validates plan and creator, debits coins and creates an active subscription. |
| `DELETE /api/subscriptions/:creatorId` | Cancels the caller's active subscription. |
| `GET /api/subscriptions` | Lists the caller's subscriptions with populated creator DTOs. |
| `GET /api/subscriptions/subscribers` | Lists subscriptions where the caller is the creator, with a `subscriber` alias. |
| `GET /api/subscriptions/check/:creatorId` | Reports whether an active subscription exists and omits `subscription` when absent. |

The audit reports `legacy 638 / d1 258 / matched 253 / missing 385`, with `/api/subscriptions` at `5 mounted / 0 missing`.

## Behavior notes

- **Validation order.** Authentication runs first, then body validation, creator ObjectId validation, self-check, creator lookup and active-duplicate check. This preserves the legacy 401 → 422 → 400 → 400 → 404 → 409 ordering.
- **Pricing and expiry.** `MONTHLY` debits 299 coins and expires 30 days later; `YEARLY` debits 2999 coins and expires 365 days later. The debit uses source `SUBSCRIPTION` and metadata `{ creatorId, plan }`.
- **Atomic commit.** The wallet debit, balance update, subscription row, wallet-marker clear and creator notification commit in one guarded D1 batch under a scratch `user_auth_profile.edit_token` claim. Frozen wallets and insufficient funds are checked before the batch and rechecked from authoritative state if a guard misses. A guard miss returns a conflict rather than a false success.
- **Upgrade safety.** Post-create reads omit provider defaults unless present, while list/subscribers/check include the legacy defaults (`autoRenewing`, `status`, `creatorCoinAmount`, `platformFeeCoins`, `renewalCount`). `POST` and `check` return the creator ID string; `list` and `subscribers` populate the legacy avatar-aware person DTO. Cancellation only flips `active`, preserving the legacy subscription history and status.
- **Notification.** After commit the creator receives a `SUBSCRIPTION` notification titled `New subscriber` with the legacy body and `{ subscriberId, plan }` data. The existing notification trigger creates the fixture push job.
- **Concurrent replay.** `0023_subscription_unique.sql` adds the legacy unique `(subscriber_id, creator_id)` key plus lookup indexes. The guarded insert also checks for an active row, so concurrent duplicate requests either return the legacy 409 or are rejected by the unique key and recovered as 409. As in the legacy unique index, cancelling does not free the pair for a new row.

## Files

- `backend-server/apps/api/src/migration/d1Subscriptions.ts`
- `backend-server/apps/api/src/migration/d1App.ts` (mount)
- `backend-server/apps/api/migrations/d1/0023_subscription_unique.sql`
- `backend-server/apps/cloudflare-worker/test/d1-subscriptions.mjs`
- `backend-server/apps/cloudflare-worker/test/auth-worker.mjs` (fixture wiring and migration list)

`0023_subscription_unique.sql` has not been applied to the recovered local database or hosted D1; fresh fixture emulators apply it.

## Verification (run)

- `npm.cmd run typecheck --workspace @yugm/api` — passed.
- `npm.cmd run typecheck --workspace @yugm/cloudflare-worker` — passed (both configs).
- `npm.cmd run test:auth-worker --workspace @yugm/cloudflare-worker` — 1/1 passed. The fixture covers auth, body and ObjectId validation, self/missing-creator errors, insufficient funds, frozen wallet, both plans and expiry windows, 201 response shape, exact ledger metadata and balances, notification and push job, duplicate conflict without a second debit, list/subscribers populated DTOs, check present/absent, cancel and replay, and per-user isolation.
- `npm.cmd run audit:d1-endpoints -- --missing` — 253 shared / 385 legacy-only; `/api/subscriptions` 5/0.
- `git diff --check` — no whitespace errors (LF/CRLF notices only).

## Not run / open

- Full API suite, production Worker fixture, push queue suite, production dry-run bundle, Android journeys, hosted migrations, live payments, FCM and realtime delivery.
- `0020`, `0021`, `0022` and `0023` are not applied to the local recovered database or hosted D1. The Worker fixture applies them in a fresh emulator.
- No D1 realtime emitter publishes subscription events. MongoDB remains authoritative; do not deploy, import data or retire MongoDB without explicit authorization.
