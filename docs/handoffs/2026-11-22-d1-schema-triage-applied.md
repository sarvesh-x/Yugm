# Handoff: D1 schema warning triage applied to the local draft

**Date:** 2026-11-22
**Status:** Unfinished local design work. The generated DDL remains a review draft and is not approved. No database, bucket, credential, deploy, migration, cutover or production data change occurred. These changes are uncommitted.

## What was done

- Applied the owner-approved triage dispositions to `backend-server/apps/api/src/scripts/generate-d1-schema.ts`:
  - Added child tables for approved array/Map fields: `bond_milestones`, `bond_preferences`, `bond_ranking_entries`, `clan_members`, `clan_member_roles`, `gift_upgrade_paths`, `poll_options`, `voice_poll_options`, `room_speakers`, `room_moderators`, `room_admins`, `room_cohosts`, `room_locked_seats`, `room_mode_scores`, `story_highlight_stories`.
  - Promoted `DirectMessage.replyTo` into `reply_to_message_id`, `reply_to_author`, `reply_to_author_id`, `reply_to_text`, `reply_to_media_url`.
  - Promoted `PayoutReview.payout` into `provider_payout_id`, `provider_status`, `processed_at`, `failure_reason`.
  - Removed legacy `Achievement.imageData` bytes from the DDL; legacy provenance remains `imageUrl`/`assetRef`.
  - Suppressed warnings for the 28 approved validated-JSON TEXT fields.
- Regenerated `backend-server/apps/api/migrations/d1/0001_initial.sql` and `0001_initial.manifest.json`.
- Updated transform mappings and tests for promoted columns and the removed `image_data` column.
- Updated docs counts: 146 total tables (97 roots + 49 child tables), 246 FKs, 204 `CHECK` constraints, 0 warnings.

## Verification performed

- `npm.cmd run typecheck --workspace apps/api` — passed.
- `npm.cmd exec -- tsx --test src/migration/*.test.ts` — 138/138 passed across 15 files.
- `npm.cmd test --workspace apps/api` — 359/359 passed.
- `npm.cmd run schema:d1 --workspace apps/api` — 146 tables, 0 import failures, 0 warnings.
- Migration stats — 97 mapped collections, 0 unmapped, 146 unique DDL tables, 246 `REFERENCES`, 0 dotted/duplicate columns, 0 warnings.
- `git diff --check` — clean.
- Relative Markdown links — 0 broken.

No live SQLite parse (`sqlite3` unavailable), real export, D1 import, restore rehearsal, provision or deploy was run.

## Still required before DDL approval

- Owner approval of the regenerated DDL itself.
- Decisions for `story_comments.parent_id`, `gifts.expires_at`, `gifts.collection_id`, and fractional `Number` fields.
- Capacity/recovery, backup/restore, DCR-1/DCR-3/DCR-4/DCR-5, R2 media and cutover gates.
- Transform/mapping updates for any later schema changes.
