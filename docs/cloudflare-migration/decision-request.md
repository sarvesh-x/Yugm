# Cloudflare migration Phase 0 decision request

**Date:** 2026-11-22  
**Status:** DCR-2 resolved by the owner on 2026-11-22 as **D1** and recorded in [ADR-0001](../decisions/0001-d1-and-r2-target.md). DCR-1 and DCR-3 through DCR-5 remain open. This is documentation only — no credential, infrastructure, deploy or data change is authorized by this file. Capacity metrics, Workers Paid, backup/restore and cutover remain mandatory gates despite the database selection.

## Purpose

Phase 0 audits and planning are complete ([report](phase0-report.md)). Five gates prevent Phase 1 from starting. This brief consolidates them into one actionable request with the exact inputs, options and approvals needed. Respond to each gate with a selected option and any constraints; decisions will then be recorded as ADRs under `docs/decisions/` and applied to the [implementation plan](../migration/implementation-plan.md) and [progress tracker](../../MIGRATION_PROGRESS.md).

## 1. Decision summary

| ID | Decision | Why it is blocked | Blocks |
|---|---|---|---|
| DCR-1 | Remediate tracked plaintext Worker credentials | Rotation, source removal and history decisions require owner authorization and provider access | All Cloudflare work |
| DCR-2 | Choose authoritative database: D1 vs PostgreSQL/Hyperdrive | **Resolved:** owner selected D1 ([ADR-0001](../decisions/0001-d1-and-r2-target.md)); capacity metrics and Workers Paid still gate rehearsal/cutover | Schema generation unblocked as a draft; production migration still gated |
| DCR-3 | Choose realtime protocol path | Compatibility vs native protocol has different client and cost consequences | Phase 5; affects Phase 3/7 contracts |
| DCR-4 | Fix and scope R2 media cutover | Buckets/domains/CORS/policies and private-media semantics are unconfirmed; Android wiring gap exists | Phase 4 |
| DCR-5 | Accept the phased implementation plan and authorization boundaries | No explicit plan acceptance yet | Phase 1 onward |

## 2. DCR-1 — Tracked Worker credentials

**Finding:** `backend-server/apps/cloudflare-worker/wrangler.jsonc` is tracked by Git, is not ignored, and contains plaintext credential-bearing `vars` (database, cache, JWT/admin, LiveKit, payments and related secrets). Values are deliberately not reproduced. Full evidence: [tracked Worker credentials finding](../infrastructure/tracked-worker-credentials-finding.md).

**Risk:** Anyone with repository or history read access may have usable credentials. Test labels are not evidence that values are harmless.

**Options:**

| Option | Meaning | Consequence |
|---|---|---|
| A (recommended) | Rotate/revoke every value at its provider, remove them from the tracked file, use ignored `.dev.vars*` locally and Wrangler secrets/secret manager per environment, then add a CI secret-scanning gate | Requires provider access; staging/prod credentials must differ; no shared history rewrite |
| B | Same as A plus a coordinated Git history scrub | Requires explicit authorization and coordination with everyone holding clones; do not start unilaterally |
| C | Keep values but restrict repository access | Not acceptable: does not remove exposure and does not satisfy the project's no-secrets-in-source rule |

**Approval required:** explicit authorization to (1) rotate/revoke each provider credential, (2) edit the tracked config to remove values and add ignore rules, (3) choose A or B, and (4) confirm who owns the secret store and provider accounts.

**After approval I will:** remove values without reproducing them, add ignore rules, update the finding with actions actually performed, and add the CI secret-scanning gate. I will not rewrite history unless option B is explicitly selected.

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

## 4. DCR-3 — Realtime protocol path

**Current state:** Android and the Worker prototype use Socket.IO/Engine.IO 4. The experimental bridge uses non-hibernating DO WebSockets, Engine.IO internals and has incomplete restart recovery; it is not a production design. Full evidence: [realtime plan](../migration/realtime-plan.md), [Worker prototype audit](../infrastructure/worker-prototype-audit.md) and [Android audit](../architecture/android-source-audit.md).

**Options:**

| Option | Meaning | Consequence |
|---|---|---|
| A | Compatibility adapter: preserve Socket.IO/Engine.IO wire protocol behind a tested DO adapter | Minimal Android/admin change; must reproduce handshake, auth, rooms, acks, heartbeats, reconnection and idempotent delivery; hibernation may be constrained; non-hibernating cost accepted |
| B | Versioned native DO WebSocket protocol with dual publish during a client migration window | Enables hibernation, explicit event IDs/dedupe and recovery cursors; requires Android/admin changes and a support window |
| C | Staged hybrid: compatibility adapter for legacy clients, native protocol for new clients | Highest short-term complexity; requires a clear cutoff date and dual-test matrix |

