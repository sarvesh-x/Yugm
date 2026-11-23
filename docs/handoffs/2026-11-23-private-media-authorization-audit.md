# Handoff — Private-media authorization audit

**Date:** 2026-11-23
**Task:** YUGM-MIGRATION-000 — DCR-4 input preparation, documentation only.

## Done

- Added `docs/migration/private-media-authorization.md`: a source-backed audit of current private-media authorization.
- Documented the `GET /api/media/:mediaId/download` decision order, the short-lived signed-URL boundary, the public-only legacy `/uploads` route, and the admin trust-verification/asset-staging routes including their permissions. The asset-staging router subsequently received its own explicit auth guard on 2026-11-23, removing the mount-order dependency described in the audit.
- Linked the audit from `docs/cloudflare-migration/decision-request.md` (DCR-4), `docs/INDEX.md`, `docs/CURRENT_TASK.md`, `docs/DEVELOPMENT_PROGRESS.md` and `MIGRATION_PROGRESS.md`.

## Key finding

Non-owner `PRIVATE` access is implemented only for `ownerType=MESSAGE` direct-message participants. `isMessageParticipant()` returns `false` for every other owner type, so `ROOM`, `CLAN`, `COSMETIC`, `ACHIEVEMENT`, `EVENT` and `APPLICATION` private media are denied to non-owners. This is latent today because managed upload accepts only `AVATAR`/`USER`, but it blocks any future private room, clan or group-media cutover. No policy was chosen or recommended.

## Verification performed

Read-only source inspection of `services/media.ts`, `routes/media.ts`, `services/storage.ts`, `app.ts`, admin routers, `middleware/adminAuth.ts` and the existing `mediaAccessDecision` unit tests. No code was changed, so no build/test run was required for this slice. No credential, database, bucket or production data access.

## Remaining / next

1. Owner defines room participant and clan member rules, host/mod/admin overrides, block/hide semantics and whether `MESSAGE` access extends beyond direct messages.
2. Owner selects DCR-4 option and supplies bucket/domain/CORS/public-private policy inputs.
3. Approve an export, then run `inventory:media` and `inventory:legacy-media` before any category cutover.
4. Design the room/clan authorization adapter in a separately authorized slice; preserve server-side authority and the short-lived URL boundary.
5. This audit and the other 2026-11-23 changes remain uncommitted; commit/push requires separate explicit authorization.
