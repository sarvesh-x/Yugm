# Data migration tooling requirements

**Date:** 2026-11-22  
**Status:** Phase 0 design requirements. No export, import, migration or rollback was run. As of 2026-11-23 D1 production use is parked and not approved ([ADR-0007](../decisions/0007-dcr2-capacity-gate-not-approved.md)); all tooling here remains unapproved design/preparation, and MongoDB remains authoritative.

## Principles

- A migration is a repeatable data pipeline, not a one-off script.
- Source data is read-only during export snapshots; the authoritative source remains MongoDB until cutover is validated.
- Every record is accounted for: migrated, transformed, quarantined or explicitly rejected with a reason. No silent discards.
- Sensitive reports contain aggregates only; no personal content, tokens, credentials or signed URLs.
- Destructive production steps require explicit approval, a verified backup and a rehearsed rollback.

## Required stages

### 1. Preflight and full backup

- Record source cluster, database name, collection counts, sizes, index definitions, transactions and current application version.
- Take a point-in-time backup/snapshot of the entire MongoDB database using an approved provider mechanism.
- Verify the backup can be restored into an isolated environment before any cutover work.
- Freeze schema-changing application deployments during the final sync window.

### 2. Export

- Export all collections, including embedded arrays, GridFS metadata and the uncommitted `MediaObject`, `MediaUploadSession` and `MediaQuotaReservation` records if that slice is carried forward.
- Write immutable snapshot files with checksums, source watermark timestamps, export version and tool version.
- Stream large collections; do not assume a single dump fits in D1's 5 GB import limit.
- Capture ObjectIds as canonical strings before transformation.

### 3. Transform and normalize

- Use a versioned mapping specification; every transformation is deterministic and testable.
- Preserve existing user-visible IDs, Firebase identifiers, ObjectId strings and UTC timestamps.
- Convert money to integer units; reject non-integer, negative where disallowed, or currency-mismatched values into a quarantine report.
- Split embedded documents into normalized tables only when referential and transaction behavior is preserved.
- Map large binaries and media references to R2 keys; never embed binaries in database rows.
- Produce source-to-target ID maps and relationship maps as durable migration artifacts.

### 4. Validate transformed data

- Source/target document counts by collection and by status.
- Required field presence, type, range and uniqueness checks.
- Referential integrity and orphan checks.
- Financial reconciliation: wallet balances equal sum of ledger entries; purchases, gifts, refunds and payouts reconcile.
- Ownership, badges, achievements, memberships and gift history preservation checks.
- Media reference validation: every registry key exists in R2; every R2 object expected by the registry is present.
- Checksum and UTC timestamp comparisons.
- Explicit quarantine/rejection report with reasons and counts; nothing is silently dropped.

### 5. Dry-run import

- Import into an isolated database with production-like constraints.
- Run API contract, business-rule and realtime smoke suites against the imported data.
- Record D1 `meta.rows_read/rows_written` or PostgreSQL operation counts and compare with capacity estimates.
- Exercise rollback from snapshot before proceeding.

### 6. Batch import with checkpoint/resume

- Import in deterministic, bounded batches.
- Persist checkpoint state: snapshot ID, collection/table, last primary key, counts, checksums and phase status.
- Resume from the last successful checkpoint; never reapply a batch without idempotency protection.
- Disable or defer foreign key checks only within a reviewed migration transaction, then validate before enabling.
- Use prepared statements and parameterized batches.

### 7. Final sync and cutover

- Capture a final delta from MongoDB after writes are frozen or through a change-data mechanism.
- Apply deltas in dependency order: identities, auth, catalog/asset metadata, social graph, financial ledger, media registry, then derived/cache data.
- Re-run full validation and financial reconciliation.
- Switch one domain at a time behind feature flags/adapters; keep the old repository available for rollback during the validation window.
- Do not delete or overwrite source data until the acceptance period ends.

### 8. Rollback assistance

- Preserve source snapshots, ID maps, migration logs and checksums.
- Rollback Worker code version separately from data; Worker rollback does not roll back connected resources.
- For data rollback, restore the snapshot into an isolated database first, validate, then follow an approved production restore/cutback procedure.
- Maintain a runbook with decision points, owners, commands, expected outputs and abort criteria.

## Required tooling artifacts

| Artifact | Purpose |
|---|---|
| `snapshot-manifest.json` | Source identity, watermark, counts, checksums, tool versions |
| `id-map/*.jsonl` | Stable source-to-target ID mappings |
| `transform-report.json` | Row counts, transforms, quarantines, rejects and reasons |
| `checkpoint.json` | Restartable import progress |
| `validation-report.json` | Structural, referential, financial and media validation results |
| `rollback-runbook.md` | Approved rollback steps and abort criteria |
| `migration-decision.md` | D1 vs Hyperdrive decision and evidence |

