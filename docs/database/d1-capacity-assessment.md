# D1 capacity and suitability assessment

**Date:** 2026-11-22  
**Status:** Database target decided as D1 by the owner on 2026-11-22 ([ADR-0001](../decisions/0001-d1-and-r2-target.md)). The capacity assessment itself is still incomplete because production MongoDB metrics were not available or measured. No D1 production database has been provisioned, and the gates below still block rehearsal, production import and cutover.

## Purpose

Decide whether Cloudflare D1 can hold Yugm's permanent relational state, or whether the authoritative database should be PostgreSQL reached through Hyperdrive. The decision must be made before committing schemas, migration tooling, and application repositories to D1.

The target architecture requires balances, purchases, permissions, memberships and social state to remain authoritative on the server. Financial state must remain atomic in one database. D1 or PostgreSQL may satisfy that requirement; splitting the ledger across shards or products would not.

## Known repository facts

- The current deployed API is MongoDB/Mongoose-based; source, routes, schemas and tests are the evidence of implemented behavior.
- An experimental Cloudflare Worker wraps the existing Express/Mongoose app in a singleton Durable Object and connects to MongoDB. Its [README](../../backend-server/apps/cloudflare-worker/README.md) and [audit](../cloudflare-migration/audit.md) state that the staging database was empty before startup, production startup is disabled, and no production data has been migrated.
- The uncommitted R2 media foundation adds `MediaObject`, `MediaUploadSession` and `MediaQuotaReservation` metadata to MongoDB. Those records are part of the data inventory and must be exported if the slice is carried forward.
- No production collection counts, storage sizes, write rates, DAU, message volume, or financial-operation volume were measured in Phase 0.

## Required input metrics

Collect these from an approved production snapshot or from monitoring, without exporting secrets or personal content into documents:

| Area | Required measurement |
|---|---|
| Size | Per-collection document count, `storageSize`, `totalIndexSize`, average and maximum document size, largest embedded array/string, and total database size |
| Growth | 30/90/180-day growth by collection, projected 12-month size, and retention/deletion policy |
| Users | Registered users, MAU, DAU, peak concurrent users, sessions/day and device/session counts |
| Messages | Messages/day, peak messages/s, rooms/conversations, participants per room, and retained history window |
| Writes | Inserts/updates/deletes per collection per day and at peak, including reactions, presence, typing and read receipts |
| Finance | Wallet adjustments, purchases, gifts, payouts and refunds/day; peak financial writes/s; journal rows per account |
| Media | Media records, count by purpose/visibility, bytes referenced, temporary upload sessions, quota-reservation churn and orphan candidates |
| Admin | Asset versions, cosmetics, bundles, badges, achievements, catalog entries, audit-log rows and retention |
| Queries | Top queries by frequency and rows scanned; current indexes; slow query durations; full collection scans |
| Transactions | Multi-document transactions per minute and their collection/document footprint |
| Recovery | Backup frequency, restore RPO/RTO requirements, Time Travel suitability and existing audit-log retention |

A sensitive report must be stored outside public docs, contain only aggregates, and be access-controlled. No customer content, credentials, tokens or signed URLs may be copied into migration notes.

## D1 thresholds derived from official limits

Source snapshots are in [Cloudflare platform limits](../infrastructure/cloudflare-platform-limits.md).

| Check | D1 constraint | Decision rule |
|---|---|---|
| Database size | 10 GB hard maximum per database; 500 MB Free, 1 TB account Free | Reject D1 if the relational dataset plus indexes and projected growth cannot stay comfortably below 10 GB per database. Do not rely on raising this limit. |
| Row size | 2 MB maximum string/BLOB/row | Normalize or move large payloads to R2. Reject rows that cannot be reduced. |
| SQL statement | 100 KB; 100 bound parameters | Batch large writes into small statements; never rely on very large `IN` lists. |
| Query result | 50 MB | Paginate every admin/API list response. |
| Query duration | 30 s | Any query regularly approaching this is a design failure; use indexes, pagination and async jobs. |
| Throughput | Single-threaded per database; roughly `1 / average query duration` QPS | Estimate peak writes and reads against measured query durations. If headroom is small, shard by tenant/entity or choose PostgreSQL. Keep financial state in one database. |
| Per-invocation queries | 50 Free / 1,000 Paid; `batch()` counts as one query | Keep requests bounded; use `batch()` for atomic multi-statement work. |
| Rows read/written billing | 25B reads and 50M writes/month included on Paid | Estimate from production metrics. Indexes reduce reads but add writes. |
| Time Travel | 7 days Free / 30 days Paid | Not an independent backup. Require export snapshots before destructive migrations and a tested restore procedure. |
| Import | 5 GB maximum file via `d1 execute` | Use chunked import tooling/checkpoints; do not assume a single dump file will fit. |

## Local hard-limit screening (input preparation, not acceptance)

Added 2026-11-23: `npm run capacity:gate -- --input <metrics.json> [--out <report.json>]` in `apps/api` screens caller-supplied aggregates against the decimal-unit hard limits in this document and [the platform snapshot](../infrastructure/cloudflare-platform-limits.md). It never connects to MongoDB, D1, Cloudflare or any remote service.

The tool checks: 12-month projection at least the current total; 10 GB database ceiling; Workers Paid; 500 MB Free ceiling when Paid is false; 2 MB row; no binary bytes in D1; 100 KB statement; 100 bound parameters; 50 MB result; 30 s p99 statement; and 50/1,000 queries per invocation. Exit 0 means **no hard limit was exceeded**, not that DCR-2 is accepted. Every report also returns five always-open review items: size comfort, write-throughput headroom, indexed query shape, growth/retention evidence, and recovery/billing. Those require owner evidence and judgment.

