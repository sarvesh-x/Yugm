# D1 gifts mutations

- **Date:** 2026-11-25
- **Slice:** Mount 5 legacy `/api/gifts` mutation routes on the shared D1 Worker: purchase, combo, room-wide, surprise-box, upgrade.

## What changed

- Extended `backend-server/apps/api/src/migration/d1GiftCatalog.ts` with mutation routes mounted through the existing D1 gift catalog router in `backend-server/apps/api/src/migration/d1App.ts`.
- Routes: `POST /gifts/purchase`, `POST /gifts/combo`, `POST /gifts/room-wide`, `POST /gifts/surprise-box`, `POST /gifts/upgrade`.
- Added fixture coverage in `backend-server/apps/cloudflare-worker/test/d1-endpoints.mjs`.

## Behavior preserved

- Auth required; legacy body validation preserved (`giftId`, `roomId`, `participants`, `receiverIds`, `tier`, `inventoryId`).
- `combo` remains fail-closed with legacy 409 conflict (`approval from every payer` unavailable).
- Purchase: active non-bond gift, VIP-gift access check, wallet-frozen/insufficient-balance guards, guarded debit + inventory insert.
- Surprise-box: tier pricing/rarity pool, guarded debit, inventory quantity upsert behavior via update+insert.
- Upgrade: ownership/upgradeable/path checks, guarded debit, consume/decrement source inventory, add upgraded inventory.
- Room-wide: max 100 receivers, receiver validation, sender total debit guard, per-receiver credit + gift transaction; pre-validates receivers and refunds unprocessed receivers on mid-loop failure.

## Boundaries

- D1 `gift_inventories` schema lacks the Mongo unique `(user_id, gift_id)` index; mutations use guarded update+insert/check patterns. Schema parity audit needed before hosted cutover.
- Room-wide XP grants are not wired in D1 (legacy grants sender/receiver XP after commit); response returns `xpGrant` with undefined values.
- Room-wide is not a single atomic D1 transaction across all receivers; sender debit is guarded and unprocessed receivers are compensated on failure, but rare mid-loop failures need reconciliation.
- No new migration. MongoDB remains authoritative.

## Verification

- `npm.cmd run typecheck` (backend-server) — passed.
- `npm.cmd run audit:d1-endpoints -- --missing` — 638 legacy / 573 D1 / 567 matched / 71 missing; `/api/gifts` 8/0.
- `npm.cmd run test:auth-worker --workspace apps/cloudflare-worker` — passed (1/1).
- `npm.cmd run secrets:check:strict` — passed.
- Scoped `git diff --check` — warning only: LF/CRLF in `d1GiftCatalog.ts`.