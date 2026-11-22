# MongoDB to authoritative relational mapping

**Date:** 2026-11-22  
**Status:** Phase 0 mapping specification. The target is D1 per [ADR-0001](../decisions/0001-d1-and-r2-target.md), but the [capacity assessment](d1-capacity-assessment.md) gates remain open. A first-cut generated draft exists at `backend-server/apps/api/migrations/d1/0001_initial.sql`; this document remains the authority for reviewing and refining it.

## 1. Purpose

Map current Mongoose persistence to candidate relational table families while preserving identities, balances, history, ownership and references. The mapping is implementation-neutral: the same logical model can be created in D1 or PostgreSQL through Hyperdrive after the decision ADR.

Source of truth for current fields is `backend-server/apps/api/src/models/`. The [generated schema inventory](../production/schema-inventory.csv) is a historical static snapshot and does not include the new R2/media models. A source-checked [triage proposal for the 46 generated warnings](d1-schema-warning-triage.md) is awaiting owner review; it does not approve or change the generated SQL.

## 2. Global conversion rules

| Concern | Rule |
|---|---|
| IDs | Preserve every MongoDB `ObjectId` as a canonical 24-character lowercase string in a `source_id` column. Assign a stable internal primary key only if the target benefits; never renumber user-visible IDs. Firebase `uid` is preserved separately and uniquely. |
| Cross-references | Store source IDs first, then translate through immutable `id_map` rows: `source_collection`, `source_id`, `target_table`, `target_id`, `mapping_version`, `checksum`. Do not guess references by email, username or ordering. |
| Timestamps | Normalize all `Date` values to UTC. Keep `createdAt`/`updatedAt` names and preserve original values; add migration metadata timestamps separately. |
| Money | Store coins/diamonds and all price/fee/share amounts as integer minor units. Reject non-integer, NaN, overflow, negative where disallowed, and currency mismatches into a quarantine report. Never derive balances from a floating point sum. |
| Embedded arrays | Normalize only when transaction and reference behavior is preserved. Keep small immutable value objects (for example variant descriptors) as JSON strings when the target supports it and they never need joins; otherwise create child tables with stable source keys. |
| Large binaries | Move binaries to R2. Rows may hold bucket/key/checksum/metadata only. Reject any row approaching the D1 2 MB limit. |
| Enums | Preserve enum strings exactly. Add CHECK constraints where safe; unknown historical values go to quarantine rather than being silently coerced. |
| Soft deletion | Preserve `deletedAt`, moderation state and supersession links. Do not hard-delete referenced records during migration. |
| Idempotency | Persist migration batch IDs and source watermarks. Re-running a batch must produce no duplicate rows or ledger entries. |
| Validation | Every table family requires source/target counts, checksum comparison, referential integrity and domain reconciliation before cutover. |

## 3. Candidate table families

### Identity, auth and admin

| Source models | Candidate tables | Notes |
|---|---|---|
| `User` | `users`, `user_interests`, `user_roles`/flags as appropriate | Preserve Firebase UID, username uniqueness, profile completion fields, avatar legacy value, managed avatar reference and integer balances. Embedded arrays become child tables or validated JSON. |
| `AuthSession`, `DeviceToken` | `auth_sessions`, `device_tokens` | Preserve session generation, refresh rotation state, revocation, expiry and FCM tokens. These are authoritative; never cache in KV. |
| `AdminUser`, `AdminSession` | `admin_users`, `admin_sessions`, `admin_role_permissions` | Preserve roles, permissions, status, 2FA state, session revocation and last-login data. |
| `AdminAuditLog`, `AdminModerationAction` | `admin_audit_logs`, `admin_moderation_actions` | Append-only. Preserve string/UUID entity IDs as text, metadata JSON, IP/UA and UTC timestamps. |

### Social graph and profile

| Source models | Candidate tables | Notes |
|---|---|---|
| `Friendship`, `FriendMatchRequest`, `Block`, `Follow`, `Like`, `Match`, `Relationship`, `VibeGraph`, `WaveNudge` | `friendships`, `friend_match_requests`, `blocks`, `follows`, `likes`, `matches`, `relationships`, `vibe_graph`, `wave_nudges` | Preserve directionality, state, expiry and block-pair semantics. Unique constraints on actor/target pairs must reflect active-record rules. |
| `Bond` | `bonds` | Preserve bilateral consent, type, capacity history and ended state. Capacity must be server-authoritative after migration. |
| `Clan`, `ClanInvite`, `ClanMessage` | `clans`, `clan_members`, `clan_invites`, `clan_messages` | Split embedded member/role arrays into child rows. Preserve moderation and private-media authorization inputs. |
| `ProfileVisit`, `WishlistItem` | `profile_visits`, `wishlist_items` | Preserve timestamps and actor/target uniqueness where the source enforces it. |

