# Reconciliation: full Cloudflare migration directive vs. existing plan

**Current execution order:** See the [zero-spend migration plan](implementation-plan.md) and [ADR-0008](../decisions/0008-zero-spend-cloudflare-migration.md). The phase mapping below records the earlier plan.

**Date:** 2026-11-22
**Status:** Phase 0 reconciliation artifact. It maps the owner's 26-phase directive onto the repository's existing Phase 0–8 plan, records where the two agree, and names the unresolved gates. It does not authorize provisioning, credential changes, deployment, data migration or removal.

## 1. Purpose and precedence

The owner issued a directive titled *YUGM — COMPLETE CLOUDFLARE MIGRATION, LEGACY INFRASTRUCTURE REMOVAL AND SYSTEM CLEANUP*. It restates the target architecture in 26 numbered phases and requires phase 0 to audit the repository, reconcile with prior plans, then proceed in dependency order.

This repository already contains a completed Phase 0 audit, a five-gate decision request, an accepted database ADR and a phased implementation plan. Rebuilding those artifacts would duplicate work and risk contradicting owner decisions already recorded. This document therefore:

1. Treats source code and Git state as authoritative for what is implemented.
2. Treats `docs/decisions/0001-d1-and-r2-target.md` as the recorded owner decision for the database target.
3. Treats `docs/cloudflare-migration/decision-request.md` as the authoritative list of still-open decisions (DCR-1, DCR-3, DCR-4, DCR-5).
4. Maps each directive phase to the existing plan so work is not repeated.

The directive's own safety rules (no destructive operations, no paid provisioning without approval, no removal before validated replacement, no fabricated verification) match the existing plan's exit gates. Nothing in this reconciliation permits bypassing them.

## 2. Agreement on the final architecture

The directive and the recorded architecture agree on the following target:

| Concern | Target | Existing evidence |
|---|---|---|
| HTTP APIs, business rules, authz, webhooks, orchestration | Cloudflare Workers | `docs/architecture/target-architecture.md`, `docs/migration/implementation-plan.md` Phase 3 |
| Authoritative relational state | Cloudflare D1 | `docs/decisions/0001-d1-and-r2-target.md` (owner accepted) |
| Binary media | Cloudflare R2 only | ADR-0001; `docs/features/r2-centralized-media.md` |
| Realtime coordination | SQLite-backed Durable Objects, scoped per conversation/room/user/match, hibernation where possible | `docs/migration/realtime-plan.md`, `docs/migration/realtime-event-inventory.md` |
| Non-critical cache/config | Workers KV | `docs/architecture/target-architecture.md` |
| Async work | Cloudflare Queues | `docs/migration/implementation-plan.md` Phase 6 |
| Scheduled work | Cron Triggers and DO alarms | `docs/migration/implementation-plan.md` Phase 6 |
| Image work | Cloudflare Images behind a host-neutral processor registry | `docs/infrastructure/worker-runtime-image-processing.md` |
| Admin and web frontends | Cloudflare Pages | `docs/infrastructure/environments.md` |
| Observability | Cloudflare Observability with structured logs | `docs/infrastructure/environments.md` |
| Retained externals | Firebase Auth + FCM, GitHub, Google Play Billing, required payment providers | `docs/architecture/target-architecture.md` |

No new infrastructure service is introduced by this reconciliation.

## 3. Directive phase → existing plan mapping

