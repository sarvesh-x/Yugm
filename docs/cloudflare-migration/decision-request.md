# Cloudflare migration Phase 0 decision request

**Date:** 2026-11-22  
**Status:** DCR-1 is complete (Option A; owner-confirmed rotation, tracked cleanup pushed in `d4b0510`, deployment succeeded with strict CI active). DCR-2 was answered by the owner on 2026-11-22 ([ADR-0001](../decisions/0001-d1-and-r2-target.md)). DCR-3 decision gate completed 2026-11-23 ([ADR-0002](../decisions/0002-staged-hybrid-realtime-protocol.md)), DCR-4 decision gate completed 2026-11-23 ([ADR-0005](../decisions/0005-r2-media-cutover.md)), and DCR-5 plan acceptance plus one-time commit/push authorization completed 2026-11-23 ([ADR-0006](../decisions/0006-implementation-plan-acceptance.md)). DCR-2 detailed inputs and runtime implementation gates remain open. Capacity metrics, Workers Paid, backup/restore and cutover remain mandatory gates. Provisioning and data migration are not authorized.

## Purpose

Phase 0 audits and planning are complete ([report](phase0-report.md)). Five gates prevent Phase 1 from starting. This brief consolidates them into one actionable request with the exact inputs, options and approvals needed. Respond to each gate with a selected option and any constraints; decisions will then be recorded as ADRs under `docs/decisions/` and applied to the [implementation plan](../migration/implementation-plan.md) and [progress tracker](../../MIGRATION_PROGRESS.md).

## 1. Decision summary

| ID | Decision | Why it is blocked | Blocks |
|---|---|---|---|
| DCR-1 | Remediate tracked plaintext Worker credentials | **Complete** ([ADR-0003](../decisions/0003-credential-remediation-approach.md)): owner rotation confirmed, cleanup pushed in `d4b0510`, deployment succeeded with strict CI active | DCR-2/DCR-3/DCR-4 inputs, recovery gates, and cutover approvals |
| DCR-2 | Choose authoritative database: D1 vs PostgreSQL/Hyperdrive | **Resolved:** owner selected D1 ([ADR-0001](../decisions/0001-d1-and-r2-target.md)); capacity metrics and Workers Paid still gate rehearsal/cutover | Schema generation unblocked as a draft; production migration still gated |
| DCR-3 | Choose realtime protocol path | **Decision gate complete** ([ADR-0002](../decisions/0002-staged-hybrid-realtime-protocol.md)): Option C, 90-day support window, hibernation required, 83-name inventory accepted, BONDS emitter chosen | Runtime adapter/native DO implementation and two-path cutover approvals |
| DCR-4 | Fix and scope R2 media cutover | **Decision gate complete** ([ADR-0005](../decisions/0005-r2-media-cutover.md)): Option B, five existing buckets, public variants/private originals, owner/resource-admin/accepted-participant access, explicit per-env CORS | R2 provisioning, exact production origin, wiring fixes, admin tooling and phased category cutover approvals |
| DCR-5 | Accept the phased implementation plan and authorization boundaries | **Accepted** ([ADR-0006](../decisions/0006-implementation-plan-acceptance.md)) with one-time commit/push authorization for current local slices | Future commit/push, deploy, provisioning, data work |

## 2. DCR-1 — Tracked Worker credentials

**Finding (remediated):** `backend-server/apps/cloudflare-worker/wrangler.jsonc` previously contained plaintext credential-bearing `vars` (database, cache, JWT/admin, LiveKit, payments and related secrets). After owner-confirmed rotation on 2026-11-23 those keys were removed without exposing values; strict CI was committed in `d4b0510`, pushed and confirmed passing on deployment. Full evidence: [tracked Worker credentials finding](../infrastructure/tracked-worker-credentials-finding.md).

**Risk:** Anyone with repository or history read access may have usable credentials. Test labels are not evidence that values are harmless.

**Options:**

| Option | Meaning | Consequence |
|---|---|---|
| A (recommended) | Rotate/revoke every value at its provider, remove them from the tracked file, use ignored `.dev.vars*` locally and Wrangler secrets/secret manager per environment, then add a CI secret-scanning gate | Requires provider access; staging/prod credentials must differ; no shared history rewrite |
| B | Same as A plus a coordinated Git history scrub | Requires explicit authorization and coordination with everyone holding clones; do not start unilaterally |
| C | Keep values but restrict repository access | Not acceptable: does not remove exposure and does not satisfy the project's no-secrets-in-source rule |

**Approval recorded:** Option A, owner-confirmed rotation/revocation on 2026-11-23, and local instruction to remove tracked values and add ignore rules. No history rewrite was selected.

**Completed:** values removed without reproducing them, ignore rules verified/added, finding and ADR updated, CI switched to `secrets:check:strict`, cleanup committed/pushed in `d4b0510`, and owner confirmed deployment succeeded with strict CI active. No history was rewritten.

