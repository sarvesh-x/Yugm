# Phase 1 baseline and recovery-preparation report

**Date:** 2026-11-22
**Status:** Partially satisfied. The recoverable checkpoint, versions, deployment identifiers, configuration snapshot and contract references are recorded, and read-only staging latency measurements were taken. Production metrics, verified backups and a tested restore do **not** exist. Do not begin destructive migration work from this document alone.

## 1. Recoverable checkpoint

| Field | Value |
|---|---|
| Repository | `C:\Users\longl\StudioProjects\Yugm` |
| Git HEAD at start of this task | `9b5081abf3a45d6b5c383c8c1f5a2ee92e98d809` (`docs: record green staging deploy and live verification`) |
| Working tree at start | Clean (`git status --short` produced no output) |
| Prior commits | `d630d9e` (CI readiness gate), `80d46af` (Worker Sharp removal and readiness gate) |
| Branch | `master`, pushed to `origin/master` |
| Recovery mechanism | Git history only. No infrastructure or database checkpoint has been created by this phase. |

All changes made during this phase are documentation under `docs/` and `MIGRATION_PROGRESS.md`. No application code, configuration, credential, infrastructure resource or deployment was modified.

## 2. Recorded versions

### Backend (npm workspace)

| Component | Version / constraint | Source |
|---|---|---|
| Workspace `yugm-backend-server` | `0.1.0` | `backend-server/package.json` |
| Node engine | `>=22.18.0 <27` | `backend-server/package.json` |
| npm engine | `>=10` | `backend-server/package.json` |
| TypeScript | `~5.3.3` | workspace and all apps |
| Wrangler | `^4.164.0` | root devDependencies |
| Cloudflare Workers types | `^5.20261117.1` | root devDependencies |
| `@yugm/api` | `0.1.0` | `apps/api/package.json` |
| `@yugm/cloudflare-worker` | `0.1.0` | `apps/cloudflare-worker/package.json` |
| `@yugm/admin` | `0.1.0` | `apps/admin/package.json` |
| `@yugm/shared` | local `file:../../packages/shared` | `apps/api/package.json` |

Key API runtime versions (declared ranges, not installed lockfile resolution): `express ^4.19.2`, `mongoose ^8.4.1`, `socket.io ^4.7.5`, `@socket.io/redis-adapter ^8.3.0`, `ioredis ^5.4.1`, `bullmq ^5.79.3`, `firebase-admin ^13.6.0`, `livekit-server-sdk ^2.5.1`, `sharp ^0.35.5`, `@aws-sdk/client-s3 ^3.1081.0`, `@aws-sdk/s3-request-presigner ^3.1081.0`, `zod ^3.23.8`, `jsonwebtoken ^9.0.2`.

Worker runtime dependencies: `mongoose ^8.24.1`, `iconv-lite-worker` (`npm:iconv-lite@^0.7.3`); test-only `socket.io-client ^4.8.1`. Admin: React `^18.3.1`, Vite `^5.4.11`, lucide-react `^0.468.0`.

### Android

| Component | Version / value | Source |
|---|---|---|
| Android Gradle Plugin | `9.5.1` | `android-client/gradle/libs.versions.toml` |
| Kotlin | `2.2.10` | `android-client/gradle/libs.versions.toml` |
| KSP | `2.2.10-2.0.2` | `android-client/gradle/libs.versions.toml` |
| Hilt | `2.60.1` | `android-client/gradle/libs.versions.toml` |
| OkHttp | `4.12.0` | `android-client/gradle/libs.versions.toml` |
| Default release `versionCode` / `versionName` | `1` / `1.0` when no Gradle property, env var or `local.properties` override | `android-client/app/build.gradle.kts:85–86` |
| Release API default | `https://yugm-api-staging.sarveshkumar10101.workers.dev/api` | `android-client/app/build.gradle.kts:73–77` |
| Release socket default | `https://yugm-api-staging.sarveshkumar10101.workers.dev` | `android-client/app/build.gradle.kts:78–82` |

The ignored `android-client/local.properties` is not part of the recoverable Git checkpoint; its actual release values must be recorded separately by the owner before a release build. No value is reproduced here.

## 3. Current deployment identifiers

| Environment | Identifier | Status |
|---|---|---|
| Staging API Worker | `https://yugm-api-staging.sarveshkumar10101.workers.dev` | Deployed. `/health`, `/api/health`, `/ready`, `/api/ready` returned 200 during this phase. |
| Staging admin | `https://yugm-admin-staging.pages.dev/` | Deployed; `/` returned 200 in the prior verification. |
| Staging database | MongoDB database name `YugmStaging` | Reported by `/ready`; no D1 database is authoritative. |
| Production API Worker | Source-only in `wrangler.production.jsonc` | Runtime refuses production stage; no production cutover. |
| Legacy host | `render.yaml` retained | Rollback host with automatic deploy disabled; not deleted. |
| Cloudflare account / resource IDs | Not recorded in this report | Must be supplied by the owner; do not infer from config values. |
| R2 buckets / D1 / Queues / KV | Not provisioned for authoritative use | R2 is configured locally only through ignored files. |

