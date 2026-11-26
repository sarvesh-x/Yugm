# 2026-11-26 — D1 Discover, Dating explore and final Users routes

> Route counts and the remaining-PK list below are historical. Accept/start/ready were mounted later in [the PK accept/start/ready handoff](2026-11-26-d1-pk-accept-start-ready.md).

## Scope

Completed the remaining non-PK route-parity slice requested for `/api/discover`, `/api/users` and `/api/dating`.

| Group | Before | After | Notes |
| --- | ---: | ---: | --- |
| `/api/discover` | 0/6 mounted | 6/0 | New `d1Discover.ts` router. |
| `/api/dating` | 5/6 mounted | 6/0 | Added `GET /api/dating/explore`. |
| `/api/users` | 51/2 mounted | 53/0 | Added `DELETE /me` and `POST /friend-match/search`. |
| Overall | 626 D1 / 620 matched / 18 missing | 634 D1 / 628 matched / 10 missing | Only the deferred PK write routes remain. |

The endpoint inventory is now `638 legacy / 634 D1 / 628 matched / 10 missing`. The ten missing patterns are all `/api/pk` writes: reactions, ready, send-gift, vote, accept, auto-match, end, invite, rematch and start. This is a mount inventory, not behavioral proof, and does not authorize cutover. MongoDB remains authoritative. No hosted migration, data import, credential change, provision, deploy or provider call was performed. No commit or push was performed; the previous explicit authorization was consumed by `ee28fcb`.

## Discover

- Added `backend-server/apps/api/src/migration/d1Discover.ts` and mounted it with `app.use("/api", createD1DiscoverRouter(db))`.
- Covered `GET /api/discover/presence-count`, `/trending`, `/recommended`, `/online-now`, `/hubs` and `/hubs/:key`.
- Kept router-scoped auth before query parsing and the legacy response shapes. `presence-count` returns `{ count: 0 }`; `online-now` and `onlineOnly` recommendations stay empty because no live Socket.IO/Redis presence source exists on D1. `device_tokens.last_seen_at` was not repurposed as presence.
- Trending/recommended rooms use deterministic `participant_count DESC, created_at DESC, source_id DESC` ordering because the legacy `participants` sort was a no-op. NaN page/limit values fall back to legacy defaults. Host projections tolerate the legacy invalid-populate case that previously produced a 500.
- Added Worker fixture coverage in `test/d1-endpoints.mjs`.

## Dating explore

- Added `GET /api/dating/explore` to `backend-server/apps/api/src/migration/d1Dating.ts`.
- Preserved auth then shadow-ban check, legacy query truthiness, ignored `maxDistance`, swipe/pass/block/self/shadow-ban exclusions, and age, gender, verified, nearby and shared-interest filters.
- Uses durable D1 filters and deterministic `ORDER BY RANDOM() LIMIT 40`; it reads all LIVE rooms rather than applying a visibility filter.
- DTO keeps both `id` and `_id`, compatibility fields and VIP fields; it omits `xp`, `level` and `levelTitle` as the legacy route does. `isOnline` is `false` because there is no live presence adapter.
- Fixture setup now snapshots and restores profile columns and `user_interests`/`user_languages`, and exclusion assertions check the specific actor instead of requiring an empty global candidate list.

## Users completion

### `DELETE /api/users/me`

Implemented in `d1UserMatching.ts` with router-scoped auth and no body validation, matching legacy ordering:

1. Capture Firebase UID and distinct DM partners before mutation.
2. Guard the tombstone update on live user/session state and token version; set `deletion_requested_at`, anonymized name/username, verification flags and `token_version + 1`, and clear profile columns.
3. Align `user_auth_profile.null_fields` and `missing_fields` so removed fields read as unset rather than explicit `null`.
4. Terminate active bonds and pending requests with `TERMINATED_BY_ACCOUNT_REMOVAL`.
5. Revoke all sessions with `revokeAll` (not `logout`, which would advance `token_version` twice) and delete device tokens.
6. Best-effort realtime invalidation: disconnect the user and emit `direct:conversation:deleted` to DM partners through optional injected callbacks.
7. Call the injected Firebase identity-deletion callback when a UID was present. Legacy `not_configured`/`not_found` semantics are preserved by the callback; hard errors still fail the request.
8. Return `{ deletionScheduledAt: requestedAt + 30 days }` only after the authoritative D1 writes and Firebase callback finish.

