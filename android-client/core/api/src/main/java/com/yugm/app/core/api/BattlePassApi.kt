package com.yugm.app.core.api

import com.yugm.app.core.api.parsers.toBattlePassLevelUpResult
import com.yugm.app.core.api.parsers.toBattlePassPurchaseResult
import com.yugm.app.core.api.parsers.toBattlePassResponse
import com.yugm.app.core.model.BattlePassLevelUpResult
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

    suspend fun levelUp(token: String, xp: Int = 100): BattlePassLevelUpResult {
        val body = JSONObject().put("xp", xp)
        val data = YugmHttpClient.post("/battle-pass/level-up", token, body).getJSONObject("data")
        return data.toBattlePassLevelUpResult()
    }
}
