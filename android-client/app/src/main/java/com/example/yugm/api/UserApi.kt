package com.example.yugm.api

import com.example.yugm.model.Conversation
import com.example.yugm.model.DailyCheckInResult
import com.example.yugm.model.DirectMessage
import com.example.yugm.model.Host
import com.example.yugm.model.LevelStatus
import com.example.yugm.model.NotificationItem
import com.example.yugm.model.NotificationPreferences
import com.example.yugm.model.Room
import com.example.yugm.model.RoomType
import com.example.yugm.model.YugmUser
import org.json.JSONArray
import org.json.JSONObject

object UserApi {
    suspend fun updateProfile(
        token: String,
        name: String,
        username: String,
        bio: String? = null,
        city: String? = null,
        interests: List<String>? = null,
        languages: List<String>? = null,
        gender: String? = null,
        age: Int? = null,
        lookingFor: String? = null,
        avatar: String? = null
    ): YugmUser {
        val body = JSONObject()
            .put("name", name)
            .put("username", username.lowercase().replace(" ", "_"))
        if (city != null) body.put("city", city)
        if (bio != null) body.put("bio", bio)
        if (interests != null) body.put("interests", JSONArray(interests))
        if (languages != null) body.put("languages", JSONArray(languages))
        if (gender != null) body.put("gender", gender)
        if (age != null) body.put("age", age)
        if (lookingFor != null) body.put("lookingFor", lookingFor)
        if (avatar != null) body.put("avatar", avatar)
        return YugmHttpClient.patch("/users/me", token, body).getJSONObject("data").getJSONObject("user").toUser()
    }

    suspend fun searchUsers(query: String, token: String? = null): List<Host> {
        val encoded = java.net.URLEncoder.encode(query, "UTF-8")
        val data = YugmHttpClient.get("/users/search?q=$encoded", auth = token).getJSONObject("data")
        return data.getJSONArray("users").toHosts()
    }

    suspend fun getUser(userId: String, token: String? = null): Host {
        val data = YugmHttpClient.get("/users/$userId", auth = token).getJSONObject("data")
        return data.getJSONObject("user").toHost()
    }

    suspend fun getUserRooms(userId: String, token: String? = null): List<Room> {
        val data = YugmHttpClient.get("/users/$userId/rooms", auth = token).getJSONObject("data")
        return data.getJSONArray("rooms").toRooms()
    }

    suspend fun getFollowers(userId: String, token: String? = null): List<Host> {
        val data = YugmHttpClient.get("/users/$userId/followers", auth = token).getJSONObject("data")
        return data.getJSONArray("followers").toHosts()
    }

    suspend fun getFollowing(userId: String, token: String? = null): List<Host> {
        val data = YugmHttpClient.get("/users/$userId/following", auth = token).getJSONObject("data")
        return data.getJSONArray("following").toHosts()
    }

    suspend fun followUser(token: String, userId: String) {
        YugmHttpClient.post("/users/$userId/follow", token, JSONObject())
    }

    suspend fun unfollowUser(token: String, userId: String) {
        YugmHttpClient.delete("/users/$userId/follow", token)
    }

    suspend fun blockUser(userId: String, token: String) {
        YugmHttpClient.post("/users/$userId/block", token, JSONObject())
    }

    suspend fun unblockUser(userId: String, token: String) {
        YugmHttpClient.delete("/users/$userId/block", token)
    }

    suspend fun getBlockedUsers(token: String): List<Host> {
        val data = YugmHttpClient.get("/users/me/blocked", token).getJSONObject("data")
        return data.getJSONArray("users").toHosts()
    }

    suspend fun closeFriends(token: String): List<Host> {
        val data = YugmHttpClient.get("/users/me/close-friends", token).getJSONObject("data")
        return data.optJSONArray("users")?.toHosts() ?: emptyList()
    }

    suspend fun getNotifications(token: String): Pair<List<NotificationItem>, Int> {
        val data = YugmHttpClient.get("/notifications", token).getJSONObject("data")
        val list = data.getJSONArray("notifications").toNotificationItems()
        val unread = data.optInt("unreadCount", 0)
        return Pair(list, unread)
    }

    suspend fun markNotificationRead(token: String, notificationId: String) {
        YugmHttpClient.patch("/notifications/$notificationId/read", token, JSONObject())
    }

    suspend fun markAllNotificationsRead(token: String) {
        YugmHttpClient.post("/notifications/read-all", token, JSONObject())
    }

    suspend fun reportUser(token: String, roomId: String, targetUserId: String, reason: String) {
        val body = JSONObject().put("targetUserId", targetUserId).put("reason", reason)
        if (roomId.isBlank()) {
            YugmHttpClient.post("/reports", token, body)
        } else {
            YugmHttpClient.post("/rooms/$roomId/report", token, body.put("roomId", roomId))
        }
    }

