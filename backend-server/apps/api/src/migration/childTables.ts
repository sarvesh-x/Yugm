/**
 * Arrays normalized into child tables where the mapping spec requires joins,
 * ownership checks or stable per-element identities. Shared by the schema
 * generator and the delta-sync impact audit so the two cannot drift.
 */
export const CHILD_TABLES: Record<string, Record<string, string>> = {
  User: {
    interests: "user_interests",
    hobbies: "user_hobbies",
    languages: "user_languages",
    ownedCosmeticIds: "user_owned_cosmetics",
    ownedTitles: "user_owned_titles",
    badgeGrants: "user_badge_grants",
    claimedAchievementIds: "user_claimed_achievements",
    claimedAchievementTiers: "user_claimed_achievement_tiers",
    showcasedBadgeIds: "user_showcased_badges",
    profileMedia: "user_profile_media"
  },
  AdminUser: { permissions: "admin_role_permissions" },
  Achievement: { tiers: "achievement_tiers" },
  AssetObject: { variants: "asset_variants" },
  MediaObject: { variants: "media_variants" },
  BattlePass: { rewards: "battle_pass_rewards" },
  Season: { rewards: "season_rewards" },
  VibeGraph: { interests: "vibe_graph_interests", languages: "vibe_graph_languages" },
  GiftCollection: { gifts: "gift_collection_items" },
  ClanMessage: { reactions: "clan_message_reactions" },
  DirectMessage: { reactions: "direct_message_reactions", hiddenFor: "message_hidden_for" },
  GroupChat: { participantIds: "conversation_participants" },
  Poll: { voters: "poll_votes", options: "poll_options" },
  VoicePoll: { voters: "voice_poll_votes", ballots: "voice_poll_ballots", options: "voice_poll_options" },
  SupportTicket: { messages: "support_ticket_messages" },
  Event: { participantIds: "event_participants" },
  Story: { viewedBy: "story_views" },
  Bond: { users: "bond_users", slots: "bond_slots", milestoneDays: "bond_milestones", preferences: "bond_preferences" },
  Match: { users: "match_users" },
  Relationship: { users: "relationship_users" },
  RoomModeState: { participants: "room_mode_participants", scores: "room_mode_scores" },
  BondRankingSnapshot: { entries: "bond_ranking_entries" },
  Clan: { memberIds: "clan_members", memberRoles: "clan_member_roles" },
  Gift: { upgradePath: "gift_upgrade_paths" },
  Room: {
    speakerIds: "room_speakers",
    moderatorIds: "room_moderators",
    roomAdminIds: "room_admins",
    coHostIds: "room_cohosts",
    lockedSeatIndices: "room_locked_seats"
  },
  StoryHighlight: { storyIds: "story_highlight_stories" }
};
