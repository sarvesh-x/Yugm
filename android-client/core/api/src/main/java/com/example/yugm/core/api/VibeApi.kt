package com.example.yugm.core.api

import com.example.yugm.core.model.*
import org.json.JSONArray
import org.json.JSONObject

object VibeApi {
    suspend fun init(token: String): VibeInitResponse {
        val data = YugmHttpClient.post("/vibe/init", token, JSONObject()).getJSONObject("data")
        val vibe = data.getJSONObject("vibe")
        return VibeInitResponse(vibe = vibe.toVibeGraph())
    }

    suspend fun update(token: String, interactionType: String, targetUserId: String? = null): VibeUpdateResponse {
        val body = JSONObject().put("interactionType", interactionType)
        if (targetUserId != null) body.put("targetUserId", targetUserId)
        val data = YugmHttpClient.post("/vibe/update", token, body).getJSONObject("data")
        return VibeUpdateResponse(
            vibeChange = data.optInt("vibeChange", 0),
            improved = data.optBoolean("improved", false),
            message = data.optString("message", "").ifBlank { null },
            vibe = data.optJSONObject("vibe")?.toVibeGraph()
        )
    }

    suspend fun match(token: String, userId: String): VibeMatchResponse {
        val data = YugmHttpClient.get("/vibe/match/$userId", token).getJSONObject("data")
        val compatibility = data.optJSONObject("compatibility")
        val vibe = data.optJSONObject("vibe")
        val targetUser = data.optJSONObject("targetUser")
        return VibeMatchResponse(
            overallScore = data.optInt("overallScore", 0),
            dimensionScores = data.optJSONObject("dimensionScores")?.toMapStringInt() ?: emptyMap(),
            trend = data.optString("trend", "stable"),
            compatibility = compatibility?.let {
                VibeCompatibility(
                    score = it.optInt("score", 0),
                    label = it.optString("label", "New Connection"),
                    sharedInterests = it.optJSONArray("sharedInterests")?.toStringList() ?: emptyList(),
                    sharedLanguages = it.optJSONArray("sharedLanguages")?.toStringList() ?: emptyList(),
                    sameCity = it.optBoolean("sameCity", false)
                )
            } ?: VibeCompatibility(),
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

    suspend fun matches(token: String, page: Int = 1, limit: Int = 20): VibeMatchesResponse {
        val data = YugmHttpClient.get("/vibe/matches?page=$page&limit=$limit", token).getJSONObject("data")
        val matchesArray = data.optJSONArray("matches") ?: JSONArray()
        val matches = buildList {
            for (i in 0 until matchesArray.length()) {
                val item = matchesArray.getJSONObject(i)
                val user = item.optJSONObject("user")
                val scores = item.optJSONObject("scores")
                add(VibeMatchUser(
                    user = VibeTargetUser(
                        id = user?.optString("_id", "") ?: "",
                        name = user?.optString("name", "") ?: "",
                        avatar = user?.optString("avatar", "")?.ifBlank { null },
                        username = user?.optString("username", "") ?: "",
                        level = user?.optInt("level", 1) ?: 1,
                        levelTitle = user?.optString("levelTitle", "New Vibe") ?: "New Vibe"
                    ),
                    scores = VibeMatchScores(
                        overall = scores?.optInt("overall", 0) ?: 0,
                        compatibility = scores?.optInt("compatibility", 0) ?: 0,
                        interestSimilarity = scores?.optInt("interestSimilarity", 0) ?: 0
                    )
                ))
            }
        }
        return VibeMatchesResponse(matches = matches)
    }

    suspend fun graph(token: String): VibeGraphResponse {
        val data = YugmHttpClient.get("/vibe/graph", token).getJSONObject("data")
        val vibeGraph = data.optJSONObject("vibeGraph") ?: data
        return VibeGraphResponse(vibeGraph = vibeGraph.toVibeGraph())
    }

    suspend fun trend(token: String): VibeTrendResponse {
        val data = YugmHttpClient.get("/vibe/trend", token).getJSONObject("data")
        val historyArray = data.optJSONArray("history") ?: JSONArray()
        val history = buildList {
            for (i in 0 until historyArray.length()) {
                val point = historyArray.getJSONObject(i)
                add(VibeTrendPoint(
                    score = point.optInt("score", 0),
                    date = point.optString("date", "")
                ))
            }
        }
        return VibeTrendResponse(
            trend = data.optString("trend", "stable"),
            history = history
        )
    }

    suspend fun dimensions(token: String): VibeDimensionListResponse {
        val data = YugmHttpClient.get("/vibe/dimensions", token).getJSONObject("data")
        val dimArray = data.optJSONArray("dimensions") ?: JSONArray()
        val dimensions = buildList {
            for (i in 0 until dimArray.length()) {
                val dim = dimArray.getJSONObject(i)
                add(VibeDimensionInfo(
                    name = dim.optString("name", ""),
                    score = dim.optInt("score", 0),
                    description = dim.optString("description", "")
                ))
            }
        }
        return VibeDimensionListResponse(dimensions = dimensions)
    }

    suspend fun preferences(token: String, dimensionNames: List<String>): VibeGraphResponse {
        val body = JSONObject().put("dimensions", JSONObject().apply {
            dimensionNames.forEach { put(it, true) }
        })
        val data = YugmHttpClient.post("/vibe/preferences", token, body).getJSONObject("data")
        val vibeGraph = data.optJSONObject("vibeGraph") ?: data
        return VibeGraphResponse(vibeGraph = vibeGraph.toVibeGraph())
    }

    private fun JSONObject.toVibeGraph(): VibeGraph {
        val dims = optJSONObject("dimensions")
        return VibeGraph(
            userId = optString("userId", ""),
            dimensions = dims?.toVibeDimensions() ?: VibeDimensions(),
            edgeHistory = optJSONArray("edgeHistory")?.let { arr ->
                buildList {
                    for (i in 0 until arr.length()) {
                        val edge = arr.getJSONObject(i)
                        add(VibeEdge(
                            targetUserId = edge.optString("targetUserId", ""),
                            score = edge.optInt("score", 0),
                            trend = edge.optString("trend", "stable"),
                            createdAt = edge.optString("createdAt", "")
                        ))
                    }
                }
            } ?: emptyList(),
            lastCalculated = optString("lastCalculated", ""),
            createdAt = optString("createdAt", ""),
            updatedAt = optString("updatedAt", "")
        )
    }

    private fun JSONObject.toVibeDimensions(): VibeDimensions = VibeDimensions(
        compatibility = optDimensionScore("compatibility"),
        humor = optDimensionScore("humor"),
        conversationStyle = optDimensionScore("conversationStyle"),
        energy = optDimensionScore("energy"),
        gaming = optDimensionScore("gaming"),
        music = optDimensionWithList("music"),
        movies = optDimensionWithList("movies"),
        language = optDimensionWithList("language"),
        lateNight = optDimensionScore("lateNight"),
        career = optCareer("career"),
        relationshipIntent = optRelationshipIntent("relationshipIntent"),
        travel = optDimensionWithList("travel"),
        food = optDimensionWithList("food"),
        personalityType = optStringValue("personalityType"),
        attachmentStyle = optStringValue("attachmentStyle"),
        loveLanguage = optStringValue("loveLanguage"),
        communicationStyle = optStringValue("communicationStyle"),
        interestSimilarity = optDimensionScore("interestSimilarity"),
        mood = optMood("mood"),
        sleepSchedule = optDimensionScore("sleepSchedule"),
        learningStyle = optStringValue("learningStyle")
    )

    private fun JSONObject.optDimensionScore(key: String): VibeDimensionScore {
        val obj = optJSONObject(key) ?: return VibeDimensionScore()
        return VibeDimensionScore(
            score = obj.optInt("score", 0),
            updatedAt = obj.optString("updatedAt", "")
        )
    }

    private fun JSONObject.optDimensionWithList(key: String): VibeDimensionWithList {
        val obj = optJSONObject(key) ?: return VibeDimensionWithList()
        return VibeDimensionWithList(
            score = obj.optInt("score", 0),
            items = obj.optJSONArray("items")?.toStringList() ?: obj.optJSONArray("genres")?.toStringList()
                ?: obj.optJSONArray("preferences")?.toStringList() ?: obj.optJSONArray("preferred")?.toStringList() ?: emptyList(),
            updatedAt = obj.optString("updatedAt", "")
        )
    }

    private fun JSONObject.optCareer(key: String): VibeCareer {
        val obj = optJSONObject(key) ?: return VibeCareer()
        return VibeCareer(
            score = obj.optInt("score", 0),
            field = obj.optString("field", ""),
            updatedAt = obj.optString("updatedAt", "")
        )
    }

    private fun JSONObject.optRelationshipIntent(key: String): RelationshipIntent {
        val obj = optJSONObject(key) ?: return RelationshipIntent()
        return RelationshipIntent(
            type = obj.optString("type", "exploring"),
            updatedAt = obj.optString("updatedAt", "")
        )
    }

    private fun JSONObject.optStringValue(key: String): VibeStringValue {
        val obj = optJSONObject(key) ?: return VibeStringValue()
        return VibeStringValue(
            value = obj.optString("value", "").ifBlank { obj.optString("type", "") },
            updatedAt = obj.optString("updatedAt", "")
        )
    }

    private fun JSONObject.optMood(key: String): VibeMood {
        val obj = optJSONObject(key) ?: return VibeMood()
        return VibeMood(
            score = obj.optInt("score", 0),
            current = obj.optString("current", ""),
            updatedAt = obj.optString("updatedAt", "")
        )
    }

    private fun JSONObject.toMapStringInt(): Map<String, Int> = buildMap {
        keys().forEach { key ->
            val value = opt(key)
            if (value is Int) put(key, value)
        }
    }

    private fun org.json.JSONArray.toStringList(): List<String> = buildList {
        for (i in 0 until length()) add(getString(i))
    }
}
