# Handoff — Native Durable Object skeleton

**Date:** 2026-11-23
**Task:** YUGM-MIGRATION-000 — DCR-3 hibernation-compatible adapter foundation.

## Done

- Added `backend-server/apps/cloudflare-worker/src/nativeRealtimeDo.ts` with a Durable Object skeleton for the native protocol.
- Connection identity and scope are stored in WebSocket attachments; cursor, seen IDs, sequences and bounded history are stored in Durable Object storage rather than long-lived in-memory fields.
- The class handles WebSocket upgrades, matching-scope resume frames and typed envelopes, and exposes a `publish()` method for future authoritative publishers.
- Added the file to Worker typecheck configuration. It is not exported from `index.ts` and has no Wrangler binding, so it cannot receive traffic.

## Verification performed

- `npm.cmd run typecheck --workspace @yugm/cloudflare-worker` — passed.
- No Wrangler deploy, live WebSocket, credential, binding change or production data access. These changes are uncommitted.

## Important limitation

This is a typechecked skeleton only. It does not authenticate users, enforce resource membership, persist authoritative events before fan-out, wire the compatibility adapter, run on staging, or prove interoperability. Hibernation suitability is a design property of the storage/attachment approach, not a measured result.

## Remaining / next

1. Add authenticated upgrade handling and resource-membership checks before creating a DO stub.
2. Connect authoritative event publication so durable events commit before fan-out/ack.
3. Wire the legacy Socket.IO compatibility adapter for the 90-day support window.
4. Run the parity matrix against both real paths before any realtime cutover.
5. Commit/push of this slice requires separate explicit authorization.
