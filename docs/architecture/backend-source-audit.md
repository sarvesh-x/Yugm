# Backend source audit

**Date:** 2026-11-22  
**Status:** Phase 0 read-only static audit of `backend-server` (`apps/api`, `apps/admin`, `apps/cloudflare-worker`, `packages/shared`). No build, test, migration, seed, deploy or live database/media operation was run. Secret values are not reproduced.

## 1. Runtime and boot sequence

`apps/api/src/app.ts` composes an Express app in `createApp()`. `apps/api/src/index.ts` performs blocking startup in this order: `connectDatabase()` → `connectRedis()` → `initFirebase()` → `createApp()` → `initSocket(server)`.

After `listen()`, a fire-and-forget chain runs media indexes, auth indexes, production indexes, migrations, default cosmetics, achievement seeding, official rooms, job workers and PK timer recovery. Each step is individually `try/catch`ed and only logged. The API can therefore serve traffic even when indexes, migrations or seeds fail. This silent-degradation behavior must be replaced by explicit readiness gates before migration cutover.

Middleware order in `app.ts`:

- `helmet()` → `compression()` (skipped for Cloudflare) → request ID → CORS.
- Raw payout webhook handler is registered **before** `express.json({ limit: "1mb" })` because it needs the raw body for HMAC verification.
- JSON parsing, HTTP metrics and request logging follow.
- GridFS byte-range `/uploads/:fileName` is mounted only for `STORAGE_DRIVER=mongodb`.
- `/uploads`, `/assets` and `/admin` static mounts are skipped when `YUGM_RUNTIME=cloudflare`.

`app.ts` also mounts `eventsRouter` twice: at `/api/events` and at `/api`, producing both canonical `/api/events...` and legacy `/api/events/events...` paths. Any migration harness must preserve this quirk until old clients are retired.

## 2. Persistence inventory

There are approximately 95 Mongoose models in `apps/api/src/models/`. No model declares an explicit `collection` option, so Mongoose pluralization determines collection names (for example `MediaObject` → `mediaobjects`).

Important groups:

- Identity/session: `User`, `AuthSession`, `AdminUser`, `AdminSession`, `DeviceToken`, `UserSafetyStatus`.
- Rooms/realtime: `Room`, `RoomParticipant`, `RoomInvite`, `RoomActivity`, `RoomModeState`, `RoomReaction`, `SpeakerRequest`, `ChatMessage`, `VoicePoll`, `Poll`, `WatchParty`, `CountdownEvent`, `ImmersiveTheme`.
- PK cluster: `PkBattle`, `PkEvent`, `PkInvite`, `PkParticipant`, `PkVote`, `PkLeaderboardEntry`.
- Finance: `WalletTransaction`, `DiamondTransaction`, `Purchase`, `Subscription`, `WithdrawalRequest`, `PayoutReview`, `CreatorPayoutKyc`, `GiftTransaction`, `GiftInventory`, `Gift`, `GiftCollection`, `WishlistItem`.
- Safety/admin: `Report`, `ModerationAction`, `ModerationQueue`, `AdminModerationAction`, `AdminAuditLog`, `TrustVerification`, `FaceVerificationSubmission`, `VoiceVerificationSubmission`, `SupportTicket`, `AppConfig`.
- Social/profile: `Follow`, `Block`, `Friendship`, `FriendMatchRequest`, `Relationship`, `ProfileVisit`, `Like`, `Story`, `StoryComment`, `StoryHighlight`, `UserMood`, `Referral`, `Bond*`, `Clan*`, `GroupChat`, `GroupMessage`, `ConversationMute`, `DirectMessage`, `VibeGraph`, `WaveNudge`.
- Progression/events: `Season`, `Mission`, `UserMission`, `XpGrant`, `XpDailyCap`, `BattlePass`, `BattlePassXpGrant`, `Achievement`, `Cosmetic`, `Event`, `Notification`, `NotificationCampaign`, `MiniGameChallenge`, `MiniGameScore`.
- Media/asset: `AssetObject`, plus the uncommitted `MediaObject`, `MediaUploadSession`, `MediaQuotaReservation`.

