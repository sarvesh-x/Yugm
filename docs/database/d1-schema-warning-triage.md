# D1 schema warning triage ( proposal — owner decision required )

**Date:** 2026-11-22  
**Status:** Owner-approved triage package for the 46 warnings in `backend-server/apps/api/migrations/d1/0001_initial.manifest.json`. This records disposition decisions only; it is not approval of the generated DDL and changes no schema policy or DDL.
**Approval recorded:** 2026-11-22 by owner selection. Dispositions in this document are approved for later implementation; DDL regeneration still requires a separate explicit step. It applies the rules in [the mapping specification](mongo-to-relational-mapping.md) and source checks under `backend-server/apps/api/src/`. The generated SQL remains a review draft.

**Generator defect found and fixed (2026-11-22):** Mongoose Map fields expose both `field` and `field.$*` paths, and both sanitized to the same SQL column, producing invalid duplicate columns `bonds.preferences` and `room_mode_states.scores`. `generate-d1-schema.ts` now suppresses the duplicate wildcard column and records a note in the generated SQL. This purely mechanical fix removed one now-obsolete warning (`Bond.preferences.$*`) from the manifest; no field was dropped and no schema policy changed. This document was updated from 47 to 46 warnings to match.

## Disposition vocabulary

| Disposition | Meaning |
|---|---|
| `CHILD_TABLE` | Normalize into a child table with a stable `source_id` and a FK to the parent. Required when the field is queried, populated, `$pull`/`$addToSet`-updated, or holds cross-references that must resolve. |
| `PROMOTED_COLUMN(S)` | The embedded object is 1:1 with its parent; lift its fields onto the parent (and keep an indexed provider key where one exists). |
| `VALIDATED_JSON` | Keep as JSON TEXT, but require deterministic serialization and a validation rule on read/import. Acceptable for opaque audit/provider payloads and small immutable value objects that are never joined. |
| `R2_REFERENCE` | Replace bytes with bucket/key/checksum/reference columns. No binary may remain in D1. |

## Source checks that informed the proposal

- `Clan.memberIds` is used in `findOne({ memberIds: ... })`, `$or` filters, `populate`, `$pull`, `$lookup` and has an indexed companion `memberRoles.userId` (`routes/clans.ts`, `routes/bonds.ts`, `routes/games.ts`, `services/jobs.ts`, `models/Clan.ts`). Both arrays need child tables.
- `Room.speakerIds`, `moderatorIds`, `roomAdminIds`, `coHostIds`, `lockedSeatIndices` are queried via `$or`, mutated with `$addToSet`/`$pull`, and some are populated (`routes/rooms.ts`, `services/jobs.ts`). All need child tables.
- `Bond.milestoneDays` is read with `.includes()` and written with `$addToSet` (`services/bondProgress.ts`). A unique `(bond, day)` child row preserves the same rule.
- `StoryHighlight.storyIds` is populated and mutated with `$push`/`$pull` (`routes/highlights.ts`). It needs a child table.
- `PayoutReview.payout` has an indexed `payout.providerPayoutId` (`models/PayoutReview.ts`); that key must remain directly queryable, so promote the object rather than bury it in JSON.
- `RoomModeState.scores` is a `Map<string, number>` keyed by user ID and mutated/read as a unit (`routes/roomModes.ts`). A child table with a unique `(state, user)` key preserves integer scoring and referential checks.
- `Room.tags` is read in memory with `.includes()` (`routes/discover.ts`); no query-by-tag was found. `Event.tags`, `PayoutReview.riskFlags` and `SupportMessage.attachments` are likewise not filtered in the reviewed source. They can remain validated JSON unless a new query pattern is required.
- `Achievement.imageData` is a `Buffer` with `select: false` (`models/Achievement.ts`); the model already carries a published `AssetObject` ID. Legacy bytes move to R2/provenance, not to a D1 column.

## Per-warning proposal

