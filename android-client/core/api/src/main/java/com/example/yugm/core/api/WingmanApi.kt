package com.example.yugm.core.api

import com.example.yugm.core.model.*
import org.json.JSONArray
import org.json.JSONObject

object WingmanApi {
    suspend fun bioGenerate(token: String, request: WingmanBioGenerateRequest): WingmanBioGenerateResponse {
        val body = JSONObject().apply {
            request.currentBio?.let { put("currentBio", it) }
            put("style", request.style)
            request.interests?.let { put("interests", JSONArray(it)) }
            put("tone", request.tone)
        }
        val data = YugmHttpClient.post("/ai/wingman/bio/generate", token, body).getJSONObject("data")
        return WingmanBioGenerateResponse(
            suggestion = data.optString("suggestion", ""),
            style = data.optString("style", ""),
            tips = data.optJSONArray("tips")?.toStringList() ?: emptyList(),
        )
    }

    suspend fun bioRate(token: String, bio: String): WingmanBioRateResponse {
        val body = JSONObject().put("bio", bio)
        val data = YugmHttpClient.post("/ai/wingman/bio/rate", token, body).getJSONObject("data")
        return WingmanBioRateResponse(
            score = data.optInt("score", 0),
            rating = data.optString("rating", ""),
            feedback = data.optJSONArray("feedback")?.toStringList() ?: emptyList(),
            suggestions = data.optJSONArray("suggestions")?.toStringList() ?: emptyList(),
        )
    }

    suspend fun openers(token: String, request: WingmanOpenerRequest): WingmanOpenerResponse {
        val targetCtx = JSONObject().apply {
            request.targetUserContext.name?.let { put("name", it) }
            request.targetUserContext.bio?.let { put("bio", it) }
            request.targetUserContext.interests?.let { put("interests", JSONArray(it)) }
            request.targetUserContext.vibeScore?.let { put("vibeScore", it) }
        }
        val body = JSONObject().apply {
            put("targetUserContext", targetCtx)
            put("style", request.style)
        }
        val data = YugmHttpClient.post("/ai/wingman/opener", token, body).getJSONObject("data")
        return WingmanOpenerResponse(
            openers = data.optJSONArray("openers")?.toStringList() ?: emptyList(),
            style = data.optString("style", ""),
            tip = data.optString("tip", ""),
        )
    }

    suspend fun replies(token: String, request: WingmanReplyRequest): WingmanReplyResponse {
        val convArray = JSONArray().apply {
            request.conversation.forEach { msg ->
                put(JSONObject().apply {
                    put("role", msg.role)
                    put("content", msg.content)
                })
            }
        }
        val body = JSONObject().apply {
            put("conversation", convArray)
            put("style", request.style)
        }
        val data = YugmHttpClient.post("/ai/wingman/reply", token, body).getJSONObject("data")
        return WingmanReplyResponse(
            suggestions = data.optJSONArray("suggestions")?.toStringList() ?: emptyList(),
            context = data.optString("context", ""),
            deliveryTip = data.optString("deliveryTip", ""),
        )
    }

    suspend fun coach(token: String, request: WingmanCoachRequest): WingmanCoachResponse {
        val chatArray = JSONArray().apply {
            request.chatHistory.forEach { msg ->
                put(JSONObject().apply {
                    put("role", msg.role)
                    put("content", msg.content)
                })
            }
        }
        val body = JSONObject().put("chatHistory", chatArray)
        val data = YugmHttpClient.post("/ai/wingman/coach", token, body).getJSONObject("data")
        val analysis = data.optJSONObject("analysis") ?: JSONObject()
        return WingmanCoachResponse(
            analysis = WingmanConversationAnalysis(
                totalMessages = analysis.optInt("totalMessages", 0),
                yourMessageCount = analysis.optInt("yourMessageCount", 0),
                theirMessageCount = analysis.optInt("theirMessageCount", 0),
                yourAvgLength = analysis.optInt("yourAvgLength", 0),
                theirAvgLength = analysis.optInt("theirAvgLength", 0),
                engagement = analysis.optInt("engagement", 0),
                chemistry = analysis.optString("chemistry", ""),
            ),
            tips = data.optJSONArray("tips")?.toStringList() ?: emptyList(),
            redFlags = data.optJSONArray("redFlags")?.toStringList(),
        )
    }

