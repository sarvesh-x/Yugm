# D1 room gift transfers

`POST /api/rooms/:id/send-gift` now uses D1 in both Worker entrypoints. The transaction checks the sender’s session, room membership, blocking, wallet freeze, VIP entitlement, catalog price and stock or inventory. It debits the sender when appropriate, credits the creator, records the ledger entries, adds eligible user and relationship XP, and records the gift notification, room activity and chat entry. An error rolls back the entire transfer. [D1 batch transactions](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)

Request keys are scoped to the sender. Matching retries return the existing transfer, and reuse with different gift details or inventory item fails with HTTP 409. Android supplies a UUID in each room gift HTTP request body, so retries of that request use the same key. Inventory sends use a backpack item and preserve the sender’s coin balance. Diamond sends are available when `MONETIZATION_DIAMONDS_ENABLED` is enabled. Both checked-in Worker configurations keep diamonds disabled, and the local fixture enables them to exercise both diamond ledger entries.

Migration `0019_room_gift_transfers.sql` adds the request-key index and the persistent UTC-day gift relationship XP cap. The Worker uses a dedicated Cloudflare rate limit of 20 room gift requests per 10 seconds, matching the legacy limiter.

## Verification

- `node --test apps/cloudflare-worker/test/auth-worker.mjs apps/cloudflare-worker/test/production-worker.mjs` passed both Worker fixtures. The room gift fixture covers authorization, frozen wallets, insufficient funds, rollback on ledger failure, concurrent key replay, mismatched replay, inventory consumption, diamond ledger writes and a last-unit stock race.
- The API and Worker `typecheck` scripts, 15 focused gift authorization and replay tests, and `git diff --check` passed. Android `:core:api:compileDebugKotlin --max-workers=1` passed. The debug Worker returned HTTP 401 for an anonymous gift send and HTTP 200 for readiness.
- `npm run audit:d1-endpoints -- --missing` reported 638 legacy patterns, 227 D1 patterns, 222 shared and 416 legacy-only. All 59 room route patterns are mounted.
- Applied `0019` to the recovered emulator database named `yugm`. [Wrangler migration targeting](https://developers.cloudflare.com/d1/reference/migrations/)

Realtime gift fan-out, cutover to a live RTC provider, hosted verification and Android UI acceptance remain open. The remaining non-room APIs and legacy data cutover still gate MongoDB retirement.
