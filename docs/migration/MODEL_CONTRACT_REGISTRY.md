# Model contract registry

**Baseline:** 2026-11-23 source. The index below pairs static Mongoose registrations with the existing D1 draft manifest.

Schema definitions and hooks in the linked modules own the source contract. The [field and index inventory](../production/schema-inventory.csv) extracts declarations with file/line evidence. It omits behavior encoded in hooks, instance methods and computed fields. Review those in the module and its callers before porting.

The [draft manifest](../../backend-server/apps/api/migrations/d1/0001_initial.manifest.json) supplies proposed table names and the [DDL](../../backend-server/apps/api/migrations/d1/0001_initial.sql) supplies proposed physical columns. Neither is schema acceptance. The draft reports 91 model modules, 97 root tables, and 146 total tables. Static extraction found 97 registrations. Unmatched source registrations or draft mappings remain open in the index.

For each affected field, record source type, precision, default, required/null/missing behavior, validation, enum, representation, transformation and test. Inspect embedded arrays, UTC timestamps, stable ObjectIds/Firebase UIDs, serialization, relations, indexes, soft deletion, and legacy values. Use the [mapping specification](../database/mongo-to-relational-mapping.md) to track physical differences and reversible representations.

## First characterized mapping

The MiniGameScore catalog read uses the original string ObjectIds, per-user filtering, earliest timestamp on tied best scores and ten recent entries newest first. The draft stores projected fields in typed columns and preserves legacy response-only fields in `catalog_fields`. The fixture verifies omitted metadata, explicitly stored empty metadata and null, populated metadata, a zero duration, and absent versus nonzero `__v`. Older draft D1 rows need a reimport from source to recover fields the old mapping did not store. [Source](../../backend-server/apps/api/src/routes/games.ts) · [D1 adapter](../../backend-server/apps/api/src/migration/d1GameCatalog.ts) · [Parity fixture](../../backend-server/apps/api/src/routes/gamesCatalog.characterization.test.ts)

## Model index

