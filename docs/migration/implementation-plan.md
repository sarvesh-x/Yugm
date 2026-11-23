# Repository-specific migration implementation plan

**Date:** 2026-11-22  
**Status:** Accepted as the migration execution sequence on 2026-11-23 ([ADR-0006](../decisions/0006-implementation-plan-acceptance.md)). Phases remain sequential; later phases must not start before earlier exit gates pass. The database target is D1 ([ADR-0001](../decisions/0001-d1-and-r2-target.md)), but capacity metrics, recovery rehearsal and provisioning approvals still gate later phases. No deployment or data approval is implied.

## Phase 0 — audit, decisions and plan

**Goal:** Establish evidence and stop conditions before code/data changes.

**Work:**

- Audit backend, Android, admin, Worker prototype, schemas, APIs, realtime, media, jobs, infrastructure, tests and docs.
- Preserve the uncommitted R2/media foundation as the baseline.
- Produce [the Phase 0 report](../cloudflare-migration/phase0-report.md), [target architecture](../architecture/target-architecture.md), [data tooling requirements](data-migration-tooling.md), [realtime plan](realtime-plan.md), [test plan](../testing/migration-test-plan.md) and [progress tracker](../../MIGRATION_PROGRESS.md).
- Record the [credential exposure](../infrastructure/tracked-worker-credentials-finding.md) and block further Cloudflare work until remediation is approved.
- Collect production metrics; the D1-versus-PostgreSQL/Hyperdrive decision is recorded as [ADR-0001](../decisions/0001-d1-and-r2-target.md) (D1 selected by owner).

**Exit gate:** Owner has acknowledged credential remediation; production metrics are recorded and the D1 capacity gates checked; this plan is accepted. The ADR exists, but documentation-only completion is not enough.

**Approvals:** Credential rotation/removal, D1/Hyperdrive decision, plan acceptance.

## Phase 1 — foundations and isolated environments

**Goal:** Create the deployable skeleton without moving authoritative data.

**Work areas:**

- Split the experimental Worker prototype in `backend-server/apps/cloudflare-worker` into thin Workers/handlers with typed repository and provider boundaries; do not keep the singleton `YugmApi` Durable Object as production architecture.
- Define runtime env schema for D1/Hyperdrive, R2, DO, queues, KV and Cron in `backend-server/apps/api/src/config/env.ts` and Worker bindings under `wrangler*.jsonc`.
- Add dev/staging/prod Wrangler configs with separate bindings, explicit CORS allowlists, observability and redaction. Remove tracked secrets; use Worker secrets/secret manager and ignored `.dev.vars*`.
- Establish contract harnesses around `backend-server/apps/api/openapi.yaml`, shared schemas, Android API clients and admin API calls.
- Replace post-`listen()` best-effort index/migration/seed steps with explicit readiness gates so a failed startup step blocks traffic.
- Mount and test the already implemented payment and Google Play webhook handlers with raw-body verification and idempotency; do not rely on client-submitted verification as sole proof.
- Add CI gates: typecheck, API tests, OpenAPI structural guard (added 2026-11-23; full `swagger-cli` validation remains manual), admin typecheck/test/build (added 2026-11-23), secret scanning (report-only), Worker dry-run.

**Tests:** Existing typecheck/API/hardening/OpenAPI/admin checks; Worker dry-run with staging config; binding verification; no production writes.

**Exit gate:** All environments start with isolated bindings; no tracked secrets; contract harness passes; dry run succeeds; owner approves provisioning.

**Approvals:** Paid resources, plan upgrade, domains/DNS, secret-store strategy.

## Phase 2 — data migration tooling and rehearsal

**Goal:** Prove data can be exported, transformed, imported, validated and restored.

**Work areas:**

- Full MongoDB backup and restore into isolated staging.
- Export/transform tooling with stable ObjectId/UID/Firebase maps, UTC timestamps, integer money and explicit quarantine reports.
- Review and refine the first-cut D1 schema generated from [ADR-0001](../decisions/0001-d1-and-r2-target.md) by `npm run schema:d1 --workspace apps/api` (`backend-server/apps/api/migrations/d1/0001_initial.sql`), adding FK/unique/non-negative constraints and child tables where the [mapping spec](../database/mongo-to-relational-mapping.md) requires them.
- Batch importer with snapshots, checkpoint/resume, dry-run, idempotency, final delta sync and rollback runbook.
- Validation reports for counts, checksums, referential integrity, wallet/ledger reconciliation, ownership, badges, gifts, achievements and media references.

**Tests:** Transform unit/golden tests, idempotent re-run, checkpoint interruption, injected mismatch/negative/orphan cases, restore rehearsal, production-shaped data volume checks.

**Exit gate:** Zero unaccounted records; finances reconcile; restore rehearsal passes; no destructive production step taken.

**Approvals:** Production snapshot access, schema approval, destructive-operation approval.

## Phase 3 — Workers API and domain cutovers

**Goal:** Move authoritative reads/writes behind Workers repositories one domain at a time.

**Suggested order:**

1. Identity/auth/profile and admin auth.
2. Catalog/cosmetics/assets metadata and permissions.
3. Social graph, conversations and room metadata.
4. Wallet/ledger, purchases, gifts, rewards and payouts.
5. Achievements/badges and progression state.
6. Remaining read-heavy APIs.

**Work areas:** `backend-server/apps/api/src/routes/*`, `services/*`, `models/*`, `app.ts`, shared schemas, OpenAPI, Android `core/api` clients, admin data hooks.

**Rules:** One authoritative writer per domain; feature flags/adapters; no success before authoritative commit; preserve existing error codes/pagination; keep financial operations atomic in one database.

