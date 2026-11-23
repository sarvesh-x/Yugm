# Handoff — Durable Object publish race fix

**Date:** 2026-11-23
**Task:** YUGM-MIGRATION-000 — DCR-3 local harness correctness.

## Done

- Added `backend-server/packages/shared/src/serializedOperations.ts`, a pure async serialisation primitive with 2 tests.
- The DO skeleton now routes `publish()` and `resume()` through the primitive, so sequence allocation, bounded history and connection-cursor read-modify-write units cannot interleave.
- Without the fix, two concurrent publishers could allocate the same per-scope sequence and overwrite each other's history, and a resume could race a publish on a connection cursor.
- Updated ADR-0002, realtime plan, `INDEX.md`, `CURRENT_TASK.md` and progress docs.

## Verification performed

- Shared tests — 27/27 passed.
- Shared and Worker typechecks — passed.
- Full API suite — 462/462 passed.
- Strict credential guard — zero findings.
- No binding, deploy, credential or production data access. These changes are uncommitted.

## Important limitation

This is an in-flight lock only and does not persist across hibernation; that is safe because Durable Objects hibernate only when idle. It does not provide storage-level isolation against other writers, prove interoperability, or wire the DO into any runtime path.

## Remaining / next

1. Owner supplies the native GA date and authorises authoritative publication wiring.
2. Run the parity matrix against both real paths before any realtime cutover.
3. Commit/push of this slice requires explicit authorization.
