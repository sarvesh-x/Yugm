# Handoff: D1 final reviewed mapping batch (KYC, matches, gifts, notifications, PK, payouts)

**Date:** 2026-11-22
**Status:** Unfinished local design work. No MongoDB/D1 connection, real snapshot export, D1 import, R2 operation, provision, deploy or production data change. The generated D1 schema is still a review draft. These changes are uncommitted.

## What was done

- Extended `backend-server/apps/api/src/migration/mappings.ts` (`ROOT_TABLES` and `MAPPINGS`) with reviewed transforms for the last 13 root models: `creator_payout_kycs`, `friend_match_requests`, `gifts`, `matches`, `notifications`, `notification_campaigns`, `payout_reviews`, `pk_battles`, `pk_events`, `pk_invites`, `pk_leaderboard_entries`, `pk_participants` and `pk_votes`. The reviewed registry now covers all 97 root models; 0 remain.
- Preserved draft-DDL enums and defaults: KYC/payout statuses, friend-match status, gift category/rarity/bond-purpose, notification type/campaign segment/status, payout-review status, PK battle mode/status/format/scope/result/event types, invite status, participant role/team, leaderboard/vote side, and boolean fields as 0/1 integers.
- Kept authoritative state explicit: canonical ObjectId references, UTC timestamps from source values, bounded integer money/points/counters, and JSON TEXT columns deterministically canonicalized for KYC metadata, gift upgrade paths, notification data/campaign filters, payout risk flags/payout, PK event metadata and other mixed fields.
- Normalized `Match.users` into deterministic `match_users` child rows with canonical source IDs and positions. No child element is silently dropped.
- Added `backend-server/apps/api/src/migration/mappings-final.test.ts` (14 tests) and expanded `mappings.test.ts` to assert the complete 97-collection registry and registry/root-table parity. The former `gifts` negative assertion now uses `unknown_collection` because all models are mapped.
- **Source/DDL conflicts flagged, not silently fixed:** `gifts.expires_at` and `gifts.collection_id` are nullable/default-null in Mongoose but `NOT NULL` in the draft DDL; the transform preserves source values (including null) rather than inventing a collection or date. `story_comments.parent_id` remains a separate flagged conflict from the messaging batch. `PkParticipant.joinedAt` is required because the source default is `Date.now`; a missing value is quarantined rather than re-dated. `PkParticipant` rows intentionally have no `created_at`/`updated_at` columns because the source model uses `timestamps: false` and the draft DDL has no such columns.

## Verification performed

- `npm.cmd exec -- tsx --test src/migration/mappings-final.test.ts src/migration/mappings.test.ts` — 24/24 focused tests passed (14 new tests plus the registry suite).
- `npm.cmd exec -- tsx --test src/migration/*.test.ts` — 138/138 migration tests passed across 15 files.
- `npm.cmd test --workspace apps/api` — 359/359 passed.
- `npm.cmd run typecheck --workspace apps/api` — passed.
- Static DDL cross-check — all 13 new root mapping column sets and the `match_users` child table match `migrations/d1/0001_initial.sql` (`collections=13 ... failures=0`). This extends earlier cross-checks covering the previous 84 mappings.
- Migration stats — `mappedCollections=97`, `rootTables=97`, `unmappedModels=0`, 131 total/unique DDL tables, 222 `REFERENCES`, 0 dotted columns, 0 duplicate columns, 204 `CHECK` constraints (46 numeric-range, 26 `>= 0`), 46 manifest warnings.
- `npm.cmd run migrate:rehearse -- --snapshot <generated fixture> --out <temp dir>` — validation PASS, exit 0 with generated records for all 13 collections (13 transformed root rows). Only generated fixture data was used; no real snapshot was read.
- `git diff --check` — clean (run after documentation edits in the handoff workflow).

No live SQLite parse (`sqlite3` unavailable), real export, production-data transform, D1 import, restore rehearsal, provision or deploy was run. A passing dry run is not proof that a production import would succeed.

## Gates and assumptions to resolve

- Owner decisions on all 46 manifest warnings and approval/refinement of `0001_initial.sql`. Explicit schema decisions are still needed for `story_comments.parent_id` and the two `gifts` null/default conflicts above.
- The global Mongoose `Number` → draft `INTEGER` limitation and the separately approved R2 operation for inline `Achievement.imageData` remain open; neither was changed by this batch.
- Draft DDL JSON TEXT columns (including the new metadata/filters/upgrade-path columns) still await field-by-field normalization decisions.
- DCR-1 (tracked credentials), DCR-3 (realtime protocol), DCR-4 (R2 media environment/scope), DCR-5 (plan acceptance), D1 capacity/recovery gates and backup/restore rehearsal remain open.
- Final delta sync, per-domain repository cutovers, R2 binary migration and Android/admin work are not implemented. No runtime persistence switch, MongoDB removal or cutover is authorized.

## Next agent actions

1. Keep all work local and non-destructive; preserve unrelated uncommitted changes.
2. Do not add more collection mappings unless the owner expands the reviewed source-model inventory; focus instead on owner decisions for schema warnings, DDL conflicts and the DCR gates.
3. Await explicit authorization before any commit, provision, deploy, migration, credential change, DNS change, cutover or release.
