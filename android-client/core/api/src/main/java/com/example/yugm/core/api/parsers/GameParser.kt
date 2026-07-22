package com.example.yugm.core.api.parsers

import com.example.yugm.core.model.DailyGameMission
import com.example.yugm.core.model.GameCatalog
import com.example.yugm.core.model.GameChallenges
import com.example.yugm.core.model.GameLeaderboard
import com.example.yugm.core.model.GameLeaderboardEntry
import com.example.yugm.core.model.GameMissions
import com.example.yugm.core.model.GameReward
import com.example.yugm.core.model.Host
import com.example.yugm.core.model.MiniGame
import com.example.yugm.core.model.MiniGameBest
import com.example.yugm.core.model.MiniGameChallenge
import com.example.yugm.core.model.MiniGameScore
import com.example.yugm.core.model.SavedGameScoreResult
import org.json.JSONArray
import org.json.JSONObject

fun JSONObject.toGameCatalog(): GameCatalog = GameCatalog(
    games = optJSONArray("games")?.toMiniGames() ?: emptyList(),
    recent = optJSONArray("recent")?.toMiniGameScores() ?: emptyList()
)

fun JSONObject.toMiniGame(): MiniGame = MiniGame(
    id = optString("id", optString("_id", "")),
    title = optString("title", "Mini Game"),
    description = optString("description", ""),
    durationSeconds = optInt("durationSeconds", 0),
    scoring = optString("scoring", "Higher score wins"),
    best = optJSONObject("best")?.toMiniGameBest()
)

fun JSONArray.toMiniGames(): List<MiniGame> = buildList {
    for (index in 0 until length()) add(getJSONObject(index).toMiniGame())
}

fun JSONObject.toMiniGameBest(): MiniGameBest = MiniGameBest(
    score = optInt("score", 0),
    createdAt = optString("createdAt", "")
)

fun JSONObject.toMiniGameScore(): MiniGameScore = MiniGameScore(
    id = optString("_id", optString("id", "")),
    gameId = optString("gameId", ""),
    score = optInt("score", 0),
    durationMs = if (has("durationMs") && !isNull("durationMs")) optInt("durationMs") else null,
    rounds = if (has("rounds") && !isNull("rounds")) optInt("rounds") else null,
    createdAt = optString("createdAt", "")
)

fun JSONArray.toMiniGameScores(): List<MiniGameScore> = buildList {
    for (index in 0 until length()) add(getJSONObject(index).toMiniGameScore())
}

fun JSONObject.toGameMissions(): GameMissions = GameMissions(
    date = optString("date", ""),
    missions = optJSONArray("missions")?.toDailyGameMissions() ?: emptyList()
)

fun JSONObject.toDailyGameMission(): DailyGameMission = DailyGameMission(
    id = optString("id", optString("_id", "")),
    title = optString("title", ""),
    progress = optInt("progress", 0),
    target = optInt("target", 0),
    rewardXp = optInt("rewardXp", optInt("reward", 0)),
    complete = optBoolean("complete", false)
)

fun JSONArray.toDailyGameMissions(): List<DailyGameMission> = buildList {
    for (index in 0 until length()) add(getJSONObject(index).toDailyGameMission())
}

fun JSONObject.toGameLeaderboard(): GameLeaderboard = GameLeaderboard(
    gameId = optString("gameId", ""),
    leaderboard = optJSONArray("leaderboard")?.toGameLeaderboardEntries() ?: emptyList(),
    personalBest = optJSONObject("personalBest")?.toMiniGameScore()
)

fun JSONObject.toGameLeaderboardEntry(): GameLeaderboardEntry {
    val userObject = optJSONObject("user")
    return GameLeaderboardEntry(
        userId = optString("userId", userObject?.entityId() ?: ""),
        score = optInt("score", 0),
        createdAt = optString("createdAt", ""),
        user = userObject?.toHost() ?: Host(id = optString("userId", ""), name = "Player", username = "yugm")
    )
}

fun JSONArray.toGameLeaderboardEntries(): List<GameLeaderboardEntry> = buildList {
    for (index in 0 until length()) add(getJSONObject(index).toGameLeaderboardEntry())
}

fun JSONObject.toGameChallenges(): GameChallenges = GameChallenges(
    incoming = optJSONArray("incoming")?.toMiniGameChallenges() ?: emptyList(),
    outgoing = optJSONArray("outgoing")?.toMiniGameChallenges() ?: emptyList(),
    clan = optJSONArray("clan")?.toMiniGameChallenges() ?: emptyList()
)

fun JSONObject.toMiniGameChallenge(): MiniGameChallenge = MiniGameChallenge(
    id = optString("_id", optString("id", "")),
    gameId = optString("gameId", ""),
    score = optInt("score", 0),
    message = optString("message", ""),
    expiresAt = optString("expiresAt", ""),
    createdAt = optString("createdAt", ""),
    challenger = optJSONObject("challenger")?.toHost() ?: optJSONObject("challengerId")?.toHost(),
    targetUser = optJSONObject("targetUser")?.toHost() ?: optJSONObject("targetUserId")?.toHost(),
    clan = optJSONObject("clan")?.toClanSummary() ?: optJSONObject("clanId")?.toClanSummary()
)

fun JSONArray.toMiniGameChallenges(): List<MiniGameChallenge> = buildList {
    for (index in 0 until length()) add(getJSONObject(index).toMiniGameChallenge())
}

fun JSONObject.toSavedGameScoreResult(): SavedGameScoreResult = SavedGameScoreResult(
    score = optJSONObject("score")?.toMiniGameScore() ?: MiniGameScore(),
    isPersonalBest = optBoolean("isPersonalBest", false),
    personalBest = optJSONObject("personalBest")?.toMiniGameScore(),
    reward = optJSONObject("reward")?.toGameReward() ?: GameReward()
)

fun JSONObject.toGameReward(): GameReward = GameReward(
    xpAwarded = optInt("xpAwarded", 0),
    levelUpReward = optInt("levelUpReward", 0)
)
