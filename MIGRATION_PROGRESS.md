# Yugm Cloudflare migration progress

This is the persistent, single-source tracker for the MongoDB/Render to Cloudflare migration. Update it after every phase. It records work actually performed and verified; it does not imply that a planned phase is complete.

## Current phase

| Field | Value |
|---|---|
| Phase | Phase 0 — audit, architecture decisions and implementation planning |
| Status | Audit/planning complete; DCR-1/DCR-2/DCR-3 and DCR-5 authorization answered; local code + tests authorized; DCR-4 and detailed inputs still open |
| Started | 2026-11-22 |
| Last updated | 2026-11-22 |
| Overall gate | No production data, credentials, DNS, billing, deploy, migration or release has been changed or authorized |
| Commit/push | Owner authorized commit and push of the current local-only changes on 2026-11-22; deploy, provision, migration and release remain unauthorized |

## Scope for Phase 0

- Audit the actual backend, Android, admin, Worker prototype, schemas, APIs, realtime, media, jobs, infrastructure, tests and documentation without assuming docs are current.
- Preserve the uncommitted R2 media/avatar foundation as the baseline; do not overwrite it.
- Document the current system, target responsibilities, per-feature migration impact, database mapping, API compatibility, infrastructure environments, security/observability/cost controls and test plan.
- Decide D1 versus PostgreSQL/Hyperdrive only after production capacity metrics are available.
- Stop before destructive production changes, paid provisioning, credential handling or significant unresolved architecture decisions.

## Work log

### 2026-11-22 — Realtime parity matrix added (DCR-3 harness, unwired)

- **Status:** local harness only. No adapter, Durable Object, client, deployment or data change. No commit or push.
- **Added/updated files:** `backend-server/packages/shared/src/realtimeParity.ts`, `backend-server/packages/shared/src/realtimeParity.test.ts`, `backend-server/packages/shared/src/index.ts`, `docs/decisions/0002-staged-hybrid-realtime-protocol.md`, `docs/migration/realtime-plan.md`, `docs/INDEX.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-22-realtime-parity-matrix.md`.
- **Verification performed:** `npm.cmd run test --workspace @yugm/shared` 12/12 passed; `npm.cmd run typecheck --workspace @yugm/shared` and `--workspace @yugm/api` passed; a broken test double was detected by the matrix.
- **Issues:** no real adapter exists, so protocol interoperability is unproven. The `BONDS` and other sign-off-dependent checks are skipped by default; 10 requirements remain documented but not executable.
- **Decisions:** implements the dual-test-matrix consequence of DCR-3 Option C (ADR-0002); no new product decision.
- **Dependencies:** owner DCR-3 inputs, then concrete adapters before the matrix can run against real paths.
- **Risks:** passing against a test double could be mistaken for adapter parity; scenario isolation depends on unique peer IDs and scopes.
- **Next task:** after owner sign-off, implement the compatibility adapter and native DO protocol, then run this matrix against both paths before cutover.

### 2026-11-22 — Read-only media inventory reporter added (DCR-4 input preparation)

- **Status:** local tooling only; no export, provision, policy decision, deployment or data change. No commit or push.
- **Added/updated files:** `backend-server/apps/api/src/migration/mediaInventory.ts`, `backend-server/apps/api/src/migration/mediaInventory.test.ts`, `backend-server/apps/api/src/scripts/media-inventory.ts`, `backend-server/apps/api/package.json`, `docs/cloudflare-migration/decision-request.md`, `docs/migration/BACKUP_AND_RECOVERY.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-22-media-inventory-reporter.md`.
- **Verification performed:** `npm.cmd exec -- tsx --test src/migration/mediaInventory.test.ts src/migration/verifyBackup.test.ts` 10/10 passed; `npm.cmd run typecheck --workspace @yugm/api` passed; `inventory:media` CLI smoke on a generated JSONL fixture produced a complete report. No database, bucket or remote access.
- **Issues:** no real media data was read; legacy `/uploads` coverage, binary verification and media backup remain unaddressed. Public/private bucket policy is deliberately not asserted because DCR-4 is still open.
- **Decisions:** none; implements an input-preparation item from DCR-4 under DCR-5 local-code-and-tests authorization.
- **Dependencies:** owner-approved media export before real numbers; DCR-4 environment inputs and option selection.
- **Risks:** partial inventory could be mistaken for a complete media census or for proof that binaries exist and are restorable.
- **Next task:** owner supplies DCR-4 scope/environment inputs and approves an export; then run the reporter on real data and cross-check against the legacy `/uploads` gap before any cutover.

