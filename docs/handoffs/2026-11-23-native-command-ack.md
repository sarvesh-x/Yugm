# Handoff — Native command/ack flow

**Date:** 2026-11-23
**Task:** YUGM-MIGRATION-000 — DCR-3 local command semantics.

## Done

- Added `nativeCommandSchema` to the shared realtime protocol.
- `NativeRealtimeRoom.handleFrame()` now accepts command frames, routes them through an optional `NativeCommandHandler`, validates the returned `NativeCommandAck` and sends the ack only to the requesting connection. Without a handler it returns a rejected ack.
- The unwired Durable Object skeleton parses command frames, checks scope, validates acks and exposes a default-rejecting `authorizeCommand()` override point for a future wired subclass.
- Added tests for committed ack, scope mismatch, missing handler and invalid handler ack.
- Updated ADR-0002, realtime plan, `CURRENT_TASK.md` and progress docs.

## Verification performed

- `npm.cmd run test --workspace @yugm/shared` — 19/19 passed.
- `npm.cmd run typecheck --workspace @yugm/shared` — passed.
- `npm.cmd run typecheck --workspace @yugm/cloudflare-worker` — passed.
- No binding, deploy, credential, live WebSocket or production data access. These changes are uncommitted.

## Important limitation

Schema validation does not prove an authoritative write occurred. A wired handler must commit to the source of truth before returning `committed: true`; otherwise it must return a rejected ack. The DO override currently rejects all commands.

## Remaining / next

1. Implement authoritative command handlers (starting with `room:join`) against the real repositories/services.
2. Wire authenticated upgrade and resource membership before DO stub creation.
3. Wire the legacy Socket.IO compatibility adapter for the 90-day support window.
4. Run the parity matrix against both real paths before cutover.
5. Commit/push of this slice requires separate explicit authorization.
