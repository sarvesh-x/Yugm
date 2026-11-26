# 2026-11-26 — D1 Arcade write routes

## Scope

Mounted the five remaining `/api/games` write routes on the shared D1 Worker:

- `POST /api/games/scores`
- `POST /api/games/challenges`
- `POST /api/games/challenges/:challengeId/accept`
- `POST /api/games/challenges/:challengeId/decline`
- `POST /api/games/scores/:scoreId/share`

`GET /api/games/catalog`, `missions`, `leaderboard` and `challenges` were already mounted, so `/api/games` is now 9/9 in the HTTP inventory. MongoDB remains authoritative. No hosted migration, data import, deploy, provision, credential change, commit or push was performed.

## Behavior preserved

- Router-scoped auth runs before all work. `chatLimiter` runs before body validation for score save, challenge create and score share, matching the legacy route order; challenge accept and decline have no limiter.
- Score validation keeps the Zod body schema, per-game maximum scores, raw lean score DTO shape (including `__v: 0`), personal-best selection, `MINI_GAME_PLAY` XP with the 80 XP/day cap and the `game-score:<scoreId>` idempotency key.
- Challenge create keeps the single-target-or-clan refinement, score ownership check, block/self-message guard, clan membership guard, 50-recipient notification cap, sanitized message, three-day expiry and raw Mongoose-style challenge DTO.
- Accept and decline use the legacy `"Invalid challenge ID"` / `"Invalid score ID"` 400 messages, reject challenges not addressed to the session user, and return the exact legacy `{ accepted, gameId, score, challengerId }` and `{ declined: true }` bodies.
- Score share validates the body before the score-ID parameter check, preserves self/block/user-not-found guards, returns the populated inbox message DTO, and persists the notification with the legacy title/body/data.

## D1 implementation

- Added `backend-server/apps/api/src/migration/d1Games.ts` and mounted it in `d1App.ts` alongside the existing games reads router.
- Reused `presentScore`, `messageList`, `presentD1InboxMessage`, `prepareD1XpGrant`, the shared rate-limit helper and the existing notification writer rather than adding duplicate projections.
- The score row is the in-batch operation claim: XP grant, level/wallet updates and `xp_daily_caps` rows are all guarded by that row's existence. The score, grant and cap state therefore commit together instead of the legacy score-first/grant-after sequence.
- Challenge accept and score share write the direct message with all required D1 message columns. Share uses one guarded batch for the message, notification and populated message read.
- `messageList` is bound once by message ID. The earlier three-bind form and the extra `message` field on the accept response were corrected during fixture review.

## Boundaries and divergence

- No new migration. MongoDB remains authoritative until route/job parity, reconciliation, recovery rehearsal and live acceptance pass.
- D1 has no Socket.IO emitter. The legacy `directMessageNew` socket events for accept/share, score-share receiving-client invalidation and challenge notification fan-out are not reproduced; only authoritative rows and persisted notifications exist.
- Personal-best tie ordering is deterministic in D1 (`score DESC, createdAt ASC, sourceId ASC`) while legacy `$group` after `$sort` leaves row order undefined. This matches the existing games-reads boundary.
- Legacy score save persists the score before XP grant; D1 commits score and progression together. On a batch failure the score is not left behind.
- The Worker fixture uses a separate gamer session for the write block so the shared 12/10s chat limiter does not interfere with later inbox assertions. Redundant authenticated validation calls were trimmed; unauthenticated 401 ordering was retained.

## Verification

From `backend-server`:

- `npm.cmd run typecheck` — passed for admin, api, cloudflare-worker and shared workspaces.
- `npm.cmd run audit:d1-endpoints -- --missing` — exit 0; 638 legacy / 583 D1 / 577 matched / 61 missing; `/api/games` 9/0.
- `npm.cmd run test:auth-worker --workspace apps/cloudflare-worker` — passed (1/1), including the clean-bundle assertion excluding `sharp`, `mongoose`, `mongodb`, `bson`, `ioredis`, `bullmq`, `redis-adapter` and `redis.ts`. The games fixture covers unauthenticated ordering, XP grant/cap/idempotency, personal best, challenge create/accept/decline, score share persistence and notification rows.
- `npm.cmd run secrets:check:strict` — passed.
- `git diff --check` from the repository root — no errors; only benign LF/CRLF notices in four previously modified source files.

Expected `D1_SCHEMA_UNAVAILABLE`, `D1_CONFIG_REQUIRED`, 500 and scheduled-maintenance logs were present in the Worker run. No hosted request, migration application, data transfer or Android build was run.

## Not run / open

- Hosted D1 verification, legacy-data reconciliation, recovery rehearsal and live acceptance.
- D1-compatible receiving-client realtime for game DMs, score shares and challenge notifications.
- Remaining missing routes: `/api/pk` (22), `/api/trust-verification` (10), `/api/ai` (10), `/api/upload` (7), `/api/discover` (6), `/api/users` (5) and `/api/dating/explore` (1).

## Next action

Continue with the next bounded durable-state group only after its auth, limiter and realtime boundary is checked. Do not apply hosted migrations, import data, commit, push, deploy or retire MongoDB without new explicit authorization.
