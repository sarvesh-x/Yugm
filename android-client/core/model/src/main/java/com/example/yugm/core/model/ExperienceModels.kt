package com.example.yugm.core.model

data class ExperienceFeedItem(
    val type: String = "",
    val title: String = "",
    val room: Room? = null,
    val user: Host? = null
)

data class ExperienceHome(
    val userRole: String = "USER",
    val profileCompletion: ProfileCompletion = ProfileCompletion(),
    val level: LevelStatus = LevelStatus(),
    val streakCount: Int = 0,
    val achievements: List<Achievement> = emptyList(),
    val feed: List<ExperienceFeedItem> = emptyList(),
    val liveRooms: List<Room> = emptyList(),
    val scheduledRooms: List<Room> = emptyList(),
    val followingRooms: List<Room> = emptyList(),
    val suggestedHosts: List<Host> = emptyList(),
    val unreadNotifications: Int = 0
)

data class CreatorDashboardSummary(
    val giftCoins: Int = 0,
    val giftCount: Int = 0,
    val uniqueSupporters: Int = 0,
    val hostedRooms: Int = 0,
    val participants: Int = 0,
    val uniqueParticipants: Int = 0,
    val averageParticipants: Double = 0.0,
    val estimatedInr: Double = 0.0
)

data class CreatorDashboard(
    val windowDays: Int = 30,
    val summary: CreatorDashboardSummary = CreatorDashboardSummary(),
    val rooms: List<Room> = emptyList(),
    val scheduledRooms: List<Room> = emptyList(),
    val nextSteps: List<String> = emptyList()
)