`backend-server/apps/cloudflare-worker/src/d1Api.ts` injects `deleteFirebaseUser` from the existing host-neutral Firebase module. `createD1App` accepts an optional `D1UserMatchingSideEffects` object so the D1 code never imports Socket.IO or Firebase Admin eagerly. The local fixture mocks the Identity Toolkit delete endpoint and asserts that exactly one Firebase deletion was requested.

### `POST /api/users/friend-match/search`

- Added after auth and the existing chat limiter; the request body is ignored as in legacy.
- Extracted shared `readFriendMatchState` logic so GET and search both cancel stale `MATCHED` rows whose room is no longer live.
- Preserved early `MATCHED`/`PAIRING` returns, 90-second WAITING reset, reserved-row race handling, block exclusions, oldest-first 10-candidate scan, offline candidate cancellation, claim races and `409` messages.
- Room creation uses one guarded `db.batch` for the room, two participants, two speaker positions and both `PAIRING → MATCHED` request updates; no DM or notification is created. The no-match path only resets status, not expiry.
- Presence is an optional injected adapter. With no adapter, no D1 candidate is treated as online, so the route safely returns the legacy `WAITING` shape instead of pairing against stale `last_seen_at` data. A real presence provider still needs to be bound before this is full realtime parity.

## Boundaries and divergence

- Presence shim remains: `isOnline: false`, `onlineOnly=true` gives empty candidates, `presence-count` is zero, `online-now` is empty and friend-match search finds no online candidate.
- No D1 socket emitter exists for `bonds:changed`, `direct:conversation:deleted`, `sync:invalidate`, PK events or notification fan-out. Optional callbacks were added only for the deletion path; the Worker does not yet bind realtime disconnect/emit adapters.
- `friend_match_requests` still lacks the Mongo unique user index and status/expiry indexes. Concurrent duplicate rows need reconciliation before imported data is trusted.
- D1 rate-limit responses use JSON plus `Retry-After: 10`; legacy `express-rate-limit` emits `RateLimit-*` headers and a plain-text body. This shared limiter divergence predates this slice.
- The 30-day hard-delete cascade remains in the legacy job. D1 tombstones, revokes sessions and deletes device tokens now, but does not yet purge dependent rows or identities after 30 days.
- Remaining PK writes, PK socket fan-out, weekly honors, 30-day cleanup, existing-data reconciliation, recovery rehearsal, Android journey verification and live acceptance are still open.

## Verification

From `backend-server`:

- `npm.cmd run typecheck --workspace apps/api` — passed.
- `npm.cmd run typecheck --workspace apps/cloudflare-worker` — passed both the main and runtime TypeScript projects.
- `npm.cmd run test:auth-worker --workspace apps/cloudflare-worker` — passed (1/1) on the final run. New coverage includes Discover fixtures, Dating explore exclusion/filter fixtures, friend-match search auth/limiter/reset behavior, and the full account-deletion tombstone/session/device-token/Firebase flow.
- `npm.cmd run test:production-worker --workspace apps/cloudflare-worker` — passed (1/1), including dry-run bundle assertions that exclude `mongoose`, `mongodb`, `bson`, `sharp`, `ioredis`, `bullmq`, `redis-adapter`, `redis.ts` and `livekit-server-sdk`.
- `npm.cmd run audit:d1-endpoints -- --missing` — exit 0; `638 legacy / 634 D1 / 628 matched / 10 missing`; `/api/discover` 6/0, `/api/dating` 6/0, `/api/users` 53/0 and `/api/pk` 12/10.
- `npm.cmd run secrets:check:strict` — passed, 31 tracked config files, no credential-bearing assignments.
- `node --check` on the three modified Worker fixture files — passed.
- `git diff --check` from the repository root — no errors; only CRLF normalization warnings remain.

Expected log noise in fixture runs includes `D1_SCHEMA_UNAVAILABLE`, `D1_CONFIG_REQUIRED`, intentional 500 fixtures and scheduled-maintenance output. No Android build, hosted D1 request, legacy data operation, migration application or recovery rehearsal was run.

## Next action

Migrate the remaining ten PK write routes or design the host-neutral presence/realtime provider needed for true Discover and friend-match parity. Do not apply hosted migrations, import data, commit, push, deploy or retire MongoDB without new explicit authorization.