Artifacts must be stored in an access-controlled location. Do not commit production exports or sensitive reports.

## Test requirements

- Unit tests for each transform rule, including malformed and edge-case records.
- Golden-file tests for representative records with ObjectIds, UTC timestamps, integer money, embedded arrays and media references.
- Idempotency tests: re-running a batch produces no duplicate rows or ledger entries.
- Checkpoint tests: interrupt and resume at every batch boundary.
- Validation tests that deliberately inject count mismatches, orphan references, negative balances and missing R2 keys.
- Restore rehearsal on isolated staging with production-shaped data volume.
- Final acceptance suite covering accounts, balances, purchases, history, ownership, badges, gifts, media, permissions, memberships and admin-managed content.

## Current status (2026-11-22)

**Implemented locally (non-destructive foundation only):**

- `backend-server/apps/api/src/scripts/generate-d1-schema.ts` with `npm run schema:d1 --workspace apps/api`. It introspects local Mongoose models and generates `backend-server/apps/api/migrations/d1/0001_initial.sql` plus a manifest. The current draft has 97 root tables, 49 normalized child tables, 246 foreign-key references, 204 `CHECK` constraints (46 numeric-range, 26 `>= 0`) and 0 review warnings after applying the approved triage dispositions locally. It never connects to a database or reads credentials.
- `backend-server/apps/api/src/migration/{types,transform,checkpoint,validate}.ts`: deterministic transform primitives (canonical IDs, UTC timestamps, integer money, preserved enums), explicit quarantine with reasons, source-row accountancy checks, restartable checkpoint/idempotency helpers and a validation report builder. Eight unit tests in `transform.test.ts` cover malformed values, replay prevention and injected count/orphan/balance failures.
- Phase 2 pipeline: `snapshot.ts` (deterministic checksums and filesystem snapshot store), `export.ts` (bounded read-only collection export with counts/checksum verification), `import.ts` (checkpoint-backed, idempotent, dry-run-capable batch importer with manifest checksum verification), `mongoSource.ts` (read-only keyset-paginated Mongoose model adapter) and `d1Target.ts` (D1-compatible batch writer respecting the 100-bound-parameter limit, with identifier validation). All IO is injected; none of this code opens a MongoDB connection or Cloudflare binding on its own.
- `mappings.ts`: reviewed per-collection transforms for all 97 root collections — identity/auth (`users`, `auth_sessions`, `admin_sessions`, `device_tokens`, `admin_users`), finance/entitlements (`wallet_transactions`, `diamond_transactions`, `purchases`, `gift_transactions`, `withdrawal_requests`, `subscriptions`), assets/media (`assets`, `media_objects`, `media_upload_sessions`, `media_quota_reservations`) social/messaging (`friendships`, `blocks`, `follows`, `clans`, `direct_messages`, `chat_messages`, `conversation_mutes`, `stories`, `story_highlights`) rooms/live state (`rooms`, `room_participants`, `room_invites`, `room_follows`, `room_mode_states`, `room_reactions`, `room_activities`, `room_recordings`, `speaker_requests`, `polls`, `voice_polls`) and progression/rewards (`achievements`, `battle_passes`, `battle_pass_xp_grants`, `seasons`, `missions`, `user_missions`, `daily_questions`, `user_daily_answers`, `mini_game_challenges`, `mini_game_scores`, `cosmetics`, `immersive_themes`, `gift_collections`, `gift_inventories`, `wishlist_items`) and moderation/safety (`reports`, `moderation_queues`, `moderation_actions`, `admin_audit_logs`, `admin_moderation_actions`, `support_tickets`, `support_messages`, `trust_verifications`, `face_verification_submissions`, `voice_verification_submissions`, `user_safety_statuses`) and events/XP/engagement (`app_config`, `countdown_events`, `events`, `xp_daily_caps`, `xp_grants`, `user_moods`, `wave_nudges`, `profile_visits`, `likes`, `referrals`, `relationships`) and bonds/vibe graphs (`bonds`, `bond_points`, `bond_ranking_snapshots`, `bond_requests`, `bond_rewards`, `vibe_graphs`) and clan/group messaging/comments (`clan_invites`, `clan_messages`, `group_chats`, `group_messages`, `story_comments`, `watch_parties`) and final KYC/matching/gifting/notification/payout/PK models (`creator_payout_kycs`, `friend_match_requests`, `gifts`, `matches`, `notifications`, `notification_campaigns`, `payout_reviews`, `pk_battles`, `pk_events`, `pk_invites`, `pk_leaderboard_entries`, `pk_participants`, `pk_votes`). Each writes a root row plus normalized child rows where needed (interests, badge grants, claimed tiers, profile media, admin permissions, media variants, asset variants, message reactions, hidden-for, story views, poll/voice-poll voters, ballots, room-mode participants, achievement tiers, battle-pass rewards, season rewards, gift-collection items, support-ticket messages, event participants, relationship users, bond users/slots, vibe-graph interests/languages, clan message reactions, group-chat participants and match users), preserves canonical IDs/UTC timestamps/integer money/enums, and quarantines bad values. `story_comments.parent_id` stays null for root comments; the draft DDL's `NOT NULL` is a flagged schema issue. `gifts.expires_at` and `gifts.collection_id` likewise preserve source nulls because the source defaults are null while the draft DDL declares them `NOT NULL`. Finance mappings preserve replay/idempotency keys and provider references; asset mappings preserve checksums and published-key provenance. Draft-DDL JSON TEXT columns (`clans.member_ids`, `clans.member_roles`, `direct_messages.reply_to`, `story_highlights.story_ids`, `rooms.tags`, `rooms.speaker_ids`, `rooms.moderator_ids`, `rooms.room_admin_ids`, `rooms.co_host_ids`, `rooms.locked_seat_indices`, `room_mode_states.scores`, `room_mode_states.current_options`, `polls.options`, `voice_polls.options`, `immersive_themes.colors`, `immersive_themes.animation`, `mini_game_scores.metadata`, `season_rewards.free_reward`, `season_rewards.premium_reward`, `app_config.value`, `xp_grants.receipt`, `events.tags`, `bonds.preferences`, `bond_ranking_snapshots.entries`, `gifts.upgrade_path`, `notifications.data`, `notification_campaigns.filters`, `payout_reviews.risk_flags`, `payout_reviews.payout`, `pk_events.metadata`) carry deterministic, canonicalized JSON and would need remapping if the owner approves the [warning triage](../database/d1-schema-warning-triage.md). Progression mappings also soft-quarantine any legacy inline `Achievement.imageData` while preserving `imageUrl`/`assetRef` provenance; legacy badge endpoints and multipart upload are untouched. Draft-DDL `INTEGER` columns for Mongoose `Number` paths mean fractional values (for example `GiftCollection.bonus.xpMultiplier`/`coinMultiplier`) are quarantined pending an owner type decision. `import.ts` adds `importMappedCollection`, which groups child writes by table and reuses the same checksum/checkpoint/dry-run guarantees.
- `nativeCollectionReader.ts` plus `export-snapshot.ts` (`npm run snapshot:export -- --out <dir> --confirm-isolated-export <label> (--collections <c1,c2,...> | --all-reviewed) [--batch-size <n>] [--snapshot-id <id>] [--source-label <label>] [--string-id <collection> ...]`): a read-only export CLI that connects through `connectDatabase()` (env-provided URI, never printed), reads keyset batches from reviewed `MAPPINGS` collections, and writes a manifest + JSONL snapshot via `FileSystemSnapshotStore`. It requires an explicit confirmation label, refuses unreviewed collections and an existing manifest, handles string `_id` collections (`assets`, `media_objects`, `media_upload_sessions`, `media_quota_reservations` by default), and prints only aggregate counts/bytes. Running it against production requires separate explicit approval; use isolated staging or a restored backup. An opt-in `npm run test:export --workspace @yugm/api` (`test/export.mjs`) verifies the whole path against a disposable loopback MongoDB (including string `_id` records) and is not part of the default unit suite.

