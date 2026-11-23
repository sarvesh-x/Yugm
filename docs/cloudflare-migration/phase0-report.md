# Phase 0 report: Cloudflare migration audit and planning baseline

**Date:** 2026-11-22  
**Status:** Repository audit and planning complete. The phase remains gated on owner decisions; this report is not approval to provision, deploy, migrate, rotate credentials or change production data.

## 1. Purpose and source precedence

Phase 0 establishes a repository-specific baseline before changing architecture or code. Source code, Git state and executable tests are authoritative. Existing audits and feature docs are evidence only, with their stated baselines and limits.

Order of precedence used in this report:

1. Current source files and Git status.
2. Dated handoffs/current task docs describing uncommitted work.
3. Historical production audit documents.
4. Platform documentation snapshots.

The active migration objective is the full MongoDB/Render to Cloudflare move: Workers, D1 or Hyperdrive-backed PostgreSQL, R2, Durable Objects, Queues, KV, Cron, CDN, centralized asset management, admin tooling and Android integration. The existing uncommitted R2 media foundation is a baseline to preserve, not a completed migration.

## 2. Current implementation baseline

### Backend/runtime

- The primary API is a TypeScript Express modular monolith under `backend-server/apps/api`, using Mongoose, Socket.IO, Redis/BullMQ, Firebase Admin, LiveKit and AWS S3-compatible storage helpers.
- A staged experimental Worker under `backend-server/apps/cloudflare-worker` wraps the existing Express app in one singleton SQLite-backed Durable Object, forwards HTTP through `handleAsNodeRequest`, bridges Engine.IO WebSockets with `WebSocketPair`, and schedules PK/maintenance work with alarms.
- Production startup is deliberately disabled. The Worker accepts only `local`/`staging` stages, requires `YugmStaging`, and requires an explicit staging isolation flag.
- The Worker prototype uses GridFS and non-hibernating WebSockets, has a 10 MiB upload cap, relies on Engine.IO internals, and has incomplete process-restart recovery for room presence/disconnect cleanup. See [the Worker prototype audit](../infrastructure/worker-prototype-audit.md).
- Backend source inspection found roughly 95 Mongoose models and 606 route registrations across 55 routers. Startup runs indexes/migrations/seeds after `listen()` and only logs failures, so the API can serve traffic in a degraded state. `eventsRouter` is double-mounted for legacy clients. See [the backend source audit](../architecture/backend-source-audit.md).
- User auth has a 20-second per-process revocation cache; socket auth does not check suspension. Rate limits fall back to per-process memory when Redis is unavailable and derive client IP from headers. App Check is off by default and applied mainly to `/api/auth` and device-token routes.
- Payment and Google Play webhook handlers are implemented but unmounted; only the payout webhook is mounted with raw-body HMAC verification. Purchase state currently relies on client-submitted verification endpoints.

### Media baseline

- An uncommitted foundation plus avatar vertical slice adds a centralized R2 service, `MediaObject`, `MediaUploadSession`, `MediaQuotaReservation`, four media endpoints, Android presigned upload support and realtime invalidation.
- It is not committed, provisioned, migrated or deployed. No R2 credentials were added and no live media was changed.
- Migrations 6–9 remain unapplied in the documented environment; bucket/CORS/public policy, live upload→publish→read→archive, other media categories, admin media tooling, reconciliation tooling and room/clan private-media semantics remain open.

### Admin, infrastructure and Android

- Admin is a Vite/React SPA with its own typecheck/build scripts and no test script. It has 29 navigation items, inline reusable components in `App.tsx`, server-side RBAC, and several server actions without corresponding UI controls.
- Admin router authentication historically depended on mount order; explicit `requireAdminAuth` guards were added to the five formerly dependent routers on 2026-11-23, with 5 unauthenticated regression tests. `GET /api/admin/progression/health` is registered before the `adminRouter` guard and appears dead (401), not exposed. See [the admin/deployment audit](../infrastructure/admin-deployment-audit.md).
- Staging Worker/admin are deployed; the production Worker is source-only and deliberately disabled. No D1, R2, Queues, KV or Cron binding exists in any Wrangler config. CI has staging gates. As of 2026-11-23 it also has an admin typecheck/build gate and a report-only credential guard; strict secret scanning and admin tests remain open.
- Render remains a declared rollback host with auto-deploy off. Its Google Play package name differs from the production Worker config; reconcile before entitlement cutover.
- Android is modular Kotlin/Jetpack Compose (6 core + 14 feature modules) reusing `:core:ui` and the documented single-host bottom-dock/navigation rules. See [the Android source audit](../architecture/android-source-audit.md). Key findings:
  - The R2 avatar slice added a non-logging presigned PUT client with progress/cancellation; `CreateProfileScreen` wires progress and Cancel, but `ProfileDetailScreen` reads only `avatarUploadBusy` and never consumes progress or calls `cancelOwnAvatarUpload()` — that API is dead from the screen.
  - Cancellation before the first progress callback is a no-op because the session ID is not yet known, and a failed upload does not call server-side cancel, leaving the quota reservation until TTL (no sweeper exists).
  - 103 direct API calls across 32 screens/nav graphs bypass the ViewModel/repository layer; most API clients are Kotlin `object` singletons rather than DI-managed.
  - Hardcoded catalogs and policy live in source: 114 cosmetic names, VIP thresholds, gift box prices, event/report categories and a `coinToInrRate` fallback of `0.01` (server value is preferred when present).
  - Android defines a `BONDS` sync topic that the server's invalidation mapping does not emit; reconcile before protocol work.
  - No admin media/registry/quota UI exists.

