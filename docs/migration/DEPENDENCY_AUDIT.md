# Dependency audit and migration matrix

**Date:** 2026-11-22
**Status:** Phase 0 evidence artifact for the full Cloudflare migration directive. This is a read-only inventory. It does not authorize dependency removal, credential changes, provisioning, deployment or data migration. “Verified” below means checked against current source/config in this phase; items marked “documented only” come from earlier audits and require re-verification before removal.

## 1. Method and evidence

- Read `package.json` files for the root workspace and all four apps.
- Searched current TypeScript sources for executable imports and initialization sites of every infrastructure dependency named in the directive.
- Read Wrangler local/staging/production configs, `render.yaml`, `docker-compose.yml`, `Dockerfile`, `.env.example` files and GitHub Actions workflows.
- Used Git to distinguish tracked from ignored env/secret files.
- Read `backend-server/package-lock.json` (lockfileVersion 3) to resolve declared ranges to installed versions: 46 unique declared package names and 510 transitive-only names.
- Cross-checked earlier Phase 0 audits (`docs/architecture/backend-source-audit.md`, `docs/architecture/android-source-audit.md`, `docs/infrastructure/admin-deployment-audit.md`, `docs/infrastructure/worker-prototype-audit.md`) without treating them as current runtime proof.
- No build, test, migration, deploy, live request or credential value read was performed.

## 2. Dependency migration matrix

