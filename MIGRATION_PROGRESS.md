# Yugm Cloudflare migration progress

This is the persistent, single-source tracker for the MongoDB/Render to Cloudflare migration. Update it after every phase. It records work actually performed and verified; it does not imply that a planned phase is complete.

## Current phase

| Field | Value |
|---|---|
| Phase | Phase 0 — audit, architecture decisions and implementation planning |
| Status | Audit/planning complete; DCR-1/DCR-2/DCR-3 and DCR-5 authorization answered; local code + tests authorized; DCR-4 and detailed inputs still open |
| Started | 2026-11-22 |
| Last updated | 2026-11-23 |
| Overall gate | No production data, credentials, DNS, billing, deploy, migration or release has been changed or authorized |
| Commit/push | Owner authorized commit and push of the current local-only changes on 2026-11-22; deploy, provision, migration and release remain unauthorized |

## Scope for Phase 0

- Audit the actual backend, Android, admin, Worker prototype, schemas, APIs, realtime, media, jobs, infrastructure, tests and documentation without assuming docs are current.
- Preserve the uncommitted R2 media/avatar foundation as the baseline; do not overwrite it.
- Document the current system, target responsibilities, per-feature migration impact, database mapping, API compatibility, infrastructure environments, security/observability/cost controls and test plan.
- Decide D1 versus PostgreSQL/Hyperdrive only after production capacity metrics are available.
- Stop before destructive production changes, paid provisioning, credential handling or significant unresolved architecture decisions.

## Work log

### 2026-11-23 — Native command/ack flow added

- **Status:** local harness and typechecked skeleton only. No binding, deploy, runtime wiring or data change. Changes are uncommitted.
- **Added/updated files:** `backend-server/packages/shared/src/realtimeProtocol.ts`, `backend-server/packages/shared/src/nativeRealtimeServer.ts`, `backend-server/packages/shared/src/nativeRealtimeServer.test.ts`, `backend-server/apps/cloudflare-worker/src/nativeRealtimeDo.ts`, `docs/decisions/0002-staged-hybrid-realtime-protocol.md`, `docs/migration/realtime-plan.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-native-command-ack.md`.
- **Verification performed:** shared tests 19/19; shared and Worker typechecks. No production access.
- **Issues:** no configured authoritative command handler exists; default rejects commands.
- **Decisions:** none; implements DCR-3 ack semantics locally.
- **Dependencies:** a real command handler must commit to authoritative state before returning success.
- **Risks:** an invalid handler ack could claim commit; schema validation rejects malformed acks but cannot verify the write.
- **Next task:** wire room:join and other commands through authoritative services, then run dual-path parity.

### 2026-11-23 — Native Durable Object skeleton added

- **Status:** local typechecked skeleton only. No binding, deploy, live WebSocket, credential or data change. Changes are uncommitted.
- **Added/updated files:** `backend-server/apps/cloudflare-worker/src/nativeRealtimeDo.ts`, `backend-server/apps/cloudflare-worker/tsconfig.json`, `docs/decisions/0002-staged-hybrid-realtime-protocol.md`, `docs/migration/realtime-plan.md`, `docs/INDEX.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-native-do-skeleton.md`.
- **Verification performed:** Worker typecheck passed. No runtime or production access.
- **Issues:** not wired; no authentication or authoritative event publication yet.
- **Decisions:** none; implements hibernation requirement from closed DCR-3 inputs.
- **Dependencies:** explicit approval before binding, auth wiring and staging validation.
- **Risks:** typechecked skeleton could be mistaken for a running adapter; docs state it is unwired.
- **Next task:** add authenticated upgrade, authoritative publish and dual-path parity tests before any realtime cutover.

### 2026-11-23 — Native realtime server transport foundation added

- **Status:** local pure transport harness only. No DO binding, runtime wiring, client change, deploy or data change. Changes are uncommitted.
- **Added/updated files:** `backend-server/packages/shared/src/nativeRealtimeServer.ts`, `backend-server/packages/shared/src/nativeRealtimeServer.test.ts`, `backend-server/packages/shared/src/index.ts`, `docs/decisions/0002-staged-hybrid-realtime-protocol.md`, `docs/migration/realtime-plan.md`, `docs/INDEX.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-native-server-transport.md`.
- **Verification performed:** shared tests 17/17 passed; shared typecheck passed. No production access.
- **Issues:** unwired; no authentication, persistence or authoritative publish path.
- **Decisions:** none; implements DCR-3 Option C harness work.
- **Dependencies:** owner DCR-3 runtime implementation approval and a DO adapter before staging validation.
- **Risks:** harness success could be mistaken for protocol interoperability; docs state it is unwired.
- **Next task:** build the hibernation-compatible DO adapter using this transport and run the parity matrix against both real paths.

### 2026-11-23 — Read-only media quota reconciliation added

- **Status:** local read-only admin tooling. No quota mutation, provider config, deploy or data change. Changes are uncommitted.
- **Added/updated files:** `backend-server/apps/api/src/services/adminMedia.ts`, `backend-server/apps/api/src/services/adminMedia.test.ts`, `backend-server/apps/api/src/routes/adminMedia.ts`, `backend-server/apps/admin/src/MediaPage.tsx`, `docs/decisions/0005-r2-media-cutover.md`, `docs/cloudflare-migration/decision-request.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-media-quota-reconciliation.md`.
- **Verification performed:** targeted API tests 11/11, root typecheck, admin tests 9/9, admin typecheck/build; `dist/` restored. No production access.
- **Issues:** report-only; stale sessions are not swept from this endpoint.
- **Decisions:** none; extends staged DCR-4 admin tooling.
- **Dependencies:** same provisioning and approval gates as the media registry slice.
- **Risks:** drift report compares counters to active sessions only; committed media bytes are a separate quota component already handled by reservation checks.
- **Next task:** owner approves provisioning and any future mutation tooling before category cutover.

### 2026-11-23 — Android profile upload progress/cancel wired