Use `npm run capacity:intake -- --template [--out <metrics.json>]` to generate a blank metrics file, then `npm run capacity:intake -- --input <metrics.json>` to check completeness before screening. The intake report names each missing or invalid field and its meaning; it exits non-zero until all fields are supplied. It does not fill values or read a database.

The input is a flat JSON object with non-empty `snapshotId`, `sourceEnvironment`, `collectedAt` and these non-negative numbers: `relationalBytes`, `indexBytes`, `projected12MonthTotalBytes`, `largestRowBytes`, `binariesInD1Bytes`, `largestStatementBytes`, `maxBoundParameters`, `largestQueryResultBytes`, `p99QueryDurationMs`, `averageWriteDurationMs`, `peakWritesPerSecond`, `peakQueriesPerInvocation`, plus boolean `workersPaid`. `projected12MonthTotalBytes` is the final projected relational+index total, not an increment. Units are decimal bytes/ms. Store sensitive aggregate reports outside public docs; the tool itself writes only what the caller supplies.

Use `npm run capacity:projection -- --before <baseline-dir> --after <later-dir> --metrics <metrics.json>` to cross-check the declared 12-month projection against byte growth observed between two snapshot manifests. It reports the observed growth rate, a growth-based projection, baseline alignment and four review items (retention, seasonality, index growth and snapshot/metrics alignment). It never fills values or declares capacity accepted.

Use `npm run capacity:queries -- --input <observations.jsonl>` to screen captured query observations against the 100 KB statement, 100-parameter, 50 MB result and 30 s duration limits. It also reports p50/p95/p99 durations, full scans, unindexed observations, rows scanned and a coarse throughput-headroom estimate with four review items. It does not collect query data or accept the schema.

Use `npm run capacity:billing -- --queries <observations.jsonl> --metrics <metrics.json>` to estimate monthly rows read (query frequency × rows scanned), rows written (peak write rate as an upper bound) and storage against Workers Paid inclusions (25B reads, 50M writes, 5 GB storage). It reports overages and three review items; it is not an invoice and does not replace billing or recovery evidence.

Use `npm run backup:verify -- --snapshot <dir> --out <verification.json>` to record a copy check, and `npm run capacity:recovery -- --verification <verification.json> --rehearsal <out-dir> --attestation <attestation.json>` to check that verification, dry-run rehearsal artifacts and owner recovery attestations are internally complete. The checker does not run a restore and does not treat attestation booleans as tool-verified proof.

Use `npm run capacity:status -- --capacity <report.json> --projection <report.json> --queries <report.json> --billing <report.json> --recovery <report.json> --attestation <attestation.json>` to aggregate the local reports and owner attestations into one 8-check readiness summary. `READY` means the supplied evidence is internally consistent; it explicitly does not mean production acceptance.

This screener, projection cross-check and query-profile audit do not produce metrics, do not validate a restore, and do not replace any item in the exit-gate list below.

## Recommendation and decision status

The owner has committed to D1 as the target ([ADR-0001](../decisions/0001-d1-and-r2-target.md)) without the Phase 0 metrics. The following checks were not run and therefore remain **exit gates**, not satisfied conditions. Use D1 for production data only if the completed metrics show that all of the following are true:

1. The relational dataset and 12-month projection fit within a single 10 GB database, or a deliberate non-financial sharding key is defensible and keeps every financial operation atomic in one database.
2. No record requires a row larger than 2 MB after media binaries are moved to R2.
3. Peak write volume fits the measured single-database throughput with substantial headroom.
4. Indexed queries can stay far below the 30-second statement limit and the 50 MB result limit.
5. Required recovery objectives can be met with exports plus Time Travel, and a restore has been rehearsed on isolated staging.
6. Workers Paid is approved and configured before production traffic is routed to D1.

If any check fails, [ADR-0001](../decisions/0001-d1-and-r2-target.md) must be revisited and **PostgreSQL through Hyperdrive** reconsidered for authoritative relational data. Hyperdrive is included in the Workers plans, supports PostgreSQL/MySQL origins, and adds pooling and query caching without a separate Hyperdrive service charge; the origin database provider still applies its own billing and operational responsibilities.

## Migration feasibility rules regardless of database choice

- Preserve existing IDs and Firebase identifiers through a versioned, auditable mapping table. Convert MongoDB ObjectIds to stable string keys without renumbering user-visible identities.
- Preserve UTC timestamps and integer currency units. Never convert money to floating point.
- Enforce FK, unique, non-negative and CHECK constraints at the database boundary.
- Keep the wallet ledger append-only; refunds are compensating entries. Financial writes use a single database transaction with idempotency keys scoped to user and operation, request fingerprints, and price snapshots.
- Validate every import with source/target counts, checksums, referential integrity, balance reconciliation, ownership/badge/gift preservation, and an explicit report of skipped or rejected records. No silent discards.
- Export, transform, import, validation and rollback tooling must support snapshots, checkpoint/resume, dry-run, idempotency and final delta sync.
- Run destructive production operations only after explicit approval and a verified backup.

## Next action

Obtain the production metrics listed above and complete this assessment. The D1-versus-Hyperdrive decision is recorded in [ADR-0001](../decisions/0001-d1-and-r2-target.md); a first-cut review schema now exists at `backend-server/apps/api/migrations/d1/0001_initial.sql`, generated by `npm run schema:d1 --workspace apps/api`. It is a design draft only. Export/import tooling, production schema approval, rehearsal and cutover remain blocked until the gates above are satisfied.
