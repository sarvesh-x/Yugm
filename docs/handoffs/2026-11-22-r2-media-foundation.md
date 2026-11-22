# Handoff: Centralized R2 media foundation + avatar slice

**Date:** 2026-11-22
**Task:** YUGM-R2-001 (mandatory infrastructure — Cloudflare R2 centralized media and asset storage)
**State:** Implemented in the working tree and compile/unit verified; **not committed**, provisioned, migrated or deployed.

## What is in place

### Backend

- `src/config/env.ts`: optional `R2_*` schema; derives the account-scoped R2 endpoint, `auto` region and effective S3 credentials; explicit `S3_*` overrides remain authoritative; warns when R2 is set without `STORAGE_DRIVER=s3` or without public delivery URLs.
- `src/services/storage.ts`: exports the shared `getManagedS3Client()` used by legacy and R2 paths.
- `src/services/r2.ts`: the only object-storage service (upload/get/delete/exists/metadata/sign/copy/checksum), five logical buckets, safe key builders and CDN URL resolution.
- `src/models/MediaObject.ts`, `src/models/MediaUploadSession.ts`, `src/models/MediaQuotaReservation.ts`: unified registry, session state and atomic per-user upload quota counter. Migration 9 adds additive indexes; registry/session models are in `productionIndexes.ts`.
- `src/services/media.ts`: session create/cancel/complete, atomic quota reservation/release, validation, sharp optimization/avatar variants, private original copy, atomic avatar reference commit, previous-version preservation, public DTO and authorized private download.
- `src/routes/media.ts` mounted in `app.ts`; `syncInvalidation.ts` maps successful managed avatar completion to `PROFILE`+`TASKS`.
- OpenAPI and `.env.example` document the new contract and server-only configuration.

### Android

- `core/api/MediaUploadApi.kt`: creates sessions, validates grants through a pure helper, PUTs to presigned storage, completes/cancels. `YugmHttpClient` has a separate no-logging client and chunked `ProgressRequestBody` with cancellation; five unit tests pin grant validation and progress/cancel behavior.
- `IYugmApi`, `YugmApi`, `RoomApi`, `AuthRepository` expose `uploadAvatarWithProgress`/`cancelMediaUpload`. Legacy multipart is used only when session creation returns `503`/`501`.
- `ProfileSetupViewModel` and `ProfileViewModel` own network/progress/cancel state. Create Profile and Edit Profile render a determinate progress bar and Cancel; generated avatars and legacy data URLs are unchanged.

## Verification actually run

- `npm.cmd --workspace @yugm/api run typecheck` — exit 0.
- `npm.cmd --workspace @yugm/api test` — 221/221 passed (199 prior + 7 `media.test.ts` + 4 `r2.test.ts` + 6 `media.integration.test.ts` + 5 `media.routes.integration.test.ts`; sync-invalidation assertions extended).
- `npx tsx --test src/services/media.integration.test.ts` — 6/6 passed using `mongodb-memory-server` and a mocked S3 client (no external services), including five repeated runs of the concurrent-grant quota test.
- `npx tsx --test src/services/media.routes.integration.test.ts` — 5/5 passed against an Express server with real auth middleware, in-memory Mongo and a mocked S3 client.
- `npm.cmd --workspace @yugm/api run test:hardening` — 34/34 passed.
- `npm.cmd --workspace @yugm/admin run typecheck` and `run build` — passed; generated `dist/` changes reverted to `HEAD`.
- Android Studio JBR, `--offline`: `:core:api:compileDebugKotlin`, `:feature:auth:compileDebugKotlin`, `:feature:profile:compileDebugKotlin` — BUILD SUCCESSFUL; `:core:api:testDebugUnitTest` 38/38 (including five new `MediaUploadApiTest` cases) and `:core:ui:testDebugUnitTest` — BUILD SUCCESSFUL.
- `npx --yes swagger-cli validate apps/api/openapi.yaml` — initially failed on comma-bearing inline descriptions and missing referral response descriptions; all were corrected (including the new media download response) and the spec now validates cleanly.
- `git diff --check` — no errors (LF/CRLF notices only).

## Not verified / next actions

1. Provision separate dev/staging/prod R2 buckets and credentials; confirm public custom domains. No credentials were added to this tree.
2. Apply migrations 6–9 only against a known target; verify indexes and a live upload→publish→read→archive→rollback flow.
3. Remaining integration gap: room/clan private-media participant semantics (no managed upload path or agreed membership rule is wired yet). `media.integration.test.ts` covers service-level staged publish, idempotent completion, prior-version preservation, expiry, cancellation, sequential and concurrent quota grants, owner/message/download authorization, hidden messages and block checks. `media.routes.integration.test.ts` covers HTTP auth/validation, grant non-disclosure, complete/cancel/expiry status codes, authorized/denied private download and soft-delete/failed/rejected denial; neither is a live R2 test.
4. Validate R2 CORS and public-policy behavior; OpenAPI YAML validation is now passing via `swagger-cli`.
5. Device/emulator QA of progress/Cancel in light/dark themes, font scaling and narrow widths; full Android lint/assemble.
6. Wire remaining media categories (covers, gallery, chat images/video, voice notes, trust verification, store/cosmetic/achievement art) through the same registry before deleting legacy uploaders/renderers.
7. Add admin media stats/moderation/version/orphan/quota views and reconciliation tooling with rollback mappings and legacy retention.
8. Add account-switch Coil cache isolation for private media.

## Constraints

Do not commit, push, deploy, run migrations, or touch production media without explicit authorization. Preserve unrelated untracked `yugm-cleanup/`. Keep R2 credentials and presigned URLs out of logs, client code, build config and API responses.
