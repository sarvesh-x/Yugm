# 2026-11-26 — D1 PK read routes

## Scope

Mounted the eight read-only `/api/pk` patterns on the shared D1 Worker:

- `GET /api/pk/active/:roomId`
- `GET /api/pk/available-opponents`
- `GET /api/pk/history/user/:userId`
- `GET /api/pk/history/room/:roomId`
- `GET /api/pk/:battleId/events`
- `GET /api/pk/:battleId/leaderboard`
- `GET /api/pk/:battleId/media-sessions`
- `GET /api/pk/:battleId`

All 14 PK write patterns remain legacy-only. `/api/pk` is now 8/14 in the HTTP inventory. MongoDB remains authoritative. No hosted request, migration application, data import, deploy, provision, credential change, commit or push was performed in this slice. The earlier `commit and push everything` authorization was consumed by `a770475`; these changes remain uncommitted.

## Behavior preserved

- Router-scoped authentication runs before path validation on every route, matching legacy `pkRouter.use(requireAuth)`. The legacy PK surface has no rate limiter, so none was added.
- `/active/:roomId` reads the newest battle in the legacy active-status set, adds `myVote` only for VOTE battles, adds `myReady` from non-departed ready participants, and reads only a `PENDING` invite involving the viewer.
- `/available-opponents` keeps the `battleType`/`search`/`limit` query contract, the 50-item cap, public LIVE-room and non-blocked-host filters, and exclusion of rooms already in an active PK. Search escapes SQL `LIKE` wildcards rather than treating them as regex syntax.
- User and room history use the legacy terminal-status set (`ENDED`, `FORCE_ENDED`, `COMPLETED`, `CLOSED`, `ABORTED`, `CANCELLED`). User history includes battles where the user is a participant, not only a host, as in legacy.
- Events keep ascending creation order and the 200-row cap; leaderboard keeps populated user fields, points-descending order and the 50-row cap. Battle details use the existing D1 PK battle presenter and a latest invite without a status filter.
- `/media-sessions` keeps battle status/type checks, exact room membership comparison, host-or-participant authorization, opponent-room metadata, the `PK_OPPONENT_VIEWER` role, and the legacy flattened opponent shape: `token` is a string and `url` is a sibling field. The identity includes the raw battle ID path parameter as in legacy.
- All responses use the `sendOk` envelope. No route performs a D1 write, notification, socket emit, job enqueue or `sync:invalidate` emit.

## D1 implementation

- Added `backend-server/apps/api/src/migration/d1PkReads.ts` and mounted it in `d1App.ts` at `/api/pk` with the Worker's existing LiveKit configuration.
- Reused `pkBattleProjection`, `pkBattleJoins` and `presentPkBattle` from `d1RoomPkHistory.ts`; the older room/user PK-history helpers retain their narrower status set and were not changed.
- Exported the existing host-neutral `createLiveKitToken` helper from `d1LiveKit.ts`. It uses Web Crypto HS256 and no `livekit-server-sdk`, native library or new binding. The 503 configuration checks mirror the existing `/api/livekit/token` route.
- No new migration. The existing `pk_battles`, `pk_participants`, `pk_invites`, `pk_votes`, `pk_events`, `pk_leaderboard_entries`, `rooms` and `users` tables are read unchanged.

## Boundaries and divergence

- All 14 POST routes (room-start, invite, auto-match, accept, start, reject, cancel, end, ready, close, rematch, vote, send-gift, reactions) stay on the legacy runtime. They require transactional room locks, state-machine transitions, event sequence/state-version updates, wallet debit and idempotency, notification/push dispatch, timers and PK socket fan-out before D1 parity.
- `runPkDeadlines` and `endD1Room()` remain legacy boundaries: D1 Cron does not run PK deadline recovery, and stale-room cleanup does not end active PK battles.
- D1 has no socket emitter for PK state changes. This slice is GET-only, so no receiving-client invalidation is needed here, but future write routes will need an explicit realtime decision.
- D1 DDL lacks the legacy unique indexes for `battleCode`, `pk_votes(battle_id,voter_id)`, `pk_participants(battle_id,user_id)`, leaderboard pairs and event sequence/gift transaction. It also rejects the `OVERTIME` status that legacy service code reads but its model enum does not declare. These gaps must be reconciled before mounting writes.
- Legacy media tokens come from the Node LiveKit SDK; D1 uses the already-mounted Web Crypto-compatible token builder. Token claims and the flattened response shape are contract-tested, but LiveKit credentials and a production `wss://` URL remain owner-supplied.
- D1 reads may return deterministic tie orders where MongoDB left them undefined. No legacy success-before-commit issue is introduced because these routes do not commit.

## Verification

From `backend-server`:

- `npm.cmd run typecheck` — passed for admin, api, cloudflare-worker and shared workspaces.
- `npm.cmd run test:auth-worker --workspace apps/cloudflare-worker` — passed (1/1) on the final run. The new fixture covers unauthenticated 401 on all eight patterns, path validation, pending-invite filtering, viewer vote/ready fields, available-opponent exclusion, full terminal-status histories, event and leaderboard DTOs, battle details, host/non-member/foreign-room media authorization, token claims, and cleanup of all inserted PK rows. Existing clean-bundle assertions still exclude `sharp`, `mongoose`, `mongodb`, `bson`, `ioredis`, `bullmq`, `redis-adapter` and `redis.ts`.
- `npm.cmd run audit:d1-endpoints -- --missing` — exit 0; 638 legacy / 613 D1 / 607 matched / 31 missing; `/api/pk` 8/14.
- `npm.cmd run secrets:check:strict` — passed.
- `git diff --check` from the repository root — no errors; one benign LF/CRLF notice in `d1LiveKit.ts`.

Two intermediate Worker runs failed unrelated fixtures (`d1-admin.mjs` KYC `panLast4` and the known `d1-reports.mjs` `4 !== 3` count assertion) after the new PK assertions had passed. The final clean run passed 1/1 with the same source. Expected `D1_SCHEMA_UNAVAILABLE`, `D1_CONFIG_REQUIRED`, 500 and scheduled-maintenance logs appeared. No hosted request, Android build or legacy data operation was run.

## Not run / open

- Hosted D1 verification, legacy-data reconciliation, recovery rehearsal and live acceptance.
- Hosted migrations `0003`–`0035`; `0020`–`0035` are applied only in fresh local fixtures while the recovered local database remains at `0019`. Duplicate audits from `0025`–`0030` are still pending.
- Remaining 31 missing routes: `/api/pk` writes (14), `/api/upload` (7), `/api/discover` (6), `/api/users` (2), `/api/dating/explore` (1) and `/api/trust-verification/media/:fileName` (1).
- PK deadlines, active-battle ending in `endD1Room()`, and PK socket/push fan-out still need a D1-compatible design.

Uploads were mapped but deliberately deferred: legacy multipart handlers use GridFS/S3-compatible single-bucket semantics and worker-host 10 MB caps, while the managed media slice already owns R2 keys, staged PUT capability, signature checks and the five-bucket boundary. The next upload increment would need a host-neutral multipart adapter plus explicit client compatibility for `{ url, storage }`; it should not be folded into this read-only slice.

## Next action

Continue only with another bounded group whose auth, side effects and realtime boundary are checked. Do not apply hosted migrations, import data, commit, push, deploy or retire MongoDB without new explicit authorization.
