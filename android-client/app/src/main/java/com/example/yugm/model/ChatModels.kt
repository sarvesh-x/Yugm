package com.example.yugm.model

data class ChatMessage(val author: String, val text: String)

data class RelationshipStatus(
    val level: Int = 1,
    val title: String = "First Spark",
    val xp: Int = 0,
    val progress: Float = 0f,
    val progressXp: Int = 0,
    val requiredXp: Int = 50,
    val nextLevel: Int? = 2,
    val nextPerk: String = "",
    val streakDays: Int = 0
)

data class DirectMessage(
    val id: String = "",
    val senderId: String = "",
    val receiverId: String = "",
    val message: String = "",
    val createdAt: String = "",
    val read: Boolean = false,
    val reactionCount: Int = 0,
    val mediaUrl: String = "",
    val mediaType: String = ""
)

data class Conversation(
    val messages: List<DirectMessage> = emptyList(),
    val relationship: RelationshipStatus? = null
)

data class NotificationItem(
    val id: String,
    val type: String,
    val message: String,
    val actorName: String,
    val actorId: String = "",
    val partnerId: String = "",
    val roomId: String = "",
    val read: Boolean = false,
    val createdAt: String = ""
)

data class NotificationPreferences(
    val values: Map<String, Boolean> = emptyMap()
)