- `backupRehearsal.ts` plus `npm run backup:rehearse -- --snapshot <dir> --out-dir <dir> [--expect-digest <sha256>]`: chains snapshot-copy verification with the existing `rehearseSnapshot()` dry run and writes transform/validation/id-map artifacts into one output directory. It skips rehearsal when integrity fails and exits non-zero on either hard failure. PASS does not mean a production restore was tested.
- `deltaRateAudit.ts` plus `npm run delta:rates -- --before <dir> --after <dir>`: uses manifest watermarks and the snapshot diff to report average added/removed/changed records per hour, with review items for peak load and window decisions. It does not observe peak load or choose a window; see [final delta sync design](final-delta-sync-design.md#open-decisions).
- `childTableAudit.ts` plus `npm run delta:child-tables`: read-only impact report listing root collections with normalized child tables, using the shared `childTables.ts` declaration and generated manifest. It supplies sizing for the replacement-scope decision; it does not change DDL or delete rows. See [final delta sync design](final-delta-sync-design.md#open-decisions).
- `financialDeltaAudit.ts` plus `npm run delta:finance -- --before <dir> --after <dir>`: filters the snapshot diff to the six authoritative money collections and reports sizing plus open review items for reconciliation, maintenance-window and idempotent replay. It does not reconcile balances or decide the window; see [final delta sync design](final-delta-sync-design.md#open-decisions).
- `deletionAudit.ts` plus `npm run delta:deletions -- --before <dir> --after <dir> [--soft-field deletedAt]`: read-only inventory of hard-removed source IDs and soft-delete markers between two copied snapshots. It supplies sizing evidence for the hard-delete representation decision; it does not implement tombstones or D1 deletes. See [final delta sync design](final-delta-sync-design.md#deletion-handling).
- `watermarkAudit.ts` plus `npm run delta:watermark -- --snapshot <dir> --field <name>`: read-only audit of a proposed watermark field over exported records. Reports coverage, parseability, unique composite `(value, _id)` keys, sample gaps and input ordering. It does not choose the watermark or read MongoDB; see [final delta sync design](final-delta-sync-design.md#watermark-strategy).
- `snapshotDiff.ts` plus `npm run snapshot:diff -- --before <dir> --after <dir>`: a read-only comparison of two copied, manifest-declared snapshots. Reports added/removed/changed records, changed top-level field names, duplicate/invalid IDs and watermark ordering using source IDs and content digests only. It is a delta-planning aid, not final delta sync: no watermark export, tombstone/deletion handling, upsert or child-row replacement is implemented. See [final delta sync design](final-delta-sync-design.md#local-verification-aid-added-2026-11-23).
- `idMap.ts`: deterministic, checksummed source-to-target ID map entries with a registry that rejects conflicting duplicates and emits stable `id-map.jsonl` artifacts. Current mappings preserve `source_id`, and `MAPPING_VERSION`/`ROOT_TABLES` are recorded per entry so a future renumbering cannot be ambiguous.
- `rehearsal.ts` plus `npm run migrate:rehearse -- --snapshot <dir> [--out <dir>]`: a local-only CLI/harness that reads an exported snapshot directory, runs the reviewed mappings through the real importer in dry-run mode (no writes to MongoDB, D1 or R2), and emits `transform-report.json`, `validation-report.json` and `id-map.jsonl`. It checks source counts, root-ID uniqueness, child-parent referential integrity, row accountancy and id_map coverage, and exits non-zero on validation failure. A partial snapshot rehearses only the reviewed collections it contains.
- Unit tests: `transform.test.ts` (8), `pipeline.test.ts` (7), `adapters.test.ts` (5), `golden.test.ts` (1 with three fixture cases), `mappings.test.ts` (10, including a replay-safe multi-table import), `rehearsal.test.ts` (6, including id_map determinism, default collection selection and mismatch reporting), `mappings-domains.test.ts` (9, auth/finance/asset), `mappings-social.test.ts` (9, social/messaging) and `mappings-rooms.test.ts` (9, rooms/polls/live state) and `mappings-progression.test.ts` (12, progression/rewards) and `mappings-moderation.test.ts` (12, moderation/safety), `mappings-events.test.ts` (12, events/XP/engagement), `mappings-bonds.test.ts` (12, bonds/vibe graphs), `mappings-messaging.test.ts` (12, clan/group messaging/comments), `mappings-final.test.ts` (14, KYC/matches/gifts/notifications/campaigns/payout reviews/PK) — 138 migration tests total across 15 files. Child-table failures are reported as soft quarantines so they cannot falsely reject a valid parent row.
- The D1 target is recorded in [ADR-0001](../decisions/0001-d1-and-r2-target.md); the generated schema is a **review draft**, not an approved schema.

**Not implemented / not run:** final delta sync implementation, R2 binary migration, production-shaped volume checks, and execution of the runbook. Design notes now exist at `docs/migration/final-delta-sync-design.md` and `docs/migration/rollback-runbook.md`; all 97 reviewed root-model mappings are written, and the local DDL triage has been applied. Schema DDL approval and the remaining gates are still outstanding. No production snapshot, export, transform, import, validation, restore or destructive step has been performed. Phase 2 remains gated by DCR-1/DCR-5, capacity metrics, Workers Paid, backup/restore and schema approval.

**Verification performed:** `npm.cmd run schema:d1 --workspace apps/api` (0 import failures), the fifteen migration test files (138/138, run together via `tsx --test src/migration/*.test.ts`), `npm.cmd test --workspace apps/api` (359/359), `npm.cmd run typecheck --workspace apps/api` (pass), static SQL structure checks (146 unique tables, 0 dotted/duplicate columns, 246 `REFERENCES`, 204 `CHECK` constraints (46 numeric-range, 26 `>= 0`) and 0 warnings), a static cross-check that every column emitted by the 97 mappings exists in the generated DDL (including `support_ticket_messages`, `event_participants`, `relationship_users`, `bond_users`, `bond_slots`, `vibe_graph_interests`, `vibe_graph_languages`, `clan_message_reactions`, `conversation_participants` and `match_users`), and CLI happy-path smokes against generated fixture snapshots with `users`, `achievements`, `reports`, all 11 events/XP/engagement collections, all six bonds/vibe collections, all six clan/group messaging/comment collections and all 13 final-batch collections (validation PASS, exit 0). No live SQLite parse (`sqlite3` unavailable).
