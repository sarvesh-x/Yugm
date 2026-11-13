package com.yugm.app.core.model

data class ChatMessage(
    val author: String,
    val text: String,
    val id: String = "",
    val authorId: String = "",
    val authorAvatar: String? = null,
    val createdAt: String = "",
    val mediaUrl: String? = null,
    val mediaType: String? = null,
    val mediaWidth: Int? = null,
    val mediaHeight: Int? = null,
    val replyTo: ChatReplyTo? = null,
    val mentions: List<String> = emptyList(),
    val reactions: Map<String, List<String>> = emptyMap(),
    val isGift: Boolean = false,
    val giftData: ChatGiftData? = null,
    val isSystem: Boolean = false,
    val isPinned: Boolean = false
)

data class ChatReplyTo(
    val messageId: String = "",
    val author: String = "",
    val authorId: String = "",
    val text: String = "",
    val mediaUrl: String? = null
)

data class ChatGiftData(
    val giftId: String = "",
    val giftName: String = "",
    val giftIcon: String = "",
    val giftValue: Int = 0,
    val receiverId: String = "",
    val receiverName: String = ""
)

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
    val sender: Host? = null,
    val receiver: Host? = null,
    val message: String = "",
    val createdAt: String = "",
    val read: Boolean = false,
    val reactionCount: Int = 0,
    val mediaUrl: String = "",
    val mediaType: String = "",
    val replyTo: ChatReplyTo? = null,
    val mentions: List<String> = emptyList()
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
