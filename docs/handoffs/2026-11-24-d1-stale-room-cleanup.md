# 2026-11-24 — D1 stale-room safety cleanup

## Scope

Port the legacy `48-hour stale-room end` background job to the local MongoDB-free D1 Worker. MongoDB remains authoritative for the deployed legacy runtime until route/job parity, reconciliation, recovery rehearsal and live acceptance pass. Work stayed on `master`; all pre-existing staged/unstaged changes and untracked files were preserved. No commit, push, deploy, provision, hosted migration, credential rotation or production data operation was performed.

## Changes applied

- Exported `endD1Room()` from `backend-server/apps/api/src/migration/d1Rooms.ts` so the maintenance job can reuse the same guarded room-end transaction as the mounted room routes.
- Added `endStaleRooms()` to `backend-server/apps/api/src/migration/d1Maintenance.ts` and included it in the `*/15 * * * *` maintenance run. It selects `LIVE` rooms with `created_at <= now - 48h`, ordered and capped at 20 per run to stay within the Workers Free D1 statement limit, and calls `endD1Room()` for each.
- `endD1Room()` preserves the legacy side effects in one D1 batch: room marked `ENDED` with `ended_at` and zero participants, room chat deleted, open participants stamped with `left_at` and released from mic/camera/seat, and pending speaker requests rejected. The always-on official voice room remains exempt, matching `isAlwaysOnOfficialVoiceRoom()`.
- Extended `backend-server/apps/cloudflare-worker/test/d1-maintenance.mjs` with a stale room, a recent room and an official voice room, plus an open participant, chat message and pending speaker request in the stale room. The fixture asserts the stale room ends with all four effects, while the recent and official rooms stay `LIVE`.

## Legacy parity checked

Source comparison with `backend-server/apps/api/src/services/jobs.ts`: legacy selects `status: "LIVE"` with `createdAt <= now - 48 * 60 * 60 * 1000`, iterates every match and calls `endRoom(id, "stale room safety cleanup")`. The D1 job uses the same cutoff and the same `endRoom` guard/effects through `endD1Room()`; only the bounded batch size differs, and a failed room-end task makes the maintenance run fail rather than being swallowed into a legacy result string.

## Verification actually run

- `node --check test/d1-maintenance.mjs` — passed.
- `npm.cmd run typecheck --workspace @yugm/api` — passed.
- `npm.cmd run typecheck --workspace @yugm/cloudflare-worker` — passed (both tsconfigs).
- `npm.cmd run test:auth-worker --workspace @yugm/cloudflare-worker` — passed 1/1; maintenance logged `rooms: 1` on the seeded cron and `rooms: 0` on the two later crons.
- `npm.cmd run test:production-worker --workspace @yugm/cloudflare-worker` — passed 1/1.
- `npm.cmd run test:push-queue --workspace @yugm/cloudflare-worker` — passed 6/6.
- `npm.cmd test` from `backend-server` — admin 9/9, API 515/515, shared 27/27, zero failures.
- `npm.cmd run dry-run:production --workspace @yugm/cloudflare-worker -- --outdir "C:\Users\longl\AppData\Local\Temp\opencode\d1-worker-bundle-check2"` — emitted the D1 bundle with AUTH_DB, five R2 buckets, Images and rate limits.
- Grep of the emitted bundle — **0** `require`/`import`/`from` module references to `mongoose`, `mongodb`, `bson`, `ioredis`, `bullmq`, `sharp`, `livekit-server-sdk` or `redis-adapter`, and no `createRequire(import.meta.url)`.
- `npm.cmd run audit:d1-endpoints -- --missing` from `backend-server` — unchanged at `legacy 638 / d1 167 / matched 162 / missing 476`; this job adds no HTTP route. The command exits `1` while legacy-only patterns remain; that is expected.
- `git diff --check` — no errors, only pre-existing LF/CRLF notices (now also for `test/d1-maintenance.mjs`).

## Not run / still open

- Hosted D1 migration application, live Cron firing, deployed smoke tests and data import were not performed.
- Weekly honors, 30-day account-deletion cleanup and `runPkDeadlines` remain tied to the legacy runtime.
- The D1 job has no legacy `90/min` limiter equivalent and no D1 realtime emitter; staged hybrid realtime remains accepted.
- Admin, moderation and account-deletion routes and the remaining `/api/rooms` HTTP patterns are still not mounted on D1.

## Next action

Continue with the first bounded `/api/admin` route group, rerunning `npm.cmd run audit:d1-endpoints -- --missing` after the group. Keep MongoDB authoritative and do not deploy, provision or touch hosted data without separate authorization.
