-- First-cut Cloudflare D1 schema generated from Mongoose models.
-- REVIEW REQUIRED: this is a design draft, not an approved migration.
-- Check every table against docs/database/mongo-to-relational-mapping.md.
-- No data has been exported, transformed or imported.
-- Binary content stays in R2; rows hold bucket/key/checksum references only.
-- Foreign keys use preserved source_id values; defer FK checks during bulk import.

PRAGMA foreign_keys = ON;

-- Model: Achievement.tiers
CREATE TABLE IF NOT EXISTS "achievement_tiers" (
  source_id TEXT PRIMARY KEY,
  "tier" TEXT NOT NULL CHECK ("tier" IN ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'MASTER')),
  "target" INTEGER NOT NULL,
  "reward_coins" INTEGER NOT NULL,
  "reward_cosmetic" TEXT,
  "achievements_id" TEXT NOT NULL REFERENCES "achievements"("source_id"),
  position INTEGER NOT NULL CHECK (position >= 0)
);
CREATE INDEX IF NOT EXISTS "idx_achievement_tiers_parent" ON "achievement_tiers" ("achievements_id", position);

-- Achievement: tiers normalized into achievement_tiers (no JSON column on parent)
-- Model: Achievement
CREATE TABLE IF NOT EXISTS "achievements" (
  source_id TEXT PRIMARY KEY,
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" TEXT NOT NULL CHECK ("category" IN ('SOCIAL', 'CONTENT', 'ENGAGEMENT', 'LOYALTY', 'MISC')),
  "icon" TEXT NOT NULL,
  "image_url" TEXT,
  "image_data" TEXT,
  "image_mime" TEXT,
  "asset_ref" TEXT,
  "kind" TEXT NOT NULL CHECK ("kind" IN ('ACHIEVEMENT', 'HONOR')),
  "metric" TEXT CHECK ("metric" IN ('profile_complete', 'daily_streak_3', 'follow_10', 'host_3', 'gift_5', 'chat_25', 'level_5', 'room_join_10', 'game_plays_10', 'gift_received_5')),
  "weekly_target" INTEGER,
  "hidden" INTEGER NOT NULL,
  "order" INTEGER NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: AdminAuditLog
CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
  source_id TEXT PRIMARY KEY,
  "admin_id" TEXT REFERENCES "admin_users"("source_id"),
  "action" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT,
  "target_user_id" TEXT REFERENCES "users"("source_id"),
  "metadata" TEXT NOT NULL,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: AdminModerationAction
CREATE TABLE IF NOT EXISTS "admin_moderation_actions" (
  source_id TEXT PRIMARY KEY,
  "admin_id" TEXT NOT NULL REFERENCES "admin_users"("source_id"),
  "queue_id" TEXT REFERENCES "moderation_queues"("source_id"),
  "report_id" TEXT REFERENCES "reports"("source_id"),
  "target_type" TEXT NOT NULL,
  "target_id" TEXT,
  "target_user_id" TEXT REFERENCES "users"("source_id"),
  "action_type" TEXT NOT NULL CHECK ("action_type" IN ('WARNING_SENT', 'USER_SUSPENDED', 'USER_BANNED', 'USER_UNBANNED', 'PROFILE_HIDDEN', 'PROFILE_RESTORED', 'PHOTO_REMOVED', 'MESSAGE_DELETED', 'ROOM_ENDED', 'ROOM_FEATURED', 'ROOM_UNFEATURED', 'CHAT_RESTRICTED', 'WALLET_FROZEN', 'WITHDRAWAL_REJECTED', 'REPORT_DISMISSED', 'ESCALATED', 'NO_ACTION')),
  "reason" TEXT,
  "duration_hours" INTEGER,
  "metadata" TEXT NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- AdminUser.permissions: source_id is <parent source_id>:<field>:<position>; primitive element stored in value
-- Model: AdminUser.permissions
CREATE TABLE IF NOT EXISTS "admin_role_permissions" (
  source_id TEXT PRIMARY KEY,
  "value" TEXT,
  "admin_users_id" TEXT NOT NULL REFERENCES "admin_users"("source_id"),
  position INTEGER NOT NULL CHECK (position >= 0)
);
CREATE INDEX IF NOT EXISTS "idx_admin_role_permissions_parent" ON "admin_role_permissions" ("admin_users_id", position);

-- Model: AdminSession
CREATE TABLE IF NOT EXISTS "admin_sessions" (
  source_id TEXT PRIMARY KEY,
  "admin_id" TEXT NOT NULL REFERENCES "admin_users"("source_id"),
  "refresh_token_hash" TEXT NOT NULL,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "expires_at" TEXT NOT NULL,
  "revoked_at" TEXT,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- AdminUser: permissions normalized into admin_role_permissions (no JSON column on parent)
-- Model: AdminUser
CREATE TABLE IF NOT EXISTS "admin_users" (
  source_id TEXT PRIMARY KEY,
  "user_id" TEXT REFERENCES "users"("source_id"),
  "firebase_uid" TEXT,
  "email" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "avatar_url" TEXT,
  "role" TEXT NOT NULL CHECK ("role" IN ('SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'FINANCE_MANAGER', 'SUPPORT_AGENT', 'CONTENT_REVIEWER', 'ROOM_MODERATOR', 'ANALYST')),
  "status" TEXT NOT NULL CHECK ("status" IN ('ACTIVE', 'SUSPENDED', 'DISABLED', 'INVITED')),
  "is_super_admin" INTEGER NOT NULL,
  "password_hash" TEXT,
  "two_factor_enabled" INTEGER NOT NULL,
  "two_factor_secret" TEXT,
  "two_factor_temp_secret" TEXT,
  "last_login_at" TEXT,
  "last_login_ip" TEXT,
  "created_by" TEXT REFERENCES "admin_users"("source_id"),
  "invitation_token_hash" TEXT,
  "invitation_expires_at" TEXT,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: AppConfig
CREATE TABLE IF NOT EXISTS "app_config" (
  source_id TEXT PRIMARY KEY,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "description" TEXT,
  "updated_by" TEXT REFERENCES "admin_users"("source_id"),
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: AssetObject.variants
CREATE TABLE IF NOT EXISTS "asset_variants" (
  source_id TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "content_type" TEXT NOT NULL,
  "bytes" INTEGER NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "assets_id" TEXT NOT NULL REFERENCES "assets"("source_id"),
  position INTEGER NOT NULL CHECK (position >= 0)
);
CREATE INDEX IF NOT EXISTS "idx_asset_variants_parent" ON "asset_variants" ("assets_id", position);

-- AssetObject: variants normalized into asset_variants (no JSON column on parent)
-- Model: AssetObject
CREATE TABLE IF NOT EXISTS "assets" (
  source_id TEXT PRIMARY KEY,
  "owner_type" TEXT NOT NULL CHECK ("owner_type" IN ('cosmetic', 'badge', 'gift')),
  "owner_id" TEXT NOT NULL,
  "kind" TEXT NOT NULL CHECK ("kind" IN ('IMAGE')),
  "status" TEXT NOT NULL CHECK ("status" IN ('staging', 'published', 'archived')),
  "version" INTEGER NOT NULL CHECK ("version" >= 1),
  "original_name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "bytes" INTEGER NOT NULL CHECK ("bytes" >= 1),
  "width" INTEGER NOT NULL CHECK ("width" >= 1),
  "height" INTEGER NOT NULL CHECK ("height" >= 1),
  "sha256" TEXT NOT NULL,
  "staging_key" TEXT NOT NULL,
  "staging_url" TEXT NOT NULL,
  "public_key" TEXT,
  "public_url" TEXT,
  "created_by" TEXT NOT NULL,
  "published_at" TEXT,
  "archived_at" TEXT,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: AuthSession
CREATE TABLE IF NOT EXISTS "auth_sessions" (
  source_id TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "family_id" TEXT NOT NULL,
  "refresh_hash" TEXT NOT NULL,
  "token_version" INTEGER NOT NULL,
  "expires_at" TEXT NOT NULL,
  "revoked_at" TEXT,
  "replaced_by_hash" TEXT,
  "ip" TEXT,
  "user_agent" TEXT,
  "last_used_at" TEXT NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: BattlePass.rewards
CREATE TABLE IF NOT EXISTS "battle_pass_rewards" (
  source_id TEXT PRIMARY KEY,
  "level" INTEGER NOT NULL,
  "claimed" INTEGER NOT NULL,
  "free_claimed" INTEGER NOT NULL,
  "premium_claimed" INTEGER NOT NULL,
  "reward_id" TEXT,
  "battle_passes_id" TEXT NOT NULL REFERENCES "battle_passes"("source_id"),
  position INTEGER NOT NULL CHECK (position >= 0)
);
CREATE INDEX IF NOT EXISTS "idx_battle_pass_rewards_parent" ON "battle_pass_rewards" ("battle_passes_id", position);

-- Model: BattlePassXpGrant
CREATE TABLE IF NOT EXISTS "battle_pass_xp_grants" (
  source_id TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "season_id" TEXT NOT NULL REFERENCES "seasons"("source_id"),
  "action_key" TEXT NOT NULL,
  "xp_gained" INTEGER NOT NULL CHECK ("xp_gained" >= 1),
  "created_at" TEXT,
  "updated_at" TEXT
);

-- BattlePass: rewards normalized into battle_pass_rewards (no JSON column on parent)
-- Model: BattlePass
CREATE TABLE IF NOT EXISTS "battle_passes" (
  source_id TEXT PRIMARY KEY,
  "season_id" TEXT NOT NULL REFERENCES "seasons"("source_id"),
  "season_name" TEXT NOT NULL,
  "user_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "tier" TEXT NOT NULL CHECK ("tier" IN ('free', 'premium')),
  "level" INTEGER NOT NULL,
  "xp" INTEGER NOT NULL,
  "premium" INTEGER NOT NULL,
  "expires_at" TEXT NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: Block
CREATE TABLE IF NOT EXISTS "blocks" (
  source_id TEXT PRIMARY KEY,
  "blocker_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "blocked_user_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: BondPoint
CREATE TABLE IF NOT EXISTS "bond_points" (
  source_id TEXT PRIMARY KEY,
  "bond_id" TEXT NOT NULL,
  "actor_id" TEXT,
  "key" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "points" INTEGER NOT NULL,
  "support" INTEGER NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: BondRankingSnapshot
CREATE TABLE IF NOT EXISTS "bond_ranking_snapshots" (
  source_id TEXT PRIMARY KEY,
  "period" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "entries" TEXT NOT NULL,
  "finalized_at" TEXT NOT NULL
);

-- Model: BondRequest
CREATE TABLE IF NOT EXISTS "bond_requests" (
  source_id TEXT PRIMARY KEY,
  "pair_key" TEXT NOT NULL,
  "sender_id" TEXT NOT NULL,
  "recipient_id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "bond_id" TEXT,
  "slot" INTEGER,
  "gift_id" TEXT,
  "gift_name" TEXT,
  "gift_icon" TEXT,
  "price" INTEGER NOT NULL,
  "gift_points" INTEGER NOT NULL,
  "message" TEXT,
  "status" TEXT NOT NULL CHECK ("status" IN ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED', 'INVALIDATED')),
  "expires_at" TEXT NOT NULL,
  "resolved_at" TEXT,
  "key" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: BondReward
CREATE TABLE IF NOT EXISTS "bond_rewards" (
  source_id TEXT PRIMARY KEY,
  "bond_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "granted_at" TEXT NOT NULL,
  "expires_at" TEXT,
  "expired_at" TEXT
);

-- Bond.slots: source_id is <parent source_id>:<field>:<position>; primitive element stored in value
-- Model: Bond.slots
CREATE TABLE IF NOT EXISTS "bond_slots" (
  source_id TEXT PRIMARY KEY,
  "value" INTEGER,
  "bonds_id" TEXT NOT NULL REFERENCES "bonds"("source_id"),
  position INTEGER NOT NULL CHECK (position >= 0)
);
CREATE INDEX IF NOT EXISTS "idx_bond_slots_parent" ON "bond_slots" ("bonds_id", position);

-- Bond.users: source_id is <parent source_id>:<field>:<position>; primitive element stored in value
-- Model: Bond.users
CREATE TABLE IF NOT EXISTS "bond_users" (
  source_id TEXT PRIMARY KEY,
  "value" TEXT,
  "bonds_id" TEXT NOT NULL REFERENCES "bonds"("source_id"),
  position INTEGER NOT NULL CHECK (position >= 0)
);
CREATE INDEX IF NOT EXISTS "idx_bond_users_parent" ON "bond_users" ("bonds_id", position);

-- Bond: preferences.$* collapsed onto existing column preferences; Map wildcard path suppressed
-- Bond: users normalized into bond_users (no JSON column on parent)
-- Bond: slots normalized into bond_slots (no JSON column on parent)
-- Model: Bond
CREATE TABLE IF NOT EXISTS "bonds" (
  source_id TEXT PRIMARY KEY,
  "pair_key" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL CHECK ("status" IN ('ACTIVE', 'ENDED', 'TERMINATED_BY_BLOCK', 'TERMINATED_BY_MODERATION', 'TERMINATED_BY_ACCOUNT_REMOVAL')),
  "activated_at" TEXT NOT NULL,
  "ended_at" TEXT,
  "ended_by" TEXT,
  "points" INTEGER NOT NULL,
  "version" INTEGER NOT NULL,
  "milestone_days" TEXT NOT NULL,
  "next_milestone_at" TEXT,
  "anniversary_reminder_at" TEXT,
  "preferences" TEXT NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: ChatMessage
CREATE TABLE IF NOT EXISTS "chat_messages" (
  source_id TEXT PRIMARY KEY,
  "room_id" TEXT NOT NULL REFERENCES "rooms"("source_id"),
  "sender_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "message" TEXT NOT NULL,
  "type" TEXT NOT NULL CHECK ("type" IN ('TEXT', 'SYSTEM', 'GIFT', 'REACTION')),
  "media_url" TEXT,
  "media_type" TEXT CHECK ("media_type" IN ('IMAGE')),
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: ClanInvite
CREATE TABLE IF NOT EXISTS "clan_invites" (
  source_id TEXT PRIMARY KEY,
  "clan_id" TEXT NOT NULL REFERENCES "clans"("source_id"),
  "inviter_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "invitee_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "status" TEXT NOT NULL CHECK ("status" IN ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED')),
  "expires_at" TEXT NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- ClanMessage.reactions: source_id is derived from element _id when present, otherwise <parent source_id>:<field>:<position>
-- Model: ClanMessage.reactions
CREATE TABLE IF NOT EXISTS "clan_message_reactions" (
  source_id TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "type" TEXT NOT NULL CHECK ("type" IN ('heart', 'fire', 'laugh', 'clap', 'wow', 'crown', 'stars', 'party')),
  "created_at" TEXT NOT NULL,
  "clan_messages_id" TEXT NOT NULL REFERENCES "clan_messages"("source_id"),
  position INTEGER NOT NULL CHECK (position >= 0)
);
CREATE INDEX IF NOT EXISTS "idx_clan_message_reactions_parent" ON "clan_message_reactions" ("clan_messages_id", position);

-- ClanMessage: reactions normalized into clan_message_reactions (no JSON column on parent)
-- Model: ClanMessage
CREATE TABLE IF NOT EXISTS "clan_messages" (
  source_id TEXT PRIMARY KEY,
  "clan_id" TEXT NOT NULL REFERENCES "clans"("source_id"),
  "sender_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "message" TEXT NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: Clan
CREATE TABLE IF NOT EXISTS "clans" (
  source_id TEXT PRIMARY KEY,
  "owner_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "avatar" TEXT,
  "privacy" TEXT NOT NULL CHECK ("privacy" IN ('PUBLIC', 'PRIVATE')),
  "family_label" TEXT NOT NULL,
  "member_ids" TEXT NOT NULL,
  "member_roles" TEXT NOT NULL,
  "member_count" INTEGER NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: ConversationMute
CREATE TABLE IF NOT EXISTS "conversation_mutes" (
  source_id TEXT PRIMARY KEY,
  "owner_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "partner_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "muted" INTEGER NOT NULL,
  "updated_at" TEXT NOT NULL
);

-- GroupChat.participantIds: source_id is <parent source_id>:<field>:<position>; primitive element stored in value
-- Model: GroupChat.participantIds
CREATE TABLE IF NOT EXISTS "conversation_participants" (
  source_id TEXT PRIMARY KEY,
  "value" TEXT REFERENCES "users"("source_id"),
  "group_chats_id" TEXT NOT NULL REFERENCES "group_chats"("source_id"),
  position INTEGER NOT NULL CHECK (position >= 0)
);
CREATE INDEX IF NOT EXISTS "idx_conversation_participants_parent" ON "conversation_participants" ("group_chats_id", position);

-- Model: Cosmetic
CREATE TABLE IF NOT EXISTS "cosmetics" (
  source_id TEXT PRIMARY KEY,
  "type" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "coin_price" INTEGER NOT NULL CHECK ("coin_price" >= 0),
  "rarity" TEXT NOT NULL CHECK ("rarity" IN ('COMMON', 'RARE', 'EPIC', 'LEGENDARY')),
  "preview" TEXT NOT NULL,
  "is_active" INTEGER NOT NULL,
  "reward_only" INTEGER NOT NULL,
  "asset_kind" TEXT,
  "asset_url" TEXT,
  "asset_ref" TEXT,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: CountdownEvent
CREATE TABLE IF NOT EXISTS "countdown_events" (
  source_id TEXT PRIMARY KEY,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "target_date" TEXT NOT NULL,
  "type" TEXT NOT NULL CHECK ("type" IN ('event', 'festival', 'special')),
  "cover_image" TEXT,
  "color" TEXT NOT NULL,
  "is_active" INTEGER NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: CreatorPayoutKyc
CREATE TABLE IF NOT EXISTS "creator_payout_kycs" (
  source_id TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "legal_full_name" TEXT,
  "date_of_birth" TEXT,
  "pan_number_encrypted" TEXT,
  "pan_last4" TEXT,
  "pan_verified" INTEGER NOT NULL,
  "upi_id_encrypted" TEXT,
  "upi_id_masked" TEXT,
  "bank_account_encrypted" TEXT,
  "bank_account_last4" TEXT,
  "bank_ifsc" TEXT,
  "bank_holder_name" TEXT,
  "kyc_status" TEXT NOT NULL CHECK ("kyc_status" IN ('NOT_SUBMITTED', 'PENDING', 'VERIFIED', 'REJECTED', 'NEEDS_RETRY', 'EXPIRED', 'MANUAL_REVIEW')),
  "payout_status" TEXT NOT NULL CHECK ("payout_status" IN ('DISABLED', 'ENABLED', 'FROZEN', 'MANUAL_REVIEW')),
  "submitted_at" TEXT,
  "verified_at" TEXT,
  "rejected_at" TEXT,
  "reviewed_by_admin_id" TEXT REFERENCES "admin_users"("source_id"),
  "rejection_reason" TEXT,
  "admin_notes" TEXT,
  "metadata" TEXT NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: DailyQuestion
CREATE TABLE IF NOT EXISTS "daily_questions" (
  source_id TEXT PRIMARY KEY,
  "question" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "is_active" INTEGER NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: DeviceToken
CREATE TABLE IF NOT EXISTS "device_tokens" (
  source_id TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "token" TEXT NOT NULL,
  "platform" TEXT NOT NULL CHECK ("platform" IN ('android', 'ios', 'web')),
  "last_seen_at" TEXT NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: DiamondTransaction
CREATE TABLE IF NOT EXISTS "diamond_transactions" (
  source_id TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "type" TEXT NOT NULL CHECK ("type" IN ('CREDIT', 'DEBIT')),
  "source" TEXT NOT NULL CHECK ("source" IN ('ADMIN_ADJUSTMENT', 'GIFT_SENT', 'GIFT_RECEIVED', 'RAZORPAY_PURCHASE', 'GOOGLE_PLAY_PURCHASE', 'REWARD', 'REFUND')),
  "amount" INTEGER NOT NULL CHECK ("amount" >= 1),
  "balance_before" INTEGER NOT NULL,
  "balance_after" INTEGER NOT NULL,
  "metadata" TEXT NOT NULL,
  "idempotency_key" TEXT,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- DirectMessage.reactions: source_id is derived from element _id when present, otherwise <parent source_id>:<field>:<position>
-- Model: DirectMessage.reactions
CREATE TABLE IF NOT EXISTS "direct_message_reactions" (
  source_id TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "type" TEXT NOT NULL CHECK ("type" IN ('heart', 'fire', 'laugh', 'clap', 'wow', 'crown', 'stars', 'party')),
  "created_at" TEXT NOT NULL,
  "direct_messages_id" TEXT NOT NULL REFERENCES "direct_messages"("source_id"),
  position INTEGER NOT NULL CHECK (position >= 0)
);
CREATE INDEX IF NOT EXISTS "idx_direct_message_reactions_parent" ON "direct_message_reactions" ("direct_messages_id", position);

-- DirectMessage: reactions normalized into direct_message_reactions (no JSON column on parent)
-- DirectMessage: hiddenFor normalized into message_hidden_for (no JSON column on parent)
-- Model: DirectMessage
CREATE TABLE IF NOT EXISTS "direct_messages" (
  source_id TEXT PRIMARY KEY,
  "sender_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "receiver_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "room_id" TEXT REFERENCES "rooms"("source_id"),
  "message" TEXT NOT NULL,
  "media_url" TEXT NOT NULL,
  "media_type" TEXT NOT NULL CHECK ("media_type" IN ('', 'IMAGE', 'VIDEO', 'AUDIO')),
  "duration" INTEGER NOT NULL,
  "reply_to" TEXT,
  "forwarded" INTEGER NOT NULL,
  "is_edited" INTEGER NOT NULL,
  "edited_at" TEXT,
  "read" INTEGER NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Event.participantIds: source_id is <parent source_id>:<field>:<position>; primitive element stored in value
-- Model: Event.participantIds
CREATE TABLE IF NOT EXISTS "event_participants" (
  source_id TEXT PRIMARY KEY,
  "value" TEXT REFERENCES "users"("source_id"),
  "events_id" TEXT NOT NULL REFERENCES "events"("source_id"),
  position INTEGER NOT NULL CHECK (position >= 0)
);
CREATE INDEX IF NOT EXISTS "idx_event_participants_parent" ON "event_participants" ("events_id", position);

-- Event: participantIds normalized into event_participants (no JSON column on parent)
-- Model: Event
CREATE TABLE IF NOT EXISTS "events" (
  source_id TEXT PRIMARY KEY,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "host_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "cover_image" TEXT,
  "category" TEXT NOT NULL,
  "type" TEXT NOT NULL CHECK ("type" IN ('ROOM', 'TOURNAMENT', 'SPECIAL', 'WORKSHOP', 'PARTY')),
  "event_date" TEXT NOT NULL,
  "event_end_date" TEXT,
  "timezone" TEXT,
  "room_id" TEXT REFERENCES "rooms"("source_id"),
  "max_participants" INTEGER CHECK ("max_participants" >= 1),
  "tags" TEXT NOT NULL,
  "status" TEXT NOT NULL CHECK ("status" IN ('UPCOMING', 'LIVE', 'COMPLETED', 'CANCELLED')),
  "festival" TEXT NOT NULL CHECK ("festival" IN ('none', 'diwali', 'holi', 'new_year', 'valentines', 'independence_day')),
  "featured" INTEGER NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: FaceVerificationSubmission
CREATE TABLE IF NOT EXISTS "face_verification_submissions" (
  source_id TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "verification_id" TEXT NOT NULL REFERENCES "trust_verifications"("source_id"),
  "selfie_image_url" TEXT,
  "selfie_video_url" TEXT,
  "liveness_video_url" TEXT,
  "face_match_score" INTEGER,
  "liveness_score" INTEGER,
  "quality_score" INTEGER,
  "provider" TEXT,
  "provider_reference_id" TEXT,
  "provider_response" TEXT,
  "status" TEXT NOT NULL CHECK ("status" IN ('SUBMITTED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'NEEDS_RETRY')),
  "failure_reason" TEXT,
  "reviewed_at" TEXT,
  "reviewed_by_admin_id" TEXT REFERENCES "admin_users"("source_id"),
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: Follow
CREATE TABLE IF NOT EXISTS "follows" (
  source_id TEXT PRIMARY KEY,
  "follower_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "following_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: FriendMatchRequest
CREATE TABLE IF NOT EXISTS "friend_match_requests" (
  source_id TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "status" TEXT NOT NULL CHECK ("status" IN ('WAITING', 'PAIRING', 'MATCHED', 'CANCELLED')),
  "matched_user_id" TEXT REFERENCES "users"("source_id"),
  "room_id" TEXT REFERENCES "rooms"("source_id"),
  "expires_at" TEXT NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: Friendship
CREATE TABLE IF NOT EXISTS "friendships" (
  source_id TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "friend_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "status" TEXT NOT NULL CHECK ("status" IN ('PENDING', 'ACCEPTED', 'BLOCKED')),
  "created_at" TEXT,
  "updated_at" TEXT
);

-- GiftCollection.gifts: source_id is <parent source_id>:<field>:<position>; primitive element stored in value
-- Model: GiftCollection.gifts
CREATE TABLE IF NOT EXISTS "gift_collection_items" (
  source_id TEXT PRIMARY KEY,
  "value" TEXT REFERENCES "gifts"("source_id"),
  "gift_collections_id" TEXT NOT NULL REFERENCES "gift_collections"("source_id"),
  position INTEGER NOT NULL CHECK (position >= 0)
);
CREATE INDEX IF NOT EXISTS "idx_gift_collection_items_parent" ON "gift_collection_items" ("gift_collections_id", position);

-- GiftCollection: gifts normalized into gift_collection_items (no JSON column on parent)
-- Model: GiftCollection
CREATE TABLE IF NOT EXISTS "gift_collections" (
  source_id TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "icon" TEXT NOT NULL,
  "bonus_description" TEXT NOT NULL,
  "bonus_xp_multiplier" INTEGER NOT NULL,
  "bonus_coin_multiplier" INTEGER NOT NULL,
  "is_active" INTEGER NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: GiftInventory
CREATE TABLE IF NOT EXISTS "gift_inventories" (
  source_id TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "gift_id" TEXT NOT NULL REFERENCES "gifts"("source_id"),
  "quantity" INTEGER NOT NULL CHECK ("quantity" >= 1),
  "source" TEXT NOT NULL CHECK ("source" IN ('purchased', 'received', 'reward', 'mystery', 'upgrade', 'trade')),
  "upgrade_level" INTEGER NOT NULL CHECK ("upgrade_level" >= 1),
  "tradable" INTEGER NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: GiftTransaction
CREATE TABLE IF NOT EXISTS "gift_transactions" (
  source_id TEXT PRIMARY KEY,
  "room_id" TEXT REFERENCES "rooms"("source_id"),
  "sender_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "receiver_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "gift_id" TEXT NOT NULL REFERENCES "gifts"("source_id"),
  "coin_amount" INTEGER NOT NULL,
  "diamond_amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL CHECK ("currency" IN ('COINS', 'DIAMONDS')),
  "type" TEXT NOT NULL CHECK ("type" IN ('send', 'combo', 'room_wide', 'trade', 'auction')),
  "combo_count" INTEGER NOT NULL,
  "total_value" INTEGER NOT NULL,
  "effect" TEXT NOT NULL,
  "metadata" TEXT NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: Gift
CREATE TABLE IF NOT EXISTS "gifts" (
  source_id TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "icon" TEXT NOT NULL,
  "coin_price" INTEGER NOT NULL CHECK ("coin_price" >= 1),
  "pk_points" INTEGER NOT NULL CHECK ("pk_points" >= 0),
  "diamond_price" INTEGER NOT NULL,
  "is_active" INTEGER NOT NULL,
  "effect3d" TEXT NOT NULL,
  "interactive" INTEGER NOT NULL,
  "animation_key" TEXT NOT NULL,
  "expires_at" TEXT NOT NULL,
  "combo_multiplier" INTEGER NOT NULL,
  "category" TEXT NOT NULL CHECK ("category" IN ('normal', 'premium', 'limited', 'seasonal', 'mythology', 'space', 'dragon', 'luxury', 'vip', 'bonds')),
  "bond_purpose" TEXT CHECK ("bond_purpose" IN ('INVITATION', 'PROGRESSION', 'ANNIVERSARY', 'COSMETIC')),
  "bond_kind" TEXT,
  "bond_points" INTEGER NOT NULL CHECK ("bond_points" >= 0),
  "bond_minimum_days" INTEGER NOT NULL CHECK ("bond_minimum_days" >= 0),
  "bond_cosmetic_id" TEXT,
  "theme" TEXT NOT NULL,
  "rarity" TEXT NOT NULL CHECK ("rarity" IN ('common', 'rare', 'epic', 'legendary', 'mythic')),
  "limited_edition_active" INTEGER NOT NULL,
  "limited_edition_total" INTEGER NOT NULL,
  "limited_edition_remaining" INTEGER NOT NULL,
  "collection_id" TEXT NOT NULL REFERENCES "gift_collections"("source_id"),
  "tradable" INTEGER NOT NULL,
  "upgradeable" INTEGER NOT NULL,
  "upgrade_path" TEXT NOT NULL,
  "achievement_gift" INTEGER NOT NULL,
  "pet_gift" INTEGER NOT NULL,
  "vehicle_gift" INTEGER NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- GroupChat: participantIds normalized into conversation_participants (no JSON column on parent)
-- Model: GroupChat
CREATE TABLE IF NOT EXISTS "group_chats" (
  source_id TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "created_by" TEXT NOT NULL REFERENCES "users"("source_id"),
  "last_message" TEXT NOT NULL,
  "last_message_at" TEXT,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: GroupMessage
CREATE TABLE IF NOT EXISTS "group_messages" (
  source_id TEXT PRIMARY KEY,
  "group_id" TEXT NOT NULL REFERENCES "group_chats"("source_id"),
  "sender_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "message" TEXT NOT NULL,
  "media_url" TEXT NOT NULL,
  "media_type" TEXT NOT NULL CHECK ("media_type" IN ('', 'IMAGE', 'VIDEO', 'AUDIO')),
  "duration" INTEGER NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: ImmersiveTheme
CREATE TABLE IF NOT EXISTS "immersive_themes" (
  source_id TEXT PRIMARY KEY,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL CHECK ("type" IN ('room_background', 'profile_theme', 'entrance_effect', 'border')),
  "category" TEXT NOT NULL,
  "colors" TEXT NOT NULL,
  "animation" TEXT,
  "ambient_sound" TEXT,
  "price_coins" INTEGER NOT NULL,
  "price_diamonds" INTEGER NOT NULL,
  "premium" INTEGER NOT NULL,
  "available" INTEGER NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: Like
CREATE TABLE IF NOT EXISTS "likes" (
  source_id TEXT PRIMARY KEY,
  "liker_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "liked_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "type" TEXT NOT NULL CHECK ("type" IN ('LIKE', 'SUPER_LIKE', 'PASS')),
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Match.users: source_id is <parent source_id>:<field>:<position>; primitive element stored in value
-- Model: Match.users
CREATE TABLE IF NOT EXISTS "match_users" (
  source_id TEXT PRIMARY KEY,
  "value" TEXT NOT NULL REFERENCES "users"("source_id"),
  "matches_id" TEXT NOT NULL REFERENCES "matches"("source_id"),
  position INTEGER NOT NULL CHECK (position >= 0)
);
CREATE INDEX IF NOT EXISTS "idx_match_users_parent" ON "match_users" ("matches_id", position);

-- Match: users normalized into match_users (no JSON column on parent)
-- Model: Match
CREATE TABLE IF NOT EXISTS "matches" (
  source_id TEXT PRIMARY KEY,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- MediaObject: variants normalized into media_variants (no JSON column on parent)
-- Model: MediaObject
CREATE TABLE IF NOT EXISTS "media_objects" (
  source_id TEXT PRIMARY KEY,
  "owner_type" TEXT NOT NULL CHECK ("owner_type" IN ('USER', 'ROOM', 'CLAN', 'MESSAGE', 'COSMETIC', 'ACHIEVEMENT', 'EVENT', 'APPLICATION')),
  "owner_id" TEXT NOT NULL,
  "media_type" TEXT NOT NULL CHECK ("media_type" IN ('IMAGE', 'VIDEO', 'AUDIO', 'FILE')),
  "category" TEXT NOT NULL CHECK ("category" IN ('AVATAR', 'COVER', 'GALLERY', 'CHAT_IMAGE', 'CHAT_VIDEO', 'VOICE_MESSAGE', 'ATTACHMENT', 'BADGE', 'COSMETIC', 'STICKER', 'APPLICATION_ART')),
  "bucket" TEXT NOT NULL CHECK ("bucket" IN ('assets', 'public-media', 'private-media', 'originals', 'staging')),
  "storage_key" TEXT NOT NULL,
  "content_type" TEXT NOT NULL,
  "file_size" INTEGER NOT NULL CHECK ("file_size" >= 1),
  "width" INTEGER,
  "height" INTEGER,
  "duration" INTEGER,
  "checksum" TEXT NOT NULL,
  "visibility" TEXT NOT NULL CHECK ("visibility" IN ('PUBLIC', 'PRIVATE')),
  "processing_status" TEXT NOT NULL CHECK ("processing_status" IN ('PENDING', 'PROCESSING', 'READY', 'FAILED')),
  "moderation_status" TEXT NOT NULL CHECK ("moderation_status" IN ('PENDING', 'APPROVED', 'REJECTED')),
  "version" INTEGER NOT NULL CHECK ("version" >= 1),
  "created_by" TEXT NOT NULL,
  "superseded_by_id" TEXT,
  "deleted_at" TEXT,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: MediaQuotaReservation
CREATE TABLE IF NOT EXISTS "media_quota_reservations" (
  source_id TEXT PRIMARY KEY,
  "bytes" INTEGER NOT NULL CHECK ("bytes" >= 0),
  "updated_at" TEXT,
  "created_at" TEXT
);

-- Model: MediaUploadSession
CREATE TABLE IF NOT EXISTS "media_upload_sessions" (
  source_id TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "category" TEXT NOT NULL CHECK ("category" IN ('AVATAR', 'COVER', 'GALLERY', 'CHAT_IMAGE', 'CHAT_VIDEO', 'VOICE_MESSAGE', 'ATTACHMENT', 'BADGE', 'COSMETIC', 'STICKER', 'APPLICATION_ART')),
  "expected_content_type" TEXT NOT NULL,
  "expected_bytes" INTEGER NOT NULL CHECK ("expected_bytes" >= 1),
  "owner_type" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  "bucket" TEXT NOT NULL CHECK ("bucket" IN ('staging')),
  "staging_key" TEXT NOT NULL,
  "status" TEXT NOT NULL CHECK ("status" IN ('PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'FAILED')),
  "expires_at" TEXT NOT NULL,
  "completed_at" TEXT,
  "media_id" TEXT,
  "attempts" INTEGER NOT NULL,
  "quota_reserved" INTEGER NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: MediaObject.variants
CREATE TABLE IF NOT EXISTS "media_variants" (
  source_id TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "bucket" TEXT NOT NULL CHECK ("bucket" IN ('assets', 'public-media', 'private-media', 'originals', 'staging')),
  "key" TEXT NOT NULL,
  "url" TEXT,
  "content_type" TEXT NOT NULL,
  "bytes" INTEGER NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "media_objects_id" TEXT NOT NULL REFERENCES "media_objects"("source_id"),
  position INTEGER NOT NULL CHECK (position >= 0)
);
CREATE INDEX IF NOT EXISTS "idx_media_variants_parent" ON "media_variants" ("media_objects_id", position);

-- DirectMessage.hiddenFor: source_id is <parent source_id>:<field>:<position>; primitive element stored in value
-- Model: DirectMessage.hiddenFor
CREATE TABLE IF NOT EXISTS "message_hidden_for" (
  source_id TEXT PRIMARY KEY,
  "value" TEXT REFERENCES "users"("source_id"),
  "direct_messages_id" TEXT NOT NULL REFERENCES "direct_messages"("source_id"),
  position INTEGER NOT NULL CHECK (position >= 0)
);
CREATE INDEX IF NOT EXISTS "idx_message_hidden_for_parent" ON "message_hidden_for" ("direct_messages_id", position);

-- Model: MiniGameChallenge
CREATE TABLE IF NOT EXISTS "mini_game_challenges" (
  source_id TEXT PRIMARY KEY,
  "challenger_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "target_user_id" TEXT REFERENCES "users"("source_id"),
  "clan_id" TEXT REFERENCES "clans"("source_id"),
  "game_id" TEXT NOT NULL CHECK ("game_id" IN ('vibe_tap', 'memory_match', 'reflex_ring')),
  "score" INTEGER NOT NULL CHECK ("score" >= 0),
  "score_id" TEXT REFERENCES "mini_game_scores"("source_id"),
  "message" TEXT,
  "expires_at" TEXT NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: MiniGameScore
CREATE TABLE IF NOT EXISTS "mini_game_scores" (
  source_id TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "game_id" TEXT NOT NULL CHECK ("game_id" IN ('vibe_tap', 'memory_match', 'reflex_ring')),
  "score" INTEGER NOT NULL CHECK ("score" >= 0),
  "duration_ms" INTEGER CHECK ("duration_ms" >= 0),
  "rounds" INTEGER CHECK ("rounds" >= 0),
  "metadata" TEXT NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: Mission
CREATE TABLE IF NOT EXISTS "missions" (
  source_id TEXT PRIMARY KEY,
  "key" TEXT NOT NULL,
  "type" TEXT NOT NULL CHECK ("type" IN ('daily', 'weekly', 'monthly', 'seasonal')),
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "requirements_action" TEXT NOT NULL,
  "requirements_target" INTEGER NOT NULL,
  "requirements_unit" TEXT NOT NULL,
  "rewards_xp" INTEGER NOT NULL,
  "rewards_coins" INTEGER NOT NULL,
  "rewards_diamonds" INTEGER NOT NULL,
  "rewards_cosmetic_id" TEXT,
  "rewards_title_id" TEXT,
  "badge_icon" TEXT,
  "badge_color" TEXT,
  "season_id" TEXT REFERENCES "seasons"("source_id"),
  "start_date" TEXT,
  "end_date" TEXT,
  "active" INTEGER NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: ModerationAction
CREATE TABLE IF NOT EXISTS "moderation_actions" (
  source_id TEXT PRIMARY KEY,
  "target_user_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "moderator_id" TEXT REFERENCES "users"("source_id"),
  "report_id" TEXT REFERENCES "reports"("source_id"),
  "action" TEXT NOT NULL CHECK ("action" IN ('WARN', 'MUTE', 'SUSPEND', 'BAN', 'UNBAN')),
  "reason" TEXT NOT NULL,
  "duration_hours" INTEGER,
  "expires_at" TEXT,
  "automated" INTEGER NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: ModerationQueue
CREATE TABLE IF NOT EXISTS "moderation_queues" (
  source_id TEXT PRIMARY KEY,
  "report_id" TEXT REFERENCES "reports"("source_id"),
  "target_type" TEXT NOT NULL CHECK ("target_type" IN ('USER', 'PROFILE', 'ROOM', 'MESSAGE', 'PHOTO', 'VIDEO_ROOM', 'VOICE_ROOM', 'CHAT', 'WITHDRAWAL', 'PAYMENT')),
  "target_id" TEXT NOT NULL,
  "target_user_id" TEXT REFERENCES "users"("source_id"),
  "priority" TEXT NOT NULL CHECK ("priority" IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  "status" TEXT NOT NULL CHECK ("status" IN ('PENDING', 'IN_REVIEW', 'ESCALATED', 'ACTION_TAKEN', 'DISMISSED', 'AUTO_RESOLVED')),
  "assigned_to" TEXT REFERENCES "admin_users"("source_id"),
  "reason" TEXT,
  "ai_score" INTEGER,
  "notes" TEXT,
  "resolved_at" TEXT,
  "resolved_by" TEXT REFERENCES "admin_users"("source_id"),
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: NotificationCampaign
CREATE TABLE IF NOT EXISTS "notification_campaigns" (
  source_id TEXT PRIMARY KEY,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "segment" TEXT NOT NULL CHECK ("segment" IN ('all', 'hosts', 'city', 'vip', 'custom')),
  "segment_value" TEXT,
  "filters" TEXT,
  "status" TEXT NOT NULL CHECK ("status" IN ('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'CANCELLED')),
  "scheduled_for" TEXT,
  "sent_count" INTEGER NOT NULL,
  "delivered_count" INTEGER NOT NULL,
  "open_count" INTEGER NOT NULL,
  "click_count" INTEGER NOT NULL,
  "created_by" TEXT NOT NULL REFERENCES "admin_users"("source_id"),
  "sent_at" TEXT,
  "completed_at" TEXT,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: Notification
CREATE TABLE IF NOT EXISTS "notifications" (
  source_id TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "type" TEXT NOT NULL CHECK ("type" IN ('FOLLOW', 'GIFT', 'ROOM_INVITE', 'ROOM_LIVE', 'SPEAKER_APPROVED', 'MESSAGE', 'MOMENT', 'COMMENT', 'SYSTEM', 'FRIEND_REQUEST', 'FRIEND_ACCEPT', 'SUBSCRIPTION', 'WAVE')),
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "data" TEXT,
  "read" INTEGER NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: PayoutReview
CREATE TABLE IF NOT EXISTS "payout_reviews" (
  source_id TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "withdrawal_request_id" TEXT NOT NULL REFERENCES "withdrawal_requests"("source_id"),
  "trust_verification_id" TEXT REFERENCES "trust_verifications"("source_id"),
  "creator_payout_kyc_id" TEXT REFERENCES "creator_payout_kycs"("source_id"),
  "status" TEXT NOT NULL CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED', 'NEEDS_MANUAL_REVIEW', 'BLOCKED', 'PAID')),
  "trust_verified" INTEGER NOT NULL,
  "kyc_verified" INTEGER NOT NULL,
  "wallet_safe" INTEGER NOT NULL,
  "reports_safe" INTEGER NOT NULL,
  "fraud_safe" INTEGER NOT NULL,
  "risk_score" INTEGER,
  "risk_flags" TEXT NOT NULL,
  "payout" TEXT,
  "reviewed_by_admin_id" TEXT REFERENCES "admin_users"("source_id"),
  "admin_notes" TEXT,
  "rejection_reason" TEXT,
  "reviewed_at" TEXT,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: PkBattle
CREATE TABLE IF NOT EXISTS "pk_battles" (
  source_id TEXT PRIMARY KEY,
  "battle_code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "mode" TEXT NOT NULL CHECK ("mode" IN ('GIFT', 'VOTE', 'REACTION', 'MIXED')),
  "format" TEXT NOT NULL CHECK ("format" IN ('PLAYER', 'TEAM', 'ROOM', 'LIVESTREAM')),
  "scope" TEXT NOT NULL CHECK ("scope" IN ('SAME_ROOM', 'CROSS_ROOM')),
  "team_size" INTEGER NOT NULL CHECK ("team_size" >= 1),
  "status" TEXT NOT NULL CHECK ("status" IN ('INVITED', 'WAITING', 'PREPARING', 'READY', 'COUNTDOWN', 'ACTIVE', 'FINAL_CRUNCH', 'FINALIZING', 'COMPLETED', 'CLOSED', 'ABORTED', 'ENDED', 'CANCELLED', 'DECLINED', 'EXPIRED', 'FORCE_ENDED')),
  "battle_type" TEXT NOT NULL CHECK ("battle_type" IN ('VOICE', 'VIDEO')),
  "duration_seconds" INTEGER NOT NULL CHECK ("duration_seconds" >= 30),
  "selected_gift_id" TEXT REFERENCES "gifts"("source_id"),
  "in_room_battle" INTEGER NOT NULL,
  "state_version" INTEGER NOT NULL CHECK ("state_version" >= 1),
  "event_sequence" INTEGER NOT NULL CHECK ("event_sequence" >= 0),
  "countdown_ends_at" TEXT,
  "finalized_at" TEXT,
  "closed_at" TEXT,
  "result_type" TEXT CHECK ("result_type" IN ('WIN', 'DRAW', 'FORFEIT', 'CANCELLED', 'TECHNICAL')),
  "termination_reason" TEXT NOT NULL,
  "started_by_user_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "left_room_id" TEXT NOT NULL REFERENCES "rooms"("source_id"),
  "right_room_id" TEXT NOT NULL REFERENCES "rooms"("source_id"),
  "left_host_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "right_host_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "left_score" INTEGER NOT NULL CHECK ("left_score" >= 0),
  "right_score" INTEGER NOT NULL CHECK ("right_score" >= 0),
  "winner_side" TEXT CHECK ("winner_side" IN ('LEFT', 'RIGHT', 'DRAW')),
  "winner_user_id" TEXT REFERENCES "users"("source_id"),
  "started_at" TEXT,
  "ended_at" TEXT,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: PkEvent
CREATE TABLE IF NOT EXISTS "pk_events" (
  source_id TEXT PRIMARY KEY,
  "battle_id" TEXT NOT NULL REFERENCES "pk_battles"("source_id"),
  "room_id" TEXT REFERENCES "rooms"("source_id"),
  "user_id" TEXT REFERENCES "users"("source_id"),
  "event_type" TEXT NOT NULL CHECK ("event_type" IN ('PK_CREATED', 'PK_READY', 'PK_COUNTDOWN', 'PK_FINAL_CRUNCH', 'PK_FINALIZING', 'PK_COMPLETED', 'PK_CLOSED', 'PK_CANCELLED', 'PK_ABORTED', 'PK_INVITE_SENT', 'PK_INVITE_ACCEPTED', 'PK_INVITE_REJECTED', 'PK_INVITE_EXPIRED', 'PK_STARTED', 'GIFT_SENT', 'REACTION_SENT', 'VOTE_CAST', 'SCORE_UPDATED', 'LEAD_CHANGED', 'PK_ENDED', 'PK_FORCE_ENDED', 'PK_REMATCH_REQUESTED')),
  "side" TEXT CHECK ("side" IN ('LEFT', 'RIGHT', 'DRAW')),
  "points" INTEGER NOT NULL,
  "state_version" INTEGER NOT NULL,
  "sequence" INTEGER CHECK ("sequence" >= 1),
  "gift_transaction_id" TEXT REFERENCES "gift_transactions"("source_id"),
  "metadata" TEXT NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: PkInvite
CREATE TABLE IF NOT EXISTS "pk_invites" (
  source_id TEXT PRIMARY KEY,
  "battle_id" TEXT NOT NULL REFERENCES "pk_battles"("source_id"),
  "inviter_user_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "invitee_user_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "inviter_room_id" TEXT NOT NULL REFERENCES "rooms"("source_id"),
  "invitee_room_id" TEXT NOT NULL REFERENCES "rooms"("source_id"),
  "status" TEXT NOT NULL CHECK ("status" IN ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED')),
  "expires_at" TEXT NOT NULL,
  "responded_at" TEXT,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: PkLeaderboardEntry
CREATE TABLE IF NOT EXISTS "pk_leaderboard_entries" (
  source_id TEXT PRIMARY KEY,
  "battle_id" TEXT NOT NULL REFERENCES "pk_battles"("source_id"),
  "user_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "side" TEXT NOT NULL CHECK ("side" IN ('LEFT', 'RIGHT')),
  "total_points" INTEGER NOT NULL,
  "total_gifts_sent" INTEGER NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: PkParticipant
CREATE TABLE IF NOT EXISTS "pk_participants" (
  source_id TEXT PRIMARY KEY,
  "battle_id" TEXT NOT NULL REFERENCES "pk_battles"("source_id"),
  "user_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "room_id" TEXT NOT NULL REFERENCES "rooms"("source_id"),
  "side" TEXT NOT NULL CHECK ("side" IN ('LEFT', 'RIGHT')),
  "role" TEXT NOT NULL CHECK ("role" IN ('HOST', 'SPEAKER', 'AUDIENCE', 'MODERATOR')),
  "is_ready" INTEGER NOT NULL,
  "team_name" TEXT CHECK ("team_name" IN ('A', 'B')),
  "joined_at" TEXT NOT NULL,
  "left_at" TEXT
);

-- Model: PkVote
CREATE TABLE IF NOT EXISTS "pk_votes" (
  source_id TEXT PRIMARY KEY,
  "battle_id" TEXT NOT NULL REFERENCES "pk_battles"("source_id"),
  "voter_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "side" TEXT NOT NULL CHECK ("side" IN ('LEFT', 'RIGHT')),
  "room_id" TEXT NOT NULL REFERENCES "rooms"("source_id"),
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Poll.voters: source_id is <parent source_id>:<field>:<position>; primitive element stored in value
-- Model: Poll.voters
CREATE TABLE IF NOT EXISTS "poll_votes" (
  source_id TEXT PRIMARY KEY,
  "value" TEXT REFERENCES "users"("source_id"),
  "polls_id" TEXT NOT NULL REFERENCES "polls"("source_id"),
  position INTEGER NOT NULL CHECK (position >= 0)
);
CREATE INDEX IF NOT EXISTS "idx_poll_votes_parent" ON "poll_votes" ("polls_id", position);

-- Poll: voters normalized into poll_votes (no JSON column on parent)
-- Model: Poll
CREATE TABLE IF NOT EXISTS "polls" (
  source_id TEXT PRIMARY KEY,
  "room_id" TEXT NOT NULL REFERENCES "rooms"("source_id"),
  "created_by" TEXT NOT NULL REFERENCES "users"("source_id"),
  "question" TEXT NOT NULL,
  "options" TEXT NOT NULL,
  "is_active" INTEGER NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: ProfileVisit
CREATE TABLE IF NOT EXISTS "profile_visits" (
  source_id TEXT PRIMARY KEY,
  "profile_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "visitor_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "last_visited_at" TEXT NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: Purchase
CREATE TABLE IF NOT EXISTS "purchases" (
  source_id TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "provider" TEXT NOT NULL CHECK ("provider" IN ('RAZORPAY', 'GOOGLE_PLAY')),
  "status" TEXT NOT NULL CHECK ("status" IN ('PENDING', 'PAID', 'FAILED', 'CREDITED', 'REFUND_PENDING', 'REFUNDED', 'REFUND_FAILED')),
  "pack_id" TEXT NOT NULL,
  "asset_currency" TEXT NOT NULL CHECK ("asset_currency" IN ('COINS', 'DIAMONDS')),
  "coin_amount" INTEGER NOT NULL,
  "diamond_amount" INTEGER NOT NULL,
  "amount_inr" INTEGER NOT NULL,
  "currency" TEXT NOT NULL CHECK ("currency" IN ('INR')),
  "provider_order_id" TEXT,
  "provider_payment_id" TEXT,
  "provider_signature" TEXT,
  "product_id" TEXT,
  "purchase_token" TEXT,
  "google_order_id" TEXT,
  "credited_transaction_id" TEXT REFERENCES "wallet_transactions"("source_id"),
  "credited_diamond_transaction_id" TEXT REFERENCES "diamond_transactions"("source_id"),
  "refund_transaction_id" TEXT REFERENCES "wallet_transactions"("source_id"),
  "refund_provider_id" TEXT,
  "refunded_at" TEXT,
  "metadata" TEXT NOT NULL,
  "credited_at" TEXT,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: Referral
CREATE TABLE IF NOT EXISTS "referrals" (
  source_id TEXT PRIMARY KEY,
  "referrer_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "referred_user_id" TEXT REFERENCES "users"("source_id"),
  "referral_code" TEXT NOT NULL,
  "status" TEXT NOT NULL CHECK ("status" IN ('PENDING', 'COMPLETED', 'REWARDED', 'EXPIRED')),
  "reward_coins" INTEGER,
  "reward_cosmetic_id" TEXT,
  "completed_at" TEXT,
  "rewarded_at" TEXT,
  "ip_address" TEXT,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Relationship.users: source_id is <parent source_id>:<field>:<position>; primitive element stored in value
-- Model: Relationship.users
CREATE TABLE IF NOT EXISTS "relationship_users" (
  source_id TEXT PRIMARY KEY,
  "value" TEXT NOT NULL REFERENCES "users"("source_id"),
  "relationships_id" TEXT NOT NULL REFERENCES "relationships"("source_id"),
  position INTEGER NOT NULL CHECK (position >= 0)
);
CREATE INDEX IF NOT EXISTS "idx_relationship_users_parent" ON "relationship_users" ("relationships_id", position);

-- Relationship: users normalized into relationship_users (no JSON column on parent)
-- Model: Relationship
CREATE TABLE IF NOT EXISTS "relationships" (
  source_id TEXT PRIMARY KEY,
  "pair_key" TEXT NOT NULL,
  "xp" INTEGER NOT NULL,
  "level" INTEGER NOT NULL,
  "level_title" TEXT NOT NULL,
  "streak_days" INTEGER NOT NULL,
  "last_streak_at" TEXT,
  "last_interaction_at" TEXT,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: Report
CREATE TABLE IF NOT EXISTS "reports" (
  source_id TEXT PRIMARY KEY,
  "reporter_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "target_user_id" TEXT REFERENCES "users"("source_id"),
  "room_id" TEXT REFERENCES "rooms"("source_id"),
  "reason" TEXT NOT NULL,
  "description" TEXT,
  "evidence" TEXT NOT NULL,
  "risk_score" INTEGER NOT NULL,
  "auto_flagged" INTEGER NOT NULL,
  "auto_action_taken" TEXT,
  "moderator_note" TEXT,
  "reviewed_by" TEXT REFERENCES "users"("source_id"),
  "reviewed_at" TEXT,
  "status" TEXT NOT NULL CHECK ("status" IN ('PENDING', 'REVIEWED', 'ACTION_TAKEN', 'DISMISSED')),
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: RoomActivity
CREATE TABLE IF NOT EXISTS "room_activities" (
  source_id TEXT PRIMARY KEY,
  "room_id" TEXT NOT NULL REFERENCES "rooms"("source_id"),
  "user_id" TEXT REFERENCES "users"("source_id"),
  "type" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "metadata" TEXT NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: RoomFollow
CREATE TABLE IF NOT EXISTS "room_follows" (
  source_id TEXT PRIMARY KEY,
  "room_id" TEXT NOT NULL REFERENCES "rooms"("source_id"),
  "user_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: RoomInvite
CREATE TABLE IF NOT EXISTS "room_invites" (
  source_id TEXT PRIMARY KEY,
  "room_id" TEXT NOT NULL REFERENCES "rooms"("source_id"),
  "inviter_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "invitee_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "status" TEXT NOT NULL CHECK ("status" IN ('PENDING', 'ACCEPTED', 'DECLINED')),
  "created_at" TEXT,
  "updated_at" TEXT
);

-- RoomModeState.participants: source_id is <parent source_id>:<field>:<position>; primitive element stored in value
-- Model: RoomModeState.participants
CREATE TABLE IF NOT EXISTS "room_mode_participants" (
  source_id TEXT PRIMARY KEY,
  "value" TEXT REFERENCES "users"("source_id"),
  "room_mode_states_id" TEXT NOT NULL REFERENCES "room_mode_states"("source_id"),
  position INTEGER NOT NULL CHECK (position >= 0)
);
CREATE INDEX IF NOT EXISTS "idx_room_mode_participants_parent" ON "room_mode_participants" ("room_mode_states_id", position);

-- RoomModeState: scores.$* collapsed onto existing column scores; Map wildcard path suppressed
-- RoomModeState: participants normalized into room_mode_participants (no JSON column on parent)
-- Model: RoomModeState
CREATE TABLE IF NOT EXISTS "room_mode_states" (
  source_id TEXT PRIMARY KEY,
  "room_id" TEXT NOT NULL REFERENCES "rooms"("source_id"),
  "mode" TEXT NOT NULL CHECK ("mode" IN ('coffee_date', 'blind_date', 'truth_or_dare', 'never_have_i_ever', 'would_you_rather')),
  "round" INTEGER NOT NULL,
  "status" TEXT NOT NULL CHECK ("status" IN ('WAITING', 'ACTIVE', 'ROUND_END', 'FINISHED')),
  "scores" TEXT NOT NULL,
  "current_turn_user_id" TEXT REFERENCES "users"("source_id"),
  "current_question" TEXT,
  "current_options" TEXT NOT NULL,
  "round_start_time" TEXT,
  "round_end_time" TEXT,
  "metadata" TEXT NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: RoomParticipant
CREATE TABLE IF NOT EXISTS "room_participants" (
  source_id TEXT PRIMARY KEY,
  "room_id" TEXT NOT NULL REFERENCES "rooms"("source_id"),
  "user_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "role" TEXT NOT NULL CHECK ("role" IN ('HOST', 'SPEAKER', 'AUDIENCE', 'MODERATOR')),
  "mic_enabled" INTEGER NOT NULL,
  "moderator_muted" INTEGER NOT NULL,
  "seat_index" INTEGER CHECK ("seat_index" >= 0),
  "camera_enabled" INTEGER NOT NULL,
  "joined_at" TEXT NOT NULL,
  "left_at" TEXT
);

-- Model: RoomReaction
CREATE TABLE IF NOT EXISTS "room_reactions" (
  source_id TEXT PRIMARY KEY,
  "label" TEXT NOT NULL,
  "emoji" TEXT NOT NULL,
  "asset_url" TEXT,
  "asset_storage_key" TEXT,
  "asset_kind" TEXT NOT NULL CHECK ("asset_kind" IN ('STATIC', 'ANIMATED')),
  "mime_type" TEXT,
  "access" TEXT NOT NULL CHECK ("access" IN ('EVERYONE', 'VIP_EXCLUSIVE')),
  "is_active" INTEGER NOT NULL,
  "sort_order" INTEGER NOT NULL,
  "created_by" TEXT REFERENCES "admin_users"("source_id"),
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: RoomRecording
CREATE TABLE IF NOT EXISTS "room_recordings" (
  source_id TEXT PRIMARY KEY,
  "room_id" TEXT NOT NULL REFERENCES "rooms"("source_id"),
  "host_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "title" TEXT NOT NULL,
  "recording_url" TEXT NOT NULL,
  "duration" INTEGER NOT NULL,
  "view_count" INTEGER NOT NULL,
  "status" TEXT NOT NULL CHECK ("status" IN ('PROCESSING', 'PUBLISHED', 'FAILED')),
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: Room
CREATE TABLE IF NOT EXISTS "rooms" (
  source_id TEXT PRIMARY KEY,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "type" TEXT NOT NULL CHECK ("type" IN ('VOICE', 'VIDEO')),
  "host_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "cover_image" TEXT,
  "category" TEXT NOT NULL,
  "tags" TEXT NOT NULL,
  "language" TEXT NOT NULL,
  "status" TEXT NOT NULL CHECK ("status" IN ('LIVE', 'ENDED', 'SCHEDULED')),
  "visibility" TEXT NOT NULL CHECK ("visibility" IN ('PUBLIC', 'PRIVATE')),
  "max_speakers" INTEGER NOT NULL,
  "participant_count" INTEGER NOT NULL,
  "speaker_ids" TEXT NOT NULL,
  "moderator_ids" TEXT NOT NULL,
  "room_admin_ids" TEXT NOT NULL,
  "active_pk_id" TEXT REFERENCES "pk_battles"("source_id"),
  "co_host_ids" TEXT NOT NULL,
  "is_duet" INTEGER NOT NULL,
  "livekit_room_name" TEXT NOT NULL,
  "allow_audience_mic_requests" INTEGER NOT NULL,
  "mic_locked" INTEGER NOT NULL,
  "locked_seat_indices" TEXT NOT NULL,
  "theme" TEXT,
  "vip_only" INTEGER NOT NULL,
  "badge" TEXT,
  "ambience" TEXT,
  "scheduled_for" TEXT,
  "started_at" TEXT,
  "ended_at" TEXT,
  "mode" TEXT CHECK ("mode" IN ('coffee_date', 'blind_date', 'truth_or_dare', 'never_have_i_ever', 'would_you_rather')),
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: Season.rewards
CREATE TABLE IF NOT EXISTS "season_rewards" (
  source_id TEXT PRIMARY KEY,
  "level" INTEGER NOT NULL,
  "free_reward" TEXT,
  "premium_reward" TEXT,
  "seasons_id" TEXT NOT NULL REFERENCES "seasons"("source_id"),
  position INTEGER NOT NULL CHECK (position >= 0)
);
CREATE INDEX IF NOT EXISTS "idx_season_rewards_parent" ON "season_rewards" ("seasons_id", position);

-- Season: rewards normalized into season_rewards (no JSON column on parent)
-- Model: Season
CREATE TABLE IF NOT EXISTS "seasons" (
  source_id TEXT PRIMARY KEY,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "start_date" TEXT NOT NULL,
  "end_date" TEXT NOT NULL,
  "max_level" INTEGER NOT NULL,
  "xp_per_level" INTEGER NOT NULL,
  "premium_price" INTEGER NOT NULL,
  "active" INTEGER NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: SpeakerRequest
CREATE TABLE IF NOT EXISTS "speaker_requests" (
  source_id TEXT PRIMARY KEY,
  "room_id" TEXT NOT NULL REFERENCES "rooms"("source_id"),
  "user_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "status" TEXT NOT NULL CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED')),
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Story: viewedBy normalized into story_views (no JSON column on parent)
-- Model: Story
CREATE TABLE IF NOT EXISTS "stories" (
  source_id TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "media_url" TEXT NOT NULL,
  "media_type" TEXT NOT NULL CHECK ("media_type" IN ('IMAGE', 'VIDEO', 'AUDIO')),
  "caption" TEXT,
  "background_color" TEXT,
  "text_color" TEXT,
  "font" TEXT,
  "sticker" TEXT,
  "link_url" TEXT,
  "duration" INTEGER CHECK ("duration" >= 1),
  "transcript" TEXT,
  "like_count" INTEGER NOT NULL,
  "reply_count" INTEGER NOT NULL,
  "expires_at" TEXT NOT NULL,
  "status" TEXT NOT NULL CHECK ("status" IN ('ACTIVE', 'EXPIRED', 'HIDDEN')),
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: StoryComment
CREATE TABLE IF NOT EXISTS "story_comments" (
  source_id TEXT PRIMARY KEY,
  "story_id" TEXT NOT NULL REFERENCES "stories"("source_id"),
  "user_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "parent_id" TEXT NOT NULL REFERENCES "story_comments"("source_id"),
  "text" TEXT NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: StoryHighlight
CREATE TABLE IF NOT EXISTS "story_highlights" (
  source_id TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "title" TEXT NOT NULL,
  "cover_media_url" TEXT,
  "story_ids" TEXT NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Story.viewedBy: source_id is <parent source_id>:<field>:<position>; primitive element stored in value
-- Model: Story.viewedBy
CREATE TABLE IF NOT EXISTS "story_views" (
  source_id TEXT PRIMARY KEY,
  "value" TEXT REFERENCES "users"("source_id"),
  "stories_id" TEXT NOT NULL REFERENCES "stories"("source_id"),
  position INTEGER NOT NULL CHECK (position >= 0)
);
CREATE INDEX IF NOT EXISTS "idx_story_views_parent" ON "story_views" ("stories_id", position);

-- Model: Subscription
CREATE TABLE IF NOT EXISTS "subscriptions" (
  source_id TEXT PRIMARY KEY,
  "subscriber_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "creator_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "plan" TEXT NOT NULL CHECK ("plan" IN ('MONTHLY', 'YEARLY')),
  "coin_amount" INTEGER NOT NULL,
  "active" INTEGER NOT NULL,
  "expires_at" TEXT NOT NULL,
  "provider" TEXT CHECK ("provider" IN ('GOOGLE_PLAY')),
  "provider_purchase_token" TEXT,
  "provider_order_id" TEXT,
  "auto_renewing" INTEGER NOT NULL,
  "status" TEXT NOT NULL CHECK ("status" IN ('ACTIVE', 'IN_GRACE_PERIOD', 'CANCELLED', 'EXPIRED', 'ON_HOLD', 'PENDING')),
  "last_verified_at" TEXT,
  "last_credited_expiry" TEXT,
  "creator_coin_amount" INTEGER NOT NULL,
  "platform_fee_coins" INTEGER NOT NULL,
  "renewal_count" INTEGER NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: SupportMessage
CREATE TABLE IF NOT EXISTS "support_messages" (
  source_id TEXT PRIMARY KEY,
  "ticket_id" TEXT NOT NULL REFERENCES "support_tickets"("source_id"),
  "sender_type" TEXT NOT NULL CHECK ("sender_type" IN ('USER', 'ADMIN', 'SYSTEM')),
  "sender_user_id" TEXT REFERENCES "users"("source_id"),
  "sender_admin_id" TEXT REFERENCES "admin_users"("source_id"),
  "message" TEXT NOT NULL,
  "attachments" TEXT NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- SupportTicket.messages: source_id is derived from element _id when present, otherwise <parent source_id>:<field>:<position>
-- Model: SupportTicket.messages
CREATE TABLE IF NOT EXISTS "support_ticket_messages" (
  source_id TEXT PRIMARY KEY,
  "sender_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "sender_role" TEXT NOT NULL CHECK ("sender_role" IN ('USER', 'ADMIN')),
  "message" TEXT NOT NULL,
  "created_at" TEXT NOT NULL,
  "support_tickets_id" TEXT NOT NULL REFERENCES "support_tickets"("source_id"),
  position INTEGER NOT NULL CHECK (position >= 0)
);
CREATE INDEX IF NOT EXISTS "idx_support_ticket_messages_parent" ON "support_ticket_messages" ("support_tickets_id", position);

-- SupportTicket: messages normalized into support_ticket_messages (no JSON column on parent)
-- Model: SupportTicket
CREATE TABLE IF NOT EXISTS "support_tickets" (
  source_id TEXT PRIMARY KEY,
  "user_id" TEXT REFERENCES "users"("source_id"),
  "requester_email" TEXT,
  "assigned_to" TEXT REFERENCES "admin_users"("source_id"),
  "category" TEXT NOT NULL CHECK ("category" IN ('General', 'Account', 'Payment', 'Technical', 'Report', 'Content', 'Other')),
  "subject" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" TEXT NOT NULL CHECK ("status" IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
  "priority" TEXT NOT NULL CHECK ("priority" IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  "last_message_at" TEXT,
  "closed_at" TEXT,
  "resolved_at" TEXT,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: TrustVerification
CREATE TABLE IF NOT EXISTS "trust_verifications" (
  source_id TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "status" TEXT NOT NULL CHECK ("status" IN ('NOT_STARTED', 'INCOMPLETE', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED', 'NEEDS_RETRY', 'SUSPENDED', 'EXPIRED')),
  "level" TEXT NOT NULL CHECK ("level" IN ('BASIC', 'ADVANCED')),
  "face_status" TEXT NOT NULL CHECK ("face_status" IN ('NOT_SUBMITTED', 'SUBMITTED', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED', 'NEEDS_RETRY')),
  "voice_status" TEXT NOT NULL CHECK ("voice_status" IN ('NOT_SUBMITTED', 'SUBMITTED', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED', 'NEEDS_RETRY')),
  "liveness_status" TEXT NOT NULL CHECK ("liveness_status" IN ('NOT_SUBMITTED', 'SUBMITTED', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED', 'NEEDS_RETRY')),
  "verification_score" INTEGER,
  "risk_score" INTEGER,
  "verified_badge_enabled" INTEGER NOT NULL,
  "creator_trust_enabled" INTEGER NOT NULL,
  "submitted_at" TEXT,
  "reviewed_at" TEXT,
  "verified_at" TEXT,
  "rejected_at" TEXT,
  "reviewed_by_admin_id" TEXT REFERENCES "admin_users"("source_id"),
  "rejection_reason" TEXT,
  "admin_notes" TEXT,
  "consent_version" TEXT,
  "consent_accepted_at" TEXT,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: User.badgeGrants
CREATE TABLE IF NOT EXISTS "user_badge_grants" (
  source_id TEXT PRIMARY KEY,
  "badge_id" TEXT NOT NULL,
  "tier" TEXT,
  "earned_at" TEXT NOT NULL,
  "expires_at" TEXT,
  "users_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  position INTEGER NOT NULL CHECK (position >= 0)
);
CREATE INDEX IF NOT EXISTS "idx_user_badge_grants_parent" ON "user_badge_grants" ("users_id", position);

-- User.claimedAchievementTiers: source_id is derived from element _id when present, otherwise <parent source_id>:<field>:<position>
-- Model: User.claimedAchievementTiers
CREATE TABLE IF NOT EXISTS "user_claimed_achievement_tiers" (
  source_id TEXT PRIMARY KEY,
  "achievement_id" TEXT NOT NULL,
  "tier" TEXT NOT NULL CHECK ("tier" IN ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM')),
  "claimed_at" TEXT NOT NULL,
  "users_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  position INTEGER NOT NULL CHECK (position >= 0)
);
CREATE INDEX IF NOT EXISTS "idx_user_claimed_achievement_tiers_parent" ON "user_claimed_achievement_tiers" ("users_id", position);

-- User.claimedAchievementIds: source_id is <parent source_id>:<field>:<position>; primitive element stored in value
-- Model: User.claimedAchievementIds
CREATE TABLE IF NOT EXISTS "user_claimed_achievements" (
  source_id TEXT PRIMARY KEY,
  "value" TEXT,
  "users_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  position INTEGER NOT NULL CHECK (position >= 0)
);
CREATE INDEX IF NOT EXISTS "idx_user_claimed_achievements_parent" ON "user_claimed_achievements" ("users_id", position);

-- Model: UserDailyAnswer
CREATE TABLE IF NOT EXISTS "user_daily_answers" (
  source_id TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "question_id" TEXT NOT NULL REFERENCES "daily_questions"("source_id"),
  "answer" TEXT NOT NULL,
  "is_public" INTEGER NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- User.hobbies: source_id is <parent source_id>:<field>:<position>; primitive element stored in value
-- Model: User.hobbies
CREATE TABLE IF NOT EXISTS "user_hobbies" (
  source_id TEXT PRIMARY KEY,
  "value" TEXT,
  "users_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  position INTEGER NOT NULL CHECK (position >= 0)
);
CREATE INDEX IF NOT EXISTS "idx_user_hobbies_parent" ON "user_hobbies" ("users_id", position);

-- User.interests: source_id is <parent source_id>:<field>:<position>; primitive element stored in value
-- Model: User.interests
CREATE TABLE IF NOT EXISTS "user_interests" (
  source_id TEXT PRIMARY KEY,
  "value" TEXT,
  "users_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  position INTEGER NOT NULL CHECK (position >= 0)
);
CREATE INDEX IF NOT EXISTS "idx_user_interests_parent" ON "user_interests" ("users_id", position);

-- User.languages: source_id is <parent source_id>:<field>:<position>; primitive element stored in value
-- Model: User.languages
CREATE TABLE IF NOT EXISTS "user_languages" (
  source_id TEXT PRIMARY KEY,
  "value" TEXT,
  "users_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  position INTEGER NOT NULL CHECK (position >= 0)
);
CREATE INDEX IF NOT EXISTS "idx_user_languages_parent" ON "user_languages" ("users_id", position);

-- Model: UserMission
CREATE TABLE IF NOT EXISTS "user_missions" (
  source_id TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "mission_id" TEXT NOT NULL REFERENCES "missions"("source_id"),
  "progress" INTEGER NOT NULL,
  "completed" INTEGER NOT NULL,
  "completed_at" TEXT,
  "claimed" INTEGER NOT NULL,
  "streak_day" INTEGER NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: UserMood
CREATE TABLE IF NOT EXISTS "user_moods" (
  source_id TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "mood" TEXT NOT NULL,
  "emoji" TEXT NOT NULL,
  "activity" TEXT NOT NULL,
  "activity_room_id" TEXT REFERENCES "rooms"("source_id"),
  "is_active" INTEGER NOT NULL,
  "expires_at" TEXT,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- User.ownedCosmeticIds: source_id is <parent source_id>:<field>:<position>; primitive element stored in value
-- Model: User.ownedCosmeticIds
CREATE TABLE IF NOT EXISTS "user_owned_cosmetics" (
  source_id TEXT PRIMARY KEY,
  "value" TEXT,
  "users_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  position INTEGER NOT NULL CHECK (position >= 0)
);
CREATE INDEX IF NOT EXISTS "idx_user_owned_cosmetics_parent" ON "user_owned_cosmetics" ("users_id", position);

-- User.ownedTitles: source_id is <parent source_id>:<field>:<position>; primitive element stored in value
-- Model: User.ownedTitles
CREATE TABLE IF NOT EXISTS "user_owned_titles" (
  source_id TEXT PRIMARY KEY,
  "value" TEXT,
  "users_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  position INTEGER NOT NULL CHECK (position >= 0)
);
CREATE INDEX IF NOT EXISTS "idx_user_owned_titles_parent" ON "user_owned_titles" ("users_id", position);

-- User.profileMedia: source_id is derived from element _id when present, otherwise <parent source_id>:<field>:<position>
-- Model: User.profileMedia
CREATE TABLE IF NOT EXISTS "user_profile_media" (
  source_id TEXT PRIMARY KEY,
  "url" TEXT NOT NULL,
  "type" TEXT NOT NULL CHECK ("type" IN ('IMAGE', 'VIDEO')),
  "caption" TEXT,
  "created_at" TEXT NOT NULL,
  "users_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  position INTEGER NOT NULL CHECK (position >= 0)
);
CREATE INDEX IF NOT EXISTS "idx_user_profile_media_parent" ON "user_profile_media" ("users_id", position);

-- Model: UserSafetyStatus
CREATE TABLE IF NOT EXISTS "user_safety_statuses" (
  source_id TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "trust_score" INTEGER NOT NULL CHECK ("trust_score" >= 0),
  "risk_level" TEXT NOT NULL CHECK ("risk_level" IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  "warning_count" INTEGER NOT NULL,
  "report_count" INTEGER NOT NULL,
  "suspension_count" INTEGER NOT NULL,
  "is_shadow_banned" INTEGER NOT NULL,
  "is_chat_restricted" INTEGER NOT NULL,
  "is_room_restricted" INTEGER NOT NULL,
  "is_wallet_frozen" INTEGER NOT NULL,
  "last_reviewed_by" TEXT REFERENCES "admin_users"("source_id"),
  "last_reviewed_at" TEXT,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- User.showcasedBadgeIds: source_id is <parent source_id>:<field>:<position>; primitive element stored in value
-- Model: User.showcasedBadgeIds
CREATE TABLE IF NOT EXISTS "user_showcased_badges" (
  source_id TEXT PRIMARY KEY,
  "value" TEXT,
  "users_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  position INTEGER NOT NULL CHECK (position >= 0)
);
CREATE INDEX IF NOT EXISTS "idx_user_showcased_badges_parent" ON "user_showcased_badges" ("users_id", position);

-- User: interests normalized into user_interests (no JSON column on parent)
-- User: hobbies normalized into user_hobbies (no JSON column on parent)
-- User: languages normalized into user_languages (no JSON column on parent)
-- User: ownedCosmeticIds normalized into user_owned_cosmetics (no JSON column on parent)
-- User: ownedTitles normalized into user_owned_titles (no JSON column on parent)
-- User: badgeGrants normalized into user_badge_grants (no JSON column on parent)
-- User: claimedAchievementIds normalized into user_claimed_achievements (no JSON column on parent)
-- User: claimedAchievementTiers normalized into user_claimed_achievement_tiers (no JSON column on parent)
-- User: showcasedBadgeIds normalized into user_showcased_badges (no JSON column on parent)
-- User: profileMedia normalized into user_profile_media (no JSON column on parent)
-- Model: User
CREATE TABLE IF NOT EXISTS "users" (
  source_id TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "firebase_uid" TEXT,
  "avatar" TEXT,
  "avatar_media_id" TEXT,
  "avatar_type" TEXT CHECK ("avatar_type" IN ('UPLOADED', 'GENERATED', 'DEFAULT')),
  "avatar_parts_background" INTEGER CHECK ("avatar_parts_background" >= 0),
  "avatar_parts_clothes" INTEGER CHECK ("avatar_parts_clothes" >= 0),
  "avatar_parts_head" INTEGER CHECK ("avatar_parts_head" >= 0),
  "avatar_parts_mouth" INTEGER CHECK ("avatar_parts_mouth" >= 0),
  "avatar_parts_eyes" INTEGER CHECK ("avatar_parts_eyes" >= 0),
  "avatar_parts_top" INTEGER CHECK ("avatar_parts_top" >= 0),
  "gender" TEXT,
  "age" INTEGER,
  "bond_version" INTEGER NOT NULL,
  "bond_invitations" INTEGER NOT NULL,
  "bond_notifications" INTEGER NOT NULL,
  "city" TEXT,
  "state" TEXT,
  "bio" TEXT,
  "vibe_line" TEXT,
  "clan_id" TEXT REFERENCES "clans"("source_id"),
  "role" TEXT NOT NULL CHECK ("role" IN ('USER', 'HOST', 'MODERATOR', 'ADMIN')),
  "is_verified" INTEGER NOT NULL,
  "email_verified" INTEGER NOT NULL,
  "is_blocked" INTEGER NOT NULL,
  "followers_count" INTEGER NOT NULL,
  "following_count" INTEGER NOT NULL,
  "wallet_balance" INTEGER NOT NULL,
  "diamond_balance" INTEGER NOT NULL CHECK ("diamond_balance" >= 0),
  "xp" INTEGER NOT NULL,
  "wealth_exp" INTEGER NOT NULL CHECK ("wealth_exp" >= 0),
  "charm_exp" INTEGER NOT NULL CHECK ("charm_exp" >= 0),
  "level" INTEGER NOT NULL,
  "level_title" TEXT NOT NULL,
  "last_daily_check_in_at" TEXT,
  "streak_count" INTEGER NOT NULL,
  "profile_completed_at" TEXT,
  "deletion_requested_at" TEXT,
  "terms_accepted_at" TEXT,
  "badge_revision" INTEGER,
  "active_cosmetics_avatar_asset" TEXT,
  "active_cosmetics_avatar_frame" TEXT,
  "active_cosmetics_speaking_wave" TEXT,
  "active_cosmetics_profile_theme" TEXT,
  "active_cosmetics_entrance_effect" TEXT,
  "active_cosmetics_profile_badge" TEXT,
  "active_cosmetics_name_style" TEXT,
  "active_cosmetics_room_entry" TEXT,
  "active_cosmetics_mood_status" TEXT,
  "active_cosmetics_profile_music" TEXT,
  "active_cosmetics_voice_badge" TEXT,
  "active_cosmetics_room_theme" TEXT,
  "active_cosmetics_avatar_decoration" TEXT,
  "active_cosmetics_reaction_pack" TEXT,
  "active_cosmetics_profile_layout" TEXT,
  "active_cosmetics_profile_banner" TEXT,
  "active_cosmetics_intro_card" TEXT,
  "active_cosmetics_collectible_title" TEXT,
  "active_cosmetics_gift_shelf" TEXT,
  "active_cosmetics_chat_bubble" TEXT,
  "active_cosmetics_seasonal_event" TEXT,
  "active_cosmetics_video_call_overlay" TEXT,
  "active_cosmetics_room_badge" TEXT,
  "active_cosmetics_room_ambience" TEXT,
  "vip_tier" TEXT,
  "vip_level" INTEGER NOT NULL CHECK ("vip_level" >= 0),
  "vip_exp" INTEGER NOT NULL,
  "vip_started_at" TEXT,
  "vip_expires_at" TEXT,
  "vip_frozen" INTEGER NOT NULL,
  "vip_freeze_started_at" TEXT,
  "mysterious_visitors" INTEGER NOT NULL,
  "vip_chat_privacy" TEXT NOT NULL CHECK ("vip_chat_privacy" IN ('EVERYONE', 'FOLLOWERS')),
  "moderation_strikes" INTEGER NOT NULL,
  "muted_until" TEXT,
  "suspended_until" TEXT,
  "moderation_reason" TEXT,
  "token_version" INTEGER NOT NULL,
  "notification_preferences_room_invites" INTEGER NOT NULL,
  "notification_preferences_messages" INTEGER NOT NULL,
  "notification_preferences_gifts" INTEGER NOT NULL,
  "notification_preferences_follows" INTEGER NOT NULL,
  "notification_preferences_host_going_live" INTEGER NOT NULL,
  "notification_preferences_wallet" INTEGER NOT NULL,
  "notification_preferences_safety" INTEGER NOT NULL,
  "notification_preferences_marketing" INTEGER NOT NULL,
  "interested_in" TEXT,
  "looking_for" TEXT,
  "dating_age_min" INTEGER,
  "dating_age_max" INTEGER,
  "dating_verified_only" INTEGER NOT NULL,
  "referral_code" TEXT,
  "referred_by" TEXT REFERENCES "users"("source_id"),
  "referral_rewards_claimed" INTEGER NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- VibeGraph.interests: source_id is <parent source_id>:<field>:<position>; primitive element stored in value
-- Model: VibeGraph.interests
CREATE TABLE IF NOT EXISTS "vibe_graph_interests" (
  source_id TEXT PRIMARY KEY,
  "value" TEXT,
  "vibe_graphs_id" TEXT NOT NULL REFERENCES "vibe_graphs"("source_id"),
  position INTEGER NOT NULL CHECK (position >= 0)
);
CREATE INDEX IF NOT EXISTS "idx_vibe_graph_interests_parent" ON "vibe_graph_interests" ("vibe_graphs_id", position);

-- VibeGraph.languages: source_id is <parent source_id>:<field>:<position>; primitive element stored in value
-- Model: VibeGraph.languages
CREATE TABLE IF NOT EXISTS "vibe_graph_languages" (
  source_id TEXT PRIMARY KEY,
  "value" TEXT,
  "vibe_graphs_id" TEXT NOT NULL REFERENCES "vibe_graphs"("source_id"),
  position INTEGER NOT NULL CHECK (position >= 0)
);
CREATE INDEX IF NOT EXISTS "idx_vibe_graph_languages_parent" ON "vibe_graph_languages" ("vibe_graphs_id", position);

-- VibeGraph: interests normalized into vibe_graph_interests (no JSON column on parent)
-- VibeGraph: languages normalized into vibe_graph_languages (no JSON column on parent)
-- Model: VibeGraph
CREATE TABLE IF NOT EXISTS "vibe_graphs" (
  source_id TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "city" TEXT NOT NULL,
  "vibe_score" INTEGER NOT NULL CHECK ("vibe_score" >= 0),
  "total_interactions" INTEGER NOT NULL,
  "last_vibe_update" TEXT NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- VoicePoll.ballots: source_id is derived from element _id when present, otherwise <parent source_id>:<field>:<position>
-- Model: VoicePoll.ballots
CREATE TABLE IF NOT EXISTS "voice_poll_ballots" (
  source_id TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "option_index" INTEGER NOT NULL,
  "voice_polls_id" TEXT NOT NULL REFERENCES "voice_polls"("source_id"),
  position INTEGER NOT NULL CHECK (position >= 0)
);
CREATE INDEX IF NOT EXISTS "idx_voice_poll_ballots_parent" ON "voice_poll_ballots" ("voice_polls_id", position);

-- VoicePoll.voters: source_id is <parent source_id>:<field>:<position>; primitive element stored in value
-- Model: VoicePoll.voters
CREATE TABLE IF NOT EXISTS "voice_poll_votes" (
  source_id TEXT PRIMARY KEY,
  "value" TEXT REFERENCES "users"("source_id"),
  "voice_polls_id" TEXT NOT NULL REFERENCES "voice_polls"("source_id"),
  position INTEGER NOT NULL CHECK (position >= 0)
);
CREATE INDEX IF NOT EXISTS "idx_voice_poll_votes_parent" ON "voice_poll_votes" ("voice_polls_id", position);

-- VoicePoll: voters normalized into voice_poll_votes (no JSON column on parent)
-- VoicePoll: ballots normalized into voice_poll_ballots (no JSON column on parent)
-- Model: VoicePoll
CREATE TABLE IF NOT EXISTS "voice_polls" (
  source_id TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "question" TEXT NOT NULL,
  "audio_url" TEXT NOT NULL,
  "duration" INTEGER NOT NULL,
  "options" TEXT NOT NULL,
  "is_active" INTEGER NOT NULL,
  "expires_at" TEXT,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: VoiceVerificationSubmission
CREATE TABLE IF NOT EXISTS "voice_verification_submissions" (
  source_id TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "verification_id" TEXT NOT NULL REFERENCES "trust_verifications"("source_id"),
  "audio_url" TEXT,
  "transcript_text" TEXT,
  "prompt_text" TEXT NOT NULL,
  "voice_liveness_score" INTEGER,
  "voice_match_score" INTEGER,
  "audio_quality_score" INTEGER,
  "provider" TEXT,
  "provider_reference_id" TEXT,
  "provider_response" TEXT,
  "status" TEXT NOT NULL CHECK ("status" IN ('SUBMITTED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'NEEDS_RETRY')),
  "failure_reason" TEXT,
  "reviewed_at" TEXT,
  "reviewed_by_admin_id" TEXT REFERENCES "admin_users"("source_id"),
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: WalletTransaction
CREATE TABLE IF NOT EXISTS "wallet_transactions" (
  source_id TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "type" TEXT NOT NULL CHECK ("type" IN ('CREDIT', 'DEBIT')),
  "source" TEXT NOT NULL CHECK ("source" IN ('BOND_HOLD', 'BOND_RELEASE', 'RECHARGE', 'GIFT_SENT', 'GIFT_RECEIVED', 'GIFT_SENT_DM', 'GIFT_RECEIVED_DM', 'VIP_PURCHASE', 'PROFILE_COSMETIC_PURCHASE', 'COSMETIC_BUNDLE_PURCHASE', 'COSMETIC_GIFT_SENT', 'COSMETIC_GIFT_RECEIVED', 'LEVEL_REWARD', 'STREAK_BONUS', 'DAILY_REWARD', 'ADMIN_ADJUSTMENT', 'RAZORPAY_PURCHASE', 'GOOGLE_PLAY_PURCHASE', 'PAYMENT_REFUND', 'REFERRAL_BONUS', 'STORY_REWARD', 'SUBSCRIPTION', 'SURPRISE_BOX', 'GIFT_UPGRADE', 'GIFT_PURCHASE', 'BATTLE_PASS_PURCHASE', 'BATTLE_PASS_REWARD', 'MISSION_REWARD')),
  "amount" INTEGER NOT NULL CHECK ("amount" >= 1),
  "balance_before" INTEGER NOT NULL,
  "balance_after" INTEGER NOT NULL,
  "metadata" TEXT NOT NULL,
  "purchase_token" TEXT,
  "product_id" TEXT,
  "platform" TEXT,
  "verification_status" TEXT,
  "credited_at" TEXT,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: WatchParty
CREATE TABLE IF NOT EXISTS "watch_parties" (
  source_id TEXT PRIMARY KEY,
  "room_id" TEXT NOT NULL REFERENCES "rooms"("source_id"),
  "host_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "title" TEXT NOT NULL,
  "media_url" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "is_playing" INTEGER NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: WaveNudge
CREATE TABLE IF NOT EXISTS "wave_nudges" (
  source_id TEXT PRIMARY KEY,
  "sender_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "receiver_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "type" TEXT NOT NULL CHECK ("type" IN ('wave', 'nudge', 'vibe_ping')),
  "read" INTEGER NOT NULL,
  "room_id" TEXT REFERENCES "rooms"("source_id"),
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: WishlistItem
CREATE TABLE IF NOT EXISTS "wishlist_items" (
  source_id TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "gift_id" TEXT NOT NULL REFERENCES "gifts"("source_id"),
  "message" TEXT,
  "is_public" INTEGER NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: WithdrawalRequest
CREATE TABLE IF NOT EXISTS "withdrawal_requests" (
  source_id TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "amount_coins" INTEGER NOT NULL CHECK ("amount_coins" >= 1),
  "amount_inr" INTEGER CHECK ("amount_inr" >= 0),
  "status" TEXT NOT NULL CHECK ("status" IN ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'PAID', 'CANCELLED', 'BLOCKED')),
  "active_lock" INTEGER NOT NULL,
  "locked_at" TEXT,
  "approved_at" TEXT,
  "rejected_at" TEXT,
  "paid_at" TEXT,
  "reviewed_by_admin_id" TEXT REFERENCES "admin_users"("source_id"),
  "rejection_reason" TEXT,
  "payout_reference" TEXT,
  "metadata" TEXT NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: XpDailyCap
CREATE TABLE IF NOT EXISTS "xp_daily_caps" (
  source_id TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "day" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Model: XpGrant
CREATE TABLE IF NOT EXISTS "xp_grants" (
  source_id TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("source_id"),
  "event" TEXT NOT NULL,
  "action_key" TEXT NOT NULL,
  "status" TEXT NOT NULL CHECK ("status" IN ('PROCESSING', 'COMPLETE')),
  "requested_xp" INTEGER NOT NULL,
  "receipt" TEXT,
  "created_at" TEXT,
  "updated_at" TEXT
);

-- Review warnings:
-- Achievement.imageData: binary field stored as TEXT; migration must replace with R2 bucket/key reference
-- AdminAuditLog.metadata: Mixed stored as JSON TEXT; normalize if the field is queried or joined
-- AdminModerationAction.metadata: Mixed stored as JSON TEXT; normalize if the field is queried or joined
-- AppConfig.value: Mixed stored as JSON TEXT; normalize if the field is queried or joined
-- Bond.milestoneDays: array stored as JSON TEXT; child-table candidate per mapping spec
-- Bond.preferences: Map stored as JSON TEXT
-- BondRankingSnapshot.entries: array stored as JSON TEXT; child-table candidate per mapping spec
-- Clan.memberIds: array stored as JSON TEXT; child-table candidate per mapping spec
-- Clan.memberRoles: array stored as JSON TEXT; child-table candidate per mapping spec
-- CreatorPayoutKyc.metadata: Mixed stored as JSON TEXT; normalize if the field is queried or joined
-- DiamondTransaction.metadata: Mixed stored as JSON TEXT; normalize if the field is queried or joined
-- DirectMessage.replyTo: embedded document stored as JSON TEXT; child-table candidate per mapping spec
-- Event.tags: array stored as JSON TEXT; child-table candidate per mapping spec
-- FaceVerificationSubmission.providerResponse: Mixed stored as JSON TEXT; normalize if the field is queried or joined
-- Gift.upgradePath: array stored as JSON TEXT; child-table candidate per mapping spec
-- GiftTransaction.metadata: Mixed stored as JSON TEXT; normalize if the field is queried or joined
-- ImmersiveTheme.colors: array stored as JSON TEXT; child-table candidate per mapping spec
-- ImmersiveTheme.animation: Mixed stored as JSON TEXT; normalize if the field is queried or joined
-- MiniGameScore.metadata: Mixed stored as JSON TEXT; normalize if the field is queried or joined
-- Notification.data: Mixed stored as JSON TEXT; normalize if the field is queried or joined
-- NotificationCampaign.filters: Mixed stored as JSON TEXT; normalize if the field is queried or joined
-- PayoutReview.riskFlags: Mixed stored as JSON TEXT; normalize if the field is queried or joined
-- PayoutReview.payout: embedded document stored as JSON TEXT; child-table candidate per mapping spec
-- PkEvent.metadata: Mixed stored as JSON TEXT; normalize if the field is queried or joined
-- Poll.options: array stored as JSON TEXT; child-table candidate per mapping spec
-- Purchase.metadata: Mixed stored as JSON TEXT; normalize if the field is queried or joined
-- Report.evidence: Mixed stored as JSON TEXT; normalize if the field is queried or joined
-- Room.tags: array stored as JSON TEXT; child-table candidate per mapping spec
-- Room.speakerIds: array stored as JSON TEXT; child-table candidate per mapping spec
-- Room.moderatorIds: array stored as JSON TEXT; child-table candidate per mapping spec
-- Room.roomAdminIds: array stored as JSON TEXT; child-table candidate per mapping spec
-- Room.coHostIds: array stored as JSON TEXT; child-table candidate per mapping spec
-- Room.lockedSeatIndices: array stored as JSON TEXT; child-table candidate per mapping spec
-- RoomActivity.metadata: Mixed stored as JSON TEXT; normalize if the field is queried or joined
-- RoomModeState.scores: Map stored as JSON TEXT
-- RoomModeState.currentOptions: array stored as JSON TEXT; child-table candidate per mapping spec
-- RoomModeState.metadata: Mixed stored as JSON TEXT; normalize if the field is queried or joined
-- Season.rewards.freeReward: Mixed stored as JSON TEXT; normalize if the field is queried or joined
-- Season.rewards.premiumReward: Mixed stored as JSON TEXT; normalize if the field is queried or joined
-- StoryHighlight.storyIds: array stored as JSON TEXT; child-table candidate per mapping spec
-- SupportMessage.attachments: Mixed stored as JSON TEXT; normalize if the field is queried or joined
-- VoicePoll.options: array stored as JSON TEXT; child-table candidate per mapping spec
-- VoiceVerificationSubmission.providerResponse: Mixed stored as JSON TEXT; normalize if the field is queried or joined
-- WalletTransaction.metadata: Mixed stored as JSON TEXT; normalize if the field is queried or joined
-- WithdrawalRequest.metadata: Mixed stored as JSON TEXT; normalize if the field is queried or joined
-- XpGrant.receipt: Mixed stored as JSON TEXT; normalize if the field is queried or joined
