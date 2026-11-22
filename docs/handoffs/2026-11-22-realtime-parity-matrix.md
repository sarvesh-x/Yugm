# Handoff — Realtime parity matrix

**Date:** 2026-11-22
**Task:** YUGM-MIGRATION-000 — DCR-3 parity harness, local code and tests only.

## Done

- Added `backend-server/packages/shared/src/realtimeParity.ts`: a transport-agnostic parity matrix for the staged hybrid protocol in [ADR-0002](../decisions/0002-staged-hybrid-realtime-protocol.md).
  - `ParityTransport` defines the adapter surface: connect/disconnect/restart, command ack, server publish, and per-peer delivery drain.
  - 6 executable scenarios: reconnect/resume from cursor, duplicate event ID suppression, stale sequence drop, scope isolation, authoritative room-join ack, and a `BONDS` invalidation case marked sign-off-required.
  - `PARITY_REQUIREMENTS` records 10 sourced requirements that still need real adapter support: commit-before-ack, wallet-debit-before-emit, PK state-version ordering, PK idempotency, fan-out parity, typing authorization, `pk:force_ended` authorization, dead voice listeners, no-consumer events, and support-window/cutoff.
  - `runParityMatrix` skips sign-off-dependent scenarios unless `includeSignOff` is set.
- Exported the matrix from `@yugm/shared` and added `backend-server/packages/shared/src/realtimeParity.test.ts` with 4 tests using a clearly marked in-memory test double.
- Updated `docs/decisions/0002-staged-hybrid-realtime-protocol.md`, `docs/migration/realtime-plan.md`, `docs/INDEX.md`, `docs/CURRENT_TASK.md` and `docs/DEVELOPMENT_PROGRESS.md`.

## Verification performed

- `npm.cmd run test --workspace @yugm/shared` — 12/12 passed.
- `npm.cmd run typecheck --workspace @yugm/shared` — passed.
- `npm.cmd run typecheck --workspace @yugm/api` — passed.
- A deliberately broken in-memory double was detected by the duplicate-delivery scenario.
- No adapter, Durable Object, Android client, runtime path, database, bucket, remote service, credential or production data was touched. Nothing committed or pushed.

## Important limitation

This matrix has only run against an in-memory test double. It is **not** evidence that the Socket.IO compatibility path and the native Durable Object protocol interoperate. The sign-off-gated `BONDS` case is skipped by default, and the 10 documented requirements are not executable until a real adapter supplies the necessary observables.

## Remaining / next

1. Owner supplies DCR-3 inputs: old-client support window, hibernation/cost requirement, event-inventory sign-off and the Android `BONDS` topic decision.
2. Implement the compatibility adapter and native Durable Object protocol under a separate authorization.
3. Run this matrix against both real paths, plus two-client/staging validation, before any realtime cutover.
4. DCR-4 scope, DCR-2 capacity metrics/Workers Paid, credential rotation and a tested restore remain open.
5. Commit, push, provision and deploy require separate explicit approval.
