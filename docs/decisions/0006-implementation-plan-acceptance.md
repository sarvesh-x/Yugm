# ADR-0006 — Implementation plan acceptance and commit authorization

**Date:** 2026-11-23
**Status:** Accepted as the original sequence. [ADR-0008](0008-zero-spend-cloudflare-migration.md) supersedes the execution order. The one-time commit authorization recorded below was consumed.
**Decision request:** DCR-5 in [decision-request.md](../cloudflare-migration/decision-request.md).

## Decision

The owner accepted the repository-specific [implementation plan](../migration/implementation-plan.md) as the execution sequence, with the phase order, dependency chain and per-phase exit gates unchanged.

The owner also authorized **one commit and push** of the current uncommitted local slices. That authorization is limited to the working tree at the time of this ADR. It does not create standing commit/push authority and does not authorize:

- Cloudflare provisioning, paid-plan activation, domains/DNS or deployment;
- credential rotation or secret-store changes;
- production snapshot export, transform, import or migration;
- destructive change, DNS cutover, release or removal of MongoDB;
- any future commit/push without another explicit approval.

## Related decisions

- DCR-1: credential remediation complete under [ADR-0003](0003-credential-remediation-approach.md).
- DCR-2: D1 selected under [ADR-0001](0001-d1-and-r2-target.md); capacity metrics, Workers Paid, recovery evidence and schema approval remain open.
- DCR-3: staged hybrid realtime decision complete under [ADR-0002](0002-staged-hybrid-realtime-protocol.md); runtime implementation remains.
- DCR-4: phased R2 media cutover decision complete under [ADR-0005](0005-r2-media-cutover.md); provisioning and category cutovers remain.
- Local-code-and-tests boundary: [ADR-0004](0004-local-code-and-tests-authorization.md).

## Consequences

- Phase 0 decision gates DCR-1, DCR-3, DCR-4 and DCR-5 are accepted. DCR-2 evidence gates and recovery gates remain open.
- Local tooling and documentation can be published under the one-time authorization, but no phase can advance past its exit gate.
- Any deploy, provision, production data operation or future commit/push needs separate explicit approval.
- The Android working-tree edits that appeared during local work are included only because the owner explicitly authorized committing all current changes.

## Non-goals

- No claim that DCR-2 capacity or recovery gates are satisfied.
- No permission to start Phase 1 provisioning or production work.
- No standing authorization for future commits.
