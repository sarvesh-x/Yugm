package com.yugm.app.core.api

import com.yugm.app.core.api.parsers.toActiveMissionsResponse
import com.yugm.app.core.api.parsers.toMissionClaimResult
import com.yugm.app.core.api.parsers.toMissionProgressResult
import com.yugm.app.core.model.ActiveMissionsResponse
import com.yugm.app.core.model.MissionClaimResult
import com.yugm.app.core.model.MissionProgressResult
import org.json.JSONObject

object MissionsApi {

    suspend fun activeMissions(token: String): ActiveMissionsResponse {
        val data = YugmHttpClient.get("/missions/active", token).getJSONObject("data")
        return data.toActiveMissionsResponse()
    }

    suspend fun updateProgress(token: String, action: String, delta: Int = 1): List<MissionProgressResult> {
        val body = JSONObject().put("action", action).put("delta", delta)
        val data = YugmHttpClient.post("/missions/progress", token, body).getJSONObject("data")
        val arr = data.getJSONArray("results")
        val list = mutableListOf<MissionProgressResult>()
        for (i in 0 until arr.length()) list.add(arr.getJSONObject(i).toMissionProgressResult())
        return list
    }

    suspend fun claim(token: String, missionId: String): MissionClaimResult {
        val body = JSONObject().put("missionId", missionId)
        val data = YugmHttpClient.post("/missions/claim", token, body).getJSONObject("data")
        return data.toMissionClaimResult()
    }
}
