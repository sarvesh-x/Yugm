# YUGM-COSMETICS-001 — Cosmetics, assets, store, inventory, gifts and achievements audit

**Status:** Phase 1 audit and migration plan complete. The foundational asset-management backend slice (Phase 1 items 1–6) has since been implemented; see §6. No migration has been applied and no catalogue/user documents were changed.
**Date:** 2026-11-22
**Evidence basis:** direct source inspection of `android-client/`, `backend-server/apps/api/`, `backend-server/packages/shared/` and `backend-server/apps/admin/`, plus completed read-only Android, backend, and data/admin/test audit reports. Dated `docs/production/` findings were treated as historical evidence only.
**Verification limits:** no running API, production/staging database, live S3/R2 bucket, or device/emulator was available. No migration was applied and no runtime request was executed. Statements below describe source behavior, not confirmed production state.

## Status legend

| Label | Meaning |
|---|---|
| Fully implemented | End-to-end path exists: UI → state → API → server → persistence, with error handling and tests. |
| Backend-driven | Server is authoritative and clients consume it; presentation may still be hardcoded. |
| Partial | Works, but has a material gap: disconnected UI, hardcoded presentation, missing edge states or incomplete wiring. |
| Hardcoded | Value, visual or business rule is baked into source rather than served/configured. |
| Disconnected | Code/API exists but no live caller or visual consumer was found. |

## 1. Feature-status matrix

