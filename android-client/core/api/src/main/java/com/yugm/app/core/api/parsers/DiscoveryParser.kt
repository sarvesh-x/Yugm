package com.yugm.app.core.api.parsers

import com.yugm.app.core.model.ExperienceFeedItem
import com.yugm.app.core.model.ExperienceHome
import com.yugm.app.core.model.LevelStatus
import com.yugm.app.core.model.ProfileCompletion
import org.json.JSONArray
import org.json.JSONObject

fun JSONObject.toExperienceFeedItem(): ExperienceFeedItem = ExperienceFeedItem(
    type = optString("type", ""),
    title = optString("title", ""),
    room = optJSONObject("room")?.toRoom(),
    user = optJSONObject("user")?.toHost()
)

fun JSONArray.toExperienceFeedItems(): List<ExperienceFeedItem> = buildList {
    for (index in 0 until length()) add(getJSONObject(index).toExperienceFeedItem())
}

fun JSONObject.toExperienceHome(): ExperienceHome {
    val roomsJson = optJSONObject("rooms") ?: JSONObject()
    val peopleJson = optJSONObject("people") ?: JSONObject()
    val notificationsJson = optJSONObject("notifications") ?: JSONObject()
    return ExperienceHome(
        userRole = optJSONObject("user")?.optString("role", "USER") ?: "USER",
        profileCompletion = optJSONObject("profileCompletion")?.toProfileCompletion() ?: ProfileCompletion(),
        level = optJSONObject("level")?.toLevelStatus() ?: LevelStatus(),
        streakCount = optJSONObject("user")?.optInt("streakCount", 0) ?: 0,
        achievements = optJSONArray("achievements")?.toAchievements() ?: emptyList(),
        feed = optJSONArray("feed")?.toExperienceFeedItems() ?: emptyList(),
        liveRooms = roomsJson.optJSONArray("live")?.toRooms() ?: emptyList(),
        scheduledRooms = roomsJson.optJSONArray("scheduled")?.toRooms() ?: emptyList(),
        followingRooms = roomsJson.optJSONArray("following")?.toRooms() ?: emptyList(),
        suggestedHosts = peopleJson.optJSONArray("suggestedHosts")?.toHosts() ?: emptyList(),
        unreadNotifications = notificationsJson.optInt("unreadCount", 0)
    )
}
