# ADR-0002 — Staged hybrid realtime protocol

**Date:** 2026-11-22
**Status:** Accepted; decision gate complete. Owner inputs recorded 2026-11-23: 90-day legacy support window, hibernation as a hard requirement, acceptance of the 83-name event inventory, and a server BONDS invalidation emitter. Runtime implementation and cutover remain separately gated.
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

## Owner inputs recorded 2026-11-23

1. **Legacy support window:** installed Android clients using Socket.IO/Engine.IO remain supported for **90 days after native protocol GA**. The cutoff date must be written into this ADR when native GA is set; the compatibility adapter is not removed before that date.
2. **Hibernation/cost:** hibernation compatibility is a **hard requirement** for the native Durable Object path, with cost measured before cutover. A non-hibernating implementation is not acceptable for the native target.
3. **Event inventory:** the owner accepts the source-verified **83-name baseline** (47 shared, 16 PK, 17 off-catalog literals and 3 Android-only listeners) as the DCR-3 classification input. Newly discovered events must be added deliberately.
4. **BONDS topic:** the server emits `BONDS` in `sync:invalidate` for `/api/bonds/*` mutations so existing Android BONDS listeners receive authoritative invalidation. The first local slice maps all `/bonds` mutations to `["BONDS", "PROFILE", "TASKS"]` with no payload data; it is an invalidation, not proof of commit.

These inputs close the DCR-3 decision gate. They do not implement the compatibility adapter, native Durable Object protocol, Android migration or two-path cutover.

## Local contract foundation (2026-11-22)

A local, unwired first slice was added under the DCR-5 authorization:

- `backend-server/packages/shared/src/realtimeProtocol.ts` — version-1 envelope (`id`, per-scope `seq`, `scope`, `delivery` class, `at`, `ackRequired`), resume frame with bounded `seenIds`, and a command-ack shape that requires `eventId` for a committed result or `error` for a rejection. It also provides bounded per-scope replay/dedupe state and an event-coverage harness built from the source-verified inventory (47 shared + 16 PK + 17 off-catalog literals + 3 Android-only listeners = 83 names).
- The module is exported from `@yugm/shared` but is **not** imported by the Worker, API, Durable Object, Android client or any adapter.
- `backend-server/packages/shared/src/realtimeProtocol.test.ts` — 8 unit tests for schema validation, catalog coverage, missing/extra detection and dedupe/replay eviction.

**Verification actually run:** `npm.cmd run typecheck --workspace @yugm/shared`, `npm.cmd run test --workspace @yugm/shared` (8/8 passed) and `npm.cmd run typecheck --workspace @yugm/api` all passed. No build, deploy, provision or client release was run.

A pure server-side native transport foundation was added in `backend-server/packages/shared/src/nativeRealtimeServer.ts`: per-scope sequence assignment, connection scope isolation, receiver dedupe, bounded history and resume replay using the v1 schemas. It is exported from `@yugm/shared` with 7 tests and now also parses command frames and validates authoritative ack shapes; without a configured command handler it rejects commands rather than claiming commit. A hibernation-compatible Durable Object skeleton was added in `backend-server/apps/cloudflare-worker/src/nativeRealtimeDo.ts`: connection identity/scope are stored in WebSocket attachments, while cursors, seen IDs, sequences and bounded history live in Durable Object storage. It is typechecked but not exported from `index.ts`, has no Wrangler binding, and cannot receive traffic yet. A pure legacy compatibility adapter was added in `backend-server/packages/shared/src/legacyRealtimeAdapter.ts`: it maps legacy routing to native scopes, translates envelopes into legacy emit frames, converts legacy socket acks into native acks that never claim commit without an authoritative eventId, computes the 90-day support cutoff from an owner-supplied GA date, and reports inventory coverage. Event classification is conservative and defaults to `unknown` pending source-verified sign-off. A pure [serialized operations primitive](../../backend-server/packages/shared/src/serializedOperations.ts) was added so the DO skeleton serialises sequence allocation, bounded history and connection-cursor updates; without it two concurrent publishers could allocate the same sequence or lose a cursor write. It is an in-flight lock requiring no persistence because hibernation happens only when idle. No Android client or runtime path consumes any of these modules.

An executable parity matrix was added alongside it in `backend-server/packages/shared/src/realtimeParity.ts`: a transport-agnostic `ParityTransport` interface, 6 scenarios (reconnect/resume, duplicate ID, stale sequence, scope isolation, room-join ack and a `BONDS` invalidation case marked sign-off-required) and 10 documented requirements from the inventory (commit-before-ack, wallet-debit-before-emit, PK ordering/idempotency, fan-out, typing/force authorization, dead listeners and the support-window cutoff). `runParityMatrix` skips sign-off scenarios unless `includeSignOff` is set. A conforming in-memory test double passes 12/12 shared tests, and a deliberately broken double is detected. No real adapter exists yet.

The DCR-3 decisions are now recorded above. The contract and parity matrix are still harnesses, not evidence that the two protocols are interoperable or that any runtime migration has occurred.

## Non-goals

- No immediate removal of Socket.IO, the Redis adapter or LiveKit.
- No production deploy, provisioning or client release is authorized by this ADR.
- No assumption that the current bridge satisfies the compatibility requirements.
