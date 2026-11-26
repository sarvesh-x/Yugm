# 2026-11-26 — D1 voice-note and recording uploads

## Scope

Mounted `POST /api/upload/voice-note` and `POST /api/upload/recording` on the shared D1 Worker. The HTTP inventory now reports 638 legacy / 618 D1 / 612 matched / 26 missing; `/api/upload` is 5/7. MongoDB remains authoritative. No hosted request, migration application, data import, deploy, provision, credential change, commit or push was performed. The earlier `commit and push everything` authorization was consumed by `a770475`; these changes remain uncommitted.

## Behavior preserved

- Router-scoped authentication runs before multipart parsing, matching legacy `requireAuth` → multer → handler order. Neither legacy upload route has a rate limiter, so none was added.
- Voice-note accepts the legacy `.mp3`, `.m4a`, `.aac`, `.wav`, `.webm`, `.ogg` extensions with audio MIME types (or `video/webm`). Recording accepts those plus `.mp4`, `.mov`, `.m4v` with audio/video MIME types. The legacy validation messages are preserved.
- The voice-note cap is 10 MB. The recording cap is also 10 MB because the legacy `uploadLimit(200 MB)` clamps to 10 MB when `YUGM_RUNTIME === "cloudflare"`.
- Neither legacy handler performs a byte-signature check. The D1 routes intentionally do not add one.
- Original bytes are stored in `public-media` under server-derived keys `users/<userId>/voice-messages/<uuid>/voice_note.<ext>` and `users/<userId>/attachments/<uuid>/recording.<ext>`. Client file names never become storage keys.
- A public `media_objects` row and matching `media_variants` row commit before the response. The R2 object is deleted if that commit fails. The response is the legacy `{ ok: true, data: { url, type, storage } }` shape with `storage: "s3"`; voice is always `AUDIO`, and recording is `AUDIO` or `VIDEO` from its MIME type.
- Neither legacy route writes a user, room, recording or chat row, so the D1 routes add no authoritative document write, notification, socket emit, job or `sync:invalidate` emit.

## D1 implementation

- Added `backend-server/apps/api/src/migration/d1AudioUpload.ts` and mounted it at `/api/upload` in `d1App.ts`.
- Owner/category versions come from `nextD1MediaVersion()` in `d1Media.ts`, using `VOICE_MESSAGE` for voice notes and `ATTACHMENT` for recordings. This satisfies the existing `idx_media_objects_owner_version` unique index without a migration.
- Extended `PUBLIC_VARIANT` in `d1Media.ts` so the existing public delivery route serves `.mp3`, `.m4a`, `.aac`, `.wav` and `.ogg` variants with their stored content type and immutable cache header.
- `apps/cloudflare-worker/src/d1Api.ts` routes the two exact upload paths to the D1 app under the existing media-enabled configuration. No new binding or provider was added.

## Boundaries and divergence

- Legacy extension/MIME filter failures are generic `Error`s that surface as 500 in the MongoDB app. The D1 handler masks 500 messages, so both routes emit 400 `VALIDATION` with the legacy message instead. Check order and message are preserved; the status is a deliberate D1-facing divergence.
- Legacy storage folders were `voice-notes` and `recordings`; D1 uses the managed `voice-messages` and `attachments` folders. The returned URL is served by the existing public media route and remains API-relative, which Android already resolves through `resolveMediaUrl`.
- Direct avatar and trust-verification uploads remain legacy-only. Managed `COVER` upload sessions remain disabled. Live Android upload QA and hosted R2 verification were not run.
- The Worker suite needed two test-only determinism fixes: the admin KYC fixture now selects a user without an existing KYC row, and the reports rollback fixture compares against a captured baseline count instead of a hard-coded count. Earlier fixtures made both assertions depend on fixture ordering.

## Verification

From `backend-server`:

- `npm.cmd run typecheck` — passed for admin, api, cloudflare-worker and shared workspaces.
- `npm.cmd run test:auth-worker --workspace apps/cloudflare-worker` — passed (1/1). New fixtures cover unauthenticated 401 on both routes, missing file, invalid extension, invalid MIME, oversize, image-independent response DTOs, server-derived R2 keys/bytes, media object and variant rows, public delivery, version increments, and cleanup. Clean-bundle assertions still exclude `sharp`, `mongoose`, `mongodb`, `bson`, `ioredis`, `bullmq`, `redis-adapter` and `redis.ts`.
- `npm.cmd run audit:d1-endpoints -- --missing` — exit 0; 638 legacy / 618 D1 / 612 matched / 26 missing; `/api/upload` 5/7.
- `npm.cmd run secrets:check:strict` — passed.
- `git diff --check` from the repository root — no errors; benign LF/CRLF notices remain in `d1LiveKit.ts`, `d1Media.ts`, `d1-admin.mjs` and `d1-reports.mjs`.

Expected `D1_SCHEMA_UNAVAILABLE`, `D1_CONFIG_REQUIRED`, 500 and scheduled-maintenance logs appeared in the Worker suite. No hosted request, Android build or legacy data operation was run.

## Next action

Continue only with a bounded route group whose auth, side effects and realtime boundary are checked. Avatar and trust-verification uploads need separate handling for user/private-media semantics; do not apply hosted migrations, import data, commit, push, deploy or retire MongoDB without new explicit authorization.