| Area | Status | Current implementation | Gap / risk |
|---|---|---|---|
| Cosmetic catalogue + seeding | Backend-driven / Partial | `Cosmetic` model (`backend-server/apps/api/src/models/Cosmetic.ts`), `services/cosmetics.ts` with `$setOnInsert` default upserts preserving admin edits, `profileCosmetics` shared seed list. Wallet/admin routes call `ensureDefaultCosmetics()`. | No asset version/reference fields, no MIME/size/checksum/dimensions, no storage key or visibility state. Seed list embeds third-party DiceBear/Giphy URLs. |
| Central asset upload/storage | Partial → Phase 1 implemented | `services/storage.ts` supports `local`, `mongodb` (GridFS + quota) and `s3`/R2 with immutable public caching. Phase 1 adds a generic `assets`/`assets-staging` namespace, buffer persistence, private staging reads and an `AssetObject` registry with versions, SHA-256, variants, publish/archive and admin routes. | Consumers are not yet migrated: cosmetics/badges still expose legacy `assetUrl`/`imageUrl`; badge blobs remain in `Achievement`; no admin UI or realtime catalog event yet. |
| Admin cosmetic CRUD | Backend-driven / Partial | `routes/adminCosmetics.ts` with `cosmetics.read`/`cosmetics.write`, `adminOk`, `auditLog`, and `syncDefaultCosmetics()` after writes. Admin panel has a Cosmetics view. | No asset upload in the cosmetic form; `assetUrl` is a free-text field. No per-variant preview, no version history, no publish gate. |
| Admin badge artwork upload | Partial / duplicate system | `routes/adminBadges.ts` uses its own `multer.memoryStorage()` with a 512 KB limit; `Achievement` stores `imageData`/`imageMime` in the primary MongoDB document and serves it from `/api/badge-art/:id/:version` with a 1-hour immutable cache. | Second upload pipeline beside `services/storage.ts`; Base64/binary payload in the primary DB conflicts with the requirement to keep large assets out of MongoDB; no shared validation, normalization, CDN key scheme or asset-lifecycle audit. |
| Cosmetic store (Android) | Partial | `CosmeticsStoreScreen.kt` + `CosmeticsViewModel.kt` consume `/wallet/cosmetics`, purchase and equip APIs; grid keyed by server `cosmetic.id`; `assetUrl` preview via `AsyncImage` with procedural fallback; sync invalidation on `GIFTS`/`PROFILE`. | 11 categories, rarity labels, prices/duration copy, recharge and bundle dialogs are hardcoded. `error` is not cleared on refresh; store has no retry UI. |
| Bundle purchase | Disconnected | `CosmeticsViewModel.purchaseBundle()` → `/wallet/cosmetics/bundle-purchase`; shared `cosmeticBundles` exist. | No store UI caller; "Discount/Bundles" dialog is static text. |
| Inventory (gifts/cosmetics/badges) | Backend-driven / Partial | `InventoryScreen.kt` + `GiftViewModel.kt` load `/wallet/inventory` and `/users/me/inventory`, with loading/error/empty/retry and `GIFTS` sync. | Cosmetic tiles use a generic `✦`; badge rows use text `icon`; equip is called from a composable coroutine instead of the state holder. |
| Profile customization | Partial | `CustomizeProfileScreen.kt` uses server catalog + ownership + equip APIs with `PROFILE` sync and error display. | 15 category tabs and active-field maps are hardcoded. Live preview uses hardcoded theme/banner colors and ID-derived mini-badges; no asset loading. |
| Shared cosmetic renderers | Hardcoded | `CosmeticArtwork.kt` (973 lines of Canvas drawing), `CosmeticVisuals.kt` literal ID→color/brush tables, `Avatar.kt` ID→external URL/label maps. | No single asset-aware renderer; every new cosmetic requires client code. Public profile, chat and room screens reuse hardcoded visuals. |
| Gifts | Backend-driven / Partial | `GiftV2` parser/model, gift catalog, collections, inventory, surprise box and upgrade APIs; `GiftArtwork` loads remote `icon` URLs with emoji fallback. | Tab taxonomy, category matching, VIP threshold and palette are hardcoded. Gift art has no managed asset registry. |
| Badges / achievements | Backend-driven | Server-owned definitions, earned state, showcase capacity (5), `/experience/badges`, claim/share/showcase APIs; `BadgeArtwork` loads `imageUrl` with backend-first, material-icon fallback. | Fallback visuals and reward-name map (`CosmeticNames.kt`, ~115 literal IDs) are hardcoded. Older APIs need the `capacity` fallback. |
| Store products and categories | Disconnected | No `Product` model, store/shop router or generic category catalogue exists. Coin packs, diamond packs, subscriptions and cosmetic bundles are hardcoded source SKUs in `packages/shared/src/index.ts` and exposed through `/wallet/packs`; `Purchase` records are transaction records, not a catalogue. | Store merchandising cannot be admin-managed; Android category tabs and bundle dialogs have no backend contract to bind to. |
| Wallet, balance and purchase ledger | Fully implemented / Backend-driven | Server-owned balance/purchases, validation, frozen-wallet guard, transaction ledger, idempotency keys, cosmetic purchase/transfer/equip routes; tests in `services/wallet.test.ts`, `routes/wallet.test.ts`, `models/walletTransaction.test.ts`. Gift send has replay-intent validation, atomic stock decrement and post-commit socket/chat/activity events. | Re-check transaction topology if bundle purchase is wired; do not assume multi-document atomicity without confirming the deployment's replica-set topology. |
| Realtime sync | Partial | `AppSync.kt` invalidation + coalescing + `AutomaticSyncEffect` polling; backend `syncInvalidation` middleware maps mutation paths to topics, emits actor-focused `sync:invalidate`, and broadcasts selected public topics; room gift send has an explicit socket event. | Admin routes are explicitly excluded from generic invalidation; no cosmetic/catalog/asset-specific Socket.IO topic exists, so clients depend on 30s polling for cross-user catalog changes. |
| Data migrations | Partial | `config/migration.ts` has a working `defineMigration()`/`_migrations` ledger with versions 1–5 (users, rooms, notification/story TTLs, wallet indexes). Phase 1 registers additive version 6 creating `assetobjects` indexes. | Version 6 has not been applied to any deployment. No destructive cleanup/backfill migration exists yet. |
| Tests | Partial | 179 API unit tests and 34 hardening tests passed for the prior badge task; storage, wallet and sync-invalidation suites exist. Android `core:api` tests (30) passed. | No cosmetic asset-service, admin asset-route, renderer or end-to-end asset-delivery tests. No runtime verification of S3/R2 publish/read/delete. |
| Contracts and docs | Partial | API contracts, realtime events, design system, component registry and progression contract document current cosmetics/badges. | No unified asset lifecycle contract, asset URL/version contract, admin asset workflow, or migration/rollback record. |