Raw non-model collections include `media`, `media.files`, `media.chunks`, `media.quota`, `media.counters` (GridFS/quota in `services/storage.ts`) and `_migrations`.

TTL indexes observed: `AuthSession.expiresAt`, `FriendMatchRequest.expiresAt`, `Story.expiresAt`, `UserMood.expiresAt`, `VoicePoll.expiresAt`, `XpDailyCap.day`.

Idempotency/ uniqueness hot spots: `DiamondTransaction.idempotencyKey`, `GiftTransaction.metadata.idempotencyKey`, `WalletTransaction.metadata.idempotencyKey`, `PkEvent` sequence/gift transaction ID, `XpGrant.actionKey`, `AssetObject` owner/version and `MediaObject` owner/category/version. These keys must be preserved in any relational target.

## 3. API surface

The source audit found approximately 606 route registrations across 55 routers. This is a static declaration count, larger than the historical 566-row generated inventory because the inventory predates newer routes and because the same router can be mounted more than once. OpenAPI currently has 90 path objects, including four media paths.

Mount highlights:

| Mount | Source | Notes |
|---|---|---|
| `/api/admin` | Eight `admin*.ts` routers | Mixed auth styles; see section 4. |
| `/api/badge-art` | `adminBadges.ts` | Public legacy blob read. |
| `/api/auth` | `auth.ts` | Global App Check plus limiters. |
| `/api/users` | `users.ts` | Router-level `requireAuth`; 54 routes. |
| `/api/rooms` | `rooms.ts`, `roomModes.ts` | 49 + 6 routes; mostly authenticated. |
| `/api/pk` | `pk.ts` | Router-level `requireAuth`; 22 routes. |
| `/api` | Many route modules | Wallet, gifts, media, upload, reports, reactions, stories, referrals, groups, support, subscriptions, social, moderation, missions, experience, friends and others. |
| `/api/events` and `/api` | `events.ts` | Double-mounted for legacy compatibility. |
| `/legal` | `legal.ts` | Public. |

Public surfaces include health, `/api` group listing, `/legal/*`, `GET /api/reactions`, `/api/badge-art/:id/:version`, admin auth endpoints and the raw payout webhook.

Transaction/idempotency hot spots include `routes/users.ts`, `services/pk.ts`, `routes/wallet.ts`, `routes/admin.ts`, `services/gifts.ts`, `services/battlePass.ts`, `services/payoutReview.ts`, wishlist, missions, experience, Google Play, theme purchase, referrals and purchase credit.

## 4. Authentication and authorization

### User auth

`middleware/auth.ts` verifies HS256 access JWTs, checks `AuthSession` revocation/expiry, token generation and blocked/suspended state. It has a 20-second per-process cache keyed by session ID and token version. Revocation can therefore lag up to 20 seconds and can differ between instances. Socket authentication in `services/socket.ts` repeats the session/token-version logic but does not check suspension.

`APP_CHECK_ENFORCE` defaults to false. App Check is applied globally only to `/api/auth` and inline to notification device-token routes. Most write endpoints rely on bearer JWT only.

Rate limiting uses `cf-connecting-ip` then `x-forwarded-for` for client identity. When Redis is unavailable, `ResilientRedisRateLimitStore` falls back to a per-process in-memory map, so limits are not global during outages or multi-instance/Worker scaling.

### Admin auth reconciliation

`middleware/adminAuth.ts` verifies admin JWTs and populates `req.admin`/`req.adminPermissions`. `requirePermission`, `requireAnyPermission`, `requireSuperAdmin` and `requireTwoFactor` only inspect that populated request state; they do not authenticate by themselves.

Two source reads disagreed about the separate admin routers. Source inspection confirms:

