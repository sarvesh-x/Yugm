# Final delta sync design (draft)

**Date:** 2026-11-22
**Status:** Design only. No implementation, production snapshot, export, transform, import, validation or restore has been performed. No DDL approval or cutover authorization is implied.

## Purpose

Define how changes made in MongoDB after the bulk baseline snapshot can be captured, transformed, imported into D1, and validated without duplicating rows or losing referential integrity.

The bulk tooling already supports snapshots, checksums, checkpoint/resume, dry-run, idempotency and validation. Final delta sync is the missing piece needed to reduce cutover downtime.

## Core model

1. **Baseline snapshot**
   - A full snapshot with watermark `W0`.
   - Imported and validated into isolated staging.
   - Becomes the authoritative starting state for delta replay.

2. **Delta snapshot**
   - A separate snapshot containing only records changed after `W0`.
   - Has its own snapshot ID, watermark `W1`, manifest and checksums.
   - Is exported read-only from MongoDB.

3. **Delta import**
   - Transforms delta records with the same reviewed mappings.
   - Applies them to D1 as **upserts by `source_id`**, not blind inserts.
   - Replaces normalized child rows for changed parents so stale child rows cannot survive.

4. **Validation**
   - Validates changed-record counts, checksums, referential integrity and financial reconciliation.
   - Does not require full source/target count equality because deltas contain updates and deletes.

## Watermark strategy

The watermark must be deterministic and monotonic. Preferred options, in order:

1. A MongoDB change-stream resume token or operation time.
2. A source `updatedAt` timestamp plus `_id` tie-breaker.
3. A logical sequence/cursor if the application already maintains one.

Rules:

- The watermark must be recorded in the snapshot manifest.
- Every exported delta record must satisfy the watermark predicate.
- Re-running the same delta with the same watermark must produce the same input set.
- If a record is updated twice, the later delta supersedes the earlier one.

**Local validation aid (2026-11-23):** `npm run delta:watermark -- --snapshot <dir> --field <name>` (or `--input <records.jsonl>`) audits a caller-supplied snapshot for candidate-watermark coverage, parseability, unique `(value, _id)` composite keys, input ordering and example gaps. It never reads MongoDB and does not select the watermark; it only shows whether a proposed field can form a deterministic composite cursor. The owner decision on the exact MongoDB watermark field and ordering remains open.

## Export rules

- Export only records changed after the baseline watermark.
- Include created, updated and deleted records.
- Use keyset pagination ordered by the watermark field and `_id`.
- Count and checksum every batch.
- Never export secrets, signed URLs or binary payloads into documents; media remains referenced by bucket/key/checksum.

## Deletion handling

MongoDB documents may be hard-deleted or soft-deleted. The delta design must support both:

- **Soft delete:** map a deleted/status field to a D1 state or deletion marker.
- **Hard delete:** include a tombstone or deletion list in the delta snapshot, then delete the corresponding `source_id` and child rows in D1 under a transaction.

Hard deletes must be explicit and logged. Silent omission is forbidden.

**Local validation aid (2026-11-23):** `npm run delta:deletions -- --before <baseline-dir> --after <later-dir> [--soft-field deletedAt] [--out <report.json>]` compares two copied snapshots and lists source IDs removed between them, plus records marked by the chosen soft-delete field (`deletedAt` by default). It never reads MongoDB or implements tombstones/deletion lists. It supplies sizing and shape evidence for decision 2; it does not decide whether hard deletes should be tombstones or an explicit list.

## Upsert and child-row replacement

The current importer is append-oriented and idempotent by batch ID. Delta sync requires:

- Upsert root rows by `source_id`.
- For each changed parent, delete and reinsert its normalized child rows in the same transaction.
- Preserve `id_map` entries; update them only if a source identity changes, which should be treated as an error.
- Use idempotency keys so replaying a delta batch does not duplicate or corrupt state.

## Checkpoint and idempotency

