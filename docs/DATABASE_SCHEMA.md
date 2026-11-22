# Database schema map

The backend uses MongoDB through Mongoose. Model definitions are in `backend-server/apps/api/src/models/`; startup migration/index logic is in `src/config/migration.ts` and related services. Shared runtime contracts are separate from persisted schema.

The [generated schema inventory](production/schema-inventory.csv) records discovered declarations and explicit indexes. It is a static source inventory, not a report of live collections, installed indexes, data quality, or migration safety. The production architecture and finding register document startup index changes, transaction requirements, and unverified deployment state.

Before schema/index changes: inspect all readers/writers, old-client compatibility, duplicate existing keys, backfill strategy, rollback behavior, and whether a production-safe preflight is needed. Never run a migration against an unknown database. Do not represent standalone local Mongo as proof of transaction support.

## Asset registry (YUGM-COSMETICS-001, Phase 1)

`Cosmetic.assetRef` (Phase 2) is an optional string reference to a published `AssetObject` id. It is additive and does not replace `assetUrl`/`assetKind`; the public DTO resolves the published `publicUrl` and variants from the registry, falling back to the legacy field. Migration 7 creates a sparse index `cosmetic_asset_ref` on `cosmetics` and has not been applied. No cosmetic document is rewritten.

`Achievement.assetRef` (Phase 3) is the analogous optional reference for badge art. It does not replace `imageData`/`imageMime`/`imageUrl`; those legacy fields stay untouched until a separately approved cutover. Badge DTOs resolve managed `publicUrl`/variants with legacy fallback. Migration 8 creates a sparse index `badge_asset_ref` on `achievements` and has not been applied. No badge document is rewritten by this slice.

`AssetObject` (`assetobjects`) is an additive registry for admin-managed image assets. Each document owns a stable UUID, `ownerType` (`cosmetic|badge|gift`), `ownerId`, monotonic `version`, `status` (`staging|published|archived`), SHA-256, MIME type, byte size, dimensions, private `stagingKey`/`stagingUrl`, published `publicKey`/`publicUrl`, derived WebP `variants`, creator and timestamps. Indexes: unique `(ownerType, ownerId, version)`, `(ownerType, ownerId, sha256)`, `(status, createdAt)`. Versions are allocated atomically in `asset.counters`.

Objects live in object storage under `assets-staging/` (private, backend-read only) and `assets/` (public, immutable versioned keys); the primary DB holds metadata only. Migration 6 creates the indexes and is additive only — it must not be run against an unknown environment. No existing cosmetic, achievement, gift or user field was removed, rewritten or backfilled in Phase 1.
