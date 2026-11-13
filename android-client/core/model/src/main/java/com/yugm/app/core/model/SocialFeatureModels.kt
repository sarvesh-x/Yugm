package com.yugm.app.core.model

data class UserMood(
    val userId: String = "",
    val mood: String = "",
    val emoji: String = "",
    val activity: String = "",
    val activityRoomId: String? = null,
    val isActive: Boolean = true
)

data class MoodOption(
    val mood: String = "",
    val emoji: String = ""
)

data class WaveNudge(
    val id: String = "",
    val senderId: WaveSender? = null,
    val receiverId: String = "",
    val type: String = "wave",
    val read: Boolean = false,
    val roomId: String? = null,
    val createdAt: String = ""
)

data class WaveSender(
    val _id: String = "",
    val name: String = "",
    val username: String = "",
    val avatar: String? = null
)

data class UnreadWaveCount(
    val count: Int = 0
)

data class DailyQuestion(
    val id: String = "",
    val question: String = "",
    val category: String = "general",
    val date: String = ""
)

data class DailyQuestionAnswer(
    val id: String = "",
    val userId: String = "",
    val userName: String = "",
    val userAvatar: String? = null,
    val questionId: String = "",
    val answer: String = "",
    val isPublic: Boolean = true,
    val createdAt: String = ""
)

data class VoicePollOption(
    val text: String = "",
    val audioUrl: String? = null,
    val votes: Int = 0
)

data class VoicePoll(
    val id: String = "",
    val userId: String = "",
    val userName: String = "",
    val userAvatar: String? = null,
    val question: String = "",
    val audioUrl: String = "",
    val duration: Int = 0,
    val options: List<VoicePollOption> = emptyList(),
    val voters: List<String> = emptyList(),
    val isActive: Boolean = true,
    val expiresAt: String = "",
    val createdAt: String = ""
)

data class VoicePollListResponse(
    val polls: List<VoicePoll> = emptyList(),
    val total: Int = 0,
    val page: Int = 1,
    val limit: Int = 20
)

data class CountdownEvent(
    val id: String = "",
    val title: String = "",
    val description: String = "",
    val targetDate: String = "",
    val type: String = "event",
    val coverImage: String? = null,
    val color: String = "#E91E63",
    val isActive: Boolean = true
)

data class DailyQuestionResponse(
    val question: DailyQuestion? = null
)

data class DailyQuestionAnswerResponse(
    val answer: DailyQuestionAnswer? = null
)

data class DailyQuestionAnswersResponse(
    val answers: List<DailyQuestionAnswer> = emptyList()
)
