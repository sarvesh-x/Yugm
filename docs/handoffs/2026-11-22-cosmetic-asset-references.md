# Handoff — YUGM-COSMETICS-001 Phase 2 cosmetic asset references

**Date:** 2026-11-22
**Status:** Phase 2 backend + admin slice implemented, unit-verified and committed locally as `0e17033`; **not pushed**, no migration applied, no deploy. Program incomplete.

## What was done

- **Schema:** `Cosmetic.assetRef` is an optional string reference to a published `AssetObject`. Additive only — no cosmetic or user document was rewritten, and legacy `assetUrl`/`assetKind` values are untouched. Migration 7 creates the sparse `cosmetic_asset_ref` index (index-only down) and has **not** been applied. `Cosmetic` was added to the explicit `productionIndexes.ts` set.
- **Read path:** `services/cosmetics.ts` `toPublicCosmetic()` accepts a published `PublicAsset`, resolves `assetUrl` from `publicUrl` → `full` variant → legacy `assetUrl`, and exposes `assetId`, `assetVersion` and client-safe `assetVariants[]`. `listPublicCosmetics()` and `listCosmeticsByIds()` batch-resolve refs in one query (no N+1); `toPublicCosmeticWithAsset()` covers the two single-cosmetic wallet purchase responses. Staging/archived/missing refs fall back to the legacy URL.
- **Write path:** admin cosmetic create/update accept `assetRef` and reject an asset that is not published, not owned by `ownerType=cosmetic` + that cosmetic id, or has no usable URL/full variant. `archiveAsset()` returns `409` while any cosmetic still references the asset; the guard is a pure `assertNoPublishedReferences()` helper with unit coverage.
- **Admin UI:** new `AssetsPage.tsx` (**Managed Assets** nav item, `cosmetics.write`) stages, publishes and archives assets. The Cosmetics drawer lists published cosmetic assets and links a version; the table shows a **LINKED** badge. `PROFILE_BANNER` was added to the admin cosmetic type dropdown.
- **Contracts/docs:** `API_CONTRACTS.md`, `DATABASE_SCHEMA.md`, OpenAPI (`409` on archive), `features/cosmetics-ecosystem-audit.md` (§8), `CURRENT_TASK.md`, `DEVELOPMENT_PROGRESS.md`, this handoff.

## Verification actually run

- `npm.cmd --workspace @yugm/api run typecheck` — exit 0.
- `npm.cmd --workspace @yugm/api test` — 192/192 passing (six new cosmetic DTO tests + one archive-guard test added to the existing asset suite).
- `npm.cmd --workspace @yugm/api run test:hardening` — 34/34 passing.
- `npm.cmd --workspace @yugm/admin run typecheck` — exit 0.
- `npm.cmd --workspace @yugm/admin run build` — succeeded (Vite production build). Generated `dist/` artifacts were restored to `HEAD` afterwards; only source files remain modified.
- `git diff --check` — clean apart from pre-existing LF→CRLF notices.

Not run: live DB/storage upload→publish→read→archive flow, migration 6/7 application, admin route/permission integration tests, runtime admin UI QA, OpenAPI parser validation, Android builds.

## Decisions carried forward

1. Seeded external DiceBear/Giphy avatar URLs stay provenance-only; no backfill into the registry.
2. Store SKUs/merchandising stay static; no Product/StoreCategory models.
3. The disconnected `purchaseBundle` path stays retired.
4. Reuse `cosmetics.read`/`cosmetics.write`; no granular asset permissions.
5. Badge `imageData`/`imageMime` cleanup still needs separate approval after a verified cutover.
6. Variants are **not** duplicated onto the cosmetic document — the registry is the single source of truth and variants are resolved at read time.

## Next session

1. Phase 3: migrate badge artwork off `Achievement.imageData` onto the shared asset service; clear the DB blobs only after a separately approved, verified cutover. Update archive guard to cover badge/gift refs as those owners are wired.
2. Phase 4: Android renderer unification — consume `assetUrl`/`assetVariants` in `CosmeticArtwork.kt` with the current procedural art as fallback.
3. Live verification against a confirmed environment: apply migrations 6/7, exercise upload→publish→read→archive, admin permission/audit integration tests, OpenAPI parser validation, runtime UI QA.
4. Track the pre-existing achievement tier enum drift (six `Achievement` tiers vs four `claimedAchievementTiers` tiers) separately.
5. Do not commit/push this slice or any production migration/deploy without explicit authorization. Preserve ownership, balances, equipped cosmetics, badges, progress and history.

## Working-tree note

Tracked admin `dist/` artifacts changed by the production build were reverted to `HEAD`; the pre-existing ignored local logs (`android-client/build_log.txt`, `android-client/errors.txt`, `android-client/out.txt`, `build_out.txt`) were left untouched.
