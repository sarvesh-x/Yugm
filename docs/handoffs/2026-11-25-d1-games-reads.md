# 2026-11-25 — D1 Arcade read routes

## Scope

Mounted the three unmounted Arcade read routes on the shared D1 Worker:

- `GET /api/games/missions`
- `GET /api/games/leaderboard`
- `GET /api/games/challenges`

`GET /api/games/catalog` was already mounted through `d1GameCatalog.ts`. Score writes remain paused at the owner's request, and `POST /api/games/scores/:scoreId/share` remains legacy-only because it depends on Socket.IO fan-out. Challenge create, accept and decline routes also remain legacy-only.

MongoDB remains authoritative. No migration, hosted operation, data import, deploy, provision, credential change, commit or push was performed.

## Behavior characterized from source and a disposable MongoDB probe

- The legacy `gamesRouter` calls `requireAuth` before all handlers, so unauthenticated read requests fail before query parsing or database work.
- `missions` uses the UTC day boundary, counts scores and sent challenges from that boundary, and caps progress at the mission targets. The response date is serialized as an ISO string.
- `leaderboard` accepts only the three `miniGameIds`; any other `gameId` falls back to `vibe_tap`. It caps `limit` at 50, with `Number(limit) || 20` providing the default. A negative limit reaches MongoDB's aggregate and returns `500 INTERNAL` with the `$limit` error message. The leaderboard user projection contains only `_id`, `name`, `username`, `avatar`, `avatarType`, `avatarParts`, `level` and `levelTitle`; absent values are omitted. `personalBest` is the raw lean score document, including imported `__v` and `metadata`.
- The legacy leaderboard places `$group` after `$sort` without a final sort, so its row order is not guaranteed by the aggregation; the probe observed a lower score before a higher score. The D1 implementation uses deterministic `score DESC, createdAt ASC, userId ASC` ordering. This is an explicit divergence from an undefined legacy order, not a change to a documented contract.
- `challenges` finds one clan containing the user without a sort. `incoming` and `clan` filter active expiry; `outgoing` includes expired challenges. Populated user and clan objects use compact field lists and omit unset values. Legacy Mongoose `trim` stores the outgoing challenge message as `rematch` from input `  rematch  `.

## D1 implementation

- `backend-server/apps/api/src/migration/d1GamesReads.ts` owns all three routes and is mounted with `app.use("/api", createD1GamesReadsRouter(db))`.
- `requireHttpSession` runs before query handling, matching the legacy router-scoped auth order.
- Missions reads three D1 aggregates in one batch and returns the exact legacy mission IDs, titles, targets, rewards and capping rules.
- Leaderboard uses a windowed D1 query to select one best score per user, then a compact populated user projection. `personalBest` preserves imported `catalog_fields` such as `__v` and parses stored `metadata`. The negative-limit route writes the legacy `500 INTERNAL` body directly because the shared D1 handler masks 500 messages.
- Challenges use one query shape with different population and expiry options for incoming, outgoing and clan rows. The temporary fixture clan uses a minimal source ID because the legacy `findOne({ memberIds })` has no defined order.
- The router performs no D1 writes. No notification, score, challenge or profile state changes on a read.

## Verification run

From `backend-server`:

- `npm.cmd run typecheck` — passed for admin, api, cloudflare-worker and shared workspaces.
- `node --check apps\\cloudflare-worker\\test\\d1-games-reads.mjs` — passed.
- `node --check apps\\cloudflare-worker\\test\\auth-worker.mjs` — passed.
- `npm.cmd run test:auth-worker --workspace @yugm/cloudflare-worker` — passed, 1/1. The fixture asserts auth-before-query, exact mission payloads, compact leaderboard projections, raw personal best, invalid/default game ID, the negative-limit 500, active/expired challenge filtering, all three population shapes and unchanged notification count. The suite also asserts the emitted Worker bundle contains no `sharp`, `mongoose`, `mongodb`, `bson`, `ioredis`, `bullmq`, `redis-adapter` or `redis.ts` input. Expected schema-unavailable, config-required, 500, scheduled-maintenance and push-delivery logs were present.
- `npm.cmd run audit:d1-endpoints -- --missing` — exit 0; legacy 638 / D1 307 / matched 302 / missing 336; `/api/games` is 4 mounted / 5 missing. The audit is an inventory and reports remaining patterns rather than failing the command.
- `git diff --check` from the repository root — no errors; only benign LF/CRLF notices.

A temporary disposable MongoDB probe was used to capture the four legacy response bodies and the negative-limit error before implementation; the scratch file was deleted afterward. `npm.cmd run secrets:check:strict` had passed earlier in the session with no tracked credential-bearing assignments. `npm.cmd run worker-config:check` remains unchanged with two pre-existing query-string-redaction findings. Neither config check was rerun for this read-only route slice.

## Not run / open

- Hosted verification, data import, deploy, provision, credential changes and MongoDB retirement.
- Arcade score writes, challenge create/accept/decline and score sharing remain legacy-only. Score-write work is paused; sharing still needs D1-compatible Socket.IO fan-out.
- The leaderboard ordering is deterministic in D1 while legacy row order is undefined. No other contract difference was observed for the mounted reads.

## Next action

Continue with the next bounded durable-state group only after its behavioral boundary is checked. Do not apply hosted migrations, import data, commit, push, deploy or retire MongoDB without new explicit authorization.
