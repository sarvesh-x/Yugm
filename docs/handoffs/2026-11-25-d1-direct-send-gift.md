# D1 direct-send-gift route

## Scope

Mounted the legacy `POST /api/direct-send-gift` pattern on the shared D1 Worker on 2026-11-25. MongoDB remains authoritative. No deploy, hosted migration, seed or hosted data operation was performed.

The audit reports `legacy 638 / d1 259 / matched 254 / missing 384`, with `/api/direct-send-gift` at `1 mounted / 0 missing`.

## Behavior notes

- **Validation order.** Authentication runs first, then the wallet-frozen guard, body validation, ObjectId and self checks, gift/receiver lookup, VIP gift guard, price/amount guard, diamonds-enabled guard, interact guard and sufficient-funds check. This preserves the legacy 401 → 403 → 422 → 400 → 404 → 403 → 400 → 503 → 403 → 402 ordering.
- **Atomic money commit.** The gift transaction claim, sender debit ledger, receiver credit ledger, both balance updates and both `user_auth_profile` marker clears share one guarded D1 batch. The claim guard is `NOT EXISTS` on a fresh scratch ID; all later statements require that claim row. A guard miss retries up to four times before a 409, so no success is returned before an authoritative commit.
- **Coin and diamond ledgers.** Coin gifts use the legacy `GIFT_SENT_DM` / `GIFT_RECEIVED` sources with the legacy 10% platform fee on the receiver credit. Diamond gifts use the D1 schema-valid `GIFT_SENT` / `GIFT_RECEIVED` diamond sources because D1 `diamond_transactions` excludes the legacy `GIFT_SENT_DM` value. Metadata keeps `giftId`, `senderId`, `platformFee` or `giftValue`.
- **Response and side effects.** The authoritative commit returns `201 { giftTransaction, message, relationship, xpGrant }`. Gift XP, daily relationship XP, the DM with present-inbox DTOs and the `GIFT` notification are non-fatal post-commit side effects. DM text and gift-card media follow the legacy contract (`🎁 Sent you a ${gift.name}!`, gift `icon` as an HTTP(S) or `/` URL with `IMAGE` media type).
- **XP freshness.** Gift XP is computed from a post-commit user read and guarded by unique `xp_grants` action keys (`gift:${id}:sent` / `:received`). The relationship award uses the pre-read version guard and the existing daily cap. A concurrent change yields a conflict instead of double-crediting.
- **Fixture isolation.** The direct-gift fixture uses its own gift IDs and clears only its own daily XP/relationship state. Pre-existing gift rows from the feed fixture do not affect its gift-transaction assertions.

## Files

- `backend-server/apps/api/src/migration/d1DirectGifts.ts`
- `backend-server/apps/api/src/migration/d1App.ts` (mount)
- `backend-server/apps/cloudflare-worker/test/d1-direct-gifts.mjs`
- `backend-server/apps/cloudflare-worker/test/auth-worker.mjs` (fixture wiring)

No new migration was added for this slice.

## Verification (run)

- `npm.cmd run typecheck` from `backend-server` — passed across admin, api, cloudflare-worker (both configs) and shared.
- `npm.cmd run test:auth-worker --workspace @yugm/cloudflare-worker` — 1/1 passed. The fixture covers auth, body/ObjectId validation, self and missing-gift/receiver errors, VIP gating, block and frozen-wallet guards, insufficient funds, a ledger-failure rollback with no gift/message state change, coin and diamond gift commits with exact ledger metadata and balances, gift XP and relationship XP, inbox message DTOs, notification and push job, and replay-safe grant receipts. Expected intentional 500 fixtures from earlier slices still log during the run.
- `npm.cmd run audit:d1-endpoints -- --missing` from `backend-server` — `legacy 638 / d1 259 / matched 254 / missing 384`; `/api/direct-send-gift` 1/0.
- `git diff --check` — no whitespace errors (LF/CRLF notices only).

## Not run / open

- Full API suite, production Worker fixture, push queue suite, production dry-run bundle, Android journeys, hosted migrations, live FCM/realtime delivery and live gift acceptance.
- Local recovered database remains at `0019`; `0020`–`0023` are only applied in fresh fixture emulators. Hosted `0003`–`0023` remain unapplied/unverified.
- No D1 realtime emitter publishes gift events. MongoDB remains authoritative; do not deploy, import data or retire MongoDB without explicit authorization.
