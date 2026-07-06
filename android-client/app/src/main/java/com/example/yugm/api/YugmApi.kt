package com.example.yugm.api

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.util.Log
import androidx.compose.ui.graphics.Color
import com.example.yugm.BuildConfig
import com.example.yugm.model.ChatMessage
import com.example.yugm.model.GiftItem
import com.example.yugm.model.Host
import com.example.yugm.model.MediaSession
import com.example.yugm.model.NotificationItem
import com.example.yugm.model.Room
import com.example.yugm.model.RoomType
import com.example.yugm.model.Session
import com.example.yugm.model.YugmUser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

val Categories = listOf(
    "Trending", "Nearby", "Voice", "Video", "Music",
    "Gaming", "Chill", "Dating", "Friends"
)

fun Context.isNetworkAvailable(): Boolean {
    val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return false
    val network = cm.activeNetwork ?: return false
    val caps = cm.getNetworkCapabilities(network) ?: return false
    return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
}

object YugmApi {
    var isOnline = true
    private const val TAG = "YugmApi"
    private val json = "application/json; charset=utf-8".toMediaType()
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()
    val baseCandidates = buildList {
        val configuredBase = BuildConfig.API_BASE_URL.trim().trimEnd('/')
        if (configuredBase.isNotBlank()) add(configuredBase)
        if (BuildConfig.DEBUG) {
            add("http://10.0.2.2:4000/api")
            add("http://127.0.0.1:4000/api")
        }
    }.distinct()
    private var workingBaseUrl: String? = null

    fun endpoint(path: String): String {
        val base = workingBaseUrl ?: baseCandidates.firstOrNull()
            ?: throw IllegalStateException("API_BASE_URL is not configured for this build")
        return "$base$path"
    }

    suspend fun requestOtp(identifier: String): String? {
        val response = post("/auth/request-otp", auth = null, body = contactPayload(identifier))
        val data = response.optJSONObject("data")
        val devOtp = data?.optString("devOtp", "")
        return if (devOtp.isNullOrBlank()) null else devOtp
    }

    suspend fun verifyOtp(identifier: String, otp: String): Session {
        val response = post("/auth/verify-otp", auth = null, body = contactPayload(identifier).put("otp", otp))
        val data = response.getJSONObject("data")
        return Session(token = data.getString("token"), user = data.getJSONObject("user").toUser())
    }

    suspend fun updateProfile(token: String, name: String, username: String, bio: String? = null, city: String? = null, interests: List<String>? = null): YugmUser {
        val body = JSONObject()
            .put("name", name)
            .put("username", username.lowercase().replace(" ", "_"))
        if (city != null) body.put("city", city)
        if (bio != null) body.put("bio", bio)
        if (interests != null) body.put("interests", JSONArray(interests))
        return patch("/users/me", token, body).getJSONObject("data").getJSONObject("user").toUser()
    }

    suspend fun rooms(type: RoomType? = null): List<Room> {
        val query = type?.let { "?type=${it.name.uppercase()}" }.orEmpty()
        val data = get("/rooms$query", auth = null).getJSONObject("data")
        return data.getJSONArray("rooms").toRooms()
    }

    suspend fun roomMessages(roomId: String, token: String? = null): List<ChatMessage> {
        val data = get("/rooms/$roomId/messages", auth = token).getJSONObject("data")
        val messages = data.getJSONArray("messages")
        return buildList {
            for (index in 0 until messages.length()) {
                val item = messages.getJSONObject(index)
                val sender = item.optJSONObject("senderId")
                add(ChatMessage(sender?.optString("name") ?: "", item.optString("message")))
            }
        }
    }

    suspend fun createRoom(token: String, room: Room): Room {
        val body = JSONObject()
            .put("type", room.type.name.uppercase())
            .put("title", room.title)
            .put("description", room.description)
            .put("tags", JSONArray(room.tags))
            .put("language", room.language)
            .put("category", room.category)
            .put("maxSpeakers", room.maxSpeakers)
            .put("visibility", "PUBLIC")
            .put("allowAudienceMicRequests", true)
        return post("/rooms", token, body).getJSONObject("data").getJSONObject("room").toRoom()
    }

