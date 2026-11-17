# Production blueprint: repository baseline

Audit date: 17 November 2026. Application baseline: `300826a` on `master`.

The supplied [Yugm Production Implementation Blueprint v1.0](blueprint-v1.md) is a proposed engineering backlog. This directory records the first repository audit; it does **not** certify production readiness or implement the blueprint. No application behavior, production configuration, datastore, provider, or deployment was changed for this audit.

## Evidence and scope

- [Requirement matrix](requirement-matrix.md): source coverage, existing safeguards, and missing verification.
- [Finding register](findings.md): prioritized, reproducible code paths and proposed remediation.
- [Architecture and operations](architecture.md): boundaries, entry points, schemas, environment, and rollout constraints.
- [Implementation sequence](implementation-sequence.md): bounded first packages and their exit gates.
- [HTTP inventory](endpoint-inventory.csv): mounted method/path, route source/line, and syntactically visible middleware.
- [Socket inventory](socket-inventory.csv): event/middleware registrations and source/line.
- [Schema inventory](schema-inventory.csv): field declarations and explicit schema indexes; not a live database report.

Rebuild static inventories from `backend-server`:

```powershell
node scripts/production-inventory.cjs
```

The generator parses TypeScript syntax without importing the application, reading environment files, or opening network connections. Initial scan: 201 non-test API source files; 566 HTTP entries; 11 socket registrations; 939 schema declarations. HTTP entries include application handlers and mounted router declarations, including overlapping/legacy paths. They are not necessarily 566 independently reachable commands: Express middleware order and shadowing require review.

Inventory columns marked `NOT VERIFIED` are deliberate. Visible auth middleware does not prove resource authorization, transaction correctness, idempotency, or retry safety. The scanner handles direct string-literal routes/mounts and default router imports; generated/dynamic registrations and external infrastructure require separate inspection. Static assets, webhooks, jobs, and admin tools are described in the architecture file.

## Most urgent findings

1. **GIFT-001 / GIFT-002:** authenticated gift routes can charge caller-supplied third parties or transfer their inventory without consent.
2. **WALLET-001:** invalid ledger source values reach callers that mutate balances outside transactions before ledger validation.
3. **GIFT-003:** two senders using the same key can collide on a receiver credit even though their gift transfers are distinct.
4. **EVENT-001:** the router mount produces `/api/events/events`, while Android requests `/api/events`.
5. **CHAT-001 / AND-001:** durable client operation identity and an Android pending-message store are absent; failed/uncertain sends can duplicate or be lost from local pending state.

These are source-level findings. No live exploit, production data divergence, or real-datastore race was executed or claimed. P0 classification reflects the affected authorization/accounting invariant, not measured incident frequency.

## Verification boundary

For this audit the inventory generator and artifact consistency checks were run locally. Application tests/builds were not rerun because this change contains only documentation and a static inventory utility. Builds/typechecks from earlier work are not evidence that the blueprint's failure/race scenarios pass.

No non-production Mongo replica set or provider sandbox was identified for running integration tests. The bundled Compose Mongo service is standalone and does not establish transaction support. Live Mongo topology/indexes/data quality, deployment state, production logs, backup/restore, RTC connectivity, provider reconciliation, and device/process-death behavior remain `NOT VERIFIED`.

**M0 remains PARTIAL:** repository discovery has useful evidence; an isolated integration environment, measured baseline, data-quality queries, complete command policy review, and owner decisions are outstanding. No later milestone is declared complete.

The repository declares deployment on master pushes in both `render.yaml` and `.github/workflows/deploy.yml`. Publishing source can therefore cause a production deployment independently of APK publishing. This audit has been kept local. The user's existing no-APK-release preference remains in force.
