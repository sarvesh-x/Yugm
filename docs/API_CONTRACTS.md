# API contracts

## Sources of truth

- Backend route implementations and mounted order: `backend-server/apps/api/src/app.ts` and `src/routes/`.
- Shared runtime schemas/constants used across packages: `backend-server/packages/shared/src/index.ts`.
- OpenAPI contract: `backend-server/apps/api/openapi.yaml`.
- Android API facade and feature APIs: `android-client/core/api/`.
- Full static route declaration inventory: [production/endpoint-inventory.csv](production/endpoint-inventory.csv).

Do not hand-maintain a second route list as authoritative. The CSV is generated evidence: mounted paths can overlap, be shadowed, or require middleware-order review. Confirm the actual client request and Express mount when changing an endpoint. Keep OpenAPI, shared schemas, server behavior, and consumers aligned; document auth, authorization, errors, side effects, and idempotency for changed commands.

## Error format

The API has more than one response envelope in existing paths. Inspect `src/utils/http.ts`, app error middleware, and the specific route before assuming a universal shape. `requestId` is included by the central app error path. New or modified paths should use the existing helpers consistently and preserve client compatibility deliberately.

## Bonds contract (single inner-circle state)

- `/api/bonds` is the only source of truth for the unified three-slot Bonds circle. `GET /api/bonds/me` returns the server `capacity` (`YUGM_BOND_SLOTS` / `bondConfig.capacity`, default `3`), active bonds, pending requests, ended history, and preferences. The former `GET /api/users/me/close-friends` and `POST|DELETE /api/users/:id/close-friend` routes are removed; `User.closeFriendIds` is removed.
- `GET /api/users/me/friends` returns accepted friendships only. Each user carries a transient `isOnline` from socket presence; it is not persisted on `User`.
- Public profile responses derive `bondsCount` from active `Bond` rows and `isBonded` from a caller-target active bond; neither is a persisted `User` flag. `GET /api/users/:id` exposes both, and `PATCH /api/users/me` returns an authoritative `bondsCount`. `bonds:changed` is an invalidation, so clients must re-read scoped `/api/bonds` state instead of treating a card or event as proof of a commit.
- Invitations, acceptance/decline/cancel, gifts, type changes, and ending remain under `/api/bonds/...` with bilateral consent, transaction-fenced slots, and authorization at the resource boundary. See [Bonds](bonds.md) for the command contract.

## Badge showcase contract

- Worn badges are earned cosmetic slots, not claimable progression state. `/api/experience/badges/showcase` uses the server-authoritative capacity of five: `GET /experience/badges`, `GET /experience/badges/showcase/:userId`, and `PUT /experience/badges/showcase` return `data.capacity`. Android falls back to five only when an older API omits the field.
- `PUT /experience/badges/showcase` accepts `{ badgeIds: string[] }` for the authenticated actor only. The server rejects more than five IDs, duplicate IDs, unknown or unearned/expired IDs; a successful response returns the committed `badgeIds` order. There is no client-side proof of wear: public readers re-fetch `/experience/badges/showcase/:userId`.
- Successful badge mutations invalidate `TASKS` and `PROFILE` sync topics for the actor and broadcast a topic-only `PROFILE` invalidation to connected viewers, so an open viewing profile re-reads the changed user's badges. Both the Achievements screen and profile header re-read their scoped endpoints instead of applying an optimistic badge result as authoritative.

## Centralized asset contract (Phase 1)

