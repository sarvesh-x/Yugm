package com.yugm.app.core.model

data class Host(
    val id: String = "",
    val name: String = "",
    val username: String = "",
    val city: String = "",
    val vibe: String = "",
    val vibeLine: String = "",
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
    val isFollowing: Boolean = false,
    val age: Int = 0,
    val gender: String = "",
    val vibeScore: Int = 0,
    val interestedIn: String = "",
    val lookingFor: String = "",
    val languages: List<String> = emptyList(),
    val interests: List<String> = emptyList(),
    val isOnline: Boolean = false
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
    val seasonalEvent: String = "",
    val videoCallOverlay: String = "",
    val roomBadge: String = "",
    val roomAmbience: String = ""
)

data class YugmUser(
    val id: String = "",
    val name: String = "",
    val username: String = "",
    val profileCompleted: Boolean = false,
    val emailVerified: Boolean = false,
    val walletBalance: Int = 0,
    val isVip: Boolean = false,
    val vipTier: String = "",
    val level: Int = 1,
    val levelTitle: String = "New Vibe",
    val xp: Int = 0,
    val levelStatus: LevelStatus = LevelStatus(),
    val activeCosmetics: ActiveCosmetics = ActiveCosmetics()
)

data class Session(
    val token: String,
    val user: YugmUser,
    val isNewUser: Boolean = false,
    val refreshToken: String = "",
    val sessionId: String = "",
    val expiresIn: Long = 2700
)

data class RefreshedSession(val accessToken: String, val refreshToken: String, val sessionId: String, val expiresIn: Long)

data class MediaSession(val token: String, val url: String, val roomName: String, val role: String)