## 4. Configuration snapshot

- Wrangler configs exist for local, staging and production under `backend-server/apps/cloudflare-worker/` (`wrangler.jsonc`, `wrangler.staging.jsonc`, `wrangler.production.jsonc`).
- Staging and production configs include the `IMAGES` binding added by commit `80d46af`; no paid Cloudflare Images storage was enabled.
- Tracked Wrangler configs are documented as using `STORAGE_DRIVER=mongodb`; managed R2 media requires `STORAGE_DRIVER=s3` and is configured only in ignored local files. See `docs/features/r2-centralized-media.md`.
- `docs/infrastructure/tracked-worker-credentials-finding.md` records a critical credential-exposure finding that remains unresolved (DCR-1). No secret value is reproduced in this report.
- Detailed binding, secret, CORS and environment rules are in `docs/infrastructure/environments.md`.

## 5. Contract references

| Contract | Location |
|---|---|
| HTTP API | `backend-server/apps/api/openapi.yaml`, `docs/API_CONTRACTS.md` |
| Realtime events | `docs/REALTIME_EVENTS.md`, `docs/migration/realtime-event-inventory.md` (47 shared events, 16 PK events, 17 off-catalog literals) |
| Database schema | `docs/DATABASE_SCHEMA.md`, `docs/database/mongo-to-relational-mapping.md`, `backend-server/apps/api/migrations/d1/0001_initial.sql` (review draft) |
| Design system / navigation | `docs/DESIGN_SYSTEM.md`, `docs/NAVIGATION_ARCHITECTURE.md` |
| Business rules | `docs/BUSINESS_RULES.md`, `docs/wallet-ledger.md` |

These are the contracts to preserve during migration. No contract was changed in this phase.

## 6. Observed baseline measurements

Read-only HTTP probes against the deployed staging Worker were run on 2026-11-22 with `curl.exe`, three attempts per endpoint, from the local development machine. Values include DNS, TCP, TLS and a cold or warm Durable Object; they are **not** a production latency baseline and must not be used as an SLO.

| Endpoint | Attempt 1 total | Attempt 2 total | Attempt 3 total | Status |
|---|---|---|---|---|
| `/health` | 1.064 s | 0.614 s | 0.964 s | 200 |
| `/ready` | 0.923 s | 1.305 s | 0.892 s | 200 |
| `/api/health` | 0.628 s | 0.787 s | 0.600 s | 200 |
| `/api/ready` | 0.666 s | 0.681 s | 0.573 s | 200 |

`firstbyte` ranged from 0.572 s to 1.305 s across all probes. The spread is consistent with Durable Object wake-up after idle; no CPU or isolate metrics were available.

## 7. Baseline measurements still required

The directive requires baseline measurements that this phase could not produce without production access and authorized credentials. None of the following has been measured or estimated:

- API response times for authenticated routes under realistic concurrency.
- Authentication success rate and token refresh behavior.
- Message delivery success, latency and duplicate rate.
- Voice/video connectivity and reconnection success.
- Media upload success rate and size distribution.
- Wallet transaction correctness and financial reconciliation under load.
- Background job success rate, latency and retry count.
- Database size, per-collection document counts, index sizes and growth.
- R2 storage usage and operation counts.
- Worker CPU, D1 rows read/written, Durable Object duration and Queue backlog.

Required metrics are enumerated in `docs/cloudflare-migration/decision-request.md` (DCR-2) and `docs/database/d1-capacity-assessment.md`. They remain a gate before production migration or cutover.

## 8. Recovery status

- A Git checkpoint exists, but **no verified MongoDB backup, media backup, configuration backup or tested restoration** exists in this phase.
- `docs/migration/BACKUP_AND_RECOVERY.md` records the required backup inventory and the fact that restoration is unverified.
- `docs/migration/ROLLBACK_PLAN.md` and `docs/migration/rollback-runbook.md` define rollback points; none has been rehearsed.
- Gate: destructive migration operations must not begin until recovery procedures have been verified.

## 9. Verification performed in this phase

- `git status --short` and `git rev-parse HEAD` before edits.
- Read of the required `AGENTS.md`, `docs/INDEX.md`, `docs/CURRENT_TASK.md` and relevant architecture/migration docs.
- Read of backend, Worker and admin `package.json` and targeted Android Gradle version configuration.
- Read-only staging HTTP probes with timing recorded above.
- No build, test, lint, migration, provision, deploy, credential read or production data operation was run.

## 10. Next step

Resolve DCR-1, DCR-3, DCR-4 and DCR-5 and supply the DCR-2 metrics listed in the decision request. Then create and verify backups and a restore rehearsal before any destructive migration operation.