    suspend fun joinRoom(token: String, roomId: String) {
        post("/rooms/$roomId/join", token, JSONObject())
    }

    suspend fun leaveRoom(token: String, roomId: String) {
        post("/rooms/$roomId/leave", token, JSONObject())
    }

    suspend fun liveKitToken(token: String, roomId: String): MediaSession {
        val data = post("/livekit/token", token, JSONObject().put("roomId", roomId)).getJSONObject("data")
        return MediaSession(
            token = data.optString("token"),
            url = data.optString("url"),
            roomName = data.optString("roomName"),
            role = data.optString("role", "AUDIENCE")
        )
    }

    suspend fun sendMessage(token: String, roomId: String, message: String) {
        post("/rooms/$roomId/messages", token, JSONObject().put("message", message))
    }

    suspend fun wallet(token: String): Int {
        return get("/wallet", token).getJSONObject("data").optInt("balance", 0)
    }

    suspend fun gifts(token: String): List<GiftItem> {
        val data = get("/gifts", token).getJSONObject("data").getJSONArray("gifts")
        return buildList {
            for (index in 0 until data.length()) {
                val item = data.getJSONObject(index)
                val gid = item.optString("_id", "")
                val gname = item.optString("name", "Gift")
                if (gid.isNotBlank()) add(GiftItem(gid, gname, item.optInt("coinPrice")))
            }
        }
    }

    suspend fun sendGift(token: String, roomId: String, gift: GiftItem, receiverId: String) {
        post("/rooms/$roomId/send-gift", token, JSONObject().put("giftId", gift.id).put("receiverId", receiverId))
    }

    suspend fun googleAuth(idToken: String): Session {
        val response = post("/auth/google", auth = null, JSONObject().put("idToken", idToken))
        val data = response.getJSONObject("data")
        return Session(token = data.getString("token"), user = data.getJSONObject("user").toUser())
    }

    suspend fun phoneAuth(idToken: String): Session {
        val response = post("/auth/phone", auth = null, JSONObject().put("idToken", idToken))
        val data = response.getJSONObject("data")
        return Session(token = data.getString("token"), user = data.getJSONObject("user").toUser())
    }

    suspend fun followUser(token: String, userId: String) {
        post("/users/$userId/follow", token, JSONObject())
    }

    suspend fun unfollowUser(token: String, userId: String) {
        delete("/users/$userId/follow", token)
    }

    suspend fun requestSpeaker(token: String, roomId: String) {
        post("/rooms/$roomId/request-speaker", token, JSONObject())
    }

    suspend fun registerFcmToken(token: String, fcmToken: String) {
        post("/notifications/device-token", token, JSONObject().put("token", fcmToken).put("platform", "android"))
    }

    suspend fun searchRooms(query: String): List<Room> {
        val data = get("/rooms/search?q=$query", auth = null).getJSONObject("data")
        return data.getJSONArray("rooms").toRooms()
    }

    suspend fun searchUsers(query: String): List<Host> {
        val data = get("/users/search?q=$query", auth = null).getJSONObject("data")
        return data.getJSONArray("users").toHosts()
    }

    suspend fun getUser(userId: String, token: String? = null): Host {
        val data = get("/users/$userId", auth = token).getJSONObject("data")
        return data.getJSONObject("user").toHost()
    }

    suspend fun getUserRooms(userId: String, token: String? = null): List<Room> {
        val data = get("/users/$userId/rooms", auth = token).getJSONObject("data")
        return data.getJSONArray("rooms").toRooms()
    }

    suspend fun getFollowers(userId: String, token: String? = null): List<Host> {
        val data = get("/users/$userId/followers", auth = token).getJSONObject("data")
        return data.getJSONArray("followers").toHosts()
    }

    suspend fun getFollowing(userId: String, token: String? = null): List<Host> {
        val data = get("/users/$userId/following", auth = token).getJSONObject("data")
        return data.getJSONArray("following").toHosts()
    }