### 2026-11-22 — Snapshot-copy integrity verifier added (Phase 1 tooling)

- **Status:** local read-only tooling only. No backup created, no restore rehearsed, no commit, push, provision, deploy, credential change or data migration.
- **Added/updated files:** `backend-server/apps/api/src/migration/verifyBackup.ts`, `backend-server/apps/api/src/migration/verifyBackup.test.ts`, `backend-server/apps/api/src/scripts/verify-backup.ts`, `backend-server/apps/api/src/migration/snapshot.ts`, `backend-server/apps/api/package.json`, `docs/migration/BACKUP_AND_RECOVERY.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-22-backup-integrity-verifier.md`.
- **Verification performed:** `npm.cmd exec -- tsx --test src/migration/verifyBackup.test.ts src/migration/adapters.test.ts` 9/9 passed; `npm.cmd run typecheck --workspace @yugm/api` passed; `backup:verify` CLI smoke on a generated fixture produced `PASS` with and without `--expect-digest`. No database, bucket or remote service access.
- **Issues:** verification statuses in `BACKUP_AND_RECOVERY.md` section 5 are unchanged — no real backup or restore yet. The verifier proves copy integrity only, not recoverability.
- **Decisions:** no new product decision; implements procedure step 7 from `docs/migration/BACKUP_AND_RECOVERY.md` under DCR-5 local-code-and-tests authorization.
- **Dependencies:** owner approval and an explicitly identified source environment before any real export; then isolated restore rehearsal and financial/media reconciliation.
- **Risks:** a digest match could be mistaken for a successful restore; manifest and data could be tampered with consistently unless the source digest is recorded independently.
- **Next task:** owner approval for a specific export target, then create and verify a real backup and rehearse a restore before any destructive migration step.

### 2026-11-22 — Native realtime contract foundation added (local, unwired)

- **Status:** local DCR-3 foundation only; no protocol cutover, adapter or client change. No commit, push, provision, deploy, credential change or data migration.
- **Added/updated files:** `backend-server/packages/shared/src/realtimeProtocol.ts`, `backend-server/packages/shared/src/realtimeProtocol.test.ts`, `backend-server/packages/shared/src/index.ts`, `backend-server/packages/shared/package.json`, `docs/migration/realtime-plan.md`, `docs/decisions/0002-staged-hybrid-realtime-protocol.md`, `docs/INDEX.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-22-native-realtime-contract.md`.
- **Verification performed:** `npm.cmd run typecheck --workspace @yugm/shared` passed; `npm.cmd run test --workspace @yugm/shared` 8/8 passed; `npm.cmd run typecheck --workspace @yugm/api` passed. Event constants re-checked against the source-verified inventory (47 + 16 + 17 + 3 = 83 names).
- **Issues:** contract is not consumed by any runtime path; event classification, support window, hibernation requirement, `BONDS` decision and inventory sign-off are still open. No interoperability between the Socket.IO adapter and native protocol has been demonstrated.
- **Decisions:** follows DCR-3 Option C ([ADR-0002](docs/decisions/0002-staged-hybrid-realtime-protocol.md)) and DCR-5 local-code-and-tests ([ADR-0004](docs/decisions/0004-local-code-and-tests-authorization.md)); no new product decision made.
- **Dependencies:** owner DCR-3 inputs, then adapter/parity tests and D1 DO integration design; credential rotation, backup/restore rehearsal and DCR-4 remain prerequisites for cutover.
- **Risks:** an unwired contract could be mistaken for a working adapter; off-catalog literals remain the highest drift risk; dual-protocol maintenance cost until the support-window cutoff.
- **Next task:** after owner sign-off, classify events and build the two-client parity matrix (reconnect, restart, ordering, dedupe, room/DM/gift/PK) before any adapter or cutover work.

### 2026-11-22 — Phase 0 started

