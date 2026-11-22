# D1 schema approval package (local draft)

**Date:** 2026-11-22
**Status:** Approved by the owner on 2026-11-22 as the D1 review baseline. This is DDL approval for continued local work only; it is not approval to provision, migrate, cut over, deploy or touch production data.  
**Approval recorded:** 2026-11-22 by owner. Approved items: regenerated DDL baseline, promoted-column shapes, removal of legacy inline badge bytes, validated-JSON disposition, and resolution direction for null/default and fractional-number conflicts.

## Scope

This package summarizes the locally generated and triage-adjusted D1 draft:

- Generator: `backend-server/apps/api/src/scripts/generate-d1-schema.ts`
- DDL: `backend-server/apps/api/migrations/d1/0001_initial.sql`
- Manifest: `backend-server/apps/api/migrations/d1/0001_initial.manifest.json`
- Mapping spec: `docs/database/mongo-to-relational-mapping.md`
- Triage: `docs/database/d1-schema-warning-triage.md` (owner-approved as a disposition package)

## Current draft metrics

- Root tables: 97
- Normalized child tables: 49
- Total tables: 146
- Foreign keys: 246
- `CHECK` constraints: 204 (46 numeric-range, 26 `>= 0`)
- Review warnings: 0
- Import failures: 0
- Mapped collections: 97
- Unmapped models: 0

## Major structural changes from the triage application

- Added child tables for approved array/Map fields:
  - `bond_milestones`, `bond_preferences`, `bond_ranking_entries`
  - `clan_members`, `clan_member_roles`
  - `gift_upgrade_paths`
  - `poll_options`, `voice_poll_options`
  - `room_speakers`, `room_moderators`, `room_admins`, `room_cohosts`, `room_locked_seats`
  - `room_mode_scores`
  - `story_highlight_stories`
- Promoted embedded documents to columns:
  - `DirectMessage.replyTo` -> `reply_to_message_id`, `reply_to_author`, `reply_to_author_id`, `reply_to_text`, `reply_to_media_url`
  - `PayoutReview.payout` -> `provider_payout_id`, `provider_status`, `processed_at`, `failure_reason`
- Removed legacy inline `Achievement.imageData` bytes from D1; legacy `imageUrl` and `assetRef` remain as provenance.
- Validated-JSON fields remain JSON TEXT with deterministic serialization.

## Open schema conflicts requiring explicit decisions

1. `story_comments.parent_id`
   - Mongoose source allows `null` for root comments.
   - Draft DDL declares `NOT NULL REFERENCES story_comments`.
   - Transform preserves `null` rather than inventing a self-reference.

2. `gifts.expires_at`
   - Mongoose default is `null`.
   - Draft DDL declares `NOT NULL`.
   - Transform preserves source nulls.

3. `gifts.collection_id`
   - Mongoose default is `null`.
   - Draft DDL declares `NOT NULL REFERENCES gift_collections`.
   - Transform preserves source nulls.

4. Fractional Mongoose `Number` fields
   - The generator maps every `Number` to `INTEGER`.
   - Fields such as `GiftCollection.bonus.xpMultiplier` and `coinMultiplier` need an owner type decision before schema approval.

5. `Achievement.imageData`
   - Legacy inline bytes are not stored in D1.
   - Actual R2 blob migration requires a separately approved R2 operation and bucket/key/checksum shape.

## Verification performed

- `npm.cmd run typecheck --workspace apps/api` — passed.
- `npm.cmd exec -- tsx --test src/migration/*.test.ts` — 138/138 passed across 15 files.
- `npm.cmd test --workspace apps/api` — 359/359 passed.
- `npm.cmd run schema:d1 --workspace apps/api` — 146 tables, 0 import failures, 0 warnings.
- Migration stats — 97 mapped collections, 0 unmapped, 146 unique DDL tables, 246 `REFERENCES`, 0 dotted/duplicate columns, 0 warnings.
- `git diff --check` — clean aside from existing LF/CRLF line-ending warnings.
- Relative Markdown links — 0 broken for checked docs.

No live SQLite parse (`sqlite3` unavailable), real export, D1 import, restore rehearsal, provision or deploy was run.

## Approval requested

Approve or reject:

1. The regenerated DDL as the next review baseline.
2. The promoted-column shapes for `DirectMessage.replyTo` and `PayoutReview.payout`.
3. The removal of `Achievement.imageData` from D1 in favor of R2/provenance.
4. The validated-JSON disposition for the 28 approved JSON TEXT fields.
5. Resolution of the three null/default conflicts and fractional `Number` handling.
6. Whether to regenerate and re-run checks after any requested DDL edit.

This document does not approve production migration, cutover, credential changes, DNS changes, provisioning, deployment or release.
