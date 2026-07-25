package com.example.yugm.core.model

data class ModerationCheckTextRequest(
    val text: String,
    val context: String = "chat",
)

data class ToxicityScores(
    val toxicity: Double = 0.0,
    val severeToxicity: Double = 0.0,
    val identityAttack: Double = 0.0,
    val insult: Double = 0.0,
    val threat: Double = 0.0,
    val sexuallyExplicit: Double = 0.0,
)

data class ModerationCheckTextResponse(
    val text: String = "",
    val context: String = "chat",
    val isClean: Boolean = true,
    val isBlocked: Boolean = false,
    val severity: String = "LOW",
    val keywordFlags: List<String> = emptyList(),
    val aiFlags: List<String> = emptyList(),
    val toxicityScores: ToxicityScores = ToxicityScores(),
    val topLabel: String? = null,
    val aiModelReady: Boolean = false,
    val aiModelLoading: Boolean = false,
)

data class ModerationReportRequest(
    val targetUserId: String? = null,
    val roomId: String? = null,
    val messageId: String? = null,
    val category: String,
    val description: String? = null,
)

data class ModerationReportResponse(
    val reportId: String,
    val queueId: String,
    val status: String,
)

data class ModerationAppealRequest(
    val actionId: String,
    val reason: String,
)

data class ModerationAppealResponse(
    val appealId: String,
    val status: String,
)

data class ModerationActionItem(
    val id: String,
    val action: String,
    val reason: String,
    val automated: Boolean = false,
    val createdAt: String = "",
    val expiresAt: String? = null,
)

data class ModerationStatusResponse(
    val trustScore: Int = 100,
    val riskLevel: String = "LOW",
    val isShadowBanned: Boolean = false,
    val isChatRestricted: Boolean = false,
    val isRoomRestricted: Boolean = false,
    val isWalletFrozen: Boolean = false,
    val moderationStrikes: Int = 0,
    val moderationReason: String? = null,
    val warningCount: Int = 0,
    val reportCount: Int = 0,
    val suspensionCount: Int = 0,
    val pendingAppeals: Int = 0,
    val recentActions: List<ModerationActionItem> = emptyList(),
)
