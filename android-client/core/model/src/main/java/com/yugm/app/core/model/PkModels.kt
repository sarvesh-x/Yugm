package com.yugm.app.core.model

enum class PkStatus { INVITED, WAITING, PREPARING, READY, COUNTDOWN, ACTIVE, FINAL_CRUNCH, FINALIZING, COMPLETED, CLOSED, ABORTED, ENDED, CANCELLED, DECLINED, EXPIRED, FORCE_ENDED }
enum class PkMode { GIFT, VOTE, REACTION, MIXED }
enum class PkFormat { PLAYER, TEAM, ROOM, LIVESTREAM }
enum class PkBattleType { VOICE, VIDEO }
enum class PkSideType { LEFT, RIGHT, DRAW }

data class PkSide(
    val roomId: String = "",
    val roomTitle: String = "",
    val hostId: String = "",
    val hostName: String = "",
    val hostAvatar: String? = null,
    val hostAvatarType: String? = null,
    val hostAvatarParts: AvatarPartsPayload? = null,
    val score: Int = 0,
    val participantCount: Int = 0,
    val activeCosmetics: ActiveCosmetics = ActiveCosmetics(),
    val members: List<PkTeamMember> = emptyList()
)

data class PkTeamMember(
    val userId: String = "",
    val name: String = "",
    val avatar: String? = null,
    val avatarType: String? = null,
    val avatarParts: AvatarPartsPayload? = null,
    val isReady: Boolean = false,
    val team: String = "A"
)

data class PkBattle(
    val id: String = "",
    val battleCode: String = "",
    val title: String = "",
    val status: PkStatus = PkStatus.INVITED,
    val mode: PkMode = PkMode.GIFT,
    val format: PkFormat = PkFormat.ROOM,
    val scope: String = "CROSS_ROOM",
    val teamSize: Int = 1,
    val selectedGiftId: String = "",
    val myVote: PkSideType? = null,
    val myReady: Boolean = false,
    val stateVersion: Int = 1,
    val countdownSecondsRemaining: Int = 0,
    val battleType: PkBattleType = PkBattleType.VOICE,
    val durationSeconds: Int = 180,
    val remainingSeconds: Int = 180,
    val left: PkSide = PkSide(),
    val right: PkSide = PkSide(),
    val leader: PkSideType? = null,
    val winnerSide: PkSideType? = null,
    val terminationReason: String = ""
)

data class PkStats(
    val played: Int = 0,
    val wins: Int = 0,
    val losses: Int = 0,
    val draws: Int = 0,
    val totalScore: Int = 0,
    val bestBattle: Int = 0,
    val bestStreak: Int = 0,
    val winRate: Int = 0
)

data class PkMediaSession(
    val token: String = "",
    val url: String = "",
    val roomId: String = "",
    val roomName: String = "",
    val title: String = "",
    val role: String = ""
)

data class PkLiveEffect(
    val label: String = "",
    val side: PkSideType = PkSideType.LEFT,
    val points: Int = 0,
    val combo: Int = 0
)

data class PkInvite(
    val id: String = "",
    val battleId: String = "",
    val status: String = "PENDING",
    val expiresAt: String = ""
)

data class PkOpponent(
    val roomId: String = "",
    val roomTitle: String = "",
    val hostId: String = "",
    val hostName: String = "",
    val hostAvatar: String? = null,
    val hostAvatarType: String? = null,
    val hostAvatarParts: AvatarPartsPayload? = null,
    val battleType: PkBattleType = PkBattleType.VOICE,
    val category: String = "",
    val language: String = "",
    val participantCount: Int = 0,
    val activeCosmetics: ActiveCosmetics = ActiveCosmetics()
)

data class PkLeaderboardEntry(
    val userId: String = "",
    val name: String = "",
    val avatar: String? = null,
    val avatarType: String? = null,
    val avatarParts: AvatarPartsPayload? = null,
    val side: PkSideType = PkSideType.LEFT,
    val totalPoints: Int = 0,
    val totalGiftsSent: Int = 0
)
