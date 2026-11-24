# Yugm engineering documentation

Use this index as the map; source code remains authoritative for implemented behavior.

## Start here

- [Agent workflow and rules](../AGENTS.md)
- [Project context](PROJECT_CONTEXT.md)
- [Product vision](PRODUCT_VISION.md)
- [Architecture](ARCHITECTURE.md)
- [Current task](CURRENT_TASK.md)
- [Engineering foundation report](YUGM_ENGINEERING_FOUNDATION_REPORT.md)

## Architecture and implementation evidence

- [Architecture overview and discovery evidence](production/architecture.md)
- [Current implementation progress](production/current-progress.md)
- [Finding register](production/findings.md)
- [Requirement matrix](production/requirement-matrix.md)
- [Implementation sequence](production/implementation-sequence.md)
- [Machine generated HTTP inventory](production/endpoint-inventory.csv)
- [Machine generated Socket.IO inventory](production/socket-inventory.csv)
- [Machine generated schema inventory](production/schema-inventory.csv)
- [API OpenAPI source](../backend-server/apps/api/openapi.yaml)
- [First-launch splash and onboarding audit](features/onboarding-audit.md)
- [Cosmetics, assets, store, inventory, gifts and achievements audit](features/cosmetics-ecosystem-audit.md)

The production audit documents explain their baselines and verification limits. Use them as evidence, not as proof of deployment state. Recheck source for current behavior.

## Canonical engineering standards

- [Coding standards](CODING_STANDARDS.md)
- [State management](STATE_MANAGEMENT.md)
- [Navigation architecture](NAVIGATION_ARCHITECTURE.md)
- [Navigation map](NAVIGATION_MAP.md)
- [Database schema](DATABASE_SCHEMA.md)
- [Design system](DESIGN_SYSTEM.md)
- [Shared component registry](COMPONENT_REGISTRY.md)
- [Feature registry](FEATURE_REGISTRY.md)
- [Business rules](BUSINESS_RULES.md)
- [Security rules](SECURITY_RULES.md)
- [API contracts](API_CONTRACTS.md)
- [Realtime events](REALTIME_EVENTS.md)
- [Error handling](ERROR_HANDLING.md)
- [Testing strategy](TESTING_STRATEGY.md)
- [Performance standards](PERFORMANCE_STANDARDS.md)
- [Development and handoff workflow](DEVELOPMENT_WORKFLOW.md)
- [Definition of done](DEFINITION_OF_DONE.md)

## Existing product and operational references

- [Wallet ledger](wallet-ledger.md) · [withdrawals](withdrawals.md) · [payout review](payout-review.md) · [creator payout KYC](creator-payout-kyc.md)
- [Permissions](permissions.md) · [moderation workflow](moderation-workflow.md) · [admin system](admin-system.md) · [trust verification](trust-verification.md)
- [Privacy policy](privacy-policy.md) · [data deletion](data-deletion.md) · [biometric data handling](biometric-data-handling.md)
- [PK battle architecture](pk-battle-architecture.md) · [bonds](bonds.md) · [UI accessibility](ui-accessibility.md)
- [Centralized Cloudflare R2 media and asset storage](features/r2-centralized-media.md)
- [Profile avatar storage in Cloudflare R2 (legacy fallback contract)](features/avatar-r2-storage.md)
- [Release APK/AAB configuration for R2-backed media](features/release-build-configuration.md)
- [Google Play release checklist](play-store-release-checklist.md)
- [Android build performance audit](android-build-performance-audit.md)
- [Cloudflare migration audit](cloudflare-migration/audit.md)
- [Production blueprint and audit](production/README.md)

## Cloudflare migration