- **Status:** In progress.
- **Modified files so far:**
  - `docs/infrastructure/cloudflare-platform-limits.md` (new; official platform-limit/pricing snapshot).
  - `docs/database/d1-capacity-assessment.md` (new; incomplete decision gate with required metrics).
  - `docs/infrastructure/tracked-worker-credentials-finding.md` (new; no secret values reproduced).
  - `MIGRATION_PROGRESS.md` (new; this tracker).
- **Verification performed:** Read AGENTS/index/task docs and checked `git status --short` before edits. Verified with Git commands that `backend-server/apps/cloudflare-worker/wrangler.jsonc` is tracked and not ignored. Fetched official Cloudflare limit/pricing pages. No build, test, migration, deploy or live request was run for Phase 0.
- **Issues:**
  - Critical: tracked Worker config contains plaintext credentials. Remediation requires owner authorization and provider access; see the finding document.
  - Production size/growth/DAU/write-volume metrics are unavailable; D1 decision is blocked.
  - Existing Worker prototype is experimental, uses a singleton Durable Object around Express/Mongoose, GridFS media and a non-hibernating Engine.IO bridge; it is not a production architecture.
- **Decisions:** None committed in Phase 0. D1 remains provisional pending the capacity assessment.
- **Dependencies:** Completed source audits for backend, Android, admin/infrastructure, docs/tests; production metrics and owner approval for credential rotation.
- **Risks:** Secret exposure, incorrect capacity choice, Socket.IO protocol incompatibility, R2/GridFS media divergence, financial atomicity loss, unsupported Node packages in Workers.
- **Next task:** Reconcile the four repository audits into the Phase 0 report and repository-specific phased implementation plan; update this tracker and the task/progress docs.

### 2026-11-22 — Phase 0 evidence and planning expansion

- **Status:** In progress; documentation and source audits expanded, backend/Android audit reconciliation still pending.
- **Added/updated files:**
  - `docs/infrastructure/cloudflare-platform-limits.md` (new; official limits/pricing snapshot).
  - `docs/database/d1-capacity-assessment.md` (new; blocked decision gate).
  - `docs/database/mongo-to-relational-mapping.md` (new; Phase 0 mapping specification, no schema generated).
  - `docs/infrastructure/tracked-worker-credentials-finding.md` (new; no secret values reproduced).
  - `docs/infrastructure/worker-prototype-audit.md` (new; singleton DO/GridFS/Engine.IO bridge audit).
  - `docs/infrastructure/admin-deployment-audit.md` (new; admin, Wrangler, Render and CI/CD audit).
  - `docs/infrastructure/environments.md` (new; environment/binding/secrets plan).
  - `docs/architecture/target-architecture.md` (new; target responsibility map).
  - `docs/architecture/backend-source-audit.md` (new; backend runtime, persistence, API, auth, realtime, jobs and test-gap audit).
  - `docs/cloudflare-migration/phase0-report.md` (new; reconciled evidence baseline).
  - `docs/migration/feature-matrix.md` (new; per-feature state, entities, endpoints, clients, risks and tests).
  - `docs/migration/api-compatibility.md` (new; old/new parity and client compatibility rules).
  - `docs/migration/data-migration-tooling.md` (new; export/import/validation/rollback requirements).
  - `docs/migration/realtime-plan.md` (new; Socket.IO/Durable Object decision gate).
  - `docs/migration/implementation-plan.md` (new; Phase 0–8 dependency chain).
  - `docs/testing/migration-test-plan.md` (new; reuse existing harnesses plus required migration checks).
  - `docs/INDEX.md` (updated; Phase 0 links).
- **Verification performed:** Read-only static audits of backend source (runtime boot, ~95 models, ~606 route registrations, auth, realtime, jobs, integrations, migrations and tests), Worker source/config/tests, admin SPA, Wrangler configs, Render blueprint, GitHub Actions, test scripts and documentation inventory. Git commands confirmed the local Worker config is tracked and not ignored. No build, test, migration, deploy, provisioning, live request or credential change was run in Phase 0.
- **Issues discovered beyond the earlier baseline:**
  - Admin router auth relies on Express mount order; `GET /api/admin/progression/health` appears dead because it is registered before the router-level guard.
  - Admin UI permission gating is cosmetic; server RBAC is the boundary. Admin has no test script and stale unused shell components.
  - CI lacks admin build/test and secret-scanning gates; staging health gate is not a full migration acceptance gate.
  - Production Wrangler CORS is `*`, staging observability does not redact query strings, and Render/Worker Google Play package names differ.
  - Backend startup runs index/migration/seed steps after `listen()` and only logs failures, allowing degraded traffic; `eventsRouter` is double-mounted; payment and Google Play webhook handlers are implemented but unmounted.
  - User auth revocation cache is per-process for 20 seconds; rate limits fall back to process-local memory without Redis; App Check is off by default.
  - Maintenance/PK timers have no distributed leader election; media session/reservation expiry has no sweeper; migration dry-run and index-conflict tests are absent.