- **Status:** local UI/ViewModel change, compile-verified only. No client release, provider config, deploy or data change. Changes are uncommitted.
- **Added/updated files:** `android-client/feature/profile/src/main/java/com/yugm/app/feature/profile/screens/ProfileDetailScreen.kt`, `android-client/feature/profile/src/main/java/com/yugm/app/feature/profile/viewmodel/ProfileViewModel.kt`, `docs/decisions/0005-r2-media-cutover.md`, `docs/cloudflare-migration/decision-request.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-android-upload-progress-cancel.md`.
- **Verification performed:** `:feature:profile:compileDebugKotlin` BUILD SUCCESSFUL; only pre-existing deprecation warnings. No runtime/media/production verification.
- **Issues:** device/emulator visual and live upload QA remain open.
- **Decisions:** none; implements DCR-4 client wiring locally.
- **Dependencies:** release build config, exact API/socket hosts and R2 provisioning approvals remain owner-owned.
- **Risks:** cancellation before session ID cannot call the server cancel endpoint; the local job and cancel flag stop the upload, and the sweeper releases any late reservation.
- **Next task:** owner approves device QA and staging two-client media validation before category cutover.

### 2026-11-23 — Private-media policy applied at runtime boundary

- **Status:** local server authorization change with tests; no provider, deploy, credential or production data change. Changes are uncommitted.
- **Added/updated files:** `backend-server/apps/api/src/services/mediaAccessPolicy.ts`, `backend-server/apps/api/src/migration/mediaAccessPolicy.ts`, `backend-server/apps/api/src/services/media.ts`, `backend-server/apps/api/src/services/media.integration.test.ts`, `docs/decisions/0005-r2-media-cutover.md`, `docs/migration/private-media-authorization.md`, `docs/cloudflare-migration/decision-request.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-private-media-runtime-policy.md`.
- **Verification performed:** targeted tests 21/21 passed; typecheck passed. No production access.
- **Issues:** room admins include moderator/admin/co-host arrays and active RoomParticipant rows; clan admins include LEADER/CO_LEADER/OFFICER roles. Platform-admin override remains excluded per owner decision.
- **Decisions:** implements ADR-0005 policy; no new decision.
- **Dependencies:** category cutover still needs R2 provisioning, exact production CORS/domain and per-category approval.
- **Risks:** broader access than the previous message-only rule; block/hide overrides and authoritative read-time checks mitigate it.
- **Next task:** owner approval for per-category cutover, then verify two-client media access on staging.

### 2026-11-23 — Expired upload-session quota sweeper added

- **Status:** local code and tests only. No provider config, deploy, cron provisioning or production data change. Changes are uncommitted.
- **Added/updated files:** `backend-server/apps/api/src/services/media.ts`, `backend-server/apps/api/src/services/jobs.ts`, `backend-server/apps/api/src/services/media.integration.test.ts`, `docs/decisions/0005-r2-media-cutover.md`, `docs/cloudflare-migration/decision-request.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-upload-quota-sweeper.md`.
- **Verification performed:** targeted media integration/unit tests 14/14 passed; typecheck passed. No production access.
- **Issues:** sweep is local-maintenance only; Cloudflare Cron and production job deployment remain gated.
- **Decisions:** none; implements the DCR-4 quota-leak fix locally.
- **Dependencies:** explicit approval before provisioning/deploying scheduled maintenance.
- **Risks:** staging object deletion is best-effort by design; quota release is committed even if object deletion fails.
- **Next task:** owner approves cron/provisioning and separately authorizes Android progress/cancel wiring.

### 2026-11-23 — Read-only admin media tooling staged

- **Status:** local admin tooling only. No media mutation, provider config, deploy or data change. Changes are uncommitted.
- **Added/updated files:** `backend-server/apps/api/src/routes/adminMedia.ts`, `backend-server/apps/api/src/services/adminMedia.ts`, `backend-server/apps/api/src/services/adminMedia.test.ts`, `backend-server/apps/api/src/routes/adminRouterGuards.test.ts`, `backend-server/apps/api/src/app.ts`, `backend-server/apps/admin/src/MediaPage.tsx`, `backend-server/apps/admin/src/App.tsx`, `backend-server/apps/admin/src/navigationPermissions.ts`, `docs/decisions/0005-r2-media-cutover.md`, `docs/cloudflare-migration/decision-request.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-admin-media-tooling.md`.
- **Verification performed:** targeted API tests 16/16, API typecheck, admin tests 9/9, admin typecheck/build; `dist/` restored. No production access.
- **Issues:** read-only lists only; no quota release sweep or media mutation is implemented.
- **Decisions:** none; implements the DCR-4 decision that agent stages local admin tooling.
- **Dependencies:** exact production origin/CORS, provisioning and separate approval for runtime wiring.
- **Risks:** storage keys are visible to authorized admins; signed URLs and mutation controls are not emitted.
- **Next task:** owner approves provisioning and separately authorizes mutation/sweeper tooling before category cutover.

### 2026-11-23 — DCR-5 plan accepted and commit authorized

- **Status:** decision/authorization record; no provision, deploy, credential or data change. Commit/push of current local slices is authorized once by the owner.
- **Added/updated files:** `docs/decisions/0006-implementation-plan-acceptance.md`, `docs/decisions/0004-local-code-and-tests-authorization.md`, `docs/cloudflare-migration/decision-request.md`, `docs/migration/implementation-plan.md`, `docs/CURRENT_TASK.md`, `docs/INDEX.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-dcr5-plan-acceptance.md`.
- **Verification performed:** documentation-only; links checked by inspection. Commit verification and push result are recorded separately in the handoff once complete.
- **Issues:** DCR-2 capacity/recovery gates and runtime implementation gates remain open.
- **Decisions:** DCR-5 plan accepted; one-time commit/push authorization for current local slices only.
- **Dependencies:** new explicit approval for future commit/push, deploy, provisioning and data work.
- **Risks:** one-time authorization could be mistaken for standing authority; ADR-0006 states the limit.
- **Next task:** verify and publish current local slices, then pause pending new approvals.

### 2026-11-23 — DCR-4 decision gate completed