## 2. Architecture findings

1. **Authority is already correct.** Catalogue contents, ownership, equipped slots, balances, gift inventory, badge definitions and earned/progress state live on the server and are consumed by the clients. The program must not move authoritative state into the client or duplicate it.
2. **The visual layer is the fragmentation point.** Almost all cosmetic art is procedural Canvas/emoji art keyed by literal IDs in `core:ui` and `core:util`. Only three narrow paths load remote art: store/customize `assetUrl`, badge `imageUrl`, and gift `icon`.
3. **There are already two upload paths and no asset registry.** `services/storage.ts` is the reusable primitive; `adminBadges.ts` bypasses it with its own multer pipeline and stores image bytes in `Achievement.imageData`. Extending the shared service, moving badge art out of the primary DB, and routing all admin art through it avoids a third per-category system.
4. **Public URLs must be immutable and versioned.** `persistUploadedFile()` already sets `public, max-age=31536000, immutable` for public S3 keys and can build a CDN base URL. Badge art currently uses a 1-hour cache and an in-document blob. A versioned object key plus an asset registry lets published URLs be cached forever while new versions get new URLs; old published versions must never be overwritten.
5. **Private/staging separation is partially present but generic support is missing.** Trust verification uses private GridFS/S3 keys and a backend-only read route with path validation. The same pattern should be generalized for unpublished cosmetic assets, with a staging→publish transition that only writes the public reference after all derived variants are ready.
6. **Sync is invalidation-based, not push-based.** Adding an asset/catalog topic and emitting it on publish is a smaller change than replacing polling; polling can stay as a resilience fallback. Admin routes are currently excluded from generic invalidation, so catalog publishes need an explicit broadcast.
7. **Runtime definitions are backend-owned, but seed content is source-owned.** `profileCosmetics`, `coinPacks`, `diamondPacks`, `subscriptionPlans`, bundles, gift seeds, 18 immersive themes and achievement definitions are hardcoded constants or seed scripts. Backend-driven storage does not make them admin-editable.
8. **The migration framework works and must be extended carefully.** `config/migration.ts` records applied versions in `_migrations`; versions 1–5 currently create indexes/TTLs. New versions must be additive, idempotent and never run against an unknown environment.

## 3. Migration plan

No step below has been executed. Each phase has an explicit exit gate; do not start a later phase before the previous gate passes.

### Phase 0 — baseline and approval (documentation only)

- Confirm the program scope and acceptance criteria with the user; treat this document as the Phase 1 deliverable.
- Record a read-only baseline: counts of `cosmetics`, badge definitions with artwork, published asset URLs, and existing `activeCosmetics`/`ownedCosmeticIds`/`showcasedBadgeIds` shapes. Do not copy production data into source control.
- Identify the target environment and database before any migration; never run a migration against an unknown deployment.
- **Exit gate:** user approval of the plan and a named target environment.

### Phase 1 — foundational asset-management slice (additive)

Backend first, then admin, then a bounded Android consumer.

1. Extend `services/storage.ts` with a generic `assets` namespace (plus `assets/staging` or equivalent private prefix) while keeping the existing folder union backward compatible. Reuse `persistUploadedFile()`/`deleteStoredFile()`; do not add a second S3/GridFS client.
2. Add an additive Mongoose model, e.g. `AssetObject`, with: stable asset id, owner/category (`cosmetic`, `badge`, `gift`), `kind`, `status` (`staging`/`published`/`archived`), immutable `version`, `key`, `publicUrl`, MIME type, byte size, width/height, SHA-256, derived variants, created/updated timestamps and created-by admin. Add indexes for `(category, status)`, `(ownerType, ownerId)` and unique `(key, version)`. Keep all credentials server-side.
3. Add a shared asset service: validated multipart upload with allow-listed MIME types and a conservative size cap, `sharp` normalization and thumbnail generation, SHA-256 dedupe, staging write, publish that computes the final immutable key and records `publicUrl`, and archive that removes object/key only when no published reference remains. All publish/archive operations write `auditLog` entries.
4. Add admin asset routes under the existing `cosmetics.read`/`cosmetics.write` permissions (new granular permissions only if the user requests them), using `requirePermission`, `adminOk`, `asyncHandler`, `HttpError` and the existing admin error shape. Upload returns an asset reference; it never grants ownership or mutates a cosmetic by itself.
5. Register an additive migration in `config/migration.ts` that creates indexes/validates document shape only. It must not rewrite existing cosmetic or user documents. Add a `down` that removes only indexes it created.
6. Tests: asset service unit tests (validation, dedupe, version immutability, publish/archive), storage URL tests, admin permission/audit route tests, and a migration test against a test database.
7. **Exit gate:** scoped backend typecheck and tests pass; an upload→publish→read-back→archive flow is demonstrated against a test storage driver; no existing cosmetic/user document changed.