### Documentation baseline

- Existing canonical docs (`ARCHITECTURE.md`, `DATABASE_SCHEMA.md`, `API_CONTRACTS.md`, `REALTIME_EVENTS.md`, `SECURITY_RULES.md`, `TESTING_STRATEGY.md`, design/navigation docs, feature docs and handoffs) remain the project standards and should be reused.
- Historical `docs/production/` inventories are baseline evidence, not current truth. They predate the R2/media routes and models.
- `docs/cloudflare-migration/audit.md` is a dated experimental staging audit. Its media rows predate the new presigned R2 foundation and should be reconciled as “implementation prepared, not provisioned,” not treated as current production state.

## 3. Critical security finding

`backend-server/apps/cloudflare-worker/wrangler.jsonc` is tracked by Git, is not ignored, and contains plaintext credential-bearing `vars`. Git checks confirmed the file is tracked and has no ignore rule. Values are deliberately not reproduced in this report.

This contradicts `docs/SECURITY_RULES.md` and the Cloudflare migration audit instruction never to put secrets in source control or logs. All affected values must be treated as compromised and rotated/revoked before further Cloudflare work. Removal from source, ignore rules, secret-store migration, CI scanning and any history rewrite require owner authorization. See [the dedicated finding](../infrastructure/tracked-worker-credentials-finding.md).

## 4. Database decision gate

D1 is not approved or committed. A D1 database has a hard 10 GB limit, 2 MB maximum row, single-threaded throughput per database, and billing/quotas tied to rows read/written and storage. D1 may be used only if production metrics show the relational dataset, growth, row sizes, indexed query patterns and peak write rate fit with substantial headroom, and restore objectives can be met.

If any check fails, use PostgreSQL through Hyperdrive. Financial operations must remain atomic in one database; do not shard the ledger across databases or products. Required metrics and decision rules are in [the D1 capacity assessment](../database/d1-capacity-assessment.md). Platform facts are in [the limit snapshot](../infrastructure/cloudflare-platform-limits.md).

## 5. Test baseline and gaps

Existing scripts and documented results:

- API: `tsx --test "src/**/*.test.ts"`; current documented baseline 221/221, not re-run in Phase 0.
- Hardening: isolated loopback MongoDB replica set; current documented baseline 34/34.
- Worker realtime: local disposable MongoDB replica set and local Worker; opt-in staging smoke/admin scripts exist.
- Android: Gradle unit/connected tests; current documented `:core:api:testDebugUnitTest` baseline 38/38.
- OpenAPI: `npx --yes swagger-cli validate apps/api/openapi.yaml` passed in the R2 media work.
- Admin has typecheck/build but no test script.

Static inventory: 38 backend test files with 213 direct declarations; 34 hardening declarations; 28 Android test files (25 unit + 3 instrumented) with 91 `@Test` declarations. These are shape counts, not runner results.

Material gaps: live migration application, D1/Hyperdrive data validation, financial reconciliation under migrated constraints, live R2 provisioning/CORS/policy, admin/media integration, two-client Android realtime, duplicate/out-of-order event handling, device visual/accessibility QA, migration load/cost evidence, and backup/restore rehearsal.

- Backend: no tests for high-value money/index paths (`payoutWebhook`, `payoutReview`, `purchaseCredit`, `battlePass`, `referrals`, `themePurchase`, `productionIndexes`, `config/migration.ts`) or for real admin route-handler execution under a valid JWT; unauthenticated rejection and valid-JWT guard-layer tests were added 2026-11-23.
- Android: no tests for media `create`/`complete`/`cancel` HTTP protocol, the `503`/`501` legacy fallback boundary, failed-upload cleanup/quota release, ViewModel progress/token/cancel behavior (including the pre-sessionId window), or catalog/policy parity with server values.

See [the migration test plan](../testing/migration-test-plan.md).

## 6. Documentation reconciliation actions

