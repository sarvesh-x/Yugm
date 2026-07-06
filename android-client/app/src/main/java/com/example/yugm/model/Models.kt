package com.example.yugm.model

import androidx.compose.ui.graphics.Color

data class Host(
    val id: String = "",
    val name: String = "",
    val username: String = "",
    val city: String = "",
    val vibe: String = "",
    val followers: Int = 0,
    val followingCount: Int = 0,
    val bio: String = "",
    val avatar: String? = null,
    val isVip: Boolean = false,
    val vipTier: String = ""
)

data class Room(
    val id: String = "",
    val title: String = "",
    val description: String = "",
    val type: RoomType = RoomType.Voice,
    val host: Host? = null,
    val category: String = "",
    val language: String = "",
    val tags: List<String> = emptyList(),
    val participants: Int = 0,
    val maxSpeakers: Int = 6,
    val gradient: List<Color> = emptyList()
)

enum class RoomType { Voice, Video }

data class ChatMessage(val author: String, val text: String)

data class GiftItem(val id: String, val name: String, val price: Int)

data class YugmUser(
    val id: String = "",
    val name: String = "",
    val username: String = "",
    val walletBalance: Int = 0,
    val isVip: Boolean = false,
    val vipTier: String = ""
)

data class Session(val token: String, val user: YugmUser)

data class MediaSession(val token: String, val url: String, val roomName: String, val role: String)

data class WalletTransaction(
    val type: String = "",
    val amount: Int = 0,
    val description: String = "",
    val balanceAfter: Int = 0,
    val createdAt: String = ""
)

data class NotificationItem(
    val id: String,
    val type: String,
    val message: String,
    val actorName: String,
    val actorId: String = "",
    val roomId: String = "",
    val read: Boolean = false,
    val createdAt: String = ""
)
