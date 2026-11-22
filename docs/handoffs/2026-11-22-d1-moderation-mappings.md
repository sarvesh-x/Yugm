# Handoff: D1 moderation/safety mappings

**Date:** 2026-11-22
**Status:** Unfinished local design work. No database/account connection, export from a real source, import into D1, R2 operation, provision, deploy or production data change. The generated D1 schema remains a review draft. These changes are uncommitted.

## What was done

- Extended `backend-server/apps/api/src/migration/mappings.ts` with reviewed transforms and registry entries (`ROOT_TABLES` and `MAPPINGS`) for 11 more collections: `reports`, `moderation_queues`, `moderation_actions`, `admin_audit_logs`, `admin_moderation_actions`, `support_tickets`, `support_messages`, `trust_verifications`, `face_verification_submissions`, `voice_verification_submissions` and `user_safety_statuses`. The reviewed registry now covers 61 of 97 root models; 36 remain.
- Mapped both moderation systems separately as the source schemas do: actor-scoped `moderation_actions` (`WARN`/`MUTE`/`SUSPEND`/`BAN`/`UNBAN`) and admin `admin_moderation_actions` (the draft DDL's 17-value `action_type` allowlist). Queue target types/priorities/statuses, report statuses, support categories/statuses/priorities, trust verification status families and submission statuses use the draft DDL's CHECK values.
- Preserved authoritative moderation state: reporter/target/room and reviewer references, evidence and metadata as canonical JSON, integer risk/score/count fields with bounds where the draft DDL requires them, UTC timestamps and 0/1 flags for booleans. Invalid critical values are quarantined with a reason instead of being silently dropped.
- Emitted deterministic `support_ticket_messages` child rows from the `SupportTicket.messages` array, using stable synthetic keys, positions and the parent `support_tickets_id`; invalid embedded messages are soft-quarantined and do not reject the parent ticket. Legacy `SupportMessage` documents map to their own root table.
- Kept media provenance only: face/voice verification URLs and provider response JSON are preserved as fields; no private media object is fetched, signed, copied or moved to R2.
- Added `backend-server/apps/api/src/migration/mappings-moderation.test.ts` (12 tests) and expanded the registry assertion in `mappings.test.ts` to all 61 reviewed collections.

## Verification performed

- `npm.cmd exec -- tsx --test src/migration/mappings-moderation.test.ts src/migration/mappings.test.ts` — all focused moderation and registry tests passed.
- `npm.cmd exec -- tsx --test src/migration/*.test.ts` — 88/88 migration tests passed across 11 files.
- `npm.cmd test --workspace apps/api` — 309/309 passed.
- `npm.cmd run typecheck --workspace apps/api` — passed.
- Static cross-check — all 61 root mapping column sets match `migrations/d1/0001_initial.sql`; the `support_ticket_messages` child table matches its DDL column set exactly.
- `npm.cmd run migrate:rehearse --workspace apps/api -- --snapshot <generated fixture> --out <temp dir>` — validation PASS, exit 0 with generated `users`, `achievements` and `reports` records (three transformed root rows). Only generated fixture data was used.

No live SQLite parse (`sqlite3` unavailable), real snapshot export, transform on production data, D1 import, restore rehearsal, provision or deploy was run. A passing dry run is not proof that a production import would succeed.

## Gates and assumptions to resolve

- Owner decisions on all 46 manifest warnings and approval/refinement of `0001_initial.sql`. The global Mongoose `Number` → draft `INTEGER` limitation and the separately approved R2 operation for inline `Achievement.imageData` remain open; neither was changed by this batch.
- Trust-verification media URLs are preserved as provenance only. Private-media authorization and R2 key semantics remain part of DCR-4.
- DCR-1 (tracked credentials), DCR-3 (realtime protocol), DCR-4 (R2 media environment/scope), DCR-5 (plan acceptance), D1 capacity/recovery gates and backup/restore rehearsal remain open.
- 36 Mongoose models still need reviewed mappings: `AppConfig`, bonds (five models), clan invites/messages, countdown/event data, creator payout KYC, friend match requests, gifts, group chat/messages, likes, matches, notifications/campaigns, payout reviews, PK battle/event/invite/leaderboard/participant/vote, profile visits, referrals, relationships, story comments, user moods, vibe graphs, watch parties, wave nudges and XP daily caps/grants. No runtime persistence switch, MongoDB removal or cutover is authorized.

## Next agent actions

1. Keep all work local and non-destructive; preserve unrelated uncommitted changes, including `yugm-cleanup/`.
2. Continue reviewed mappings for the remaining 36 models against the current draft DDL, with focused tests, then rerun the focused migration tests, full API suite, typecheck and DDL cross-checks.
3. Await owner decisions on schema warnings, capacity/recovery and all DCR gates; do not commit unless newly authorized, and do not provision, deploy, migrate, rotate credentials, change DNS, cut over or release without explicit approval.
