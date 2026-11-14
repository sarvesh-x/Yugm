package com.yugm.app.core.model

data class GiftItem(val id: String, val name: String, val price: Int, val diamondPrice: Int = 0)

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