    suspend fun ghostDetect(token: String, request: WingmanGhostDetectRequest): WingmanGhostDetectResponse {
        val convArray = JSONArray().apply {
            request.conversation.forEach { msg ->
                put(JSONObject().apply {
                    put("role", msg.role)
                    put("content", msg.content)
                })
            }
        }
        val body = JSONObject().put("conversation", convArray)
        val data = YugmHttpClient.post("/ai/wingman/ghost/detect", token, body).getJSONObject("data")
        return WingmanGhostDetectResponse(
            ghosting = data.optBoolean("ghosting", false),
            confidence = data.optDouble("confidence", 0.0),
            reason = data.optString("reason", ""),
            advice = data.optJSONArray("advice")?.toStringList() ?: emptyList(),
        )
    }

    suspend fun datePlan(token: String, request: WingmanDatePlanRequest): WingmanDatePlanResponse {
        val prefs = JSONObject().apply {
            put("budget", request.preferences.budget)
            put("vibe", request.preferences.vibe)
            request.preferences.location?.let { put("location", it) }
            request.preferences.interests?.let { put("interests", JSONArray(it)) }
        }
        val body = JSONObject().put("preferences", prefs)
        val data = YugmHttpClient.post("/ai/wingman/date/plan", token, body).getJSONObject("data")
        val planArray = data.optJSONArray("plan") ?: JSONArray()
        val plan = buildList {
            for (i in 0 until planArray.length()) {
                val idea = planArray.getJSONObject(i)
                add(WingmanDateIdea(
                    name = idea.optString("name", ""),
                    description = idea.optString("description", ""),
                    vibe = idea.optString("vibe", ""),
                    estimatedCost = idea.optString("estimatedCost", ""),
                ))
            }
        }
        val respPrefs = data.optJSONObject("preferences")
        return WingmanDatePlanResponse(
            plan = plan,
            preferences = WingmanDatePreferences(
                budget = respPrefs?.optString("budget", "medium") ?: "medium",
                vibe = respPrefs?.optString("vibe", "romantic") ?: "romantic",
            ),
            tip = data.optString("tip", ""),
        )
    }

    suspend fun giftRecommend(token: String, request: WingmanGiftRecommendRequest): WingmanGiftRecommendResponse {
        val ctx = JSONObject().apply {
            request.recipientContext.interests?.let { put("interests", JSONArray(it)) }
            request.recipientContext.vibeScore?.let { put("vibeScore", it) }
            put("relationship", request.recipientContext.relationship)
        }
        val body = JSONObject().apply {
            put("recipientContext", ctx)
            put("budget", request.budget)
        }
        val data = YugmHttpClient.post("/ai/wingman/gift/recommend", token, body).getJSONObject("data")
        val recsArray = data.optJSONArray("recommendations") ?: JSONArray()
        val recommendations = buildList {
            for (i in 0 until recsArray.length()) {
                val rec = recsArray.getJSONObject(i)
                add(WingmanGiftRecommendation(
                    name = rec.optString("name", ""),
                    reason = rec.optString("reason", ""),
                    category = rec.optString("category", ""),
                ))
            }
        }
        return WingmanGiftRecommendResponse(recommendations = recommendations)
    }

    suspend fun analytics(token: String): WingmanAnalyticsResponse {
        val data = YugmHttpClient.get("/ai/wingman/analytics", token).getJSONObject("data")
        return WingmanAnalyticsResponse(
            totalHelped = data.optInt("totalHelped", 0),
            conversationsAnalyzed = data.optInt("conversationsAnalyzed", 0),
            improvement = data.optString("improvement", ""),
            topFeatures = data.optJSONArray("topFeatures")?.toStringList() ?: emptyList(),
        )
    }

    private fun org.json.JSONArray.toStringList(): List<String> = buildList {
        for (i in 0 until length()) add(getString(i))
    }
}
