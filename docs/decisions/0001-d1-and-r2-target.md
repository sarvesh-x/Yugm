# ADR-0001 — D1 and R2 as the authoritative Cloudflare target

**Date:** 2026-11-22  
**Status:** Superseded for production use by [ADR-0007](0007-dcr2-capacity-gate-not-approved.md): D1 is **not approved for production data** because capacity metrics are unavailable and Workers Paid is not enabled. Retained as a record of the directional selection and for local tooling only.
**Supersedes:** DCR-2 in [the Phase 0 decision request](../cloudflare-migration/decision-request.md).

## Context

Yugm currently runs on MongoDB/Mongoose with file storage split between local disk, legacy GridFS/S3 and the uncommitted R2 media foundation. Phase 0 produced the [target architecture](../architecture/target-architecture.md), [mapping specification](../database/mongo-to-relational-mapping.md), [D1 capacity assessment](../database/d1-capacity-assessment.md), [migration plan](../migration/implementation-plan.md) and a [five-gate decision request](../cloudflare-migration/decision-request.md).

DCR-2 (D1 versus PostgreSQL through Hyperdrive) was blocked on production size, growth, write and financial metrics that were not available during Phase 0. The owner has now explicitly selected D1 as the authoritative relational database and R2 as the only binary store, with the intent of retiring MongoDB support completely.

## Decision

1. **Cloudflare D1** is the authoritative relational database for all permanent server state: identity, auth, admin/RBAC, wallets and ledger, purchases, gifts, social graph, rooms metadata, catalog, progression, media registry and audit trails.
2. **Cloudflare R2** is the only binary object store. Rows hold bucket/key/checksum/metadata references; binaries, large JSON blobs and signed URLs are never stored in D1.
3. **MongoDB is retired** from the target architecture, including the `mongodb` `STORAGE_DRIVER` and all Mongoose persistence. It remains the read-only source of truth and rollback path until cutover is validated and approved — it is not deleted from the working tree before D1 repositories, migration tooling and validation exist.
4. This selection corresponds to **DCR-2 Option A**. PostgreSQL/Hyperdrive remains the documented fallback only if the capacity gates below fail.

## Owner risk acceptance and residual gates

The owner selected D1 without supplying the production metrics requested in DCR-2. That is an explicit acceptance of the *direction*, **not** a claim that the capacity checks passed. The following gates remain mandatory before Phase 2 rehearsal, production migration or cutover:

- Production aggregate metrics (collection sizes, growth, DAU, message/write/financial rates, query and transaction patterns) recorded and checked against [the D1 thresholds](../database/d1-capacity-assessment.md).
- Workers Paid approved and configured before production traffic reaches D1.
- No row exceeds the 2 MB limit after binaries move to R2; 12-month projection fits comfortably under 10 GB; peak writes and query latency have headroom.
- Full backup plus a rehearsed restore into isolated staging; Time Travel is not an independent backup.
- If any gate fails, this ADR must be revisited and the Hyperdrive fallback re-evaluated before schema approval. Financial state must stay atomic in a single database in either case.

**2026-11-23 update:** the residual gates above could not be satisfied. The owner confirmed Workers Paid is not enabled and production metrics are unavailable; a supplied metrics file was `NOT READY` with 11 missing fields. [ADR-0007](0007-dcr2-capacity-gate-not-approved.md) therefore parks D1 production use, keeps MongoDB authoritative and reopens the Hyperdrive fallback. Nothing in this ADR authorizes production migration or MongoDB removal.

This ADR does not resolve DCR-1 (tracked Worker credentials), DCR-3 (realtime protocol), DCR-4 (R2 media cutover scope/environment) or DCR-5 (plan acceptance and authorization boundaries).

## Alternatives considered

| Alternative | Reason not selected |
|---|---|
| PostgreSQL via Hyperdrive (DCR-2 Option B) | Owner selected D1; retained as documented fallback if capacity gates fail. |
| Keep MongoDB (status quo) | Contradicts the owner's explicit migration decision. |
| Delete Mongoose models immediately | Would destroy the authoritative source, break auth/financial state and remove the rollback path before D1 exists. |

## Consequences

- All future persistence work targets D1 repositories; new Mongoose-backed writes should not be added except as part of the migration adapters.
- A concrete D1 schema draft can now be generated; the first artifact is `backend-server/apps/api/migrations/d1/0001_initial.sql`, produced by `npm run schema:d1 --workspace apps/api` from the current models. It is a review draft, not an approved schema.
- Export/transform/import, validation, rollback tooling and per-domain repository cutovers are still required by [Phase 2 and Phase 3](../migration/implementation-plan.md).
- Runtime code, Wrangler bindings, credentials, production data, deploys and cutover are unchanged by this ADR.

## References

- [D1 capacity and suitability assessment](../database/d1-capacity-assessment.md)
- [MongoDB to authoritative relational mapping](../database/mongo-to-relational-mapping.md)
- [Data migration tooling requirements](../migration/data-migration-tooling.md)
- [Repository-specific migration implementation plan](../migration/implementation-plan.md)
- [Phase 0 decision request](../cloudflare-migration/decision-request.md)