- `/api/admin/assets` is the single admin-managed asset registry for cosmetic, badge and gift art. It requires `cosmetics.read` for reads and `cosmetics.write` for staging, publishing and archiving; every mutation writes an `AdminAuditLog` entry through `auditLog()`.
- `POST /api/admin/assets` accepts multipart `asset` plus `ownerType` (`cosmetic|badge|gift`) and `ownerId`. JPEG, PNG, WebP and GIF up to 8 MB are accepted after signature/dimension validation with `sharp`. The file is written to **private** `assets-staging/` storage and returns a `staging` asset with a version, SHA-256 and dimensions. No public URL is returned at this stage.
- `GET /api/admin/assets/staging/:fileName` is authenticated and serves staging bytes with `Cache-Control: private, no-store`. Staging filenames are validated against a fixed pattern; external URLs and arbitrary paths are rejected.
- `POST /api/admin/assets/:id/publish` produces immutable `full` (1600px) and `preview` (512px) WebP variants under versioned `assets/` keys and sets `publicUrl`. Published keys and URLs are never overwritten; a new upload allocates a new version. `DELETE /api/admin/assets/:id` archives an asset and removes its objects.
- Consumers must store the asset reference, not mint URLs. `resolvePublishedAsset(ownerType, ownerId)` returns the newest published asset for a cosmetic/badge/gift. Phase 1 did not change read responses; Phase 2 resolves cosmetic references and Phase 3 resolves badge references (see below). The legacy `/api/badge-art/:id/:version` route remains for existing blobs until an approved cutover.
- Migration 6 creates only `assetobjects` indexes; it does not rewrite catalogue or user documents. No migration has been applied to any deployment as part of this work.

## Cosmetic asset references (Phase 2)

- `Cosmetic.assetRef` is an optional `AssetObject` id. It is additive: legacy `assetUrl`/`assetKind` documents are untouched and remain the fallback. Migration 7 creates the sparse `cosmetic_asset_ref` index only; it rewrites no documents and has not been applied to any deployment.
- `POST /api/admin/cosmetics` and `PUT /api/admin/cosmetics/:id` accept `assetRef` (an empty string detaches managed art in read responses). The server rejects a reference whose asset is not `published`, is not owned by `ownerType=cosmetic`/`ownerId=<that cosmetic>`, or has neither `publicUrl` nor a `full` variant. Passing an asset id never changes ownership, balance or equipment.
- Public cosmetic DTOs (`/wallet/cosmetics`, `/wallet/cosmetics/purchase` responses, `/users` inventory) may now include `assetId`, `assetVersion` and `assetVariants[]` (`name`, `url`, `contentType`, `width`, `height`). `assetUrl` resolves to the published `publicUrl` (or `full` variant URL) when a valid reference exists, otherwise to the legacy value. Android's `ProfileCosmetic`/`InventoryCosmetic` ignore unknown fields, so no client change is required.
- Catalogue reads batch-resolve published assets by id (one query per list, not per item). A staging/archived/missing asset silently falls back to the legacy URL; no published URL is rewritten in place.
- `DELETE /api/admin/assets/:id` now returns `409` while any `Cosmetic.assetRef` still points at that asset. Clear the cosmetic reference (or switch it to a newer version) before archiving.
- Admin UI: **Managed Assets** stages/uploads, publishes and archives; the Cosmetics drawer links a published cosmetic asset. The seeded external DiceBear/Giphy URLs remain unchanged and are not re-hosted, per the resolved product decision.

## Badge asset references (Phase 3, additive slice)

- `Achievement.assetRef` is an optional `AssetObject` id; migration 8 adds only the sparse `badge_asset_ref` index. Existing `imageData`/`imageMime` blobs and legacy `imageUrl` values are **not** read, migrated or deleted. Migration 8 has not been applied.
- `POST /api/admin/badges` and `PUT /api/admin/badges/:id` accept `assetRef` in the JSON `definition`. The server rejects a reference that is not `published`, is not `ownerType=badge`/`ownerId=<that badge id>`, or has neither `publicUrl` nor a `full` variant. "Remove custom image" clears both the legacy fields and the managed reference. The existing multipart `image` upload still writes to the legacy blob path; no badge bytes are moved out of the primary DB in this slice.
- Badge gallery/showcase DTOs (`/experience/badges`, `/experience/badges/showcase/:userId`, profile header badges) may now include `assetId`, `assetVersion` and `assetVariants[]`. `imageUrl` resolves to the published asset URL when a valid reference exists, otherwise to the legacy `imageUrl`. `badgeCatalog()` batch-resolves refs in one query. Android's `Achievement` model ignores unknown fields, so no client change is required.
- `DELETE /api/admin/assets/:id` now returns `409` while either a `Cosmetic.assetRef` or an `Achievement.assetRef` still points at that asset.
- Admin UI: the Badges form links a published badge asset from **Managed Assets**; managed art overrides an uploaded image. Bulk clearing of `Achievement.imageData`/`imageMime` and retirement of the dedicated badge upload remain gated on a separately approved cutover.

