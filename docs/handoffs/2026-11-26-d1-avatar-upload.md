# 2026-11-26 — D1 direct avatar upload

## Scope

Mounted `POST /api/upload/avatar` on the shared D1 Worker. The HTTP inventory now reports 638 legacy / 619 D1 / 613 matched / 25 missing; `/api/upload` is 6/7. MongoDB remains authoritative. No hosted request, migration application, data import, deploy, provision, credential change, commit or push was performed in this slice. The previous `commit and push everything` authorization was consumed by `c2d9fd1`; these changes are uncommitted.

## Behavior preserved

- Router-scoped authentication runs before multipart parsing, matching legacy `requireAuth` → `upload.single("avatar")` → handler order. The route has no rate limiter, so none was added.
- The legacy image multer config is preserved: 5 MB multipart cap, jpg/jpeg/png/gif/webp extensions, image MIME types, and a byte-signature check. The separate 220 KB avatar limit is checked after the signature, as in the legacy handler. Exceeding it returns 400 `Avatar image is too large. Please choose or crop a smaller image.`; exceeding the multipart cap returns 413 `Uploaded file is too large`.
- The media registry insert, variant insert, previous-object supersede, and authoritative user-profile update share one guarded D1 batch. The session is revalidated at the write boundary so a logout, block, suspension, or token-generation change prevents the commit.
- The profile update mirrors the managed avatar completion: `avatar` and `avatar_media_id` are set, `avatarType` becomes `UPLOADED`, `activeCosmetics.avatarAsset` is cleared, and all `avatarParts` slots are nulled. Cached profile markers for those fields are cleared in the same batch.
- The prior avatar media object is marked superseded, and its previous public R2 key is deleted after a successful commit. Deletion is non-fatal, matching the legacy cleanup.
- The response is the legacy `{ ok: true, data: { url, storage } }` shape with `storage: "s3"`.

## D1 implementation

- Added `backend-server/apps/api/src/migration/d1AvatarUpload.ts` and mounted it at `/api/upload` in `d1App.ts`.
- `nextD1MediaVersion()` allocates `AVATAR` versions from `media_counters`, satisfying the existing owner/category/version unique index.
- Original bytes are stored in `public-media` under a server-derived `users/<userId>/avatars/<uuid>/avatar.<ext>` key. The returned API-relative URL is served by the existing public media route and resolved by Android through `resolveMediaUrl`.
- Reused `d1LiveUserFilter`, `bindD1LiveUser`, and `clearProfileMarkers` from the existing D1 profile/media code. No new binding, schema migration, or provider was added.

## Boundaries and divergence

- Legacy extension/MIME filter failures are generic `Error`s that surface as 500 in the MongoDB app. The D1 handler masks 500 messages, so they return 400 `VALIDATION` with the legacy message instead. Check order and message are preserved; the status is a deliberate D1-facing divergence.
- Legacy S3 storage returned an absolute `https://…/avatars/<filename>` URL. D1 returns `/api/media/public/<mediaId>/avatar.<ext>` through the managed public route, consistent with the managed avatar completion and other mounted upload routes.
- The direct route stores original bytes and does not run the managed session's image-processing, dimension checks, quota reservation, or private originals. Managed `COVER` sessions remain disabled.
- `POST /api/upload/trust-verification` and `GET /api/trust-verification/media/:fileName` remain legacy-only because they need paired private-media upload and authorized delivery. PK writes, deadline recovery, and socket fan-out also remain legacy-only.

## Verification

From `backend-server`:

- `npm.cmd run typecheck` — passed for admin, api, cloudflare-worker and shared workspaces.
- `npm.cmd run test:auth-worker --workspace apps/cloudflare-worker` — passed (1/1). Fixtures cover unauthenticated 401, missing file, invalid extension, invalid MIME, invalid signature, both size limits, response DTO, server-derived R2 key/bytes, registry rows, public delivery, authoritative profile fields and marker clearing, version increments, prior-object supersede, previous-key deletion, and restoration of the shared fixture state. Clean-bundle assertions still exclude `sharp`, `mongoose`, `mongodb`, `bson`, `ioredis`, `bullmq`, `redis-adapter` and `redis.ts`.
- `npm.cmd run audit:d1-endpoints -- --missing` — exit 0; 638 legacy / 619 D1 / 613 matched / 25 missing; `/api/upload` 6/7.
- `npm.cmd run secrets:check:strict` — passed.
- `git diff --check` from the repository root — no errors.

Expected `D1_SCHEMA_UNAVAILABLE`, `D1_CONFIG_REQUIRED`, 500 and scheduled-maintenance logs appeared in the Worker suite. No hosted request, Android build or legacy data operation was run.

## Next action

Pair `POST /api/upload/trust-verification` with the authorized private-media read so uploaded bytes remain retrievable, then reassess the PK write boundary. Do not apply hosted migrations, import data, commit, push, deploy or retire MongoDB without new explicit authorization.