- **Decisions:** None committed. D1 remains blocked; Socket.IO protocol path remains a decision gate; credential remediation remains an owner-authorized prerequisite.
- **Dependencies:** Android source audit output still to reconcile; backend audit integrated; production metrics; owner approval for credential rotation, D1/Hyperdrive decision and plan acceptance.
- **Risks:** Secret exposure, auth mount-order regressions, admin RBAC/UI divergence, D1 capacity mismatch, Socket.IO incompatibility, media cutover without provisioned R2, and false confidence from staging smoke tests.
- **Next task:** Reconcile the remaining Android audit into the per-feature matrix and data/API compatibility plan; then update task/progress docs and stop for approval.

### 2026-11-22 — Phase 0 audits reconciled; audit/planning closed pending decisions

- **Status:** Audit and planning complete; phase not accepted. No implementation phase started.
- **Added/updated files:**
  - `docs/architecture/android-source-audit.md` (new; modules, network, realtime, media, hardcoded catalogs, design system and test gaps).
  - `docs/cloudflare-migration/phase0-report.md` (updated; Android findings, corrected test inventory and final conclusion).
  - `docs/migration/feature-matrix.md` (updated; Android risks per feature plus cross-cutting client debt row).
  - `docs/migration/api-compatibility.md` (updated; concrete Android caller map and compatibility caveats).
  - `docs/migration/implementation-plan.md` (updated; Android Phase 7 debt).
  - `docs/testing/migration-test-plan.md` (updated; Android protocol/ViewModel and catalog-parity test gaps).
  - `docs/INDEX.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md` (updated).
  - `docs/handoffs/2026-11-22-cloudflare-migration-phase0.md` (new; dated handoff).
  - `docs/cloudflare-migration/decision-request.md` (new; consolidated five-gate request with exact metrics, options and approvals).
  - `docs/INDEX.md` (updated; decision-request link and stale "work in progress" note removed).
  - `MIGRATION_PROGRESS.md` (this tracker; status and work log).
- **Verification performed:** Read-only Android source inspection. Key claims were independently re-checked against source before recording: hardcoded catalogs (`CosmeticNames.kt:3–118`, `VipPlansScreen.kt:57`, `GiftCatalogScreen.kt:46`, `FilteredInput.kt:18`), the `coinToInrRate` fallback nuance (`WalletModels.kt:73` default `0.01`, but `CreatorApi.kt:123` prefers the server value), `resolveMediaUrl()` in `ApiConfig.kt:22`, and the `ProfileDetailScreen.kt:202` gap where only `avatarUploadBusy` is read while `ProfileViewModel.kt:154–160` exposes an unused cancel API. `git status --short` reconfirmed the uncommitted R2/media baseline is intact. No build, test, lint, migration, deploy, provisioning, credential change or live request was run.
- **Issues discovered in this reconciliation:**
  - `ProfileDetailScreen` does not consume upload progress or call `cancelOwnAvatarUpload()`; that API is dead from this screen. `CreateProfileScreen` does wire both correctly.
  - Cancellation before the first progress callback is a no-op because the session ID is not yet known; a failed upload does not call server-side cancel, leaving the quota reservation until TTL with no sweeper.
  - 103 direct API calls across 32 screens/nav graphs bypass the ViewModel/repository layer; most API clients are Kotlin `object` singletons rather than DI-managed.
  - Android defines a `BONDS` sync topic that the server's `syncInvalidation` mapping does not emit.
  - Hardcoded catalog/pricing/policy in source (114 cosmetic names, VIP thresholds, gift box prices, event/report categories, `coinToInrRate` fallback) requires an Android release for server-side changes; client keyword filtering is advisory only.
  - No admin media/registry/quota UI exists.
