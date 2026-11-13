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
    val dailyCheckInXp: Int = 25
)

data class VipStatus(
    val isVip: Boolean = false,
    val vipTier: String = "",
    val vipStartedAt: String = "",
    val vipExpiresAt: String = ""
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
    val complete: Boolean = false
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
    val unlockedCosmetic: String = ""
)

data class ClaimAchievementResult(
    val claimed: Boolean = false,
    val rewardCoins: Int = 0,
    val rewardCosmetic: String = ""
)

data class ProfileCosmetic(
    val id: String = "",
    val type: String = "",
    val name: String = "",
    val coinPrice: Int = 0,
    val rarity: String = ""
)

data class CosmeticCatalog(
    val cosmetics: List<ProfileCosmetic> = emptyList(),
    val ownedCosmeticIds: List<String> = emptyList(),
    val activeCosmetics: ActiveCosmetics = ActiveCosmetics()
)

data class WalletOverview(
    val balance: Int = 0,
    val vip: VipStatus = VipStatus(),
    val level: LevelStatus = LevelStatus(),
    val cosmetics: CosmeticCatalog = CosmeticCatalog()
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
