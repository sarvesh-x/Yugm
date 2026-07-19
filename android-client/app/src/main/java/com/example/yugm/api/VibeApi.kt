package com.example.yugm.api

import com.example.yugm.model.VibeCompatibility
import com.example.yugm.model.VibeGraph
import com.example.yugm.model.VibeMatchResponse
import com.example.yugm.model.VibeSummary
import com.example.yugm.model.VibeTargetUser
import com.example.yugm.model.VibeUpdateResponse
import org.json.JSONObject

object VibeApi {
    suspend fun init(token: String): VibeGraph {
        val data = YugmHttpClient.post("/vibe/init", token, JSONObject()).getJSONObject("data")
        return data.getJSONObject("vibe").toVibeGraph()
    }

    suspend fun update(token: String, interactionType: String, targetUserId: String? = null): VibeUpdateResponse {
        val body = JSONObject().put("interactionType", interactionType)
        if (targetUserId != null) body.put("targetUserId", targetUserId)
        val data = YugmHttpClient.post("/vibe/update", token, body).getJSONObject("data")
        return VibeUpdateResponse(
            vibeChange = data.optInt("vibeChange", 0),
            improved = data.optBoolean("improved", false),
            message = data.optString("message", "").ifBlank { null }
        )
    }

    suspend fun match(token: String, userId: String): VibeMatchResponse {
        val data = YugmHttpClient.get("/vibe/match/$userId", token).getJSONObject("data")
        val compatibility = data.getJSONObject("compatibility")
        val vibe = data.optJSONObject("vibe")
        val targetUser = data.optJSONObject("targetUser")
        return VibeMatchResponse(
            compatibility = VibeCompatibility(
                score = compatibility.optInt("score", 0),
                label = compatibility.optString("label", "New Connection"),
                sharedInterests = compatibility.optJSONArray("sharedInterests")?.toStringList() ?: emptyList(),
                sharedLanguages = compatibility.optJSONArray("sharedLanguages")?.toStringList() ?: emptyList(),
                sameCity = compatibility.optBoolean("sameCity", false)
            ),
            vibe = vibe?.let {
                VibeSummary(
                    score = it.optInt("score", 0),
                    totalInteractions = it.optInt("totalInteractions", 0)
                )
            },
            targetUser = targetUser?.let {
                VibeTargetUser(
                    id = it.optString("_id", ""),
                    name = it.optString("name", ""),
                    avatar = it.optString("avatar", "").ifBlank { null },
                    username = it.optString("username", ""),
                    level = it.optInt("level", 1),
                    levelTitle = it.optString("levelTitle", "New Vibe")
                )
            }
        )
    }

    private fun JSONObject.toVibeGraph() = VibeGraph(
        userId = optString("userId", ""),
        interests = optJSONArray("interests")?.toStringList() ?: emptyList(),
        languages = optJSONArray("languages")?.toStringList() ?: emptyList(),
        city = optString("city", ""),
        vibeScore = optInt("vibeScore", 50),
        totalInteractions = optInt("totalInteractions", 0)
    )

    private fun org.json.JSONArray.toStringList(): List<String> = buildList {
        for (i in 0 until length()) add(getString(i))
    }
}
