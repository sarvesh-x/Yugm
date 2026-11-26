# D1 payout webhook

- **Date:** 2026-11-26
- **Slice:** Mount `POST /api/payments/webhook/payout` on the shared D1 Worker.

## What changed

- Added `backend-server/apps/api/src/migration/d1PayoutWebhook.ts`.
- Wired the route before `express.json()` in `d1App.ts` with `express.raw({ type: "application/json" })`.
- Added `payoutWebhookSecret` to the D1 wallet config and passed `RAZORPAY_WEBHOOK_SECRET` from the Worker env.
- Added fixture coverage in `test/d1-admin.mjs` (called from `test/auth-worker.mjs`).

## Behavior preserved

- Raw-body HMAC verification uses the existing `isValidRazorpayWebhook` helper; missing secret returns the legacy `501`, bad signature `401`, invalid JSON `400`, missing payout id `400`.
- `payout.processed` transitions only rows whose `provider_status` is not already `PROCESSED`, sets review `PAID`/`PROCESSED`/`processed_at`, and pays the linked withdrawal with `paid_at`, `active_lock = 0`, and `payout_reference`.
- `payout.reversed`/`rejected`/`failed` transition only rows not already in that terminal reason, set the review failure reason, reject the linked withdrawal, clear the active lock, and write `metadata.payoutProviderStatus`/`payoutFailureReason`/`payoutProviderId`.
- Replays return `{ ok: true, received, duplicate: true }`; unknown payout IDs return `{ matched: false }` without error, matching legacy behavior.
- Audit rows (`PAYOUT_WEBHOOK_PROCESSED`, `PAYOUT_WEBHOOK_REVERSED|REJECTED|FAILED`) are written in the same batch as the state transition.

## Boundaries

- The transition and audit writes are one D1 batch instead of the legacy separate Mongoose writes; a batch failure rolls the whole transition back.
- The review `failure_reason` is only overwritten when the provider supplies one, mirroring Mongoose's stripped `undefined` field.
- No new migration. MongoDB remains authoritative.

## Verification

- `npm.cmd run typecheck` (backend-server) — passed.
- `npm.cmd run audit:d1-endpoints -- --missing` — 638 legacy / 578 D1 / 572 matched / 66 missing; `/api/payments` 1/0.
- `npm.cmd run test:auth-worker --workspace apps/cloudflare-worker` — passed (1/1), including signature rejection, processed, duplicate, reversal, and missing-payout fixtures.
- `npm.cmd run secrets:check:strict` — passed.
- Scoped `git diff --check` — warning only: LF/CRLF in `test/d1-admin.mjs`.
