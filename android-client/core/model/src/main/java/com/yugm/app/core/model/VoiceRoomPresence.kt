package com.yugm.app.core.model

data class VoiceRoomPresence(
    val isLive: Boolean = false,
    val roomId: String = "",
    val roomName: String? = null,
    val canJoin: Boolean = true,
    val presenceVersion: Long = 0L,
    val expiresAt: String? = null,
    val membershipId: String? = null,
    val role: String? = null,
    val joinedAt: String? = null,
    val participantCount: Int = 0,
    val privacySetting: String = "EVERYONE"
)

data class RoomJoinResult(
    val success: Boolean = true,
    val roomId: String = "",
    val membershipId: String = "",
    val role: String = "LISTENER",
    val joinStatus: String = "ADMITTED",
    val errorMessage: String? = null
)
