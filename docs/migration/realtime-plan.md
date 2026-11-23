# Realtime migration plan

**Date:** 2026-11-22  
**Status:** Phase 0 decision gate complete. DCR-3 Option C (staged hybrid) is selected in [ADR-0002](../decisions/0002-staged-hybrid-realtime-protocol.md); owner inputs were recorded 2026-11-23 (90-day support window, hibernation hard requirement, 83-name inventory accepted, BONDS emitter chosen). A local, unwired [native contract foundation](../../backend-server/packages/shared/src/realtimeProtocol.ts) exists. No runtime adapter, native DO protocol, client migration or cutover has been implemented or approved.

## Current observed protocol

The Android client and Worker prototype use Socket.IO/Engine.IO 4 over WebSocket transport. The experimental Worker bridge accepts `/socket.io` upgrades, verifies the Engine.IO handshake with existing server authentication, and hands the transport to the existing Socket.IO server. Local tests cover authentication, room-join acknowledgement, typing events, room broadcasts, bonds events, heartbeat, reconnect grace, invalid/revoked tokens and room closure.

The existing bridge:

- Uses non-hibernating Durable Object WebSockets.
- Keeps Engine.IO/Socket.IO handlers and process-local state.
- Depends on Engine.IO internals and must be retested after dependency changes.
- Has incomplete process-restart recovery for room presence and disconnect cleanup.
- Has no observed two-client Android validation, duplicate/out-of-order event test, or production load measurement.

## Decision gate

Choose one of two paths before implementation:

1. **Compatibility adapter:** preserve the Socket.IO/Engine.IO wire protocol behind a tested adapter on Durable Objects. This minimizes Android/admin changes but requires reproducing handshake, authentication, rooms, acknowledgements, heartbeats, reconnection and idempotent event delivery. Hibernation may be constrained by adapter state.
2. **Versioned native protocol:** define a new event envelope on native Durable Object WebSockets, with a client migration window and dual support. This enables hibernation and explicit event IDs/dedupe but requires Android/admin changes and a cutover plan.

Do not treat ordinary WebSockets as interchangeable with Socket.IO without this decision and a compatibility test suite. The source-verified [event inventory](realtime-event-inventory.md) is the input to this decision; the historical `docs/production/socket-inventory.csv` has only 11 `NOT VERIFIED` registrations in `services/socket.ts` and is not sufficient.

The owner selected the staged hybrid path (Option C), so both paths are required during the support window. The native envelope, resume frame, command-ack shape, dedupe/replay state and event-coverage harness are defined locally in `backend-server/packages/shared/src/realtimeProtocol.ts` with 8 passing unit tests. That module is a **contract and test harness only**: no Durable Object, adapter, Android client or runtime path consumes it yet, and no event has been classified in code pending inventory sign-off. A pure [server-side native transport](../../backend-server/packages/shared/src/nativeRealtimeServer.ts) assigns per-scope sequences, fans out envelopes with receiver dedupe, handles bounded resume replay and routes command frames through a validated authoritative ack shape. An [unwired Durable Object skeleton](../../backend-server/apps/cloudflare-worker/src/nativeRealtimeDo.ts) stores connection identity/scope in WebSocket attachments and keeps cursors, seen IDs, sequences and bounded history in Durable Object storage for hibernation compatibility; it has no binding or runtime entry point yet. A companion transport-agnostic [parity matrix](../../backend-server/packages/shared/src/realtimeParity.ts) defines 6 executable scenarios and 10 documented requirements; it runs against a test double today and must be run against both real paths before cutover. Sign-off-dependent cases are skipped by default; DCR-3 sign-off is now recorded, so the BONDS case can be enabled with `includeSignOff` when a real adapter exists.

## Durable Object scoping

Scope objects by coordination boundary:

| Boundary | Candidate object ID | Responsibility |
|---|---|---|
| Conversation/direct chat | Stable conversation/user-pair ID | Message ordering, presence, typing, read state, fan-out, recovery cursor |
| Room | Room ID | Participant presence, role/mute state, chat broadcasts, PK coordination, closure |
| User/session | User ID or session family | Cross-device presence invalidation, notification routing, connection registry |
| PK battle | Battle ID | Deadlines, state version, vote/tick coordination and finalization |

Avoid one global object. Per-object throughput is single-threaded with a soft limit near 1,000 requests/s; overloaded objects must be avoided by scoping and batching.

## Required semantics

- Authenticate the HTTP upgrade before creating a Durable Object stub. Deny invalid/revoked sessions and enforce resource membership for each subscription/event.
- Persist durable messages in the authoritative database before acknowledgement or fan-out.
- Assign monotonically increasing per-scope event IDs; include event ID, scope, type, version and timestamp in a stable envelope.
- Dedupe on receivers using event ID and scope. Handle out-of-order and duplicate delivery without duplicating side effects.
- On reconnect, provide a cursor/last-seen event ID and replay bounded missed events from durable storage.
- Store only small per-connection state with `serializeAttachment`; keep authoritative state in Durable Object SQLite or the main database.
- Use hibernation-compatible WebSockets where the chosen protocol allows. Batch high-frequency logical events into fewer frames.
- Never send private media URLs or content to unauthorized participants; check ownership, conversation/room/clan membership, block/ban and privacy rules at delivery time.
- Do not send raw audio/video over these WebSockets; RTC remains with LiveKit.

## Migration sequence

1. Inventory every Socket.IO event, listener, acknowledgement, room and authorization check from source; regenerate the socket inventory from a known state.
2. Classify events: durable messages, ephemeral presence/typing, invalidation, admin notifications, RTC signaling and financial side effects.
3. Build compatibility/contract tests for each event with two clients, including failure, duplicate, reconnect and revocation cases.
4. Prototype one low-risk scope (for example typing or invalidation) on a Durable Object, measure hibernation and cost.
5. Move durable message writes and recovery cursors behind a repository boundary before changing transports.
6. Cut over scope by scope behind flags; keep the old transport available for the support window.
7. Validate with Android devices, admin clients, restart/load tests and cost dashboards before removing the bridge.

## Acceptance criteria

- Existing event names/payloads or a documented versioned replacement are covered by contract tests.
- Resource-level authorization is enforced on connect, subscribe and every event.
- Durable messages are written before ack and recovered after reconnect/restart.
- Duplicate/out-of-order events produce no duplicate side effects.
- Hibernation behavior and DO duration/request costs are measured under realistic concurrency.
- Room/clan private-media participant semantics are explicit and tested.
- Android and admin clients pass two-client validation; source inventory matches implementation.
