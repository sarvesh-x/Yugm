# 2026-11-26 — D1 AI wingman routes

## Scope

Mounted all ten `/api/ai/wingman` routes on the shared D1 Worker:

- `POST /wingman/bio/generate`
- `POST /wingman/bio/rate`
- `POST /wingman/opener`
- `POST /wingman/reply`
- `POST /wingman/coach`
- `POST /wingman/photo/rate`
- `POST /wingman/ghost/detect`
- `POST /wingman/date/plan`
- `POST /wingman/gift/recommend`
- `GET /wingman/analytics`

`/api/ai` is now 10/0 in the HTTP inventory. MongoDB remains authoritative. No hosted migration, data import, deploy, provision, credential change, commit or push was performed in this slice. The earlier commit/push of `24eb56c` remains the last authorization consumed.

## Behavior preserved

- Auth runs before validation on every POST route; `analytics` is auth-only. The legacy routes had no rate limiter, so none was added.
- The original Zod schemas, defaults and bounds are unchanged. Defaults include style `warm`, tone `casual`, opener style `casual`, reply style `friendly`, date budget `medium`, date vibe `romantic`, gift budget `medium` and gift relationship `crush`.
- Validation failures keep the shared `422 Validation failed` response with field issues.
- Response bodies keep the legacy local-template/random behavior, including bio scoring thresholds, opener/reply placeholders, coaching analysis, photo score range, ghost confidence, date plans, gift catalog filtering and analytics shape.
- The legacy router and D1 router import the same schemas and response builders from `services/aiWingman.ts`, so response generation has one source of truth.

## D1 implementation

- Added `backend-server/apps/api/src/services/aiWingman.ts` with the extracted schemas and host-neutral response builders.
- Refactored `backend-server/apps/api/src/routes/aiWingman.ts` to use that service without changing route order, auth or validation middleware.
- Added `backend-server/apps/api/src/migration/d1AiWingman.ts` and mounted it in `d1App.ts` at `/api/ai`.
- The D1 router uses `createD1AccessSessionReader(db, "http")` and `requireHttpSession`; it performs no D1 reads beyond session authorization and no writes.
- No new migration. No R2, Firebase, FCM, LiveKit or payment provider is involved.

## Boundaries and divergence

- These routes remain stateless and local: no external AI provider is called, matching the legacy implementation.
- Random output values differ per request as before. Worker fixtures assert deterministic fields and valid ranges instead of freezing random samples.
- The legacy app's global `syncInvalidation` middleware emits `sync:invalidate` with topics `SOCIAL`, `PROFILE` and `TASKS` after any successful AI POST because `/ai/*` falls through to its default topic. The D1 Worker has no socket emitter, so receiving clients are not invalidated for these routes. `GET /analytics` has no invalidation in either runtime.
- The other behavioral difference is the runtime auth reader: D1 uses the shared HTTP access-session adapter instead of the Mongoose-backed legacy reader.
- MongoDB remains authoritative until route/job parity, reconciliation, recovery rehearsal and live acceptance pass.

## Verification

From `backend-server`:

- `npm.cmd run typecheck` — passed for admin, api, cloudflare-worker and shared workspaces.
- `npm.cmd run audit:d1-endpoints -- --missing` — exit 0; 638 legacy / 596 D1 / 590 matched / 48 missing; `/api/ai` 10/0.
- `npm.cmd run test:auth-worker --workspace apps/cloudflare-worker` — passed (1/1). The new fixtures cover unauthenticated 401-before-validation, 422 schema boundaries and response shapes for all ten patterns. Existing clean-bundle assertions still exclude `sharp`, `mongoose`, `mongodb`, `bson`, `ioredis`, `bullmq`, `redis-adapter` and `redis.ts`.
- `npm.cmd run secrets:check:strict` — passed.
- `git diff --check` from the repository root — no errors; benign LF/CRLF notices appeared in previously modified source files including `routes/aiWingman.ts`.

Expected `D1_SCHEMA_UNAVAILABLE`, `D1_CONFIG_REQUIRED`, 500 and scheduled-maintenance logs appeared in the Worker run. No hosted request, migration application, data transfer or Android build was run.

## Not run / open

- Hosted D1 verification, legacy-data reconciliation, recovery rehearsal and live acceptance.
- Hosted migrations `0003`–`0035`; `0020`–`0035` are applied only in fresh local fixtures while the recovered local database remains at `0019`.
- Remaining missing routes: `/api/pk` (22), `/api/trust-verification` (10), `/api/upload` (7), `/api/discover` (6), `/api/users` (2) and `/api/dating/explore` (1).

## Next action

Continue only with another bounded group whose auth, side effects and realtime boundary are checked. Do not apply hosted migrations, import data, commit, push, deploy or retire MongoDB without new explicit authorization.
