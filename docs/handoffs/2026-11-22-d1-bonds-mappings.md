# Handoff: D1 bonds and vibe-graph mappings

**Date:** 2026-11-22
**Status:** Unfinished local design work. No MongoDB/D1 connection, real snapshot export, D1 import, R2 operation, provision, deploy or production data change. The generated D1 schema is still a review draft. These changes are uncommitted.

## What was done

- Extended `backend-server/apps/api/src/migration/mappings.ts` (`ROOT_TABLES` and `MAPPINGS`) with reviewed transforms for six more collections: `bonds`, `bond_points`, `bond_ranking_snapshots`, `bond_requests`, `bond_rewards` and `vibe_graphs`. The reviewed registry now covers 78 of 97 root models; 19 remain.
- Preserved draft-DDL enums and defaults: bond statuses, bond-request statuses, preference visibility, active bond status, `PENDING` request status, default points/counts/version and empty milestone/interests/languages arrays.
- Kept authoritative bond state explicit: canonical pair keys and ObjectId references, UTC activation/expiry/grant timestamps, integer points/version/slot/replay version, request keys, gift snapshots and reward item IDs.
- Canonicalized the JSON TEXT draft columns: `bonds.preferences` accepts Mongoose `Map` or plain-object storage, fills the service's per-user visibility/flag defaults, and soft-quarantines invalid nested values; `bond_ranking_snapshots.entries` validates entry bond IDs and integers, skips invalid entries softly, and requires an array at the parent boundary.
- Emitted deterministic child rows for `bond_users`, `bond_slots`, `vibe_graph_interests` and `vibe_graph_languages`. Integer slots are stored as INTEGER `value` columns; reference arrays store canonical source IDs with stable synthetic keys and positions.
- Enforced the source model's `vibeScore` range of 0–100 and required `lastVibeUpdate` rather than inventing a current timestamp during migration.
- Added `backend-server/apps/api/src/migration/mappings-bonds.test.ts` (12 tests) and expanded the registry assertion in `mappings.test.ts` to all 78 reviewed collections.

## Verification performed

- `npm.cmd exec -- tsx --test src/migration/mappings-bonds.test.ts src/migration/mappings.test.ts src/migration/mappings-events.test.ts src/migration/mappings-moderation.test.ts` — 46/46 focused tests passed.
- `npm.cmd exec -- tsx --test src/migration/*.test.ts` — 112/112 migration tests passed across 13 files.
- `npm.cmd test --workspace apps/api` — 333/333 passed.
- `npm.cmd run typecheck --workspace apps/api` — passed.
- Static DDL cross-check — all six new root mapping column sets and the four new child tables (`bond_users`, `bond_slots`, `vibe_graph_interests`, `vibe_graph_languages`) match `migrations/d1/0001_initial.sql`. This extends the earlier cross-check covering the previous 72 mappings.
- Static SQL structure check — 131 unique tables, 0 dotted columns, 0 duplicate columns, 222 `REFERENCES`, 46 warning entries; unchanged by this batch.
- `npm.cmd run migrate:rehearse -- --snapshot <generated fixture> --out <temp dir>` — validation PASS, exit 0 with generated records for all six collections (six transformed root rows). Only generated fixture data was used; no real snapshot was read.
- `git diff --check` — clean.
- Relative Markdown link check on changed docs — 0 broken links.

No live SQLite parse (`sqlite3` unavailable), real export, production-data transform, D1 import, restore rehearsal, provision or deploy was run. A passing dry run is not proof that a production import would succeed.

## Gates and assumptions to resolve

- Owner decisions on all 46 manifest warnings and approval/refinement of `0001_initial.sql`. The global Mongoose `Number` → draft `INTEGER` limitation and the separately approved R2 operation for inline `Achievement.imageData` remain open; neither was changed by this batch.
- `bonds.preferences` is a collapsed JSON draft column because the generator suppresses Mongoose `Map` wildcard paths. If owner-approved triage normalizes it, this transform must be revised with the schema.
- `bond_ranking_snapshots.entries` remains JSON TEXT in the draft. Normalizing historical ranking entries would need a separate schema decision and transform revision.
- DCR-1 (tracked credentials), DCR-3 (realtime protocol), DCR-4 (R2 media environment/scope), DCR-5 (plan acceptance), D1 capacity/recovery gates and backup/restore rehearsal remain open.
- 19 models still need reviewed mappings: clan invites/messages, creator payout KYC, friend match requests, gifts, group chat/messages, matches, notifications/campaigns, payout reviews, PK battle/event/invite/leaderboard/participant/vote, story comments and watch parties. No runtime persistence switch, MongoDB removal or cutover is authorized.

## Next agent actions

1. Keep all work local and non-destructive; preserve unrelated uncommitted changes.
2. Continue reviewed mappings for the remaining 19 models against the current draft DDL, with focused tests, then rerun the focused migration tests, full API suite, typecheck, DDL cross-checks and a generated-fixture rehearsal.
3. Await owner decisions on schema warnings, capacity/recovery and all DCR gates; do not commit unless newly authorized, and do not provision, deploy, migrate, rotate credentials, change DNS, cut over or release without explicit approval.
