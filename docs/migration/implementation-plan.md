# Yugm behavior-preserving Cloudflare migration on a $0 budget

**Updated:** 2026-11-26

**Status:** Active 18-phase plan for local work and isolated validation under the owner's behavior-preservation directive. The [$0 budget decision](../decisions/0008-zero-spend-cloudflare-migration.md) still governs activation. Provider activation, production data access, cutover and removal have separate approvals.

## Target and starting point

Use D1 for the production data target on Workers Free. Move Redis workloads to purpose-specific Cloudflare bindings, BullMQ to Queues and Cron, and LiveKit to RealtimeKit after establishing a $0 usage envelope. Use R2 Standard for media within its included allowance. The staging Worker wraps the legacy Express/Mongoose API, and the production target uses the shared D1 Worker. D1 tooling, native WebSocket harnesses and R2 media code are starting points for the remaining routes. Retain Firebase Auth, App Check, FCM and existing payment behavior.

Preserve logical fields, IDs, defaults, validation, relationships, API and event contracts, business effects and the existing Android/admin journeys. Use repository and infrastructure adapters around existing rules. Record storage-level differences and suspected bugs explicitly. A quota conflict blocks the affected production switch and leaves the existing behavior on its current path. Disabling features or substituting a reduced launch is a separate product decision.

## Journey order

The owner set the execution order below. Complete the local contract work for the active journey before starting the next. Apply the relevant technical gates within each journey. Record production-only blockers separately so local verification never implies rollout approval. Earlier Arcade, push and direct-message work remains evidence to reuse when its journey is reached.

| Order | Journey | Preservation checks |
| --- | --- | --- |
| 1 | **Authentication** | Firebase sign-in and account linking, email verification, App Check, access and refresh sessions, sign-out and device revocation. Preserve the authenticated account ID and the profile-completion signal. |
| 2 | **Navigation** | Signed-out and signed-in startup, incomplete-profile routing, all five roots and bottom-dock visibility, deep links, back stack and session restoration. [Navigation architecture](../NAVIGATION_ARCHITECTURE.md) |
| 3 | **Profile** | Profile setup and editing, validation, server-confirmed completion, avatar progress/cancel, public/private fields and profile invalidation. |
| 4 | **Settings** | Preference and privacy persistence, notification settings, account verification and scoped security/account actions. |
| 5 | **Chat** | Conversation visibility, send/history/read, mute/block, attachments and delivery through the supported legacy and native transports. Reuse the existing direct-message and push fixtures. |
| 6 | **Rooms** | Discovery-to-join, permissions, seats, presence, voice/video, moderation, reconnect and PK lifecycle. |
| Later | **Remaining journeys** | Order the remaining social, media, progression, commerce and admin journeys by their dependencies after the six above. Arcade writes are mounted on the local D1 Worker; receiving-client realtime remains open. |

The Rooms journey now includes all 22 PK patterns verified with local D1 fixtures: eight reads and 14 writes, including the final invite, auto-match, end, rematch, vote, send-gift and reactions paths. Active-battle job ending and PK socket fan-out stay legacy boundaries; deadline recovery runs from the D1 PK alarm. Do not treat the PK lifecycle as migrated until receiving-client fan-out, durable rate limiting, reconciliation and live acceptance have D1-compatible evidence. Direct cover, profile-media, story, voice-note, recording, avatar and trust-verification uploads are mounted as bounded R2/registry slices with owner/category version allocation; the avatar route also commits the authoritative profile fields and clears the prior object, and the trust route keeps private owner-prefixed delivery. Managed `COVER` sessions and live Android upload QA remain open. [Cover upload evidence](handoffs/2026-11-26-d1-cover-upload.md) · [Profile-media and story evidence](handoffs/2026-11-26-d1-profile-media-and-story-uploads.md) · [Audio upload evidence](handoffs/2026-11-26-d1-voice-note-and-recording-uploads.md) · [Avatar upload evidence](handoffs/2026-11-26-d1-avatar-upload.md) · [Private media evidence](handoffs/2026-11-26-d1-trust-verification-media.md) · [PK write evidence](handoffs/2026-11-26-d1-pk-writes.md) · [PK accept/start/ready evidence](handoffs/2026-11-26-d1-pk-accept-start-ready.md) · [PK writes completion evidence](handoffs/2026-11-26-d1-pk-writes-completion.md) · [PK deadline alarm evidence](handoffs/2026-11-26-d1-pk-deadlines.md)

