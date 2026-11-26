# Handoff — D1 trust verification upload and private media

**Date:** 2026-11-26
**Status:** Implemented and locally verified; uncommitted in the working tree. MongoDB remains authoritative.

## Scope

Mounted the final two upload-group patterns on the shared D1 Worker:

- `POST /api/upload/trust-verification`
- `GET /api/trust-verification/media/:fileName`

The upload keeps the legacy contract: auth before multipart, purpose-specific extension/MIME filtering, signature checks, the Worker 10 MB cap, a generated `<24-hex-user-id>_<timestamp>_<6-hex>.<ext>` name, and `{ url, purpose, storage }` with a relative private URL and `private-s3` marker. The delivery route keeps legacy owner-prefix authorization, `private, no-store` headers, 400/403/404 ordering, and byte passthrough.

## Implementation

- Added `backend-server/apps/api/src/migration/d1TrustVerificationUpload.ts`.
  - Memory-backed multer with auth before parsing and legacy `FACE`, `LIVENESS`, and `VOICE` filters.
  - Legacy image/video/audio signature rules; invalid purpose, extension, MIME and signature responses keep their legacy messages.
  - Bytes go to `PRIVATE_MEDIA` under `trust-verification/<generated-name>` with private cache metadata.
  - A `media_objects` row (`USER`, `PRIVATE`, `READY`, `APPROVED`, private-media bucket) and a `media_variants` row commit in one D1 batch before success. Version numbers come from `media_counters`; R2 bytes are deleted if that commit fails.
- Extended `backend-server/apps/api/src/migration/d1TrustVerification.ts` with the private media GET route. It validates the reference, checks that the filename belongs to the authenticated user, then reads the private R2 object. A missing object returns 404; a foreign reference returns 403 before storage is touched.
- Added `backend-server/apps/api/src/migration/d1TrustMedia.ts` so the user route and the existing admin verification route share the private path, MIME table and R2 key builder. The owner route keeps `storage.ts`'s strict generated-name pattern (including unbounded timestamps); the admin route keeps its broader 1–20 digit submission reference. `d1AdminVerification.ts` now imports the shared constants; its behavior is unchanged.
- Mounted the upload router in `d1App.ts`, passed the private-media bucket to the trust router, and gated both paths in `d1Api.ts` so they return 503 when managed media is unavailable.
- Added `backend-server/apps/cloudflare-worker/test/d1-endpoints.mjs` fixtures for auth order, missing file, invalid purpose/extension/MIME/signature for face and voice, both size classes, response DTO, R2 bytes/key, registry and variant rows, private delivery headers and bytes, 400/401/403/404 behavior, the strict long-timestamp reference, `FACE`/`LIVENESS`/`VOICE` purpose handling, counter versions, and full fixture cleanup.

## Verification run

- `npm.cmd run typecheck` — passed across admin, api, cloudflare-worker and shared workspaces.
- `npm.cmd run test:auth-worker --workspace apps/cloudflare-worker` — passed **1/1**. No `DEBUG` errors appeared; expected `D1_SCHEMA_UNAVAILABLE`, `D1_CONFIG_REQUIRED`, 500 and scheduled-maintenance entries remain.
- `npm.cmd run audit:d1-endpoints -- --missing` — passed: **638 legacy / 621 D1 / 615 matched / 23 missing**. `/api/upload` is **7/7** and `/api/trust-verification` is **10/0**.
- `npm.cmd run secrets:check:strict` — passed: 31 tracked config files, no credential-bearing assignments.
- `git diff --check` — passed with LF/CRLF notices only on the two edited TypeScript files.

No hosted request, migration application, data import, deploy, provision, credential change, Android build, commit or push was performed.

## Boundary and next move

- No new migration was added. Private verification media uses the existing `media_objects`/`media_variants` tables and the legacy `trust-verification/<name>` key, so the existing admin delivery route continues to resolve rewritten submission URLs.
- The Worker-side upload and read still do not emit legacy `sync:invalidate` events. Admin review, submission DTOs and the non-unique trust user index remain as recorded in the earlier trust-state handoff.
- All remaining HTTP gaps are PK writes/deadlines, `GET /api/discover`, `GET /api/dating/explore`, `DELETE /api/users/me` and `friend-match/search`. Presence, realtime fan-out, jobs, existing-data reconciliation, recovery rehearsal and live acceptance remain open.
- Next bounded slice: PK writes with guarded D1 batches and explicit legacy boundaries for deadline cleanup, active-battle job ending and socket fan-out; or a presence-compatible discovery decision. Keep MongoDB authoritative until route/job parity, reconciliation, recovery rehearsal and live acceptance pass.
