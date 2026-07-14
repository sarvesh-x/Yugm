package com.example.yugm.api

import com.example.yugm.model.PkBattle
import com.example.yugm.model.PkBattleType
import com.example.yugm.model.PkInvite
import com.example.yugm.model.PkLeaderboardEntry
import com.example.yugm.model.PkMediaSession
import com.example.yugm.model.PkMode
import com.example.yugm.model.PkOpponent
import com.example.yugm.model.PkSideType
import com.example.yugm.model.PkStats
import org.json.JSONArray
import org.json.JSONObject

object PkApi {
    suspend fun activePk(token: String, roomId: String): PkBattle? {
        val data = YugmHttpClient.get("/pk/active/$roomId", token).getJSONObject("data")
        return data.optJSONObject("battle")?.toPkBattle()
    }

    suspend fun activePkWithInvite(token: String, roomId: String): Pair<PkBattle?, PkInvite?> {
        val data = YugmHttpClient.get("/pk/active/$roomId", token).getJSONObject("data")
        return data.optJSONObject("battle")?.toPkBattle() to data.optJSONObject("invite")?.toPkInvite()
    }

    suspend fun availablePkOpponents(token: String, battleType: PkBattleType, search: String = ""): List<PkOpponent> {
        val query = buildString {
            append("?battleType=${battleType.name}")
            if (search.isNotBlank()) append("&search=${java.net.URLEncoder.encode(search, "UTF-8")}")
        }
        val data = YugmHttpClient.get("/pk/available-opponents$query", token).getJSONObject("data")
        return data.optJSONArray("opponents")?.toPkOpponents() ?: emptyList()
    }

    suspend fun invitePk(
        token: String,
        roomId: String,
        opponentRoomId: String,
        opponentHostId: String,
        battleType: PkBattleType,
        mode: PkMode,
        durationSeconds: Int,
        title: String
    ): Pair<PkBattle, PkInvite?> {
        val data = YugmHttpClient.post(
            "/pk/invite",
            token,
            JSONObject()
                .put("roomId", roomId)
                .put("opponentRoomId", opponentRoomId)
                .put("opponentHostId", opponentHostId)
                .put("battleType", battleType.name)
                .put("mode", mode.name)
                .put("durationSeconds", durationSeconds)
                .put("title", title)
        ).getJSONObject("data")
        return data.getJSONObject("battle").toPkBattle() to data.optJSONObject("invite")?.toPkInvite()
    }

    suspend fun autoMatchPk(
        token: String,
        roomId: String,
        battleType: PkBattleType,
        mode: PkMode,
        durationSeconds: Int,
        title: String
    ): Pair<PkBattle, PkInvite?> {
        val data = YugmHttpClient.post(
            "/pk/auto-match",
            token,
            JSONObject()
                .put("roomId", roomId)
                .put("battleType", battleType.name)
                .put("mode", mode.name)
                .put("durationSeconds", durationSeconds)
                .put("title", title)
        ).getJSONObject("data")
        return data.getJSONObject("battle").toPkBattle() to data.optJSONObject("invite")?.toPkInvite()
    }

    suspend fun acceptPk(token: String, inviteId: String): PkBattle {
        return YugmHttpClient.post("/pk/accept", token, JSONObject().put("inviteId", inviteId))
            .getJSONObject("data")
            .getJSONObject("battle")
            .toPkBattle()
    }

    suspend fun rejectPk(token: String, inviteId: String) {
        YugmHttpClient.post("/pk/reject", token, JSONObject().put("inviteId", inviteId))
    }

    suspend fun endPk(token: String, battleId: String): PkBattle {
        return YugmHttpClient.post("/pk/end", token, JSONObject().put("battleId", battleId))
            .getJSONObject("data")
            .getJSONObject("battle")
            .toPkBattle()
    }

    suspend fun cancelPk(token: String, battleId: String) {
        YugmHttpClient.post("/pk/cancel", token, JSONObject().put("battleId", battleId))
    }

    suspend fun requestRematch(token: String, battleId: String): Pair<PkBattle, Any?> {
        val response = YugmHttpClient.post("/pk/rematch", token, JSONObject().put("battleId", battleId))
        val data = response.getJSONObject("data")
        val battle = data.optJSONObject("battle")?.toPkBattle()
        val invite = data.optJSONObject("invite")
        return Pair(battle ?: PkBattle(), invite)
    }

    suspend fun sendPkGift(token: String, battleId: String, giftId: String, side: PkSideType): PkBattle {
        return YugmHttpClient.post(
            "/pk/$battleId/send-gift",
            token,
            JSONObject()
                .put("giftId", giftId)
                .put("side", side.name)
                .put("idempotencyKey", java.util.UUID.randomUUID().toString())
        ).getJSONObject("data").getJSONObject("battle").toPkBattle()
    }

    suspend fun sendPkReaction(token: String, battleId: String, side: PkSideType, type: String): PkBattle {
        return YugmHttpClient.post(
            "/pk/$battleId/reactions",
            token,
            JSONObject().put("side", side.name).put("type", type)
        ).getJSONObject("data").getJSONObject("battle").toPkBattle()
    }

    suspend fun pkLeaderboard(token: String, battleId: String): List<PkLeaderboardEntry> {
        val data = YugmHttpClient.get("/pk/$battleId/leaderboard", token).getJSONObject("data")
        return data.optJSONArray("entries")?.toPkLeaderboardEntries() ?: emptyList()
    }

    suspend fun pkMediaSession(token: String, battleId: String, roomId: String): PkMediaSession? {
        val data = YugmHttpClient.get("/pk/$battleId/media-sessions?roomId=${java.net.URLEncoder.encode(roomId, "UTF-8")}", token).getJSONObject("data")
        return data.optJSONObject("opponent")?.toPkMediaSession()
    }

    suspend fun pkStats(token: String, userId: String): PkStats {
        val data = YugmHttpClient.get("/users/$userId/pk-stats", token).getJSONObject("data")
        return data.optJSONObject("stats")?.toPkStats() ?: PkStats()
    }

    suspend fun pkHistory(token: String, userId: String): List<PkBattle> {
        val data = YugmHttpClient.get("/users/$userId/pk-history", token).getJSONObject("data")
        val items = data.optJSONArray("battles") ?: JSONArray()
        return buildList {
            for (index in 0 until items.length()) add(items.getJSONObject(index).toPkBattle())
        }
    }
}
