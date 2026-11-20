package com.yugm.app.core.api

import com.yugm.app.core.model.WatchParty
import org.json.JSONObject

object WatchPartyApi {
    suspend fun start(token: String, roomId: String, title: String, mediaUrl: String): WatchParty {
        val body = JSONObject().apply {
            put("title", title)
            put("mediaUrl", mediaUrl)
        }
        val json = YugmHttpClient.post("/rooms/$roomId/watch-party", token, body)
        return parseWatchParty(json.getJSONObject("data").getJSONObject("watchParty"))
    }

    suspend fun get(token: String, roomId: String): WatchParty {
        val json = YugmHttpClient.get("/rooms/$roomId/watch-party", token)
        return parseWatchParty(json.getJSONObject("data").getJSONObject("watchParty"))
    }

    suspend fun sync(token: String, roomId: String, position: Double, isPlaying: Boolean): WatchParty {
        val body = JSONObject().apply {
            put("position", position)
            put("isPlaying", isPlaying)
        }
        val json = YugmHttpClient.patch("/rooms/$roomId/watch-party/sync", token, body)
        return parseWatchParty(json.getJSONObject("data").getJSONObject("watchParty"))
    }

    suspend fun stop(token: String, roomId: String) {
        YugmHttpClient.delete("/rooms/$roomId/watch-party", token)
    }

    private fun parseWatchParty(obj: JSONObject): WatchParty {
        return WatchParty(
            _id = obj.optString("_id", ""),
            roomId = obj.optString("roomId", ""),
            hostId = obj.optString("hostId", ""),
            title = obj.optString("title", ""),
            mediaUrl = obj.optString("mediaUrl", ""),
            position = obj.optDouble("position", 0.0),
            isPlaying = obj.optBoolean("isPlaying", false),
            createdAt = obj.optString("createdAt", "")
        )
    }
}
