# ADR-0004 — Migration authorization boundary: local code and tests

**Date:** 2026-11-22
**Status:** Accepted for the current phase; revisit when remaining decision inputs arrive.
**Decision request:** DCR-5 in [decision-request.md](../cloudflare-migration/decision-request.md).

## Decision

The owner authorized **local code changes and local verification** as the next phase:

- Permitted: implementation behind flags or in isolated local tooling; local builds/tests/dry runs; documentation updates.
- Not permitted without further explicit approval: commit, push, deploy, DNS/cutover, Cloudflare provisioning, paid-plan activation, credential rotation or secret-store changes, production data export/transform/import, destructive change, or release.

Explicit plan acceptance for the full [implementation plan](../migration/implementation-plan.md) was not separately recorded; the authorization above applies to non-destructive local work only.

## Related decisions recorded on 2026-11-22

- DCR-1: Option A, owner rotates and agent prepares ([ADR-0003](0003-credential-remediation-approach.md)).
- DCR-3: Option C, staged hybrid realtime protocol ([ADR-0002](0002-staged-hybrid-realtime-protocol.md)).
- DCR-2 was previously resolved as D1 ([ADR-0001](0001-d1-and-r2-target.md)).

## Still open

- DCR-2 inputs: production capacity metrics and Workers Paid confirmation; capacity gates and recovery rehearsal.
- DCR-3 inputs: support window, hibernation requirement, event-inventory sign-off, `BONDS` topic decision.
- DCR-4: R2 scope, environment inputs and media cutover option.
- Backup creation and tested restore; legacy stability period and removal approval.
- Any commit/push/deploy/provisioning authorization.

## Consequences

Work may proceed on local, testable slices, but no cutover or destructive step is implied. Every phase exit gate in the implementation plan remains in force.
