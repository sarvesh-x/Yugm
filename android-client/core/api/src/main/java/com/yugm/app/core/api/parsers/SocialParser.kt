package com.yugm.app.core.api.parsers

import com.yugm.app.core.model.Clan
import com.yugm.app.core.model.ClanMessage
import com.yugm.app.core.model.ClanReaction
import com.yugm.app.core.model.ClanSummary
import com.yugm.app.core.model.NotificationItem
import org.json.JSONArray
import org.json.JSONObject

fun JSONArray.toNotificationItems(): List<NotificationItem> = buildList {
    for (index in 0 until length()) {
        val item = getJSONObject(index)
        val metadata = item.optJSONObject("metadata") ?: JSONObject()
        add(NotificationItem(
            id = item.optString("_id", item.optString("id", "")),
            type = metadata.optString("type", item.optString("type", "general")),
            message = item.optString("body", item.optString("message", item.optString("title", ""))),
            actorName = item.optString("title", item.optString("actorName", "")),
            actorId = metadata.optString("userId", item.optString("actorId", "")),
            partnerId = metadata.optString("partnerId", item.optString("partnerId", "")),
            roomId = metadata.optString("roomId", item.optString("roomId", "")),
            read = item.optBoolean("read", false),
            createdAt = item.optString("createdAt", "")
        ))
    }
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
    isMember = optBoolean("isMember", false)
)

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
}

fun JSONObject.toClanSummary(): ClanSummary = ClanSummary(
    id = optString("_id", optString("id", "")),
    name = optString("name", "Family"),
    slug = optString("slug", ""),
    avatar = if (has("avatar") && !isNull("avatar")) optString("avatar") else null,
    familyLabel = optString("familyLabel", ""),
    memberCount = optInt("memberCount", 0)
)
