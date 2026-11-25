# D1 recordings

- **Date:** 2026-11-25
- **Slice:** Mount legacy `/api/recordings` routes on the shared D1 Worker.

## What changed

- Added `backend-server/apps/api/src/migration/d1Recordings.ts` with all seven legacy recording routes: `POST /`, `GET /room/:roomId`, `GET /:id`, `POST /:id/view`, `PATCH /:id/stop`, `PATCH /:id`, `DELETE /:id`.
- Mounted the router at `/api/recordings` in `backend-server/apps/api/src/migration/d1App.ts`.
- Added recordings coverage to `backend-server/apps/cloudflare-worker/test/d1-endpoints.mjs`.

## Behavior preserved

- Router-scoped auth before validation, matching legacy `requireAuth` + `validateBody` order.
- Legacy request validation: `roomId` 24-hex, optional title 1-100, stop requires URL + positive integer duration.
- Host-only start/stop/update/delete checks; start requires a LIVE room.
- Legacy DTO shape with `_id`, `roomId`, `hostId`, `title`, `recordingUrl`, `duration`, `viewCount`, `status`, timestamps.
- View increment preserves legacy pre-increment response value (`findByIdAndUpdate` default return-before behavior).
- PATCH update always bumps `updatedAt`, matching legacy `save()`.

## Boundary

- No D1 Socket.IO emitter for legacy `recording:started` / `recording:stopped` fan-out. Authoritative recording state is persisted; realtime broadcast remains legacy-only.
- No new D1 migration; uses existing `room_recordings` table in `0001_initial.sql`.

## Verification

- `npm.cmd run typecheck` (backend-server, all workspaces) — passed.
- `npm.cmd run audit:d1-endpoints -- --missing` — 638 legacy / 555 D1 / 549 matched / 89 missing; `/api/recordings` 7 mounted / 0 missing.
- `npm.cmd run test:auth-worker --workspace apps/cloudflare-worker` — passed on rerun (1/1). First run hit an intermittent `d1-reports` count assertion unrelated to recordings; rerun passed cleanly including recordings coverage.
- `npm.cmd run secrets:check:strict` — passed.
- `git diff --check -- backend-server/apps/api/src/migration/d1App.ts backend-server/apps/api/src/migration/d1Recordings.ts backend-server/apps/cloudflare-worker/test/d1-endpoints.mjs` — passed.

## Remaining

- 89 legacy routes remain unmounted on D1; see endpoint audit for the current list. Major remaining groups include `/api/pk` (22), `/api/trust-verification` (10), `/api/ai` (10), `/api/upload` (7), `/api/creator` (7), `/api/discover` (6), `/api/games` writes/share (5), `/api/gifts` mutations (5), `/api/users` (11), `/api/v1/moderation` report/appeal/status (3), `/api/dating/explore` (1), `/api/payments/webhook/payout` (1), `/api/` (1).
- Hosted D1 migrations through `0035` remain unverified on hosted; `0020`–`0035` local/fixture as previously recorded.
- No MongoDB retirement, no hosted data operations, no deploy/credentials.