# Handoff — Deletion audit

**Date:** 2026-11-23
**Task:** YUGM-DB-001 — final delta-sync input preparation, local code and tests only.

## Done

- Added `backend-server/apps/api/src/migration/deletionAudit.ts`: compares two copied snapshots and lists source IDs removed between them, detects soft-delete markers from a configurable field (`deletedAt` by default), and emits a stable digest.
- Added `backend-server/apps/api/src/scripts/deletion-audit.ts` and npm script `delta:deletions`:
  `npm run delta:deletions -- --before <dir> --after <dir> [--soft-field deletedAt] [--out <report.json>]`
- Added `deletionAudit.test.ts` with 4 tests.
- Updated `docs/migration/final-delta-sync-design.md`, `docs/migration/data-migration-tooling.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md` and `MIGRATION_PROGRESS.md`.

## Verification performed

- Targeted `tsx --test` run with adjacent delta suites — 16/16 passed.
- `npm.cmd run typecheck --workspace @yugm/api` — passed.
- CLI smoke on generated snapshots — reported 1 soft-deleted record with no hard removals.
- No MongoDB, D1, R2, Cloudflare account, credential or production data access. These changes are uncommitted.

## Important limitation

This is sizing/shape evidence only. It does not implement tombstones, an explicit deletion list, or D1 deletes. Soft-delete detection is heuristic and configurable; hard removals assume complete source IDs in both snapshots. The owner decision on hard-delete representation remains open.

## Remaining / next

1. Owner decides tombstone vs explicit deletion list for hard deletes.
2. Owner decides child-row replacement scope, online/offline delta import, downtime window and financial-delta policy.
3. Owner approves two snapshots before running this tool on real data.
4. Implement delta export/import/deletion in a separately authorized slice with dry-run and checkpoints.
5. Commit/push of this slice requires separate explicit authorization.
