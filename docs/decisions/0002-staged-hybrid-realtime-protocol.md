# ADR-0002 — Staged hybrid realtime protocol

**Date:** 2026-11-22
**Status:** Accepted in principle. Inputs still required: old-client support window, hibernation/cost requirement, event-inventory sign-off and the Android `BONDS` topic decision.
**Decision request:** DCR-3 in [decision-request.md](../cloudflare-migration/decision-request.md).

## Decision

Adopt **Option C — staged hybrid**:

1. Keep a tested Socket.IO/Engine.IO compatibility adapter for installed Android clients during a defined support window.
2. Add a versioned native Durable Object WebSocket protocol for new clients, with explicit event IDs, deduplication and recovery cursors.
3. Publish events to both paths during the migration window, then retire the adapter on an agreed cutoff date.

No protocol is treated as interchangeable without a compatibility suite. The experimental non-hibernating Engine.IO bridge in `apps/cloudflare-worker/src/socketBridge.ts` is **not** the production adapter.

## Rationale

The owner selected the hybrid path on 2026-11-22. It preserves continuity for existing clients while allowing the native protocol to use hibernating Durable Objects and durable delivery semantics. It is more complex than a single-path choice but avoids breaking installed clients or locking the target architecture to Engine.IO internals.

## Consequences

- Both wire protocols must remain implemented and tested until the cutoff date; this is a deliberate temporary cost.
- The [source-verified event inventory](../migration/realtime-event-inventory.md) (47 shared events, 16 PK events, plus off-catalog literals) must be accepted before implementation.
- A dual-test matrix is required: reconnect, restart, ordering, duplicate suppression and room/DM/gift/PK parity for both paths.
- Hibernation and cost targets cannot be claimed until the native path is live and measured.
- The Android `BONDS` sync topic mismatch and hardcoded catalog/reaction fallbacks must be resolved as part of the client migration slice.
- The old-client support window and cutoff date must be recorded here before any adapter removal.

## Local contract foundation (2026-11-22)

A local, unwired first slice was added under the DCR-5 authorization:

- `backend-server/packages/shared/src/realtimeProtocol.ts` — version-1 envelope (`id`, per-scope `seq`, `scope`, `delivery` class, `at`, `ackRequired`), resume frame with bounded `seenIds`, and a command-ack shape that requires `eventId` for a committed result or `error` for a rejection. It also provides bounded per-scope replay/dedupe state and an event-coverage harness built from the source-verified inventory (47 shared + 16 PK + 17 off-catalog literals + 3 Android-only listeners = 83 names).
- The module is exported from `@yugm/shared` but is **not** imported by the Worker, API, Durable Object, Android client or any adapter.
- `backend-server/packages/shared/src/realtimeProtocol.test.ts` — 8 unit tests for schema validation, catalog coverage, missing/extra detection and dedupe/replay eviction.

**Verification actually run:** `npm.cmd run typecheck --workspace @yugm/shared`, `npm.cmd run test --workspace @yugm/shared` (8/8 passed) and `npm.cmd run typecheck --workspace @yugm/api` all passed. No build, deploy, provision or client release was run.

An executable parity matrix was added alongside it in `backend-server/packages/shared/src/realtimeParity.ts`: a transport-agnostic `ParityTransport` interface, 6 scenarios (reconnect/resume, duplicate ID, stale sequence, scope isolation, room-join ack and a `BONDS` invalidation case marked sign-off-required) and 10 documented requirements from the inventory (commit-before-ack, wallet-debit-before-emit, PK ordering/idempotency, fan-out, typing/force authorization, dead listeners and the support-window cutoff). `runParityMatrix` skips sign-off scenarios unless `includeSignOff` is set. A conforming in-memory test double passes 12/12 shared tests, and a deliberately broken double is detected. No real adapter exists yet.

This foundation does not resolve the open support-window, hibernation, event-classification or `BONDS` decisions, and it is not evidence that the two protocols are interoperable.

## Non-goals

- No immediate removal of Socket.IO, the Redis adapter or LiveKit.
- No production deploy, provisioning or client release is authorized by this ADR.
- No assumption that the current bridge satisfies the compatibility requirements.
