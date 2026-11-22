# Migration rollback and rehearsal runbook (draft)

**Date:** 2026-11-22
**Status:** Draft. Local, non-destructive planning only. No production snapshot, export, transform, import, validation, restore, provision, deploy or data change has been performed. No DDL approval, capacity gate, backup/restore rehearsal or cutover authorization is implied.

## Purpose

Define the safe sequence for rehearsing the MongoDB -> D1 migration and the rollback points before any production data operation. This runbook uses only the existing local tooling in `backend-server/apps/api/src/migration/` and `src/scripts/rehearse-migration.ts`.

## Preconditions

1. Owner approval for the specific rehearsal or restore step.
2. A reviewed, approved D1 schema (`0001_initial.sql`) and an approved migration window.
3. A read-only MongoDB snapshot or export directory with a manifest and checksums.
4. An isolated staging D1 database; never the production database.
5. A documented restore target and rollback owner.
6. `MONGODB_URI` and any Cloudflare credentials remain outside source control and are not echoed in logs.

## Local tooling sequence

1. **Export a local snapshot**
   - Use the existing export/snapshot tooling to write bounded batches with checksums.
   - Record the snapshot ID, watermark, collection counts and checksums.
   - Do not modify the source MongoDB instance.

2. **Transform and quarantine review**
   - Run the reviewed mappings through `applyMapping` or the importer.
   - Inspect every quarantine entry by collection, field and reason.
   - Any unexpected quarantine count blocks progression.

3. **Dry-run import**
   - Run the importer with `dryRun: true`.
   - Confirm no rows or checkpoints are written.
   - Confirm manifest checksum verification passes.

4. **Rehearsal import**
   - Run `npm run migrate:rehearse -- --snapshot <snapshot-directory> --out <output-directory>`.
   - Review `transform-report.json`, `validation-report.json` and `id-map.jsonl`.
   - Confirm validation is `PASS` and the process exits 0.

5. **Validation gates**
   - Counts match source and imported rows.
   - Unique constraints pass.
   - Orphan checks pass.
   - Wallet/ledger reconciliation passes.
   - Ownership, badge, gift, achievement and media references pass.
   - No unaccounted source rows.

6. **Restore rehearsal**
   - Restore the exported snapshot into isolated staging.
   - Repeat import and validation.
   - Compare checksums and counts.
   - Demonstrate rollback to the pre-migration state.

## Rollback points

- **Before export:** no change has occurred; abort with no rollback.
- **After snapshot:** discard the snapshot directory; source remains untouched.
- **After dry run:** no database writes have occurred; abort with no rollback.
- **After rehearsal import:** drop or recreate the isolated staging database; rerun from snapshot.
- **After validation failure:** do not promote. Restore staging from the snapshot and investigate quarantine/validation reports.
- **Before production cutover:** keep MongoDB authoritative. Disable or reverse any feature flag and retain the last known-good snapshot.
- **After production cutover:** rollback requires an approved restore procedure, a verified snapshot, and owner authorization. Do not improvise.

## Stop conditions

Stop and escalate immediately if any of the following occur:

- Any unaccounted source row.
- Any financial reconciliation failure.
- Any orphaned reference that is not explicitly approved.
- Any unexpected quarantine growth.
- Any failed checksum or manifest mismatch.
- Any credential exposure or environment mismatch.
- Any attempt to write to production MongoDB, D1, R2 or DNS without authorization.

## Artifacts to retain

- Snapshot manifest and batch checksums.
- Transform report.
- Validation report.
- `id-map.jsonl` and its checksum.
- Rehearsal command, environment description and operator.
- Approval record for the rehearsal or restore step.

## Relation to other gates

This runbook does not resolve DCR-1/DCR-3-DCR-5, capacity metrics, Workers Paid, schema approval, backup/restore rehearsal or production cutover. It is a planning artifact only until those gates pass.