### Phase 2 — migrate cosmetics onto asset references (additive backfill)

1. Add optional `assetRef` / `assetVariants` fields to `Cosmetic`. Keep `assetUrl`/`assetKind` as the resolved compatibility cache until all consumers are migrated.
2. Update `services/cosmetics.ts` `toPublicCosmetic()` to resolve a published asset reference into `assetUrl` plus a version and variant map, with the legacy field as fallback. Never change a published `assetUrl` in place; issue a new version instead.
3. Backfill existing cosmetics with asset references, including the four seeded external avatar URLs. Keep external URLs as provenance; decide separately whether to re-host them. Do not delete `assetUrl` in this phase.
4. Wire the admin Cosmetics form to the shared asset uploader. Reject unpublishable/incomplete assets; log every change with `auditLog`.
5. Update OpenAPI/shared contracts and docs.
6. **Exit gate:** store and customize previews still work for every cosmetic; legacy-only and new asset-backed documents both resolve; rollback is a field revert with no data loss.

### Phase 3 — unify admin badge artwork and remove in-document blobs

1. Replace the dedicated multer image pipeline in `adminBadges.ts` with the shared asset service; keep the existing route names and permission checks so the admin UI changes are minimal.
2. Backfill badge `imageUrl` values into asset references while preserving the original URLs. Migrate `Achievement.imageData`/`imageMime` bytes into object storage and point `/api/badge-art/:id/:version` at the resolved immutable URL (or a short-lived redirect). Only after read-back verification and a user-approved cutover, clear `imageData`/`imageMime` from badge documents — never in the initial additive migration.
3. **Exit gate:** badge upload, read and showcase still work; no duplicate upload service remains for badge art; no large binary remains in badge documents after the separately approved cleanup.

### Phase 4 — Android consumer and renderer unification

1. Add one asset-aware image/renderer entry point in `core:ui` that accepts a resolved asset URL + variants, uses the existing `resolveMediaUrl()`/Coil path, and falls back to the current procedural art only when no asset is supplied. Do not build a second image loader.
2. Migrate, in order: store preview → customize preview → inventory cosmetic tiles → gift art → badge art already uses remote URLs → public profile/chat/room consumers.
3. Move store merchandising chrome, category labels and active-field maps behind server-driven config or shared constants where a backend contract exists; leave genuinely static copy as design-system content.
4. Move equip from composable coroutines into `CosmeticsViewModel`/`GiftViewModel`; clear `error` on refresh and add store retry/empty states.
5. **Exit gate:** scoped Kotlin compiles and `core:api`/`core:ui` unit tests pass; visual QA on themes, font scaling and narrow widths.

### Phase 5 — store catalogue and admin coverage

1. Decide whether to introduce a generic `Product`/`StoreCategory` model and admin CRUD so store merchandising, packs, subscriptions and bundles become backend-editable, or to keep SKU lists as static configuration and remove the misleading "store" wording. This is a product decision, not an automatic migration.
2. If a catalogue is introduced, keep hardcoded SKUs as compatibility defaults with `$setOnInsert`-style seeding, preserve provider product IDs and all existing `Purchase`/ledger references, and add `gifts.manage`/`cosmetics.*` or new explicit permissions before exposing admin routes.
3. Wire or intentionally retire the disconnected `purchaseBundle` path, with an atomic/idempotent server implementation and ledger entry if enabled.
4. **Exit gate:** store categories and bundle dialogs are either server-driven or explicitly static by decision; no purchase/history data is rewritten.

