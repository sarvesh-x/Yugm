# Handoff: D1 clan/group messaging and comment mappings

**Date:** 2026-11-22
**Status:** Unfinished local design work. No MongoDB/D1 connection, real snapshot export, D1 import, R2 operation, provision, deploy or production data change. The generated D1 schema is still a review draft. These changes are uncommitted.

## What was done

- Extended `backend-server/apps/api/src/migration/mappings.ts` (`ROOT_TABLES` and `MAPPINGS`) with reviewed transforms for six more collections: `clan_invites`, `clan_messages`, `group_chats`, `group_messages`, `story_comments` and `watch_parties`. The reviewed registry now covers 84 of 97 root models; 13 remain.
- Preserved draft-DDL enums and defaults: clan-invite statuses (with `PENDING` default), group-message media types (with `""` default and empty media URL), clan invite expiry as UTC, and the group-chat `lastMessage` empty-string default.
- Kept authoritative state explicit: canonical ObjectId references for clan/group/story/room actors, UTC `expiresAt`/`lastMessageAt`/reaction `createdAt` timestamps, integer `duration`/`position`, and 0/1 `isPlaying` flags.
- Normalized arrays into deterministic child rows: `clan_messages.reactions` into `clan_message_reactions` (reusing the established reaction enum, soft-quarantining bad reactions) and `group_chats.participantIds` into `conversation_participants` (the draft DDL already specifies this child table for the parent).
- `story_comments.parent_id` is preserved as-is: root comments keep `null`, replies keep the canonical source ID. **Source/DDL conflict flagged:** the Mongoose model declares `parentId` with `default: null`, but the draft DDL declares `parent_id ... NOT NULL REFERENCES story_comments`. The transform does not invent a self-reference; a live import would need the owner to relax that DDL constraint (or supply an explicit rule). A malformed optional parent is soft-quarantined so a valid comment is retained.
- Added `backend-server/apps/api/src/migration/mappings-messaging.test.ts` (12 tests) and expanded the registry assertion in `mappings.test.ts` to all 84 reviewed collections.

## Verification performed

- `npm.cmd exec -- tsx --test src/migration/mappings-messaging.test.ts src/migration/mappings.test.ts src/migration/mappings-bonds.test.ts src/migration/mappings-events.test.ts src/migration/mappings-moderation.test.ts` — 58/58 focused tests passed.
- `npm.cmd exec -- tsx --test src/migration/*.test.ts` — 124/124 migration tests passed across 14 files.
- `npm.cmd test --workspace apps/api` — 345/345 passed.
- `npm.cmd run typecheck --workspace apps/api` — passed.
- Static DDL cross-check — all six new root mapping column sets and the two child tables (`clan_message_reactions`, `conversation_participants`) match `migrations/d1/0001_initial.sql`. This extends the earlier cross-check covering the previous 78 mappings.
- Static SQL structure check — 131 unique tables, 0 dotted columns, 0 duplicate columns, 222 `REFERENCES`, 46 warning entries; unchanged by this batch.
- `npm.cmd run migrate:rehearse -- --snapshot <generated fixture> --out <temp dir>` — validation PASS, exit 0 with generated records for all six collections (six transformed root rows). Only generated fixture data was used; no real snapshot was read.
- `git diff --check` — clean.

No live SQLite parse (`sqlite3` unavailable), real export, production-data transform, D1 import, restore rehearsal, provision or deploy was run. A passing dry run is not proof that a production import would succeed.

## Gates and assumptions to resolve

- Owner decisions on all 46 manifest warnings and approval/refinement of `0001_initial.sql`. In particular, the `story_comments.parent_id` `NOT NULL` conflict above needs a schema decision before a live import.
- The global Mongoose `Number` → draft `INTEGER` limitation and the separately approved R2 operation for inline `Achievement.imageData` remain open; neither was changed by this batch.
- DCR-1 (tracked credentials), DCR-3 (realtime protocol), DCR-4 (R2 media environment/scope), DCR-5 (plan acceptance), D1 capacity/recovery gates and backup/restore rehearsal remain open.
- 13 models still need reviewed mappings: creator payout KYC, friend match requests, gifts, matches, notifications/campaigns, payout reviews, and PK battle/event/invite/leaderboard/participant/vote. No runtime persistence switch, MongoDB removal or cutover is authorized.

## Next agent actions

1. Keep all work local and non-destructive; preserve unrelated uncommitted changes.
2. Continue reviewed mappings for the remaining 13 models against the current draft DDL, with focused tests, then rerun the focused migration tests, full API suite, typecheck, DDL cross-checks and a generated-fixture rehearsal.
3. Await owner decisions on schema warnings, the `story_comments.parent_id` constraint, capacity/recovery and all DCR gates; do not commit unless newly authorized, and do not provision, deploy, migrate, rotate credentials, change DNS, cut over or release without explicit approval.