**Inputs needed:** old-client support window (which installed Android versions must keep working), whether hibernation/cost reduction is a hard requirement, owner sign-off on the source-verified [event inventory](../migration/realtime-event-inventory.md) (47 shared events + 16 PK events plus literal events absent from the catalog), and the Android `BONDS` topic mismatch decision.

**Approval required:** selection of A/B/C, the client support window, and acceptance of the corresponding DO cost model. No protocol is treated as interchangeable without a compatibility suite.

## 5. DCR-4 — Media cutover scope and R2 environment

**Current state:** the uncommitted R2 foundation covers avatar only; it is not provisioned or deployed. `ProfileDetailScreen` does not consume progress or cancel, and failed uploads leave quota reservations until TTL with no sweeper. Full context: [Phase 0 report](phase0-report.md) and [Android audit](../architecture/android-source-audit.md).

**Environment inputs needed:** bucket names and account, custom domains and CDN policy, CORS origin allowlist, public/private visibility policy, credential owner and secret store, media inventory (categories, counts, bytes, legacy URLs), room/clan private-media participant rules, and who owns the missing admin media/registry/quota tooling.

**Options:**

| Option | Meaning | Consequence |
|---|---|---|
| A | Extend avatar-only slice; fix wiring and add the sweeper before any new category | Smallest change; other categories stay on legacy paths |
| B (recommended) | Phased category cutover after provisioning and fixes | Each category gets its own validation and rollback gate; follows [implementation plan Phase 4](../migration/implementation-plan.md) |
| C | Full cutover in one phase | Highest risk: private-media semantics and admin tooling are not yet defined |

**Approval required:** environment inputs above, selection of A/B/C, R2 provisioning and bucket policies, custom domain/CORS approval, media deletion/archive policy, and authorization for any production media change. No credentials or domains are created here.

## 6. DCR-5 — Plan acceptance and authorization boundaries

**Request:** accept the repository-specific [implementation plan](../migration/implementation-plan.md) as the execution sequence, with the dependency chain and per-phase exit gates unchanged, and confirm the authorization boundaries below.

| Action | Authorization standing |
|---|---|
| Documentation, static audit, local dry run | Permitted now |
| Local code changes behind flags, with no production data or credentials | Requires DCR-1 through DCR-4 resolved and plan acceptance |
| Cloudflare resource provisioning, paid plan/domains/DNS | Separate explicit approval per resource |
| Credential rotation, secret-store change, history rewrite | DCR-1 selection and provider access |
| Production snapshot export, transform, import, migration | Separate explicit approval after backup/restore rehearsal |
| Deploy, DNS cutover, release, destructive production change | Separate explicit approval each time |
| Commit / push | Explicit authorization required; none has been given |

## 7. Owner response template

Copy this block and fill it in. Each answer becomes an ADR; nothing is inferred from silence.

```text
DCR-1 credential remediation: A / B / C ; secret-store owner: ____ ; history decision: ____
DCR-2 database: D1 (selected 2026-11-22, ADR-0001) ; metrics attached: yes/no ; Workers Paid: yes/no ; capacity gates passed: yes/no
DCR-3 realtime: A / B / C ; old-client support window: ____ ; hibernation required: yes/no ; event inventory accepted: yes/no
DCR-4 media scope: A / B / C ; buckets/domains/CORS: ____ ; private-media rule: ____ ; admin tooling owner: ____
DCR-5 plan acceptance: accept / changes requested (list) ; commit authorization: yes/no
```

## 8. Next action after responses

1. Record each remaining decision as an ADR under `docs/decisions/` and link it from `docs/INDEX.md`. DCR-2 is already recorded in [ADR-0001](../decisions/0001-d1-and-r2-target.md).
2. Update `docs/database/d1-capacity-assessment.md`, `docs/migration/realtime-plan.md` and the [implementation plan](../migration/implementation-plan.md) with the chosen options and any changed gates.
3. Update [MIGRATION_PROGRESS.md](../../MIGRATION_PROGRESS.md) and `docs/CURRENT_TASK.md`; close Phase 0 only when all exit gates are met.
4. Begin Phase 1 only after the valid approvals above are in place. Until then, no implementation work starts.