## Phase gates

Apply the phases in order to each affected slice, following the journey sequence above. A local slice can progress while an unrelated production gate is open. Record fixture, command, observed result and evidence before closing any gate. The [gate tracker](MIGRATION_PROGRESS.md) links the source-backed baseline and current evidence.

| Phase | Deliverable | Evidence required to advance |
| --- | --- | --- |
| 0. Repository baseline | Model, rule, user-flow, API, event and dependency registries. | Source references and an affected-slice baseline. Unknown or divergent behavior recorded for resolution. |
| 1. Characterization | Repeatable legacy fixtures for exposed behavior, errors, persisted effects, events and ordering. | Actual legacy path exercises the contract before its provider changes. |
| 2. Adapter boundary | Minimal repository or transport seam reusing existing domain services. | Same contract suite can exercise the old and new implementation. |
| 3. D1 mapping | Field-by-field source to SQLite mapping, including relationships and reversible physical translations. | No unexplained changes to IDs, fields, validation, default/null behavior, serialization or relationships. |
| 4. D1 data | Deterministic export, transform, resumable import, reconciliation and final sync. | Counts, critical relationship and financial records, rejects and final deltas reconcile with a verified restore. |
| 5. Worker backend | Existing API contracts behind Worker-compatible infrastructure. | Same fixture produces equivalent HTTP, data, events and notification outcomes. Worker bundle and startup checks pass. |
| 6. Firebase | Original identity project, token verification, App Check, sessions and FCM. | Supported provider and recovery journeys work on Workers and Android. Existing users and IDs persist across repeated sign-in. |
| 7. R2 media | Category-specific compatible media resolver and upload/publication paths. | Existing media display, privacy and current upload flow pass end to end within a tested $0 envelope. |
| 8. Redis and sessions | Semantic replacements for cache, limits, presence, state and coordination. | Existing expiration, visibility, atomicity, rate limit and failure behavior verified. |
| 9. App realtime | Hibernating scoped DO WebSockets with staged legacy compatibility. | Both actual transports pass event and message parity, authorization, replay and dedupe under DCR-3. |
| 10. Voice and video | Provider-neutral RTC and Cloudflare RealtimeKit candidate. | Release-device room, media, reconnect and moderation parity under a tested $0 envelope. |
| 11. Background jobs | Queues/Cron or alarms, durable dispatch status, retries and recovery. | Local and isolated staging tests cover duplicates, enqueue failure, partial FCM results, expiry, replay and terminal failures. |
| 12. Financial and inventory | Existing wallet, purchase, gift, reward and ownership rules using atomic persistence. | Idempotency, parallel writes, refunds, insufficient balance and inventory equivalence hold with one authoritative writer. |
| 13. Admin and assets | Admin and asset infrastructure adapters. | Same authorized actions and resulting publication, prices, version/ownership and rendering effects. |
| 14. User-flow regression | Run all [required journeys](USER_FLOW_REGISTRY.md) on the existing and migrated systems. | Critical Android and admin journeys pass with supported devices, network failure and restart behavior. |
| 15. Staging and cutover | Isolated migration rehearsal, final-sync and rollback plan. | Quota/load, verified backups and restore, old/new behavior, data reconciliation and explicit cutover authorization. |
| 16. Legacy cleanup | Retire approved dependencies only after their last supported consumer is gone. | Check app/Worker bundles and deployments, installed-client window, rollback retention and explicit removal approval. |
| 17. Final acceptance | Publish model, business, UI, API, data, infrastructure, security and removal evidence plus deployment, rollback and limitations docs. | Review evidence and remaining blockers. No unexplained losses or behavior changes, and the activated services run within the approved $0 envelope. |

## Free limits and application behavior

These are provider ceilings checked on 2026-11-23. Size each pilot against **remaining account capacity**, including other environments. Use conservative pilot limits below the provider ceilings and revise them only after measuring actual use. Reset counters on the provider's quota windows, including midnight UTC for daily quotas.

