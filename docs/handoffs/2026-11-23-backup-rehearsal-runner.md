# Handoff — Combined backup rehearsal runner

**Date:** 2026-11-23
**Task:** YUGM-DB-001 — Phase 1 backup tooling, local code and tests only.

## Done

- Added `backend-server/apps/api/src/migration/backupRehearsal.ts`: verifies a copied snapshot with `verifyBackup()` and, only if integrity passes, runs `rehearseSnapshot()` in dry-run mode. Returns one result with `verification`, `rehearsal` and `passed`.
- Added `backend-server/apps/api/src/scripts/backup-rehearse.ts` and npm script `backup:rehearse`:
  `npm run backup:rehearse -- --snapshot <dir> --out-dir <dir> [--expect-digest <sha256>]`
- Added `backupRehearsal.test.ts` with 3 tests (valid chain, tampered copy skips rehearsal, digest mismatch skips rehearsal).
- Updated `docs/migration/BACKUP_AND_RECOVERY.md`, `docs/migration/data-migration-tooling.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md` and `MIGRATION_PROGRESS.md`.

## Verification performed

- Targeted `tsx --test` run with rehearsal and backup-verifier suites — 13/13 passed.
- `npm.cmd run typecheck --workspace @yugm/api` — passed.
- CLI smoke on a generated snapshot — `Snapshot integrity: PASS`, `Dry-run rehearsal: PASS`, `Combined rehearsal: PASS (not a restore test)`.
- No MongoDB, D1, R2, Cloudflare account, credential or production data access. These changes are uncommitted.

## Important limitation

A combined PASS means the copy matches its manifest and the reviewed mappings pass validation in dry-run mode. It is **not** a restore test, does not prove binaries exist, and does not change any status in `BACKUP_AND_RECOVERY.md` section 5. No real backup has been created or restored.

## Remaining / next

1. Owner approves a specific export target and snapshot copy.
2. Run `backup:verify` / `backup:rehearse` on that copy, recording the source integrity digest independently.
3. Restore into an isolated environment and run the financial/media/relationship reconciliation gates before cutover.
4. DCR-2/DCR-3/DCR-4 inputs, schema approval, credential rotation and strict CI remain open.
5. Commit/push of this slice requires separate explicit authorization.
