# 2026-11-25 — D1 moderation text checks

## Scope

Mounted the two stateless moderation check routes on the shared D1 Worker:

- `POST /api/v1/moderation/check-text`
- `POST /api/v1/moderation/check-voice`

`POST /api/v1/moderation/report`, `POST /api/v1/moderation/appeal` and `GET /api/v1/moderation/status` remain legacy-only. The existing D1 reports router applies stricter evidence, room-access and auto-mute rules than the older v1 report route, and the v1 appeal/status handlers use different error and safety-status semantics. Porting those three would not be a behavior-preserving small slice.

MongoDB remains authoritative. No migration, hosted operation, data import, deploy, provision, credential change, commit or push was performed.

## Behavior characterized from source

- `apps/api/src/routes/moderation.ts` applies `requireAuth` before either body check and calls the `moderateContent` re-export from `services/autoModeration.ts`.
- The actual keyword/regex logic is host-neutral in `apps/api/src/services/contentModeration.ts`. `autoModeration.ts` also imports Mongoose models, so the D1 router imports `contentModeration.ts` directly and stays free of MongoDB dependencies.
- `check-text` validates `text` as a 1–2000 character string and an optional `context` enum defaulting to `chat`. A Zod validation failure is thrown directly to the generic error handler, producing `500` with `code: "INTERNAL"` and the Zod issue text rather than a `422`.
- Both responses hardcode empty AI flags and zero toxicity scores. `check-text` additionally returns `isBlocked`, `topLabel`, `aiModelReady` and `aiModelLoading`; `check-voice` does not.
- `check-voice` manually rejects a missing or non-string transcript with a bare `400 { ok: false, error: { message: "Transcript is required" } }` body that has no `code` or `requestId`.

## D1 implementation

- `backend-server/apps/api/src/migration/d1Moderation.ts` owns both routes and is mounted as `app.use("/api", createD1ModerationRouter(db))`.
- `requireHttpSession` runs before Zod parsing or transcript checks, matching the legacy router-scoped auth order.
- `check-text` uses `safeParse` and writes the legacy `500 INTERNAL` body directly. The shared D1 error handler masks all 500 messages as `Unexpected server error`, so the route preserves the legacy Zod message and `requestId` itself.
- The route outputs the same response keys and zero-value placeholders as the legacy handler. Unknown body fields are stripped by Zod as before.
- The router performs no D1 writes. Notifications, reports, moderation actions and safety statuses are untouched.

## Verification run

From `backend-server`:

- `npm.cmd run typecheck` — passed for admin, api, cloudflare-worker and shared workspaces.
- `node --check apps\\cloudflare-worker\\test\\d1-moderation.mjs` — passed.
- `node --check apps\\cloudflare-worker\\test\\auth-worker.mjs` — passed.
- `npm.cmd run test:auth-worker --workspace @yugm/cloudflare-worker` — passed, 1/1. The fixture also asserts the emitted Worker bundle contains no `sharp`, `mongoose`, `mongodb`, `bson`, `ioredis`, `bullmq`, `redis-adapter` or `redis.ts` input. Expected schema-unavailable, config-required, 500, scheduled-maintenance and push-delivery logs were present.
- `npm.cmd run audit:d1-endpoints -- --missing` — exit 0; legacy 638 / D1 304 / matched 299 / missing 339; `/api/v1` is 2 mounted / 3 missing. The audit is an inventory and reports remaining patterns rather than failing the command.
- `git diff --check` from the repository root — no errors; only benign LF/CRLF notices.

The Worker fixture covers auth before validation, clean/default context parsing, explicit context, flag ordering and severity, high-severity blocking, pattern flags, the legacy 500 Zod body, voice transcript validation and voice flags, plus a notification-count check confirming the routes are read-only.

`npm.cmd run secrets:check:strict` had passed earlier in the session with no tracked credential-bearing assignments. `npm.cmd run worker-config:check` remains report-only and unchanged: two pre-existing findings for staging and production query-string redaction. Neither check was rerun for this route-only slice.

## Not run / open

- Hosted verification, data import, deploy, provision, credential changes and MongoDB retirement.
- `/api/v1/moderation/report`, `/appeal` and `/status` remain legacy-only with their distinct DTO and error semantics.
- No D1 replacement exists for the legacy moderation queue and action state used by the remaining v1 routes or the admin moderation surface.

## Next action

Continue with the next bounded durable-state group only after its behavioral boundary is checked. Do not apply hosted migrations, import data, commit, push, deploy or retire MongoDB without new explicit authorization.
