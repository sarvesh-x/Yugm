package com.example.yugm.core.model

data class RoomModeInfo(
    val key: String = "",
    val name: String = "",
    val description: String = "",
    val icon: String = "",
    val minParticipants: Int = 2,
    val maxParticipants: Int = 10,
    val durationSeconds: Int = 300
)

data class RoomModeState(
    val roomId: String = "",
    val mode: String = "",
    val round: Int = 1,
    val status: String = "WAITING",
    val scores: Map<String, Int> = emptyMap(),
    val currentTurnUserId: String? = null,
    val currentQuestion: String? = null,
    val currentOptions: List<String>? = null,
    val participants: List<String> = emptyList(),
    val roundStartTime: String? = null,
    val roundEndTime: String? = null,
    val metadata: Map<String, Any> = emptyMap()
)