**Tests:** Old/new contract comparison, RBAC/resource authz, transaction/idempotency/replay, failure injection, Android/admin integration smoke.

**Exit gate:** Domain passes contract and data validation under staging load; rollback path demonstrated.

## Phase 4 — R2 media and centralized asset platform

**Goal:** Complete the storage and asset cutover on top of the preserved R2 foundation.

**Work areas:**

- Existing `services/r2.ts`, `services/media.ts`, `routes/media.ts`, `MediaObject`, `MediaUploadSession`, `MediaQuotaReservation`, Android `MediaUploadApi`, OpenAPI and feature docs.
- One upload pipeline for all media categories: staged presigned upload, size/signature/MIME/content validation, EXIF/SVG safety, processing/variants/moderation, authoritative DB update, cleanup, progress/retry/expiry/rate limits.
- Immutable versioned keys, checksums, metadata, ownership, visibility, reference tracking and no published-object overwrite.
- Private media delivery through authenticated Worker checks and short-lived grants; no public cache; no persisted signed URLs.
- Asset system separation: identity/artwork/version/store listing/price/availability/ownership/equipped/reward conditions/rendering config; DRAFT→PUBLISHED→ARCHIVED, rollback and reference protection.
- Admin media/asset tooling and reconciliation of legacy files/URLs.

**Tests:** Live isolated R2 upload→publish→read→archive/rollback; quota concurrency; private download authz; CDN/CORS/public policy; asset admin flows; Android device/visual QA; old URL mapping.

**Exit gate:** R2 resources configured with approved credentials/domains; all media categories cut over or explicitly deferred; registry reconciled with R2; Android/admin validated.

**Approvals:** R2 provisioning, bucket policies, custom domains/CORS, media deletion/archive policy.

## Phase 5 — realtime and stateful coordination

**Goal:** Replace or harden the Engine.IO bridge according to [the realtime plan](realtime-plan.md).

**Work areas:** Durable Object classes/bindings/migrations in Worker config; API socket handlers; Android socket client; admin realtime consumers; sync invalidation service; conversation/room/PKD state.

**Rules:** Preserve protocol or version it explicitly; authenticate connects/subscriptions/events; durable writes before ack; event IDs/dedupe; reconnect recovery; hibernation where possible; scoping by conversation/room/user/PKD.

**Tests:** Two-client Android/admin validation, event inventory parity, duplicate/out-of-order/revocation/restart tests, load and DO cost measurement.

**Exit gate:** No unresolved protocol incompatibility; recovery and load tests pass; cost model accepted.

## Phase 6 — Queues, Cron, observability and hardening

**Goal:** Make async work and maintenance safe and observable.

**Work areas:** Queue producers/consumers for media processing, notifications/moderation/reconciliation/webhooks; Cron scheduled handler; KV cache/config; structured logs/correlation IDs; metrics/alerts/spending limits; rate limits and RBAC audit.

**Rules:** Small idempotent messages, DLQ/retry handling, bounded checkpointed cron, overlap prevention, R2 lifecycle only for temporary/retention-managed objects, no sensitive logging.

**Tests:** Duplicate delivery, retry/DLQ, cron idempotency/overlap, log redaction, cost dashboard verification.

**Exit gate:** Operational dashboards, alerts and runbooks pass staging review.

## Phase 7 — Android/admin integration and staged rollout

**Goal:** Complete clients and roll out behind flags.

**Work areas:** Android modules (`core/api`, `core/data`, `core/ui`, `feature/*`, `app`), design-system reuse, navigation/dock whitelist, admin React app and deployment config. Specific debt from the [Android source audit](../architecture/android-source-audit.md):
  - Fix `ProfileDetailScreen` progress/cancel wiring and the pre-sessionId cancellation window; call server-side cancel on failed uploads so quota reservations are released (pair with the Phase 6 sweeper).
  - Move hardcoded catalogs, prices and eligibility (VIP thresholds, gift box prices, cosmetic names, `coinToInrRate` fallback) behind server-administered config; keep client keyword filtering advisory.
  - Replace direct composable→API singleton calls with repository/state-holder boundaries for domains being cut over.
  - Reconcile the Android `BONDS` sync topic with server invalidation mapping.
  - Consolidate duplicate `GlassCard`, `LiveBadge` and text-field primitives; keep the single `:core:ui` theme and bottom-dock navigation.

**Tests:** Gradle unit tests, affected compiles, full lint/assemble where appropriate, device/emulator QA, TalkBack/font-scale/narrow-width checks, admin UI QA, old-client compatibility window.

**Exit gate:** Client tests pass; no new competing theme/navigation; rollout plan and rollback accepted.

## Phase 8 — production cutover

**Goal:** Switch traffic only after full validation.

**Work:** Final delta sync; production backup; approval confirmation; DNS/route change; staged traffic; monitoring; rollback readiness.

**Tests:** Final validation suite, financial/media/realtime reconciliation, live smoke, rollback rehearsal.

**Exit gate:** Owner-approved cutover and post-cutover acceptance. No phase is considered complete from source presence or dry run alone.

## Dependency chain

```text
Credential remediation + production metrics
  → D1/Hyperdrive ADR (D1 selected; capacity gates still open)
    → Phase 1 environments/contracts
      → Phase 2 data rehearsal
        → Phase 3 API domains
          → Phase 4 media/assets
          → Phase 5 realtime
            → Phase 6 ops
              → Phase 7 clients
                → Phase 8 cutover
```

Phase 4 media work already has an uncommitted foundation, but provisioning and cutover remain gated by the earlier decisions.
