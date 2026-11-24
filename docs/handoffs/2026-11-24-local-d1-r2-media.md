# Local D1 + R2 managed avatar media slice

**Scope:** Local development only. This slice adds the end-model managed media design to the isolated Auth/Profile Worker. The normal Node API, staging, production, Firebase identity, generated avatars and all other journeys keep their existing paths. No cloud resource, credential value, deployment, traffic switch or production data was touched.

## What changed

- Extracted host-neutral policy and key helpers from the Node media service into `backend-server/apps/api/src/services/mediaKeys.ts` and `mediaUploadPolicy.ts`. `r2.ts` and `media.ts` re-export/use them without changing Node behavior. Final names are retained: `MediaUploadSession`, `MediaObject`, `MediaQuotaReservation`, `avatarType: "UPLOADED"`, public variants/private originals, and the five buckets `assets`, `public-media`, `private-media`, `originals`, `staging`.
- Extended the draft D1 schema with `media_upload_sessions.upload_token_hash`, media indexes and `media_counters`. `generate-d1-schema.ts` now reproduces those runtime objects, so generated SQL and source stay aligned.
- Added five `remote: false` R2 bindings and the `IMAGES` binding to `auth-local/wrangler.jsonc`.
- Added `backend-server/apps/api/src/migration/d1Media.ts`. Sessions, media objects, variants, quota reservations and version counters live in D1; staged originals and public variants live in R2. Keys, buckets, owner, capability and expiry are all server-derived.
- Mounted the managed routes in `authLocal.ts`: `POST /api/media/uploads`, the capability-gated `PUT /api/media/uploads/{sessionId}/bytes`, `POST /api/media/uploads/{sessionId}/complete`, `DELETE /api/media/uploads/{sessionId}`, `GET /api/media/{mediaId}/download`, plus local public and private variant delivery routes. `/ready` now validates the media tables.
- Installed the existing Cloudflare Images provider in the local Worker. The bundle still contains no `sharp` and no `imageProcessor.node.ts`.
- Completion commits the avatar authoritatively in `users`: `avatar`, `avatar_media_id`, `avatar_type = 'UPLOADED'`; it clears `avatar_parts_*` and `active_cosmetics_avatar_asset`, marks the previous media as `superseded_by_id`, releases the quota reservation and remains idempotent. Generated-avatar patches are still supported and unchanged.

## Local client contract

The Android debug client can use the same managed flow without a new client build:

1. `POST /api/media/uploads` with `category`, `contentType`, `fileName` and integer `bytes`.
2. Response `data` contains `sessionId`, an absolute `http(s)` `uploadUrl`, `method: "PUT"`, `requiredHeaders["Content-Type"]`, `expiresIn`, `maxBytes` and `category`. The capability is carried in the URL; the PUT needs no `Authorization`, App Check or extra header.
3. Bare `PUT` sends the image bytes. Size and MIME are checked at the grant boundary; image signature is verified again before publication.
4. `POST /api/media/uploads/{sessionId}/complete` returns `data.avatarUrl` as an absolute Worker URL, so Android's `resolveMediaUrl()` and profile validation accept it.
5. `DELETE /api/media/uploads/{sessionId}` cancels an owned pending session and removes its staged object. `GET /api/media/{mediaId}/download` returns a short-lived signed private original URL after resource-level authorization.

The legacy `/upload/avatar` route remains unmounted in this Worker and is no longer needed for the local managed path. Workers use the shared image-processor registry rather than a local filesystem.

## Verification run

From `backend-server` on 2026-11-24:

- `npm.cmd run test:auth-worker --workspace @yugm/cloudflare-worker` — passed 1/1. The fixture asserts the five local R2 bindings, the Images binding, and that the emitted bundle has no Sharp path or Node image-processor module.
- The same fixture exercised: unsupported-category rejection; a 900-second upload grant with absolute loopback URL, required `Content-Type`, 5 MiB avatar limit and server-derived staging key; a hashed upload capability; forged-capability `403`; staging PUT; idempotent completion with the same response; actor-scoped `404`; authoritative `UPLOADED` profile commit; original plus 64/128/256 WebP variants; registry metadata preserving the original MIME, 32×24 dimensions and byte size while the public key targets the 256px variant; public variant fetch from the returned URL; authenticated download grant and private original fetch; `401` denial; invalid media id `400`; idempotent cancel with staging deletion and quota release; expiry `410`; and invalid-image completion failing the session with cleanup.
- `npm.cmd exec --workspace @yugm/api -- tsx --test src/services/media.test.ts` — passed 7/7, confirming the shared extraction did not change the Node media service's validation, quota, access or completion-failure contracts.
- `npm.cmd run schema:d1 --workspace apps/api` — generated 147 tables with 0 review warnings and 0 import failures.
- `npm.cmd run typecheck --workspace @yugm/cloudflare-worker` and `npm.cmd run typecheck --workspace @yugm/api` — both passed.
- `git diff --check` from the repository root — no errors (only LF/CRLF notices).

The test output line `Local Auth Worker unavailable Error` is the expected pre-schema `/ready` failure used to assert readiness depends on the applied D1 schema; it is not a failing check.

## Limits and next acceptance

- Live Android debug QA with a real Firebase test project remains owner-run, including choosing a photo through ProfileSetup/Edit Profile and reading the resulting avatar on the profile screen.
- Existing local persistence may predate `upload_token_hash` and the media tables. Use a fresh local persistence directory as described in [the emulator runbook](2026-11-24-local-d1-auth-emulator.md); `CREATE TABLE IF NOT EXISTS` will not repair an older table.
- These are simulated local R2 bindings. Public variants are served by the Worker route, not by an external R2 custom domain. No bucket was provisioned and no real R2 endpoint or credential was contacted.
- The full API suite, staging upload cycle, Settings, Chat and Rooms were not run or started in this slice. Production D1 remains blocked by the capacity, recovery, approved-schema and cutover gates in ADR-0007.
- Do not deploy, provision, switch traffic, remove MongoDB or access credential values without fresh explicit authorization.