## 3. DCR-2 — Authoritative database decision (resolved: D1)

**Owner decision (2026-11-22):** Option A, D1 for all authoritative relational state, with R2 as the only binary store and MongoDB retired from the target architecture. Recorded in [ADR-0001](../decisions/0001-d1-and-r2-target.md). The selection permits local schema/tooling drafts; it does not by itself pass the capacity or recovery gates below.

**Why it was blocked:** D1 has a hard 10 GB per-database limit, 2 MB maximum row, single-threaded throughput, 50 MB result limit, 30-second statement limit and billing tied to rows read/written. Time Travel is not an independent backup. The full assessment and threshold rules are in [the D1 capacity assessment](../database/d1-capacity-assessment.md); platform evidence is in [Cloudflare limits](../infrastructure/cloudflare-platform-limits.md). No production metrics were available in Phase 0.

**Metrics to supply** (aggregates only, stored outside public docs; no customer content, credentials or signed URLs):

| Area | Required measurement | Unit / form |
|---|---|---|
| Size | Per-collection document count, `storageSize`, `totalIndexSize`, average and maximum document size, largest embedded array/string, total database size | documents, bytes; top 10 outliers |
| Growth | 30/90/180-day growth by collection, projected 12-month size, retention/deletion policy | bytes/day and % per collection |
| Users | Registered users, MAU, DAU, peak concurrent users, sessions/day, device/session counts | counts |
| Messages | Messages/day, peak messages/s, rooms/conversations, participants per room, retained history window | counts and seconds |
| Writes | Inserts/updates/deletes per collection per day and at peak, including reactions, presence, typing and read receipts | ops/s and ops/day |
| Finance | Wallet adjustments, purchases, gifts, payouts, refunds/day, peak financial writes/s, journal rows per account | counts and ops/s |
| Media | Media records by purpose/visibility, bytes referenced, temporary upload sessions, quota-reservation churn, orphan candidates | counts and bytes |
| Admin | Asset versions, cosmetics, bundles, badges, achievements, catalog entries, audit-log rows, retention | counts |
| Queries | Top queries by frequency and rows scanned, current indexes, slow query durations, full collection scans | query text pattern + counts + ms |
| Transactions | Multi-document transactions per minute and their collection/document footprint | txn/min + doc count |
| Recovery | Backup frequency, restore RPO/RTO, Time Travel suitability, audit-log retention | duration and policy |

**Decision rules (from the assessment, unchanged):** choose D1 only if the relational dataset plus indexes and 12-month projection fit comfortably under 10 GB, no row needs more than 2 MB after binaries move to R2, peak writes fit measured single-database throughput with substantial headroom, indexed queries stay well below 30 s and 50 MB, recovery objectives can be met with exports plus Time Travel and a rehearsed restore, and Workers Paid is approved. If any check fails, use PostgreSQL through Hyperdrive. Financial state must stay atomic in one database in either case; splitting the ledger is not an option.

**Options:**

| Option | Meaning | Consequence |
|---|---|---|
| A | D1 for all authoritative relational state | Generates D1 schema + batch importer; requires Workers Paid and strict row/query discipline; must pass capacity gates above |
| B (fallback if any gate fails) | PostgreSQL via Hyperdrive | Generates Postgres schema + importer; origin database provider and its billing/operations apply |
| C | Defer again | Phase 0 remains open; no schema or importer is generated |

**Owner selection:** A (D1), recorded in [ADR-0001](../decisions/0001-d1-and-r2-target.md). **Still required before production use:** the metrics above, Workers Paid confirmation, a reviewed schema, backup/restore rehearsal and destructive-operation approval. If any D1 capacity check fails, the ADR must be revisited and Option B re-evaluated.