- **Decisions:** None committed. D1/Hyperdrive, realtime protocol and credential remediation remain owner decisions. This documentation-only completion does not satisfy the Phase 0 exit gate.
- **Dependencies:** Production capacity metrics; credential rotation/removal authorization; D1-versus-Hyperdrive ADR; realtime protocol decision; plan acceptance.
- **Risks:** Old-client compatibility with direct composable callers, media quota leaks before a sweeper exists, sync-topic drift, catalog/policy divergence between client and admin, and false confidence from static audits.
- **Next task:** Await owner responses to the [Phase 0 decision request](docs/cloudflare-migration/decision-request.md). Do not start Phase 1 before the gates are resolved.

### 2026-11-22 — Decision brief and realtime event inventory

- **Status:** Documentation-only; Phase 0 still not accepted and no implementation authorized.
- **Added/updated files:**
  - `docs/cloudflare-migration/decision-request.md` (new; DCR-1–DCR-5 with exact inputs, options, approvals and a fill-in response template).
  - `docs/migration/realtime-event-inventory.md` (new; 47 shared + 16 PK events, 17 off-catalog literals, three Android-only dead listeners, admin consumer check and parity-test list).
  - `docs/INDEX.md`, `docs/cloudflare-migration/phase0-report.md`, `docs/cloudflare-migration/decision-request.md`, `docs/migration/realtime-plan.md`, `docs/architecture/backend-source-audit.md`, `docs/migration/feature-matrix.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md` and `docs/handoffs/2026-11-22-cloudflare-migration-phase0.md` (updated links and reconciled counts).
  - `MIGRATION_PROGRESS.md` (this tracker; work log).
- **Verification performed:** Read-only source extraction of every realtime emit/listener in `backend-server` and `android-client`, then spot-checked against source: `shared/index.ts:49–97` contains **47** (not 48) `socketEvents`; `api/services/socket.ts:294–302` checks only ObjectId format for DM typing; no `voice:room:presence` emit exists in `apps/api/src`; `api/services/pk.ts:610–615` bypasses the host check when `force` is set; `apps/admin/src` has no socket client. Relative markdown links resolved across the changed docs and `git diff --check` was clean apart from pre-existing LF/CRLF notices. No build, test, lint, migration, deploy, live request or credential change was run.
- **Issues corrected:** earlier documents said 48 shared events; the verified count is 47. `docs/production/socket-inventory.csv` is stale (line numbers no longer match source) and incomplete (11 `NOT VERIFIED` registrations in one file only).
- **Issues discovered:** DM typing spoofing; `pk:force_ended` caller-dependent authorization; emit helpers authorize nothing; socket rate limiting silently drops packets; PK timers disabled on Cloudflare need DO alarms; process-local PK combo/reaction buckets; `clan:member:left` double emit; three dead Android voice-presence listeners; no typed payload contracts for any socket event.
- **Decisions:** None committed. Event inventory is an input to DCR-3, not a protocol choice.
- **Dependencies:** Owner responses to DCR-1–DCR-5; admin `admin.ts` permission trace for admin room emits remains an open verification item.
- **Risks:** Off-catalog events are invisible to shared-schema tests; Socket.IO compatibility or versioned replacement must be chosen before Phase 5; PK financial events need idempotency and ordering guards.
- **Next task:** Await owner responses to the [decision request](docs/cloudflare-migration/decision-request.md). Do not start Phase 1 before the gates are resolved.

### 2026-11-22 — MongoDB to D1 decision and first schema draft (not a migration phase)

