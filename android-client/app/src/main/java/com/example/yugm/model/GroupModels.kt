package com.example.yugm.model

data class GroupChat(
    val id: String = "",
    val name: String = "",
    val createdBy: String = "",
    val createdByName: String = "",
    val createdByAvatar: String? = null,
    val participantIds: List<String> = emptyList(),
    val participantCount: Int = 0,
    val lastMessage: String? = null,
    val lastMessageAt: String? = null,
    val createdAt: String = ""
)

data class GroupMessage(
    val id: String = "",
    val groupId: String = "",
    val senderId: String = "",
    val senderName: String = "",
    val senderAvatar: String? = null,
    val message: String = "",
    val mediaUrl: String = "",
    val mediaType: String = "",
    val duration: Int = 0,
    val createdAt: String = ""
)

data class Clan(
    val id: String = "",
    val name: String = "",
    val slug: String = "",
    val description: String = "",
    val avatar: String? = null,
    val familyLabel: String = "",
    val privacy: String = "PUBLIC",
    val memberCount: Int = 0,
    val ownerId: String = "",
    val members: List<Host> = emptyList(),
    val isMember: Boolean = false
)

data class ClanMessage(
    val id: String = "",
    val clanId: String = "",
    val senderId: Host? = null,
    val message: String = "",
    val reactions: List<ClanReaction> = emptyList(),
    val createdAt: String = ""
)

data class ClanReaction(
    val userId: String = "",
    val type: String = "",
    val createdAt: String = ""
)

data class ClanSummary(
    val id: String = "",
    val name: String = "Family",
    val slug: String = "",
    val avatar: String? = null,
    val familyLabel: String = "",
    val memberCount: Int = 0
)
