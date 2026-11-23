# Handoff — Snapshot metrics derivation helper

**Date:** 2026-11-23
**Task:** YUGM-MIGRATION-000 — DCR-2 input preparation.

## Done

- Added `backend-server/apps/api/src/migration/metricsFromSnapshot.ts`.
- Added the `metrics:from-snapshot` CLI with `--snapshot`, repeatable `--strip`, `--detect-binary-like`, `--metrics-out` and `--out`.
- Derives only snapshot-computable fields: `snapshotId`, `sourceEnvironment`, `collectedAt`, `relationalBytes`, `largestRowBytes`.
- All 11 other metric fields stay `null` and appear in a provenance report with the reason and the correct source for each.
- Reports base64-like strings and numeric byte arrays as binary candidates; strips them only when the owner supplies an explicit glob or enables the detector.
- Reconciles recomputed serialised bytes against the declared manifest batches, including newline separators.
- Updated the readiness runbook, D1 capacity assessment, task and progress docs.

## Verification performed

- New helper tests — 5/5 passed.
- Full API suite — 459/459 passed.
- API typecheck — passed.
- Strict credential guard — zero findings across 30 tracked config files.
- CLI smoke on a synthetic snapshot — derived 5 fields, left 11 null, reported candidates.
- No database, network, credential or production data access. These changes are uncommitted.

## Important limitation

This is input preparation, not evidence. It never connects to a database and never invents monitoring, plan or growth values. `indexBytes`, `projected12MonthTotalBytes`, `workersPaid`, query-shape fields and all monitoring values must come from owner sources. A `READY` gate result from the DCR-2 tools still does not accept DCR-2 or authorize cutover.

## Remaining / next

1. Owner runs `metrics:from-snapshot` on a real exported snapshot and reviews the binary candidates.
2. Owner fills the 11 remaining fields from Cloudflare plan data, MongoDB statistics and monitoring.
3. Run readiness runbook steps 3-10 and review all open items.
4. Commit/push of this slice requires new explicit authorization.