## Centralized R2 media contract (foundation + avatar slice)

- `POST /api/media/uploads` creates a private staging grant from only `category` (currently `AVATAR`), `contentType`, `fileName` and integer `bytes`. `fileName` is used only for its extension and must not contain path separators. Owner, bucket, key and expiry are server-derived. The response carries a short-lived presigned PUT URL; never log, persist or return it in other endpoints.
- `POST /api/media/uploads/{sessionId}/complete` is idempotent after success. It re-reads and verifies staged bytes, writes immutable public variants and a private original, creates a `MediaObject`, then commits the owning reference. Repeat calls after commit return the same media id/version/URL; invalid, expired, cancelled or foreign sessions return `400`/`409`/`410`/`404`.
- `DELETE /api/media/uploads/{sessionId}` cancels an owned pending session and best-effort removes its staging object. `GET /api/media/{mediaId}/download` only returns a short-lived signed URL after ownership/message-participation, block, deletion, moderation and processing checks; the URL is never stored.
- Public media DTOs resolve delivery URLs from canonical keys at read time. Do not persist signed URLs in the registry or expose private buckets. `STORAGE_DRIVER=s3` is required; unsupported categories return `400`, and unconfigured storage returns `503`.
- `/api/upload/avatar` remains the legacy fallback used by Android only when managed session creation returns `503`/`501`. See [Centralized R2 media](features/r2-centralized-media.md).

## Authentication and profile setup notes

- `/api/auth/google`, `/api/auth/facebook`, and `/api/auth/phone` are mounted behind `requireAppCheck`; the client sends a limited-use App Check token in `X-Firebase-AppCheck`. The API consumes tokens during verification and rejects a replay result. Do not cache the limited-use token or a successful consume verification.
- Local Android debug builds targeting loopback HTTP (`10.0.2.2`, localhost, or loopback) skip App Check token acquisition/header injection. The API middleware already bypasses App Check in `NODE_ENV=development` and `test`. Debug builds targeting remote APIs and all release builds keep App Check enabled. On a production API, verification is controlled by `APP_CHECK_ENFORCE`; confirm it is enabled for production.
- `/api/auth/me` is an authenticated session/user snapshot. Android calls it on cold start with a bounded request, allowing the normal one-time refresh path to reconcile an expired access token before routing. Network/App Check failure is not proof of revocation.
- Auth routes validate Firebase ID-token identity and issue one device session per account generation. `/api/auth/refresh` rotates the refresh token; generation/reuse failures are unauthorized. Keep the user-facing client distinction for another-device/revoked sessions.
- `/api/auth/logout` accepts an optional refresh token and optional current-install FCM `deviceToken`; it removes that user's matching device-token record, advances the account session generation, revokes sessions, and disconnects live sockets. Android clears local state immediately and sends this request best effort, so offline logout cannot guarantee server FCM cleanup.
- Profile setup currently uses `PATCH /api/users/me` (not `/api/auth/profile`) with the shared `profileSchema`. The response user includes authoritative `profileCompleted`. Completion requires nonblank name, username, bio, city, and one interest, unless `profileCompletedAt` already exists. See [auth-flow audit](features/auth-flow-audit.md) before changing these semantics.
- `POST /api/upload/avatar` (authenticated multipart `avatar`) persists a client-thumbnailed image through the configured storage driver and returns `{ url, storage }`. With `STORAGE_DRIVER=s3` plus `S3_ENDPOINT` and `S3_PUBLIC_BASE_URL`, avatars live in the public R2/S3 bucket and `User.avatar` holds the public URL. Successful upload replaces the previous managed object; legacy data URLs remain readable. See [avatar R2 storage](features/avatar-r2-storage.md).