| Legacy service | Current implementation (verified unless noted) | Dependent features | Cloudflare replacement | Phase | Status | Validation requirements | Removal criteria |
|---|---|---|---|---|---|---|---|
| MongoDB / Mongoose `^8.4.1` (API), `^8.24.1` (Worker) | Authoritative persistence. `src/config/db.ts`, `src/app.ts`, ~95 `src/models/*.ts`, most `src/services/*` and `src/routes/*`; read-only adapter in `src/migration/mongoSource.ts` | Identity, finance, social, messages, rooms, catalog, assets, media registry, moderation, events, progression | D1 (ADR-0001) | 3, 6 | **Active**; D1 tooling local-only | Counts, identities, message counts, wallet/ledger reconciliation, ownership, badges, achievements, media refs, restore rehearsal | D1 repositories working through real application paths; final delta sync validated; no supported client or job writes to MongoDB; approval |
| Render hosting (`render.yaml`, `autoDeployTrigger: off`) | Legacy API host retained for rollback; no workflow deploys it | Whole API | Cloudflare Workers (`yugm-api-staging` live; production source-only) | 18, 19, 22 | **Retained for rollback** | Staging acceptance, production smoke, stability period, backup verified | No production traffic, no supported client dependency, explicit retirement approval |
| Redis / ioredis `^5.4.1` | `src/services/redis.ts:1`; rate-limit fallback in `src/middleware/rateLimit.ts`; Socket.IO adapter | Rate limits, cache, jobs, sockets | DO coordination, Workers Rate Limiting, KV for non-critical cache, Queues | 8, 11 | **Active** | Replacement for each usage verified; no required path initializes Redis; jobs drained | All discovered usages mapped and replaced; approval |
| BullMQ `^5.79.3` | `src/services/jobs.ts:1` (`Queue`, `Worker`, `Job`) | Background jobs | Cloudflare Queues + Cron/DO alarms | 11 | **Active** | Durable IDs, idempotent consumers, retry/DLQ, bounded batches, no duplicate rewards | Queues provisioned and validated; legacy jobs drained; approval |
| Socket.IO `^4.7.5` + `@socket.io/redis-adapter ^8.3.0` | `src/services/socket.ts:3–4`; Engine.IO bridge in Worker `src/socketBridge.ts:7` | Private/clan chat, presence, typing, receipts, rooms, gifts, PK | Scoped SQLite-backed Durable Objects + WebSockets | 9 | **Active**; bridge experimental, non-hibernating | DCR-3 protocol choice; event-parity suite; reconnect/restart/dedupe tests; two-client validation | Supported Android clients migrated; parity suite green; approval |
| LiveKit `livekit-server-sdk ^2.5.1` (Android SDK documented) | `src/services/livekit.ts:1`, `src/routes/livekit.ts:8` | Voice rooms, video rooms, calls, tokens | Cloudflare Realtime SFU/TURN; provider-neutral RTC abstraction | 10 | **Active** | Two-participant device tests, permission/track authz, reconnect, feature parity, no participant-minute service without approval | RTC abstraction complete across clients; parity/reliability proven; approval |
| Sharp `^0.35.5` | Runtime import only `src/services/imageProcessor.node.ts:1`; test imports in `media.integration.test.ts:13` and `media.routes.integration.test.ts:16`. Node provider installed by `src/index.ts`; Worker uses `apps/cloudflare-worker/src/imageProcessor.ts` | Image metadata, WebP variants, thumbnails, avatar/cosmetic art | Cloudflare Images binding + host-neutral registry | 3, 5 | **Isolated to Node entry point/test**; not in Worker bundle | Worker bundle grep clean (done in prior work); live media renders; scheduled jobs healthy; parity for transparency/animated assets | No required runtime or offline tool imports it; Worker bundle still clean; approval |
| Local filesystem storage | `src/services/storage.ts:2` (`createReadStream`), `src/routes/upload.ts:4`, `src/routes/adminReactions.ts:4`; migration scripts use `node:fs/promises` | Legacy uploads, reactions, offline migration tooling | R2 + D1 registry | 4, 20 | **Active for legacy paths and tooling** | Managed upload cycle, legacy URL mapping, private buckets, media manifest | No production upload/read path uses local disk; offline tools isolated; approval |
| S3-compatible legacy storage (`@aws-sdk/client-s3 ^3.1081.0`, presigner) | `src/services/storage.ts:7`, dynamic import at `:387`; used when `STORAGE_DRIVER=s3`, which is also how R2 is accessed via S3 API | Legacy S3/emulator and current R2 foundation | R2 (S3-compatible API) with server-only keys | 4 | **Active dual use** | Live upload→publish→read→archive; bucket policies; no credentials in clients | All media through centralized R2 service; legacy S3 config removed; approval |
| Firebase Admin `^13.6.0` | `src/services/firebase.ts:1–2` (type import + JWT) | Auth token verification, FCM | **Retained external**; verification in Workers | 15 | **Active / retained** | Workers verification tests, session preservation, FCM delivery | Not removed; only non-Auth/FCM Firebase usage would be migrated after audit |
| Express `^4.19.2`, multer, helmet, CORS, rate-limit, Zod | `src/app.ts:5`, route modules throughout | HTTP API, validation, upload | Workers HTTP handling with shared validation/business rules | 3, 7 | **Active inside Worker compatibility layer** | Contract parity, CPU/limits, readiness gates | Workers-native handlers replace Express paths and contracts pass |
| GitHub Actions staging deploy | `.github/workflows/cloudflare-staging.yml` | Staging Worker + Pages deploy | Keep (consolidated) | 22 | **Active**; duplicate gates with `ci.yml`, manual Pages workflow can redeploy staging | No duplicate builds/deploys; single authoritative workflow | Consolidation approved; not a legacy dependency |
| Cloudflare Images | `IMAGES` binding in all three Wrangler configs; Worker provider installed in `runtime.ts` | Transformations/info only | Already Cloudflare | 3, 5 | **Active**; no paid Images storage enabled | Rendered media parity, transparency/animated checks | Not removed |
| Cloudflare D1 / R2 / Queues / KV | **No bindings in any Wrangler config** (verified) | Planned authoritative storage/async/cache | Target architecture | 1, 2, 6, 11 | **Not provisioned** | Provisioning approval, bindings, live validation | Not applicable until implemented |
| Cron Triggers | No `crons` array in any Wrangler config; maintenance/PK use Node timers and DO alarms | Scheduled maintenance, expiration, reconciliation | Cron + DO alarms | 11 | **Partially active via alarms** | Idempotency, overlap prevention, scheduled handler success | Legacy timers removed after Cron ownership proven |

### 2.1 Lockfile-resolved versions (evidence)

Declared ranges above are intentionally kept as source truth. The installed resolutions from `backend-server/package-lock.json` are recorded here for reproducibility. These are **not** "latest" comparisons and no upgrade is proposed.

