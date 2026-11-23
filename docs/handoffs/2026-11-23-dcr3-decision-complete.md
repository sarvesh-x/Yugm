# Handoff — DCR-3 decision complete

**Date:** 2026-11-23
**Task:** YUGM-MIGRATION-000 — close DCR-3 decision gate and stage the accepted BONDS invalidation emitter.

## Done

- Recorded all four owner inputs in [ADR-0002](../decisions/0002-staged-hybrid-realtime-protocol.md):
  - 90-day legacy Socket.IO support window after native GA.
  - Hibernation/cost reduction is a hard requirement for the native DO path.
  - Source-verified 83-name event inventory accepted as the DCR-3 baseline.
  - Server emits `BONDS` in `sync:invalidate` for `/api/bonds/*` mutations.
- Updated the DCR-3 decision request, realtime plan, `REALTIME_EVENTS.md`, `CURRENT_TASK.md`, `DEVELOPMENT_PROGRESS.md` and `MIGRATION_PROGRESS.md`.
- Implemented the accepted BONDS emitter: `/api/bonds/*` mutations now produce `["BONDS", "PROFILE", "TASKS"]` invalidation topics with no payload data. Added one middleware test.

## Verification performed

- `npm.cmd exec -- tsx --test src/middleware/syncInvalidation.test.ts` — 6/6 passed.
- `npm.cmd run typecheck --workspace @yugm/api` — passed.
- No credential, database, Cloudflare account, deploy or production data access. These changes are uncommitted.

## Important limitation

DCR-3 is a **decision gate**, not a runtime cutover. No compatibility adapter, native hibernating DO protocol, Android migration, cutoff-date record or dual-path parity execution exists yet. The BONDS emitter is an invalidation only; the HTTP response remains proof of commit.

## Remaining / next

1. Record the native GA date and derive the 90-day adapter cutoff.
2. Implement and test the compatibility adapter and hibernating native DO protocol.
3. Run the parity matrix against both real paths before any realtime cutover.
4. Commit/push of this DCR-3 decision and BONDS emitter requires separate explicit authorization.