    suspend fun sendFeedback(token: String, subject: String, message: String, category: String = "OTHER") {
        YugmHttpClient.post(
            "/users/me/feedback",
            token,
            JSONObject()
                .put("category", category)
                .put("subject", subject)
                .put("message", message)
        )
    }

    suspend fun registerFcmToken(token: String, fcmToken: String) {
        YugmHttpClient.post("/notifications/device-token", token, JSONObject().put("token", fcmToken).put("platform", "android"))
    }

    suspend fun level(token: String): LevelStatus {
        return YugmHttpClient.get("/users/me/level", token).getJSONObject("data").getJSONObject("level").toLevelStatus()
    }

    suspend fun checkIn(token: String): DailyCheckInResult {
        val data = YugmHttpClient.post("/users/me/check-in", token, JSONObject()).getJSONObject("data")
        return DailyCheckInResult(
            alreadyClaimed = data.optBoolean("alreadyClaimed", false),
            xpAwarded = data.optInt("xpAwarded", 0),
            levelUpReward = data.optInt("levelUpReward", 0),
            level = data.optJSONObject("level")?.toLevelStatus() ?: LevelStatus(),
            balance = data.optInt("walletBalance", data.optInt("balance", 0))
        )
    }

    suspend fun notificationPreferences(token: String): NotificationPreferences {
        val data = YugmHttpClient.get("/experience/notification-preferences", token).getJSONObject("data")
        val prefs = data.optJSONObject("preferences") ?: JSONObject()
        return NotificationPreferences(prefs.toBooleanMap())
    }

    suspend fun updateNotificationPreferences(token: String, preferences: Map<String, Boolean>): NotificationPreferences {
        val body = JSONObject()
        preferences.forEach { (key, value) -> body.put(key, value) }
        val data = YugmHttpClient.put("/experience/notification-preferences", token, body).getJSONObject("data")
        val prefs = data.optJSONObject("preferences") ?: JSONObject()
        return NotificationPreferences(prefs.toBooleanMap())
    }

    suspend fun conversation(token: String, userId: String): Conversation {
        val data = YugmHttpClient.get("/users/messages/$userId", token).getJSONObject("data")
        return Conversation(
            messages = data.optJSONArray("messages")?.toDirectMessages() ?: emptyList(),
            relationship = data.optJSONObject("relationship")?.toRelationshipStatus()
        )
    }

    suspend fun sendDirectMessage(token: String, userId: String, message: String): Conversation {
        val data = YugmHttpClient.post("/users/messages/$userId", token, JSONObject().put("message", message)).getJSONObject("data")
        val direct = data.optJSONObject("message")?.toDirectMessage()
        return Conversation(
            messages = if (direct != null) listOf(direct) else emptyList(),
            relationship = data.optJSONObject("relationship")?.toRelationshipStatus()
        )
    }

    suspend fun sendDirectMediaMessage(token: String, userId: String, mediaUrl: String, mediaType: String, caption: String = ""): Conversation {
        val data = YugmHttpClient.post(
            "/users/messages/$userId",
            token,
            JSONObject().put("message", caption).put("mediaUrl", mediaUrl).put("mediaType", mediaType)
        ).getJSONObject("data")
        val direct = data.optJSONObject("message")?.toDirectMessage()
        return Conversation(
            messages = if (direct != null) listOf(direct) else emptyList(),
            relationship = data.optJSONObject("relationship")?.toRelationshipStatus()
        )
    }

    suspend fun startPrivateCall(token: String, userId: String, type: RoomType): Room {
        val data = YugmHttpClient.post(
            "/users/messages/$userId/call",
            token,
            JSONObject().put("type", if (type == RoomType.Video) "VIDEO" else "VOICE")
        ).getJSONObject("data")
        return data.getJSONObject("room").toRoom()
    }

    suspend fun reactToDirectMessage(token: String, userId: String, messageId: String, type: String = "heart"): DirectMessage {
        val data = YugmHttpClient.post(
            "/users/messages/$userId/$messageId/reactions",
            token,
            JSONObject().put("type", type)
        ).getJSONObject("data")
        return data.getJSONObject("message").toDirectMessage()
    }

    suspend fun markAllMessagesRead(token: String) {
        YugmHttpClient.post("/users/messages/read-all", token, JSONObject())
    }

    suspend fun getRecentMessages(token: String): List<DirectMessage> {
        val data = YugmHttpClient.get("/users/messages", token).getJSONObject("data")
        return data.getJSONArray("messages").toDirectMessages()
    }
}
