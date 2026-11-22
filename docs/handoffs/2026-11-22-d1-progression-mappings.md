# Handoff: D1 progression/rewards mappings

**Date:** 2026-11-22
**Status:** Unfinished local design work. No database/account connection, export, import, provision, deploy or production data change. The generated D1 schema remains a review draft.

## What was done

- Extended `backend-server/apps/api/src/migration/mappings.ts` with reviewed transforms and registry entries (`ROOT_TABLES` and `MAPPINGS`) for 15 additional collections: `achievements`, `battle_passes`, `battle_pass_xp_grants`, `seasons`, `missions`, `user_missions`, `daily_questions`, `user_daily_answers`, `mini_game_challenges`, `mini_game_scores`, `cosmetics`, `immersive_themes`, `gift_collections`, `gift_inventories` and `wishlist_items`. Total reviewed mappings: 50 collections.
- Emitted normalized child rows only where the current draft DDL requires them: `achievement_tiers` (all six tiers, including MASTER/DIAMOND), `battle_pass_rewards`, `season_rewards` and `gift_collection_items`. Other fields stay in the draft's JSON TEXT columns with deterministic canonicalization.
- Preserved authoritative values: integer XP/coin/prices with bounds, boolean flags as 0/1, UTC timestamps, enum allowlists, canonical source IDs, string-keyed cosmetic IDs, embedded season/requirements/rewards/badge/bonus promotion, and optional references. Bad values are quarantined; child-row problems are soft quarantines and never falsely reject a valid parent.
- Kept the badge cutover boundary: legacy `Achievement.imageData`/`imageMime` fields, multipart badge upload and `/api/badge-art/:id/:version` are unchanged. Inline binary bytes are soft-quarantined and `imageUrl`/`assetRef` are retained as provenance for a separately approved R2 blob operation.
- Added `backend-server/apps/api/src/migration/mappings-progression.test.ts` (12 tests) and updated the registry test in `mappings.test.ts` to assert the 50 reviewed collections.
- Recorded a schema-wide review item in `docs/database/d1-schema-warning-triage.md`: `generate-d1-schema.ts` maps every Mongoose `Number` to `INTEGER`, so fractional values such as `GiftCollection.bonus.xpMultiplier`/`coinMultiplier` are quarantined by the draft-compliant transform. This is **not** a manifest warning and does not change the 46-warning count.

## Verification performed

- `npm.cmd exec -- tsx --test src/migration/mappings-progression.test.ts` — 12/12 passed.
- `npm.cmd exec -- tsx --test src/migration/*.test.ts` — 76/76 migration tests passed.
- `npm.cmd test --workspace apps/api` — 297/297 passed.
- `npm.cmd run typecheck --workspace apps/api` — passed.
- Static cross-check — all 50 root mapping column sets match `migrations/d1/0001_initial.sql`; the four new child tables match their DDL column sets exactly.
- `npm.cmd run migrate:rehearse --workspace apps/api -- --snapshot <generated fixture> --out <temp dir>` — validation PASS, exit 0 with generated `users` and `achievements` records (the latter exercising the new achievement-tier child rows). Only generated fixture data was used.

No live SQLite parse (`sqlite3` unavailable), snapshot export, transform on real data, import, rehearsal with a real snapshot, provision or deploy was run. A passing dry run is not proof that a production import would succeed.

## Gates and assumptions to resolve

- Owner decisions on all 46 manifest warnings and approval/refinement of `0001_initial.sql`. The `Number`→`INTEGER` issue above needs a decision before fractional source values can be imported.
- `Achievement.imageData` blob migration needs an explicitly approved R2 operation; this batch only preserves provenance.
- DCR-1 (tracked credentials), DCR-3 (realtime protocol), DCR-4 (R2 media environment/scope), DCR-5 (plan acceptance), capacity/recovery gates and backup/restore rehearsal remain open.
- Remaining ~47 Mongoose models (moderation, events and other domains) still need reviewed mappings. No runtime persistence switch, MongoDB removal or cutover is authorized.

## Next agent actions

1. Keep all work local and non-destructive; preserve unrelated uncommitted changes, including `yugm-cleanup/`.
2. Continue reviewed mappings for the moderation/events domains against the current draft DDL, with focused tests, then rerun the focused migration tests, full API suite, typecheck and DDL cross-checks.
3. Await owner decisions on schema warnings, capacity/recovery and all DCR gates; do not provision, deploy, migrate, rotate credentials, change DNS, cut over or release without explicit approval.