### Phase 6 — realtime and hardening

1. Add a catalog/asset invalidation topic to shared contracts, backend sync middleware and `AppSync.kt`; emit on publish/archive so other clients refresh without waiting for the 30s poll. Keep polling as fallback. Explicitly broadcast catalog publishes because admin routes are currently excluded from generic invalidation.
2. Complete edge-case coverage: upload failure, unsupported MIME, oversized file, duplicate version, archived asset still referenced, offline refresh, permission denial, and stale cached URLs.
3. **Exit gate:** full scoped backend typecheck/tests, bounded Android compiles, docs and handoff updated.

### Data-preservation rules (apply to every phase)

- Additive schema changes only until a verified cutover; never overwrite `ownedCosmeticIds`, `activeCosmetics`, `showcasedBadgeIds`, `walletBalance`, purchase/gift history, achievement progress or expirations.
- Seeding uses `$setOnInsert`; keep that behavior so admin edits survive restarts.
- Published asset URLs are immutable; a change creates a new version and a new URL.
- No destructive `down` migration, no production migration, and no commit/push/deploy without explicit authorization.
- Each phase must be revertable by disabling the new read path and falling back to legacy fields.

## 4. Open decisions requiring user input

1. **Resolved (user, 2026-11-22):** keep the four seeded external avatar URLs as provenance-only external links; do not re-host them in Phase 2.
2. **Resolved by implementation, pending objection:** reuse `cosmetics.read`/`cosmetics.write` for asset management; no new granular permissions were added.
3. **Resolved (user, 2026-11-22):** retire the disconnected bundle-purchase path rather than expose an untested money path. Phase 5 should remove or leave it dormant, not wire a dialog to it.
4. **Still open:** target environment and storage driver before applying migration 6 or publishing assets.
5. **Resolved (user, 2026-11-22):** keep SKU lists and store merchandising static; do not introduce a generic store/product/category catalogue in this program.
6. **Still open:** separately approved cleanup that clears `Achievement.imageData`/`imageMime` after badge artwork is migrated to object storage.

## 5. Immediate next action

Proceed with the remaining Phase 4 items (public profile/chat/room asset pass where asset fields exist, device visual QA and full lint/assemble), then live verification against a confirmed environment. Do not apply migrations 6–8 or publish assets against an unconfirmed environment.

## 6. Phase 1 implementation record (completed after this audit)

Implemented as an additive backend slice:

- `services/storage.ts`: generic `ManagedFolder` union including `assets`/`assets-staging`, private routing rules for staging, `persistManagedBuffer()`, `loadAssetStagingFile()`, `assertAssetStagingFileName()` and private-aware `deleteStoredFile()`. Existing upload paths keep their previous URLs and behavior.
- `models/AssetObject.ts`: additive registry with owner/version/status, SHA-256, dimensions, staging keys, public URL, derived variants and creator; three indexes plus atomic version allocation in `asset.counters`.
- `services/assets.ts`: validated image staging (`sharp` signature/dimension checks, MIME allow-list, 8 MB cap), SHA-256 dedupe, immutable versioned WebP `full`/`preview` variants on publish, archive with object cleanup, lookup and listing helpers.
- `routes/adminAssets.ts`: `GET/POST /api/admin/assets`, `GET /api/admin/assets/staging/:fileName`, `GET /api/admin/assets/:id`, `POST /api/admin/assets/:id/publish`, `DELETE /api/admin/assets/:id`, guarded by existing `cosmetics.read`/`cosmetics.write` permissions and `auditLog()`.
- `config/migration.ts`: additive version 6 indexes for `assetobjects` with a matching index-only down function; `app.ts` mounts the new admin router.
- `apps/api/package.json` and workspace lock: explicit `sharp` dependency (previously transitive).
- `services/assets.test.ts`: six pure helper/validation tests; `services/adminAudit.test.ts`: one string-ID audit test.
- Contracts/docs: `API_CONTRACTS.md`, `DATABASE_SCHEMA.md`, `openapi.yaml`.

