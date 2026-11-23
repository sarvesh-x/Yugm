# Handoff — Delta rate audit

**Date:** 2026-11-23
**Task:** YUGM-DB-001 — final delta-sync input preparation, local code and tests only.

## Done

- Added `backend-server/apps/api/src/migration/deltaRateAudit.ts`: uses two snapshot manifest watermarks and the existing snapshot diff to report average added/removed/changed records per hour by collection.
- Added `backend-server/apps/api/src/scripts/delta-rate-audit.ts` and npm script `delta:rates`:
  `npm run delta:rates -- --before <dir> --after <dir> [--out <report.json>]`
- Added `deltaRateAudit.test.ts` with 3 tests, including invalid-watermark handling.
- Updated `docs/migration/final-delta-sync-design.md`, `docs/migration/data-migration-tooling.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md` and `MIGRATION_PROGRESS.md`.

## Verification performed

- Targeted `tsx --test` run with adjacent delta suites — 26/26 passed.
- `npm.cmd run typecheck --workspace @yugm/api` — passed.
- CLI smoke on generated snapshots — 2-hour window, 0.5 changes/hour, 3 open review items.
- No MongoDB, D1, Cloudflare account, credential or production data access. These changes are uncommitted.

## Important limitation

A two-snapshot average cannot establish peak write rate or downtime tolerance. It does not read monitoring data, choose an online/offline mode or decide the final delta window. Invalid or non-increasing watermarks produce null rates rather than a fabricated estimate.

## Remaining / next

1. Owner supplies peak-rate/downtime requirements and decides online vs maintenance-window delta replay.
2. Owner approves two snapshots with valid watermarks before running this tool on real data.
3. Implement delta export/import with dry-run, checkpoints and reconciliation in a separately authorized slice.
4. Preserve the baseline snapshot and rehearse a restore before any cutover.
5. Commit/push of this slice requires separate explicit authorization.
