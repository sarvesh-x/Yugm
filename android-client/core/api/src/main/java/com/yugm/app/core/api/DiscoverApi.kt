package com.yugm.app.core.api

import org.json.JSONObject

object DiscoverApi {
    suspend fun presenceCount(token: String): Int {
        val data = YugmHttpClient.get("/discover/presence-count", token).getJSONObject("data")
        return data.optInt("count", 0)
    }
}