**Verification run:** `npm.cmd --workspace @yugm/api run typecheck` exit 0; `npm.cmd --workspace @yugm/api test` 186/186 passing; `npm.cmd --workspace @yugm/api run test:hardening` 34/34 passing; `git diff --check` clean apart from LF/CRLF notices. **Not run:** live MongoDB/S3/local upload→publish→archive flow, migration application, admin UI build, Android builds. No commit, push, deploy or production data change.

## 7. Data/admin/test audit reconciliation

The third audit was completed after the Phase 1 code was written. Its findings were checked against source and reconciled as follows.

### Fixed in this slice

- **Audit-log cast defect:** `AdminAuditLog.entityId` is an ObjectId, but cosmetics, reactions and asset UUIDs are strings. `services/adminAudit.ts` now writes non-ObjectId string IDs into `metadata.entityId` and leaves `entityId` unset, so audit entries are no longer silently lost. `adminCosmetics.ts` and `adminReactions.ts` now use the best-effort `auditLog()` helper with request IP/UA instead of direct `AdminAuditLog.create()` calls that could fail the primary mutation after it succeeded. Covered by `adminAudit.test.ts`.
- **Archive ordering:** `archiveAsset()` now clears the published DB reference before deleting objects. A later deletion failure cannot leave a published document pointing at removed objects.
- **Explicit index set:** `AssetObject` was added to `services/productionIndexes.ts` so its indexes are created in deployments that manage indexes explicitly.
- **OpenAPI:** admin asset paths were added; the audit's "no cosmetic/asset coverage" observation is now stale.
- **Documentation drift:** `CURRENT_TASK.md`, `DEVELOPMENT_PROGRESS.md`, `INDEX.md`, API/DB contracts and this audit were updated after implementation.

### Still open / pre-existing (not changed in Phase 1)

- **No consumers yet:** `resolvePublishedAsset()` has no callers; cosmetics, badges and gifts still use their own `assetUrl`/`imageUrl`/`imageData` fields. This is intentional until Phases 2–3.
- **No published-reference guard on archive:** cannot be implemented correctly until `assetRef` fields exist on consumers (querying undefined Mongoose paths is unsafe). Required before Phase 3 archive is exposed to admins.
- **No admin UI page:** `/api/admin/assets` is backend-only. An Assets view is needed before non-technical admins can upload art.
- **Asset route/integration tests missing:** only pure helper tests exist. A live upload→publish→read→archive flow against test storage and an admin route permission/audit test are still required.
- **Achievement tier enum drift:** `Achievement` defines six tiers while `User.claimedAchievementTiers.tier` allows four, and one wallet test encodes the contradictory four-tier enum. Pre-existing and outside this slice; record separately rather than change here.
- **Startup maintenance failures are non-fatal:** `index.ts` logs post-listen migration/index failures. Migration 6 must be verified explicitly against the target environment.
- **`autoIndex` is not disabled in production DB config:** existing behavior, not altered here.
- **Reaction asset ownership:** room reactions remain a separate asset path; the registry intentionally starts with cosmetic/badge/gift owners only.
- **`PROFILE_BANNER`:** verified present in the backend `adminCosmetics.ts` type list; the audit's omission finding did not reproduce against current source. Admin UI list was not changed; Phase 2 also added it to the admin UI dropdown.

## 8. Phase 2 implementation record (cosmetic asset references)

- **Schema:** `Cosmetic.assetRef` (optional string) plus additive migration 7 (sparse `cosmetic_asset_ref` index, index-only down). No cosmetic/user document was rewritten. `Cosmetic` was added to the explicit `productionIndexes.ts` set.
- **Read path:** `toPublicCosmetic()` now accepts a published `PublicAsset` and exposes `assetId`, `assetVersion` and client-safe `assetVariants`. `listPublicCosmetics()`/`listCosmeticsByIds()` batch-resolve refs in one query; a new `toPublicCosmeticWithAsset()` covers the two single-cosmetic wallet purchase responses. Legacy `assetUrl` remains the fallback for legacy-only, staging, archived and missing assets.
- **Write path:** admin create/update accept `assetRef` and validate owner type/id, published status and a usable URL/variant. `archiveAsset()` returns `409` while a cosmetic still references it.
- **Admin UI:** new **Managed Assets** page (stage, publish, archive, published-variant link); Cosmetics drawer links a published cosmetic asset and now includes `PROFILE_BANNER`.
- **Verification run:** API typecheck exit 0; API tests 192/192 (six new cosmetic mapping tests + one archive-guard test); hardening 34/34; admin typecheck exit 0 and admin production build succeeded. Not run: live DB/storage flow, migration 7 application, Android builds, runtime admin QA.

