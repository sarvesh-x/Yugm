# 2026-11-26 — D1 durable user matching and private calls

## Scope

Mounted three durable `/api/users` routes on the shared D1 Worker:

- `GET /api/users/friend-match`
- `POST /api/users/friend-match/cancel`
- `POST /api/users/messages/:userId/call`

`/api/users` is now 51/2 in the HTTP inventory. MongoDB remains authoritative. No hosted migration, data import, deploy, provision, credential change, commit or push was performed in this slice. The earlier commit/push of `24eb56c` remains the last authorization consumed.

Two routes stay deliberately deferred:

- `POST /api/users/friend-match/search` needs live Socket.IO/Redis presence to decide which candidate is online. Mounting it on D1 would either pair offline users or return success without the legacy pairing side effects.
- `DELETE /api/users/me` needs Firebase identity deletion and socket invalidation in addition to database rows. A D1-only success would be misleading.

## Behavior preserved

- Router auth runs before the chat limiter on both friend-match routes. The limiter keeps the legacy 12 requests / 10 seconds position and is keyed by the session user.
- `GET /friend-match` returns `{ status: "IDLE" }`, `{ status: "WAITING" }` or `{ status: "MATCHED", room }`. A `MATCHED` row whose room is not `LIVE` is cancelled for every row on that room before returning `IDLE`, matching legacy behavior.
- `POST /friend-match/cancel` only cancels `WAITING` rows and always returns `{ cancelled: true }`; a non-waiting row is left untouched.
- Private calls keep the legacy order: auth → muted guard → body validation → ID/self/receiver/VIP/block checks. Errors retain `"Invalid user ID"`, `"Cannot call yourself"`, `"User not found"`, `"Private voice and video calls are available to VIP members only"` and `"Cannot call this user"`.
- The legacy private-call handler selects only `vipTier` and `vipExpiresAt`; the D1 check intentionally does not apply `vipFrozen` or a separate level override for this route.
- Room title, description, category, tags, language, visibility, participant roles, camera flag, speaker IDs and DM text match the legacy values. The notification title/body/data also match.
- Room, participants, speaker IDs and the direct message commit in one guarded D1 batch. The notification is written after commit, as in legacy; no success is returned before the authoritative rows commit.

## D1 implementation

- Added `backend-server/apps/api/src/migration/d1UserMatching.ts` and mounted it in `d1App.ts` with `limits.chat`.
- Reused `d1RoomProjection`/`presentD1Room`, `messageList`/`presentD1InboxMessage`, `createNotification`, `d1UserId`, `d1LiveUserFilter` and the shared rate-limit helper rather than adding duplicate projections or writers.
- Friend-match selection is deterministic (`created_at ASC, source_id ASC`) where legacy `findOne()` had no explicit ordering.
- Room reads use a `LEFT JOIN` on the host because these routes return the raw `hostId`; a deleted or blocked host row cannot make a live room look stale.
- No new migration. The existing `friend_match_requests`, `rooms`, `room_participants`, `room_speakers`, `direct_messages` and `notifications` tables are used.

## Boundaries and divergence

- D1 has no Socket.IO emitter. The legacy `directMessageNew` events to caller and receiver are not reproduced for private calls; the DM and notification rows persist.
- `POST /friend-match/search` and `DELETE /api/users/me` remain legacy-only for the presence and Firebase identity reasons above.
- The call notification remains a post-commit write, matching legacy ordering but not sharing the room/DM batch.
- Matched and call responses present `hostId` as the raw ID string from the lean room row, matching the legacy `.lean()` room shape.
- MongoDB remains authoritative until route/job parity, reconciliation, recovery rehearsal and live acceptance pass.

## Verification

From `backend-server`:

- `npm.cmd run typecheck` — passed for admin, api, cloudflare-worker and shared workspaces.
- `npm.cmd run audit:d1-endpoints -- --missing` — exit 0; 638 legacy / 586 D1 / 580 matched / 58 missing; `/api/users` 51/2.
- `npm.cmd run test:auth-worker --workspace apps/cloudflare-worker` — passed (1/1). The new fixture covers unauthenticated 401 ordering, 429 limiter behavior, matched/waiting/cancel/stale-room persistence, private-call validation and guard ordering, plus room, participant, speaker, DM and notification rows. The existing clean-bundle assertions still exclude `sharp`, `mongoose`, `mongodb`, `bson`, `ioredis`, `bullmq`, `redis-adapter` and `redis.ts`.
- `npm.cmd run secrets:check:strict` — passed.
- `git diff --check` from the repository root — no errors; only benign LF/CRLF notices in four previously modified source files.

Expected `D1_SCHEMA_UNAVAILABLE`, `D1_CONFIG_REQUIRED`, 500 and scheduled-maintenance logs appeared in the Worker run. No hosted request, migration application, data transfer or Android build was run.

## Not run / open

- Hosted D1 verification, legacy-data reconciliation, recovery rehearsal and live acceptance.
- Hosted migrations `0003`–`0035`; `0020`–`0035` are applied only in fresh local fixtures while the recovered local database remains at `0019`.
- D1-compatible receiving-client realtime for private-call DMs, plus replacement live presence for friend-match search.
- Firebase identity deletion and socket invalidation needed for `DELETE /api/users/me`.
- Remaining missing routes: `/api/pk` (22), `/api/trust-verification` (10), `/api/ai` (10), `/api/upload` (7), `/api/discover` (6), `/api/users` (2) and `/api/dating/explore` (1).

## Next action

Continue only with another bounded durable-state group after its auth, limiter, side-effect and realtime boundary is checked. Do not apply hosted migrations, import data, commit, push, deploy or retire MongoDB without new explicit authorization.