### Messaging, stories and feed

| Source models | Candidate tables | Notes |
|---|---|---|
| `ChatMessage`, `DirectMessage`, `GroupMessage`, `GroupChat`, `ConversationMute` | `conversations`, `conversation_participants`, `messages`, `conversation_mutes` | Normalize conversation identity; keep message IDs stable for DO event IDs and reconnect cursors. Preserve edit/delete/reaction state and media references. |
| `Story`, `StoryComment`, `StoryHighlight` | `stories`, `story_comments`, `story_highlights` | Preserve expiry and visibility; media bytes move to R2. |
| `Notification`, `NotificationCampaign` | `notifications`, `notification_campaigns` | Preserve read state, dedupe keys and eligibility metadata. |

### Rooms, RTC and live features

| Source models | Candidate tables | Notes |
|---|---|---|
| `Room`, `RoomParticipant`, `RoomInvite`, `RoomFollow`, `RoomActivity`, `RoomModeState` | `rooms`, `room_participants`, `room_invites`, `room_follows`, `room_activity`, `room_mode_state` | Preserve roles, mute/lock state, host ownership and closure history. Durable state stays in the authoritative DB; DO state is coordination only. |
| `RoomReaction`, `WatchParty`, `Poll`, `VoicePoll` | `room_reactions`, `watch_parties`, `polls`, `poll_votes`, `voice_polls` | High-frequency ephemeral events need deliberate retention rules; do not migrate transient frames. |
| `RoomRecording` | `room_recordings` plus R2 `MediaObject` registry | Preserve recording ownership, room linkage, duration, visibility and byte checksums. |
| `SpeakerRequest`, `ImmersiveTheme` | `speaker_requests`, `immersive_themes` | Preserve state and server-controlled availability. |

### Finance, commerce and payouts

| Source models | Candidate tables | Notes |
|---|---|---|
| `WalletTransaction`, user balance fields | `wallet_transactions` append-only, `wallet_balances` or authoritative balance columns on `users` | Recompute balances from ledger and assert equality before cutover. Store integer amounts, idempotency keys, request fingerprints, price snapshots and resulting balance. |
| `DiamondTransaction`, `Purchase`, `Subscription` | `diamond_transactions`, `purchases`, `subscriptions` | Preserve provider order IDs, plan/entitlement state, replay markers and refund history. |
| `Gift`, `GiftTransaction`, `GiftInventory`, `GiftCollection`, `GiftLeaderboardEntry` if present | `gifts`, `gift_transactions`, `gift_inventory`, `gift_collections`, `gift_leaderboard_entries` | Preserve sender/recipient, price snapshot, eligibility and replay idempotency. |
| `CreatorPayoutKyc`, `PayoutReview`, `WithdrawalRequest` | `creator_payout_kyc`, `payout_reviews`, `withdrawal_requests` | Preserve encrypted PII references, state transitions, admin review and audit links. Do not copy plaintext secrets into migration artifacts. |

### Assets, cosmetics, progression and rewards

| Source models | Candidate tables | Notes |
|---|---|---|
| `AssetObject`, `asset.counters` | `assets`, `asset_versions`, `asset_variants`, `asset_counters` | Separate identity, version, variant, status and reference tracking. Published keys are immutable. Preserve owner type/id, SHA-256, MIME, dimensions and creator. |
| `Cosmetic`, `Achievement`, `Gift` references | `cosmetics`, `achievements`, `gift_definitions`, `asset_references` | Preserve legacy URLs/fields alongside managed references until the separately approved cutover. Reference guards prevent archiving a referenced asset. |
| `BattlePass`, `Season`, `BattlePassXpGrant`, `XpGrant`, `XpDailyCap`, `UserMission`, `Mission` | `battle_passes`, `seasons`, `xp_grants`, `xp_daily_caps`, `missions`, `user_missions` | Preserve expiry, caps and idempotency. Reward settlement must be atomic with ledger/ownership writes. |
| `Event`, `CountdownEvent`, `MiniGameChallenge`, `MiniGameScore` | `events`, `countdown_events`, `mini_game_challenges`, `mini_game_scores` | Preserve server-controlled availability and score integrity. |
| `PkBattle`, `PkParticipant`, `PkVote`, `PkInvite`, `PkEvent`, `PkLeaderboardEntry` | `pk_battles`, `pk_participants`, `pk_votes`, `pk_invites`, `pk_events`, `pk_leaderboards` | Preserve battle IDs, deadlines, votes and finalization. Do not use DO storage as the financial/reward ledger. |