**Phase 2 deviations from the plan:** `assetVariants` is not duplicated onto the `Cosmetic` document — the `AssetObject` registry is the single source of truth and variants are resolved at read time. The four seeded external avatar URLs were not backfilled into the registry, per the user's decision to keep them as provenance-only links.

## 9. Phase 3 implementation record (additive badge asset references)

- **Scope gate:** an additive slice only. No `imageData`/`imageMime` blob was read, rewritten or deleted; the dedicated multipart badge upload and `/api/badge-art/:id/:version` route stay intact for legacy badges. Bulk blob cleanup and upload retirement still require the separately approved cutover.
- **Schema:** `Achievement.assetRef` (optional string) plus migration 8 (sparse `badge_asset_ref` index, index-only down). `Achievement` was added to the explicit `productionIndexes.ts` set. No badge document is rewritten.
- **Read path:** `badgeCatalog()` batch-resolves published badge assets by id in one query and attaches a read-time projection. `badgePublicArt()`/`publicBadge()` expose `assetId`, `assetVersion` and `assetVariants[]`, and resolve `imageUrl` from managed `publicUrl` → `full` variant → legacy `imageUrl`. Earned/worn state and expirations are unchanged.
- **Write path:** admin badge create/update accept `assetRef` and validate published status and `ownerType=badge`/`ownerId=<badge id>` through the pure `assertBadgeAssetTarget()` helper; "remove custom image" clears the managed reference too. `archiveAsset()` now counts both cosmetic and badge refs before returning `409`.
- **Admin UI:** the Badges form links a published badge asset; managed art overrides an uploaded image.
- **Verification run:** API typecheck exit 0; API tests 199/199 (seven new badge tests: four DTO mapping + three asset-reference validation); hardening 34/34 (existing badge artwork route still passes unchanged); admin typecheck exit 0 and production build succeeded; generated `dist/` artifacts reverted to `HEAD`. Not run: live DB/storage flow, migration 8 application, Android builds, runtime admin QA.

## 10. Phase 4 implementation record (Android asset-aware renderer, first slice)

- **Single entry point:** `core:ui` `AssetArtwork` uses the existing `resolveMediaUrl()`/Coil path. `selectAssetArtworkUrl()` picks the requested named variant, then `full`, then the direct URL; strings that are not URLs (emoji/gift keys) are treated as absent. `loading`/`error` draw the caller's fallback, so legacy-only items and failed downloads keep their procedural/icon/emoji art.
- **DTO consumption:** shared `AssetVariant` model plus `AssetParser` helpers feed `ProfileCosmetic`, `InventoryCosmetic` and `Achievement` from the public DTOs' `assetId`, `assetVersion` and `assetVariants[]`. No variants are stored on consumer documents.
- **Migrated consumers:** store and customize previews, inventory cosmetic tiles, badge art and gift tiles. The inventory equip coroutine moved to `GiftViewModel`; `CosmeticsViewModel.refresh()` clears `error`, surfaces failures and the store renders a Retry action. Merchandising copy/active-field maps remain static constants because the recorded product decision keeps SKUs static.
- **Not in this slice:** public profile/chat/room consumers that do not yet expose asset fields, the separate animated reaction renderer (not part of the asset registry), device visual QA, and full lint/assemble.
- **Verification run:** Android Studio JBR, `--console=plain --max-workers=2`: compiles of `:core:model`, `:core:api`, `:core:ui`, `:feature:profile`, `:feature:gift` — BUILD SUCCESSFUL; `:core:api:testDebugUnitTest` 33/33 and `:core:ui:testDebugUnitTest` 11/11 — BUILD SUCCESSFUL (six new tests: three parser, three variant selection). `git diff --check` clean. No backend source changed.
