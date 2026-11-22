# Profile avatar storage in Cloudflare R2

**Date:** 2026-11-19 (updated 2026-11-22)
**Scope:** Profile avatar upload, replacement cleanup, and client visualization. Other media folders use the same storage abstraction when `STORAGE_DRIVER=s3` is enabled.

> **Current flow:** the centralized R2 upload-session protocol is now the primary avatar path. See [Centralized Cloudflare R2 media and asset storage](r2-centralized-media.md) for buckets, registry, session lifecycle, authorization and rollout status. The multipart contract below remains the legacy fallback only when R2 is not configured (`503`/`501` at session creation).

## Contract

- Android uploads a client-thumbnailed image to `POST /api/upload/avatar` (multipart field `avatar`) and uses the returned `data.url` for preview/display.
- The API validates auth, extension, MIME, image signature, and a 220 KB staged-file limit.
- The file is persisted through the existing `services/storage.ts` abstraction under the `avatars/` folder. With `STORAGE_DRIVER=s3` this is the configured S3-compatible bucket (Cloudflare R2). `User.avatar` stores the public URL, not a base64 payload.
- Each upload uses a unique immutable key (`avatars/<userId>_<timestamp>_<random>.<ext>`) so a replacement gets a new URL and cache entry.
- Successful upload clears `activeCosmetics.avatarAsset` and publishes the existing per-user `sync:invalidate` topics (`PROFILE`, `TASKS`) through `syncInvalidation`.
- When an upload or profile PATCH replaces a **managed** avatar URL, the previous object under `avatars/` is deleted best effort. Legacy data URLs, cosmetic assets, and external images are never deleted.
- Blank optional profile values remain omissions; they do not erase the already-committed avatar. Legacy `data:image/...` avatars remain displayable and are not migrated automatically.

## Required configuration (R2 as S3)

| Variable | Value |
|---|---|
| `STORAGE_DRIVER` | `s3` |
| `S3_BUCKET` | R2 bucket name |
| `S3_REGION` | `auto` (R2 convention) |
| `S3_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | R2 API token credentials scoped to the bucket |
| `S3_PUBLIC_BASE_URL` | Public bucket base, e.g. `https://pub-<id>.r2.dev` or a custom domain, without a trailing slash |

`S3_PUBLIC_BASE_URL` is required when a custom `S3_ENDPOINT` is used. Uploads fail loudly rather than emitting an unusable AWS-style URL; `/health` reports `publicUrlReady` and startup logs a warning when the pair is incomplete.

## Bucket and token checklist

1. Enable public read for `avatars/` objects (r2.dev public URL or a custom domain) so Android/Coil can load them without signed URLs. Do not make private trust-verification media public.
2. Scope the R2 token to `PutObject`, `GetObject`, and `DeleteObject` on the bucket (or at least `avatars/*` when object storage is avatar-only).
3. Keep `Cache-Control: public, max-age=31536000, immutable` as emitted by the storage service; replacements use a new key.
4. If a browser/admin client loads avatar URLs directly, allow `GET`/`HEAD` from its origins. Native Android does not need CORS.
5. With the Cloudflare Workers runtime (`YUGM_RUNTIME=cloudflare`), uploads still use request-scoped temp files; verify the R2 path there separately from Node.

## Managed R2 avatar slice (2026-11-22)

- Primary upload is `POST /api/media/uploads` (category `AVATAR`) → presigned private staging PUT → `POST /api/media/uploads/{id}/complete`. The server verifies staged bytes, writes 64/128/256 WebP variants plus a private original, creates a `MediaObject`, then atomically updates `User.avatar`/`avatarMediaId`.
- Public registry DTOs resolve URLs from canonical keys at read time; no signed URL or expiring token is persisted. The previous avatar is preserved as `supersededById` rather than deleted.
- Android exposes upload progress and cancellation in Create Profile and Edit Profile. Presigned PUTs use a non-logging OkHttp client. Legacy multipart runs only when session creation reports R2 unconfigured.

## Verification state

- Backend unit coverage: public URL base selection, custom-endpoint failure, AWS fallback, and managed-avatar key matching (`src/services/storage.test.ts`); structured keys, CDN-only public URLs and checksums (`src/services/r2.test.ts`); upload validation, image signatures and signed-URL non-disclosure (`src/services/media.test.ts`).
- Android unit coverage: absolute R2/data URL pass-through and API-relative media resolution (`core/api/.../MediaUrlResolutionTest.kt`), plus hosted R2 URL acceptance in profile setup validation.
- Not verified in this change: a live R2 upload/read/delete against a real bucket, Mongo-backed upload/route persistence, Android device rendering, and R2 CORS/public policy behavior. Confirm when the deployment env and bucket are available.

## Optional follow-up

A backfill job can move existing `data:image/...` avatars into `avatars/<userId>/...` in R2 and update `User.avatar`. It needs dry-run, throttling, checksum/size reporting, and backups; it is not part of this change.