### Must change from the generated draft

| Warning | Proposal | Reason |
|---|---|---|
| `Achievement.imageData` | `R2_REFERENCE` + `legacy_media_references` provenance | Binary field; mapping spec forbids bytes in D1. Keep legacy `imageUrl`/asset ID untouched. |
| `Bond.milestoneDays` | `CHILD_TABLE` `bond_milestones(day, source_id)` | `$addToSet`/`includes` semantics; unique `(bond, day)`. |
| `Bond.preferences` | `CHILD_TABLE` `bond_preferences(key, value_json)` | Map of validated keys; the generator's duplicate `preferences.$*` column was suppressed mechanically. |
| `BondRankingSnapshot.entries` | `CHILD_TABLE` `bond_ranking_entries(bond_id, score, rank)` | Snapshot rows are individually addressable and ordered. |
| `Clan.memberIds` | `CHILD_TABLE` `clan_members(user_id)` | Queried, populated and `$pull`-updated; see source checks. |
| `Clan.memberRoles` | `CHILD_TABLE` `clan_member_roles(user_id, role)` | Indexed `memberRoles.userId` must remain joinable. |
| `DirectMessage.replyTo` | `PROMOTED_COLUMN` `reply_to_message_id` | 1:1 message reference; needs an FK, not an opaque blob. |
| `Gift.upgradePath` | `CHILD_TABLE` `gift_upgrade_paths(to_gift_id, position)` | ObjectId references must resolve through `id_map`. |
| `PayoutReview.payout` | `PROMOTED_COLUMN(S)` including indexed `provider_payout_id` | Preserve the existing indexed lookup. |
| `Poll.options` | `CHILD_TABLE` `poll_options(text, votes)` | `votes` is authoritative integer state, not a static descriptor. |
| `VoicePoll.options` | `CHILD_TABLE` `voice_poll_options(text, audio_url, votes)` | Same as `Poll.options`; `audio_url` stays a URL/R2 reference. |
| `Room.speakerIds` | `CHILD_TABLE` `room_speakers(user_id)` | Queried and `$addToSet`/`$pull`-updated; see source checks. |
| `Room.moderatorIds` | `CHILD_TABLE` `room_moderators(user_id)` | Same; participates in room role resolution. |
| `Room.roomAdminIds` | `CHILD_TABLE` `room_admins(user_id)` | Same; admin-only action authorization depends on it. |
| `Room.coHostIds` | `CHILD_TABLE` `room_cohosts(user_id)` | Populated and mutated; part of duet state. |
| `Room.lockedSeatIndices` | `CHILD_TABLE` `room_locked_seats(seat_index)` | `$addToSet`/`$pull` per seat; unique `(room, seat_index)`. |
| `RoomModeState.scores` | `CHILD_TABLE` `room_mode_scores(user_id, score)` | Keyed by user; integer reconciliation and FK checks. |
| `StoryHighlight.storyIds` | `CHILD_TABLE` `story_highlight_stories(story_id, position)` | Populated and `$push`/`$pull`-updated. |

### Keep as validated JSON (confirm with owner before adopting)