    suspend fun getNotifications(token: String): Pair<List<NotificationItem>, Int> {
        val data = get("/notifications", token).getJSONObject("data")
        val list = data.getJSONArray("notifications").toNotificationItems()
        val unread = data.optInt("unreadCount", 0)
        return Pair(list, unread)
    }

    suspend fun reportUser(token: String, roomId: String, targetUserId: String, reason: String) {
        post("/rooms/$roomId/report", token, JSONObject().put("targetUserId", targetUserId).put("reason", reason).put("roomId", roomId))
    }

    suspend fun blockUser(userId: String, token: String) {
        post("/users/$userId/block", token, JSONObject())
    }

    suspend fun unblockUser(userId: String, token: String) {
        delete("/users/$userId/block", token)
    }

    suspend fun endRoom(roomId: String, token: String) {
        post("/rooms/$roomId/end", token, JSONObject())
    }

    suspend fun muteUser(roomId: String, userId: String, token: String) {
        post("/rooms/$roomId/mute-user", token, JSONObject().put("userId", userId))
    }

    suspend fun removeUser(roomId: String, userId: String, token: String) {
        post("/rooms/$roomId/remove-user", token, JSONObject().put("userId", userId))
    }

    suspend fun devRecharge(token: String, amount: Int) {
        post("/wallet/dev-recharge", token, JSONObject().put("amount", amount))
    }

    suspend fun walletTransactions(token: String): List<com.example.yugm.model.WalletTransaction> {
        val data = get("/wallet/transactions", token).getJSONObject("data")
        return data.getJSONArray("transactions").toWalletTransactions()
    }

    private fun contactPayload(identifier: String): JSONObject {
        return JSONObject().put(if (identifier.contains("@")) "email" else "phone", identifier)
    }

    private suspend fun get(path: String, auth: String?): JSONObject = request("GET", path, auth, null)
    private suspend fun post(path: String, auth: String?, body: JSONObject): JSONObject = request("POST", path, auth, body)
    private suspend fun patch(path: String, auth: String?, body: JSONObject): JSONObject = request("PATCH", path, auth, body)
    private suspend fun delete(path: String, auth: String?): JSONObject = request("DELETE", path, auth, null)

    private suspend fun request(method: String, path: String, auth: String?, body: JSONObject?): JSONObject = withContext(Dispatchers.IO) {
        if (!isOnline) throw IllegalStateException("No internet connection")
        val bases = listOfNotNull(workingBaseUrl) + baseCandidates.filter { it != workingBaseUrl }
        if (bases.isEmpty()) throw IllegalStateException("API_BASE_URL is not configured for this build")
        var lastError: Throwable? = null
        for ((attempt, base) in bases.withIndex()) {
            try {
                if (attempt > 0) kotlinx.coroutines.delay(1000L * attempt)
                val builder = Request.Builder().url("$base$path")
                if (auth != null) builder.header("Authorization", "Bearer $auth")
                val requestBody = body?.toString()?.toRequestBody(json)
                when (method) {
                    "POST" -> builder.post(requestBody ?: "{}".toRequestBody(json))
                    "PATCH" -> builder.patch(requestBody ?: "{}".toRequestBody(json))
                    "DELETE" -> builder.delete()
                    else -> builder.get()
                }
                client.newCall(builder.build()).execute().use { response ->
                    val raw = response.body?.string()
                    if (raw == null) throw IllegalStateException("Empty response body")
                    if (!response.isSuccessful) {
                        val errMsg = try {
                            JSONObject(raw).optJSONObject("error")?.optString("message")
                        } catch (e: Exception) {
                            Log.e(TAG, "Error parsing error response", e)
                            null
                        }
                        throw IllegalStateException(errMsg ?: "API ${response.code}")
                    }
                    workingBaseUrl = base
                    return@withContext JSONObject(raw)
                }
            } catch (error: Throwable) {
                Log.e(TAG, "Request failed for $base$path", error)
                lastError = error
            }
        }
        throw lastError ?: IllegalStateException("API unavailable")
    }
}

fun JSONArray.toRooms(): List<Room> = buildList {
    for (index in 0 until length()) {
        add(getJSONObject(index).toRoom())
    }
}