- **Status:** Owner selected D1 + R2 as the full target and MongoDB retirement; DCR-2 is resolved in [ADR-0001](docs/decisions/0001-d1-and-r2-target.md). Local non-destructive tooling only; no provision, migration, data change or deploy. DCR-1 and DCR-3 through DCR-5 remain open, and D1 capacity gates are unverified.
- **Changes:** `backend-server/apps/api/src/scripts/generate-d1-schema.ts` and `schema:d1` script; generated `backend-server/apps/api/migrations/d1/0001_initial.sql` (97 roots + 49 child tables = 146 tables, 246 FKs, 204 `CHECK` constraints, 0 warnings) and manifest; Phase 2 tooling in `src/migration/` (transform/checkpoint/validate/snapshot/export/import plus read-only MongoDB source and D1 batch target adapters, golden fixtures, reviewed per-collection mappings for all 97 root collections (identity, auth, finance, subscriptions, assets, media, social/messaging, rooms/live state, progression/rewards, moderation/safety, events/XP/engagement, bonds/vibe graphs, clan/group messaging/comments and final KYC/matching/gifting/notification/payout/PK models) with multi-table replay-safe imports, deterministic `id_map` artifacts and a local-only dry-run rehearsal CLI (`migrate:rehearse`), 138 unit tests); updates to the decision request, D1 assessment, mapping spec, implementation plan, data tooling status, `docs/INDEX.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md` and [a dated handoff](docs/handoffs/2026-11-22-mongodb-to-d1-decision-and-schema.md).
- **Verification:** schema generator ran with 0 import failures; `tsx --test src/migration/transform.test.ts` 8/8; `tsx --test src/migration/pipeline.test.ts` 7/7; `tsx --test src/migration/adapters.test.ts src/migration/golden.test.ts` 6/6; `tsx --test src/migration/mappings.test.ts` 10/10; `tsx --test src/migration/rehearsal.test.ts` 6/6; `tsx --test src/migration/mappings-social.test.ts src/migration/mappings-domains.test.ts src/migration/mappings.test.ts` 37/37; progression/rewards-focused tests 12/12; moderation/safety-focused tests 12/12; all migration tests 138/138 across 15 files; full API suite 359/359; API typecheck pass; all 97 mappings' columns cross-checked against the generated DDL, including `support_ticket_messages`, `event_participants`, `relationship_users`, `bond_users`, `bond_slots`, `vibe_graph_interests`, `vibe_graph_languages`, `clan_message_reactions`, `conversation_participants` and `match_users`; `migrate:rehearse` CLI smokes on generated fixture snapshots (`users`, `achievements`, `reports`, all 11 events/XP/engagement collections, all six bonds/vibe collections, all six clan/group messaging/comment collections, then all 13 final-batch collections) returned validation PASS/exit 0; generated SQL passed static structure checks (146 unique tables, no dotted/duplicate columns, 246 FKs, 204 `CHECK` constraints (46 numeric-range, 26 `>= 0`) and 0 warnings). No live SQLite parse (`sqlite3` unavailable), export, import or data operation.
- **Generator fix:** Mongoose `Map` wildcard paths (`field.$*`) previously collapsed onto the parent field's SQL column, producing invalid duplicate columns `bonds.preferences` and `room_mode_states.scores`; `generate-d1-schema.ts` now suppresses the duplicate with a DDL note. Regeneration removed one obsolete warning (47 → 46) without dropping a field or changing schema policy; the [warning triage](docs/database/d1-schema-warning-triage.md) and doc counts were updated to match.
- **Progression/rewards batch:** added 15 reviewed mappings and a 12-test focused suite. Badge inline binary is soft-quarantined with `imageUrl`/`assetRef` kept as provenance; legacy badge endpoints and multipart upload are unchanged. Fractional `Number` fields (for example gift-collection bonus multipliers) are a draft-DDL `INTEGER` limitation recorded in the [triage proposal](docs/database/d1-schema-warning-triage.md), not a schema approval. Details in [the dated handoff](docs/handoffs/2026-11-22-d1-progression-mappings.md).
- **Moderation/safety batch:** added 11 reviewed mappings and a 12-test focused suite, bringing the registry to 61 collections. Reports, queues, moderation actions, admin audit/moderation actions, support tickets/messages, trust verifications, face/voice submissions and user safety statuses keep draft-DDL enums, bounded integers, UTC dates, canonical JSON, boolean flags and references; embedded support messages become deterministic `support_ticket_messages` rows. Details in [the dated handoff](docs/handoffs/2026-11-22-d1-moderation-mappings.md).
- **Events/XP/engagement batch:** added 11 reviewed mappings and a 12-test focused suite, bringing the registry to 72 collections. App config Mixed values, countdown/event enums and defaults, XP cap/grant state, moods, nudges, visits, likes, referrals and relationships keep draft-DDL columns, enums, canonical JSON and UTC dates; reference arrays become deterministic `event_participants` and `relationship_users` rows. Details in [the dated handoff](docs/handoffs/2026-11-22-d1-events-mappings.md).
- **Bonds/vibe batch:** added six reviewed mappings and a 12-test focused suite, bringing the registry to 78 collections. Bond status/request enums, per-user Map preferences, ranking entry JSON, replay keys, integer points and vibe-score bounds keep draft-DDL columns; reference/primitive arrays become deterministic `bond_users`, `bond_slots`, `vibe_graph_interests` and `vibe_graph_languages` rows. Details in [the dated handoff](docs/handoffs/2026-11-22-d1-bonds-mappings.md).
- **Messaging/comments batch:** added six reviewed mappings and a 12-test focused suite, bringing the registry to 84 collections. Clan invite statuses, group message media enums and defaults, watch-party playback flags and UTC state keep draft-DDL columns; clan message reactions and group-chat participant IDs become deterministic `clan_message_reactions` and `conversation_participants` rows. `story_comments.parent_id` is preserved as null for root comments (the draft DDL's `NOT NULL` is a flagged schema issue). Details in [the dated handoff](docs/handoffs/2026-11-22-d1-messaging-mappings.md).
- **Final reviewed mappings:** added transforms for the last 13 root models (KYC, friend matches, gifts, matches, notifications/campaigns, payout reviews and PK) plus a 14-test focused suite, completing all 97 reviewed root models. Defaults, enums, UTC timestamps, integer state and canonical JSON follow the draft DDL; `Match.users` becomes deterministic `match_users` child rows. `story_comments.parent_id`, `gifts.expires_at` and `gifts.collection_id` remain flagged source/DDL null conflicts rather than silently coerced. Details in [the dated handoff](docs/handoffs/2026-11-22-d1-final-mappings.md).
- **Next task:** owner decides the 46 warnings using the source-checked [triage proposal](docs/database/d1-schema-warning-triage.md), then refine/approve `0001_initial.sql`, including the `story_comments.parent_id` and `gifts.expires_at`/`gifts.collection_id` null conflicts; rehearse restore on isolated staging with real snapshots. Do not delete MongoDB support or switch runtime persistence before validated D1 repositories exist.

### 2026-11-22 — R2 backend configuration scaffolding (not a migration phase)

- **Status:** Blocked on owner-supplied values; storage remains unconfigured. This is local R2 configuration scaffolding, not Phase 1 implementation.
- **Changes:** `backend-server/apps/api/src/scripts/check-env.ts` validates R2/S3 settings without printing values; `docs/features/r2-centralized-media.md` documents the fill-in procedure; `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md` and `docs/handoffs/2026-11-22-r2-storage-configuration-pending-values.md` record the pending work.
- **Verification:** `npm.cmd run env:check` passed with current config and failed as designed with a temporary `s3` override; `npm.cmd run typecheck --workspace apps/api` passed; no R2/deploy/credential operation was performed.
- **Next task:** Owner writes values into ignored local files, then rerun preflight/tests and a live media cycle only after the target environment is authorized.

### 2026-11-22 — Owner decisions recorded; DCR-1 credential guard staged

- **Status:** Phase 0 gates partially resolved. Local, non-destructive implementation and verification are authorized. No commit, push, provision, deploy, credential change or data migration.
- **Added/updated files:** `docs/decisions/0002-staged-hybrid-realtime-protocol.md`, `docs/decisions/0003-credential-remediation-approach.md`, `docs/decisions/0004-local-code-and-tests-authorization.md`, `docs/cloudflare-migration/decision-request.md`, `docs/infrastructure/tracked-worker-credentials-finding.md`, `docs/INDEX.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `backend-server/scripts/check-tracked-secrets.mjs`, `backend-server/scripts/check-tracked-secrets.test.mjs`, `backend-server/package.json`, `.github/workflows/ci.yml`, `MIGRATION_PROGRESS.md`, `docs/handoffs/2026-11-22-dcr-decisions-and-credential-guard.md`.
- **Verification performed:** `npm.cmd run test:secrets` 8/8 passed; `npm.cmd run secrets:check` scanned 30 tracked config files and reported 8 findings in `wrangler.jsonc` by variable name and line only; `npm.cmd run secrets:check:strict` returned exit code 1 as designed. No build, deploy, provision or production data operation.
- **Issues:** tracked Worker credentials are still active and unrotated; strict CI gate is intentionally report-only; 8 findings remain until owner rotation and source removal. DCR-4, support window, event-inventory sign-off, capacity metrics and Workers Paid are still open.
- **Decisions:** DCR-1 Option A (owner rotates, agent prepares, no history rewrite — ADR-0003); DCR-3 Option C staged hybrid (ADR-0002); DCR-5 local code + tests only (ADR-0004); DCR-2 D1 (ADR-0001, earlier).
- **Dependencies:** owner provider rotation and confirmation, tracked-config cleanup, DCR-4 inputs, DCR-2 metrics, backup/restore rehearsal, separate approval for commit/push/deploy/provisioning.
- **Risks:** false confidence from a report-only gate; stale active credentials; dual-protocol complexity; untested recovery.
- **Next task:** owner rotates credentials and supplies remaining inputs; then remove tracked values, enable strict CI, verify backups/restore and continue local testable slices. Do not remove legacy services before validated replacement and explicit approval.

### 2026-11-22 — Full migration directive reconciled; Phase 1 planning documents added

- **Status:** Phase 0 audit remains complete but not accepted. Phase 1 preparation documentation added; recovery gate not satisfied. No implementation phase started.
- **Added/updated files:** `docs/migration/DIRECTIVE_RECONCILIATION.md`, `docs/migration/BASELINE_REPORT.md`, `docs/migration/BACKUP_AND_RECOVERY.md`, `docs/migration/ROLLBACK_PLAN.md`, `docs/migration/DEPENDENCY_AUDIT.md`, `docs/INDEX.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `MIGRATION_PROGRESS.md`, `docs/handoffs/2026-11-22-migration-phase0-reconciliation.md`.
- **Verification performed:** read-only source audits of backend, Android, admin and infrastructure; Git checkpoint `9b5081a` and version reads; three `curl` probes each for staging `/health`, `/ready`, `/api/health`, `/api/ready` (all HTTP 200, total 0.573–1.305 s). No build, test, migration, provision, deploy, credential read or production data operation.
- **Issues:** no verified backup or restore rehearsal; DCR-1, DCR-3, DCR-4 and DCR-5 still open; DCR-2 capacity metrics and Workers Paid still missing. The directive's paid-plan restriction means production D1 cutover cannot proceed until Workers Paid is explicitly approved.
- **Decisions:** none new. ADR-0001 (D1 + R2) remains the recorded owner decision. The directive is treated as scope definition, not authorization for commit, push, deploy, DNS, provisioning or destructive data work.
- **Dependencies:** owner gate decisions, DCR-2 metrics, and a verified backup/restore rehearsal before any destructive step.
- **Risks:** false confidence from documentation-only work; credential exposure; protocol and media-scope divergence; no recovery mechanism proven.
- **Next task:** resolve DCR-1/DCR-3/DCR-4/DCR-5 and capacity inputs; then create and verify backups and rehearse a restore. Do not remove legacy infrastructure before validated replacement and explicit approval.

## Phase status table

| Phase | Description | Status | Approval needed |
|---|---|---|---|
| 0 | Audit, architecture, capacity inputs and implementation plan | Audit/planning complete and reconciled to the 26-phase directive; decision gates open | Credential remediation; realtime protocol; R2/media scope; plan acceptance; D1 capacity metrics |
| 1 | Foundations, isolated environments, contracts and compatibility harnesses | Documentation prepared; recovery gate not satisfied; no implementation started | Provisioning plan, secrets owner, verified backup and restore rehearsal |
| 2 | Authoritative data migration tooling and rehearsal | Local tooling exists; rehearsal only against generated fixtures | Production snapshot access and destructive-operation approval |
| 3 | Workers API/repository cutovers by domain | Not started | Phase 2 validation |
| 4 | Media/R2 and centralized asset platform cutovers | Not started | R2 provisioning and media inventory |
| 5 | Realtime/Durable Objects protocol migration | Not started | Protocol decision and load test approval |
| 6 | Queues/Cron/admin/observability hardening | Not started | Cost and alerting approval |
| 7 | Android/admin integration and staged rollout | Not started | Release approval |
| 8 | Production cutover, validation and rollback rehearsal | Not started | Explicit production cutover approval |

## Verification rule

A phase is marked complete only when the stated checks were actually run and passed. Source presence, documentation, or a local dry run alone is not proof of production behavior.
