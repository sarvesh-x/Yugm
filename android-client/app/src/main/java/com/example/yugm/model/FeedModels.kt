package com.example.yugm.model

data class FeedItem(
    val type: String = "",
    val room: FeedRoom? = null,
    val story: StoryItem? = null,
    val activity: FeedActivity? = null,
    val createdAt: String = ""
)

data class FeedRoom(
    val _id: String = "",
    val title: String = "",
    val hostId: FeedUser? = null,
    val participantCount: Int = 0,
    val status: String = ""
)

data class FeedUser(
    val _id: String = "",
    val name: String = "",
    val username: String = "",
    val avatar: String? = null
)

data class FeedActivity(
    val _id: String = "",
    val userId: FeedUser? = null,
    val roomId: FeedRoomSummary? = null,
    val type: String = "",
    val createdAt: String = ""
)

data class FeedRoomSummary(
    val _id: String = "",
    val title: String = ""
)

data class FeedResponse(
    val feed: List<FeedItem> = emptyList()
)
