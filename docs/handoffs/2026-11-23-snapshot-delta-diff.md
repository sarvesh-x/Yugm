# Handoff — Snapshot delta diff

**Date:** 2026-11-23
**Task:** YUGM-DB-001 — final delta-sync planning aid, local code and tests only.

## Done

- Added `readDeclaredSnapshotRecords()` to `backend-server/apps/api/src/migration/snapshot.ts` so tools can read manifest-declared batch files with their collection names.
- Added `backend-server/apps/api/src/migration/snapshotDiff.ts`: read-only comparison of two copied snapshots. Reports added/removed/changed records per collection, top-level changed field names, duplicate/invalid source IDs, watermark ordering and a stable report digest. Emits source IDs and content digests only, never record values.
- Added `backend-server/apps/api/src/scripts/snapshot-diff.ts` and npm script `snapshot:diff`:
  `npm run snapshot:diff -- --before <dir> --after <dir> [--max-examples 20] [--out <report.json>]`
- Added `snapshotDiff.test.ts` with 5 tests.
- Updated `docs/migration/final-delta-sync-design.md`, `docs/migration/data-migration-tooling.md`, `docs/migration/BACKUP_AND_RECOVERY.md`, `docs/INDEX.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md` and `MIGRATION_PROGRESS.md`.

## Verification performed

- Targeted `tsx --test` run with backup-verifier and legacy-reference suites — 16/16 passed.
- `npm.cmd run typecheck --workspace @yugm/api` — passed.
- CLI smoke on two generated snapshots — reported 1 removed and 1 changed record with the changed field name only; no record values emitted.
- No MongoDB, D1, R2, Cloudflare account, credential or production data access. These changes are uncommitted.

## Important limitation

This is a planning and verification aid, **not** final delta sync. It does not implement watermark-based delta export, tombstones or deletion lists, upsert-by-`source_id`, child-row replacement or delta checkpoints. A diff between two full snapshots must not be treated as an authoritative delta export. The open decisions in `final-delta-sync-design.md` remain open.

## Remaining / next

1. Owner resolves the final delta-sync design decisions (watermark field, hard-delete representation, child-row replacement scope, online/offline import, downtime window, financial-delta policy).
2. Implement delta export/import in a separately authorized slice, with dry-run and checkpoint behavior.
3. Generate two owner-approved snapshots before using this diff on real data.
4. Preserve the baseline snapshot and rehearse a restore before any cutover.
5. Commit/push of this slice requires separate explicit authorization.
