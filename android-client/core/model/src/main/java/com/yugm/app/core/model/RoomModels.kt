package com.yugm.app.core.model

import androidx.compose.ui.graphics.Color

data class Room(
    val id: String = "",
    val title: String = "",
    val description: String = "",
    val bio: String = "",
    val type: RoomType = RoomType.Voice,
    val status: String = "LIVE",
    val scheduledFor: String = "",
    val coverImage: String? = null,
    val host: Host? = null,
    val category: String = "",
    val language: String = "",
    val tags: List<String> = emptyList(),
    val participants: Int = 0,
    val maxSpeakers: Int = 6,
    val gradient: List<Color> = emptyList(),
    val theme: String = "",
    val vipOnly: Boolean = false,
    val badge: String = "",
    val ambience: String = "",
    val micLocked: Boolean = false,
    val lockedSeatIndices: List<Int> = emptyList(),
    val allowAudienceMicRequests: Boolean = true,
    val mode: String? = null
)

enum class RoomType { Voice, Video }

data class RoomParticipant(
    val id: String = "",
    val user: Host = Host(),
    val role: String = "AUDIENCE",
    val isRoomAdmin: Boolean = false,
    val micEnabled: Boolean = true,
    val moderatorMuted: Boolean = false,
    val cameraEnabled: Boolean = false,
    val seatIndex: Int? = null
)

data class SpeakerRequest(
    val id: String = "",
    val user: Host = Host()
)

data class RoomDetail(
    val room: Room = Room(),
    val participants: List<RoomParticipant> = emptyList(),
    val speakerRequests: List<SpeakerRequest> = emptyList()
)

data class PollOption(
    val text: String = "",
    val votes: Int = 0
)

data class RoomPoll(
    val id: String = "",
    val question: String = "",
    val options: List<PollOption> = emptyList(),
    val isActive: Boolean = true
)

data class RoomMission(
    val id: String = "",
    val title: String = "",
    val progress: Int = 0,
    val target: Int = 0,
    val reward: Int = 0,
    val complete: Boolean = false
)

data class RoomActivityItem(
    val id: String = "",
    val label: String = "",
    val type: String = "",
    val createdAt: String = ""
)

data class RoomGiftEvent(
    val id: String = "",
    val giftName: String = "",
    val giftIcon: String = "",
    val senderName: String = "",
    val receiverName: String = ""
)

data class RoomLeaderboard(
    val topRooms: List<Room> = emptyList(),
    val topHosts: List<Host> = emptyList()
)
