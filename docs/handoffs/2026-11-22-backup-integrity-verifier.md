# Handoff — Snapshot-copy integrity verifier

**Date:** 2026-11-22
**Task:** YUGM-MIGRATION-000 — Phase 1 backup tooling slice, local code and tests only.

## Done

- Added `backend-server/apps/api/src/migration/verifyBackup.ts`: read-only verification of a copied snapshot directory against its manifest. Checks declared batch presence/readability, record counts, byte counts, per-batch checksums, unexpected batch files and an optional top-level integrity digest. It never opens a database, bucket or network connection and never writes to the snapshot.
- Exported `snapshotBatchFileName` from `snapshot.ts` so writer and verifier share one filename convention.
- Added `backend-server/apps/api/src/scripts/verify-backup.ts` and npm script `backup:verify`:
  `npm run backup:verify -- --snapshot <directory> [--expect-digest <sha256>]`
- Added `backend-server/apps/api/src/migration/verifyBackup.test.ts` with 4 tests (intact copy, modified record, truncated/missing batch, unexpected file plus digest mismatch).
- Updated `docs/migration/BACKUP_AND_RECOVERY.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md` and `MIGRATION_PROGRESS.md`.

## Verification performed

- `npm.cmd exec -- tsx --test src/migration/verifyBackup.test.ts src/migration/adapters.test.ts` — 9/9 passed.
- `npm.cmd run typecheck --workspace @yugm/api` — passed.
- CLI smoke against a generated fixture — `Verification: PASS` both without and with `--expect-digest`.
- No database, bucket, remote service, credential or production data access. Nothing committed or pushed.

## Important limitation

This tool verifies that a copy matches its manifest. It does **not** create a backup, prove that a restore works, or change any status in section 5 of `BACKUP_AND_RECOVERY.md`. All backup and restore verification statuses remain "No". Record the integrity digest at the source independently; if both data and manifest are altered consistently, only an externally recorded digest detects it.

## Remaining / next

1. Owner approval naming the exact source environment and export targets; never rely on an ambient `MONGODB_URI`.
2. Create real MongoDB and media backups with manifests, then verify copies with `backup:verify` and the recorded source digest.
3. Restore into an isolated environment and run count, identity, message, relationship, wallet/ledger, purchase, gift, inventory, badge, achievement and media-reference gates.
4. DCR-4 R2 scope, DCR-2 capacity metrics/Workers Paid, DCR-3 inputs and owner credential rotation remain prerequisites for cutover.
5. Commit, push, deploy and provisioning require separate explicit approval.
