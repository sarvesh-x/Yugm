# Handoff — YUGM-COSMETICS-001 Phase 4 first slice (Android asset-aware renderer)

**Date:** 2026-11-22
**Status:** Android renderer slice implemented, verified and committed locally as `7f7182f`; **not pushed**, no backend change, no migration/deploy. Program incomplete.

## What was done

- **One renderer:** `core:ui/components/AssetArtwork.kt` is the single asset-aware image entry point. It uses the existing `resolveMediaUrl()`/Coil path, prefers a named variant (`preview` for small art), then `full`, then the direct URL, and draws the caller's fallback when there is no asset or the image fails. `selectAssetArtworkUrl()` is pure and ignores emoji/short keys that are not URLs.
- **DTO consumption:** new shared `AssetVariant` model and `AssetParser` helpers (`optAssetUrl`, `optAssetVersion`, `optAssetVariants`). `ProfileCosmetic`, `InventoryCosmetic` and `Achievement` now expose `assetId`, `assetVersion` and `assetVariants[]`; legacy `assetUrl`/`imageUrl` data still parses with empty asset fields. Variants are never copied onto local persisted state.
- **Consumers migrated:** store grid/purchase preview and customize preview via `CosmeticArtwork`'s new optional asset parameters; inventory cosmetic tiles; `BadgeArtwork`; `GiftArtwork`. Procedural art, the badge icon and the gift emoji remain fallbacks, so legacy-only and failed-download cases render as before.
- **State holder fixes:** `CosmeticsViewModel.refresh()` clears `error` on refresh and records failures; the store shows the error with a Retry action. Inventory equip moved from a composable `rememberCoroutineScope` block into `GiftViewModel.equipCosmetic()`, which reloads inventory only after the server accepts the change.
- **Decisions respected:** store merchandising/category labels and active-field maps remain static constants (the recorded product decision keeps SKUs static). No second image loader or competing theme/navigation was added.

## Verification actually run

- Android Studio JBR, `--console=plain --max-workers=2`: `:core:model:compileDebugKotlin`, `:core:api:compileDebugKotlin`, `:core:ui:compileDebugKotlin`, `:feature:profile:compileDebugKotlin`, `:feature:gift:compileDebugKotlin` — **BUILD SUCCESSFUL** (only pre-existing deprecation/shadowing warnings).
- `:core:api:testDebugUnitTest` — **33/33**; `:core:ui:testDebugUnitTest` — **11/11**; six new tests (three asset-reference parser tests, three variant-selection tests). One initial renderer test expectation was corrected before the final green run.
- `git diff --check` — clean.

Not run: device/emulator visual QA, full lint/assemble, live DB/storage flow, migrations 6–8 application, OpenAPI parser validation, and any backend test (no backend source changed).

## Next session

1. Phase 4 is committed locally as `7f7182f`; do not push/deploy without explicit authorization.
2. Remaining Phase 4 consumer pass: public profile/chat/room artwork only where public DTOs expose asset fields; keep the animated reaction renderer separate because reactions are not part of the asset registry.
3. Device/emulator QA: managed vs legacy art on store/customize/inventory/badge/gift, light/dark/system themes, font scaling, narrow widths, TalkBack, and failed/loading image states; then full lint/assemble.
4. Live verification against a confirmed environment: apply migrations 6–8, exercise upload→publish→read→archive, add admin route/permission/audit integration tests for cosmetic and badge `assetRef`, and validate OpenAPI with a parser.
5. Keep badge `imageData`/`imageMime` blobs, the dedicated badge upload and `/api/badge-art/:id/:version` untouched until separately approved cutover. Preserve ownership, balances, equipped cosmetics, badges, progress, gift/purchase history and expirations.
6. Track the pre-existing achievement tier enum drift (six `Achievement` tiers vs four `User.claimedAchievementTiers.tier` values) separately.
