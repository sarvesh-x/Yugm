package com.example.yugm.core.api

import com.example.yugm.core.model.GiftLeaderboardResponse
import com.example.yugm.core.model.LeaderboardEntry
import com.example.yugm.core.model.LeaderboardUser
import org.json.JSONObject

object GiftLeaderboardApi {
    suspend fun leaderboard(token: String, period: String = "all", skip: Int = 0, limit: Int = 20): GiftLeaderboardResponse {
        val json = YugmHttpClient.get("/gift-leaderboard?period=$period&skip=$skip&limit=$limit", token)
        val data = json.getJSONObject("data")
        return GiftLeaderboardResponse(
            topSenders = parseEntries(data.optJSONArray("topSenders")),
            topReceivers = parseEntries(data.optJSONArray("topReceivers")),
            period = data.optString("period", "all")
        )
    }

    private fun parseEntries(array: org.json.JSONArray?): List<LeaderboardEntry> {
        if (array == null) return emptyList()
        val result = mutableListOf<LeaderboardEntry>()
        for (i in 0 until array.length()) {
            val obj = array.getJSONObject(i)
            val userObj = obj.optJSONObject("user")
            result.add(LeaderboardEntry(
                _id = obj.optString("_id", ""),
                totalCoins = obj.optInt("totalCoins", 0),
                giftCount = obj.optInt("giftCount", 0),
                user = userObj?.let { LeaderboardUser(
                    _id = it.optString("_id", ""),
                    name = it.optString("name", "").ifEmpty { null },
                    username = it.optString("username", "").ifEmpty { null },
                    avatar = it.optString("avatar", "").ifEmpty { null }
                ) }
            ))
        }
        return result
    }
}
