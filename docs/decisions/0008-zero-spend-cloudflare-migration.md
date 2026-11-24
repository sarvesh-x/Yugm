# ADR-0008 — Cloudflare migration with a $0 budget

**Later direction:** RealtimeKit is now the owner's preferred RTC candidate, and D1 Free is the intended production data store. The no-charge constraint and live parity, recovery and activation checks still apply. [Current production target](../handoffs/2026-11-24-production-cloudflare-builds.md)

**Date:** 2026-11-23

**Status:** Budget and direction confirmed by the owner. The [revised implementation plan](../migration/implementation-plan.md) records the proposed implementation order and release gates.

## Context

The owner wants to replace MongoDB, Redis and LiveKit with Cloudflare services, cannot pay for infrastructure, cannot provide production metrics, and wants to use R2 while it incurs no charge. The current staging Worker verifies runtime compatibility with the existing stack. Source data capacity, production recovery and provider replacement parity still need evidence.

## Decision

1. Keep the migration on Workers Free and prioritize independently verifiable replacements. Begin with BullMQ push notifications and then Redis workloads. Missing database evidence does not block these local slices or the development of Cloudflare-backed repository and RTC interfaces.
2. Evaluate D1 Free using bounded, measured workloads and isolated fixtures or an approved restored copy. Keep MongoDB authoritative under [ADR-0007](0007-dcr2-capacity-gate-not-approved.md). Replacing the Paid-only condition for a specific production rollout requires a separate owner decision and evidence for that rollout. PostgreSQL through Hyperdrive remains a historical fallback requiring a separately hosted database.
3. Keep R2 Standard in scope under [ADR-0005](0005-r2-media-cutover.md). Activate or expand use only with approved account terms and enforceable bounds below the included storage and operation allowances. Pause before crossing those bounds. The same budget applies to Realtime SFU/TURN and other services with usage-based overage.
4. Keep the hybrid protocol and its compatibility window in [ADR-0002](0002-staged-hybrid-realtime-protocol.md). LiveKit replacement is a separate RTC migration with provider-neutral interfaces and real-device parity. Any change to the supported product behavior needs an owner decision.

## Alternatives considered

- A paid migration adds recurring cost and conflicts with the budget.
- A single cutover couples independent providers to missing database evidence and increases recovery risk.
- Continuing to use a metered service until a bill appears can incur charges before usage can be stopped.

## Consequences

- The revised plan takes precedence over the execution sequence accepted in [ADR-0006](0006-implementation-plan-acceptance.md). The prior DCR decisions and authorization history remain the record for their respective scopes.
- Tests with synthetic or restored data can establish behavior and a measured workload envelope. Production usage and recovery remain unverified until measured and rehearsed against approved sources.
- The local replan is authorized. Billing checkout, resource provisioning, secret changes, deployment, data access/import, cutover, removal and commit/push remain separate operations under [the local authorization boundary](0004-local-code-and-tests-authorization.md).