| Logical model | Source schema | Draft root table |
| --- | --- | --- |
| `Achievement` | [Achievement.ts](../../backend-server/apps/api/src/models/Achievement.ts) | `achievements` |
| `AdminAuditLog` | [AdminAuditLog.ts](../../backend-server/apps/api/src/models/AdminAuditLog.ts) | `admin_audit_logs` |
| `AdminModerationAction` | [AdminModerationAction.ts](../../backend-server/apps/api/src/models/AdminModerationAction.ts) | `admin_moderation_actions` |
| `AdminSession` | [AdminSession.ts](../../backend-server/apps/api/src/models/AdminSession.ts) | `admin_sessions` |
| `AdminUser` | [AdminUser.ts](../../backend-server/apps/api/src/models/AdminUser.ts) | `admin_users` |
| `AppConfig` | [AppConfig.ts](../../backend-server/apps/api/src/models/AppConfig.ts) | `app_config` |
| `AssetObject` | [AssetObject.ts](../../backend-server/apps/api/src/models/AssetObject.ts) | `assets` |
| `AuthSession` | [AuthSession.ts](../../backend-server/apps/api/src/models/AuthSession.ts) | `auth_sessions` |
| `BattlePass` | [BattlePass.ts](../../backend-server/apps/api/src/models/BattlePass.ts) | `battle_passes` |
| `BattlePassXpGrant` | [BattlePassXpGrant.ts](../../backend-server/apps/api/src/models/BattlePassXpGrant.ts) | `battle_pass_xp_grants` |
| `Block` | [Block.ts](../../backend-server/apps/api/src/models/Block.ts) | `blocks` |
| `Bond` | [Bond.ts](../../backend-server/apps/api/src/models/Bond.ts) | `bonds` |
| `BondPoint` | [Bond.ts](../../backend-server/apps/api/src/models/Bond.ts) | `bond_points` |
| `BondRankingSnapshot` | [Bond.ts](../../backend-server/apps/api/src/models/Bond.ts) | `bond_ranking_snapshots` |
| `BondRequest` | [Bond.ts](../../backend-server/apps/api/src/models/Bond.ts) | `bond_requests` |
| `BondReward` | [Bond.ts](../../backend-server/apps/api/src/models/Bond.ts) | `bond_rewards` |
| `ChatMessage` | [ChatMessage.ts](../../backend-server/apps/api/src/models/ChatMessage.ts) | `chat_messages` |
| `Clan` | [Clan.ts](../../backend-server/apps/api/src/models/Clan.ts) | `clans` |
| `ClanInvite` | [ClanInvite.ts](../../backend-server/apps/api/src/models/ClanInvite.ts) | `clan_invites` |
| `ClanMessage` | [ClanMessage.ts](../../backend-server/apps/api/src/models/ClanMessage.ts) | `clan_messages` |
| `ConversationMute` | [ConversationMute.ts](../../backend-server/apps/api/src/models/ConversationMute.ts) | `conversation_mutes` |
| `Cosmetic` | [Cosmetic.ts](../../backend-server/apps/api/src/models/Cosmetic.ts) | `cosmetics` |
| `CountdownEvent` | [CountdownEvent.ts](../../backend-server/apps/api/src/models/CountdownEvent.ts) | `countdown_events` |
| `CreatorPayoutKyc` | [CreatorPayoutKyc.ts](../../backend-server/apps/api/src/models/CreatorPayoutKyc.ts) | `creator_payout_kycs` |
| `DailyQuestion` | [DailyQuestion.ts](../../backend-server/apps/api/src/models/DailyQuestion.ts) | `daily_questions` |
| `DeviceToken` | [DeviceToken.ts](../../backend-server/apps/api/src/models/DeviceToken.ts) | `device_tokens` |
| `DiamondTransaction` | [DiamondTransaction.ts](../../backend-server/apps/api/src/models/DiamondTransaction.ts) | `diamond_transactions` |
| `DirectMessage` | [DirectMessage.ts](../../backend-server/apps/api/src/models/DirectMessage.ts) | `direct_messages` |
| `Event` | [Event.ts](../../backend-server/apps/api/src/models/Event.ts) | `events` |
| `FaceVerificationSubmission` | [FaceVerificationSubmission.ts](../../backend-server/apps/api/src/models/FaceVerificationSubmission.ts) | `face_verification_submissions` |
| `Follow` | [Follow.ts](../../backend-server/apps/api/src/models/Follow.ts) | `follows` |
| `FriendMatchRequest` | [FriendMatchRequest.ts](../../backend-server/apps/api/src/models/FriendMatchRequest.ts) | `friend_match_requests` |
| `Friendship` | [Friendship.ts](../../backend-server/apps/api/src/models/Friendship.ts) | `friendships` |
| `Gift` | [Gift.ts](../../backend-server/apps/api/src/models/Gift.ts) | `gifts` |
| `GiftCollection` | [GiftCollection.ts](../../backend-server/apps/api/src/models/GiftCollection.ts) | `gift_collections` |
| `GiftInventory` | [GiftInventory.ts](../../backend-server/apps/api/src/models/GiftInventory.ts) | `gift_inventories` |
| `GiftTransaction` | [GiftTransaction.ts](../../backend-server/apps/api/src/models/GiftTransaction.ts) | `gift_transactions` |
| `GroupChat` | [GroupChat.ts](../../backend-server/apps/api/src/models/GroupChat.ts) | `group_chats` |
| `GroupMessage` | [GroupMessage.ts](../../backend-server/apps/api/src/models/GroupMessage.ts) | `group_messages` |
| `ImmersiveTheme` | [ImmersiveTheme.ts](../../backend-server/apps/api/src/models/ImmersiveTheme.ts) | `immersive_themes` |
| `Like` | [Like.ts](../../backend-server/apps/api/src/models/Like.ts) | `likes` |
| `Match` | [Match.ts](../../backend-server/apps/api/src/models/Match.ts) | `matches` |
| `MediaObject` | [MediaObject.ts](../../backend-server/apps/api/src/models/MediaObject.ts) | `media_objects` |
| `MediaQuotaReservation` | [MediaQuotaReservation.ts](../../backend-server/apps/api/src/models/MediaQuotaReservation.ts) | `media_quota_reservations` |
| `MediaUploadSession` | [MediaUploadSession.ts](../../backend-server/apps/api/src/models/MediaUploadSession.ts) | `media_upload_sessions` |
| `MiniGameChallenge` | [MiniGameChallenge.ts](../../backend-server/apps/api/src/models/MiniGameChallenge.ts) | `mini_game_challenges` |
| `MiniGameScore` | [MiniGameScore.ts](../../backend-server/apps/api/src/models/MiniGameScore.ts) | `mini_game_scores` |
| `Mission` | [Mission.ts](../../backend-server/apps/api/src/models/Mission.ts) | `missions` |
| `ModerationAction` | [ModerationAction.ts](../../backend-server/apps/api/src/models/ModerationAction.ts) | `moderation_actions` |
| `ModerationQueue` | [ModerationQueue.ts](../../backend-server/apps/api/src/models/ModerationQueue.ts) | `moderation_queues` |
| `Notification` | [Notification.ts](../../backend-server/apps/api/src/models/Notification.ts) | `notifications` |
| `NotificationCampaign` | [NotificationCampaign.ts](../../backend-server/apps/api/src/models/NotificationCampaign.ts) | `notification_campaigns` |
| `PayoutReview` | [PayoutReview.ts](../../backend-server/apps/api/src/models/PayoutReview.ts) | `payout_reviews` |
| `PkBattle` | [PkBattle.ts](../../backend-server/apps/api/src/models/PkBattle.ts) | `pk_battles` |
| `PkEvent` | [PkEvent.ts](../../backend-server/apps/api/src/models/PkEvent.ts) | `pk_events` |
| `PkInvite` | [PkInvite.ts](../../backend-server/apps/api/src/models/PkInvite.ts) | `pk_invites` |
| `PkLeaderboardEntry` | [PkLeaderboardEntry.ts](../../backend-server/apps/api/src/models/PkLeaderboardEntry.ts) | `pk_leaderboard_entries` |
| `PkParticipant` | [PkParticipant.ts](../../backend-server/apps/api/src/models/PkParticipant.ts) | `pk_participants` |
| `PkVote` | [PkVote.ts](../../backend-server/apps/api/src/models/PkVote.ts) | `pk_votes` |
| `Poll` | [Poll.ts](../../backend-server/apps/api/src/models/Poll.ts) | `polls` |
| `ProfileVisit` | [ProfileVisit.ts](../../backend-server/apps/api/src/models/ProfileVisit.ts) | `profile_visits` |
| `Purchase` | [Purchase.ts](../../backend-server/apps/api/src/models/Purchase.ts) | `purchases` |
| `Referral` | [Referral.ts](../../backend-server/apps/api/src/models/Referral.ts) | `referrals` |
| `Relationship` | [Relationship.ts](../../backend-server/apps/api/src/models/Relationship.ts) | `relationships` |
| `Report` | [Report.ts](../../backend-server/apps/api/src/models/Report.ts) | `reports` |
| `Room` | [Room.ts](../../backend-server/apps/api/src/models/Room.ts) | `rooms` |
| `RoomActivity` | [RoomActivity.ts](../../backend-server/apps/api/src/models/RoomActivity.ts) | `room_activities` |
| `RoomFollow` | [RoomFollow.ts](../../backend-server/apps/api/src/models/RoomFollow.ts) | `room_follows` |
| `RoomInvite` | [RoomInvite.ts](../../backend-server/apps/api/src/models/RoomInvite.ts) | `room_invites` |
| `RoomModeState` | [RoomModeState.ts](../../backend-server/apps/api/src/models/RoomModeState.ts) | `room_mode_states` |
| `RoomParticipant` | [RoomParticipant.ts](../../backend-server/apps/api/src/models/RoomParticipant.ts) | `room_participants` |
| `RoomReaction` | [RoomReaction.ts](../../backend-server/apps/api/src/models/RoomReaction.ts) | `room_reactions` |
| `RoomRecording` | [RoomRecording.ts](../../backend-server/apps/api/src/models/RoomRecording.ts) | `room_recordings` |
| `Season` | [Season.ts](../../backend-server/apps/api/src/models/Season.ts) | `seasons` |
| `SpeakerRequest` | [SpeakerRequest.ts](../../backend-server/apps/api/src/models/SpeakerRequest.ts) | `speaker_requests` |
| `Story` | [Story.ts](../../backend-server/apps/api/src/models/Story.ts) | `stories` |
| `StoryComment` | [StoryComment.ts](../../backend-server/apps/api/src/models/StoryComment.ts) | `story_comments` |
| `StoryHighlight` | [StoryHighlight.ts](../../backend-server/apps/api/src/models/StoryHighlight.ts) | `story_highlights` |
| `Subscription` | [Subscription.ts](../../backend-server/apps/api/src/models/Subscription.ts) | `subscriptions` |
| `SupportMessage` | [SupportTicket.ts](../../backend-server/apps/api/src/models/SupportTicket.ts) | `support_messages` |
| `SupportTicket` | [SupportTicket.ts](../../backend-server/apps/api/src/models/SupportTicket.ts) | `support_tickets` |
| `TrustVerification` | [TrustVerification.ts](../../backend-server/apps/api/src/models/TrustVerification.ts) | `trust_verifications` |
| `User` | [User.ts](../../backend-server/apps/api/src/models/User.ts) | `users` |
| `UserDailyAnswer` | [DailyQuestion.ts](../../backend-server/apps/api/src/models/DailyQuestion.ts) | `user_daily_answers` |
| `UserMission` | [UserMission.ts](../../backend-server/apps/api/src/models/UserMission.ts) | `user_missions` |
| `UserMood` | [UserMood.ts](../../backend-server/apps/api/src/models/UserMood.ts) | `user_moods` |
| `UserSafetyStatus` | [UserSafetyStatus.ts](../../backend-server/apps/api/src/models/UserSafetyStatus.ts) | `user_safety_statuses` |
| `VibeGraph` | [VibeGraph.ts](../../backend-server/apps/api/src/models/VibeGraph.ts) | `vibe_graphs` |
| `VoicePoll` | [VoicePoll.ts](../../backend-server/apps/api/src/models/VoicePoll.ts) | `voice_polls` |
| `VoiceVerificationSubmission` | [VoiceVerificationSubmission.ts](../../backend-server/apps/api/src/models/VoiceVerificationSubmission.ts) | `voice_verification_submissions` |
| `WalletTransaction` | [WalletTransaction.ts](../../backend-server/apps/api/src/models/WalletTransaction.ts) | `wallet_transactions` |
| `WatchParty` | [WatchParty.ts](../../backend-server/apps/api/src/models/WatchParty.ts) | `watch_parties` |
| `WaveNudge` | [WaveNudge.ts](../../backend-server/apps/api/src/models/WaveNudge.ts) | `wave_nudges` |
| `WishlistItem` | [WishlistItem.ts](../../backend-server/apps/api/src/models/WishlistItem.ts) | `wishlist_items` |
| `WithdrawalRequest` | [WithdrawalRequest.ts](../../backend-server/apps/api/src/models/WithdrawalRequest.ts) | `withdrawal_requests` |
| `XpDailyCap` | [XpDailyCap.ts](../../backend-server/apps/api/src/models/XpDailyCap.ts) | `xp_daily_caps` |
| `XpGrant` | [XpGrant.ts](../../backend-server/apps/api/src/models/XpGrant.ts) | `xp_grants` |