| Package | Declared (API / Worker) | Resolved |
|---|---|---|
| `typescript` | `~5.3.3` (all workspaces) | `5.3.3` |
| `wrangler` | `^4.164.0` | `4.164.0` |
| `@cloudflare/workers-types` | `^5.20261117.1` | `5.20261117.1` |
| `mongoose` | `^8.4.1` / `^8.24.1` | `8.24.10` (both) |
| `express` | `^4.19.2` | `4.22.2` |
| `socket.io` | `^4.7.5` | `4.8.3` |
| `ioredis` | `^5.4.1` | `5.11.1` |
| `bullmq` | `^5.79.3` | `5.79.3` |
| `@socket.io/redis-adapter` | `^8.3.0` | `8.3.0` |
| `livekit-server-sdk` | `^2.5.1` | `2.16.0` |
| `firebase-admin` | `^13.6.0` | `13.10.0` |
| `sharp` | `^0.35.5` | `0.35.5` |
| `@aws-sdk/client-s3` / presigner | `^3.1081.0` | `3.1081.0` |
| `zod` | `^3.23.8` | `3.25.76` |
| `jsonwebtoken` | `^9.0.2` | `9.0.3` |
| `multer` | `^1.4.5-lts.1` | `1.4.5-lts.2` |
| `vite` | `^5.4.11` | `5.4.21` |

Notes: `mongodb` exists only transitively (`6.20.0` under Mongoose; `7.5.0` under `mongodb-memory-server-core`) and is never imported directly. The Worker `^8.24.1` vs API `^8.4.1` Mongoose skew resolves to the same installed version but should be aligned before any lockfile-sensitive migration step. `engine.io` (`6.6.11`) and `@livekit/protocol` (`1.48.2`) are transitive. `redis`/`@upstash/redis`, `nodemailer`, `axios`, `stripe`, `fluent-ffmpeg`, `ffmpeg-static`, `firebase` client SDK, `livekit-client` and `@livekit/rtc-node` have no lockfile entry and no executable source import.

## 3. Detailed dependency inventory

Source counts verified in this phase: **91** Mongoose model files, **50** non-test route modules, **54** API `*.test.ts` files, and two D1 SQL/manifest files. BullMQ has exactly **one** queue (`push-notifications`), not a general job system. Mongoose model count is 91, not the ~95/97 root-collection figure used in earlier planning docs; the D1 manifest reports 97 root tables and 146 total tables. These figures need reconciliation before capacity planning.

### 3.1 Persistence and messaging

