# Handoff: D1 events, XP and engagement mappings

**Date:** 2026-11-22
**Status:** Unfinished local design work. No MongoDB/D1 connection, real snapshot export, D1 import, R2 operation, provision, deploy or production data change. The generated D1 schema is still a review draft. These changes are uncommitted.

## What was done

- Extended `backend-server/apps/api/src/migration/mappings.ts` (`ROOT_TABLES` and `MAPPINGS`) with reviewed transforms for 11 more collections: `app_config`, `countdown_events`, `events`, `xp_daily_caps`, `xp_grants`, `user_moods`, `wave_nudges`, `profile_visits`, `likes`, `referrals` and `relationships`. The reviewed registry now covers 72 of 97 root models; 25 remain.
- Preserved draft-DDL enum allowlists and defaults: lowercase countdown types (`event`/`festival`/`special`), event types/statuses/festivals, `XP_GRANT_STATUSES`, wave/nudge/vibe-ping, like types and referral statuses. Invalid critical enums are quarantined with a reason; optional child failures soft-quarantine without rejecting the parent.
- Preserved authoritative engagement state: canonical user/room/admin references, UTC dates (including the `lastVisitedAt`/`createdAt` fallback), bounded integers for XP/caps/streaks/rewards, 0/1 flags and optional provider receipt JSON.
- Kept Mixed/array fields explicit for the draft: `app_config.value` becomes canonical JSON TEXT, `xp_grants.receipt` becomes nullable JSON TEXT, and `events.tags` stays canonical JSON TEXT. `AppConfig.value` is required in the source model, so a missing or explicit null value rejects the row instead of silently becoming an empty object.
- Emitted deterministic `event_participants` and `relationship_users` child rows from the source reference arrays, using stable synthetic keys, positions and the parent `events_id`/`relationships_id` columns.
- Added `backend-server/apps/api/src/migration/mappings-events.test.ts` (12 tests) and expanded the registry assertion in `mappings.test.ts` to all 72 reviewed collections. The former unmapped `events` negative assertion now uses `gifts`.

## Verification performed

- `npm.cmd exec -- tsx --test src/migration/mappings-events.test.ts src/migration/mappings.test.ts src/migration/mappings-moderation.test.ts` — 34/34 focused tests passed.
- `npm.cmd exec -- tsx --test src/migration/*.test.ts` — 100/100 migration tests passed across 12 files.
- `npm.cmd test --workspace apps/api` — 321/321 passed.
- `npm.cmd run typecheck --workspace apps/api` — passed.
- Static DDL cross-check — all 11 new root mapping column sets and both new child tables (`event_participants`, `relationship_users`) match `migrations/d1/0001_initial.sql`. This extends the earlier cross-check covering the previous 61 mappings, including `support_ticket_messages`.
- Static SQL structure check — 131 unique tables, 0 dotted columns, 0 duplicate columns, 222 `REFERENCES`, 46 warning entries; unchanged by this batch.
- `npm.cmd run migrate:rehearse -- --snapshot <generated fixture> --out <temp dir>` — validation PASS, exit 0 with generated records for all 11 new collections (11 transformed root rows). Only generated fixture data was used; no real snapshot was read.
- `git diff --check` — clean.

No live SQLite parse (`sqlite3` unavailable), real export, production-data transform, D1 import, restore rehearsal, provision or deploy was run. A passing dry run is not proof that a production import would succeed.

## Gates and assumptions to resolve

- Owner decisions on all 46 manifest warnings and approval/refinement of `0001_initial.sql`. The global Mongoose `Number` → draft `INTEGER` limitation and the separately approved R2 operation for inline `Achievement.imageData` remain open; neither was changed by this batch.
- Event media URLs and verification references are provenance only. R2 key semantics and private-media authorization remain part of DCR-4.
- DCR-1 (tracked credentials), DCR-3 (realtime protocol), DCR-4 (R2 media environment/scope), DCR-5 (plan acceptance), D1 capacity/recovery gates and backup/restore rehearsal remain open.
- 25 models still need reviewed mappings: bonds (`Bond`, `BondPoint`, `BondRankingSnapshot`, `BondRequest`, `BondReward`), clan invites/messages, creator payout KYC, friend match requests, gifts, group chat/messages, matches, notifications/campaigns, payout reviews, PK battle/event/invite/leaderboard/participant/vote, story comments, vibe graphs and watch parties. No runtime persistence switch, MongoDB removal or cutover is authorized.

## Next agent actions

1. Keep all work local and non-destructive; preserve unrelated uncommitted changes, including `yugm-cleanup/`.
2. Continue reviewed mappings for the remaining 25 models against the current draft DDL, with focused tests, then rerun the focused migration tests, full API suite, typecheck, DDL cross-checks and a generated-fixture rehearsal.
3. Await owner decisions on schema warnings, capacity/recovery and all DCR gates; do not commit unless newly authorized, and do not provision, deploy, migrate, rotate credentials, change DNS, cut over or release without explicit approval.
