# D1 referrals routes

## Scope

Mounted all four legacy `/api/referrals` HTTP patterns on the shared D1 Worker on 2026-11-25. MongoDB remains authoritative. No deploy, hosted migration, seed or hosted data operation was performed.

| Route | Behavior |
| --- | --- |
| `POST /api/referrals/code` | Lazily generates and persists a stable 10-character uppercase referral code. |
| `GET /api/referrals/code` | Returns the same stable code, generating it only when absent. |
| `POST /api/referrals/claim` | Validates the code and claimant state, credits both accounts and records the referral. |
| `GET /api/referrals/stats` | Returns per-user counts, total rewarded coins and the latest 50 referrals. |

The current audit reports `legacy 638 / d1 258 / matched 253 / missing 385`, with `/api/referrals` at `4 mounted / 0 missing`. The four patterns account for part of the increase from the previous 244 shared patterns.

## Behavior notes

- **Code generation.** The legacy prefix (up to four alphanumeric characters from the user name) plus a random three-byte uppercase suffix is preserved. Generation is guarded by `referral_code IS NULL` and a `NOT EXISTS` code collision check, with a re-read after a failed attempt so concurrent generation returns the persisted code.
- **Validation order.** Authentication runs before Zod body validation. A claim then resolves the referrer, rejects self-referral, resolves the claimant and checks for any previous claim in that order, preserving the legacy error messages and status codes.
- **Replay.** A prior `REWARDED` referral for the same referrer returns `{ reward, message: "Referral code applied" }` without new credits. A `COMPLETED` record or an existing `referred_by` value returns 409. Codes are trimmed and uppercased before lookup.
- **Claim batch.** The claim uses one guarded D1 batch with a scratch `user_auth_profile.edit_token`: claim, `referred_by` update, referral row, two once-only `REFERRAL_BONUS` ledger rows, two balance updates and both wallet-marker clears. Each 100-coin credit uses `referral:<referralId>:claimant` or `referral:<referralId>:referrer` as its idempotency key. A guard miss re-reads authoritative state and converts it into a replay success or 409 instead of emitting a false success.
- **Balance limits.** The guarded credit checks the exact observed balance and `Number.MAX_SAFE_INTEGER - 100` before adding, so overflow and concurrent balance changes cannot produce an unledgered or unsafe credit.
- **Notification.** The referrer notification is inserted after commit and is non-fatal, matching the legacy handler. The existing notification trigger creates the fixture push job.
- **Presence guard.** The claim reuses the shared D1 live-session filter so a stale HTTP session cannot claim a referral. Miniflare does not supply `req.ip`, so `ip_address` is nullable, as in the legacy model.

## Files

- `backend-server/apps/api/src/migration/d1Referrals.ts`
- `backend-server/apps/api/src/migration/d1App.ts` (mount)
- `backend-server/apps/api/migrations/d1/0022_referral_unique.sql`
- `backend-server/apps/cloudflare-worker/test/d1-referrals.mjs`
- `backend-server/apps/cloudflare-worker/test/auth-worker.mjs` (fixture wiring and migration list)

`0022_referral_unique.sql` adds referral/code uniqueness and claim lookup indexes. It has not been applied to the recovered local database or hosted D1; fresh fixture emulators apply it.

## Verification (run)

- `npm.cmd run typecheck --workspace @yugm/api` — passed.
- `npm.cmd run typecheck --workspace @yugm/cloudflare-worker` — passed (both configs).
- `npm.cmd run test:auth-worker --workspace @yugm/cloudflare-worker` — 1/1 passed with the referrals and subscriptions fixtures present. The referrals fixture covers auth, body validation, invalid code, self-referral, prior `COMPLETED` conflict, code persistence, case-insensitive claim, both ledger rows and balances, notification/push job, replay and per-user stats isolation.
- `npm.cmd run audit:d1-endpoints -- --missing` — 253 shared / 385 legacy-only; `/api/referrals` 4/0.
- `git diff --check` — no whitespace errors (LF/CRLF notices only).

## Not run / open

- Full API suite, production Worker fixture, push queue suite, production dry-run bundle, Android journeys, hosted migrations, live payments, FCM and realtime delivery.
- `0020`, `0021`, `0022` and `0023` are not applied to the local recovered database or hosted D1. The Worker fixture applies them in a fresh emulator.
- No D1 realtime emitter publishes referral events. MongoDB remains authoritative; do not deploy, import data or retire MongoDB without explicit authorization.