| Directive phase | Existing plan / artifact | Current status |
|---|---|---|
| 0. Repository and infrastructure audit | `docs/cloudflare-migration/phase0-report.md`, `docs/architecture/{backend-source-audit,android-source-audit,target-architecture}.md`, `docs/infrastructure/{admin-deployment-audit,worker-prototype-audit,cloudflare-platform-limits}.md`, `docs/migration/{feature-matrix,api-compatibility,data-migration-tooling,realtime-plan,realtime-event-inventory}.md`, `docs/testing/migration-test-plan.md` | Audit complete; phase **not accepted** pending DCR-1/3/4/5. `docs/migration/DEPENDENCY_AUDIT.md` adds the directive's required dependency matrix. |
| 1. Baseline and recovery preparation | `docs/migration/BASELINE_REPORT.md`, `docs/migration/BACKUP_AND_RECOVERY.md`, `docs/migration/ROLLBACK_PLAN.md` (new), `docs/migration/rollback-runbook.md` (existing draft) | Documentation and observed staging latency recorded. **No verified production backup or restore exists yet**; gate not satisfied. |
| 2. Cloudflare configuration consolidation | `docs/infrastructure/environments.md`, `wrangler*.jsonc` | Local/staging/production configs exist and staging is deployed. Secret remediation (DCR-1) and binding provisioning remain open. |
| 3. Resolve Workers runtime incompatibilities | `docs/infrastructure/worker-runtime-image-processing.md`, `docs/CURRENT_TASK.md` YUGM-WORKER-1101 | **Implemented and verified on staging**: Error 1101 resolved, `/health` and `/ready` pass, CI runs #77/#78 green, no Sharp in the Worker bundle. Production cutover still gated. |
| 4. Centralized media to R2 | `docs/features/r2-centralized-media.md`, implementation plan Phase 4 | Foundation + avatar slice exists; R2 configured locally only. Live managed upload, other categories, admin tooling and cutover unverified. DCR-4 open. |
| 5. Remove Sharp / legacy image processing | `docs/infrastructure/worker-runtime-image-processing.md`, plan Phase 4/5 | Worker Sharp chain removed; Sharp remains isolated in the Node API entry point for local/offline use. Full removal waits on R2/Cloudflare Images parity validation. |
| 6. MongoDB → D1 | ADR-0001, `docs/database/mongo-to-relational-mapping.md`, `docs/migration/data-migration-tooling.md`, `backend-server/apps/api/migrations/d1/0001_initial.sql`, `src/migration/` | Mapping and tooling implemented and unit-tested locally (138 migration tests). **No live export, import, restore rehearsal or schema approval.** Capacity metrics and Workers Paid open. |
| 7. Transaction/business logic validation | `docs/wallet-ledger.md`, `docs/BUSINESS_RULES.md`, `docs/testing/migration-test-plan.md` | Rules documented; migrated-transaction and concurrency tests not yet run against D1. |
| 8. Redis usage migration | `docs/cloudflare-migration/phase0-report.md`, realtime plan | Redis/BullMQ usage still active in Node API; replacements not implemented. |
| 9. Realtime / Socket.IO migration | `docs/migration/realtime-plan.md`, `realtime-event-inventory.md` | Event inventory source-verified. Protocol path (A/B/C) not chosen: DCR-3 open. |
| 10. LiveKit → Cloudflare Realtime | `docs/cloudflare-migration/audit.md`, target architecture | LiveKit remains active; provider abstraction is not implemented. Real-device parity tests not run. **Directive permits RealtimeKit only with approval** — do not substitute. |
| 11. Background jobs/schedulers | Plan Phase 6, `docs/infrastructure/worker-runtime-image-processing.md` | Cron/DO alarms active for maintenance and PK; Queue bindings not provisioned; legacy timers still exist in Node API. |
| 12. Asset management consolidation | `docs/features/cosmetics-ecosystem-audit.md`, `docs/features/r2-centralized-media.md`, plan Phase 4 | Centralized registry exists for media; asset identity/version/store/ownership separation remains incomplete. Hardcoded Android catalogs remain. |
| 13. Android cleanup | `docs/architecture/android-source-audit.md`, plan Phase 7 | Debt documented (103 direct API calls, hardcoded catalogs, upload wiring gap, `BONDS` topic drift). No migration-driven cleanup applied. |
| 14. Admin dashboard integration | `docs/infrastructure/admin-deployment-audit.md`, plan Phase 7/8 | Admin deployed to staging Pages; no media/registry/quota UI; no test script; server RBAC must remain the boundary. |
| 15. Firebase retention/minimization | `docs/architecture/target-architecture.md`, `docs/cloudflare-migration/audit.md` | Auth + FCM retained. Workers verification and any other Firebase service audit not yet complete. |
| 16. Security hardening | `docs/SECURITY_RULES.md`, `docs/cloudflare-migration/phase0-report.md`, `docs/infrastructure/tracked-worker-credentials-finding.md` | DCR-1 open; several source-verified auth/socket issues recorded in the Phase 0 tracker. No hardened production posture yet. |
| 17. Comprehensive testing | `docs/testing/migration-test-plan.md`, existing API/hardening/Worker suites | Local suites pass at recorded baselines; staged/integration/financial/device tests remain open. |
| 18. Controlled production cutover | Plan Phase 8, `docs/migration/rollback-runbook.md` | Not authorized or performed. |
| 19. Legacy infrastructure removal | Plan Phase 8 + `docs/migration/LEGACY_REMOVAL_REPORT.md` (to be produced) | Not authorized or performed. Render blueprint retained for rollback; MongoDB remains authoritative. |
| 20. Source/dependency cleanup | Plan Phase 7 + cleanup report | Not started; removal only after replacements are verified. |
| 21. Configuration/secret cleanup | `docs/infrastructure/environments.md`, DCR-1 | Not started; credential owner/rotation approval required. |
| 22. Deployment/file cleanup | `docs/infrastructure/admin-deployment-audit.md`, CI audit | Consolidated staging workflow exists; legacy Render files retained intentionally. |
| 23. Legacy reference verification | `docs/migration/LEGACY_REMOVAL_REPORT.md` (to be produced) | Pending; `docs/migration/DEPENDENCY_AUDIT.md` supplies the baseline inventory. |
| 24. Performance/cost optimization | `docs/infrastructure/cloudflare-platform-limits.md`, plan Phase 6 | Limits documented; no measured production cost/performance baseline. |
| 25. Monitoring/stability validation | `docs/infrastructure/environments.md`, plan Phase 6 | Structured logging and `/ready` exist; alerting and stability criteria not configured. |
| 26. Final documentation consolidation | `docs/INDEX.md`, `docs/CURRENT_TASK.md`, `MIGRATION_PROGRESS.md`, this document | In progress; no conflicting architecture introduced. |