**Local input preparation (2026-11-23):** `npm run capacity:intake -- --template` generates the blank metrics file; `npm run capacity:intake -- --input <metrics.json>` checks completeness and then screens supplied aggregates against documented D1 hard limits. It reports five review items that stay open for owner judgment. Neither command collects metrics or accesses a production system. `npm run capacity:projection -- --before <dir> --after <dir> --metrics <metrics.json>` cross-checks the declared 12-month projection against observed snapshot byte growth, `npm run capacity:queries -- --input <observations.jsonl>` screens captured query shapes against D1 limits, `npm run capacity:billing -- --queries <observations.jsonl> --metrics <metrics.json>` estimates rows read/written and storage against Paid inclusions, `npm run capacity:recovery -- --verification <report.json> --rehearsal <dir> --attestation <attestation.json>` checks recovery evidence completeness without performing a restore, and `npm run capacity:status -- ...` aggregates all local reports plus owner attestations into one readiness checklist. See [the capacity assessment](../database/d1-capacity-assessment.md#local-hard-limit-screening-input-preparation-not-acceptance) for the input shape and interpretation.

## 4. DCR-3 — Realtime protocol path

**Current state:** Android and the Worker prototype use Socket.IO/Engine.IO 4. The experimental bridge uses non-hibernating DO WebSockets, Engine.IO internals and has incomplete restart recovery; it is not a production design. Full evidence: [realtime plan](../migration/realtime-plan.md), [Worker prototype audit](../infrastructure/worker-prototype-audit.md) and [Android audit](../architecture/android-source-audit.md).

**Options:**

| Option | Meaning | Consequence |
|---|---|---|
| A | Compatibility adapter: preserve Socket.IO/Engine.IO wire protocol behind a tested DO adapter | Minimal Android/admin change; must reproduce handshake, auth, rooms, acks, heartbeats, reconnection and idempotent delivery; hibernation may be constrained; non-hibernating cost accepted |
| B | Versioned native DO WebSocket protocol with dual publish during a client migration window | Enables hibernation, explicit event IDs/dedupe and recovery cursors; requires Android/admin changes and a support window |
| C | Staged hybrid: compatibility adapter for legacy clients, native protocol for new clients | Highest short-term complexity; requires a clear cutoff date and dual-test matrix |

**Owner inputs recorded 2026-11-23:** 90-day legacy support window after native GA; hibernation/cost reduction is a hard requirement; source-verified [event inventory](../migration/realtime-event-inventory.md) accepted as the 83-name baseline; server emits `BONDS` in `sync:invalidate` for `/api/bonds/*` mutations. The first BONDS emitter slice is local and uncommitted.

**Implementation still required:** compatibility adapter, native hibernating DO protocol, Android/admin client migration, cutoff-date record, and dual-path compatibility suite. No protocol is treated as interchangeable without that suite.

## 5. DCR-4 — Media cutover scope and R2 environment

**Current state:** decision gate complete under [ADR-0005](../decisions/0005-r2-media-cutover.md). The R2 foundation still covers avatar only; it is not provisioned or deployed. `ProfileDetailScreen` does not consume progress or cancel, and failed uploads leave quota reservations until TTL with no sweeper. Full context: [Phase 0 report](phase0-report.md) and [Android audit](../architecture/android-source-audit.md).

**Owner decisions recorded 2026-11-23:** Option B phased cutover; five existing bucket names and server-derived keys; public variants with private originals/staging; private access for media/resource owner, resource admins and accepted participants only; explicit per-environment domains/CORS with no wildcard production origin; agent stages local admin tooling and value-free config guards while provider credentials remain owner-controlled.

**Still required for provisioning:** exact production origin/CORS values, R2 account/bucket provisioning, secret-store setup, owner-approved media inventory export, and authorization for each category cutover.

**Local tooling added 2026-11-22 (input preparation, not a decision):** `npm run inventory:media -- --input <records.jsonl>` in `apps/api` builds a read-only inventory from an exported MediaObject-shaped JSONL file. It reports counts and bytes by category, bucket, visibility, owner type, media type, bucket×visibility, processing/moderation status, variant storage, duplicate storage keys and a stable digest. It never reads MongoDB or R2 and deliberately does not assert a public/private bucket policy, since that policy is still an owner decision. The MediaObject inventory itself does **not** supply legacy `/uploads` URL coverage, because those files are not fully represented in MediaObject. A companion read-only scanner added 2026-11-23, `npm run inventory:legacy-media -- --input <records.jsonl>` or `--snapshot <directory>`, counts source-verified legacy public/private URL forms, inline data URLs, badge-art routes and managed upload endpoints from exported records or a copied snapshot; it emits URL digests and field paths only, never raw URLs. It does not verify that binaries still exist. Neither tool fulfills the media backup requirement in [BACKUP_AND_RECOVERY.md](../migration/BACKUP_AND_RECOVERY.md); that remains open. An owner-approved export is still required before real numbers can be produced.

**Source-backed authorization audit (2026-11-23):** [private-media-authorization.md](../migration/private-media-authorization.md) records the current `MediaObject` download rules and the latent room/clan gap: non-owner `PRIVATE` access is implemented only for `ownerType=MESSAGE` direct-message participants; `ROOM`, `CLAN` and other owner types are denied. It also documents the public-only legacy `/uploads` path and the admin-only trust-verification/asset-staging routes. No policy was chosen; owner definitions for room/clan participant rules are needed before any private media category cutover.

**Options:**

| Option | Meaning | Consequence |
|---|---|---|
| A | Extend avatar-only slice; fix wiring and add the sweeper before any new category | Smallest change; other categories stay on legacy paths |
| B (selected) | Phased category cutover after provisioning and fixes | Each category gets its own validation and rollback gate; follows [implementation plan Phase 4](../migration/implementation-plan.md) |
| C | Full cutover in one phase | Highest risk: private-media semantics and admin tooling are not yet defined |

**Decision recorded:** A/B/C selection, bucket naming, visibility policy, private-access policy and tooling ownership are recorded in ADR-0005. **Still requiring approval:** R2 provisioning, exact production domain/CORS values, media deletion/archive policy, and each production media-category cutover. No credentials or domains are created by the decision.

## 6. DCR-5 — Plan acceptance and authorization boundaries

**Response recorded 2026-11-23:** the owner accepted the repository-specific [implementation plan](../migration/implementation-plan.md) as the execution sequence, with the dependency chain and per-phase exit gates unchanged, and authorized one commit/push of the current local slices. See [ADR-0006](../decisions/0006-implementation-plan-acceptance.md).

| Action | Authorization standing |
|---|---|
| Documentation, static audit, local dry run | Permitted now under [ADR-0004](../decisions/0004-local-code-and-tests-authorization.md) |
| Local code changes with no production data or credentials | Permitted now under DCR-5; runtime wiring, provisioning and data work remain gated |
| Cloudflare resource provisioning, paid plan/domains/DNS | Separate explicit approval per resource |
| Credential rotation, secret-store change, history rewrite | DCR-1 selection and provider access |
| Production snapshot export, transform, import, migration | Separate explicit approval after backup/restore rehearsal |
| Deploy, DNS cutover, release, destructive production change | Separate explicit approval each time |
| Commit / push | DCR-5 grants one-time explicit authorization for the current local slices only. Previously authorized commits: `4af0b0d`, `d4b0510`. Future commits require new approval |

## 7. Owner response template

Copy this block and fill it in. Each answer becomes an ADR; nothing is inferred from silence.

```text
DCR-1 credential remediation: A / B / C ; secret-store owner: ____ ; history decision: ____
DCR-2 database: D1 (selected 2026-11-22, ADR-0001) ; metrics attached: yes/no ; Workers Paid: yes/no ; capacity gates passed: yes/no
DCR-3 realtime: A / B / C ; old-client support window: ____ ; hibernation required: yes/no ; event inventory accepted: yes/no
DCR-4 media scope: B (recorded 2026-11-23) ; buckets: five existing names ; domains/CORS: explicit per-env, production origin pending ; private-media rule: owner/resource-admin/accepted-participant ; admin tooling owner: agent stages locally
DCR-5 plan acceptance: accepted 2026-11-23 ; commit authorization: one-time for current local slices (ADR-0006)
```

## 8. Next action after responses

1. Record each remaining decision as an ADR under `docs/decisions/` and link it from `docs/INDEX.md`. DCR-2 is already recorded in [ADR-0001](../decisions/0001-d1-and-r2-target.md).
2. Update `docs/database/d1-capacity-assessment.md`, `docs/migration/realtime-plan.md` and the [implementation plan](../migration/implementation-plan.md) with the chosen options and any changed gates.
3. Update [MIGRATION_PROGRESS.md](../../MIGRATION_PROGRESS.md) and `docs/CURRENT_TASK.md`; close Phase 0 only when all exit gates are met.
4. Begin Phase 1 only after the valid approvals above are in place. Until then, no implementation work starts.

## 9. Recorded owner responses (2026-11-22)

| Gate | Owner response | Recorded as | Remaining |
|---|---|---|---|
| DCR-1 | "Owner rotates, I prepare" — Option A, no history rewrite | [ADR-0003](../decisions/0003-credential-remediation-approach.md) | Provider rotation, removal from tracked config, strict CI gate |
| DCR-2 | D1 (earlier response) | [ADR-0001](../decisions/0001-d1-and-r2-target.md) | Capacity metrics, Workers Paid, restore rehearsal |
| DCR-3 | "Hybrid bridge + native DO" — Option C; inputs closed 2026-11-23 | [ADR-0002](../decisions/0002-staged-hybrid-realtime-protocol.md) | Runtime adapter/native DO implementation, hibernation proof, dual-path suite, cutoff date |
| DCR-5 | "Local code + tests"; plan accepted 2026-11-23; one-time commit/push of current local slices | [ADR-0004](../decisions/0004-local-code-and-tests-authorization.md), [ADR-0006](../decisions/0006-implementation-plan-acceptance.md) | Future commit/push, deploy, provisioning and data work |
| DCR-4 | Option B and policy recorded 2026-11-23 | [ADR-0005](../decisions/0005-r2-media-cutover.md) | R2 provisioning, production origin/CORS, wiring fixes, admin tooling and category cutover approvals |

Nothing is inferred from silence. DCR-4 is recorded in ADR-0005 and DCR-5 in ADR-0006. Provisioning values, runtime implementation and all production actions remain gated before later phases can start.
