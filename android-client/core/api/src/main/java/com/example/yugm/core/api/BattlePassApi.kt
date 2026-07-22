package com.example.yugm.core.api

import com.example.yugm.core.api.parsers.toBattlePassLevelUpResult
import com.example.yugm.core.api.parsers.toBattlePassPurchaseResult
import com.example.yugm.core.api.parsers.toBattlePassResponse
import com.example.yugm.core.model.BattlePassLevelUpResult
import com.example.yugm.core.model.BattlePassPurchaseResult
import com.example.yugm.core.model.BattlePassResponse
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

    suspend fun levelUp(token: String, xp: Int = 100): BattlePassLevelUpResult {
        val body = JSONObject().put("xp", xp)
        val data = YugmHttpClient.post("/battle-pass/level-up", token, body).getJSONObject("data")
        return data.toBattlePassLevelUpResult()
    }
}