| Package | Version | Direct/transitive | Import and init | Features | Data/storage | Env/credentials | Status | Replacement | Risk | Removal criteria |
|---|---|---|---|---|---|---|---|---|---|---|
| `mongoose` | `^8.4.1` API, `^8.24.1` Worker | Direct in both apps | `apps/api/src/config/db.ts:1`, `app.ts:8`, model files; Worker imports shared API | All authoritative domains | MongoDB | `MONGODB_URI`, `MONGODB_DB_NAME` | Active; Worker staging uses `YugmStaging` guard | D1 via `src/migration/*` and future repositories | Transaction semantics, 97 collections, identity preservation | Verified D1 cutover + approval |
| `ioredis` | `^5.4.1` | Direct | `apps/api/src/services/redis.ts:1` | Redis client; rate-limit fallback | Redis | `REDIS_URL` | Active | DO/KV/Rate Limiting per usage | Cache substituted for atomic ops; jobs/presence | Usage-by-usage replacement verified |
| `bullmq` | `^5.79.3` | Direct | `apps/api/src/services/jobs.ts:1` | Queues/workers | Redis | `REDIS_URL` | Active | Cloudflare Queues + Cron | At-least-once, retries, duplicates | Queue bindings live and jobs drained |
| `@socket.io/redis-adapter` | `^8.3.0` | Direct | `apps/api/src/services/socket.ts:4` | Multi-process socket fan-out | Redis | `REDIS_URL` | Active | Scoped DO WebSockets | Protocol compatibility, hibernation | DCR-3 + parity tests + client migration |
| `socket.io` | `^4.7.5` | Direct | `apps/api/src/services/socket.ts:3`; Worker `src/socketBridge.ts:7` | Realtime events | Process state + MongoDB | Socket URL in Android | Active; bridge experimental | Native DO WebSocket protocol or compatibility adapter | Engine.IO internals, non-hibernating, restart recovery | DCR-3, event-parity, approval |
| `livekit-server-sdk` | `^2.5.1` | Direct | `apps/api/src/services/livekit.ts:1`, `routes/livekit.ts:8` | RTC tokens/rooms | LiveKit project | `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | Active | Cloudflare Realtime SFU/TURN behind RTC abstraction | Feature parity, device/network tests, no participant-minute billing | RTC parity and approval |

### 3.2 Media and images

| Package | Version | Direct/transitive | Import and init | Features | Data/storage | Env | Status | Replacement | Risk | Removal criteria |
|---|---|---|---|---|---|---|---|---|---|---|
| `sharp` | `^0.35.5` | Direct | `apps/api/src/services/imageProcessor.node.ts:1`; tests `media.integration.test.ts:13`, `media.routes.integration.test.ts:16`. No Worker source import | Variants, metadata, WebP, first-frame GIF, metadata stripping | Local bytes / S3 staging | none | Isolated Node provider; Worker bundle verified clean in prior work | Cloudflare Images provider already installed for Worker | Native module in Worker bundle; transparency/animated behavior | All operations parity-tested, bundle grep clean, no Node runtime need |
| `@aws-sdk/client-s3` + presigner | `^3.1081.0` | Direct | `apps/api/src/services/storage.ts:7`, dynamic import `:387`, `services/r2.ts` | Legacy S3 and current R2 object operations | S3/R2 | `R2_*`, `S3_*` | Active | R2 S3-compatible API behind one service | Credential exposure, bucket policy, legacy URL mapping | All media via R2 service; config cleaned |
| Local `fs` | Node built-in | Direct | `services/storage.ts:1–2`, `routes/upload.ts:4`, `routes/adminReactions.ts:4`, migration scripts | Uploads, assets, offline tooling | Local disk | none | Active for legacy paths | R2/D1 | Missing files cannot be reconstructed from DB refs. `storage.ts` (top-level `fs` import) is in the Worker module graph; local branches are not selected under `STORAGE_DRIVER=mongodb` and `nodejs_compat` is enabled, but this must be re-verified if the driver changes | No production path depends on local disk |

### 3.3 Retained and supporting services

| Package | Version | Direct/transitive | Import and init | Features | Replacement / status |
|---|---|---|---|---|---|
| `firebase-admin` | `^13.6.0` | Direct | `apps/api/src/services/firebase.ts:1–2` | Firebase Auth verification, FCM | **Retained**; verify tokens in Workers, audit other Firebase services |
| `express` | `^4.19.2` | Direct | `apps/api/src/app.ts:5`, routes | HTTP API and middleware | Workers with equivalent contracts |
| `jsonwebtoken` | `^9.0.2` | Direct | `middleware/auth.ts:2`, `adminAuth.ts:3` | App/admin JWT | Workers verification with server-held secrets |
| `zod` | `^3.23.8` | Direct | `config/env.ts:2`, `middleware/validate.ts:2`, routes | Request/env validation | Reuse in Workers |
| `@yugm/shared` | local workspace | Direct | shared contracts/socket events | Schemas and events | Reuse; no duplicate contracts |
| Admin React/Vite | React `^18.3.1`, Vite `^5.4.11` | Direct | `apps/admin/package.json` | Admin SPA | **Retained** on Cloudflare Pages |

Not discovered: Upstash packages, FFmpeg/fluent-ffmpeg, Firestore/Realtime Database/Firebase Storage SDKs in current executable code, Stripe, Nodemailer, Axios, and a tracked gitleaks configuration. Historical docs may mention them; they are not active dependencies in the audited sources. Lockfile analysis (section 2.1) and direct-import searches were run; Gradle dependency resolution was not.

### 3.4 Android and admin client dependencies (source-verified)

| Dependency / area | Version / state | Location | Migration relevance |
|---|---|---|---|
| LiveKit Android SDK | `2.20.3` | `android-client/gradle/libs.versions.toml:16,54`; `core/api/build.gradle.kts:38`; `feature/room/build.gradle.kts:54`; `YugmMediaRoom.kt:69–123,183–240,301–347` | Provider-specific RTC code in client; must move behind an RTC abstraction before LiveKit retirement |
| Socket.IO Java client | `2.0.1` | `libs.versions.toml:20,61`; `app/build.gradle.kts:236`; `YugmSocket.kt:15–271`; `SocketManager.kt:23–354` | Two socket clients coexist; protocol decision DCR-3 blocks removal |
| Firebase BOM | `34.6.0` | `libs.versions.toml:14,50`; `app/build.gradle.kts:238–240` | Auth/FCM retained; other Firebase services not found in executable code |
| Firebase App Check | BOM-managed | `app/build.gradle.kts:242,279`; `YugmHttpClient.kt:161–172` | Retain with server verification |
| Google Play Billing | `6.2.1` | `libs.versions.toml:3,60`; `GooglePlayBillingManager.kt:62–75` | Retained external payment provider |
| Razorpay Checkout | `1.6.41` | `libs.versions.toml:19,59`; `RazorpayCoordinator.kt:13–19` | Retained payment provider |
| Facebook Login | `19.0.0` | `libs.versions.toml:25,65`; `FacebookLoginCoordinator.kt:26` | Retained auth integration |
| OkHttp | `4.12.0` | `libs.versions.toml:13,49`; `YugmHttpClient.kt:52–110` | Central HTTP client; dual base failover only for debug |
| Coil / Lottie | `2.7.0` / `6.6.6` | `libs.versions.toml:17–18,55–58` | Asset rendering; Coil cache isolation on account switch not implemented |
| Security Crypto | `1.0.0` (deprecated `MasterKeys`) | `libs.versions.toml:23,71`; `SessionManager.kt:5–26` | Not a migration dependency; do not remove until session storage replaced |
| Admin runtime deps | React `^18.3.1`, Vite `^5.4.11`, lucide-react `^0.468.0` | `apps/admin/package.json:12–23` | No LiveKit, Socket.IO, MongoDB/GridFS or storage SDK in admin; REST-only client |
| Admin API client | `src/api.ts:1–78` | Bearer token, 12-minute refresh (`App.tsx:118–130`) | No infrastructure credentials in browser; server RBAC remains the boundary |
| Hardcoded Android catalogs | ~115 cosmetic labels, fallback visuals, 11 store categories, 8 reactions | `core/util/.../CosmeticNames.kt:3–120`; `core/ui/.../CosmeticVisuals.kt:30–56`; `feature/profile/.../CosmeticsStoreScreen.kt:54–83`; `feature/chat/.../ChatScreenDialogs.kt:586–600` | Must move behind server-administered config only after DB records verified; retain offline fallbacks |
| Direct composable/nav-graph API calls | Many (e.g. `WalletNavGraph.kt:32–118`, `EventsNavGraph.kt:64–129`, `SettingsScreen.kt:146–307`) | See Android audit | Architecture debt; introduce repository/state-holder boundaries for cut-over domains |
| Bundled binary assets | Launcher/onboarding images, two scene images, fonts, spinner | `feature/auth/.../drawable/*`, `feature/room/.../drawable-nodpi/*`, `core/ui/.../raw/loading_spinner.json` | Retain essential offline/launcher assets; no bundled cosmetic image files found |
| Duplicate admin components | `components/LoginScreen.tsx`, `components/Navigation.tsx` not imported by `App.tsx` in inspected imports | `apps/admin/src/components/*` | Dead-code candidate only after reference/import verification |

No Render API base URL was found in the audited Android source; absence across generated/unread material is not proven.

## 4. Environment variables and credentials (names only)

- **Tracked local Worker config** `backend-server/apps/cloudflare-worker/wrangler.jsonc:35–60` contains credential-bearing `vars`: `MONGODB_URI`, `JWT_SECRET`, `DEV_BYPASS_OTP`, `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `ADMIN_JWT_SECRET`, `ADMIN_REFRESH_SECRET`, seed admin credentials, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and others. Values are **not** reproduced here. This is the unresolved DCR-1 critical finding.
- Staging and production Wrangler `vars` are non-secret configuration only (stage, DB name, storage driver, feature flags, Google Play package, CORS). No D1/R2/KV/Queue IDs appear in config.
- `backend-server/apps/api/.env.example` (tracked) names `MONGODB_URI`, `REDIS_URL`, `JWT_SECRET`, `LIVEKIT_*`, `R2_*`, `S3_*`, FCM, Razorpay and Google Play variables. Sanitized placeholders only.
- Ignored local files: `apps/api/.env`, `android-client/.env`, `android-client/local.properties`; `.dev.vars` is ignored but absent. `apps/api/google-services.json` is tracked Firebase client config, not a secret.
- CI uses `vars.CLOUDFLARE_ACCOUNT_ID` and `secrets.CLOUDFLARE_API_TOKEN` in Cloudflare workflows; Android release uses four upload-key secrets. No secret value was read.
- **No secret-scanning gate exists** in any workflow; no gitleaks config found. This is a Phase 1/16 requirement.

## 5. Infrastructure/configuration inventory

| Artifact | Status | Migration action |
|---|---|---|
| `.github/workflows/ci.yml` | Active; typecheck, unit, hardening, Worker dry-run/realtime, Android checks, report-only credential guard and admin typecheck/test/build (added 2026-11-23) | Reuse; admin runtime UI permission QA and strict secret scanning still open |
| `.github/workflows/cloudflare-staging.yml` | Active; green runs #77/#78; deploys Worker and Pages admin | Consolidate duplicated gates with `ci.yml`; keep `/ready` gate |
| `.github/workflows/cloudflare-pages.yml` | Manual Pages deploy; can redeploy staging | Consolidate with staging workflow; guard already rejects legacy/credential URLs |
| `.github/workflows/android-release.yml` | Tag-triggered release to GitHub Release | Keep; release still defaults to staging Worker |
| `wrangler.jsonc`, `wrangler.staging.jsonc`, `wrangler.production.jsonc` | DO `API_SERVICE` + Images `IMAGES` only; compat date `2026-08-04`, `nodejs_compat`; no D1/R2/KV/Queue/crons | Add bindings only after provisioning approval; remove tracked secrets after DCR-1 |
| `render.yaml` | Retained rollback host, auto-deploy off | Do not delete until cutover + stability period + approval |
| `docker-compose.yml`, `apps/api/Dockerfile` | Local Mongo/Redis/LiveKit dev and Node API image | Retain for local/offline migration until replacements verified |

## 6. Partially migrated and obsolete compatibility layers

1. **Image processor registry** — completed Worker isolation (YUGM-WORKER-1101). Sharp remains a Node-only provider; Cloudflare Images is active. Not yet proven for every required transformation on real media.
2. **R2 media foundation** — avatar vertical slice only; `STORAGE_DRIVER=s3` configured locally, tracked Worker configs remain `mongodb`. Not provisioned or live-verified.
3. **Engine.IO bridge** — `src/socketBridge.ts:7` explicitly experimental, non-hibernating, depends on locked Engine.IO internals, incomplete restart recovery. Not a production protocol.
4. **Singleton `YugmApi` Durable Object** — wraps Express/Mongoose; earlier plan explicitly says do not keep as production architecture. No scoped conversation/room/user DO classes exist yet.
5. **Legacy upload paths** — `routes/upload.ts`, local `fs`, GridFS/S3 mix coexist with the centralized media session protocol.
6. **Startup compatibility** — migrations/indexes/seeds run after `listen()` in `src/index.ts:44–47`; readiness now exposed via `/ready` but startup failures still need an authoritative gate.
7. **Stale docs** — `docs/production/README.md:47`, `implementation-sequence.md:10` reference a deleted `deploy.yml`; Render auto-deploy claims are outdated.

## 7. Remaining verification before any removal

- Android Gradle dependency resolution and full runtime dependency graph (not run; no Gradle invocation). Backend lockfile analysis is complete in section 2.1.
- Worker bundle re-check at each release; current emitted bundle was previously verified free of Sharp paths and `createRequire(import.meta.url)`.
- Live R2 upload cycle, private-media authorization and CDN/CORS policy.
- D1 export/import/restore rehearsal and financial reconciliation.
- Realtime parity suite and DCR-3 protocol decision.
- RTC two-participant device and network testing.
- Secret rotation/removal and CI secret-scanning gate (DCR-1).
- Android and admin production bundle inspection for retired-service network calls.

## 8. Gate

No dependency in the matrix may be classified as removed while it remains in an active deployment, a required dependency graph, a supported client or a migration tool. Removal requires: replacement functional and integrated, tests passed through the real application path, data and jobs migrated, final backup retained, explicit approval, and a documented removal report. This audit supplies the baseline inventory only.

## 9. Related documents

- `docs/migration/DIRECTIVE_RECONCILIATION.md`
- `docs/migration/BASELINE_REPORT.md`
- `docs/migration/BACKUP_AND_RECOVERY.md`
- `docs/migration/ROLLBACK_PLAN.md`
- `docs/cloudflare-migration/phase0-report.md`
- `docs/infrastructure/tracked-worker-credentials-finding.md`
