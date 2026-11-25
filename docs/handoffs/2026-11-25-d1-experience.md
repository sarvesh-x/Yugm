# 2026-11-25 — D1 experience routes

## Scope

Mounted all 11 `/api/experience` HTTP patterns on the shared D1 Worker:

- `GET`/`PUT /api/experience/notification-preferences`
- `GET /api/experience/achievements`, `POST /api/experience/achievements/claim`, `POST /api/experience/achievements/:id/share`
- `GET /api/experience/badges`, `PUT /api/experience/badges/showcase`, `GET /api/experience/badges/showcase/:userId`
- `GET /api/experience/safety-center`, `GET /api/experience/creator-dashboard`, `GET /api/experience/home`

The endpoint audit reports `/api/experience` at 11 mounted / 0 missing. MongoDB remains authoritative. No hosted migration, data import, deploy, provision or credential change was performed. The owner authorized committing and pushing this completed slice.

## Behavior characterized from source and a disposable MongoDB probe

A temporary `experience-characterization.ts` runner executed the legacy router against `MongoMemoryReplSet`; the probe was deleted after capturing the responses. Standalone MongoDB transactions failed with `Transaction numbers are only allowed on a replica set member or mongos`, so the characterization used a replica set.

- Auth runs before validation. Unauthenticated `GET /notification-preferences` returns `401`; an invalid body returns `422 VALIDATION`. A malformed claim body bypasses `validateBody` in the legacy route and returns `500 INTERNAL` with a `ZodError`, while a missing achievement returns `404 "Achievement not found"`.
- Claiming advances one tier at a time and returns `{ claimed: true, tier, rewardCoins, rewardCosmetic }`. Tier `BRONZE` then `SILVER` returned `200`; replay of the final tier conflicts. Share before any claim returns `403 "Claim this achievement before sharing it"`; share after claim returns the highest claimed tier.
- Achievement `progress` is clamped to the next unclaimed tier target while `currentTier` is derived from raw progress; `total` is the next unclaimed target. Published badge art prefers variant URLs, then the asset public URL, then the legacy image URL.
- Showcase rejects duplicate IDs with `422`, an unearned badge with `400 "Only earned, active badges can be worn"`, and accepts an earned badge with `200`. Self and other-user showcase reads both return `200`; a malformed ID returns `400 "Invalid user ID"`.
- `/safety-center`, `/creator-dashboard` and `/home` returned `200`. Home uses `schemaVersion: 1`, `profileCompletion.percent: 100`, 10 achievements, four quick actions and `notifications.unreadCount: 2` after two claims. Compact populated users and child documents omit null or absent fields.

## D1 implementation

- `backend-server/apps/api/src/migration/d1Experience.ts` owns the router; `d1App.ts` mounts it with `app.use("/api", createD1ExperienceRouter(db))` before the fallback.
- The session guard is scoped with `router.use("/experience", authenticate)`. An unscoped guard challenged unrelated `/api/*` routes before the later routers could answer; the scoped form preserves auth-before-validation without that side effect.
- `SELECT u.*` exceeded the local D1 result-column limit on the wide `users` table. `readUser()` now projects an explicit list of only the fields used by the experience DTOs. Unused claim JSON subqueries were removed; claims come from the authoritative claim tables.
- `0030_experience_claim_unique.sql` rebuilds `user_claimed_achievement_tiers` with the full legacy tier enum (`DIAMOND` and `MASTER` were omitted by the generated `0001` CHECK) and a unique `(users_id, achievement_id, tier)` key.
- A claim uses one guarded D1 batch. The first statement inserts the claim tier under the uniqueness key and an unchanged-wallet-balance guard. Later statements use deterministic `source_id` values for the achievement marker, cosmetic grant and wallet ledger row, so they are not skipped by the claim row inserted earlier in the same batch. The wallet balance update is the final guarded statement. Replayed tiers return `409 "This achievement tier has already been claimed"` and grant nothing; the notification is a non-fatal post-commit write.
- The home response cache keeps the legacy 20-second TTL, 500-entry cap and FIFO eviction. It is not an authoritative store. Home badge synchronization is intentionally non-blocking, matching the legacy `void syncBadgeState(...)` behavior.
- `d1Rooms.ts` exports `d1RoomProjection` and `presentD1Room()` so the experience dashboard and home reuse the room DTO assembly. `estimatedInr` mirrors `services/withdrawal.ts` with a local rate constant because that service imports Mongoose.
- Published badge assets read stored `asset_variants.url`, `asset.public_url` and exact `asset_ref` without an `owner_type` filter. `weeklyTarget` is omitted when absent. Compact user, block, invite, gift and notification DTOs preserve the legacy `__v` and null-omission behavior.

## Verification run

From `backend-server`:

- `node --check apps\\cloudflare-worker\\test\\d1-experience.mjs` — passed.
- `node --check apps\\cloudflare-worker\\test\\auth-worker.mjs` — passed.
- `npm.cmd run typecheck` — passed for admin, api, cloudflare-worker and shared workspaces.
- `npm.cmd run test:auth-worker --workspace @yugm/cloudflare-worker` — passed, 1/1. The new fixture seeds achievements, tiers, badge art, gifts, blocks, reports, notifications and user profile fields directly in local D1. It covers unauthenticated and invalid requests, preference persistence, progress/Tier DTOs, claim replay under two concurrent final-tier attempts, deterministic wallet/cosmetic ledger totals, share gating, badge gallery and showcase, creator dashboard totals, safety center blocks, home DTO/cache and fixture cleanup. The suite also asserts the emitted Worker bundle contains no `sharp`, `mongoose`, `mongodb`, `bson`, `ioredis`, `bullmq`, `redis-adapter` or `redis.ts` input. Expected schema-unavailable, config-required, 500, scheduled-maintenance and push-delivery logs were present.
- `npm.cmd run audit:d1-endpoints -- --missing` — exit 0; legacy 638 / D1 338 / matched 333 / missing 305; `/api/experience` is 11 mounted / 0 missing. The audit is an inventory and reports remaining patterns rather than failing the command.
- `npm.cmd run secrets:check:strict` — passed; no credential-bearing assignments in tracked config files.
- `git diff --check` from the repository root — no errors.

`npm.cmd run worker-config:check` was not rerun for this slice; it remains report-only with two pre-existing query-string-redaction findings.

## Not run / open

- Hosted verification, legacy data import, deploy, provision, credential changes and MongoDB retirement.
- `0030` is applied in fresh Worker fixtures only. The recovered emulator database remains at `0019`; `0020`–`0030` are added but not applied locally or hosted. Before hosted application, audit duplicate claim triples as well as the `0025`–`0029` keys listed in the [coverage checkpoint](2026-11-25-d1-route-coverage-checkpoint.md).
- D1 has no Socket.IO replacement for achievement unlock events, generic `notification:new` fan-out or receiving-client invalidation. The persisted notifications are authoritative; live FCM delivery remains a separate open item.
- Home badge synchronization is deliberately fire-and-forget. Its writes are not part of the home response's authoritative read set and are not retried by this router.

## Next action

Continue with the next bounded durable-state route group only after its behavioral boundary is checked. Do not apply hosted migrations, import data, deploy or retire MongoDB without new explicit authorization.
