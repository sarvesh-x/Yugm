# Target Cloudflare architecture

**Updated:** 2026-11-23

**Status:** Target responsibilities for the [zero-spend migration](../migration/implementation-plan.md). Production rollout is gated by workload evidence, recovery and approval.

## Guiding constraints

- Do not rebuild the product. Preserve accounts, balances, purchases, history, ownership, badges, gifts, media, API behavior, auth and Android/admin conventions.
- The server is the only authority for money, purchases, permissions, memberships, catalog data and asset references.
- One authoritative writer per critical domain. Clients never send prices, balances, availability, eligibility, signed URLs or object paths as authoritative state.
- Keep existing design system and navigation rules on Android; Cloudflare migration is infrastructure and data ownership work, not a visual rewrite.
- No destructive production operation, paid provisioning, credential change, deploy or release without explicit authorization.

## Logical topology

```text
Android app ─┐
             ├─ HTTPS/WSS ─ Cloudflare edge ─ API Worker ─ typed repositories ─ D1 Free candidate
Admin SPA ───┘                                ├─ R2 Standard (conditional on enforceable free usage)
                                              ├─ Durable Objects (realtime/stateful coordination)
                                              ├─ Queues (async work)
                                              ├─ KV (non-critical cache/config)
                                              └─ Cron (bounded maintenance)
RTC candidate: Cloudflare Realtime SFU/TURN behind a provider-neutral interface
External integrations: Firebase Auth/FCM, payments and moderation
```

## Workers

Workers own:

- HTTP API routing, request validation, authentication and resource/operation authorization.
- Business rules and orchestration across repository, R2, queues and external providers.
- Webhook verification and idempotent handling.
- Private media authorization and short-lived signed URL issuance.
- Admin API with RBAC and audit logging.
- Structured logs with correlation IDs, excluding tokens, credentials, private content, signed URLs and sensitive payloads.

Workers must not:

- Hold authoritative financial state in memory.
- Persist signed URLs or client-supplied object paths.
- Trust a client result as proof of a server commit.
- Assume a singleton object or process-local state survives restarts.

## Authoritative database

**Decision gate:** A measured D1 Free rollout under the [revised plan](../migration/implementation-plan.md#3-d1-free-evaluation-and-data-migration).

MongoDB remains authoritative under [ADR-0007](../decisions/0007-dcr2-capacity-gate-not-approved.md). An isolated workload can establish the scope D1 Free can carry. A PostgreSQL/Hyperdrive fallback would need an independently hosted database. For the authoritative store:

- Permanent relational state uses prepared statements, explicit constraints and foreign keys.
- Money is integer currency units. Balances and ledgers are atomic in the same database.
- IDs and Firebase identifiers are preserved through auditable mappings; timestamps remain UTC.
- List endpoints are paginated; queries are index-driven and avoid the D1 2 MB row / 100 parameter / 50 MB result limits.
- Financial operations use append-only ledger entries, idempotency keys scoped to user and operation, request fingerprints, price snapshots and compensating refunds.

## R2 and CDN

Five logical classes are managed server-side: `assets`, `public-media`, `private-media`, `originals`, and temporary staging. The committed avatar/media foundation is the starting point. Each live category requires [a zero-spend admission gate](../migration/implementation-plan.md#4-r2-media-within-the-included-allowance).

- Object keys are immutable, versioned and built by the server from validated metadata and content hashes.
- Published originals are never overwritten; superseding preserves the prior version for rollback/moderation.
- A registry stores bucket/key/checksum/ownership/visibility/state, not a public URL or signed URL.
- The quota-controlled Worker serves the budgeted pilot. Public variants may be cached through that route. Private reads require the accepted resource access checks. Direct bucket delivery and presigned operations require budget enforcement before use.
- One upload pipeline handles auth, permission/category validation, staging grant, size/signature/MIME/content checks, EXIF/SVG safety, processing/variants/moderation, authoritative DB update and cleanup.
- R2 lifecycle rules apply only to temporary or explicitly retention-managed objects.

## Centralized asset system

Separate distinct concepts that are currently conflated:

1. Identity and asset metadata.
2. Artwork/version and rendering configuration.
3. Store listing, price and availability.
4. Ownership and equipped/state per user.
5. Reward conditions, gifts, badges and achievements.
6. Reference tracking and lifecycle state.

States move `DRAFT → PUBLISHED → ARCHIVED`, with version rollback. Referenced published assets are not deleted. Android renders from a validated dynamic registry so new renderer/config entries do not require an APK update; arbitrary remote scripts are never executed. Admin-managed data is authoritative and never supplied by the client.

## Durable Objects

Scope by coordination boundary, not one global object:

- Conversation/chat rooms: message ordering, presence, read/typing state and fan-out.
- User/session: device/presence coordination where needed.
- PK/room lifecycle: deadlines and state transitions that must survive Worker restarts.
- Use SQLite-backed objects, hibernation-compatible WebSockets where protocol allows, event IDs, dedupe, durable message writes before acknowledgement, and recovery on reconnect.

Durable Objects are not a financial ledger and do not replace R2 or the authoritative database.

## Queues and Cron

Queues carry small, idempotent commands: media processing, notification fan-out, moderation, reconciliation, webhook retries and cleanup. Consumers tolerate retries, DLQ, at-least-once delivery and expiry.

Cron triggers bounded maintenance: expired upload-session cleanup, stale reservation reconciliation, quota reconciliation, retention checks, room/account cleanup and report generation. Jobs are idempotent, checkpointed, time-bounded and protected against overlap. Cron is a trigger, not exactly-once execution.

## KV

Use KV for non-critical cache and config that tolerate stale reads, such as public catalog cache and feature snapshots. Use Durable Objects for strict rate-limit counters and consistent authoritative storage for sessions and revocation.

## RTC, Firebase and external providers

- LiveKit currently carries RTC media. The planned SFU/TURN adapter needs equivalent room authorization, track permissions and Android media behavior. Activation depends on real-device parity and bounded combined egress. Application WebSockets carry signaling and app events. WebRTC carries the media.
- Firebase identifiers and FCM delivery are preserved through server adapters during migration. Firebase Admin/App Check behavior must be validated in Workers.
- Payment/provider webhooks are authenticated, idempotent and reconcile against authoritative server state.

## Admin and observability

Admin reuses the existing React app, API contracts and RBAC model where possible. New management screens cover assets, versions, store listings, prices, eligibility, rewards, badges, gifts, media moderation and audit review.

Observability uses correlation IDs, bounded and redacted logs, usage by provider, and queue age, retries and terminal failures. Admission limits reserve headroom for recovery. Billing alerts support reconciliation while tested application controls pause metered traffic before the free allowance is exhausted.

## Environments

Isolated `dev`, `staging` and `production` environments must have separate resources, bindings, secrets, domains and data. Wrangler config remains the source of truth for non-secret bindings; secrets use deployed Worker secrets or an approved secret manager. Local development must clearly distinguish simulated local bindings from remote resources. See [environment plan](../infrastructure/environments.md) once created.

## Explicit non-goals for Phase 0

- No final D1 schema, PostgreSQL schema or migration script.
- No Socket.IO-to-DO protocol implementation.
- No R2 provisioning, bucket policy, custom domain or DNS change.
- No Android/admin production code change beyond the already implemented R2 avatar slice.
- No credential rotation, history rewrite, deploy, production migration or release.