- `adminRouter.use(requireAdminAuth)` is registered at `routes/admin.ts:603`, after many routes but before the router ends.
- `app.ts` mounts `adminRouter` at `/api/admin` before `adminSupport`, `adminCosmetics`, `adminAssets`, `adminBadges` and `adminReactions`.
- Historically, for a request entering `adminRouter`, the late `use(requireAdminAuth)` executed even when no earlier admin route matched, then the request continued to the next mounted `/api/admin` router with `req.admin` populated. Those routers were fail-closed but **dependent on mount order**.
- On 2026-11-23, explicit `router.use(requireAdminAuth)` guards were added to `adminAssets`, `adminBadges` (not the public `badgeArtRouter`), `adminCosmetics`, `adminReactions` and `adminSupport`. These routers now reject unauthenticated requests even when mounted alone; the late `adminRouter` guard remains as a second layer for its own routes.
- `adminVerification.ts` and `adminDmReviews.ts` are mounted before `adminRouter` and apply their own per-route auth.
- `GET /api/admin/progression/health` is registered at line 84, before the guard, so `requirePermission("analytics.read")` returns 401 for every real admin. It appears dead, not exposed.

Five regression tests prove each formerly dependent router returns 401 without a token when mounted alone. Two more tests verify that `requireAdminAuth` accepts a signed super-admin JWT and that each formerly dependent router carries an explicit guard layer while the public badge-art router does not. These tests exercise the guard boundary, not the real route handlers; effective permissions were not changed.

## 5. Realtime

`packages/shared/src/index.ts:49–97` defines 47 `socketEvents` with no payload schemas. `services/pk.ts:24–41` defines 16 `pkSocketEvents`. Literal events emitted but absent from the central catalog include `sync:invalidate`, `admin:room:lock|unlock|user:remove|user:mute|warning`, `room:mode:set|state|answer|dare|scores|ended`, `recording:started|stopped`, `direct:conversation:read`, `direct:reaction:new` and `bonds:changed`.

`services/socket.ts` uses the Redis adapter when available; presence snapshots run every 15 seconds and stale-room/connection sweeps every 60 seconds. Several sweeps are skipped or reduced when `YUGM_RUNTIME=cloudflare`. Rooms are `user:<id>` and `room:<id>`, with a 10 events/sec Redis-backed socket limit.

`middleware/syncInvalidation.ts` maps mutations to `PROFILE`, `SOCIAL`, `CHAT`, `ROOMS`, `CLANS`, `WALLET`, `GIFTS`, `TASKS`, `EVENTS`, `NOTIFICATIONS` and `SETTINGS`; only committed 2xx responses emit, with public-topic broadcasts for rooms/badges/events/feed.

## 6. Jobs, schedulers and timers

`services/jobs.ts` defines a BullMQ `push-notifications` queue with three attempts, exponential backoff and retention policies. If Redis is absent or startup times out, it degrades to inline in-process sends. `jobId` is deterministic (`push_<userId>_<notificationId>`). A `cronWorker` is declared and closed but never initialized.

`runMaintenanceTasks()` runs immediately and every 15 minutes: bond progress, weekly honors, 30-day account deletion cleanup, story expiry, 48-hour stale-room closure, VIP rollover, 30-day clan-message prune and expired-suspension clearing. It is coupled to one API process with no distributed leader election.

PK timers (`schedulePkCountdown`, `schedulePkClose`, `scheduleInviteExpiry`, `startBattleTimer`, `tickBattle`, `runPkDeadlines`, `resumePkTimers`) skip when `YUGM_RUNTIME=cloudflare`; the Worker prototype substitutes Durable Object alarms.

Managed media lifecycle has a gap: staging objects are retained briefly for retry/forensics with no implemented sweeper, and expired `MediaUploadSession` rows have no job that releases orphaned reservations.

## 7. External integrations

