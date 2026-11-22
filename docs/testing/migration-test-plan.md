# Cloudflare migration test plan

**Date:** 2026-11-22  
**Status:** Phase 0 plan. No migration-specific test was run in Phase 0; the commands below are the existing repository entry points to reuse.

## Test principles

- Use the closest existing harness before adding a new one.
- Keep financial, realtime and media tests against disposable databases and fake or isolated providers.
- A test against source code is not proof of deployed behavior. A local dry run is not proof of remote bindings.
- Report exact commands, results and checks not run. Never infer success from source presence.

## Existing commands

From `backend-server`:

```sh
npm --workspace apps/api run typecheck
npm --workspace apps/api test
npm --workspace apps/api run test:hardening
npm --workspace apps/cloudflare-worker run typecheck
npm --workspace apps/cloudflare-worker run dry-run:staging
npm --workspace apps/cloudflare-worker run test:realtime
npx --yes swagger-cli validate apps/api/openapi.yaml
```

Historical baseline from the uncommitted R2 media work, not re-run in Phase 0:

- API suite: 221/221 passed.
- Media service integration: 6/6.
- Media HTTP route integration: 5/5.
- Hardening: 34/34.
- Android `:core:api:testDebugUnitTest`: 38/38.

Android checks used JBR, `--offline --console=plain --max-workers=2`; affected module compiles passed for `:core:api`, `:feature:auth` and `:feature:profile`. Admin typecheck/build passed and generated `dist/` was reverted. These results must be re-run after migration changes that touch their code paths.

## Required test layers

### 1. Static and contract gates

- TypeScript typecheck for API, Worker runtime, shared package and admin.
- OpenAPI validation.
- Contract tests comparing old and new responses for every migrated endpoint: status, schema, headers, error codes, pagination, authorization and idempotency semantics.
- Android call-site audit for endpoint paths, request/response shapes, auth headers, Socket.IO events and media URLs.
- Admin API inventory and RBAC matrix comparison, including a test that a valid admin JWT reaches every mounted `/api/admin` router.
- Backend source-audit gaps: add tests for `payoutWebhook`, `payoutReview`, `purchaseCredit`, `battlePass`, `referrals`, `themePurchase`, `productionIndexes` and `config/migration.ts`; verify payment and Google Play webhook mounting and raw-body verification.
- Android source-audit gaps: add tests for media `create`/`complete`/`cancel` HTTP protocol and error mapping, the `503`/`501` legacy fallback boundary (and that post-grant failures are not retried against legacy), failed-upload server cancel/quota release, ViewModel progress/token/cancel behavior including the pre-sessionId window, and the `ProfileDetailScreen` progress/cancel wiring gap.

### 2. Unit and pure-function tests

- ID mapping, ObjectId string conversion, UTC timestamp normalization, integer money conversion.
- Asset/cosmetic metadata validation and renderer registry validation.
- Upload request validation, grant parsing, checksum/key building and access decisions.
- Transaction state machines, idempotency key derivation and request fingerprinting.
- Cron job selection, checkpoint progression and overlap guard logic.

### 3. Integration tests

- Database repositories against D1 local simulation or an isolated PostgreSQL instance.
- Financial workflows: debit/credit, purchase, gift, refund, payout, concurrent spend, replay, duplicate fulfillment and rollback.
- Media upload lifecycle: staging, verification, publish, supersede, archive, private authorization and quota reservation release.
- Admin CRUD: create/publish/rollback/archive asset, change price/availability, assign badge/reward, audit-log entry.
- Realtime authorization and fan-out with two clients, including rooms, clans, conversations and block/ban rules.

### 4. Migration data validation

- Full export/transform/import rehearsal on an isolated copy.
- Counts, checksums, referential integrity, ID maps, timestamp and currency checks.
- Financial reconciliation and ownership/badge/gift preservation.
- Media registry versus R2 object reconciliation.
- Quarantine/rejection report review; no silent discards.
- Checkpoint/resume and idempotent re-run tests.

### 5. Worker/platform tests

- Local Worker dry run with intended staging config.
- Binding verification: D1/Hyperdrive, R2, DO, queues, KV, cron.
- Compat date and Node compatibility smoke tests for every dependency changed.
- Queue retries, DLQ, batching and duplicate delivery.
- Cron idempotency, bounded execution, checkpoint and overlap behavior.
- DO restart/recovery, hibernation behavior, event dedupe and reconnect recovery.
- Cost-metric assertions: rows read/written, R2 operations, DO duration, queue retries, KV reads/writes.

### 6. Load and soak tests

- DAU-shaped read/write load against staging-like data volume.
- Peak chat messages/s and room concurrency.
- Simultaneous PK battles and room closures.
- Concurrent purchases/gifts and wallet contention.
- Media upload/download concurrency and quota contention.
- Compare measured throughput with [D1 capacity thresholds](../database/d1-capacity-assessment.md) and [platform limits](../infrastructure/cloudflare-platform-limits.md).

### 7. Security tests

- Resource-level authorization for every private media and admin operation.
- Token/session revocation, RBAC least privilege and admin audit coverage.
- Webhook signature verification and replay rejection.
- Path traversal, MIME/EXIF/SVG and oversized upload rejection.
- Log redaction: tokens, credentials, private content and signed URLs must not appear.
- Secret-scanning gate to prevent another tracked credential exposure.

### 8. Client and rollout validation

- Android module unit tests and device/emulator visual QA for changed screens.
- Two-client realtime validation on actual Android clients, not only Node socket clients.
- Old-client compatibility window: existing installed Android versions must continue to authenticate and receive data during the transition.
- Android catalog/policy parity: assert hardcoded VIP thresholds, gift box prices, cosmetic names and the `coinToInrRate` fallback against server-provided values; verify no client-supplied price or eligibility is accepted.
- Two-client sync-topic parity: confirm the Android `BONDS` topic and the server's `syncInvalidation` topic list agree after the protocol decision.
- Admin staging login, RBAC, deep links and asset management flows.
- Rollback rehearsal before production cutover.

## Exit criteria for migration acceptance

- All migrated API contracts pass old/new comparison.
- All authoritative data validates with zero unaccounted records and reconciled finances.
- Media objects, versions, ownership and permissions validate against R2.
- Realtime protocol is verified with Android clients and survives reconnect/restart.
- Cron/queues are idempotent under duplicate delivery and bounded under load.
- Observability and cost dashboards show expected metrics and no sensitive logging.
- Backup restore and rollback have been rehearsed on isolated staging.
- Production cutover approval has been granted in writing by the owner.
