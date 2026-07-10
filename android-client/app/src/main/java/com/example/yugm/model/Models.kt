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

data class RoomParticipant(
    val id: String = "",
    val user: Host = Host(),
    val role: String = "AUDIENCE",
    val micEnabled: Boolean = true,
    val cameraEnabled: Boolean = false
)

data class SpeakerRequest(
    val id: String = "",
    val user: Host = Host()
)

data class RoomDetail(
    val room: Room = Room(),
    val participants: List<RoomParticipant> = emptyList(),
    val speakerRequests: List<SpeakerRequest> = emptyList()
)

data class PollOption(
    val text: String = "",
    val votes: Int = 0
)

data class RoomPoll(
    val id: String = "",
    val question: String = "",
    val options: List<PollOption> = emptyList(),
    val isActive: Boolean = true
)

data class RoomMission(
    val id: String = "",
    val title: String = "",
    val progress: Int = 0,
    val target: Int = 0,
    val reward: Int = 0,
    val complete: Boolean = false
)

data class RoomActivityItem(
    val id: String = "",
    val label: String = "",
    val type: String = "",
    val createdAt: String = ""
)

data class RoomLeaderboard(
    val topRooms: List<Room> = emptyList(),
    val topHosts: List<Host> = emptyList()
)

enum class PkStatus { INVITED, WAITING, ACTIVE, ENDED, CANCELLED, DECLINED, EXPIRED, FORCE_ENDED }
enum class PkMode { GIFT, REACTION, MIXED }
enum class PkBattleType { VOICE, VIDEO }
enum class PkSideType { LEFT, RIGHT, DRAW }

data class PkSide(
    val roomId: String = "",
    val roomTitle: String = "",
    val hostId: String = "",
    val hostName: String = "",
    val hostAvatar: String? = null,
    val score: Int = 0,
    val participantCount: Int = 0,
    val activeCosmetics: ActiveCosmetics = ActiveCosmetics()
)

data class PkBattle(
    val id: String = "",
    val battleCode: String = "",
    val title: String = "",
    val status: PkStatus = PkStatus.INVITED,
    val mode: PkMode = PkMode.GIFT,
    val battleType: PkBattleType = PkBattleType.VOICE,
    val durationSeconds: Int = 180,
    val remainingSeconds: Int = 180,
    val left: PkSide = PkSide(),
    val right: PkSide = PkSide(),
    val leader: PkSideType? = null,
    val winnerSide: PkSideType? = null
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
    val side: PkSideType = PkSideType.LEFT,
    val totalPoints: Int = 0,
    val totalGiftsSent: Int = 0
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
    val progress: Int = 0,
    val complete: Boolean = false
)

data class ExperienceFeedItem(
    val type: String = "",
    val title: String = "",
    val room: Room? = null,
    val user: Host? = null
)

data class ExperienceHome(
    val profileCompletion: ProfileCompletion = ProfileCompletion(),
    val level: LevelStatus = LevelStatus(),
    val achievements: List<Achievement> = emptyList(),
    val feed: List<ExperienceFeedItem> = emptyList(),
    val liveRooms: List<Room> = emptyList(),
    val scheduledRooms: List<Room> = emptyList(),
    val followingRooms: List<Room> = emptyList(),
    val suggestedHosts: List<Host> = emptyList(),
    val unreadNotifications: Int = 0
)

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
    val partnerId: String = "",
    val roomId: String = "",
    val read: Boolean = false,
    val createdAt: String = ""
)

data class MiniGameBest(
    val score: Int = 0,
    val createdAt: String = ""
)

data class MiniGame(
    val id: String = "",
    val title: String = "",
    val description: String = "",
    val durationSeconds: Int = 0,
    val scoring: String = "",
    val best: MiniGameBest? = null
)

data class MiniGameScore(
    val id: String = "",
    val gameId: String = "",
    val score: Int = 0,
    val durationMs: Int? = null,
    val rounds: Int? = null,
    val createdAt: String = ""
)

data class GameCatalog(
    val games: List<MiniGame> = emptyList(),
    val recent: List<MiniGameScore> = emptyList()
)

data class DailyGameMission(
    val id: String = "",
    val title: String = "",
    val progress: Int = 0,
    val target: Int = 0,
    val rewardXp: Int = 0,
    val complete: Boolean = false
)

data class GameMissions(
    val date: String = "",
    val missions: List<DailyGameMission> = emptyList()
)

data class GameLeaderboardEntry(
    val userId: String = "",
    val score: Int = 0,
    val createdAt: String = "",
    val user: Host = Host()
)

data class GameLeaderboard(
    val gameId: String = "",
    val leaderboard: List<GameLeaderboardEntry> = emptyList(),
    val personalBest: MiniGameScore? = null
)

data class ClanSummary(
    val id: String = "",
    val name: String = "",
    val slug: String = "",
    val avatar: String? = null,
    val familyLabel: String = "",
    val memberCount: Int = 0
)

data class MiniGameChallenge(
    val id: String = "",
    val gameId: String = "",
    val score: Int = 0,
    val message: String = "",
    val expiresAt: String = "",
    val createdAt: String = "",
    val challenger: Host? = null,
    val targetUser: Host? = null,
    val clan: ClanSummary? = null
)

data class GameChallenges(
    val incoming: List<MiniGameChallenge> = emptyList(),
    val outgoing: List<MiniGameChallenge> = emptyList(),
    val clan: List<MiniGameChallenge> = emptyList()
)

data class GameReward(
    val xpAwarded: Int = 0,
    val levelUpReward: Int = 0
)

data class SavedGameScoreResult(
    val score: MiniGameScore = MiniGameScore(),
    val isPersonalBest: Boolean = false,
    val personalBest: MiniGameScore? = null,
    val reward: GameReward = GameReward()
)

data class NotificationPreferences(
    val values: Map<String, Boolean> = emptyMap()
)