- Razorpay: order creation, payment fetch, refunds and HMAC helpers. Only the payout webhook is mounted with raw-body verification; `handlePaymentWebhook` is implemented but unmounted.
- Google Play: purchase verify/consume/refund and subscription verify/acknowledge/cancel/reconcile. The Pub/Sub webhook verifier is implemented but unmounted.
- Firebase: FCM pushes and App Check verification, narrowly applied.
- LiveKit: token issuance, room/recording lifecycle; configuration validation is warning-only in some cases.
- Redis: rate limits, Socket.IO adapter, presence and BullMQ.
- Object storage: legacy local/S3/GridFS drivers plus the uncommitted R2 service.
- Render/Cloudflare package mismatch remains: `render.yaml` uses `com.example.yugm`, Worker production config uses `com.yugm.app`.

## 8. Migrations and indexes

`config/migration.ts` registers v1–v9:

- v1: user partial-unique Firebase UID/email and unique username.
- v2: rooms.
- v3: notification TTL.
- v4: story TTL.
- v5: wallet transactions.
- v6: asset objects.
- v7: cosmetic `assetRef`.
- v8: achievement `assetRef`.
- v9: media registry indexes.

Down functions exist for v6–v9 but `runMigrations()` never calls them. All migrations are additive and record applied versions in `_migrations`; they still require backup/dry-run and a replica set for index builds.

`services/productionIndexes.ts` calls `createIndexes()` for 49 models on every boot and drops a legacy `Purchase` index first. Models absent from that list rely on schema indexes or have none. `MediaQuotaReservation` has only `_id`; this may be intentional but should be an explicit decision. Index-name drift between schema declarations and named migration v9 indexes is possible.

All index/migration steps are non-fatal on failure. There are no migration dry-run tests, index-conflict tests or production-capacity tests.

## 9. Security observations

1. Tracked plaintext credentials in the local Worker config (see [the finding](../infrastructure/tracked-worker-credentials-finding.md)).
2. Admin auth is no longer mount-order dependent for the five routers guarded on 2026-11-23; unauthenticated rejection and valid-JWT guard acceptance are covered, though real route-handler execution remains untested.
3. User auth cache can delay revocation for up to 20 seconds per process.
4. Rate-limit IP trust and in-memory fallback weaken limits under header spoofing, Redis failure and horizontal scaling.
5. App Check is off by default and narrowly applied.
6. CORS allows `*` in the app config and production Worker config.
7. Payment and Google Play webhooks are implemented but unmounted; purchase state relies on client-submitted verification endpoints.
8. Positive controls exist: wallet CAS/idempotency, diamond/purchase replay protection, payout state machine, HMAC webhook verification with `timingSafeEqual`, structured R2 keys and private-bucket URL denial.
9. `comboGift()` is deliberately disabled pending payer approvals; do not re-enable without re-review.

## 10. Test gaps

The API has 38 `*.test.ts` files plus a hardening integration suite and three Worker smoke scripts. Gaps include no tests for `payoutWebhook`, `payoutReview`, `purchaseCredit`, `battlePass`, `referrals`, `themePurchase`, `productionIndexes`, `config/migration.ts`, admin-router guard coverage is new (unauthenticated rejection plus valid-JWT/guard-layer acceptance tests), but real handler execution under a valid JWT is still untested, or webhook mounting. Media tests are uncommitted and require R2/S3 plus a replica set. There is no production-capacity or horizontal-scaling test for the singleton Worker.

## 11. Migration implications

- Add readiness gates so a failed index/migration/seed prevents traffic instead of logging and continuing.
- Preserve double-mounted events routes, response envelopes and idempotency keys until old clients are retired.
- Move per-process auth cache and rate-limit state out of the critical path or define explicit consistency bounds.
- Mount and test authenticated webhook handlers; never rely on client-reported purchase verification as sole proof.
- Convert maintenance and PK timers to bounded, idempotent Cron/DO/Queue jobs with leader election or single-writer semantics.
- Sweep expired media sessions and release orphaned reservations.
- Generate the relational schema only after the D1/Hyperdrive decision; migration tooling must preserve the idempotency keys listed above.
