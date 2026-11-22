# Handoff: MongoDB to D1 decision and first schema draft

**Date:** 2026-11-22  
**Status:** Unfinished. Decision recorded and a local review draft generated. No MongoDB model was deleted, no D1 resource provisioned, no data exported/imported, no credential changed and no deploy performed.

## What was done

- Recorded the owner's decision in [ADR-0001](../decisions/0001-d1-and-r2-target.md): D1 for authoritative relational state, R2 for all binaries, MongoDB retired from the target architecture but retained as source/rollback until cutover is validated.
- Closed DCR-2 in the [Phase 0 decision request](../cloudflare-migration/decision-request.md) and updated the [D1 capacity assessment](../database/d1-capacity-assessment.md), [mapping spec](../database/mongo-to-relational-mapping.md), [implementation plan](../migration/implementation-plan.md), `docs/INDEX.md`, `docs/CURRENT_TASK.md` and `docs/DEVELOPMENT_PROGRESS.md`.
- Added `backend-server/apps/api/src/scripts/generate-d1-schema.ts` with an npm `schema:d1` script. It dynamically imports local model files, reads registered Mongoose schemas and emits D1/SQLite DDL plus a review manifest. It does not connect to any database and does not read credential values.
- Generated `backend-server/apps/api/migrations/d1/0001_initial.sql` and `0001_initial.manifest.json`: 91 model files imported, 97 registered root models, 34 spec-required child tables (131 total), 0 import failures, 46 remaining warnings. The generator emits FK references (222), `min` CHECKs (46), enum CHECKs and translated indexes.
- Added the Phase 2 foundation under `backend-server/apps/api/src/migration/`: `types.ts`, `transform.ts` (canonical IDs, UTC dates, integer money, preserved enums, quarantine and accountancy), `checkpoint.ts` (batch idempotency/restart), `validate.ts` (count/uniqueness/referential/balance reports), `snapshot.ts` (deterministic checksums and filesystem snapshot store), `export.ts` (bounded read-only export with count/checksum checks) and `import.ts` (checkpoint-backed, idempotent, dry-run-capable importer with manifest checksum verification). Also added `mongoSource.ts` (read-only keyset-paginated Mongoose adapter), `d1Target.ts` (D1-compatible batch writer with 100-parameter chunking and identifier validation) and golden transform fixtures. Added `mappings.ts` with reviewed per-collection transforms for 50 collections (identity/auth, finance/entitlements, assets/media, social/messaging, rooms/live state and progression/rewards: `friendships`, `blocks`, `follows`, `clans`, `direct_messages`, `chat_messages`, `conversation_mutes`, `stories`, `story_highlights`, plus rooms/live state (`rooms`, `room_participants`, `room_invites`, `room_follows`, `room_mode_states`, `room_reactions`, `room_activities`, `room_recordings`, `speaker_requests`, `polls`, `voice_polls`), plus progression/rewards (`achievements`, `battle_passes`, `battle_pass_xp_grants`, `seasons`, `missions`, `user_missions`, `daily_questions`, `user_daily_answers`, `mini_game_challenges`, `mini_game_scores`, `cosmetics`, `immersive_themes`, `gift_collections`, `gift_inventories`, `wishlist_items`); root plus normalized child rows, including `asset_variants`, message reactions, hidden-for, story views, poll/voice-poll voters, ballots, room-mode participants, achievement tiers, battle-pass rewards, season rewards and gift-collection items) and `importMappedCollection` in `import.ts` for grouped, replay-safe multi-table imports. Draft-DDL JSON TEXT columns are deterministically canonicalized and would need remapping if the owner approves the warning triage. Added `idMap.ts` (deterministic, checksummed source-to-target ID maps with conflict rejection and stable JSONL) and `rehearsal.ts` plus a `migrate:rehearse` npm script/CLI (`src/scripts/rehearse-migration.ts`) that runs reviewed mappings through the real importer in dry run against an exported snapshot directory and emits transform/validation/id_map artifacts. Sixty-four passing unit tests across `transform.test.ts`, `pipeline.test.ts`, `adapters.test.ts`, `golden.test.ts`, `mappings.test.ts`, `mappings-domains.test.ts`, `mappings-social.test.ts`, `mappings-rooms.test.ts` and `rehearsal.test.ts`. No live MongoDB connection or Cloudflare binding is opened by this code.

## Verification performed

