# DCR-2 readiness runbook

**Date:** 2026-11-23
**Status:** Local preparation complete. The DCR-2 gate is still open because real metrics, Workers Paid confirmation, recovery evidence and schema approval are owner-owned.
**Decision:** D1 is selected under [ADR-0001](../decisions/0001-d1-and-r2-target.md). This runbook is the evidence sequence for that decision; it is not an acceptance certificate.

## 1. What must be proven

D1 may carry production data only if all of the following hold:

1. Relational data plus indexes and the 12-month projection fit comfortably under 10 GB.
2. No row exceeds 2 MB after binaries move to R2.
3. Peak writes fit single-database throughput with substantial headroom.
4. Indexed queries stay far below the 30 s statement limit and the 50 MB result limit.
5. Exports plus Time Travel and a rehearsed restore meet recovery objectives.
6. Workers Paid is approved and configured before traffic switches.

If any check fails, ADR-0001 must be revisited and PostgreSQL through Hyperdrive reconsidered. Financial state must remain atomic in one database either way.

## 2. Tools

All commands run from `backend-server/apps/api` unless noted.

| Step | Command | Purpose |
|---|---|---|
| 1 | `npm run capacity:intake -- --template --out dcr2-metrics.json` | Generate the blank 16-field metrics template |
| 2 | Fill `dcr2-metrics.json` from an approved monitoring/export source | Owner supplies real aggregates; no credentials or customer content |
| 3 | `npm run capacity:intake -- --input dcr2-metrics.json` | Report missing/invalid fields, then screen hard limits |
| 4 | `npm run capacity:projection -- --before <baseline-snapshot> --after <later-snapshot> --metrics dcr2-metrics.json` | Compare declared 12-month projection with observed byte growth |
| 5 | `npm run capacity:queries -- --input <query-observations.jsonl>` | Screen query observations against D1 statement/result/duration limits |
| 6 | `npm run capacity:billing -- --queries <query-observations.jsonl> --metrics dcr2-metrics.json` | Estimate rows read/written and storage against Paid inclusions |
| 7 | `npm run backup:verify -- --snapshot <copy> --expect-digest <sha256> --out verification.json` | Record read-only snapshot-copy verification |
| 8 | `npm run backup:rehearse -- --snapshot <copy> --out-dir <artifacts-dir>` | Run integrity check plus dry-run import rehearsal |
| 9 | `npm run capacity:recovery -- --verification verification.json --rehearsal <artifacts-dir> --attestation <recovery-attestation.json>` | Check verification/rehearsal/attestation completeness |
| 10 | `npm run capacity:status -- ...` | Aggregate all reports and owner attestations into one readiness checklist |

Detailed input shapes and limits are in [the D1 capacity assessment](../database/d1-capacity-assessment.md).

A read-only helper can fill the fields an exported snapshot can honestly provide: `npm run metrics:from-snapshot -- --snapshot <dir> [--strip "<collection>.<field>" ...] [--detect-binary-like] [--metrics-out <metrics.json>]`. It connects to nothing, derives `snapshotId`/`sourceEnvironment`/`collectedAt`/`relationalBytes`/`largestRowBytes`, reports binary-looking fields for review (stripping only explicit globs or an opt-in detector), and leaves the other 11 fields null with a provenance reason. It is input preparation, not evidence: the owner still supplies Workers Paid, index bytes, growth, query and monitoring values.

If no snapshot exists, create one first from an isolated/staging MongoDB source: `npm run snapshot:export -- --out <dir> --confirm-isolated-export <label> --collections <c1,c2,...>` (or `--all-reviewed`). The export CLI is read-only, requires the confirmation label, refuses unreviewed collections and existing manifests, never prints the MongoDB URI, and emits only aggregate counts/bytes. Do not run it against production without separate approval.

## 3. Owner-supplied inputs

### Metrics file

- `snapshotId`, `sourceEnvironment`, `collectedAt`
- `workersPaid`
- relational/index bytes, projected 12-month total
- largest row, binaries-in-D1, largest statement/result, max bound parameters
- p99 query duration, average write duration, peak writes/s, peak queries per invocation

### Query observations (JSONL)

One object per significant query pattern with:
`id`, `pattern`, `frequencyPerMinute`, `rowsScanned`, `rowsReturned`, `durationMs`, `resultBytes`, `statementBytes`, `boundParameters`, `usesIndex`, `fullCollectionScan`.

### Recovery attestation

Required booleans: `restoredInIsolatedEnvironment`, `financialReconciliationPassed`, `mediaReferenceResolutionPassed`, `rpoRtoMeasured`, `accessControlsConfirmed`; plus `owner`, `date`, `snapshotId`.

### Final DCR-2 attestation

Required booleans: `workersPaid`, `schemaApproved`; plus owner identity and date. `capacity:status` consumes this file.

## 4. Interpretation

- `capacity:gate` PASS means no documented hard limit was exceeded. It does **not** accept DCR-2.
- `capacity:projection` only compares declared growth with observed snapshot byte growth; it cannot prove seasonality or retention.
- `capacity:queries` hard-gate PASS does not eliminate full scans or prove index quality.
- `capacity:billing` is an estimate, not an invoice; writes use peak rate as an upper bound.
- `capacity:recovery` does not perform a restore; attestation booleans are owner claims.
- `capacity:status` `READY` means the supplied evidence is internally consistent. It explicitly does **not** authorize cutover.

## 5. Gate decision

Only after all checks pass and the owner has reviewed every open item may the D1 schema be approved as the build baseline. Even then, production import, traffic switch and MongoDB removal require separate explicit approvals and a verified backup/restore rehearsal.
