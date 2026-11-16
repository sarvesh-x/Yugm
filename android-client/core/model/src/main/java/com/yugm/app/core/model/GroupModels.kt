package com.yugm.app.core.model

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
    val memberRoles: List<ClanMemberRole> = emptyList(),
    val myRole: String = "",
    val canManage: Boolean = false,
    val canModerate: Boolean = false,
    val canInvite: Boolean = false,
    val isMember: Boolean = false,
    val isOwner: Boolean = false
)

data class ClanMemberRole(
    val userId: String = "",
    val role: String = "MEMBER"
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

data class ClanInvitation(
    val id: String = "",
    val clanId: String = "",
    val clanName: String = "Clan",
    val clanAvatar: String? = null,
    val inviterName: String = "",
    val expiresAt: String = ""
)

data class ClanSentInvitation(
    val id: String = "",
    val inviteeId: String = "",
    val inviteeName: String = "",
    val inviteeUsername: String = "",
    val inviteeAvatar: String? = null,
    val inviterName: String = "",
    val createdAt: String = "",
    val expiresAt: String = ""
)

data class ClanRankingEntry(
    val id: String = "",
    val rank: Int = 0,
    val name: String = "",
    val avatar: String? = null,
    val familyLabel: String = "",
    val memberCount: Int = 0,
    val totalXp: Long = 0
)