fun JSONObject.toUser(): YugmUser = YugmUser(
    id = optString("_id", optString("id", "")),
    name = optString("name", ""),
    username = optString("username", ""),
    walletBalance = optInt("walletBalance", 0),
    isVip = optBoolean("isVip", false),
    vipTier = optString("vipTier", ""),
    level = optInt("level", optJSONObject("levelStatus")?.optInt("level", 1) ?: 1),
    levelTitle = optString("levelTitle", optJSONObject("levelStatus")?.optString("title", "New Vibe") ?: "New Vibe"),
    xp = optInt("xp", optJSONObject("levelStatus")?.optInt("xp", 0) ?: 0)
)

fun JSONObject.toHost(): Host = Host(
    id = optString("_id", optString("id", "")),
    name = optString("name", ""),
    username = optString("username", ""),
    city = optString("city", ""),
    vibe = optString("bio", ""),
    followers = optInt("followersCount", 0),
    followingCount = optInt("followingCount", 0),
    bio = optString("bio", ""),
    avatar = if (has("avatar") && !isNull("avatar")) optString("avatar", "") else null,
    isVip = optBoolean("isVip", false),
    vipTier = optString("vipTier", ""),
    level = optInt("level", optJSONObject("levelStatus")?.optInt("level", 1) ?: 1),
    levelTitle = optString("levelTitle", optJSONObject("levelStatus")?.optString("title", "New Vibe") ?: "New Vibe"),
    xp = optInt("xp", optJSONObject("levelStatus")?.optInt("xp", 0) ?: 0)
)

fun JSONObject.toRoom(): Room {
    val hostJson = optJSONObject("hostId")
    val tagsJson = optJSONArray("tags") ?: JSONArray()
    val type = if (optString("type") == "VIDEO") RoomType.Video else RoomType.Voice
    return Room(
        id = optString("_id", optString("id", "")),
        title = optString("title", ""),
        description = optString("description", ""),
        type = type,
        host = hostJson?.toHost(),
        category = optString("category", ""),
        language = optString("language", ""),
        tags = buildList {
            for (index in 0 until tagsJson.length()) add(tagsJson.optString(index))
        },
        participants = optInt("participantCount", 0),
        maxSpeakers = optInt("maxSpeakers", if (type == RoomType.Video) 4 else 6),
        gradient = roomGradient(optString("_id", optString("title")))
    )
}

fun JSONArray.toHosts(): List<Host> = buildList {
    for (index in 0 until length()) {
        add(getJSONObject(index).toHost())
    }
}

fun JSONArray.toNotificationItems(): List<NotificationItem> = buildList {
    for (index in 0 until length()) {
        val item = getJSONObject(index)
        add(NotificationItem(
            id = item.optString("_id", item.optString("id", "")),
            type = item.optString("type", "general"),
            message = item.optString("message", ""),
            actorName = item.optString("actorName", ""),
            actorId = item.optString("actorId", ""),
            roomId = item.optString("roomId", ""),
            read = item.optBoolean("read", false),
            createdAt = item.optString("createdAt", "")
        ))
    }
}

fun JSONArray.toWalletTransactions(): List<com.example.yugm.model.WalletTransaction> = buildList {
    for (index in 0 until length()) {
        val item = getJSONObject(index)
        add(com.example.yugm.model.WalletTransaction(
            type = item.optString("type", ""),
            amount = item.optInt("amount", 0),
            description = item.optString("description", ""),
            balanceAfter = item.optInt("balanceAfter", 0),
            createdAt = item.optString("createdAt", "")
        ))
    }
}

fun roomGradient(seed: String): List<Color> {
    return when ((seed.hashCode() and Int.MAX_VALUE) % 4) {
        0 -> listOf(Color(0xFF25164C), Color(0xFF8A3FFC), Color(0xFFFF3E93))
        1 -> listOf(Color(0xFF12263A), Color(0xFF165DFF), Color(0xFF27D3FF))
        2 -> listOf(Color(0xFF1B1A38), Color(0xFFFF8A22), Color(0xFFF6B44B))
        else -> listOf(Color(0xFF101028), Color(0xFF7C2DFF), Color(0xFFFFB547))
    }
}
