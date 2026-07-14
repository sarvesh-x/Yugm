package com.example.yugm.api

import com.example.yugm.model.GameCatalog
import com.example.yugm.model.GameChallenges
import com.example.yugm.model.GameLeaderboard
import com.example.yugm.model.GameMissions
import com.example.yugm.model.MiniGameChallenge
import com.example.yugm.model.SavedGameScoreResult
import org.json.JSONObject

object GameApi {
    suspend fun gameCatalog(token: String): GameCatalog {
        return YugmHttpClient.get("/games/catalog", token).getJSONObject("data").toGameCatalog()
    }

    suspend fun gameMissions(token: String): GameMissions {
        return YugmHttpClient.get("/games/missions", token).getJSONObject("data").toGameMissions()
    }

    suspend fun gameLeaderboard(token: String, gameId: String): GameLeaderboard {
        val encoded = java.net.URLEncoder.encode(gameId, "UTF-8")
        return YugmHttpClient.get("/games/leaderboard?gameId=$encoded", token).getJSONObject("data").toGameLeaderboard()
    }

    suspend fun gameChallenges(token: String): GameChallenges {
        return YugmHttpClient.get("/games/challenges", token).getJSONObject("data").toGameChallenges()
    }

    suspend fun submitGameScore(
        token: String,
        gameId: String,
        score: Int,
        durationMs: Int? = null,
        rounds: Int? = null
    ): SavedGameScoreResult {
        val body = JSONObject()
            .put("gameId", gameId)
            .put("score", score)
        if (durationMs != null) body.put("durationMs", durationMs)
        if (rounds != null) body.put("rounds", rounds)
        return YugmHttpClient.post("/games/scores", token, body).getJSONObject("data").toSavedGameScoreResult()
    }

    suspend fun sendGameChallenge(
        token: String,
        gameId: String,
        score: Int,
        scoreId: String,
        targetUserId: String? = null,
        clanId: String? = null,
        message: String? = null
    ): MiniGameChallenge {
        val body = JSONObject()
            .put("gameId", gameId)
            .put("score", score)
        if (scoreId.isNotBlank()) body.put("scoreId", scoreId)
        if (!targetUserId.isNullOrBlank()) body.put("targetUserId", targetUserId)
        if (!clanId.isNullOrBlank()) body.put("clanId", clanId)
        if (!message.isNullOrBlank()) body.put("message", message)
        return YugmHttpClient.post("/games/challenges", token, body).getJSONObject("data").getJSONObject("challenge").toMiniGameChallenge()
    }

    suspend fun shareGameScore(token: String, scoreId: String, targetUserId: String) {
        YugmHttpClient.post("/games/scores/$scoreId/share", token, JSONObject().put("targetUserId", targetUserId))
    }
}
