# Centralized Cloudflare R2 media and asset storage

**Date:** 2026-11-22
**Status:** Foundation + avatar slice implemented in the working tree; not committed, provisioned, migrated or deployed.

## Purpose

Cloudflare R2 is the canonical persistent object store for Yugm media. This document describes the single storage service, single media registry, upload-session protocol and the first wired vertical slice (profile avatars). Other media categories still use the legacy multipart/storage path until their own cutover slices are approved.

## Buckets and configuration

Five logical storage classes are resolved only on the server:

| Logical class | Required env | Purpose |
|---|---|---|
| `assets` | `R2_ASSETS_BUCKET`, `R2_ASSETS_PUBLIC_URL` | Published admin/cosmetic/badge/application art |
| `public-media` | `R2_PUBLIC_MEDIA_BUCKET`, `R2_MEDIA_PUBLIC_URL` | Public user/room/community media and derived variants |
| `private-media` | `R2_PRIVATE_MEDIA_BUCKET` | Media delivered only after resource-level authorization |
| `originals` | `R2_ORIGINALS_BUCKET` | Private provenance originals for rollback/moderation |
| `staging` | `R2_STAGING_BUCKET` | Short-lived, client-unreadable upload staging |

`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` are server-only. The API derives an account-scoped S3 endpoint (`https://<ACCOUNT_ID>.r2.cloudflarestorage.com`), `region=auto`, and effective credentials from them. Explicit `S3_*` values still win, preserving legacy S3/emulator deployments. `R2_SIGNED_URL_TTL_SECONDS` (60–3600, default 900) bounds presigned grants.

Managed uploads require `STORAGE_DRIVER=s3`; otherwise session creation fails with `503` and the Android avatar flow falls back to the legacy multipart endpoint. Never put R2 credentials, bucket names, keys or signed URLs in Android/admin/API responses, logs, build config or analytics.

### Configuration procedure

Values are supplied by the owner and written locally; they must not be pasted into chat, source files, tracked Wrangler config, CI logs or analytics. The preflight prints only key names and set/blank status, never values.

1. **Local Node API:** fill the existing ignored `backend-server/apps/api/.env` with `STORAGE_DRIVER=s3`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, the five `R2_*_BUCKET` names, `R2_ASSETS_PUBLIC_URL` and `R2_MEDIA_PUBLIC_URL`. Then run `cd backend-server && npm run env:check`. `env:check` fails with the exact missing key names when `s3` is selected without endpoint, credentials, buckets or a public URL.
2. **Local Worker:** create ignored `backend-server/apps/cloudflare-worker/.dev.vars` with the same keys. `apps/cloudflare-worker/src/index.ts:86–88` copies string bindings into `process.env`, so no `r2_buckets` binding is required for this S3-API path. Run `npm run dev --workspace apps/cloudflare-worker`.
3. **Deployed staging/production:** bucket names and `STORAGE_DRIVER` are non-secret per-environment configuration; the API token ID/secret and any provider secrets belong in Wrangler secrets or the deployment secret store, not in tracked `vars`. Set them interactively, for example `npx wrangler secret put R2_ACCESS_KEY_ID --config apps/cloudflare-worker/wrangler.staging.jsonc` (repeat for `R2_SECRET_ACCESS_KEY`, `R2_ACCOUNT_ID` and any other secret). The current Wrangler configs still set `STORAGE_DRIVER=mongodb`; switching an environment to `s3` is a deploy-affecting change that requires separate approval and must not be done before the corresponding secrets and buckets exist.
4. **Cloudflare-side prerequisites (owner action):** create one bucket per logical class per environment, set the staging bucket to expire incomplete objects, allow the app origin for presigned PUT on the staging bucket, and bind custom domains/CDN for the two public buckets. No bucket, credential, domain or CORS change is made by this repository.
5. **Verification after values are in place:** `npm run env:check`, `npm run test --workspace apps/api`, `npm run typecheck --workspace apps/api`, then a live create→PUT→complete→download→cancel cycle against the intended environment with the signed URL kept out of logs. A green preflight is not proof that buckets, CORS or credentials are valid at runtime.

### Release clients

Release builds derive the HTTPS API and socket URLs from `YUGM_PRODUCTION_ORIGIN`. The production Worker uses native R2 bindings, with hosted media disabled in the checked-in configuration pending budget and live verification. The client receives short-lived upload grants and committed media URLs at runtime. See [release build configuration](release-build-configuration.md).

## Storage service

`backend-server/apps/api/src/services/r2.ts` is the only implementation of object operations:

- `uploadObject`, `getObject`, `deleteObject`, `objectExists`, `getObjectMetadata`
- `generateUploadUrl`, `generateDownloadUrl`, `resolvePublicUrl`, `copyObject`, `calculateChecksum`
- server-owned key builders (`buildMediaKey`, `buildStagingKey`) and version IDs

Keys are structured as `<owner-folder>/<owner-id>/<category-folder>/<version-id>/<variant>.<ext>` and accept only validated enums, opaque IDs and safe segments. Clients never choose a bucket, key, owner or public path. Private/staging buckets have no `resolvePublicUrl()` result. Public URLs are built from the configured CDN base and include the immutable version/key.

## Registry and upload sessions

