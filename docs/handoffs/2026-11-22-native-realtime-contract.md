# Handoff — Native realtime protocol contract foundation

**Date:** 2026-11-22
**Task:** YUGM-MIGRATION-000 — next unblocked local slice for DCR-3 Option C under the DCR-5 local-code-and-tests authorization.

## Done

- Added `backend-server/packages/shared/src/realtimeProtocol.ts`:
  - version-1 `nativeEnvelopeSchema` with `id`, per-scope `seq`, `scope`, delivery class, timestamp and `ackRequired`;
  - `nativeResumeSchema` with a bounded `seenIds` list;
  - `nativeCommandAckSchema`, which requires `eventId` for a committed result and `error` for a rejection;
  - bounded per-scope replay/dedupe state (`createReplayState`, `isStale`, `acceptEnvelope`, `shouldDeliver`);
  - `requiredRealtimeEventNames` and `checkEventCoverage` for parity harnesses.
- Exported the module from `@yugm/shared` via `src/index.ts` using an explicit `.js` relative specifier so both Bundler and NodeNext resolution work.
- Added `backend-server/packages/shared/src/realtimeProtocol.test.ts` with 8 tests and a `test` script in the shared workspace, picked up by the root `npm test` aggregation.
- Updated `docs/migration/realtime-plan.md`, `docs/decisions/0002-staged-hybrid-realtime-protocol.md`, `docs/INDEX.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md` and `MIGRATION_PROGRESS.md`.

## Verification performed

- `npm.cmd run typecheck --workspace @yugm/shared` — passed.
- `npm.cmd run test --workspace @yugm/shared` — 8/8 passed.
- `npm.cmd run typecheck --workspace @yugm/api` — passed, confirming the new shared export does not break NodeNext consumers.
- Event constants re-checked against `docs/migration/realtime-event-inventory.md` and source: 47 shared events, 16 PK events, 17 off-catalog literals and 3 Android-only listeners (83 unique names).
- No build, deploy, provision, credential operation, migration or production data access was performed. Nothing was committed or pushed.

## Remaining / next

1. Owner to supply the DCR-3 inputs: old-client support window, whether hibernation/cost reduction is a hard requirement, event-inventory sign-off and the Android `BONDS` topic decision.
2. Classify events in code only after sign-off; durable events must be written to the authoritative store before ack.
3. Build the two-client parity matrix (reconnect, restart, ordering, duplicate suppression, room/DM/gift/PK) before any adapter or cutover work. The experimental Engine.IO bridge in `apps/cloudflare-worker/src/socketBridge.ts` is not the production adapter.
4. DCR-4 R2 scope, DCR-2 capacity metrics/Workers Paid, owner credential rotation and a tested restore remain prerequisites for any cutover.
5. Commit, push, deploy, provisioning and client release each require separate explicit approval.