- [Active behavior-preserving $0 migration plan](migration/implementation-plan.md) · [Preservation registries and gate tracker](migration/MIGRATION_PROGRESS.md) · [Budget decision](decisions/0008-zero-spend-cloudflare-migration.md)
- [Resume the migration in the existing working tree](handoffs/2026-11-24-migration-continuation.md) · [Local D1 + R2 managed avatar media slice](handoffs/2026-11-24-local-d1-r2-media.md)
- [Migration progress tracker](../MIGRATION_PROGRESS.md)
- [Phase 0 report](cloudflare-migration/phase0-report.md)
- [Phase 0 decision request](cloudflare-migration/decision-request.md)
- [Target Cloudflare architecture](architecture/target-architecture.md)
- [Backend source audit](architecture/backend-source-audit.md)
- [Android source audit](architecture/android-source-audit.md)
- [Cloudflare platform limits and pricing snapshot](infrastructure/cloudflare-platform-limits.md)
- [Existing Worker prototype audit](infrastructure/worker-prototype-audit.md)
- [Worker runtime and image processing boundary](infrastructure/worker-runtime-image-processing.md)
- [Admin, infrastructure and CI/CD audit](infrastructure/admin-deployment-audit.md)
- [Environments and operations plan](infrastructure/environments.md)
- [D1 capacity and suitability assessment](database/d1-capacity-assessment.md)
- [DCR-2 readiness runbook](migration/DCR2_READINESS_RUNBOOK.md)
- [D1 hard-limit screener (local, read-only)](../backend-server/apps/api/src/migration/d1CapacityGate.ts)
- [Legacy media reference scanner (local, read-only)](../backend-server/apps/api/src/migration/legacyMediaReferences.ts)
- [Snapshot delta diff (local, read-only)](../backend-server/apps/api/src/migration/snapshotDiff.ts)
- [MongoDB to relational mapping](database/mongo-to-relational-mapping.md)
- [D1 schema warning triage (proposal)](database/d1-schema-warning-triage.md)
- [Per-feature migration matrix](migration/feature-matrix.md)
- [API and client compatibility plan](migration/api-compatibility.md)
- [Data migration tooling requirements](migration/data-migration-tooling.md)
- [Realtime migration plan](migration/realtime-plan.md)
- [Realtime event inventory](migration/realtime-event-inventory.md)
- [Native realtime protocol contract (local, unwired)](../backend-server/packages/shared/src/realtimeProtocol.ts)
- [Realtime parity matrix (local, unwired)](../backend-server/packages/shared/src/realtimeParity.ts)
- [Native server transport (local, unwired)](../backend-server/packages/shared/src/nativeRealtimeServer.ts)
- [Native Durable Object skeleton (local, unwired)](../backend-server/apps/cloudflare-worker/src/nativeRealtimeDo.ts)
- [Legacy Socket.IO compatibility adapter (local, unwired)](../backend-server/packages/shared/src/legacyRealtimeAdapter.ts)
- [Serialized operations primitive (local, unwired)](../backend-server/packages/shared/src/serializedOperations.ts)
- [Migration test plan](testing/migration-test-plan.md)
- [Directive-to-plan reconciliation](migration/DIRECTIVE_RECONCILIATION.md)
- [Dependency audit and migration matrix](migration/DEPENDENCY_AUDIT.md)
- [Baseline report](migration/BASELINE_REPORT.md)
- [Backup and recovery inventory](migration/BACKUP_AND_RECOVERY.md)
- [Private-media authorization audit](migration/private-media-authorization.md)
- [Rollback plan](migration/ROLLBACK_PLAN.md)
- [Tracked Worker credentials finding](infrastructure/tracked-worker-credentials-finding.md)

Phase 0 audit and planning are documented. DCR-2 and the DCR-5 authorization boundary were answered on 2026-11-22 ([ADR-0001](decisions/0001-d1-and-r2-target.md), [ADR-0004](decisions/0004-local-code-and-tests-authorization.md)); DCR-1 was completed on 2026-11-23 ([ADR-0003](decisions/0003-credential-remediation-approach.md)); DCR-3 decision gate completed 2026-11-23 ([ADR-0002](decisions/0002-staged-hybrid-realtime-protocol.md)). DCR-4 decision gate completed 2026-11-23 ([ADR-0005](decisions/0005-r2-media-cutover.md)); DCR-5 plan accepted with one-time commit/push authorization 2026-11-23 ([ADR-0006](decisions/0006-implementation-plan-acceptance.md)). DCR-2 production use is parked and not approved ([ADR-0007](decisions/0007-dcr2-capacity-gate-not-approved.md)); MongoDB remains authoritative and the Hyperdrive fallback is reopened. DCR-4 provisioning values remain open. Provision, deploy, credential rotation and data operations remain unauthorized without new explicit approval.

The execution sequence now starts with independently testable provider replacements on Workers Free. Production D1 remains parked while the plan evaluates a bounded Free-tier rollout. R2 remains conditional on enforcing the included allowance before live use. See [ADR-0008](decisions/0008-zero-spend-cloudflare-migration.md).

## Progress and follow up

- [Development progress](DEVELOPMENT_PROGRESS.md)
- [Known issues](KNOWN_ISSUES.md)
- [Technical debt and roadmap](TECHNICAL_DEBT.md)
- [Current task](CURRENT_TASK.md)
- [Architecture decision records](decisions/README.md) · [ADR-0001: D1 and R2 target](decisions/0001-d1-and-r2-target.md) · [ADR-0002: staged hybrid realtime](decisions/0002-staged-hybrid-realtime-protocol.md) · [ADR-0003: credential remediation](decisions/0003-credential-remediation-approach.md) · [ADR-0004: local code and tests authorization](decisions/0004-local-code-and-tests-authorization.md) · [ADR-0005: R2 media cutover](decisions/0005-r2-media-cutover.md) · [ADR-0006: plan acceptance](decisions/0006-implementation-plan-acceptance.md) · [ADR-0007: D1 not approved for production](decisions/0007-dcr2-capacity-gate-not-approved.md)

Create a handoff in `docs/handoffs/` only when work remains for another session. Record significant lasting architectural choices in `docs/decisions/` after they are evidenced or confirmed; do not invent product decisions.