`MediaObject` is the single registry. It records owner/type/category, canonical bucket/key, content type, size, dimensions, duration, checksum, visibility, processing/moderation status, version, timestamps, soft deletion and `supersededById`. Variants are separate records containing bucket/key/content type/bytes/dimensions; only public bucket variants are exposed, and their URLs are resolved from keys at read time. Expiring signed URLs are never persisted.

`MediaUploadSession` records the actor, expected category/MIME/bytes, owner derived from the authenticated identity, staging key, TTL, status (`PENDING`/`PROCESSING`/`COMPLETED`/`CANCELLED`/`EXPIRED`/`FAILED`), attempts, quota-reservation flag and resulting media ID. Quota checks sum committed media bytes and read an atomically incremented reservation counter for live sessions; the conditional increment closes the concurrent-session race. Cancellation, expiry, failure and completion release the reservation exactly once.

## HTTP contract

| Route | Behavior |
|---|---|
| `POST /api/media/uploads` | Authenticated. Creates a private staging grant. Body: `category`, `contentType`, `fileName` (extension only; path separators rejected), integer `bytes`. Response: `sessionId`, presigned PUT `uploadUrl`, required `Content-Type`, `expiresAt`/`expiresIn`, `maxBytes`. |
| `POST /api/media/uploads/{sessionId}/complete` | Authenticated. Atomically claims the session, re-reads staged bytes, verifies size/signature/MIME-compatible image metadata, produces variants, copies a private original, writes the registry, then updates the owning entity. Repeats after success return the committed result. |
| `DELETE /api/media/uploads/{sessionId}` | Authenticated and owner-scoped. Idempotently cancels a pending session and best-effort deletes the staging object. |
| `GET /api/media/{mediaId}/download` | Authenticated. Checks ownership/message participation, block state, deletion, moderation and processing status before returning a short-lived signed URL in that response only. |

Only `AVATAR` is currently accepted by `POST /media/uploads`; other categories return `400` until wired. `/upload/avatar` remains the documented legacy fallback for deployments without R2.

`syncInvalidation` emits `PROFILE` + `TASKS` for successful managed avatar completion, matching legacy avatar upload. Session creation, cancellation and download do not emit mutation invalidation.

## Avatar vertical slice

Android `MediaUploadApi` creates a session, PUTs the already-thumbnailed bytes directly to the presigned R2 URL, then completes the session. The presigned request uses a dedicated OkHttp client with no logging interceptor so the signed URL is never written to logcat. Progress events carry the session ID, enabling cancellation to revoke the grant and abort the in-flight request. Create Profile and Edit Profile now expose progress and Cancel; generated/offline avatars and legacy `data:` URLs remain untouched. If session creation returns `503`/`501`, only that narrow case falls back to multipart; later failures are surfaced instead of silently switching storage systems.

The server commits `User.avatar` only after all objects and registry rows exist. `avatarMediaId` links the user to the registry entry. The previous managed version is preserved and marked `supersededById` for rollback/reconciliation instead of being deleted immediately. `activeCosmetics.avatarAsset` is cleared and `avatarParts` unset on managed upload.

## Caching and private media

Public variants use immutable versioned keys with `Cache-Control: public, max-age=31536000, immutable`; replacements get a new URL. Private/original/staging objects use `private, no-store`. Android continues to use the shared Coil path and `resolveMediaUrl()`; no composable constructs storage URLs. Private delivery requires short-lived signed URLs after resource-level checks; caches must remain account-isolated on switch. Coil cache clearing on account switch is not implemented in this slice.

## Database and migration

Migration 9 adds additive indexes for `mediaobjects` (owner/category/version, checksum, superseded, deleted) and `mediauploadsessions` (user/status, expiry). It does not rewrite existing media URLs or user documents. `MediaObject` and `MediaUploadSession` are registered in `productionIndexes.ts`. Migrations 6–9 have not been applied.

## Verification and limits

Run and passing in this working tree: API typecheck; API tests 221/221 (11 R2/media unit tests, 6 in-memory Mongo + fake-S3 service integration tests including concurrent-grant quota coverage, 5 HTTP route integration tests, and sync-invalidation assertions); hardening 34/34; admin typecheck and production build; bounded Android compiles (`:core:api`, `:feature:auth`, `:feature:profile`), `:core:api`/`:core:ui` unit-test tasks, and `:core:api:testDebugUnitTest` 38/38 with five new upload-client tests; `npx --yes swagger-cli validate apps/api/openapi.yaml` (after quoting comma-bearing descriptions and adding missing referral response descriptions); `git diff --check` (line-ending notices only).

Not run / still required: real R2 provisioning and live upload→publish→read→archive, migration application, R2 CORS/public-policy checks, device/emulator visual QA, full Android lint/assemble, two-client realtime validation, and migration-tooling dry runs. No credentials were provisioned and no deployment or migration was performed.

## Remaining phases

1. Wire covers, gallery, chat media, voice notes, trust verification, store/cosmetic and achievement assets through the same session protocol and registry; retire per-category renderers/uploaders only after parity.
2. Add admin media stats, category/status/failure views, preview, versions, usage references, moderation, audit, orphan/quota reports, and keep cosmetic asset management separate from user-media moderation.
3. Add reconciliation tooling (dry-run/copy/verify/record/update/status) with rollback mappings and legacy retention, plus R2 lifecycle rules for staging/incomplete objects.
4. Complete private-media authorization across all message/conversation types and add account-switch cache isolation.
