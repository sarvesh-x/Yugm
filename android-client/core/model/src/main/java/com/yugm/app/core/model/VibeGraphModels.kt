package com.yugm.app.core.model

data class VibeGraph(
    val userId: String = "",
    val dimensions: VibeDimensions = VibeDimensions(),
    val edgeHistory: List<VibeEdge> = emptyList(),
    val lastCalculated: String = "",
    val createdAt: String = "",
    val updatedAt: String = ""
)

data class VibeDimensions(
    val compatibility: VibeDimensionScore = VibeDimensionScore(),
    val humor: VibeDimensionScore = VibeDimensionScore(),
    val conversationStyle: VibeDimensionScore = VibeDimensionScore(),
    val energy: VibeDimensionScore = VibeDimensionScore(),
    val gaming: VibeDimensionScore = VibeDimensionScore(),
    val music: VibeDimensionWithList = VibeDimensionWithList(),
    val movies: VibeDimensionWithList = VibeDimensionWithList(),
    val language: VibeDimensionWithList = VibeDimensionWithList(),
    val lateNight: VibeDimensionScore = VibeDimensionScore(),
    val career: VibeCareer = VibeCareer(),
    val relationshipIntent: RelationshipIntent = RelationshipIntent(),
    val travel: VibeDimensionWithList = VibeDimensionWithList(),
    val food: VibeDimensionWithList = VibeDimensionWithList(),
    val personalityType: VibeStringValue = VibeStringValue(),
    val attachmentStyle: VibeStringValue = VibeStringValue(),
    val loveLanguage: VibeStringValue = VibeStringValue(),
    val communicationStyle: VibeStringValue = VibeStringValue(),
    val interestSimilarity: VibeDimensionScore = VibeDimensionScore(),
    val mood: VibeMood = VibeMood(),
    val sleepSchedule: VibeDimensionScore = VibeDimensionScore(),
    val learningStyle: VibeStringValue = VibeStringValue()
)

data class VibeDimensionScore(
    val score: Int = 0,
    val updatedAt: String = ""
)

data class VibeDimensionWithList(
    val score: Int = 0,
    val items: List<String> = emptyList(),
    val updatedAt: String = ""
)

data class VibeCareer(
    val score: Int = 0,
    val field: String = "",
    val updatedAt: String = ""
)

data class RelationshipIntent(
    val type: String = "exploring",
    val updatedAt: String = ""
)

data class VibeStringValue(
    val value: String = "",
    val updatedAt: String = ""
)

data class VibeMood(
    val score: Int = 0,
    val current: String = "",
    val updatedAt: String = ""
)

data class VibeEdge(
    val targetUserId: String = "",
    val score: Int = 0,
    val trend: String = "stable",
    val createdAt: String = ""
)

data class VibeCompatibility(
    val score: Int = 0,
    val label: String = "New Connection",
    val sharedInterests: List<String> = emptyList(),
    val sharedLanguages: List<String> = emptyList(),
    val sameCity: Boolean = false
)

data class VibeMatchResponse(
    val overallScore: Int = 0,
    val dimensionScores: Map<String, Int> = emptyMap(),
    val trend: String = "stable",
    val compatibility: VibeCompatibility = VibeCompatibility(),
    val vibe: VibeSummary? = null,
    val targetUser: VibeTargetUser? = null
)

data class VibeMatchUser(
    val user: VibeTargetUser = VibeTargetUser(),
    val scores: VibeMatchScores = VibeMatchScores()
)

data class VibeMatchScores(
    val overall: Int = 0,
    val compatibility: Int = 0,
    val interestSimilarity: Int = 0
)

data class VibeSummary(
    val score: Int = 0,
    val totalInteractions: Int = 0
)

data class VibeTargetUser(
    val id: String = "",
    val name: String = "",
    val avatar: String? = null,
    val username: String = "",
    val level: Int = 1,
    val levelTitle: String = "New Vibe"
)

data class VibeUpdateResponse(
    val vibeChange: Int = 0,
    val improved: Boolean = false,
    val message: String? = null,
    val vibe: VibeGraph? = null
)

data class VibeTrendResponse(
    val trend: String = "stable",
    val history: List<VibeTrendPoint> = emptyList()
)

data class VibeTrendPoint(
    val score: Int = 0,
    val date: String = ""
)

data class VibeDimensionInfo(
    val name: String = "",
    val score: Int = 0,
    val description: String = ""
)

data class VibeDimensionListResponse(
    val dimensions: List<VibeDimensionInfo> = emptyList()
)

data class VibeGraphResponse(
    val vibeGraph: VibeGraph = VibeGraph()
)

data class VibeMatchesResponse(
    val matches: List<VibeMatchUser> = emptyList()
)

data class VibeInitResponse(
    val vibe: VibeGraph = VibeGraph()
)
