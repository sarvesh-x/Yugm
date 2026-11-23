# Handoff — Legacy Socket.IO compatibility adapter

**Date:** 2026-11-23
**Task:** YUGM-MIGRATION-000 — DCR-3 dual-path local foundation.

## Done

- Added `backend-server/packages/shared/src/legacyRealtimeAdapter.ts`, exported from `@yugm/shared`.
- Legacy routing is validated and mapped to native scopes (room/clan/dm/user precedence).
- Native envelopes convert to legacy emit frames with protocol internals stripped.
- Legacy socket acknowledgements convert to native acks that can only claim `committed: true` when the caller supplies an eventId from an authoritative write.
- The 90-day support cutoff is derived from an owner-supplied GA date; the window closes at the cutoff boundary.
- Event classification is conservative: unambiguous events are classified, everything else is `unknown`.
- Added inventory coverage reporting via the existing `checkEventCoverage` harness.

## Verification performed

- `npm.cmd run test --workspace @yugm/shared` — 25/25 passed.
- `npm.cmd run typecheck --workspace @yugm/shared` — passed.
- `npm.cmd run typecheck --workspace @yugm/cloudflare-worker` — passed.
- No binding, deploy, credential, live socket or production data access. These changes are uncommitted.

## Important limitation

This is a translation harness only. It is not connected to a Socket.IO server, a Durable Object or any runtime path. It does not authenticate, publish authoritative events, or prove interoperability. The GA date is a parameter — the module never invents one.

## Remaining / next

1. Owner records the native GA date and derives the 90-day cutoff.
2. Wire authoritative event publication so committed acks carry a real eventId.
3. Wire the adapter into the legacy path for the support window.
4. Run the parity matrix against both real paths before cutover.
5. Commit/push of this slice requires new explicit authorization (the previous authorization was consumed by `0065555`).
