package com.yugm.app.core.model

data class LevelStatus(
    val level: Int = 1,
    val title: String = "New Vibe",
    val xp: Int = 0,
    val progress: Float = 0f,
    val progressXp: Int = 0,
    val requiredXp: Int = 100,
    val nextLevel: Int? = 2,
    val canDailyCheckIn: Boolean = false,
    val dailyCheckInXp: Int = 25,
    val currentLevelXp: Int = 0,
    val nextLevelXp: Int? = null
)

data class VipStatus(
    val isVip: Boolean = false,
    val vipTier: String = "",
    val vipLevel: Int = 0,
    val vipExp: Int = 0,
    val vipExpRequired: Int = 1000,
    val nextVipExpRequired: Int? = 1000,
    val vipStartedAt: String = "",
    val vipExpiresAt: String = "",
    val daysRemaining: Int = 0,
    val frozen: Boolean = false,
    val freezeDaysRemaining: Int = 0
)

data class VipPrivacySettings(
    val mysteriousVisitors: Boolean = false,
    val chatPrivacy: String = "EVERYONE"
)

data class ProfileCheck(
    val id: String = "",
    val label: String = "",
    val done: Boolean = false
)

data class ProfileCompletion(
    val checks: List<ProfileCheck> = emptyList(),
    val completed: Int = 0,
    val total: Int = 0,
    val percent: Int = 0
)

data class Achievement(
    val id: String = "",
    val title: String = "",
    val description: String = "",
    val target: Int = 0,
    val rewardCoins: Int = 0,
    val rewardCosmetic: String = "",
    val progress: Int = 0,
    val complete: Boolean = false,
    val category: String = "",
    val icon: String = "🏅",
    val currentTier: String? = null,
    val highestClaimedTier: String? = null,
    val tiers: List<AchievementTier> = emptyList(),
    val nextTier: String? = null,
    val canClaim: Boolean = false,
    val canUpgrade: Boolean = false,
    val badgeKind: String = "ACHIEVEMENT",
    val imageUrl: String = "",
    val earnedBadgeTier: String? = null,
    val badgeUnlocked: Boolean = false,
    val expiresAt: String? = null,
    val weeklyTarget: Int = 0
)

data class BadgeGallery(
    val name: String = "",
    val avatar: String = "",
    val avatarType: String? = null,
    val avatarParts: AvatarPartsPayload? = null,
    val capacity: Int = FALLBACK_CAPACITY,
    val wornIds: List<String> = emptyList(),
    val badges: List<Achievement> = emptyList()
) {
    companion object {
        /** Used only when an older API omits the server-sourced capacity. */
        const val FALLBACK_CAPACITY = 5
    }
}

data class AchievementTier(
    val tier: String = "BRONZE",
    val target: Int = 0,
    val rewardCoins: Int = 0,
    val rewardCosmetic: String = "",
    val reached: Boolean = false,
    val claimed: Boolean = false
)

data class CosmeticBundle(
    val id: String = "",
    val title: String = "",
    val description: String = "",
    val coinPrice: Int = 0,
    val cosmeticIds: List<String> = emptyList()
)

data class DailyCheckInResult(
    val streak: Int = 0,
    val claimed: Boolean = false,
    val unlockedCosmetic: String = "",
    val xpAwarded: Int = 0,
    val streakBonus: Int = 0,
    val levelUpReward: Int = 0,
    val levelsGained: List<Int> = emptyList(),
    val alreadyClaimed: Boolean = false,
    val balance: Int? = null,
    val level: LevelStatus = LevelStatus(),
    val xpGrant: XpGrantReceipt? = null
)

data class XpGrantReceipt(
    val event: String = "",
    val xpAwarded: Int = 0,
    val capped: Boolean = false,
    val cap: Int? = null,
    val earnedToday: Int? = null,
    val remainingToday: Int? = null,
    val levelUpReward: Int = 0,
    val levelsGained: List<Int> = emptyList(),
    val level: LevelStatus = LevelStatus()
)

data class ClaimAchievementResult(
    val claimed: Boolean = false,
    val rewardCoins: Int = 0,
    val rewardCosmetic: String = "",
    val tier: String = ""
)

data class ProfileCosmetic(
    val id: String = "",
    val type: String = "",
    val name: String = "",
    val coinPrice: Int = 0,
    val rarity: String = "",
    val preview: String = "",
    val assetUrl: String = ""
)