### Media registry

| Source models | Candidate tables | Notes |
|---|---|---|
| `MediaObject` | `media_objects`, `media_variants` | Preserve canonical bucket/key, checksum, owner/visibility/status/version, supersession and deletion metadata. Derive delivery URLs at read time; never persist signed URLs. |
| `MediaUploadSession` | `media_upload_sessions` | Preserve actor, category, validated MIME/bytes, server-derived key, status, attempts, expiry and linked media ID. Temporary rows need a bounded cleanup job. |
| `MediaQuotaReservation` | `media_quota_reservations` | Atomic per-user committed/reserved byte counters. Reconcile with live sessions and committed `MediaObject` bytes before cutover. |
| Legacy `User.avatar`, badge `imageData`, GridFS/S3 URLs | `legacy_media_references` | Store provenance and mapping only. No silent discard. Bulk blob migration requires separate approval. |

### Configuration and operational data

| Source models | Candidate tables | Notes |
|---|---|---|
| `AppConfig` | `app_config` | Server-authoritative config. KV may cache non-critical snapshots with explicit staleness. |
| `Report`, `ModerationQueue`, `ModerationAction`, `SupportTicket`, `TrustVerification`, `FaceVerificationSubmission`, `VoiceVerificationSubmission`, `UserSafetyStatus` | corresponding `reports`, `moderation_queue`, `moderation_actions`, `support_tickets`, `trust_verifications`, `*_verification_submissions`, `user_safety_status` | Preserve private evidence references in R2 and all moderation/audit state. |

## 4. Ephemeral state that must not be migrated as durable data

- Socket.IO rooms, connection IDs, typing indicators, presence pings and rate-limit counters.
- Worker/DO process-local state in the experimental singleton Durable Object.
- Redis queues/cache entries; recreate through Queues/KV or replay from durable records.
- Presigned PUT/GET URLs and short-lived grants; regenerate on demand.
- Engine.IO sequence state and adapter state; the target protocol must define its own event IDs and recovery cursors.

## 5. Constraint requirements

| Constraint | Requirement |
|---|---|
| Primary/unique | One row per source identity; unique Firebase UID, active refresh/session keys, active pair states, wallet idempotency keys, asset owner+version. |
| Foreign keys | Every reference resolves through `id_map` or a preserved source ID; orphan report must be empty before cutover. |
| Non-negative | Balances, quotas, prices, durations and byte sizes cannot be negative. |
| Ledger append-only | No `UPDATE` of immutable financial entries; refunds are compensating rows. |
| Check enums | Unknown historical enum values are quarantined, not coerced. |
| Indexes | Create only from measured query patterns; record every index change because D1 indexes add written rows. |
| Pagination | Every list query must be bounded; no unbounded admin or API reads. |

## 6. Validation queries by domain

- Identity: user count, UID uniqueness, session generation consistency, device-token ownership.
- Finance: per-user ledger sum equals balance; purchase/gift/withdrawal replay keys unique; refund entries reference original rows.
- Ownership: every equipped cosmetic/worn badge/gift item references an owned row and is active/unexpired.
- Social: accepted friendship pairs symmetric where required; bonds capacity not exceeded; block pairs symmetrical.
- Messaging: every message has a conversation and participant set; media references resolve.
- Rooms: participant roles valid; one active host/owner per room rule; recordings linked to room and owner.
- Media/assets: registry key exists in R2; checksum matches; no published key overwritten; every referenced published asset exists and is not archived.
- Admin: all admin writes have audit rows; roles/permissions unchanged; 2FA state preserved.

## 7. Approvals before implementation

No relational schema is generated until the D1-versus-Hyperdrive ADR exists. No production export, transform, import or delete is run until backup/restore rehearsal and destructive-operation approval are complete.