- Use a separate checkpoint key per delta snapshot and collection, for example `delta:<deltaSnapshotId>:import:<collection>`.
- Batch IDs must include the delta snapshot ID and the last source ID.
- `shouldApplyBatch` must prevent duplicate application.
- A completed delta checkpoint must record the delta watermark and checksum.
- Re-running a completed delta must be a no-op aside from validation.

## Validation

Delta validation is different from bulk validation:

- Compare exported delta counts to imported delta counts.
- Verify every delta checksum.
- Verify referential integrity for changed and affected rows.
- Re-run financial reconciliation after the delta.
- Verify that no quarantined record was silently discarded.
- Verify that child-row replacement did not leave stale rows.
- Verify that deletions were applied according to the approved deletion list.

Full source/target count equality is not required for a delta.

## Failure and rollback

- Dry-run every delta before applying it.
- If validation fails, stop; do not advance the production watermark.
- Roll back the staging database from the last verified snapshot/checkpoint.
- Preserve the failed delta artifacts for investigation.
- Do not delete or overwrite the baseline snapshot.
- Production cutover requires an approved final delta and a successful restore rehearsal.

## Local verification aid added 2026-11-23

A read-only [snapshot diff tool](../../backend-server/apps/api/src/migration/snapshotDiff.ts) now exists at `npm run snapshot:diff -- --before <dir> --after <dir> [--max-examples 20] [--out <report.json>]`. It compares two already-copied, manifest-declared snapshots and reports added/removed/changed records per collection, top-level changed field names, duplicate/invalid source IDs and watermark ordering. It emits source IDs and content digests only, never record values, and reads no database or remote service.

This is a **planning and verification aid**, not final delta sync. It does not implement watermark-based delta export, tombstones/deletion lists, upsert-by-`source_id`, child-row replacement or delta checkpoints. Those remain open items below and are required before cutover. A diff between two full snapshots can help size and review a proposed delta window, but it must not be treated as an authoritative delta export.

## Open decisions

1. The exact MongoDB watermark field and ordering.
2. Whether hard deletes are represented by tombstones or an explicit deletion list.
3. Whether child-row replacement is performed per parent or per delta batch.

**Local validation aid (2026-11-23):** `npm run delta:child-tables -- [--manifest <path>] [--out <report.json>]` reads the generated schema manifest and the shared child-table declaration to list the 26 root collections with 49 normalized child tables. It adds review items for replacement unit, stale child rows and idempotent replay. It does not change the DDL or make the replacement-scope decision. The child-table declaration was moved to `backend-server/apps/api/src/migration/childTables.ts` so the generator and this audit share one source; regenerating the schema produced no SQL change.
4. Whether delta imports run online while MongoDB remains authoritative.
5. The maximum acceptable cutover downtime and final delta window.

**Local validation aid (2026-11-23):** `npm run delta:rates -- --before <baseline-dir> --after <later-dir> [--out <report.json>]` uses the two manifest watermarks and the snapshot diff to report average added/removed/changed records per hour by collection. It emits review items for average-vs-peak, online-vs-window and financial peak checks. It does not observe peak load, read MongoDB/D1 or make the downtime decision.
6. Whether financial deltas require a maintenance window or can run under normal load.

**Local validation aid (2026-11-23):** `npm run delta:finance -- --before <baseline-dir> --after <later-dir> [--out <report.json>]` filters the snapshot diff to the six authoritative money collections (`wallet_transactions`, `diamond_transactions`, `purchases`, `gift_transactions`, `withdrawal_requests`, `subscriptions`) and reports added/removed/changed counts with review items for ledger reconciliation, maintenance-window sizing and idempotent replay. It emits no balances or customer content, reads no database, and does not make the maintenance-window decision.

## Relation to other gates

This design does not resolve DCR-1/DCR-3-DCR-5, capacity metrics, Workers Paid, schema approval, backup/restore rehearsal or production cutover. It is a planning artifact only until those gates pass.
