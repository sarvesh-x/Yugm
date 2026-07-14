package com.example.yugm.api

import com.example.yugm.model.Host
import org.json.JSONArray
import org.json.JSONObject

object DatingApi {
    suspend fun datingExplore(token: String, filters: Set<String> = emptySet()): List<Host> {
        val params = buildList {
            filters.forEach { key ->
                when (key) {
                    "age" -> { add("minAge=18"); add("maxAge=25") }
                    "online" -> add("onlineOnly=true")
                    "distance" -> add("maxDistance=25")
                    "interests" -> add("sharedInterests=true")
                }
            }
        }
        val query = if (params.isNotEmpty()) "?${params.joinToString("&")}" else ""
        val data = YugmHttpClient.get("/dating/explore$query", token).getJSONObject("data")
        return data.getJSONArray("candidates").toHosts()
    }

    suspend fun datingLike(token: String, likedId: String, type: String): Pair<Boolean, String?> {
        val body = JSONObject().put("likedId", likedId).put("type", type)
        val data = YugmHttpClient.post("/dating/like", token, body).getJSONObject("data")
        val isMatch = data.optBoolean("isMatch", false)
        val matchObj = data.optJSONObject("match")
        val matchId = matchObj?.optString("_id") ?: matchObj?.optString("id")
        return Pair(isMatch, matchId)
    }

    suspend fun datingPass(token: String, likedId: String) {
        YugmHttpClient.post("/dating/pass", token, JSONObject().put("likedId", likedId))
    }

    suspend fun datingMatches(token: String): List<Host> {
        val data = YugmHttpClient.get("/dating/matches", token).getJSONObject("data")
        val matchesArray = data.getJSONArray("matches")
        return buildList {
            for (i in 0 until matchesArray.length()) {
                val matchItem = matchesArray.getJSONObject(i)
                val partnerObj = matchItem.optJSONObject("partner")
                if (partnerObj != null) {
                    add(partnerObj.toHost())
                }
            }
        }
    }
}
