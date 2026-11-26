# 2026-11-26 — D1 profile-media and story uploads

## Scope

Mounted `POST /api/upload/profile-media` and `POST /api/upload/story` on the shared D1 Worker. The HTTP inventory now reports 638 legacy / 616 D1 / 610 matched / 28 missing; `/api/upload` is 3/7. This slice also amends the earlier cover upload so repeated covers allocate new owner/category versions instead of colliding on the `media_objects` unique index. MongoDB remains authoritative. No hosted request, migration application, data import, deploy, provision, credential change, commit or push was performed. The earlier `commit and push everything` authorization was consumed by `a770475`; these changes remain uncommitted.

## Behavior preserved

- Router-scoped authentication runs before multipart parsing, matching legacy `requireAuth` → `profileMediaUpload.single("media")` → handler validation order. The legacy upload surface has no rate limiter, so none was added.
- Both routes accept the legacy jpg/jpeg/png/gif/webp/mp4/mov/m4v/webm extensions with matching image/video MIME types. A 10 MB cap is used because the legacy config clamps its 25 MB limit to 10 MB on the Worker runtime.
- Image and video byte signatures are checked with the same rules as the legacy file-based helpers. Missing files return 400 `No file uploaded`; invalid media returns 400 `Invalid media file`; oversize returns 413 `Uploaded file is too large`.
- Original bytes are stored in `public-media` under a server-derived `users/<userId>/gallery/<uuid>/<profile|story>.<ext>` key. Client file names never become storage keys.
- A public `media_objects` row and a matching `media_variants` row are committed before the response. The R2 object is deleted if that commit fails. The response is the legacy `{ ok: true, data: { url, type, storage } }` shape with `storage: "s3"`.
- Neither legacy route writes a user, story or chat row, so the D1 routes add no authoritative document write, notification, socket emit, job or `sync:invalidate` emit.

## D1 implementation

- Added `backend-server/apps/api/src/migration/d1ProfileMediaUpload.ts` and mounted it at `/api/upload` in `d1App.ts`.
- Exported `nextD1MediaVersion(db, userId, category)` from `d1Media.ts`. It uses the existing `media_counters` table and replaces the previous AVATAR-only helper. Cover uploads use `COVER` versions and profile-media/story uploads share `GALLERY` versions, satisfying the existing `idx_media_objects_owner_version` unique index without a migration.
- Extended `PUBLIC_VARIANT` in `d1Media.ts` so the existing public delivery route serves mp4/mov/m4v/webm variants with their stored content type and immutable cache header.
- `apps/cloudflare-worker/src/d1Api.ts` routes exact `/api/upload/profile-media` and `/api/upload/story` paths to the D1 app under the existing media-enabled configuration. No new binding or provider was added.

## Boundaries and divergence

- Legacy extension/MIME filter failures are generic `Error`s that surface as 500 in the MongoDB app. The D1 handler masks 500 messages, so both routes emit 400 `VALIDATION` with the legacy message instead. The check order and message are preserved; that error status is a deliberate D1-facing divergence.
- The Node runtime limit is 25 MB, but the legacy Worker config already clamps it to 10 MB. The D1 route follows the Worker boundary.
- Legacy storage folders were `profile-media` and `stories`; D1 uses the managed `gallery` folder with `profile`/`story` variant names. The returned URL is served by the existing public media route and remains API-relative, which Android already resolves through `resolveMediaUrl`.
- Direct avatar, trust-verification, voice-note and recording uploads remain legacy-only. Managed `COVER` upload sessions remain disabled; direct cover upload keeps its own 5 MB cap. Live Android upload QA and hosted R2 verification were not run.

## Verification

From `backend-server`:

- `npm.cmd run typecheck` — passed for admin, api, cloudflare-worker and shared workspaces.
- `npm.cmd run test:auth-worker --workspace apps/cloudflare-worker` — passed (1/1). Fixtures cover unauthenticated 401 on both routes, missing file, invalid extension, invalid MIME, invalid image/video signatures, oversize, image and video response DTOs, server-derived R2 keys, media object and variant rows, public delivery, version increments, and cleanup. They also cover a second direct cover upload. Clean-bundle assertions still exclude `sharp`, `mongoose`, `mongodb`, `bson`, `ioredis`, `bullmq`, `redis-adapter` and `redis.ts`.
- `npm.cmd run audit:d1-endpoints -- --missing` — exit 0; 638 legacy / 616 D1 / 610 matched / 28 missing; `/api/upload` 3/7.
- `npm.cmd run secrets:check:strict` — passed.
- `git diff --check` from the repository root — no errors; benign LF/CRLF notices remain in `d1LiveKit.ts` and `d1Media.ts`.

Expected `D1_SCHEMA_UNAVAILABLE`, `D1_CONFIG_REQUIRED`, 500 and scheduled-maintenance logs appeared in the Worker suite. No hosted request, Android build or legacy data operation was run.

## Next action

Continue only with another bounded upload or route group whose auth, side effects and realtime boundary are checked. Do not apply hosted migrations, import data, commit, push, deploy or retire MongoDB without new explicit authorization.