| Item | Action |
|---|---|
| Root `MIGRATION_PROGRESS.md` | Keep as the single migration tracker; update after every phase. |
| `docs/cloudflare-migration/audit.md` | Keep as historical evidence; add a dated note or link from this report that its media/R2 row predates the uncommitted R2 foundation. |
| `docs/production/current-progress.md` | Treat as stale baseline `b1e8241`; do not use its 151/23 test counts as current. Current task baseline is 221 API / 34 hardening / 38 Android core API. |
| `docs/features/cosmetics-ecosystem-audit.md` | Fix stale “No step below has been executed” status separately; later sections record implemented phases. |
| `docs/CURRENT_TASK.md` | Duplicate `YUGM-UI-SPINNER-008` entry should be reconciled in a separate task, not as part of Cloudflare migration. |
| `docs/FEATURE_REGISTRY.md` | Old test counts and onboarding state claims should be refreshed separately. |
| `docs/features/avatar/TESTING.md` | Placeholder status contradicts later recorded verification; refresh separately. |
| Static production CSV inventories | Keep as historical; regenerate only from a known source state and with explicit authorization. They currently omit `/api/media/*` and R2 models. |
| `docs/decisions/README.md` | No ADRs exist. Create ADRs only after D1/Hyperdrive and credential remediation decisions are actually made. |

## 7. Architecture direction

The target architecture and anti-patterns are recorded in [target architecture](../architecture/target-architecture.md). In summary:

- Workers own HTTP API, validation, authz, business rules, webhooks, orchestration and private media grants.
- D1 or Hyperdrive-backed PostgreSQL owns authoritative relational state; financial state stays atomic in one database.
- R2 owns binaries with immutable versioned keys, checksums, metadata, ownership and visibility.
- Durable Objects own coordination scoped by conversation/room/user/PKD, not one global object, and use hibernation where protocol allows.
- Queues own small idempotent async commands; KV only non-critical cache/config; Cron bounded idempotent maintenance.
- LiveKit/Firebase/payments remain external providers behind server adapters until separately decided.
- Centralized assets separate identity, artwork/version, store listing, price, availability, ownership, equipped state, reward conditions and rendering configuration.

## 8. Blocking decisions

1. **Credential remediation:** rotate/revoke tracked secrets and move them out of source before further Cloudflare work.
2. **Database choice:** collect production metrics and record a D1-versus-Hyperdrive ADR.
3. **Realtime protocol:** decide whether to preserve Socket.IO/Engine.IO through a tested adapter or define a versioned client protocol migration; current bridge is fragile and non-hibernating. The Android `BONDS` topic mismatch is an input to this decision.
4. **Media cutover scope:** confirm R2 provisioning, buckets, domains/CORS, media inventory and room/clan private-media semantics; fix the Android detail-screen wiring and failed-upload cleanup before adding categories.
5. **Production authorization:** no destructive migration, deploy, DNS change, paid provisioning or release without explicit approval.

Exact inputs, options and approvals for all five gates are consolidated in the [Phase 0 decision request](decision-request.md).

## 9. Phase 0 artifacts

| Area | Document |
|---|---|
| Progress tracker | [MIGRATION_PROGRESS.md](../../MIGRATION_PROGRESS.md) |
| Target responsibility map | [Target architecture](../architecture/target-architecture.md) |
| Backend source | [Backend source audit](../architecture/backend-source-audit.md) |
| Android source | [Android source audit](../architecture/android-source-audit.md) |
| Platform evidence | [Cloudflare limits and pricing](../infrastructure/cloudflare-platform-limits.md) |
| Worker prototype | [Worker prototype audit](../infrastructure/worker-prototype-audit.md) |
| Admin/infra/CI | [Admin, infrastructure and CI/CD audit](../infrastructure/admin-deployment-audit.md) |
| Environments | [Environments and operations plan](../infrastructure/environments.md) |
| Database decision | [D1 capacity assessment](../database/d1-capacity-assessment.md) |
| Database mapping | [MongoDB to relational mapping](../database/mongo-to-relational-mapping.md) |
| Per-feature impact | [Per-feature migration matrix](../migration/feature-matrix.md) |
| API compatibility | [API and client compatibility plan](../migration/api-compatibility.md) |
| Data pipeline | [Data migration tooling requirements](../migration/data-migration-tooling.md) |
| Realtime | [Realtime migration plan](../migration/realtime-plan.md) |
| Realtime events | [Source-verified event inventory](../migration/realtime-event-inventory.md) |
| Execution phases | [Repository-specific implementation plan](../migration/implementation-plan.md) |
| Verification | [Migration test plan](../testing/migration-test-plan.md) |
| Security blocker | [Tracked Worker credentials finding](../infrastructure/tracked-worker-credentials-finding.md) |
| Decision request | [Phase 0 decision request](decision-request.md) |
| Handoff | [2026-11-22 Phase 0 handoff](../handoffs/2026-11-22-cloudflare-migration-phase0.md) |

## 10. Current conclusion

All four source audits (backend, Android, admin/infrastructure, Worker prototype) and the documentation/test inventory have been reconciled into this report, the [feature matrix](../migration/feature-matrix.md), the [data mapping](../database/mongo-to-relational-mapping.md) and the [API compatibility plan](../migration/api-compatibility.md). The audit and planning portion of Phase 0 is complete.

Phase 0 is **not** accepted and no implementation phase may start until the owner resolves credential remediation, supplies production capacity metrics and approves the D1-versus-Hyperdrive ADR, chooses the realtime protocol path, and accepts this plan. No build, test, migration, deploy, provisioning, credential change or live request was run for Phase 0; all verification was read-only static inspection.