| Service | Published allowance or cost | Behavior to verify |
| --- | --- | --- |
| Workers Free | 100,000 requests/day and 10 ms CPU per HTTP request. | Bound request work and pagination. Test cold starts, actual CPU and quota errors. Stop raising rollout traffic when headroom disappears. [Limits](https://developers.cloudflare.com/workers/platform/limits/) |
| D1 Free | 500 MB per database, 5 GB across the account, 5 million rows read/day, 100,000 rows written/day and 50 D1 queries per Worker invocation. | Reserve capacity for essential writes. Pause discretionary jobs and admissions early. At exhaustion, surface a retryable failure and avoid claiming a commit. [Limits](https://developers.cloudflare.com/d1/platform/limits/) · [Pricing and enforcement](https://developers.cloudflare.com/d1/platform/pricing/) |
| SQLite Durable Objects | 100,000 requests/day, 13,000 GB-s/day, plus storage and row-operation limits. | Hibernate idle sockets, bound replay history and shed ephemeral presence/typing before durable work. Test reconnects and failure during quota exhaustion. [Pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) |
| KV Free | 100,000 key reads/day and 1,000 writes/day. | Cache public or staleness-tolerant data. Bound cache fills and origin fallback. Keep revocation, permissions, strict counters and idempotency in consistent storage. [Pricing](https://developers.cloudflare.com/kv/platform/pricing/) · [Consistency](https://developers.cloudflare.com/kv/concepts/how-kv-works/) |
| Queues Free | 10,000 operations/day and 24-hour retention. Delivery of a small message usually consumes three operations before retries. | Measure job volume, track backlog age, make consumption retry-safe and recover unfinished jobs before or after queue retention expires. [Pricing](https://developers.cloudflare.com/queues/platform/pricing/) |
| R2 Standard | 10 GB-month, 1 million Class A operations and 10 million Class B operations/month included. Overage is billable. | Start with bounded avatar usage. Count storage and all origin operations before admitting traffic. See the [R2 admission gate](#4-r2-media-within-the-included-allowance). [Pricing](https://developers.cloudflare.com/r2/pricing/) |
| Images Free | 5,000 unique transformations/month. | Verify the account's Images plan and binding behavior. Bound generated variants and test upload recovery at the transformation ceiling. [Pricing](https://developers.cloudflare.com/images/pricing/) |
| Realtime SFU/TURN | 1,000 GB/month included across both, then $0.05/GB egress. | Keep remote SFU/TURN disabled while egress exposure is unbounded. Test call limits and stop behavior before any live pilot. [Pricing](https://developers.cloudflare.com/realtime/sfu/platform/pricing/) |

Cloudflare budget alerts are delayed notifications. Documented Workers and Durable Objects spending limits cover specific products and charges, and can overshoot. Treat billing dashboards as reconciliation rather than request admission controls. [Cloudflare spending controls](https://developers.cloudflare.com/billing/manage/spend-management/) · [Budget alerts](https://developers.cloudflare.com/billing/manage/budget-alerts/)

## Workstream details

Use these implementation details when the active journey reaches each dependency. The migration tracker identifies the current journey and its evidence. DCR-2 and live rollout approvals remain separate. [Current journey](MIGRATION_PROGRESS.md)

### 1. BullMQ push notifications and scheduled maintenance

- Trace persisted notifications through `services/notifications.ts`, `enqueuePushNotification()` in `services/jobs.ts`, FCM and job readiness. The first [push retry slice](../handoffs/2026-11-23-push-delivery-retries.md) splits queue processing from the inline fallback, persists retry targets after a partial send, and uses three total attempts with a 60-second exponential backoff base on BullMQ.
- The [local Queues slice](../handoffs/2026-11-23-local-push-queues.md) records the existing persistence, preference and fan-out contract and wires an opt-in Worker producer and consumer. It keeps the BullMQ/inline default and reuses the FCM sender.
- Persist dispatch state in a SQLite Durable Object keyed by the committed notification ID, with its intended recipient in the stored job. Use bounded retry and recovery alarms and record terminal failures for replay. Local tests cover duplicate consumption, failed enqueue, partial devices and expiry via simulated elapsed time. An external send followed by a failed checkpoint can still duplicate a device push. Measure usage and validate interruption and provider behavior before staging activation.
- Move scheduled jobs individually from the existing Worker/Node scheduling paths. Preserve PK deadlines and overlap safety. A single maintenance owner runs each task during rollout to avoid duplicate state changes.

**Exit evidence.** The real producer and consumer paths preserve preferences, retry and recovery behavior. A bounded day of modeled jobs fits the operation budget with retry headroom. The production switch has separate approval and a drain/checkpoint procedure for legacy jobs.

### 2. Redis and application realtime

- Inventory each current Redis caller. Move caches to KV or Workers Cache according to staleness needs. Use SQLite Durable Objects for globally consistent limiter state where required. Treat Workers Rate Limiting as approximate per location. Keep revocation and authorization-sensitive session state in the current authoritative database until its D1 slice is validated. [Workers Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- Reuse the native protocol, SQLite Durable Object skeleton, compatibility adapter and parity harness under [DCR-3](realtime-plan.md). Start with an authorized, low-risk topic such as BONDS invalidation. Wire authenticated upgrades and scopes, authoritative commit before publish and ack, event IDs, bounded replay and hibernation. Route installed-client Socket.IO and native events from the same authoritative commit.
- Run parity across both real paths and two clients. Include denial/revocation, reconnect/restart, duplicates, ordering, replay and load. Record native GA when separately approved and start the existing 90-day legacy window then. Retire the Redis socket adapter only after its callers have migrated or the approved compatibility path runs independently of Redis.

**Exit evidence.** Every Redis use has tested replacement behavior and rollback, queues are drained, and inspection and staging verification show no remaining required Redis connection before removal.

### 3. D1 Free evaluation and data migration

**Existing local read evidence.** The normal `GET /api/games/catalog` route passed the [shared HTTP fixture](../../backend-server/apps/api/src/routes/gamesCatalog.characterization.test.ts) with MongoDB and Wrangler's local D1 binding. The [Arcade handoff](../handoffs/2026-11-23-arcade-catalog-d1-parity.md) records scope and usage. Apply D1 evaluation to the active journey. Run an isolated remote pilot only after its approval, using generated data or an approved restored copy.

**Latest local evidence.** The [user matching and private-call handoff](../handoffs/2026-11-26-d1-users-matching-and-calls.md) mounts friend-match state/cancel and private-call creation on local D1 with guarded room/DM commits. Live presence and Firebase identity deletion remain explicit boundaries, so MongoDB stays authoritative. The [AI wingman handoff](../handoffs/2026-11-26-d1-ai-wingman.md) moves ten stateless routes to a shared host-neutral generator with router-scoped auth and no provider call; D1 has no `sync:invalidate` emitter for their successful POSTs. The [trust verification handoff](../handoffs/2026-11-26-d1-trust-verification.md) mounts nine state routes with shared schemas/DTOs and guarded verification-plus-submission batches; private media stays legacy-only, the non-unique D1 user index needs imported-row reconciliation, and D1 has no `sync:invalidate` emitter for their successful POSTs.

- Derive capacity evidence from the target implementation. Measure loaded database and index footprint, indexed query plans, actual D1 row reads/writes per workflow, largest relational rows, peak throughput, latency and Worker CPU. Include indexes, retries, maintenance and reconnect traffic. Record the fixture, scenario, admitted workload, date and provenance for every value. Pilot measurements bound the tested cohort. Production size, growth and traffic remain unknown until observed.
- Use the [export CLI and local validation tooling](data-migration-tooling.md) with a disposable MongoDB or a separately approved restored copy. Existing Paid-oriented capacity tools remain useful for mapping and reconciliation, but their original readiness result cannot decide a Free launch.
- Migrate related domains behind repository boundaries in dependency order. Preserve IDs, auth checks, pagination, admin and Android contracts. Keep balances, purchases, ledger and dependent financial writes in one database transaction with database-enforced constraints and idempotency. Exercise parallel requests, replay, injected failures, refunds and verified webhook retries before proposing money traffic.
- For any existing-data switch, obtain approved representative source evidence, reconcile counts, identity, media references and financial totals, report all rejects, and rehearse backup/restore and final delta handling including deletes. Preserve a single writer during the cutover. A rollback after D1 writes requires validated reconciliation back to the prior writer, or a write freeze until state is reconciled.

**Exit evidence.** A proposed rollout has measured headroom, explicit admission limits and tested load shedding. If source evidence remains unavailable or measured usage cannot fit Free, keep existing accounts on MongoDB and record the production blocker. Use generated or separately approved restored data for isolated parity. Production D1 requires an explicit decision that revises the existing Paid-only gate and separately approves the rollout. Hyperdrive requires a separate PostgreSQL origin and stays outside the Cloudflare-native database path.

### 4. R2 media within the included allowance

Use R2 Standard conditionally, starting with an isolated avatar pilot and following [the phased media policy](../decisions/0005-r2-media-cutover.md). R2 requires checkout and can bill for excess usage. Review the actual subscription terms and account-wide usage before activation. Obtain separate provisioning approval for any billable subscription or resource. [R2 setup](https://developers.cloudflare.com/r2/get-started/) · [R2 pricing](https://developers.cloudflare.com/r2/pricing/)

1. Establish a conservative budget for bytes stored throughout the month and Class A/B operations across the account. Include originals, variants, replaced objects, staging and incomplete multipart uploads, migration backfill, list/head calls, retries, cache misses and cleanup. Reserve capacity for recovery operations and usage-data lag. Unknown or unreconciled usage keeps the R2 pilot disabled.
2. For the strict budget pilot, keep buckets private and route operations through one authenticated, quota-controlled Worker. Reserve capacity atomically before each origin operation and stop new reservations when the safe allowance is exhausted or usage accounting is unavailable. Account for all other credentials, direct links, presigned requests and background access before treating the budget as enforceable. Keep direct public R2 access and presigned uploads disabled during the pilot. Public variants can still be served through a controlled cached route. Follow the accepted access policy for originals and private media.
3. Test budget races, retry accounting, quota reset, storage already present at rollover and fail-closed behavior. Rehearse stopping both new uploads and uncached reads before the provider thresholds. Keep previously committed media references intact. Use an approved existing delivery path where available or return a controlled unavailable state. Preserve a recoverable inventory before any object move or expiry-policy change.
4. Expand one category at a time after its approved inventory, exact production CORS/origin, private-access tests, client checks, operation counts, and rollback rehearsal. If the account cannot bound billable exposure, keep that category off R2. A $0 invoice so far is insufficient evidence for unlimited operation.

**Exit evidence.** Approved account conditions, measured and reconciled use, a verified pause path, private media authorized end to end, and an approved rollback for the category.

### 5. LiveKit and RTC

- First extract provider-neutral room/token and Android media interfaces while preserving the LiveKit path. Use fakes locally to test authorization, publish/subscribe permissions, mute, reconnect and lifecycle. Keep application chat WebSocket and media transport separate.
- Use the RealtimeKit Core SDK as the selected candidate so Yugm continues to own the room UI. Verify audio/video, reconnects, roles, mute enforcement, PK opponent streams, foreground audio and room music on two clients. The existing backend and Android provider remain active on the legacy path while these behaviors are ported. [SDK selection](https://developers.cloudflare.com/realtime/realtimekit/humans/sdk-selection/) · [Current production scope](../handoffs/2026-11-24-production-cloudflare-builds.md)
- Before a live pilot, verify that admission and a provider-level stop bound participant time across audio and video presets, including reconnects and provider failures. RealtimeKit bills usage above its included monthly minutes, and token expiry leaves already-connected participants in a session. Keep exports and automatic AI features disabled for the initial media path. [RealtimeKit pricing](https://developers.cloudflare.com/realtime/realtimekit/platform/pricing/) · [Token behavior](https://developers.cloudflare.com/realtime/realtimekit/faq/)

**Exit evidence.** Device parity and operational recovery pass, the owner separately approves provider activation and traffic, and LiveKit drains before retirement.

## Production acceptance and rollback

- For each release slice, record the workload bound, provider usage evidence, authorizations, flag defaults, rollback owner and cutover/rollback triggers. Verify secrets and explicit per-environment origins through existing deployment safeguards. Keep admin and Android interfaces stable and verify old-client behavior.
- Use the existing OpenAPI, authorization, Worker bundle and credential checks. Keep Android verification bounded to affected modules, reuse the existing UI and navigation standards, and exercise app behavior on supported clients for slices that change their behavior.
- Rehearse MongoDB, media and configuration recovery in isolated environments before data cutover. A checksum or importer dry run alone does not establish recoverability. Use the [backup inventory](BACKUP_AND_RECOVERY.md), [rollback plan](ROLLBACK_PLAN.md) and [migration test plan](../testing/migration-test-plan.md).
- Test with two clients, inject quota and provider failures, and verify recovery and financial reconciliation before raising traffic. Require specific owner approval for backup/restore work with live data, production import, traffic switch and legacy removal. The $0 plan authorizes no spend.
