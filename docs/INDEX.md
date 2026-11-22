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
- [Android build performance audit](android-build-performance-audit.md)
- [Cloudflare migration audit](cloudflare-migration/audit.md)
- [Production blueprint and audit](production/README.md)

## Cloudflare migration (Phase 0)

- [Migration progress tracker](../MIGRATION_PROGRESS.md)
- [Phase 0 report](cloudflare-migration/phase0-report.md)
- [Phase 0 decision request](cloudflare-migration/decision-request.md)
- [Target Cloudflare architecture](architecture/target-architecture.md)
- [Backend source audit](architecture/backend-source-audit.md)
- [Android source audit](architecture/android-source-audit.md)
- [Cloudflare platform limits and pricing snapshot](infrastructure/cloudflare-platform-limits.md)
- [Existing Worker prototype audit](infrastructure/worker-prototype-audit.md)
- [Admin, infrastructure and CI/CD audit](infrastructure/admin-deployment-audit.md)
- [Environments and operations plan](infrastructure/environments.md)
- [D1 capacity and suitability assessment](database/d1-capacity-assessment.md)
- [MongoDB to relational mapping](database/mongo-to-relational-mapping.md)
- [D1 schema warning triage (proposal)](database/d1-schema-warning-triage.md)
- [Per-feature migration matrix](migration/feature-matrix.md)
- [API and client compatibility plan](migration/api-compatibility.md)
- [Data migration tooling requirements](migration/data-migration-tooling.md)
- [Realtime migration plan](migration/realtime-plan.md)
- [Realtime event inventory](migration/realtime-event-inventory.md)
- [Repository-specific implementation plan](migration/implementation-plan.md)
- [Migration test plan](testing/migration-test-plan.md)
- [Tracked Worker credentials finding](infrastructure/tracked-worker-credentials-finding.md)

Phase 0 audit and planning are documented; the phase is not accepted until the five gates in the [decision request](cloudflare-migration/decision-request.md) are resolved. DCR-2 is resolved as D1 in [ADR-0001](decisions/0001-d1-and-r2-target.md); DCR-1 and DCR-3 through DCR-5 remain open. No implementation phase or production data operation is authorized.

## Progress and follow up

- [Development progress](DEVELOPMENT_PROGRESS.md)
- [Known issues](KNOWN_ISSUES.md)
- [Technical debt and roadmap](TECHNICAL_DEBT.md)
- [Current task](CURRENT_TASK.md)
- [Architecture decision records](decisions/README.md) · [ADR-0001: D1 and R2 target](decisions/0001-d1-and-r2-target.md)

Create a handoff in `docs/handoffs/` only when work remains for another session. Record significant lasting architectural choices in `docs/decisions/` after they are evidenced or confirmed; do not invent product decisions.
