# Target Cloudflare architecture

**Date:** 2026-11-22  
**Status:** Phase 0 proposal. It is a responsibility map, not an approved production design or a statement of current implementation. Items marked *decision gate* require approval or measurements before implementation.

## Guiding constraints

- Do not rebuild the product. Preserve accounts, balances, purchases, history, ownership, badges, gifts, media, API behavior, auth and Android/admin conventions.
- The server is the only authority for money, purchases, permissions, memberships, catalog data and asset references.
- One authoritative writer per critical domain. Clients never send prices, balances, availability, eligibility, signed URLs or object paths as authoritative state.
- Keep existing design system and navigation rules on Android; Cloudflare migration is infrastructure and data ownership work, not a visual rewrite.
- No destructive production operation, paid provisioning, credential change, deploy or release without explicit authorization.

## Logical topology

```text
Android app ─┐
             ├─ HTTPS/WSS ─ Cloudflare edge ─ API Worker ─ typed repositories ─ D1 or PostgreSQL/Hyperdrive
Admin SPA ───┘                                ├─ R2 service (public assets, private media, originals, staging)
                                              ├─ Durable Objects (realtime/stateful coordination)
                                              ├─ Queues (async work)
                                              ├─ KV (non-critical cache/config)
                                              └─ Cron (bounded maintenance)
External providers: Firebase Auth/FCM, LiveKit RTC, payments, moderation — preserved behind server adapters
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

**Decision gate:** D1 versus PostgreSQL through Hyperdrive.

D1 is the default candidate only if the [capacity assessment](../database/d1-capacity-assessment.md) passes. Otherwise use PostgreSQL through Hyperdrive. In either case:

- Permanent relational state uses prepared statements, explicit constraints and foreign keys.
- Money is integer currency units. Balances and ledgers are atomic in the same database.
- IDs and Firebase identifiers are preserved through auditable mappings; timestamps remain UTC.
- List endpoints are paginated; queries are index-driven and avoid the D1 2 MB row / 100 parameter / 50 MB result limits.
- Financial operations use append-only ledger entries, idempotency keys scoped to user and operation, request fingerprints, price snapshots and compensating refunds.

## R2 and CDN

Five logical classes remain server-only: `assets`, `public-media`, `private-media`, `originals`, and temporary staging. The existing uncommitted R2 foundation is the baseline.

- Object keys are immutable, versioned and built by the server from validated metadata and content hashes.
- Published originals are never overwritten; superseding preserves the prior version for rollback/moderation.
- A registry stores bucket/key/checksum/ownership/visibility/state, not a public URL or signed URL.
- Public URLs resolve at read time through a custom domain/CDN; private reads go through authenticated Worker checks and short-lived grants.
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

KV only for non-critical cache/config with explicit staleness tolerance: feature/config snapshots, public catalog cache, rate-limit counters where approximate semantics are acceptable, and small deployment metadata. Never use KV for balances, ownership, idempotency, memberships, queues or immediate read-after-write state.

## RTC, Firebase and external providers

- LiveKit remains the RTC media transport; Workers issue scoped tokens and authorize joins. Do not send raw audio/video over ordinary WebSockets.
- Firebase identifiers and FCM delivery are preserved through server adapters during migration. Firebase Admin/App Check behavior must be validated in Workers.
- Payment/provider webhooks are authenticated, idempotent and reconcile against authoritative server state.

## Admin and observability

Admin reuses the existing React app, API contracts and RBAC model where possible. New management screens cover assets, versions, store listings, prices, eligibility, rewards, badges, gifts, media moderation and audit review.

Observability uses correlation IDs, structured events, bounded log volume, redaction, metrics for D1 rows/read/write, R2 operations, DO duration/requests, queue retries/DLQ, KV operations, and cost alerts. Free-tier-aware controls and account spending limits are set before production traffic.

## Environments

Isolated `dev`, `staging` and `production` environments must have separate resources, bindings, secrets, domains and data. Wrangler config remains the source of truth for non-secret bindings; secrets use deployed Worker secrets or an approved secret manager. Local development must clearly distinguish simulated local bindings from remote resources. See [environment plan](../infrastructure/environments.md) once created.

## Explicit non-goals for Phase 0

- No final D1 schema, PostgreSQL schema or migration script.
- No Socket.IO-to-DO protocol implementation.
- No R2 provisioning, bucket policy, custom domain or DNS change.
- No Android/admin production code change beyond the already implemented R2 avatar slice.
- No credential rotation, history rewrite, deploy, production migration or release.
