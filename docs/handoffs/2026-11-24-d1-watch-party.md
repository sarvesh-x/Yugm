# 2026-11-24 — D1 watch-party routes

## Scope

Port the four `/api/rooms/:roomId/watch-party` patterns to the local MongoDB-free D1 Worker: start, read, host sync and stop. MongoDB remains authoritative for the deployed legacy runtime until route/job parity, reconciliation, recovery rehearsal and live acceptance pass. Work stayed on `master`; all pre-existing staged/unstaged changes and untracked files were preserved. No commit, push, deploy, provision, hosted migration, credential rotation or production data operation was performed.

## Changes applied

- Added `backend-server/apps/api/src/migration/d1WatchParty.ts` and mounted it in `d1App.ts`. The four routes cover `POST/GET/DELETE /api/rooms/:roomId/watch-party` and `PATCH /api/rooms/:roomId/watch-party/sync`.
- Start is host-only on a live room record and replaces any existing party for that room in one D1 batch, matching legacy `findOneAndDelete` + `create`. The response mirrors the legacy `WatchParty` JSON with string IDs and boolean `isPlaying`.
- Read requires only a session; sync and stop are host-scoped, returning 404 when no party exists and 403 for a non-host. Validation uses the legacy schemas (`title` 1–120, `mediaUrl` URL, `position >= 0`, `isPlaying` boolean) through the shared `validateBody`, so invalid bodies return the same 422.
- Added `backend-server/apps/cloudflare-worker/test/d1-watch-party.mjs` and wired it into `auth-worker.mjs`. The fixture covers unauthenticated read, missing party, non-host start/sync/stop, invalid body, start, read by another user, host sync persisted to D1, replacement keeping one row per room, and stop/replay.
- Fixture-driven fixes: the sync statement needed `.run()` to execute the D1 update, and the invalid-ID check needed an authenticated request.

## Legacy parity reviewed

Source: `backend-server/apps/api/src/routes/watchparty.ts`. Status codes, host guards, per-room uniqueness and response shape are preserved. The only deliberate differences are (1) an explicit 400 for a malformed room ID where legacy relied on Mongoose casting, and (2) no `watchPartyStarted`/`watchPartySync`/`watchPartyStopped` room emission because D1 still has no realtime emitter. Staged hybrid realtime remains accepted.

## Verification actually run

- `node --check` on `test/d1-watch-party.mjs` and `test/auth-worker.mjs` — passed.
- `npm.cmd run typecheck --workspace @yugm/api` and `--workspace @yugm/cloudflare-worker` — passed (both Worker tsconfigs).
- `npm.cmd run test:auth-worker --workspace @yugm/cloudflare-worker` — passed 1/1 with the new fixture.
- `npm.cmd run test:production-worker` — passed 1/1. `npm.cmd run test:push-queue` — passed 6/6.
- `npm.cmd test` from `backend-server` — admin 9/9, API 515/515, shared 27/27, zero failures.
- `npm.cmd run dry-run:production --workspace @yugm/cloudflare-worker -- --outdir "C:\Users\longl\AppData\Local\Temp\opencode\d1-worker-bundle-check3"` — emitted the D1 bundle with AUTH_DB, five R2 buckets, Images and rate limits. Grep found **0** imports/requires of `mongoose`, `mongodb`, `bson`, `ioredis`, `bullmq`, `sharp`, `livekit-server-sdk` or `redis-adapter`, and no `createRequire(import.meta.url)`.
- `npm.cmd run audit:d1-endpoints -- --missing` from `backend-server` — `legacy 638 / d1 171 / matched 166 / missing 472`; `/api/rooms` is now `40 mounted / 19 missing`. Exit `1` is expected while legacy-only patterns remain.
- `git diff --check` — no errors, only pre-existing LF/CRLF notices.

## Not run / still open

- Hosted D1 migration application, live Cron/realtime verification, deployed smoke tests and data import were not performed.
- The 19 remaining `/api/rooms` patterns span polls, room modes, messages, invites, missions, reactions, reports, gifts and PK history. Admin, moderation and account-deletion routes remain unmounted on D1.
- No D1 realtime emitter exists for watch-party events; staged hybrid realtime remains accepted.

## Next action

Continue with the polls or room-modes group of the remaining `/api/rooms` patterns, or the first bounded `/api/admin` group, rerunning `npm.cmd run audit:d1-endpoints -- --missing` after the group. Keep MongoDB authoritative and do not deploy, provision or touch hosted data without separate authorization.
