package com.example.yugm.core.api.parsers

import com.example.yugm.core.model.*
import org.json.JSONObject

fun JSONObject.toModerationCheckTextResponse(): ModerationCheckTextResponse {
    val scores = optJSONObject("toxicityScores")
    return ModerationCheckTextResponse(
        text = optString("text", ""),
        context = optString("context", "chat"),
        isClean = optBoolean("isClean", true),
        isBlocked = optBoolean("isBlocked", false),
        severity = optString("severity", "LOW"),
        keywordFlags = optJSONArray("keywordFlags")?.let { arr ->
            buildList { for (i in 0 until arr.length()) add(arr.getString(i)) }
        } ?: emptyList(),
        aiFlags = optJSONArray("aiFlags")?.let { arr ->
            buildList { for (i in 0 until arr.length()) add(arr.getString(i)) }
        } ?: emptyList(),
        toxicityScores = ToxicityScores(
            toxicity = scores?.optDouble("toxicity", 0.0) ?: 0.0,
            severeToxicity = scores?.optDouble("severeToxicity", 0.0) ?: 0.0,
            identityAttack = scores?.optDouble("identityAttack", 0.0) ?: 0.0,
            insult = scores?.optDouble("insult", 0.0) ?: 0.0,
            threat = scores?.optDouble("threat", 0.0) ?: 0.0,
            sexuallyExplicit = scores?.optDouble("sexuallyExplicit", 0.0) ?: 0.0,
        ),
        topLabel = optString("topLabel", null),
        aiModelReady = optBoolean("aiModelReady", false),
        aiModelLoading = optBoolean("aiModelLoading", false),
    )
}

fun JSONObject.toModerationStatusResponse(): ModerationStatusResponse {
    val actions = optJSONArray("recentActions")
    return ModerationStatusResponse(
        trustScore = optInt("trustScore", 100),
        riskLevel = optString("riskLevel", "LOW"),
        isShadowBanned = optBoolean("isShadowBanned", false),
        isChatRestricted = optBoolean("isChatRestricted", false),
        isRoomRestricted = optBoolean("isRoomRestricted", false),
        isWalletFrozen = optBoolean("isWalletFrozen", false),
        moderationStrikes = optInt("moderationStrikes", 0),
        moderationReason = optString("moderationReason", null),
        warningCount = optInt("warningCount", 0),
        reportCount = optInt("reportCount", 0),
        suspensionCount = optInt("suspensionCount", 0),
        pendingAppeals = optInt("pendingAppeals", 0),
        recentActions = actions?.let { arr ->
            buildList {
                for (i in 0 until arr.length()) {
                    add(arr.getJSONObject(i).toModerationActionItem())
                }
            }
        } ?: emptyList(),
    )
}

fun JSONObject.toModerationActionItem(): ModerationActionItem = ModerationActionItem(
    id = optString("_id", "") ?: entityId(),
    action = optString("action", ""),
    reason = optString("reason", ""),
    automated = optBoolean("automated", false),
    createdAt = optString("createdAt", ""),
    expiresAt = optString("expiresAt", null),
)
