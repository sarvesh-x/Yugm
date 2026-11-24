# ADR-0007 — D1 not approved for production; DCR-2 capacity gate parked

**Later direction:** [ADR-0008](0008-zero-spend-cloudflare-migration.md) adds a local D1 Free evaluation path. This production decision remains in force.

**Date:** 2026-11-23
**Status:** Recorded decision. Closes the local DCR-2 work path; does not approve any production data operation.
**Relates to:** [ADR-0001](0001-d1-and-r2-target.md) (D1 direction), [DCR-2 decision request](../cloudflare-migration/decision-request.md), [D1 capacity assessment](../database/d1-capacity-assessment.md).

## Context

ADR-0001 selected D1 as the target for authoritative relational state, but made that selection conditional on capacity evidence, Workers Paid and a rehearsed restore. On 2026-11-23 the owner supplied a snapshot metrics file generated from a two-record test export. `npm run capacity:intake -- --input <file>` reported **NOT READY** with 11 of 16 metric fields missing (Workers Paid, index bytes, 12-month projection, binaries-in-D1, query-shape fields and all monitoring values). The owner then confirmed **Workers Paid is not enabled** and stated that the remaining production metrics are unavailable.

With Workers Paid = no, DCR-2 cannot pass: the capacity gate applies the Free 500 MB ceiling, and the DCR-2 decision rules require Workers Paid approved before production traffic reaches D1. No production-shaped snapshot exists, so the size, row and growth gates cannot be evaluated either.

## Decision

1. **D1 is not approved for production data.** ADR-0001 remains a record of the *directional* selection only; it is not an acceptance of D1 for authoritative state.
2. **MongoDB remains the authoritative database.** No export-for-migration, transform, D1 import, traffic switch, schema approval or MongoDB removal is authorized.
3. **All D1/R2 migration tooling remains local, unwired and unapproved.** The generated DDL, mappings, export/import/rehearsal CLIs and capacity tools are design/preparation artifacts. They may be reviewed and extended locally, but must not be represented as production-ready or as evidence of capacity.
4. **The Hyperdrive/PostgreSQL fallback is reopened.** If migration is revisited, PostgreSQL through Hyperdrive is the active alternative; financial state must remain atomic in one database either way.
5. **No values were fabricated.** The assistant did not fill missing metrics, connect to an unknown environment, or claim a gate result that was not actually produced.

## Consequences

- The DCR-2 exit gate is **open and parked**, not satisfied. Phase 0 cannot be closed and Phase 2 migration cannot start on the strength of this decision.
- Existing DCR-3 (realtime) and DCR-4 (R2 media) local work is unaffected; those gates have separate inputs and approvals.
- To reopen DCR-2, the owner must provide Workers Paid approval plus real production aggregates and a production-shaped snapshot, then run `docs/migration/DCR2_READINESS_RUNBOOK.md`. A `READY` result would still mean internal consistency only, not cutover authorization.
- This ADR deliberately does not delete or rewrite any prior decision record; it supersedes only the production-readiness interpretation of ADR-0001.

## Alternatives considered

| Alternative | Reason not taken |
|---|---|
| Fill the 11 missing fields with estimates | Would manufacture a false gate result for a decision about authoritative balances and purchases. |
| Proceed to D1 on Free tier | Workers Paid is a stated DCR-2 requirement; the Free 500 MB ceiling is not a viable production target. |
| Switch to Hyperdrive/PostgreSQL now | Requires a provisioned origin, approval and its own migration path; not authorized here. |
| Delete MongoDB support | Would destroy the authoritative source and rollback path without a validated replacement. |
