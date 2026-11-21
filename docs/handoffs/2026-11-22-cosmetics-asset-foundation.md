# Handoff — YUGM-COSMETICS-001 Phase 1 asset foundation

**Date:** 2026-11-22
**Status:** Phase 1 backend slice implemented and unit-verified; program incomplete. No commit, push, migration application or deploy.

## What was done

- **Audit:** [cosmetics ecosystem audit](../features/cosmetics-ecosystem-audit.md) with a per-feature status matrix and six-phase additive migration plan. Android, backend, and data/admin/test audits are incorporated (see §7 of the audit for reconciliation).
- **Storage:** `backend-server/apps/api/src/services/storage.ts` now has a `ManagedFolder` union including `assets` and private `assets-staging`, generic private routing, `persistManagedBuffer()`, `loadAssetStagingFile()`, `assertAssetStagingFileName()` and private-aware local deletion. Existing avatar/reaction/trust paths keep their prior URLs and behavior.
- **Registry:** `models/AssetObject.ts` (additive) + `services/assets.ts` — validated staging, SHA-256 dedupe, atomic version counter, immutable versioned WebP variants, publish/archive, lookup and listing.
- **Admin:** `routes/adminAssets.ts` mounted at `/api/admin/assets`; reads require `cosmetics.read`, mutations `cosmetics.write`; all mutations call `auditLog()`.
- **Migration:** additive version 6 in `config/migration.ts` creates only `assetobjects` indexes; down function drops only those indexes. **Not applied.**
- **Contracts/docs:** `API_CONTRACTS.md`, `DATABASE_SCHEMA.md`, `openapi.yaml`, `CURRENT_TASK.md`, `DEVELOPMENT_PROGRESS.md`, `INDEX.md`.
- **Dependency:** `sharp` added explicitly to `@yugm/api` and the workspace lock.
- **Audit fixes:** `adminAudit.ts` stores non-ObjectId string/UUID entity IDs in `metadata.entityId` (was silently lost to a cast error); `adminCosmetics.ts`/`adminReactions.ts` switched to the shared `auditLog()` helper; `archiveAsset()` clears DB references before deleting objects; `AssetObject` added to the explicit `productionIndexes.ts` set.

## Verification actually run

- `npm.cmd --workspace @yugm/api run typecheck` — exit 0.
- `npm.cmd --workspace @yugm/api test` — 186/186 passing (six asset + one audit test).
- `npm.cmd --workspace @yugm/api run test:hardening` — 34/34 passing.
- `git diff --check` — clean apart from existing LF/CRLF notices.
- Not run: live upload→publish→read→archive against any storage driver, migration application, admin UI typecheck/build, Android compiles.

## Decisions

Resolved by the user on 2026-11-22:

1. **External avatar URLs:** keep the seeded DiceBear/Giphy URLs as provenance only; do not re-host in Phase 2.
2. **Asset permissions:** reuse existing `cosmetics.read`/`cosmetics.write`; no new granular permissions.
3. **Bundle purchase:** retire the disconnected path; do not expose an untested money path.
4. **Store catalogue:** keep SKUs and store merchandising static; no Product/StoreCategory models.

Still open:

1. Confirm target environments and storage driver before applying migration 6 or publishing assets.
2. Approve the later cleanup that clears `Achievement.imageData`/`imageMime` after badge art is migrated.

## Next session

1. Phase 2: additive `assetRef`/`assetVariants` on `Cosmetic`, resolve published assets in `toPublicCosmetic()`, backfill legacy `assetUrl` values, and wire the admin Cosmetics form to the asset uploader (add an admin Assets view).
2. Add a published-reference guard before exposing archive to admins; add asset route permission/audit and live upload→publish→read→archive tests against test storage.
3. Phase 3: replace the dedicated `adminBadges.ts` upload with the shared asset service and move badge bytes out of the primary DB (cleanup only after a separately approved cutover).
4. Only then: Android renderer unification and realtime catalog invalidation. Track the pre-existing achievement tier enum drift separately.
5. Keep all valuable state server-authoritative; do not overwrite ownership, balances, equipped cosmetics, badges, progress or history. No production migration/deploy without explicit authorization.

## Working-tree note

Pre-existing untracked local logs (`android-client/build_log.txt`, `android-client/errors.txt`, `android-client/out.txt`, `build_out.txt`) were left untouched.