data class CosmeticCatalog(
    val cosmetics: List<ProfileCosmetic> = emptyList(),
    val ownedCosmeticIds: List<String> = emptyList(),
    val activeCosmetics: ActiveCosmetics = ActiveCosmetics()
)

data class WalletOverview(
    val balance: Int = 0,
    val diamondBalance: Int = 0,
    val vip: VipStatus = VipStatus(),
    val level: LevelStatus = LevelStatus(),
    val cosmetics: CosmeticCatalog = CosmeticCatalog(),
    val dailyReward: DailyRewardStatus = DailyRewardStatus()
)

data class WalletProgressResult(
    val balance: Int = 0,
    val vip: VipStatus = VipStatus(),
    val level: LevelStatus = LevelStatus()
)

data class TrustVerificationStatus(
    val status: String = "NOT_STARTED",
    val level: String = "BASIC",
    val faceStatus: String = "NOT_SUBMITTED",
    val voiceStatus: String = "NOT_SUBMITTED",
    val livenessStatus: String = "NOT_SUBMITTED",
    val verifiedBadgeEnabled: Boolean = false,
    val creatorTrustEnabled: Boolean = false,
    val rejectionReason: String? = null
)

data class InventoryCosmetic(
    val id: String = "",
    val type: String = "",
    val name: String = "",
    val coinPrice: Int = 0,
    val rarity: String = "COMMON",
    val preview: String = "",
    val assetUrl: String = "",
    val isEquipped: Boolean = false
)

data class InventoryBadge(
    val achievementId: String = "",
    val tier: String = "BRONZE",
    val title: String = "",
    val description: String = "",
    val icon: String = "🏅",
    val claimedAt: String = ""
)

data class InventorySummary(
    val totalCosmetics: Int = 0,
    val equippedCosmetics: Int = 0,
    val totalGifts: Int = 0,
    val totalBadges: Int = 0,
    val walletBalance: Int = 0
)

data class UserFullInventory(
    val cosmetics: List<InventoryCosmetic> = emptyList(),
    val activeCosmetics: ActiveCosmetics = ActiveCosmetics(),
    val gifts: List<InventoryItem> = emptyList(),
    val badges: List<InventoryBadge> = emptyList(),
    val summary: InventorySummary = InventorySummary()
)

data class LevelMilestoneInfo(
    val level: Int = 1,
    val requiredXp: Int = 0,
    val title: String = "New Vibe",
    val coinReward: Int = 0
)

data class XpEventInfo(
    val key: String = "",
    val name: String = "",
    val xp: Int = 0,
    val icon: String = "⭐",
    val category: String = "",
    val cap: Int? = null,
    val earnedToday: Int = 0
)

data class StreakMilestoneInfo(
    val streakDays: Int = 0,
    val rewardCoins: Int = 0,
    val cosmeticId: String = "",
    val reached: Boolean = false
)

data class LevelOverview(
    val level: LevelStatus = LevelStatus(),
    val wealthLevel: ProgressionTrackStatus = ProgressionTrackStatus(),
    val charmLevel: ProgressionTrackStatus = ProgressionTrackStatus(),
    val streak: Int = 0,
    val canCheckIn: Boolean = false,
    val nextMilestone: Int? = null,
    val nextMilestoneReward: Int = 0,
    val streakMilestones: List<StreakMilestoneInfo> = emptyList(),
    val milestones: List<LevelMilestoneInfo> = emptyList(),
    val xpEvents: List<XpEventInfo> = emptyList(),
    val leaderboard: List<Host> = emptyList(),
    val leaderboardRank: Int? = null,
    val todayXpEarned: Int = 0,
    val todayXpCap: Int = 0
)

data class ProgressionTrackStatus(
    val level: Int = 0,
    val exp: Int = 0,
    val currentLevelExp: Int = 0,
    val nextLevel: Int = 1,
    val nextLevelExp: Int = 500,
    val requiredExp: Int = 500,
    val progress: Float = 0f
)

data class LevelLeaderboardEntry(
    val rank: Int = 0,
    val user: Host = Host()
)

data class LevelLeaderboardPage(
    val entries: List<LevelLeaderboardEntry> = emptyList(),
    val page: Int = 1,
    val pageSize: Int = 25,
    val total: Int = 0,
    val requesterId: String = "",
    val requesterRank: Int? = null
) {
    val hasMore: Boolean get() = page * pageSize < total
}
