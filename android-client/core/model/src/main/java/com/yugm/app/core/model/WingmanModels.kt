package com.yugm.app.core.model

data class WingmanBioGenerateRequest(
    val currentBio: String? = null,
    val style: String = "warm",
    val interests: List<String>? = null,
    val tone: String = "casual",
)

data class WingmanBioGenerateResponse(
    val suggestion: String = "",
    val style: String = "",
    val tips: List<String> = emptyList(),
)

data class WingmanBioRateRequest(
    val bio: String,
)

data class WingmanBioRateResponse(
    val score: Int = 0,
    val rating: String = "",
    val feedback: List<String> = emptyList(),
    val suggestions: List<String> = emptyList(),
)

data class WingmanOpenerRequest(
    val targetUserContext: WingmanTargetContext = WingmanTargetContext(),
    val style: String = "casual",
)

data class WingmanTargetContext(
    val name: String? = null,
    val bio: String? = null,
    val interests: List<String>? = null,
    val vibeScore: Int? = null,
)

data class WingmanOpenerResponse(
    val openers: List<String> = emptyList(),
    val style: String = "",
    val tip: String = "",
)

data class WingmanReplyRequest(
    val conversation: List<WingmanMessage> = emptyList(),
    val style: String = "friendly",
)

data class WingmanMessage(
    val role: String,
    val content: String,
    val timestamp: String? = null,
)

data class WingmanReplyResponse(
    val suggestions: List<String> = emptyList(),
    val context: String = "",
    val deliveryTip: String = "",
)

data class WingmanCoachRequest(
    val chatHistory: List<WingmanCoachMessage> = emptyList(),
)

data class WingmanCoachMessage(
    val role: String,
    val content: String,
    val timestamp: String? = null,
)

data class WingmanCoachResponse(
    val analysis: WingmanConversationAnalysis = WingmanConversationAnalysis(),
    val tips: List<String> = emptyList(),
    val redFlags: List<String>? = null,
)

data class WingmanConversationAnalysis(
    val totalMessages: Int = 0,
    val yourMessageCount: Int = 0,
    val theirMessageCount: Int = 0,
    val yourAvgLength: Int = 0,
    val theirAvgLength: Int = 0,
    val engagement: Int = 0,
    val chemistry: String = "",
)

data class WingmanPhotoRateRequest(
    val photoUrl: String,
)

data class WingmanPhotoRateResponse(
    val score: Int = 0,
    val feedback: List<String> = emptyList(),
    val suggestions: List<String> = emptyList(),
)

data class WingmanGhostDetectRequest(
    val conversation: List<WingmanCoachMessage> = emptyList(),
)

data class WingmanGhostDetectResponse(
    val ghosting: Boolean = false,
    val confidence: Double = 0.0,
    val reason: String = "",
    val advice: List<String> = emptyList(),
)

data class WingmanDatePlanRequest(
    val preferences: WingmanDatePreferences = WingmanDatePreferences(),
)

data class WingmanDatePreferences(
    val budget: String = "medium",
    val vibe: String = "romantic",
    val location: String? = null,
    val interests: List<String>? = null,
)

data class WingmanDatePlanResponse(
    val plan: List<WingmanDateIdea> = emptyList(),
    val preferences: WingmanDatePreferences = WingmanDatePreferences(),
    val tip: String = "",
)

data class WingmanDateIdea(
    val name: String = "",
    val description: String = "",
    val vibe: String = "",
    val estimatedCost: String = "",
)

data class WingmanGiftRecommendRequest(
    val recipientContext: WingmanRecipientContext = WingmanRecipientContext(),
    val budget: String = "medium",
)

data class WingmanRecipientContext(
    val interests: List<String>? = null,
    val vibeScore: Int? = null,
    val relationship: String = "crush",
)

data class WingmanGiftRecommendResponse(
    val recommendations: List<WingmanGiftRecommendation> = emptyList(),
)

data class WingmanGiftRecommendation(
    val name: String = "",
    val reason: String = "",
    val category: String = "",
)

data class WingmanAnalyticsResponse(
    val totalHelped: Int = 0,
    val conversationsAnalyzed: Int = 0,
    val improvement: String = "",
    val topFeatures: List<String> = emptyList(),
)
