# Handoff: profile avatars in Cloudflare R2

**Date:** 2026-11-19
**Task:** YUGM-AVATAR-R2-001
**Status:** Source implementation and bounded automated checks are complete. Live R2, Mongo-backed route persistence, bucket policy/CORS, and device verification remain open.

## Delivered

- `POST /upload/avatar` now validates the image as before, enforces the 220 KB staged limit, persists under `avatars/` through `services/storage.ts`, updates `User.avatar` with the public URL, clears `activeCosmetics.avatarAsset`, and returns `{ url, storage }`. It deletes the newly stored object if the user update fails.
- Replaced managed objects are deleted best effort when an upload or profile PATCH changes the avatar. `managedAvatarKeyFromUrl` only matches the configured `S3_PUBLIC_BASE_URL` plus `avatars/`; data URLs, external images, cosmetics, and sibling folders are untouched.
- `buildPublicStorageUrl` prefers `S3_PUBLIC_BASE_URL`, rejects custom endpoints without it, and keeps the AWS virtual-hosted fallback only for standard S3. `/health` reports `endpointConfigured` and `publicUrlReady`; startup warns when an R2-style endpoint lacks a public base.
- Existing realtime invalidation (`PROFILE`, `TASKS`) and `requireAuth` remain in force. Legacy inline avatar rendering and Android setup validation are unchanged; tests pin absolute R2/data URL pass-through.
- Docs updated: [avatar R2 storage](../features/avatar-r2-storage.md), [API contracts](../API_CONTRACTS.md), [auth flow audit](../features/auth-flow-audit.md), and [development progress](../DEVELOPMENT_PROGRESS.md).

## Verification

- From `backend-server/`: `npm --workspace @yugm/api test` passed 173/173 (includes `storage.test.ts`); `npm --workspace @yugm/api run typecheck` passed.
- From `android-client/`: `.\gradlew.bat :core:api:testDebugUnitTest :feature:auth:testDebugUnitTest --console=plain` passed (`BUILD SUCCESSFUL`; core API 29/29, auth 13/13, 0 failures).
- `git diff --check` reported no whitespace errors (only Git's CRLF conversion warnings).

## Remaining before closure

1. Configure a real R2 environment: `STORAGE_DRIVER=s3`, bucket, `S3_REGION=auto`, account endpoint, scoped API token, and public base. Confirm `/health.publicUrlReady=true` and no startup warning.
2. Exercise a real upload during profile setup and profile edit: object exists under `avatars/`, `User.avatar` is an https public URL, no base64 remains for that user, and the app renders it in setup/profile/lists after restart.
3. Replace an avatar and confirm the previous managed object is deleted; verify a legacy `data:` avatar still renders and is not deleted.
4. Check bucket public-read policy and CORS (if a browser client loads avatars), plus the Cloudflare Workers runtime path if used.
5. Run Mongo-backed route tests for upload/PATCH persistence and replacement cleanup if an isolated database is available. Do not run migrations or test against production data.
