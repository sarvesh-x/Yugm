package com.example.yugm.model

data class VibeGraph(
    val userId: String = "",
    val interests: List<String> = emptyList(),
    val languages: List<String> = emptyList(),
    val city: String = "",
    val vibeScore: Int = 50,
    val totalInteractions: Int = 0
)

data class VibeCompatibility(
    val score: Int = 0,
    val label: String = "New Connection",
    val sharedInterests: List<String> = emptyList(),
    val sharedLanguages: List<String> = emptyList(),
    val sameCity: Boolean = false
)

data class VibeMatchResponse(
    val compatibility: VibeCompatibility = VibeCompatibility(),
    val vibe: VibeSummary? = null,
    val targetUser: VibeTargetUser? = null
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
    val message: String? = null
)
