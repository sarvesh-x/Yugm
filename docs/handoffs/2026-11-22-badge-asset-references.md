# Handoff — YUGM-COSMETICS-001 Phase 3 additive badge asset references

**Date:** 2026-11-22
**Status:** Phase 3 backend + admin slice implemented and verified in the working tree; **not committed, not pushed**, no migration applied, no deploy. Program incomplete.

## What was done

- **Scope gate:** additive only. No `Achievement.imageData`/`imageMime` blob was read, rewritten or deleted; the dedicated multipart badge upload and `/api/badge-art/:id/:version` route remain intact for legacy badges. Bulk blob cleanup and upload retirement still require the separately approved cutover.
- **Schema:** `Achievement.assetRef` is an optional string reference to a published `AssetObject`. Migration 8 creates the sparse `badge_asset_ref` index with an index-only down and has **not** been applied. No badge document is rewritten. `Achievement` was added to the explicit `productionIndexes.ts` set.
- **Read path:** `badgeCatalog()` batch-resolves published badge assets by id in one query and attaches a read-time projection; the registry stays the source of truth for URLs. `badgePublicArt()`/`publicBadge()` expose `assetId`, `assetVersion` and client-safe `assetVariants[]`, and resolve `imageUrl` from managed `publicUrl` → `full` variant → legacy `imageUrl`. Staging, archived and missing refs fall back to the legacy field. Earned/worn state, capacity and expirations are unchanged.
- **Write path:** admin badge create/update accept `assetRef` in the JSON `definition` and use the pure `assertBadgeAssetTarget()` helper to reject a reference that is not `published`, is not `ownerType=badge`/`ownerId=<that badge id>`, or has neither `publicUrl` nor a `full` variant. "Remove custom image" clears `imageData`/`imageMime`/`imageUrl` **and** `assetRef`. `archiveAsset()` returns `409` while either a cosmetic or a badge still references the asset.
- **Admin UI:** the Badges form links a published badge asset from **Managed Assets**; managed art overrides an uploaded image, and the badge table marks linked definitions.
- **Contracts/docs:** `API_CONTRACTS.md`, `DATABASE_SCHEMA.md`, OpenAPI badge gallery response note, `features/cosmetics-ecosystem-audit.md` (§9), `CURRENT_TASK.md`, `DEVELOPMENT_PROGRESS.md`, and this handoff.

## Verification actually run

- `npm.cmd --workspace @yugm/api run typecheck` — exit 0.
- `npm.cmd --workspace @yugm/api test` — 199/199 passing (seven new badge tests: four `badges.test.ts` DTO mapping tests and three `adminBadges.test.ts` asset-reference validation tests).
- `npm.cmd --workspace @yugm/api run test:hardening` — 34/34 passing; the existing permission-gated legacy badge artwork route still passes unchanged.
- `npm.cmd --workspace @yugm/admin run typecheck` — exit 0.
- `npm.cmd --workspace @yugm/admin run build` — succeeded (Vite production build). Generated `dist/` artifacts were restored to `HEAD` afterwards; only source files remain modified.
- `git diff --check` — clean apart from the repository's pre-existing LF→CRLF notices.

Not run: live DB/storage upload→publish→read→archive flow, migrations 6–8 application, admin route/permission integration tests for `assetRef`, runtime admin UI QA, OpenAPI parser validation, Android builds, and any production migration or deployment.

## Decisions carried forward

1. Seeded external DiceBear/Giphy avatar URLs stay provenance-only; no backfill into the registry.
2. Store SKUs/merchandising stay static; no Product/StoreCategory models.
3. The disconnected `purchaseBundle` path stays retired.
4. Reuse `cosmetics.read`/`cosmetics.write`; no granular asset permissions.
5. Badge `imageData`/`imageMime` cleanup and retirement of the dedicated upload remain gated on a separately approved, verified cutover.
6. Variants are never duplicated onto `Achievement` — the `AssetObject` registry is the single source of truth and variants are resolved at read time.
7. Publishing a new version allocates new immutable object keys; an existing published URL is never overwritten.

## Next session

1. Phase 4: Android renderer unification — consume `assetUrl`/`assetVariants` in shared cosmetic/badge artwork with the current procedural art as fallback; do not add a second image pipeline.
2. Live verification against a confirmed environment: apply migrations 6–8, exercise upload→publish→read→archive, add admin route/permission/audit integration tests for badge `assetRef`, validate OpenAPI with a parser, and perform runtime UI QA.
3. Obtain explicit approval before any commit, push, migration, deploy or destructive badge-blob cleanup. Local commits `0e17033` and `9dfe4ef` remain unpushed.
4. Track the pre-existing achievement tier enum drift (six `Achievement` tiers vs four `User.claimedAchievementTiers.tier` values) separately.
5. Preserve ownership, balances, equipped cosmetics, badges, progress, gift/purchase history and expirations.

## Working-tree note

Tracked admin `dist/` artifacts changed by the production build were reverted to `HEAD`. Phase 3 is a working-tree slice only; Phase 2 remains committed locally as `0e17033` with the status-doc follow-up `9dfe4ef`.
