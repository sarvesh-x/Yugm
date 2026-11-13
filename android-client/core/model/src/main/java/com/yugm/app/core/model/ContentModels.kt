package com.yugm.app.core.model

data class RoomRecording(
    val id: String = "",
    val roomId: String = "",
    val hostId: String = "",
    val hostName: String = "",
    val hostAvatar: String? = null,
    val title: String = "",
    val recordingUrl: String = "",
    val duration: Int = 0,
    val viewCount: Int = 0,
    val status: String = "PROCESSING",
    val createdAt: String = ""
)

data class YugmEvent(
    val id: String = "",
    val title: String = "",
    val description: String? = null,
    val hostId: String = "",
    val hostName: String = "",
    val hostAvatar: String? = null,
    val coverImage: String? = null,
    val category: String = "",
    val type: String = "",
    val eventDate: String = "",
    val eventEndDate: String? = null,
    val timezone: String? = null,
    val roomId: String? = null,
    val maxParticipants: Int? = null,
    val participantIds: List<String> = emptyList(),
    val tags: List<String> = emptyList(),
    val status: String = "UPCOMING",
    val festival: String = "none",
    val featured: Boolean = false,
    val createdAt: String = ""
)

data class EventPagination(
    val page: Int = 1,
    val limit: Int = 20,
    val total: Int = 0,
    val pages: Int = 1
)

data class MyEvents(
    val hosting: List<YugmEvent> = emptyList(),
    val joined: List<YugmEvent> = emptyList()
)

data class StoryUser(
    val _id: String = "",
    val name: String = "",
    val avatar: String? = null
)

data class StoryItem(
    val _id: String = "",
    val userId: String = "",
    val userName: String = "",
    val userAvatar: String? = null,
    val mediaUrl: String = "",
    val mediaType: String = "IMAGE",
    val caption: String? = null,
    val backgroundColor: String? = null,
    val textColor: String? = null,
    val viewCount: Int = 0,
    val likeCount: Int = 0,
    val replyCount: Int = 0,
    val isViewed: Boolean = false,
    val isLiked: Boolean = false,
    val createdAt: String = "",
    val expiresAt: String = ""
)

data class StoryGroup(
    val user: StoryUser = StoryUser(),
    val stories: List<StoryItem> = emptyList()
)

data class StoryCommentItem(
    val _id: String = "",
    val storyId: String = "",
    val userId: String = "",
    val userName: String = "",
    val userAvatar: String? = null,
    val parentId: String? = null,
    val text: String = "",
    val replies: List<StoryCommentItem> = emptyList(),
    val createdAt: String = ""
)

data class StoryHighlight(
    val id: String = "",
    val title: String = "",
    val coverMediaUrl: String? = null,
    val storyIds: List<String> = emptyList(),
    val createdAt: String = ""
)

data class WatchParty(
    val _id: String = "",
    val roomId: String = "",
    val hostId: String = "",
    val title: String = "",
    val mediaUrl: String = "",
    val position: Double = 0.0,
    val isPlaying: Boolean = false,
    val createdAt: String = ""
)
