package com.yugm.app.core.api

/**
 * This file is deprecated. Parser functions have been split into per-feature files
 * under the [com.yugm.app.core.api.parsers] package:
 *
 * - UtilityParser.kt    — entityId(), toBooleanMap()
 * - RoomParser.kt       — toRoom(), toHost(), toRooms(), toHosts(), toRoomDetail(),
 *                          toRoomParticipant(), toSpeakerRequest(), toRoomPoll(),
 *                          toRoomMission(), toRoomActivityItem(), roomGradient()
 * - ProfileParser.kt    — toUser(), toLevelStatus(), toVipStatus(), toActiveCosmetics(),
 *                          toCosmeticCatalog(), toRelationshipStatus(), toProfileCompletion(),
 *                          toAchievement(), toTrustVerificationStatus(), toCreatorPayoutKycStatus(),
 *                          toCreatorEarningBalance(), toCreatorDashboard()
 * - WalletParser.kt     — toWalletOverview(), toWalletTransactions(), toVipPlans(), toCoinPacks()
 * - ChatParser.kt       — toDirectMessage(), toDirectMessages()
 * - PkParser.kt         — toPkStatus(), toPkMode(), toPkBattleType(), toPkSideTypeOrNull(),
 *                          toPkSide(), toPkBattle(), toPkStats(), toPkMediaSession(),
 *                          toPkInvite(), toPkOpponent(), toPkLeaderboardEntry()
 * - SocialParser.kt     — toClan(), toClanMessage(), toClanReaction(), toClanSummary(),
 *                          toNotificationItems()
 * - GameParser.kt       — toGameCatalog(), toMiniGame(), toMiniGameScore(), toGameMissions(),
 *                          toGameLeaderboard(), toGameChallenges(), toMiniGameChallenge(),
 *                          toSavedGameScoreResult(), toGameReward()
 * - DiscoveryParser.kt  — toExperienceFeedItem(), toExperienceFeedItems(), toExperienceHome()
 */
