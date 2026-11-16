package com.yugm.app.core.api

import com.yugm.app.core.api.parsers.toBattlePassPurchaseResult
import com.yugm.app.core.api.parsers.toBattlePassResponse
import com.yugm.app.core.model.BattlePassPurchaseResult
import com.yugm.app.core.model.BattlePassResponse
import org.json.JSONObject

object BattlePassApi {

    suspend fun get(token: String): BattlePassResponse {
        val data = YugmHttpClient.get("/battle-pass", token).getJSONObject("data")
        return data.toBattlePassResponse()
    }

    suspend fun purchase(token: String): BattlePassPurchaseResult {
        val data = YugmHttpClient.post("/battle-pass/purchase", token, JSONObject()).getJSONObject("data")
        return data.toBattlePassPurchaseResult()
    }

    suspend fun claim(token: String, level: Int, track: String): BattlePassResponse {
        val body = JSONObject().put("level", level).put("track", track)
        val data = YugmHttpClient.post("/battle-pass/claim", token, body).getJSONObject("data")
        return data.toBattlePassResponse()
    }
}