| Warning group | Proposal | Reason / caveat |
|---|---|---|
| `AdminAuditLog.metadata`, `AdminModerationAction.metadata`, `RoomActivity.metadata`, `PkEvent.metadata`, `MiniGameScore.metadata` | `VALIDATED_JSON` | Append-only/telemetry payloads; never joined in reviewed source. |
| `AppConfig.value`, `NotificationCampaign.filters`, `Notification.data` | `VALIDATED_JSON` with a per-config/per-campaign schema | Server-authoritative config and eligibility filters; KV caching of non-critical snapshots is allowed by the spec. |
| `CreatorPayoutKyc.metadata`, `FaceVerificationSubmission.providerResponse`, `VoiceVerificationSubmission.providerResponse`, `WithdrawalRequest.metadata`, `Report.evidence`, `SupportMessage.attachments` | `VALIDATED_JSON` containing references only | Sensitive/provider payloads. No plaintext secrets or binary bytes in migration artifacts; private evidence bytes stay in R2. |
| `DiamondTransaction.metadata`, `GiftTransaction.metadata`, `Purchase.metadata`, `WalletTransaction.metadata`, `XpGrant.receipt` | `VALIDATED_JSON` with deterministic key order | Opaque receipt/idempotency metadata; `WalletTransaction.metadata` already follows this in `mappings.ts`. |
| `Event.tags`, `Room.tags`, `ImmersiveTheme.colors`, `ImmersiveTheme.animation`, `Season.rewards.freeReward`, `Season.rewards.premiumReward`, `PayoutReview.riskFlags` | `VALIDATED_JSON` | Display descriptors and small value objects; no query-by-element found. Revisit if a query pattern appears. |
| `RoomModeState.currentOptions`, `RoomModeState.metadata` | `VALIDATED_JSON` | Small in-place-updated state/metadata, not joined. |
| `BondRankingSnapshot.entries` is listed above as a child table; the remaining `Mixed` warnings not otherwise named are covered by the groups above. | | |

## Decisions still required from the owner

1. Approve or reject each disposition above, and decide whether `RoomModeState.scores` and `Poll`/`VoicePoll` options justify child tables given their write frequency.
2. Confirm that audit/provider `Mixed` payloads may remain JSON TEXT with strict import validation rather than being normalized.
3. Confirm the `Achievement.imageData` R2 bucket/key/checksum shape and that legacy bytes are migrated only under a separate approved blob operation.
4. Confirm whether `Room.tags`/`Event.tags` need tag-based queries in the target API; if yes, add child tables.
5. After approval, regenerate `0001_initial.sql` and rerun the schema checks; the current manifest counts (131 tables, 46 warnings) will change.

## Additional schema review notes (not manifest warnings)

- **Mongoose `Number` always generates `INTEGER` (draft refinement applied 2026-11-23).** `generate-d1-schema.ts` now maps the non-monetary `GiftCollection.bonus.xpMultiplier` and `coinMultiplier` paths to `REAL` with a non-negative `CHECK`, and `mappings.ts` uses `toFiniteNumber()` so fractional ratios (for example `1.1`) are preserved instead of quarantined. Money remains `INTEGER` in minor units. This changes no warning count and is not owner approval of the DDL; confirm the multiplier semantics at schema approval. No other numeric path was reclassified, so any other rate/ratio field found later still needs explicit review.
- `Achievement.imageData` is a `Buffer` with `select: false`. The reviewed transform soft-quarantines any legacy inline bytes and preserves `imageUrl`/`assetRef` provenance; actual blob migration requires a separately approved R2 operation.

## Draft refinement applied 2026-11-23

- `generate-d1-schema.ts` treated Mongoose `default: null` as a non-null default and emitted `NOT NULL`. The generator now distinguishes `undefined` from an explicit `null` default. Regenerating `0001_initial.sql` changed exactly the three flagged columns: `story_comments.parent_id`, `gifts.expires_at` and `gifts.collection_id` are now nullable. The existing transforms already treat those source values as optional and soft-quarantine malformed optional references.
- The two gift-collection multiplier columns are now `REAL NOT NULL CHECK (>= 0)` and the transform preserves finite fractions. Both changes are reflected in the regenerated SQL and manifest; no model, runtime API or MongoDB document was changed.
- Verification: full migration test suite 163/163 passed and `npm.cmd run typecheck --workspace @yugm/api` passed after regeneration. Owner approval of the regenerated DDL is still outstanding, as are all capacity, recovery and cutover gates.

## Relation to other gates

This proposal does not resolve DCR-1/DCR-3–DCR-5, capacity metrics, Workers Paid, backup/restore or production cutover. No DDL was edited and no database, bucket or remote service was accessed.
