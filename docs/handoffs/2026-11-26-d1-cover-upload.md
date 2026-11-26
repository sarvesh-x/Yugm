# 2026-11-26 — D1 cover upload

## Scope

Mounted `POST /api/upload/cover` on the shared D1 Worker. The other six legacy `/api/upload` patterns remain legacy-only. The HTTP inventory now reports 638 legacy / 614 D1 / 608 matched / 30 missing; `/api/upload` is 1/7. MongoDB remains authoritative. No hosted request, migration application, data import, deploy, provision, credential change, commit or push was performed in this slice. The earlier `commit and push everything` authorization was consumed by `a770475`; these changes remain uncommitted.

## Behavior preserved

- Authentication runs before multipart parsing, matching legacy `requireAuth` → `multer.single("cover")` → handler validation order. There is no upload rate limiter in the legacy route, so none was added.
- The multipart parser uses a 5 MB file cap, accepts only `jpg`, `jpeg`, `png`, `gif` and `webp` extensions with an `image/*` MIME type, then checks the image byte signature. Oversize requests return the legacy 413 `Uploaded file is too large` mapping; a missing file returns 400 `No file uploaded`.
- The route has no room ID or room ownership context, so it performs no new authorization check; it derives the storage key from the authenticated user ID and fresh UUIDs. Client file names never become storage keys.
- Original bytes are stored in the managed `public-media` R2 bucket under `users/<userId>/covers/<uuid>/cover.<extension>`. A public `media_objects` row and a `cover` `media_variants` row are committed together before the response. The R2 object is deleted if that commit fails.
- The response is the legacy `{ ok: true, data: { url, storage } }` shape with `storage: "s3"`. The URL is served by the existing public media route and remains API-relative, which Android already resolves through `resolveMediaUrl`.
- No user document, notification, socket emit, job, `sync:invalidate` emit or other authoritative state is written by the legacy cover route; the D1 route adds none.

## D1 implementation

- Added `backend-server/apps/api/src/migration/d1CoverUpload.ts` and mounted it in `d1App.ts` at `/api/upload`.
- `apps/cloudflare-worker/src/d1Api.ts` routes `/api/upload/cover` to the D1 Worker under the existing media-enabled configuration. It uses the existing R2 bindings, public-origin header and clean bundle boundary; no new binding or provider was added.
- No migration was added. The existing `media_objects` and `media_variants` tables already accept `COVER`, `PUBLIC`, `READY` and `APPROVED`.

## Boundaries and divergence

- The managed upload-session flow still enables only `AVATAR`; this route intentionally does not enable `COVER` sessions or change `mediaUploadLimits.COVER`, which is 10 MB. The legacy cover route's 5 MB cap remains authoritative here.
- A later same-day fix in the profile-media/story slice allocates `COVER` versions from `media_counters`, so repeated cover uploads no longer collide on `idx_media_objects_owner_version`. The route contract is unchanged. [Version fix](2026-11-26-d1-profile-media-and-story-uploads.md)
- Legacy extension/MIME filter failures are generic `Error`s that surface as 500 in the MongoDB app. The D1 global handler masks 500 messages, so the new router emits 400 `VALIDATION` with the legacy message instead. The check order and message are preserved; that error status is a deliberate D1-facing divergence.
- Legacy S3 and GridFS returned a public storage URL ending in `/covers/<filename>` and a driver-dependent `storage` value. D1 returns a public media URL and `storage: "s3"` because R2 is the only storage sink in this Worker.
- The remaining upload routes (avatar, profile-media, trust-verification, story, voice-note, recording) still need their own side-effect and compatibility review. Live Android upload QA and hosted R2 verification are not part of this slice.

## Verification

From `backend-server`:

- `npm.cmd run typecheck` — passed for admin, api, cloudflare-worker and shared workspaces.
- `npm.cmd run test:auth-worker --workspace apps/cloudflare-worker` — passed (1/1). New fixtures cover unauthenticated 401, missing file, invalid extension, invalid MIME, invalid signature, oversize, `{ url, storage }` response shape, server-derived R2 key, media object and variant rows, public delivery and cleanup. Existing clean-bundle assertions still exclude `sharp`, `mongoose`, `mongodb`, `bson`, `ioredis`, `bullmq`, `redis-adapter` and `redis.ts`.
- `npm.cmd run audit:d1-endpoints -- --missing` — exit 0; 638 legacy / 614 D1 / 608 matched / 30 missing; `/api/upload` 1/7.
- `npm.cmd run secrets:check:strict` — passed.
- `git diff --check` from the repository root — no errors; one benign LF/CRLF notice in `d1LiveKit.ts`.

Expected `D1_SCHEMA_UNAVAILABLE`, `D1_CONFIG_REQUIRED`, 500 and scheduled-maintenance logs appeared in the Worker suite. No hosted request, Android build or legacy data operation was run.

## Next action

Continue only with another bounded group whose auth, side effects and realtime boundary are checked. Do not apply hosted migrations, import data, commit, push, deploy or retire MongoDB without new explicit authorization.