- **Status:** decision recorded plus unwired policy harness; uncommitted. No runtime authorization, provision or data change.
- **Added/updated files:** `docs/decisions/0005-r2-media-cutover.md`, `docs/cloudflare-migration/decision-request.md`, `docs/migration/private-media-authorization.md`, `docs/INDEX.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `backend-server/apps/api/src/migration/mediaAccessPolicy.ts`, `backend-server/apps/api/src/migration/mediaAccessPolicy.test.ts`, `docs/handoffs/2026-11-23-dcr4-decision-complete.md`.
- **Verification performed:** policy tests 6/6 passed; typecheck passed. No production access.
- **Issues:** runtime authorization still only covers direct-message participants; production CORS/domain values and provisioning remain open.
- **Decisions:** DCR-4 Option B; five existing buckets; public variants/private originals; owner/resource-admin/accepted-participant private access; explicit per-env CORS; agent stages local tooling.
- **Dependencies:** exact production origin/CORS, R2 provisioning, owner-approved export, wiring fixes and category cutover approvals.
- **Risks:** unwired harness could be mistaken for runtime behavior; docs state it is a design contract only.
- **Next task:** implement the accepted policy behind resource-boundary checks and stage admin media/quota tooling before any category cutover.

### 2026-11-23 — DCR-3 decision gate completed

- **Status:** decision recorded plus local invalidation emitter; uncommitted. No runtime adapter, deploy, provision or data change.
- **Added/updated files:** `backend-server/apps/api/src/middleware/syncInvalidation.ts`, `backend-server/apps/api/src/middleware/syncInvalidation.test.ts`, `docs/decisions/0002-staged-hybrid-realtime-protocol.md`, `docs/cloudflare-migration/decision-request.md`, `docs/migration/realtime-plan.md`, `docs/REALTIME_EVENTS.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-dcr3-decision-complete.md`.
- **Verification performed:** sync invalidation tests 6/6 passed; typecheck passed. No production access.
- **Issues:** runtime adapter/native DO implementation remains; BONDS emitter is an invalidation, not proof of commit.
- **Decisions:** DCR-3 inputs closed: 90-day support window, hibernation hard requirement, 83-name inventory accepted, BONDS server emitter chosen.
- **Dependencies:** native GA date must be recorded to set the 90-day cutoff; runtime implementation needs separate authorization.
- **Risks:** BONDS invalidations activate existing Android listeners; they carry no payload data and screens re-read authoritative APIs.
- **Next task:** implement/verify the compatibility adapter and hibernating native DO protocol with the dual-path parity suite before any realtime cutover.

### 2026-11-23 — Re-verified all local changes after DCR-2 tooling

- **Status:** verification only; no code behavior, deploy, provision or data change.
- **Added/updated files:** `docs/handoffs/2026-11-23-final-local-verification.md`, `docs/DEVELOPMENT_PROGRESS.md`.
- **Verification performed:** root typecheck passed; API 439/439, hardening 34/34, shared 12/12, admin 9/9; guard suites and strict secret check passed; admin build passed with tracked `dist/` restored; `git diff --check` clean apart from line-ending notices.
- **Issues:** none found in local checks; DCR-2 owner inputs still open.
- **Decisions:** none.
- **Dependencies:** owner evidence for DCR-2 and explicit approval for further commit/push.
- **Risks:** local test success must not be read as production verification.
- **Next task:** owner follows the DCR-2 readiness runbook and supplies real evidence.

### 2026-11-23 — DCR-2 readiness runbook added

- **Status:** documentation-only consolidation. No code, deploy, provision or data change. Changes are uncommitted.
- **Added/updated files:** `docs/migration/DCR2_READINESS_RUNBOOK.md`, `docs/INDEX.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-dcr2-runbook.md`.
- **Verification performed:** none required for documentation-only change; links checked by inspection.
- **Issues:** DCR-2 gate still open on owner-owned metrics, Workers Paid, recovery evidence and schema approval.
- **Decisions:** none; documents the existing D1 decision and evidence sequence.
- **Dependencies:** owner-supplied metrics, attestations and approved snapshots.
- **Risks:** runbook must not be read as acceptance; it states that explicitly.
- **Next task:** owner follows the runbook and supplies the real evidence before any D1 production step.

### 2026-11-23 — DCR-2 readiness summary added

- **Status:** local aggregation only. No verification claims, deploy, provision or data change. New changes are uncommitted.
- **Added/updated files:** `backend-server/apps/api/src/migration/dcr2Readiness.ts`, `backend-server/apps/api/src/migration/dcr2Readiness.test.ts`, `backend-server/apps/api/src/scripts/dcr2-readiness.ts`, `backend-server/apps/api/package.json`, `docs/database/d1-capacity-assessment.md`, `docs/cloudflare-migration/decision-request.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-dcr2-readiness-summary.md`.
- **Verification performed:** targeted tests 24/24 passed; typecheck passed; CLI smoke on generated reports reported READY 8/8 with 4 review items and an explicit non-acceptance warning. No production access.
- **Issues:** summary readiness depends entirely on supplied reports and attestations.
- **Decisions:** none; implements input aggregation under DCR-5 authorization.
- **Dependencies:** all DCR-2 local reports plus owner attestations.
- **Risks:** a READY summary could be mistaken for cutover approval; CLI and docs state otherwise.
- **Next task:** owner supplies real reports/attestations and reviews open items before any production decision.

### 2026-11-23 — DCR-2 recovery evidence checker added

- **Status:** local evidence validation only. No restore, deploy, provision or data change. New changes are uncommitted.
- **Added/updated files:** `backend-server/apps/api/src/scripts/verify-backup.ts`, `backend-server/apps/api/src/migration/dcr2RecoveryEvidence.ts`, `backend-server/apps/api/src/migration/dcr2RecoveryEvidence.test.ts`, `backend-server/apps/api/src/scripts/dcr2-recovery-evidence.ts`, `backend-server/apps/api/package.json`, `docs/database/d1-capacity-assessment.md`, `docs/cloudflare-migration/decision-request.md`, `docs/migration/BACKUP_AND_RECOVERY.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-dcr2-recovery-evidence.md`.
- **Verification performed:** targeted tests 22/22 passed; typecheck passed; CLI smoke on generated fixtures reported evidence COMPLETE and 3 review items. No production access.
- **Issues:** evidence completeness is not a restore test; attestations are owner claims.
- **Decisions:** none; implements input preparation under DCR-5 authorization.
- **Dependencies:** real backup verification, rehearsal artifacts and owner attestation.
- **Risks:** a complete evidence bundle could be mistaken for a verified restore; docs and CLI state otherwise.
- **Next task:** owner creates real backups, performs an isolated restore rehearsal and supplies attestations before DCR-2 recovery gate can close.

### 2026-11-23 — DCR-2 billing estimate added

- **Status:** local read-only tooling only. No billing API, database, deploy, provision or data change. New changes are uncommitted.
- **Added/updated files:** `backend-server/apps/api/src/migration/d1BillingEstimate.ts`, `backend-server/apps/api/src/migration/d1BillingEstimate.test.ts`, `backend-server/apps/api/src/scripts/d1-billing-estimate.ts`, `backend-server/apps/api/package.json`, `docs/database/d1-capacity-assessment.md`, `docs/cloudflare-migration/decision-request.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-dcr2-billing-estimate.md`.
- **Verification performed:** targeted tests 19/19 passed; typecheck passed; CLI smoke reported reads/writes/storage within Paid inclusions and three review items. No production access.
- **Issues:** estimates are not invoices; recovery evidence still open.
- **Decisions:** none; implements input preparation under DCR-5 authorization.
- **Dependencies:** query observations and completed capacity metrics.
- **Risks:** peak write rate overstates average writes; docs label it as an upper bound.
- **Next task:** owner supplies real observations/metrics and reviews billing/recovery evidence before schema approval.

### 2026-11-23 — DCR-2 query-profile audit added

- **Status:** local read-only tooling only. No query collection, deploy, provision or data change. New changes are uncommitted.
- **Added/updated files:** `backend-server/apps/api/src/migration/queryProfileAudit.ts`, `backend-server/apps/api/src/migration/queryProfileAudit.test.ts`, `backend-server/apps/api/src/scripts/query-profile-audit.ts`, `backend-server/apps/api/package.json`, `docs/database/d1-capacity-assessment.md`, `docs/cloudflare-migration/decision-request.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-dcr2-query-profile-audit.md`.
- **Verification performed:** targeted tests 16/16 passed; typecheck passed; CLI smoke on generated observations reported hard-gate PASS and 4 review items. No production access.
- **Issues:** query evidence is owner-supplied; hard-limit PASS is not query acceptance.
- **Decisions:** none; implements input preparation under DCR-5 authorization.
- **Dependencies:** approved query observations and owner review of full scans/headroom.
- **Risks:** weighted-average throughput estimate is coarse and cannot replace peak measurement.
- **Next task:** owner supplies real query observations, then review index/full-scan and billing evidence.

### 2026-11-23 — DCR-2 projection cross-check added

- **Status:** local read-only tooling only. No metrics collected, no deploy, provision or data change. New changes are uncommitted.
- **Added/updated files:** `backend-server/apps/api/src/migration/projectionAudit.ts`, `backend-server/apps/api/src/migration/projectionAudit.test.ts`, `backend-server/apps/api/src/scripts/projection-audit.ts`, `backend-server/apps/api/package.json`, `docs/database/d1-capacity-assessment.md`, `docs/cloudflare-migration/decision-request.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-dcr2-projection-audit.md`.
- **Verification performed:** targeted tests 12/12 passed; typecheck passed; CLI smoke on generated snapshots reported a 1-hour window and four review items. No production access.
- **Issues:** a short snapshot window cannot prove seasonality; index bytes and retention remain owner evidence.
- **Decisions:** none; implements input preparation under DCR-5 authorization.
- **Dependencies:** two owner-approved snapshots and a completed metrics file.
- **Risks:** byte growth from snapshots may not reflect retained/indexed totals; docs state this.
- **Next task:** owner supplies real snapshots and metrics, then reviews the four projection items.

### 2026-11-23 — DCR-2 metrics intake helper added

- **Status:** local input-preparation tool only. No metrics collected, no deploy, provision or data change. New changes are uncommitted.
- **Added/updated files:** `backend-server/apps/api/src/migration/dcr2MetricsIntake.ts`, `backend-server/apps/api/src/migration/dcr2MetricsIntake.test.ts`, `backend-server/apps/api/src/scripts/dcr2-metrics-intake.ts`, `backend-server/apps/api/package.json`, `docs/database/d1-capacity-assessment.md`, `docs/cloudflare-migration/decision-request.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-dcr2-metrics-intake.md`.
- **Verification performed:** targeted tests 9/9 passed; typecheck passed; CLI smoke showed incomplete template NOT READY and completed fixture READY/PASS. No production access.
- **Issues:** real DCR-2 metrics remain owner-supplied; hard-limit PASS is not acceptance.
- **Decisions:** none; implements input preparation under DCR-5 authorization.
- **Dependencies:** owner-supplied aggregates, Workers Paid, query/growth/recovery evidence.
- **Risks:** a completed template could be treated as verified capacity; docs and CLI label it as screening only.
- **Next task:** owner fills the template from approved monitoring/export aggregates, then review the five open items.

### 2026-11-23 — DCR-1 closed after successful deployment

- **Status:** documentation-only closure record. No code, credential, deploy or data change in this entry.
- **Added/updated files:** `docs/decisions/0003-credential-remediation-approach.md`, `docs/cloudflare-migration/decision-request.md`, `docs/infrastructure/tracked-worker-credentials-finding.md`, `docs/migration/BASELINE_REPORT.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-dcr1-local-cleanup.md`.
- **Verification:** owner confirmed deployment of commit `d4b0510` succeeded with strict `secrets:check:strict` CI active. No values were printed or copied.
- **Issues:** none for DCR-1; history rewrite was not selected.
- **Decisions:** DCR-1 Option A closure recorded.
- **Dependencies:** DCR-2/DCR-3/DCR-4 inputs, recovery gates and cutover approvals remain open.
- **Risks:** optional gitleaks and periodic secret-store review remain follow-ups, not DCR-1 blockers.
- **Next task:** owner supplies the remaining DCR inputs and approves a verified backup/restore rehearsal.

### 2026-11-23 — DCR-1 local credential cleanup staged

- **Status:** owner-confirmed rotation; local config/CI cleanup staged and uncommitted. No credential value exposed or stored by the assistant.
- **Added/updated files:** `backend-server/apps/cloudflare-worker/wrangler.jsonc`, `.gitignore`, `.github/workflows/ci.yml`, `docs/decisions/0003-credential-remediation-approach.md`, `docs/infrastructure/tracked-worker-credentials-finding.md`, `docs/cloudflare-migration/decision-request.md`, `docs/migration/BASELINE_REPORT.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-dcr1-local-cleanup.md`.
- **Verification performed:** strict secret guard zero findings across 30 tracked config files; credential guard tests 8/8; config parses as JSON; ignore rules verified with `git check-ignore`; `git diff --check` clean apart from line-ending notices.
- **Issues:** commit/push and first strict CI run still pending; no history rewrite performed.
- **Decisions:** DCR-1 Option A already accepted; owner confirmed provider rotation on 2026-11-23.
- **Dependencies:** explicit commit/push approval, then CI observation and secret-store confirmation for staging/production separation.
- **Risks:** removing tracked values does not by itself invalidate leaked history; owner rotation is the mitigating control and has been confirmed.
- **Next task:** commit/push after explicit approval, then verify the strict CI gate on the first run.

### 2026-11-23 — Consolidated local verification pass

- **Status:** verification only; no code behavior, deploy, provision or data change. Changes remain uncommitted.
- **Added/updated files:** `docs/handoffs/2026-11-23-final-local-verification.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`.
- **Verification performed:** root typecheck passed for all workspaces; API 421/421, hardening 34/34, shared 12/12, admin 9/9; credential guard 8/8, OpenAPI guard 6/6, config manifest 3/3, worker-config guard 5/5; `openapi:check` PASS; admin build passed with tracked `dist/` restored; `git diff --check` clean apart from line-ending notices.
- **Issues:** worker-config guard remains report-only with 6 owner-decision findings.
- **Decisions:** none; local evidence only.
- **Dependencies:** owner decisions and approvals remain unchanged.
- **Risks:** passing local suites must not be read as production verification or CI success.
- **Next task:** owner supplies DCR inputs/approvals before any provisioning, deploy, migration or commit/push of these slices.

### 2026-11-23 — Delta rate audit added (final delta-sync input)

- **Status:** local read-only tooling only. No export, import, deploy, provision or data change. New changes are uncommitted.
- **Added/updated files:** `backend-server/apps/api/src/migration/deltaRateAudit.ts`, `backend-server/apps/api/src/migration/deltaRateAudit.test.ts`, `backend-server/apps/api/src/scripts/delta-rate-audit.ts`, `backend-server/apps/api/package.json`, `docs/migration/final-delta-sync-design.md`, `docs/migration/data-migration-tooling.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-delta-rate-audit.md`.
- **Verification performed:** targeted tests 26/26 passed; typecheck passed; CLI smoke reported a 2-hour window with 0.5 changes/hour. No production access.
- **Issues:** averages do not establish peak rate; owner decisions remain open.
- **Decisions:** none; implements input preparation under DCR-5 authorization.
- **Dependencies:** owner-approved snapshots with valid watermarks before real use.
- **Risks:** a two-snapshot average could be mistaken for peak load; docs state the opposite.
- **Next task:** owner decides online/offline replay and maximum cutover downtime before implementation.

### 2026-11-23 — Child-table impact audit added (final delta-sync input)

- **Status:** local reporting/refactor only. No DDL behavior change, delete, deploy, provision or data change. New changes are uncommitted.
- **Added/updated files:** `backend-server/apps/api/src/migration/childTables.ts`, `backend-server/apps/api/src/migration/childTableAudit.ts`, `backend-server/apps/api/src/migration/childTableAudit.test.ts`, `backend-server/apps/api/src/scripts/child-table-audit.ts`, `backend-server/apps/api/src/scripts/generate-d1-schema.ts`, `backend-server/apps/api/package.json`, `docs/migration/final-delta-sync-design.md`, `docs/migration/data-migration-tooling.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-child-table-audit.md`.
- **Verification performed:** targeted tests 23/23 passed; typecheck passed; `schema:d1` regenerated 146 tables with no SQL change; CLI smoke reported 26 root tables and 49 child tables. No production access.
- **Issues:** replacement-scope decision remains open; report is static sizing evidence.
- **Decisions:** none; shares one child-table source between generator and audit.
- **Dependencies:** owner decision on per-parent vs per-batch replacement before delta implementation.
- **Risks:** a future child table added directly to the generator would bypass the audit; docs note the shared module.
- **Next task:** owner decides replacement unit before implementing delta child-row handling.

### 2026-11-23 — Financial delta audit added (final delta-sync input)

- **Status:** local read-only sizing tool. No reconciliation, export, import, deploy, provision or data change. New changes are uncommitted.
- **Added/updated files:** `backend-server/apps/api/src/migration/financialDeltaAudit.ts`, `backend-server/apps/api/src/migration/financialDeltaAudit.test.ts`, `backend-server/apps/api/src/scripts/financial-delta-audit.ts`, `backend-server/apps/api/package.json`, `docs/migration/final-delta-sync-design.md`, `docs/migration/data-migration-tooling.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-financial-delta-audit.md`.
- **Verification performed:** targeted tests 19/19 passed; `npm.cmd run typecheck --workspace @yugm/api` passed; CLI smoke reported 1 changed wallet transaction. No production access.
- **Issues:** sizing only; no balance reconciliation or maintenance-window decision.
- **Decisions:** none; implements input preparation under DCR-5 authorization.
- **Dependencies:** owner-approved snapshots and remaining delta-sync design decisions.
- **Risks:** collection allowlist could miss a future money collection; docs name the six current authoritative collections.
- **Next task:** owner decides online vs maintenance-window financial deltas before implementation.

### 2026-11-23 — Deletion audit added (final delta-sync input)

- **Status:** local read-only tooling only. No export, import, delete, deploy, provision or data change. New changes are uncommitted.
- **Added/updated files:** `backend-server/apps/api/src/migration/deletionAudit.ts`, `backend-server/apps/api/src/migration/deletionAudit.test.ts`, `backend-server/apps/api/src/scripts/deletion-audit.ts`, `backend-server/apps/api/package.json`, `docs/migration/final-delta-sync-design.md`, `docs/migration/data-migration-tooling.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-deletion-audit.md`.
- **Verification performed:** targeted tests 16/16 passed; `npm.cmd run typecheck --workspace @yugm/api` passed; CLI smoke on generated snapshots reported 1 soft-deleted record. No production access.
- **Issues:** sizing evidence only; no deletion representation decision was made.
- **Decisions:** none; implements input preparation under DCR-5 authorization.
- **Dependencies:** owner-approved snapshots and remaining delta-sync design decisions.
- **Risks:** soft-delete detection is field-configurable and heuristic; hard removals rely on complete source IDs in both snapshots.
- **Next task:** owner decides tombstone vs explicit deletion list before implementing delta deletion handling.

### 2026-11-23 — Watermark candidate audit added (final delta-sync input)

- **Status:** local read-only tooling only. No export, import, deploy, provision or data change. New changes are uncommitted.
- **Added/updated files:** `backend-server/apps/api/src/migration/watermarkAudit.ts`, `backend-server/apps/api/src/migration/watermarkAudit.test.ts`, `backend-server/apps/api/src/scripts/watermark-audit.ts`, `backend-server/apps/api/package.json`, `docs/migration/final-delta-sync-design.md`, `docs/migration/data-migration-tooling.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-watermark-audit.md`.
- **Verification performed:** targeted tests 15/15 passed; `npm.cmd run typecheck --workspace @yugm/api` passed; CLI smoke on a generated JSONL fixture reported viable and sorted. No production access.
- **Issues:** viability does not prove MongoDB export support; owner design decisions remain open.
- **Decisions:** none; implements input preparation under DCR-5 authorization.
- **Dependencies:** owner-approved export before real use; open delta-sync decisions.
- **Risks:** a non-date opaque string is accepted as a logical cursor value; docs state that viability is not a MongoDB export guarantee.
- **Next task:** owner decides watermark field/order and remaining delta-sync design items before implementation.

### 2026-11-23 — Report-only Worker config guard added

- **Status:** local guard script and report-only CI step. No config, deploy, provision, credential or data change. New changes are uncommitted.
- **Added/updated files:** `backend-server/scripts/check-worker-config.mjs`, `backend-server/scripts/check-worker-config.test.mjs`, `backend-server/package.json`, `.github/workflows/ci.yml`, `docs/infrastructure/admin-deployment-audit.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-worker-config-guard.md`.
- **Verification performed:** `test:worker-config` 5/5 passed; `worker-config:check` reported 6 current findings with no values printed. No production access.
- **Issues:** findings are intentionally not fixed here; production observability and CORS are owner decisions.
- **Decisions:** none; implements a report-only guard under DCR-5 authorization.
- **Dependencies:** owner decision and config change before findings can be closed.
- **Risks:** JSONC parsing is a small local subset; guard is report-only so it cannot block deploys by itself.
- **Next task:** owner approves staging redaction, production observability and explicit CORS values before production traffic.

### 2026-11-23 — Value-free config manifest added

- **Status:** local inventory tooling only. No credential values read into output, no push, deploy, provision or data change. New changes are uncommitted.
- **Added/updated files:** `backend-server/scripts/check-tracked-secrets.mjs`, `backend-server/scripts/config-backup-manifest.mjs`, `backend-server/scripts/config-backup-manifest.test.mjs`, `backend-server/package.json`, `docs/migration/BACKUP_AND_RECOVERY.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-config-manifest.md`.
- **Verification performed:** `test:config-manifest` 3/3 passed; `config:manifest` produced a 30-file tracked-config manifest with hashes only. No production access.
- **Issues:** not a config backup; ignored secret files and external config remain owner-managed.
- **Decisions:** none; implements backup procedure step 5 preparation under DCR-5 authorization.
- **Dependencies:** owner-managed protected store for actual config values before recovery is valid.
- **Risks:** a hash-only manifest could be mistaken for a backup; documentation states the opposite.
- **Next task:** owner creates and verifies the actual protected configuration backup before any destructive migration step.

### 2026-11-23 — Combined backup rehearsal runner added

- **Status:** local read-only snapshot input plus local artifact writes only. No export, provision, deploy, migration or data change. New changes are uncommitted.
- **Added/updated files:** `backend-server/apps/api/src/migration/backupRehearsal.ts`, `backend-server/apps/api/src/migration/backupRehearsal.test.ts`, `backend-server/apps/api/src/scripts/backup-rehearse.ts`, `backend-server/apps/api/package.json`, `docs/migration/BACKUP_AND_RECOVERY.md`, `docs/migration/data-migration-tooling.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-backup-rehearsal-runner.md`.
- **Verification performed:** targeted tests 13/13 passed; `npm.cmd run typecheck --workspace @yugm/api` passed; CLI smoke on a generated snapshot printed PASS for integrity, dry-run rehearsal and combined result. No production access.
- **Issues:** no real backup or restore; combined PASS is not a restore verification.
- **Decisions:** none; implements backup step 7 plus dry-run rehearsal under DCR-5 authorization.
- **Dependencies:** owner-approved snapshot copy before real use; restore rehearsal still requires an isolated target and real data.
- **Risks:** the combined PASS could be mistaken for a successful restore; wording and docs explicitly deny that.
- **Next task:** owner approves a real export target, then run verification and rehearsal on that copy before any destructive step.

### 2026-11-23 — OpenAPI structural guard added to CI

- **Status:** local guard script and CI steps only. No push, CI run, deploy, provision or data change. New changes are uncommitted.
- **Added/updated files:** `backend-server/scripts/check-openapi.mjs`, `backend-server/scripts/check-openapi.test.mjs`, `backend-server/package.json`, `.github/workflows/ci.yml`, `docs/infrastructure/admin-deployment-audit.md`, `docs/migration/implementation-plan.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-openapi-guard.md`.
- **Verification performed:** `test:openapi` 6/6 passed; `openapi:check` passed against the real spec (90 paths, 16 schemas, 23 local refs). No network or production access.
- **Issues:** structural guard only; it does not replace full OpenAPI schema validation with `swagger-cli`.
- **Decisions:** none; closes a Phase 0 CI observation under DCR-5 local-code-and-tests authorization.
- **Dependencies:** owner approval before commit/push if the CI steps should become active.
- **Risks:** regex-based YAML inspection can miss exotic syntax; documented as a guard, not a validator. CI YAML was not parser-validated locally.
- **Next task:** decide whether to add full `swagger-cli` validation to CI with a pinned dependency.

### 2026-11-23 — Admin view permission helper extracted and tested

- **Status:** local admin UI hardening and tests. No push, CI run, deploy, provision or data change. New changes are uncommitted.
- **Added/updated files:** `backend-server/apps/admin/src/navigationPermissions.ts`, `backend-server/apps/admin/src/navigationPermissions.test.ts`, `backend-server/apps/admin/src/App.tsx`, `docs/infrastructure/admin-deployment-audit.md`, `docs/migration/DEPENDENCY_AUDIT.md`, `docs/migration/feature-matrix.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-admin-ci-gate.md`, `docs/handoffs/2026-11-23-admin-router-auth-guards.md`.
- **Verification performed:** admin tests 9/9, typecheck and Vite build passed; `dist/` artifacts restored to HEAD. No production access.
- **Issues:** pure permission decisions are tested; component rendering/runtime UI QA remains pending.
- **Decisions:** none; preserves server authority and existing permitted views while closing a UI bypass gap.
- **Dependencies:** owner approval before commit/push if these UI changes should become active.
- **Risks:** view guard uses the same permission map as sidebar; a missing map entry would leave a view unrestricted rather than deny-by-default. Tests assert the map is non-empty but cannot prove every future view is mapped.
- **Next task:** runtime admin UI QA across roles before treating view-level permissions as verified.

### 2026-11-23 — Admin API client tests added to CI gate

- **Status:** local admin test scaffolding and CI step only. No push, CI run, deploy, provision or data change. New changes are uncommitted.
- **Added/updated files:** `backend-server/apps/admin/src/api.ts`, `backend-server/apps/admin/src/api.test.ts`, `backend-server/apps/admin/package.json`, `.github/workflows/ci.yml`, `docs/infrastructure/admin-deployment-audit.md`, `docs/migration/feature-matrix.md`, `docs/migration/DEPENDENCY_AUDIT.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-admin-ci-gate.md`.
- **Verification performed:** admin tests 5/5, typecheck and Vite production build passed locally; `dist/` artifacts restored to HEAD. No YAML parser/actionlint available and no CI run triggered.
- **Issues:** tests cover API-client/formatting behavior only; view-level permission rendering remains untested.
- **Decisions:** none; closes the admin test-script finding under DCR-5 local-code-and-tests authorization.
- **Dependencies:** owner approval before commit/push if the CI test step should become active.
- **Risks:** `tsx` resolves from the hoisted workspace root; a fresh install must preserve that resolution. The CI workflow was not parser-validated locally.
- **Next task:** add admin view-level permission-rendering tests before treating the admin UI as verified.

### 2026-11-23 — Explicit admin router auth guards added

- **Status:** local server-side security hardening. No permission change, deploy, provision or data change. New changes are uncommitted.
- **Added/updated files:** `backend-server/apps/api/src/routes/adminAssets.ts`, `adminBadges.ts`, `adminCosmetics.ts`, `adminReactions.ts`, `adminSupport.ts`, `backend-server/apps/api/src/routes/adminRouterGuards.test.ts`, `docs/architecture/backend-source-audit.md`, `docs/cloudflare-migration/phase0-report.md`, `docs/infrastructure/admin-deployment-audit.md`, `docs/migration/private-media-authorization.md`, `docs/migration/feature-matrix.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-admin-router-auth-guards.md`.
- **Verification performed:** guard tests 5/5, full API suite 395/395, hardening suite 34/34, typecheck passed. No production access.
- **Issues:** unauthenticated 401 tests plus valid-JWT/guard-layer tests were added later in the day; real route-handler execution under a valid JWT remains untested. The public badge-art router remains intentionally public.
- **Decisions:** none; preserves effective permissions while removing mount-order dependence.
- **Dependencies:** owner approval before commit/push if these guards should become active.
- **Risks:** double auth runs for routers mounted after `adminRouter`; correctness preserved, minor extra JWT/DB lookup per request.
- **Next task:** add route-handler execution tests under a valid admin JWT before treating admin authorization as fully verified.

### 2026-11-23 — Admin CI typecheck/build gate added

- **Status:** local workflow configuration only. No push, CI run, deploy, provision or data change. New changes are uncommitted.
- **Added/updated files:** `.github/workflows/ci.yml`, `docs/cloudflare-migration/phase0-report.md`, `docs/infrastructure/admin-deployment-audit.md`, `docs/migration/DEPENDENCY_AUDIT.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-admin-ci-gate.md`.
- **Verification performed:** local admin typecheck and Vite production build passed; workflow structure inspected manually. No YAML parser/actionlint was available locally and no CI run was triggered.
- **Issues:** admin still has no test script; this is not a test gate. Strict secret scanning remains blocked on credential rotation.
- **Decisions:** none; closes a Phase 0 CI observation under DCR-5 local-code-and-tests authorization.
- **Dependencies:** owner approval before commit/push if the workflow change should become active in GitHub Actions.
- **Risks:** an untested workflow edit could fail remotely; local commands were run with the same workspace scripts and the YAML was manually checked.
- **Next task:** owner approves commit/push, then observe the first CI run with the new job before treating the gate as active.

### 2026-11-23 — Snapshot delta diff added (final delta-sync planning aid)

- **Status:** local read-only tooling only. No export, import, provision, deploy, migration or data change. New changes are uncommitted.
- **Added/updated files:** `backend-server/apps/api/src/migration/snapshot.ts`, `backend-server/apps/api/src/migration/snapshotDiff.ts`, `backend-server/apps/api/src/migration/snapshotDiff.test.ts`, `backend-server/apps/api/src/scripts/snapshot-diff.ts`, `backend-server/apps/api/package.json`, `docs/migration/final-delta-sync-design.md`, `docs/migration/data-migration-tooling.md`, `docs/migration/BACKUP_AND_RECOVERY.md`, `docs/INDEX.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-snapshot-delta-diff.md`.
- **Verification performed:** targeted tests 16/16 passed; `npm.cmd run typecheck --workspace @yugm/api` passed; CLI smoke on two generated snapshots printed added/removed/changed counts and field names only. No production access.
- **Issues:** this is not final delta sync; watermark export, tombstones/deletion lists, upsert-by-source_id, child-row replacement and delta checkpoints remain open.
- **Decisions:** none; implements a verification aid under DCR-5 local-code-and-tests authorization.
- **Dependencies:** two owner-approved snapshots before real use; open delta design decisions.
- **Risks:** a snapshot diff could be mistaken for an authoritative delta export; documented as a planning aid only.
- **Next task:** owner resolves the final delta-sync design decisions before any delta exporter/upsert implementation.

### 2026-11-23 — D1 draft schema conflicts refined (local code + tests)

- **Status:** local DDL/transform refinement only. No database, export, import, deploy, provision or data change. New changes are uncommitted.
- **Added/updated files:** `backend-server/apps/api/src/migration/transform.ts`, `backend-server/apps/api/src/migration/types.ts`, `backend-server/apps/api/src/migration/mappings.ts`, `backend-server/apps/api/src/migration/transform.test.ts`, `backend-server/apps/api/src/migration/mappings-progression.test.ts`, `backend-server/apps/api/src/scripts/generate-d1-schema.ts`, `backend-server/apps/api/migrations/d1/0001_initial.sql`, `backend-server/apps/api/migrations/d1/0001_initial.manifest.json`, `docs/database/d1-schema-warning-triage.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-d1-schema-conflict-refinement.md`.
- **Verification performed:** full migration suite 163/163 passed; `npm.cmd run typecheck --workspace @yugm/api` passed; `schema:d1` regenerated 146 tables with 0 warnings/import failures; SQL diff limited to three nullable columns, two `REAL` columns/checks and the manifest timestamp.
- **Issues:** none introduced in tests; schema remains a review draft and owner approval is still required.
- **Decisions:** resolved draft-level nullability and multiplier typing from source evidence; no product decision and no schema approval.
- **Dependencies:** owner approval of regenerated DDL, DCR-2 metrics/Workers Paid, backup/restore rehearsal and cutover gates.
- **Risks:** REAL multipliers could be mistaken for money columns; documented that money remains INTEGER minor units and only two named fields use REAL.
- **Next task:** owner reviews/refines the regenerated DDL, then approves it as the baseline before rehearsal.

### 2026-11-23 — Private-media authorization audit added (DCR-4 input preparation)

- **Status:** documentation-only source audit. No code, policy, bucket, deploy, migration or data change. No new commit/push authorization.
- **Added/updated files:** `docs/migration/private-media-authorization.md`, `docs/cloudflare-migration/decision-request.md`, `docs/INDEX.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-private-media-authorization-audit.md`.
- **Finding:** current non-owner `PRIVATE` access is implemented only for `ownerType=MESSAGE` direct-message participants; `ROOM`, `CLAN` and other owner types are denied. Latent today because managed upload only accepts `AVATAR`/`USER`, but blocking for any private room/clan/category cutover.
- **Verification performed:** source reads and cross-check of the existing `mediaAccessDecision` unit tests; no runtime verification.
- **Issues:** participant rules are undefined for room/clan/group scenarios; admin asset-staging auth depends on router mount order already flagged in Phase 0.
- **Decisions:** none; no room/clan policy was recommended or selected.
- **Dependencies:** owner definitions for room/clan/message participant rules, block/hide semantics and admin overrides before private category cutover.
- **Risks:** the latent gap could be mistaken for implemented room/clan privacy if only `MediaObject.ownerType` enums are reviewed.
- **Next task:** owner supplies DCR-4 scope and private-media rules; then design the adapter in a separately authorized slice.

### 2026-11-23 — Legacy media reference scanner added (DCR-4 input preparation)

- **Status:** local read-only tooling only. No export, provision, policy decision, deploy, migration or data change. New changes are uncommitted.
- **Added/updated files:** `backend-server/apps/api/src/migration/legacyMediaReferences.ts`, `backend-server/apps/api/src/migration/legacyMediaReferences.test.ts`, `backend-server/apps/api/src/scripts/legacy-media-references.ts`, `backend-server/apps/api/package.json`, `docs/cloudflare-migration/decision-request.md`, `docs/migration/BACKUP_AND_RECOVERY.md`, `docs/INDEX.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-legacy-media-reference-scanner.md`.
- **Verification performed:** targeted tests 23/23 passed; `npm.cmd run typecheck --workspace @yugm/api` passed; CLI smoke on a generated JSONL fixture produced counts and URL digests without echoing raw URLs. No production access.
- **Issues:** this counts references, not existing binaries. The historical unrecoverable-file finding and media backup requirement remain unchanged. No public/private policy is asserted.
- **Decisions:** none; implements DCR-4 input preparation under DCR-5 local-code-and-tests authorization.
- **Dependencies:** owner-approved export or snapshot copy, DCR-4 environment inputs and option selection.
- **Risks:** a reference count could be mistaken for a recoverable binary census; signed/query-bearing URLs are de-queried before hashing and raw values are intentionally not emitted.
- **Next task:** owner supplies a media export or snapshot copy; run both `inventory:media` and `inventory:legacy-media`, then cross-check against the unresolved `/uploads` recovery gap before any cutover.

### 2026-11-23 — D1 hard-limit screener added (DCR-2 input preparation)

- **Status:** local read-only tooling only. No metrics collected, no Cloudflare account queried, no deploy, provision, migration or data change. New changes are uncommitted; no commit/push authorization applies to this slice.
- **Added/updated files:** `backend-server/apps/api/src/migration/d1CapacityGate.ts`, `backend-server/apps/api/src/migration/d1CapacityGate.test.ts`, `backend-server/apps/api/src/scripts/d1-capacity-gate.ts`, `backend-server/apps/api/package.json`, `docs/database/d1-capacity-assessment.md`, `docs/cloudflare-migration/decision-request.md`, `docs/migration/BASELINE_REPORT.md`, `docs/INDEX.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md`, `docs/handoffs/2026-11-23-d1-capacity-screener.md`.
- **Verification performed:** targeted tests 16/16 passed; `npm.cmd run typecheck --workspace @yugm/api` passed; CLI smoke printed `PASS / REVIEW REQUIRED` for a valid fixture and exited 1 with all expected hard-limit failures for an over-limit fixture. No production access.
- **Issues:** no real metrics exist; five review items remain open by design. Hard-limit PASS must not be reported as DCR-2 acceptance.
- **Decisions:** none; implements input preparation under DCR-5 local-code-and-tests authorization.
- **Dependencies:** owner-supplied aggregates, Workers Paid confirmation, query/growth/recovery evidence and schema approval.
- **Risks:** a hard-limit PASS could be mistaken for full capacity approval; the screener relies on decimal byte units and caller-honest aggregates.
- **Next task:** owner supplies metrics in the documented input shape, then review the five open items and the schema before any D1 rehearsal or cutover.

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