- `npm.cmd run schema:d1 --workspace apps/api` — 131 tables (97 roots + 34 child tables), 0 import failures, 46 review warnings.
- `npm.cmd exec -- tsx --test src/migration/transform.test.ts` — 8/8 passed.
- `npm.cmd exec -- tsx --test src/migration/pipeline.test.ts` — 7/7 passed.
- `npm.cmd exec -- tsx --test src/migration/adapters.test.ts src/migration/golden.test.ts` — 6/6 passed.
- `npm.cmd exec -- tsx --test src/migration/mappings.test.ts` — 10/10 passed.
- `npm.cmd exec -- tsx --test src/migration/rehearsal.test.ts` — 6/6 passed.
- `npm.cmd exec -- tsx --test src/migration/mappings-social.test.ts src/migration/mappings-domains.test.ts src/migration/mappings.test.ts` — 37/37 passed.
- `npm.cmd exec -- tsx --test src/migration/mappings-progression.test.ts` — 12/12 passed.
- `npm.cmd test --workspace apps/api` — 297/297 passed.
- `npm.cmd run typecheck --workspace apps/api` — passed.
- Static cross-check: every column emitted by the 50 reviewed mappings exists in `0001_initial.sql` (50 root tables; four new child tables also matched: `achievement_tiers`, `battle_pass_rewards`, `season_rewards`, `gift_collection_items`).
- `npm.cmd run migrate:rehearse --workspace apps/api -- --snapshot <generated fixture> --out <temp dir>` — validation PASS, exit 0, three aggregate artifacts written. A generated fixture snapshot was used; no real data. Missing `--snapshot` exits 1 with an explanatory message.
- Static inspection of generated SQL — 131 unique table names, 0 dotted quoted columns, 0 duplicate columns, 222 `REFERENCES` clauses, 46 `min` CHECKs.
- Not run: `sqlite3` CLI is not installed, so the DDL was not parsed by a live SQLite engine. No MongoDB or D1 connection, export, transform, import, migration, provision or deploy.

## Review warnings to resolve next

The manifest lists 46 warnings. A source-checked [triage proposal](../database/d1-schema-warning-triage.md) assigns a disposition to every warning; dominant categories:

- 17 array fields still stored as JSON TEXT (for example parallel arrays such as `Clan.memberIds`/`memberRoles`, `Room` role ID lists and `RoomModeState.currentOptions`) — decide per field whether a child table is required by the [mapping spec](../database/mongo-to-relational-mapping.md).
- 24 `Mixed`, 3 embedded and 2 map fields stored as JSON TEXT — decide which need normalization versus validated JSON.
- 1 binary field (`Achievement.imageData`) stored as TEXT — must become an R2 bucket/key/checksum reference during transform. The reviewed transform soft-quarantines legacy inline bytes and keeps `imageUrl`/`assetRef` as provenance; the blob move itself is a separate approved operation.
- Additional non-manifest review item: `generate-d1-schema.ts` maps every Mongoose `Number` to `INTEGER`, so fractional values (for example gift-collection bonus multipliers) require an owner type decision before a real import.
- Table and column names are mostly mechanical snake_case conversions; check the remaining names against the mapping spec.

## Gates still open

- DCR-1: tracked plaintext Worker credentials — rotation/removal authorization and provider access.
- DCR-2 residual: production metrics, Workers Paid, 10 GB / 2 MB / throughput / recovery checks. If they fail, [ADR-0001](../decisions/0001-d1-and-r2-target.md) must be revisited for Hyperdrive.
- DCR-3 realtime protocol path; DCR-4 R2 media environment/scope and still-missing R2 values; DCR-5 plan acceptance.
- Backup and rehearsed restore on isolated staging; destructive-operation approval; schema approval; running the local export/transform/import/validation/rehearsal tooling against a real snapshot; per-domain repository cutovers; Android/admin and contract work.
- Migrations 6–9 in the existing MongoDB path remain unapplied; the uncommitted R2/media foundation must be preserved.

## Next agent actions

1. Confirm remaining owner decisions and metrics; do not infer them from the D1 selection alone.
2. Decide the 46 manifest warnings using the source-checked [triage proposal](../database/d1-schema-warning-triage.md) (18 recommended child tables/promoted columns/R2 references, 28 validated JSON), then refine `0001_initial.sql` into an approved schema; the generator already emits FKs, child tables and `min` constraints for the curated set.
3. Extend the reviewed mappings to the remaining ~47 Mongoose models (moderation, events and other domains) on top of the existing pipeline with no production writes, then run `migrate:rehearse` against a real exported snapshot and rehearse restore on isolated staging. See also [the progression/rewards handoff](2026-11-22-d1-progression-mappings.md).
4. Only after explicit approvals: provision D1/R2 resources, run a production snapshot migration, cut over per domain and retire MongoDB code.

## Constraints

No credentials, bucket names, IDs or domains may be invented. Do not delete Mongoose models or switch runtime persistence before D1 repositories and validated data exist. No commit, push, deploy, migration, provision or release without explicit authorization.
