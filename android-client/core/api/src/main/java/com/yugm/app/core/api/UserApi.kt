package com.yugm.app.core.api

import com.yugm.app.core.api.parsers.*
import com.yugm.app.core.model.Conversation
import com.yugm.app.core.model.DailyCheckInResult
import com.yugm.app.core.model.DirectMessage
import com.yugm.app.core.model.Host
import com.yugm.app.core.model.VipPrivacySettings
import com.yugm.app.core.model.LevelStatus
import com.yugm.app.core.model.NotificationItem
import com.yugm.app.core.model.NotificationPreferences
import com.yugm.app.core.model.PagedDirectMessages
import com.yugm.app.core.model.Room
import com.yugm.app.core.model.RoomType
import com.yugm.app.core.model.YugmUser
import com.yugm.app.core.model.UserFullInventory
import com.yugm.app.core.model.LevelOverview
import com.yugm.app.core.model.LevelLeaderboardEntry
import com.yugm.app.core.model.LevelLeaderboardPage
import org.json.JSONArray
import org.json.JSONObject

object UserApi {
    suspend fun getFriends(token: String): List<Host> {
        val data = YugmHttpClient.get("/users/me/friends", token).getJSONObject("data")
        return data.optJSONArray("users")?.toHosts() ?: emptyList()
    }
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
        avatar: String? = null,
        acceptTerms: Boolean = false,
        vibeLine: String? = null,
        hobbies: List<String>? = null,
        state: String? = null
    ): YugmUser {
        val body = JSONObject()
            .put("name", name)
            .put("username", username.lowercase().replace(" ", "_"))
        if (city != null) body.put("city", city)
        if (state != null) body.put("state", state)
        if (bio != null) body.put("bio", bio)
        if (interests != null) body.put("interests", JSONArray(interests))
        if (hobbies != null) body.put("hobbies", JSONArray(hobbies))
        if (languages != null) body.put("languages", JSONArray(languages))
        if (gender != null) body.put("gender", gender)
        if (age != null) body.put("age", age)
        if (lookingFor != null) body.put("lookingFor", lookingFor)
        if (avatar != null) body.put("avatar", avatar)
        if (vibeLine != null) body.put("vibeLine", vibeLine)
        if (acceptTerms) body.put("acceptTerms", true)
        return YugmHttpClient.patch("/users/me", token, body).getJSONObject("data").getJSONObject("user").toUser()
    }

    suspend fun searchUsers(query: String, token: String? = null, usernameOnly: Boolean = false): List<Host> {
        val encoded = java.net.URLEncoder.encode(query, "UTF-8")
        val scope = if (usernameOnly) "&scope=username" else ""
        val data = YugmHttpClient.get("/users/search?q=$encoded$scope", auth = token).getJSONObject("data")
        return data.getJSONArray("users").toHosts()
    }

    suspend fun getUser(userId: String, token: String? = null): Host {
        val path = if (token.isNullOrBlank()) "/users/public/$userId" else "/users/$userId"
        val data = YugmHttpClient.get(path, auth = token?.ifBlank { null }).getJSONObject("data")
        return data.getJSONObject("user").toHost()
    }

    suspend fun getPublicProfile(userId: String, token: String? = null): Host {
        val data = YugmHttpClient.get("/users/public/$userId", auth = token?.ifBlank { null }).getJSONObject("data")
        return data.getJSONObject("user").toHost()
    }

    suspend fun getPublicProfileByUsername(username: String, token: String? = null): Host {
        val clean = java.net.URLEncoder.encode(username.removePrefix("@"), "UTF-8")
        val data = YugmHttpClient.get("/users/by-username/$clean", auth = token?.ifBlank { null }).getJSONObject("data")
        return data.getJSONObject("user").toHost()
    }

    suspend fun fullInventory(token: String): UserFullInventory {
        val data = YugmHttpClient.get("/users/me/inventory", token).getJSONObject("data")
        return data.toUserFullInventory()
    }

    suspend fun levelOverview(token: String): LevelOverview {
        val data = YugmHttpClient.get("/users/me/level-overview", token).getJSONObject("data")
        return data.toLevelOverview()
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

    suspend fun getUserFriends(userId: String, token: String): List<Host> {
        val data = YugmHttpClient.get("/users/$userId/friends", token).getJSONObject("data")
        return data.getJSONArray("users").toHosts()
    }

    suspend fun getProfileVisitors(userId: String, token: String): List<Host> {
        val data = YugmHttpClient.get("/users/$userId/visitors", token).getJSONObject("data")
        return data.getJSONArray("users").toHosts()
    }

    suspend fun vipPrivacy(token: String): VipPrivacySettings = YugmHttpClient.get("/users/me/vip-privacy", token)
        .getJSONObject("data").toVipPrivacySettings()

    suspend fun updateVipPrivacy(token: String, settings: VipPrivacySettings): VipPrivacySettings = YugmHttpClient.patch(
        "/users/me/vip-privacy", token,
        JSONObject().put("mysteriousVisitors", settings.mysteriousVisitors).put("chatPrivacy", settings.chatPrivacy)
    ).getJSONObject("data").toVipPrivacySettings()

    suspend fun followUser(token: String, userId: String) {
        YugmHttpClient.post("/users/$userId/follow", token, JSONObject())
    }

    suspend fun unfollowUser(token: String, userId: String) {
        YugmHttpClient.delete("/users/$userId/follow", token)
    }

    suspend fun removeFollower(token: String, followerId: String) {
        YugmHttpClient.delete("/users/me/followers/$followerId", token)
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

    suspend fun removeFcmToken(token: String, fcmToken: String) {
        YugmHttpClient.post("/notifications/device-token/remove", token, JSONObject().put("token", fcmToken))
    }

    suspend fun deleteOwnAccount(token: String) {
        YugmHttpClient.delete("/users/me", token)
    }

    suspend fun level(token: String): LevelStatus {
        return YugmHttpClient.get("/users/me/level", token).getJSONObject("data").getJSONObject("level").toLevelStatus()
    }

    suspend fun checkIn(token: String): DailyCheckInResult {
        val data = YugmHttpClient.post("/users/me/check-in", token, JSONObject()).getJSONObject("data")
        return DailyCheckInResult(
            streak = data.optInt("streak", 0),
            claimed = !data.optBoolean("alreadyClaimed", true),
            unlockedCosmetic = data.optString("unlockedCosmetic", ""),
            xpAwarded = data.optInt("xpAwarded", 0),
            streakBonus = data.optInt("streakBonus", 0),
            levelUpReward = data.optInt("levelUpReward", 0),
            alreadyClaimed = data.optBoolean("alreadyClaimed", false),
            balance = if (data.has("balance") && !data.isNull("balance")) data.optInt("balance") else null,
            level = data.optJSONObject("level")?.toLevelStatus() ?: data.optJSONObject("levelStatus")?.toLevelStatus() ?: LevelStatus(),
            xpGrant = data.optJSONObject("xpGrant")?.let { receipt ->
                com.yugm.app.core.model.XpGrantReceipt(
                    event = receipt.optString("event", "DAILY_CHECKIN"),
                    xpAwarded = receipt.optInt("xpAwarded", 0),
                    capped = receipt.optBoolean("capped", false),
                    cap = if (receipt.has("cap") && !receipt.isNull("cap")) receipt.optInt("cap") else null,
                    earnedToday = if (receipt.has("earnedToday") && !receipt.isNull("earnedToday")) receipt.optInt("earnedToday") else null,
                    remainingToday = if (receipt.has("remainingToday") && !receipt.isNull("remainingToday")) receipt.optInt("remainingToday") else null,
                    levelUpReward = receipt.optInt("levelUpReward", 0),
                    levelsGained = receipt.optJSONArray("levelsGained")?.let { array -> List(array.length()) { index -> array.optInt(index) } }.orEmpty(),
                    level = receipt.optJSONObject("level")?.toLevelStatus() ?: LevelStatus()
                )
            },
            levelsGained = data.optJSONArray("levelsGained")?.let { array ->
                List(array.length()) { index -> array.optInt(index) }
            }.orEmpty()
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

    suspend fun conversation(token: String, userId: String, before: String? = null, limit: Int? = null, markRead: Boolean = true): Conversation {
        val query = buildList {
            if (!before.isNullOrBlank()) add("before=${java.net.URLEncoder.encode(before, "UTF-8")}")
            if (limit != null) add("limit=$limit")
            if (!markRead) add("markRead=false")
        }.joinToString("&")
        val path = if (query.isBlank()) "/users/messages/$userId" else "/users/messages/$userId?$query"
        val data = YugmHttpClient.get(path, token).getJSONObject("data")
        return Conversation(
            messages = data.optJSONArray("messages")?.toDirectMessages() ?: emptyList(),
            relationship = data.optJSONObject("relationship")?.toRelationshipStatus(),
            muted = data.optBoolean("muted", false),
            hasMore = data.optBoolean("hasMore", false),
            nextBefore = data.optString("nextBefore").takeIf { it.isNotBlank() && it != "null" }
        )
    }

    suspend fun deleteConversation(token: String, userId: String) {
        YugmHttpClient.delete("/users/messages/$userId", token)
    }

    suspend fun deleteSelectedDirectMessages(token: String, userId: String, messageIds: List<String>, scope: String): List<String> {
        val ids = JSONArray().apply { messageIds.forEach { put(it) } }
        val data = YugmHttpClient.post(
            "/users/messages/$userId/delete-selected",
            token,
            JSONObject().put("messageIds", ids).put("scope", scope)
        ).getJSONObject("data")
        val deletedIds = data.optJSONArray("deletedIds") ?: JSONArray()
        return buildList { for (index in 0 until deletedIds.length()) add(deletedIds.optString(index)) }
    }

    suspend fun editDirectMessage(token: String, userId: String, messageId: String, message: String): DirectMessage {
        val data = YugmHttpClient.put("/users/messages/$userId/$messageId", token, JSONObject().put("message", message)).getJSONObject("data")
        return data.getJSONObject("message").toDirectMessage()
    }

    suspend fun forwardDirectMessage(token: String, userId: String, messageId: String): DirectMessage {
        val data = YugmHttpClient.post("/users/messages/$userId/forward", token, JSONObject().put("messageId", messageId)).getJSONObject("data")
        return data.getJSONObject("message").toDirectMessage()
    }

    suspend fun replyDirectMessage(token: String, userId: String, message: String, replyToId: String): DirectMessage {
        val data = YugmHttpClient.post("/users/messages/$userId", token, JSONObject().put("message", message).put("replyToId", replyToId)).getJSONObject("data")
        return data.getJSONObject("message").toDirectMessage()
    }

    suspend fun searchConversation(
        token: String,
        userId: String,
        query: String,
        before: String? = null,
        limit: Int? = null
    ): List<DirectMessage> = searchConversationPage(token, userId, query, before, limit).messages

    suspend fun searchConversationPage(
        token: String,
        userId: String,
        query: String,
        before: String? = null,
        limit: Int? = null
    ): PagedDirectMessages {
        val params = buildList {
            add("q=${java.net.URLEncoder.encode(query, "UTF-8")}")
            if (!before.isNullOrBlank()) add("before=${java.net.URLEncoder.encode(before, "UTF-8")}")
            if (limit != null) add("limit=$limit")
        }.joinToString("&")
        val data = YugmHttpClient.get("/users/messages/$userId/search?$params", token).getJSONObject("data")
        return PagedDirectMessages(
            messages = data.optJSONArray("messages")?.toDirectMessages() ?: emptyList(),
            hasMore = data.optBoolean("hasMore", false),
            nextBefore = data.optString("nextBefore").takeIf { it.isNotBlank() && it != "null" }
        )
    }

    suspend fun muteConversation(token: String, userId: String, muted: Boolean) {
        YugmHttpClient.put("/users/messages/$userId/mute", token, JSONObject().put("muted", muted))
    }

    suspend fun unreadCounts(token: String): Map<String, Int> {
        val obj = YugmHttpClient.get("/users/messages/unread-counts", token).getJSONObject("data").optJSONObject("unreadCounts") ?: JSONObject()
        return buildMap { obj.keys().forEach { key -> put(key, obj.optInt(key)) } }
    }

    suspend fun mutedConversations(token: String): Set<String> {
        val data = YugmHttpClient.get("/users/messages/mutes", token).getJSONObject("data")
        val arr = data.optJSONArray("partnerIds") ?: JSONArray()
        return buildSet { for (index in 0 until arr.length()) add(arr.optString(index)) }
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

    suspend fun searchRandomFriend(token: String): Room? {
        val data = YugmHttpClient.post("/users/friend-match/search", token, JSONObject()).getJSONObject("data")
        return data.optJSONObject("room")?.toRoom()
    }

    suspend fun randomFriendMatch(token: String): Room? {
        // Re-run the idempotent search while waiting so two simultaneous searches can still pair.
        val data = YugmHttpClient.post("/users/friend-match/search", token, JSONObject()).getJSONObject("data")
        return data.optJSONObject("room")?.toRoom()
    }

    suspend fun cancelRandomFriendSearch(token: String) {
        YugmHttpClient.post("/users/friend-match/cancel", token, JSONObject())
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

    suspend fun markConversationRead(token: String, partnerId: String) {
        YugmHttpClient.post("/users/messages/$partnerId/read", token, JSONObject())
    }

    suspend fun getRecentMessages(token: String, before: String? = null, limit: Int? = null): List<DirectMessage> =
        getRecentMessagesPage(token, before, limit).messages

    suspend fun getRecentMessagesPage(token: String, before: String? = null, limit: Int? = null): PagedDirectMessages {
        val query = buildList {
            if (!before.isNullOrBlank()) add("before=${java.net.URLEncoder.encode(before, "UTF-8")}")
            if (limit != null) add("limit=$limit")
        }.joinToString("&")
        val path = if (query.isBlank()) "/users/messages" else "/users/messages?$query"
        val data = YugmHttpClient.get(path, token).getJSONObject("data")
        return PagedDirectMessages(
            messages = data.optJSONArray("messages")?.toDirectMessages() ?: emptyList(),
            hasMore = data.optBoolean("hasMore", false),
            nextBefore = data.optString("nextBefore").takeIf { it.isNotBlank() && it != "null" }
        )
    }

    suspend fun addCloseFriend(token: String, userId: String) {
        YugmHttpClient.post("/users/$userId/close-friend", token, JSONObject())
    }

    suspend fun removeCloseFriend(token: String, userId: String) {
        YugmHttpClient.delete("/users/$userId/close-friend", token)
    }

    suspend fun addProfileMedia(token: String, mediaUrl: String, mediaType: String) {
        YugmHttpClient.post("/users/me/profile-media", token, JSONObject().put("mediaUrl", mediaUrl).put("mediaType", mediaType))
    }

    suspend fun deleteProfileMedia(token: String, mediaId: String) {
        YugmHttpClient.delete("/users/me/profile-media/$mediaId", token)
    }

    suspend fun suggestedHosts(token: String): List<Host> {
        val data = YugmHttpClient.get("/hosts/suggested", token).getJSONObject("data")
        return data.optJSONArray("hosts")?.toHosts() ?: emptyList()
    }

    suspend fun recommendedChatUsers(token: String): List<Host> {
        val data = YugmHttpClient.get("/users/recommended-chat", token).getJSONObject("data")
        return data.optJSONArray("users")?.toHosts() ?: emptyList()
    }

    suspend fun levelLeaderboard(token: String): List<Host> {
        val data = YugmHttpClient.get("/leaderboard/levels", token).getJSONObject("data")
        return data.optJSONArray("leaderboard")?.toHosts() ?: emptyList()
    }

    suspend fun levelLeaderboardPage(token: String, page: Int, pageSize: Int): LevelLeaderboardPage {
        val safePage = page.coerceAtLeast(1)
        val safePageSize = pageSize.coerceIn(1, 50)
        val data = YugmHttpClient.get("/leaderboard/levels?page=$safePage&pageSize=$safePageSize", token).getJSONObject("data")
        val rows = data.optJSONArray("leaderboard") ?: data.optJSONArray("users") ?: JSONArray()
        val entries = buildList {
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index) ?: continue
                add(LevelLeaderboardEntry(
                    rank = row.optInt("rank", (safePage - 1) * safePageSize + index + 1),
                    user = row.toHost()
                ))
            }
        }
        return LevelLeaderboardPage(
            entries = entries,
            page = data.optInt("page", safePage),
            pageSize = data.optInt("pageSize", safePageSize),
            total = data.optInt("total", entries.size),
            requesterId = data.optString("requesterId", ""),
            requesterRank = if (data.has("requesterRank") && !data.isNull("requesterRank")) data.optInt("requesterRank") else null
        )
    }
}
