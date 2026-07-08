package com.example.yugm.api

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.util.Log
import androidx.compose.ui.graphics.Color
import com.example.yugm.BuildConfig
import com.example.yugm.model.ChatMessage
import com.example.yugm.model.ActiveCosmetics
import com.example.yugm.model.CoinPack
import com.example.yugm.model.Conversation
import com.example.yugm.model.CosmeticCatalog
import com.example.yugm.model.DailyCheckInResult
import com.example.yugm.model.DirectMessage
import com.example.yugm.model.GiftItem
import com.example.yugm.model.Host
import com.example.yugm.model.LevelStatus
import com.example.yugm.model.MediaSession
import com.example.yugm.model.NotificationItem
import com.example.yugm.model.ProfileCosmetic
import com.example.yugm.model.RelationshipStatus
import com.example.yugm.model.Room
import com.example.yugm.model.RoomType
import com.example.yugm.model.Session
import com.example.yugm.model.VipPlan
import com.example.yugm.model.VipStatus
import com.example.yugm.model.WalletOverview
import com.example.yugm.model.WalletProgressResult
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
            add("http://10.0.3.2:4000/api")
            if (BuildConfig.LAN_API_BASE_URL.isNotBlank()) add(BuildConfig.LAN_API_BASE_URL.trim().trimEnd('/'))
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

    suspend fun walletOverview(token: String): WalletOverview {
        return get("/wallet", token).getJSONObject("data").toWalletOverview()
    }

    suspend fun coinPacks(token: String): List<CoinPack> {
        val data = get("/wallet/packs", token).getJSONObject("data").optJSONArray("packs") ?: JSONArray()
        return data.toCoinPacks()
    }

    suspend fun vipPlans(token: String): Pair<List<VipPlan>, VipStatus> {
        val data = get("/wallet/vip/plans", token).getJSONObject("data")
        return Pair(data.optJSONArray("plans")?.toVipPlans() ?: emptyList(), data.optJSONObject("vip")?.toVipStatus() ?: VipStatus())
    }

    suspend fun activateVip(token: String, planId: String): WalletProgressResult {
        val data = post("/wallet/vip/activate", token, JSONObject().put("planId", planId)).getJSONObject("data")
        return WalletProgressResult(
            balance = data.optInt("balance", 0),
            vip = data.optJSONObject("vip")?.toVipStatus() ?: VipStatus(),
            level = data.optJSONObject("level")?.toLevelStatus() ?: LevelStatus()
        )
    }

    suspend fun createRazorpayOrder(token: String, packId: String): String {
        val data = post(
            "/wallet/purchases/razorpay/order",
            token,
            JSONObject().put("packId", packId).put("provider", "RAZORPAY")
        ).getJSONObject("data")
        return data.optJSONObject("order")?.optString("id").orEmpty()
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

    suspend fun cosmetics(token: String): CosmeticCatalog {
        val data = get("/wallet/cosmetics", token).getJSONObject("data")
        return data.toCosmeticCatalog()
    }

    suspend fun purchaseCosmetic(token: String, cosmeticId: String): CosmeticCatalog {
        val data = post("/wallet/cosmetics/purchase", token, JSONObject().put("cosmeticId", cosmeticId)).getJSONObject("data")
        return data.toCosmeticCatalog()
    }

    suspend fun equipCosmetic(token: String, cosmeticId: String, type: String): CosmeticCatalog {
        val data = post(
            "/wallet/cosmetics/equip",
            token,
            JSONObject().put("cosmeticId", cosmeticId).put("type", type)
        ).getJSONObject("data")
        return data.toCosmeticCatalog()
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

    suspend fun searchUsers(query: String, token: String? = null): List<Host> {
        val data = get("/users/search?q=$query", auth = token).getJSONObject("data")
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

    suspend fun level(token: String): LevelStatus {
        return get("/users/me/level", token).getJSONObject("data").getJSONObject("level").toLevelStatus()
    }

    suspend fun checkIn(token: String): DailyCheckInResult {
        val data = post("/users/me/check-in", token, JSONObject()).getJSONObject("data")
        return DailyCheckInResult(
            alreadyClaimed = data.optBoolean("alreadyClaimed", false),
            xpAwarded = data.optInt("xpAwarded", 0),
            levelUpReward = data.optInt("levelUpReward", 0),
            level = data.optJSONObject("level")?.toLevelStatus() ?: LevelStatus(),
            balance = data.optInt("walletBalance", data.optInt("balance", 0))
        )
    }

    suspend fun conversation(token: String, userId: String): Conversation {
        val data = get("/users/messages/$userId", token).getJSONObject("data")
        return Conversation(
            messages = data.optJSONArray("messages")?.toDirectMessages() ?: emptyList(),
            relationship = data.optJSONObject("relationship")?.toRelationshipStatus()
        )
    }

    suspend fun sendDirectMessage(token: String, userId: String, message: String): Conversation {
        val data = post("/users/messages/$userId", token, JSONObject().put("message", message)).getJSONObject("data")
        val direct = data.optJSONObject("message")?.toDirectMessage()
        return Conversation(
            messages = if (direct != null) listOf(direct) else emptyList(),
            relationship = data.optJSONObject("relationship")?.toRelationshipStatus()
        )
    }

    suspend fun sendDirectGift(token: String, giftId: String, receiverId: String): Conversation {
        val data = post("/direct-send-gift", token, JSONObject().put("giftId", giftId).put("receiverId", receiverId)).getJSONObject("data")
        val direct = data.optJSONObject("message")?.toDirectMessage()
        return Conversation(
            messages = if (direct != null) listOf(direct) else emptyList(),
            relationship = data.optJSONObject("relationship")?.toRelationshipStatus()
        )
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
    level = optJSONObject("levelStatus")?.optInt("level", optInt("level", 1)) ?: optInt("level", 1),
    levelTitle = optJSONObject("levelStatus")?.optString("title", optString("levelTitle", "New Vibe")) ?: optString("levelTitle", "New Vibe"),
    xp = optJSONObject("levelStatus")?.optInt("xp", optInt("xp", 0)) ?: optInt("xp", 0),
    levelStatus = optJSONObject("levelStatus")?.toLevelStatus() ?: LevelStatus(level = optInt("level", 1), title = optString("levelTitle", "New Vibe"), xp = optInt("xp", 0)),
    activeCosmetics = optJSONObject("activeCosmetics")?.toActiveCosmetics() ?: ActiveCosmetics()
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
    level = optJSONObject("levelStatus")?.optInt("level", optInt("level", 1)) ?: optInt("level", 1),
    levelTitle = optJSONObject("levelStatus")?.optString("title", optString("levelTitle", "New Vibe")) ?: optString("levelTitle", "New Vibe"),
    xp = optJSONObject("levelStatus")?.optInt("xp", optInt("xp", 0)) ?: optInt("xp", 0),
    levelStatus = optJSONObject("levelStatus")?.toLevelStatus() ?: LevelStatus(level = optInt("level", 1), title = optString("levelTitle", "New Vibe"), xp = optInt("xp", 0)),
    activeCosmetics = optJSONObject("activeCosmetics")?.toActiveCosmetics() ?: ActiveCosmetics(),
    isFollowing = optBoolean("isFollowing", false)
)

fun JSONObject.toLevelStatus(): LevelStatus = LevelStatus(
    level = optInt("level", 1),
    title = optString("title", optString("levelTitle", "New Vibe")),
    xp = optInt("xp", 0),
    progress = optDouble("progress", 0.0).toFloat().coerceIn(0f, 1f),
    progressXp = optInt("progressXp", 0),
    requiredXp = optInt("requiredXp", 0),
    nextLevel = if (has("nextLevel") && !isNull("nextLevel")) optInt("nextLevel") else null,
    canDailyCheckIn = optBoolean("canDailyCheckIn", false),
    dailyCheckInXp = optInt("dailyCheckInXp", 25)
)

fun JSONObject.toVipStatus(): VipStatus = VipStatus(
    isVip = optBoolean("isVip", false),
    vipTier = optString("vipTier", ""),
    vipStartedAt = optString("vipStartedAt", ""),
    vipExpiresAt = optString("vipExpiresAt", "")
)

fun JSONObject.toActiveCosmetics(): ActiveCosmetics = ActiveCosmetics(
    avatarAsset = optString("avatarAsset", ""),
    avatarFrame = optString("avatarFrame", ""),
    speakingWave = optString("speakingWave", ""),
    profileTheme = optString("profileTheme", ""),
    entranceEffect = optString("entranceEffect", ""),
    profileBadge = optString("profileBadge", ""),
    nameStyle = optString("nameStyle", ""),
    roomEntry = optString("roomEntry", ""),
    moodStatus = optString("moodStatus", ""),
    profileMusic = optString("profileMusic", ""),
    voiceBadge = optString("voiceBadge", ""),
    roomTheme = optString("roomTheme", ""),
    avatarDecoration = optString("avatarDecoration", ""),
    reactionPack = optString("reactionPack", ""),
    profileLayout = optString("profileLayout", ""),
    introCard = optString("introCard", ""),
    collectibleTitle = optString("collectibleTitle", ""),
    giftShelf = optString("giftShelf", ""),
    chatBubble = optString("chatBubble", ""),
    seasonalEvent = optString("seasonalEvent", "")
)

fun JSONObject.toCosmeticCatalog(): CosmeticCatalog {
    val cosmeticArray = optJSONArray("cosmetics") ?: JSONArray()
    val ownedArray = optJSONArray("ownedCosmeticIds") ?: JSONArray()
    return CosmeticCatalog(
        cosmetics = buildList {
            for (index in 0 until cosmeticArray.length()) {
                val item = cosmeticArray.getJSONObject(index)
                add(ProfileCosmetic(
                    id = item.optString("id", ""),
                    type = item.optString("type", ""),
                    name = item.optString("name", "Cosmetic"),
                    coinPrice = item.optInt("coinPrice", 0),
                    rarity = item.optString("rarity", "COMMON")
                ))
            }
        },
        ownedCosmeticIds = buildList {
            for (index in 0 until ownedArray.length()) add(ownedArray.optString(index))
        },
        activeCosmetics = optJSONObject("activeCosmetics")?.toActiveCosmetics() ?: ActiveCosmetics()
    )
}

fun JSONObject.toWalletOverview(): WalletOverview {
    val cosmeticsJson = optJSONObject("cosmetics") ?: JSONObject()
    return WalletOverview(
        balance = optInt("balance", 0),
        vip = optJSONObject("vip")?.toVipStatus() ?: VipStatus(),
        level = optJSONObject("level")?.toLevelStatus() ?: LevelStatus(),
        cosmetics = CosmeticCatalog(
            ownedCosmeticIds = buildList {
                val owned = cosmeticsJson.optJSONArray("ownedCosmeticIds") ?: JSONArray()
                for (index in 0 until owned.length()) add(owned.optString(index))
            },
            activeCosmetics = cosmeticsJson.optJSONObject("activeCosmetics")?.toActiveCosmetics() ?: ActiveCosmetics()
        )
    )
}

fun JSONArray.toVipPlans(): List<VipPlan> = buildList {
    for (index in 0 until length()) {
        val item = getJSONObject(index)
        val benefits = item.optJSONArray("benefits") ?: JSONArray()
        add(VipPlan(
            id = item.optString("id", ""),
            name = item.optString("name", "VIP"),
            durationDays = item.optInt("durationDays", 0),
            coinPrice = item.optInt("coinPrice", 0),
            benefits = buildList {
                for (benefitIndex in 0 until benefits.length()) add(benefits.optString(benefitIndex))
            }
        ))
    }
}

fun JSONArray.toCoinPacks(): List<CoinPack> = buildList {
    for (index in 0 until length()) {
        val item = getJSONObject(index)
        add(CoinPack(
            id = item.optString("id", ""),
            coinAmount = item.optInt("coinAmount", 0),
            priceInr = item.optInt("priceInr", 0),
            googleProductId = item.optString("googleProductId", "")
        ))
    }
}

fun JSONObject.toRelationshipStatus(): RelationshipStatus = RelationshipStatus(
    level = optInt("level", 1),
    title = optString("title", "First Spark"),
    xp = optInt("xp", 0),
    progress = optDouble("progress", 0.0).toFloat().coerceIn(0f, 1f),
    progressXp = optInt("progressXp", 0),
    requiredXp = optInt("requiredXp", 0),
    nextLevel = if (has("nextLevel") && !isNull("nextLevel")) optInt("nextLevel") else null,
    nextPerk = optString("nextPerk", ""),
    streakDays = optInt("streakDays", 0)
)

fun JSONObject.entityId(): String = when {
    has("_id") -> optString("_id", "")
    has("id") -> optString("id", "")
    else -> ""
}

fun JSONObject.toDirectMessage(): DirectMessage = DirectMessage(
    id = optString("_id", optString("id", "")),
    senderId = optJSONObject("senderId")?.entityId() ?: optString("senderId", ""),
    receiverId = optJSONObject("receiverId")?.entityId() ?: optString("receiverId", ""),
    message = optString("message", ""),
    createdAt = optString("createdAt", "")
)

fun JSONArray.toDirectMessages(): List<DirectMessage> = buildList {
    for (index in 0 until length()) add(getJSONObject(index).toDirectMessage())
}

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
            description = item.optString("label", item.optString("description", item.optString("source", ""))),
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
