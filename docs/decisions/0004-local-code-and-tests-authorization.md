# ADR-0004 — Migration authorization boundary: local code and tests

**Date:** 2026-11-22
**Status:** Accepted for local work. Full plan acceptance is recorded in [ADR-0006](0006-implementation-plan-acceptance.md); the one-time commit/push authorization there does not create standing authority.
**Decision request:** DCR-5 in [decision-request.md](../cloudflare-migration/decision-request.md).

## Decision

The owner authorized **local code changes and local verification** as the next phase:

- Permitted: implementation behind flags or in isolated local tooling; local builds/tests/dry runs; documentation updates.
- Not permitted without further explicit approval: commit, push, deploy, DNS/cutover, Cloudflare provisioning, paid-plan activation, credential rotation or secret-store changes, production data export/transform/import, destructive change, or release.

Explicit plan acceptance for the full [implementation plan](../migration/implementation-plan.md) was recorded 2026-11-23 in [ADR-0006](0006-implementation-plan-acceptance.md), together with a one-time commit/push authorization for the current local slices. No standing authority beyond that was granted.

## Related decisions recorded on 2026-11-22

- DCR-1: Option A, owner rotates and agent prepares ([ADR-0003](0003-credential-remediation-approach.md)).
- DCR-3: Option C, staged hybrid realtime protocol ([ADR-0002](0002-staged-hybrid-realtime-protocol.md)).
- DCR-2 was previously resolved as D1 ([ADR-0001](0001-d1-and-r2-target.md)).

## Still open

- DCR-2 inputs: production capacity metrics and Workers Paid confirmation; capacity gates and recovery rehearsal.
- DCR-3 runtime implementation: compatibility adapter, native hibernating DO protocol, dual-path suite and cutoff date.
- DCR-4 provisioning and runtime implementation: R2 resources, exact production origin/CORS, admin tooling and phased category cutover.
- Backup creation and tested restore; legacy stability period and removal approval.
- Any future commit/push after the one-time authorization in ADR-0006, plus deploy/provisioning authorization.

## Consequences

Work may proceed on local, testable slices, but no cutover or destructive step is implied. Every phase exit gate in the implementation plan remains in force.