## 4. Conflicts and clarifications requiring owner input

1. **Paid plan vs. production D1.** ADR-0001 records that Workers Paid must be approved before production traffic reaches D1. The directive prefers free-tier-compatible services and forbids activating paid plans without explicit approval. These are compatible only if production cutover waits for that approval; free tier remains acceptable for isolated staging and disposable tests. No paid service has been activated.
2. **Realtime protocol (DCR-3).** The directive allows either a compatibility bridge or a coordinated protocol migration but does not choose. The existing plan requires a choice before Phase 5. No protocol is interchangeable without a compatibility suite.
3. **Media cutover (DCR-4).** The directive lists all media categories and private/public rules but does not supply bucket names, custom domains, CORS allowlist, visibility rules or an admin tooling owner. The existing avatar slice is the only wired category.
4. **Credential remediation (DCR-1).** The directive requires rotating compromised credentials, but the repository finding requires owner authorization and provider access, and forbids history rewriting without explicit approval. No rotation, source removal or history rewrite has been performed here.
5. **Plan acceptance (DCR-5).** This directive is treated as the scope definition, not as explicit authorization for commit, push, deploy, DNS, paid provisioning or destructive data operations. Those remain separate approvals under `AGENTS.md` and the decision request.
6. **RTC provider.** The directive names Cloudflare Realtime SFU/TURN and permits RealtimeKit only with justification. LiveKit remains active until a parity-tested replacement exists; no participant-minute-based service has been introduced.

## 5. Execution order from here

The dependency-aware order is unchanged:

```text
Phase 0 reconciliation + dependency audit (current work)
  → owner resolves DCR-1, DCR-3, DCR-4, DCR-5 and supplies capacity/metrics inputs
    → Phase 1 isolated environments, contracts, secret remediation
      → Phase 2 backup/restore rehearsal + D1 migration validation
        → Phase 3 Workers API/domain cutovers
          → Phase 4 R2 media + assets
            → Phase 5 realtime
              → Phase 6 RTC/queues/observability
                → Phase 7 Android/admin integration
                  → Phase 8 cutover → removal → cleanup
```

At each boundary the rule remains **migrate → verify → switch traffic → monitor → remove → clean up**. Source presence, a local dry run or a documentation update is never proof that a phase is complete.

## 6. Artifacts produced by this reconciliation

- `docs/migration/DEPENDENCY_AUDIT.md` — dependency inventory and migration matrix.
- `docs/migration/BASELINE_REPORT.md` — recoverable checkpoint and observed baseline.
- `docs/migration/BACKUP_AND_RECOVERY.md` — backup inventory and verification status.
- `docs/migration/ROLLBACK_PLAN.md` — rollback conditions and links to the existing runbook.
- `MIGRATION_PROGRESS.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md` — status updates.

No application code, configuration, credential, infrastructure resource or deployment was changed by this reconciliation.
