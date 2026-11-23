# Private-media authorization audit

**Date:** 2026-11-23
**Status:** Source-backed audit plus owner-decided target policy. The runtime behavior described below is current code; the target policy was recorded 2026-11-23 in [ADR-0005](../decisions/0005-r2-media-cutover.md) and encoded in an unwired local harness. No runtime authorization, credential or production data was changed.

## 1. Managed media registry (`MediaObject`)

The managed download endpoint is `GET /api/media/:mediaId/download` in [routes/media.ts](../../backend-server/apps/api/src/routes/media.ts#L47-L51). It requires normal app authentication and delegates to `authorizeMediaDownload()` in [services/media.ts](../../backend-server/apps/api/src/services/media.ts#L550-L569).

The decision order is:

1. `mediaId` must match `/^[a-f0-9-]{36}$/i`; otherwise `400`.
2. Missing media, `deletedAt`, `processingStatus !== "READY"` or `moderationStatus === "REJECTED"` return `404` (not `403`), avoiding resource existence disclosure.
3. `ownerType === "USER" && ownerId === userId` grants `owner` access, even when `visibility` is `PRIVATE`.
4. Any non-`PRIVATE` visibility returns `public` metadata to any authenticated caller.
5. For `visibility === "PRIVATE"` and a non-owner caller, `isMessageParticipant()` is consulted. It grants `participant` only when:
   - `ownerType === "MESSAGE"` and `ownerId` is a valid ObjectId;
   - a [DirectMessage](../../backend-server/apps/api/src/services/media.ts#L508-L523) exists with the caller as `senderId` or `receiverId` and not in `hiddenFor`;
   - neither party blocks the other.
6. Everything else is `deny` (`403`).

Only `owner` and `participant` decisions generate a short-lived signed download URL via `generateDownloadUrl()`. The URL is returned in that response only and is never stored in the registry or written to logs. `public` decisions return `toPublicMedia()` metadata and rely on the public variant URL.

The pure decision function and these cases are covered in [services/media.test.ts](../../backend-server/apps/api/src/services/media.test.ts#L122-L137).

## 2. Latent room/clan gap

`MediaObject.ownerType` allows `USER`, `ROOM`, `CLAN`, `MESSAGE`, `COSMETIC`, `ACHIEVEMENT`, `EVENT` and `APPLICATION` ([r2.ts](../../backend-server/apps/api/src/services/r2.ts#L18-L19)). However, `isMessageParticipant()` checks **only `DirectMessage`** and begins with `if (media.ownerType !== "MESSAGE" ...) return false`.

Therefore, today:

| Private `ownerType` | Non-owner access |
|---|---|
| `USER` | Denied (only the owning user passes step 3) |
| `MESSAGE` (direct message) | Allowed for sender/receiver when not hidden and not blocked |
| `ROOM` | Denied; no room membership/participant check exists |
| `CLAN` | Denied; no clan membership check exists |
| `COSMETIC`, `ACHIEVEMENT`, `EVENT`, `APPLICATION` | Denied; no participant rule exists |

This gap is currently latent because the managed upload API accepts only the `AVATAR` category, which creates `USER`-owned media. It becomes blocking when DCR-4 selects a phased cutover for chat images, room media, clan media, badges or cosmetics. The owner must define participant rules (for example room participant/member lists, clan membership, message-thread participation, moderator/admin overrides and block behavior) before those categories use private buckets.

No rule in this document should be read as a recommended policy; it records what the existing code does.

## 3. Legacy public `/uploads` path

`/uploads/:fileName` is mounted only when `STORAGE_DRIVER=mongodb` ([app.ts](../../backend-server/apps/api/src/app.ts#L163-L205)). It is unauthenticated, streams only GridFS files whose `metadata.private` is `false` and whose filename matches a strict generated pattern ([storage.ts](../../backend-server/apps/api/src/services/storage.ts#L409-L416)), and sets immutable public cache headers. On non-Cloudflare Node with a non-MongoDB storage driver, `/uploads` is a plain `express.static` mount; both static mounts are skipped when `YUGM_RUNTIME=cloudflare` ([app.ts](../../backend-server/apps/api/src/app.ts#L207-L214)).

Consequence: legacy `/uploads` references are public by construction and must not be mapped into a private R2 bucket without an explicit owner decision. Conversely, the existence of a reference does not prove the binary still exists.

## 4. Private verification and asset-staging paths

These are not `MediaObject` downloads; they are separate server-mediated routes:

| Route | Authorization | Notes |
|---|---|---|
| `/api/admin/trust-verifications/media/:fileName` | `requireAdminAuth` + permission `trust_verification.media.read` | Validates the filename, writes an audit log, sets `Cache-Control: private, no-store`, then streams storage bytes ([adminVerification.ts](../../backend-server/apps/api/src/routes/adminVerification.ts#L41-L62)). Legacy `/api/trust-verification/media/...` references are rewritten to this admin route. |
| `/api/admin/assets/staging/:fileName` | Admin auth inherited from the catch-all `adminRouter.use(requireAdminAuth)` + permission `cosmetics.read` | Registered before `/assets/:id`; validates filename and sets `private, no-store` ([adminAssets.ts](../../backend-server/apps/api/src/routes/adminAssets.ts#L52-L61), [admin.ts](../../backend-server/apps/api/src/routes/admin.ts#L603), [middleware/adminAuth.ts](../../backend-server/apps/api/src/middleware/adminAuth.ts#L44-L73)). |

The asset-staging route historically relied on mount order, but `adminAssetsRouter` now applies its own `requireAdminAuth` guard (added 2026-11-23); the permission check and `private, no-store` headers still apply. Do not remove that guard during R2 cutover.

## 5. Owner decisions recorded 2026-11-23

1. Private media is available to the media/resource owner, resource admins (room host/mod/admin, clan admin or conversation admin), and accepted participants only.
2. Pending invites, platform-admin-only actors and block/hide-denied users are not granted access by this policy.
3. Published variants are public; staging objects and originals are private and delivered through short-lived signed grants.
4. Buckets keep the five existing names; domains/CORS use explicit per-environment allowlists, with the production origin still to be supplied.
5. The agent stages local admin tooling and value-free config guards; provider credentials remain owner-controlled.

The target policy is encoded in `backend-server/apps/api/src/migration/mediaAccessPolicy.ts` as an unwired harness with 6 tests. It is not imported by `services/media.ts`; runtime implementation is a separate Phase 4 slice. Legacy `/uploads` mapping and an owner-approved media export remain open.
