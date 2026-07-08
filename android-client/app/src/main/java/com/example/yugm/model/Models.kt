package com.example.yugm.model

import androidx.compose.ui.graphics.Color

data class Host(
    val id: String = "",
    val name: String = "",
    val username: String = "",
    val city: String = "",
    val vibe: String = "",
    val followers: Int = 0,
    val followingCount: Int = 0,
    val bio: String = "",
    val avatar: String? = null,
    val isVip: Boolean = false,
    val vipTier: String = "",
    val level: Int = 1,
    val levelTitle: String = "New Vibe",
    val xp: Int = 0,
    val levelStatus: LevelStatus = LevelStatus(),
    val activeCosmetics: ActiveCosmetics = ActiveCosmetics(),
    val isFollowing: Boolean = false
)

data class ActiveCosmetics(
    val avatarAsset: String = "",
    val avatarFrame: String = "",
    val speakingWave: String = "",
    val profileTheme: String = "",
    val entranceEffect: String = "",
    val profileBadge: String = "",
    val nameStyle: String = "",
    val roomEntry: String = "",
    val moodStatus: String = "",
    val profileMusic: String = "",
    val voiceBadge: String = "",
    val roomTheme: String = "",
    val avatarDecoration: String = "",
    val reactionPack: String = "",
    val profileLayout: String = "",
    val introCard: String = "",
    val collectibleTitle: String = "",
    val giftShelf: String = "",
    val chatBubble: String = "",
    val seasonalEvent: String = ""
)

data class Room(
    val id: String = "",
    val title: String = "",
    val description: String = "",
    val type: RoomType = RoomType.Voice,
    val host: Host? = null,
    val category: String = "",
    val language: String = "",
    val tags: List<String> = emptyList(),
    val participants: Int = 0,
    val maxSpeakers: Int = 6,
    val gradient: List<Color> = emptyList()
)

enum class RoomType { Voice, Video }

data class ChatMessage(val author: String, val text: String)

data class GiftItem(val id: String, val name: String, val price: Int)

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

data class VipPlan(
    val id: String = "",
    val name: String = "",
    val durationDays: Int = 0,
    val coinPrice: Int = 0,
    val benefits: List<String> = emptyList()
)

data class CoinPack(
    val id: String = "",
    val coinAmount: Int = 0,
    val priceInr: Int = 0,
    val googleProductId: String = ""
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

data class DailyCheckInResult(
    val alreadyClaimed: Boolean = false,
    val xpAwarded: Int = 0,
    val levelUpReward: Int = 0,
    val level: LevelStatus = LevelStatus(),
    val balance: Int = 0
)

data class RelationshipStatus(
    val level: Int = 1,
    val title: String = "First Spark",
    val xp: Int = 0,
    val progress: Float = 0f,
    val progressXp: Int = 0,
    val requiredXp: Int = 50,
    val nextLevel: Int? = 2,
    val nextPerk: String = "",
    val streakDays: Int = 0
)

data class DirectMessage(
    val id: String = "",
    val senderId: String = "",
    val receiverId: String = "",
    val message: String = "",
    val createdAt: String = ""
)

data class Conversation(
    val messages: List<DirectMessage> = emptyList(),
    val relationship: RelationshipStatus? = null
)

data class YugmUser(
    val id: String = "",
    val name: String = "",
    val username: String = "",
    val walletBalance: Int = 0,
    val isVip: Boolean = false,
    val vipTier: String = "",
    val level: Int = 1,
    val levelTitle: String = "New Vibe",
    val xp: Int = 0,
    val levelStatus: LevelStatus = LevelStatus(),
    val activeCosmetics: ActiveCosmetics = ActiveCosmetics()
)

data class Session(val token: String, val user: YugmUser)

data class MediaSession(val token: String, val url: String, val roomName: String, val role: String)

data class WalletTransaction(
    val type: String = "",
    val amount: Int = 0,
    val description: String = "",
    val balanceAfter: Int = 0,
    val createdAt: String = ""
)

data class NotificationItem(
    val id: String,
    val type: String,
    val message: String,
    val actorName: String,
    val actorId: String = "",
    val roomId: String = "",
    val read: Boolean = false,
    val createdAt: String = ""
)
