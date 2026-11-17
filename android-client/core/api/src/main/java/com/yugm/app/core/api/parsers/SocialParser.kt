package com.yugm.app.core.api.parsers

import com.yugm.app.core.model.Clan
import com.yugm.app.core.model.ClanMemberRole
import com.yugm.app.core.model.ClanMessage
import com.yugm.app.core.model.ClanReaction
import com.yugm.app.core.model.ClanSummary
import com.yugm.app.core.model.NotificationItem
import org.json.JSONArray
import org.json.JSONObject

fun JSONArray.toNotificationItems(): List<NotificationItem> = buildList {
    for (index in 0 until length()) {
        val item = getJSONObject(index)
        add(item.toNotificationItem())
    }
}

fun JSONObject.toNotificationItem(): NotificationItem {
    val data = optJSONObject("data") ?: optJSONObject("metadata") ?: JSONObject()
    return NotificationItem(
        id = optString("_id", optString("id", "")),
        type = optString("type", data.optString("type", "SYSTEM")),
        message = optString("body", optString("message", "")),
        actorName = optString("title", optString("actorName", "")),
        actorId = data.optString("userId", data.optString("actorId", "")),
        partnerId = data.optString("partnerId", ""),
        roomId = data.optString("roomId", ""),
        inviteId = data.optString("inviteId", ""),
        clanId = data.optString("clanId", ""),
        achievementId = data.optString("achievementId", ""),
        actionType = data.optString("type", ""),
        callType = data.optString("callType", ""),
        read = optBoolean("read", false),
        createdAt = optString("createdAt", "")
    )
}

fun JSONObject.toClan(): Clan = Clan(
    id = optString("_id", optString("id", "")),
    name = optString("name", "Family"),
    slug = optString("slug", ""),
    description = optString("description", ""),
    avatar = if (has("avatar") && !isNull("avatar")) optString("avatar") else null,
    familyLabel = optString("familyLabel", "Family"),
    privacy = optString("privacy", "PUBLIC"),
    memberCount = optInt("memberCount", 0),
    ownerId = optString("ownerId", ""),
    members = optJSONArray("members")?.toHosts() ?: emptyList(),
    memberRoles = optJSONArray("memberRoles")?.toClanMemberRoles() ?: emptyList(),
    myRole = optString("myRole", ""),
    canManage = optBoolean("canManage", false),
    canModerate = optBoolean("canModerate", false),
    canInvite = optBoolean("canInvite", false),
    isMember = optBoolean("isMember", false),
    isOwner = optBoolean("isOwner", false)
)

fun JSONArray.toClanMemberRoles(): List<ClanMemberRole> = buildList {
    for (index in 0 until length()) {
        val item = optJSONObject(index) ?: continue
        add(ClanMemberRole(
            userId = item.optString("userId", ""),
            role = item.optString("role", "MEMBER")
        ))
    }
}

fun JSONObject.toClanMessage(): ClanMessage = ClanMessage(
    id = optString("_id", optString("id", "")),
    clanId = optString("clanId", ""),
    senderId = optJSONObject("senderId")?.toHost(),
    message = optString("message", ""),
    reactions = optJSONArray("reactions")?.toClanReactions() ?: emptyList(),
    createdAt = optString("createdAt", "")
)

fun JSONArray.toClanMessages(): List<ClanMessage> = buildList {
    for (index in 0 until length()) {
        add(getJSONObject(index).toClanMessage())
    }
}

fun JSONObject.toClanReaction(): ClanReaction = ClanReaction(
    userId = optString("userId", ""),
    type = optString("type", ""),
    createdAt = optString("createdAt", "")
)

fun JSONArray.toClanReactions(): List<ClanReaction> = buildList {
    for (index in 0 until length()) {
        add(getJSONObject(index).toClanReaction())
    }
}fun JSONObject.toClanSummary(): ClanSummary = ClanSummary(
    id = optString("_id", optString("id", "")),
    name = optString("name", "Family"),
    slug = optString("slug", ""),
    avatar = if (has("avatar") && !isNull("avatar")) optString("avatar") else null,
    familyLabel = optString("familyLabel", ""),
    memberCount = optInt("memberCount", 0)
)
