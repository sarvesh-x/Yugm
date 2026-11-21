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
- [Profile avatar storage in Cloudflare R2](features/avatar-r2-storage.md)
- [Android build performance audit](android-build-performance-audit.md)
- [Cloudflare migration audit](cloudflare-migration/audit.md)
- [Production blueprint and audit](production/README.md)

## Progress and follow up

- [Development progress](DEVELOPMENT_PROGRESS.md)
- [Known issues](KNOWN_ISSUES.md)
- [Technical debt and roadmap](TECHNICAL_DEBT.md)
- [Current task](CURRENT_TASK.md)
- [Architecture decision records](decisions/README.md)

Create a handoff in `docs/handoffs/` only when work remains for another session. Record significant lasting architectural choices in `docs/decisions/` after they are evidenced or confirmed; do not invent product decisions.
