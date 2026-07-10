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
import com.example.yugm.model.ClanSummary
import com.example.yugm.model.Conversation
import com.example.yugm.model.CosmeticCatalog
import com.example.yugm.model.CreatorEarningBalance
import com.example.yugm.model.CreatorPayoutKycStatus
import com.example.yugm.model.DailyCheckInResult
import com.example.yugm.model.DailyGameMission
import com.example.yugm.model.DirectMessage
import com.example.yugm.model.Achievement
import com.example.yugm.model.ExperienceFeedItem
import com.example.yugm.model.ExperienceHome
import com.example.yugm.model.GameCatalog
import com.example.yugm.model.GameChallenges
import com.example.yugm.model.GameLeaderboard
import com.example.yugm.model.GameLeaderboardEntry
import com.example.yugm.model.GameMissions
import com.example.yugm.model.GameReward
import com.example.yugm.model.GiftItem
import com.example.yugm.model.Host
import com.example.yugm.model.LevelStatus
import com.example.yugm.model.MediaSession
import com.example.yugm.model.MiniGame
import com.example.yugm.model.MiniGameBest
import com.example.yugm.model.MiniGameChallenge
import com.example.yugm.model.MiniGameScore
import com.example.yugm.model.NotificationItem
import com.example.yugm.model.NotificationPreferences
import com.example.yugm.model.PollOption
import com.example.yugm.model.PkBattle
import com.example.yugm.model.PkBattleType
import com.example.yugm.model.PkInvite
import com.example.yugm.model.PkLeaderboardEntry
import com.example.yugm.model.PkMediaSession
import com.example.yugm.model.PkMode
import com.example.yugm.model.PkOpponent
import com.example.yugm.model.PkSide
import com.example.yugm.model.PkSideType
import com.example.yugm.model.PkStats
import com.example.yugm.model.PkStatus
import com.example.yugm.model.ProfileCheck
import com.example.yugm.model.ProfileCompletion
import com.example.yugm.model.ProfileCosmetic
import com.example.yugm.model.RelationshipStatus
import com.example.yugm.model.Room
import com.example.yugm.model.RoomActivityItem
import com.example.yugm.model.RoomDetail
import com.example.yugm.model.RoomLeaderboard
import com.example.yugm.model.RoomMission
import com.example.yugm.model.RoomParticipant
import com.example.yugm.model.RoomPoll
import com.example.yugm.model.RoomType
import com.example.yugm.model.SpeakerRequest
import com.example.yugm.model.Session
import com.example.yugm.model.SavedGameScoreResult
import com.example.yugm.model.VipPlan
import com.example.yugm.model.VipStatus
import com.example.yugm.model.WalletOverview
import com.example.yugm.model.WalletProgressResult
import com.example.yugm.model.TrustVerificationStatus
import com.example.yugm.model.WithdrawalEligibility
import com.example.yugm.model.WithdrawalRequestResult
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

    suspend fun createRoom(
        token: String,
        room: Room,
        visibility: String = "PUBLIC",
        allowAudienceMicRequests: Boolean = true,
        scheduledFor: String? = null,
        coverImage: String? = null
    ): Room {
        val body = JSONObject()
            .put("type", room.type.name.uppercase())
            .put("title", room.title)
            .put("description", room.description)
            .put("tags", JSONArray(room.tags))
            .put("language", room.language)
            .put("category", room.category)
            .put("maxSpeakers", room.maxSpeakers)
            .put("visibility", visibility)
            .put("allowAudienceMicRequests", allowAudienceMicRequests)
        if (!scheduledFor.isNullOrBlank()) body.put("scheduledFor", scheduledFor)
        if (!coverImage.isNullOrBlank()) body.put("coverImage", coverImage)
        return post("/rooms", token, body).getJSONObject("data").getJSONObject("room").toRoom()
    }

    suspend fun roomDetail(token: String, roomId: String): RoomDetail {
        val data = get("/rooms/$roomId", token).getJSONObject("data")
        return data.toRoomDetail()
    }

    suspend fun trendingRooms(): List<Room> {
        val data = get("/rooms/trending", auth = null).getJSONObject("data")
        return data.getJSONArray("rooms").toRooms()
    }

    suspend fun recommendedRooms(token: String): List<Room> {
        val data = get("/rooms/recommended", token).getJSONObject("data")
        return data.getJSONArray("rooms").toRooms()
    }

    suspend fun scheduledRooms(): List<Room> {
        val data = get("/rooms/scheduled", auth = null).getJSONObject("data")
        return data.getJSONArray("rooms").toRooms()
    }

    suspend fun leaderboard(): RoomLeaderboard {
        val data = get("/rooms/leaderboard", auth = null).getJSONObject("data")
        return RoomLeaderboard(
            topRooms = data.optJSONArray("topRooms")?.toRooms() ?: emptyList(),
            topHosts = data.optJSONArray("topHosts")?.toHosts() ?: emptyList()
        )
    }

    suspend fun experienceHome(token: String): ExperienceHome {
        return get("/experience/home", token).getJSONObject("data").toExperienceHome()
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

    suspend fun trustVerificationStatus(token: String): TrustVerificationStatus {
        val data = get("/trust-verification/status", token).getJSONObject("data")
        return data.getJSONObject("verification").toTrustVerificationStatus()
    }

    suspend fun startTrustVerification(token: String): TrustVerificationStatus {
        val data = post("/trust-verification/start", token, JSONObject()).getJSONObject("data")
        return data.getJSONObject("verification").toTrustVerificationStatus()
    }

    suspend fun acceptTrustVerificationConsent(token: String): TrustVerificationStatus {
        val data = post("/trust-verification/consent", token, JSONObject()).getJSONObject("data")
        return data.getJSONObject("verification").toTrustVerificationStatus()
    }

    suspend fun trustVoicePrompt(token: String): String {
        return get("/trust-verification/voice-prompt", token).getJSONObject("data").optString("promptText", "")
    }

    suspend fun submitTrustFace(token: String, selfieImageUrl: String? = null, selfieVideoUrl: String? = null, livenessVideoUrl: String? = null): TrustVerificationStatus {
        val body = JSONObject()
        if (!selfieImageUrl.isNullOrBlank()) body.put("selfieImageUrl", selfieImageUrl)
        if (!selfieVideoUrl.isNullOrBlank()) body.put("selfieVideoUrl", selfieVideoUrl)
        if (!livenessVideoUrl.isNullOrBlank()) body.put("livenessVideoUrl", livenessVideoUrl)
        val data = post("/trust-verification/face", token, body).getJSONObject("data")
        return data.getJSONObject("verification").toTrustVerificationStatus()
    }

    suspend fun submitTrustVoice(token: String, audioUrl: String, promptText: String, transcriptText: String? = null): TrustVerificationStatus {
        val body = JSONObject().put("audioUrl", audioUrl).put("promptText", promptText)
        if (!transcriptText.isNullOrBlank()) body.put("transcriptText", transcriptText)
        val data = post("/trust-verification/voice", token, body).getJSONObject("data")
        return data.getJSONObject("verification").toTrustVerificationStatus()
    }

    suspend fun submitTrustReview(token: String): TrustVerificationStatus {
        val data = post("/trust-verification/submit-review", token, JSONObject()).getJSONObject("data")
        return data.getJSONObject("verification").toTrustVerificationStatus()
    }

    suspend fun creatorPayoutKycStatus(token: String): CreatorPayoutKycStatus {
        val data = get("/creator/payout-kyc/status", token).getJSONObject("data")
        return data.getJSONObject("kyc").toCreatorPayoutKycStatus()
    }

    suspend fun submitCreatorPayoutKyc(
        token: String,
        legalFullName: String,
        panNumber: String,
        upiId: String? = null,
        bankAccount: String? = null,
        bankIfsc: String? = null,
        bankHolderName: String? = null,
        dateOfBirth: String? = null
    ): CreatorPayoutKycStatus {
        val body = JSONObject()
            .put("legalFullName", legalFullName)
            .put("panNumber", panNumber)
            .put("declarationsAccepted", true)
        if (!upiId.isNullOrBlank()) body.put("upiId", upiId)
        if (!bankAccount.isNullOrBlank()) body.put("bankAccount", bankAccount)
        if (!bankIfsc.isNullOrBlank()) body.put("bankIfsc", bankIfsc)
        if (!bankHolderName.isNullOrBlank()) body.put("bankHolderName", bankHolderName)
        if (!dateOfBirth.isNullOrBlank()) body.put("dateOfBirth", dateOfBirth)
        val data = post("/creator/payout-kyc/submit", token, body).getJSONObject("data")
        return data.getJSONObject("kyc").toCreatorPayoutKycStatus()
    }

    suspend fun withdrawalEligibility(token: String): WithdrawalEligibility {
        val data = get("/creator/withdrawals/eligibility", token).getJSONObject("data")
        return WithdrawalEligibility(
            balance = data.getJSONObject("balance").toCreatorEarningBalance(),
            payoutKyc = data.getJSONObject("payoutKyc").toCreatorPayoutKycStatus()
        )
    }

    suspend fun requestWithdrawal(token: String, amountCoins: Int): WithdrawalRequestResult {
        val data = post("/creator/withdrawals", token, JSONObject().put("amountCoins", amountCoins)).getJSONObject("data")
        val withdrawal = data.optJSONObject("withdrawal") ?: JSONObject()
        return WithdrawalRequestResult(
            message = data.optString("message", ""),
            status = withdrawal.optString("status", "PENDING_REVIEW"),
            amountCoins = withdrawal.optInt("amountCoins", amountCoins),
            amountInr = withdrawal.optDouble("amountInr", 0.0)
        )
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

    suspend fun approveSpeaker(token: String, roomId: String, userId: String) {
        post("/rooms/$roomId/approve-speaker", token, JSONObject().put("userId", userId))
    }

    suspend fun rejectSpeaker(token: String, roomId: String, userId: String) {
        post("/rooms/$roomId/reject-speaker", token, JSONObject().put("userId", userId))
    }

    suspend fun roomActivity(roomId: String): List<RoomActivityItem> {
        val data = get("/rooms/$roomId/activity", auth = null).getJSONObject("data")
        return data.optJSONArray("activity")?.toRoomActivityItems() ?: emptyList()
    }

    suspend fun roomPolls(roomId: String): List<RoomPoll> {
        val data = get("/rooms/$roomId/polls", auth = null).getJSONObject("data")
        return data.optJSONArray("polls")?.toRoomPolls() ?: emptyList()
    }

    suspend fun createPoll(token: String, roomId: String, question: String, options: List<String>) {
        post("/rooms/$roomId/polls", token, JSONObject().put("question", question).put("options", JSONArray(options)))
    }

    suspend fun votePoll(token: String, roomId: String, pollId: String, optionIndex: Int) {
        post("/rooms/$roomId/polls/$pollId/vote", token, JSONObject().put("optionIndex", optionIndex))
    }

    suspend fun roomMissions(token: String, roomId: String): List<RoomMission> {
        val data = get("/rooms/$roomId/missions", token).getJSONObject("data")
        return data.optJSONArray("missions")?.toRoomMissions() ?: emptyList()
    }

    suspend fun reactToRoom(token: String, roomId: String, type: String) {
        post("/rooms/$roomId/reactions", token, JSONObject().put("type", type))
    }

    suspend fun inviteToRoom(token: String, roomId: String, userId: String) {
        post("/rooms/$roomId/invites", token, JSONObject().put("userId", userId))
    }

    suspend fun roomDirectMessage(token: String, roomId: String, message: String, receiverId: String? = null) {
        val body = JSONObject().put("message", message)
        if (!receiverId.isNullOrBlank()) body.put("receiverId", receiverId)
        post("/rooms/$roomId/messages/direct", token, body)
    }

    suspend fun activePk(token: String, roomId: String): PkBattle? {
        val data = get("/pk/active/$roomId", token).getJSONObject("data")
        return data.optJSONObject("battle")?.toPkBattle()
    }

    suspend fun activePkWithInvite(token: String, roomId: String): Pair<PkBattle?, PkInvite?> {
        val data = get("/pk/active/$roomId", token).getJSONObject("data")
        return data.optJSONObject("battle")?.toPkBattle() to data.optJSONObject("invite")?.toPkInvite()
    }

    suspend fun availablePkOpponents(token: String, battleType: PkBattleType, search: String = ""): List<PkOpponent> {
        val query = buildString {
            append("?battleType=${battleType.name}")
            if (search.isNotBlank()) append("&search=${java.net.URLEncoder.encode(search, "UTF-8")}")
        }
        val data = get("/pk/available-opponents$query", token).getJSONObject("data")
        return data.optJSONArray("opponents")?.toPkOpponents() ?: emptyList()
    }

    suspend fun invitePk(
        token: String,
        roomId: String,
        opponentRoomId: String,
        opponentHostId: String,
        battleType: PkBattleType,
        mode: PkMode,
        durationSeconds: Int,
        title: String
    ): Pair<PkBattle, PkInvite?> {
        val data = post(
            "/pk/invite",
            token,
            JSONObject()
                .put("roomId", roomId)
                .put("opponentRoomId", opponentRoomId)
                .put("opponentHostId", opponentHostId)
                .put("battleType", battleType.name)
                .put("mode", mode.name)
                .put("durationSeconds", durationSeconds)
                .put("title", title)
        ).getJSONObject("data")
        return data.getJSONObject("battle").toPkBattle() to data.optJSONObject("invite")?.toPkInvite()
    }

    suspend fun autoMatchPk(
        token: String,
        roomId: String,
        battleType: PkBattleType,
        mode: PkMode,
        durationSeconds: Int,
        title: String
    ): Pair<PkBattle, PkInvite?> {
        val data = post(
            "/pk/auto-match",
            token,
            JSONObject()
                .put("roomId", roomId)
                .put("battleType", battleType.name)
                .put("mode", mode.name)
                .put("durationSeconds", durationSeconds)
                .put("title", title)
        ).getJSONObject("data")
        return data.getJSONObject("battle").toPkBattle() to data.optJSONObject("invite")?.toPkInvite()
    }

    suspend fun acceptPk(token: String, inviteId: String): PkBattle {
        return post("/pk/accept", token, JSONObject().put("inviteId", inviteId))
            .getJSONObject("data")
            .getJSONObject("battle")
            .toPkBattle()
    }

    suspend fun rejectPk(token: String, inviteId: String) {
        post("/pk/reject", token, JSONObject().put("inviteId", inviteId))
    }

    suspend fun endPk(token: String, battleId: String): PkBattle {
        return post("/pk/end", token, JSONObject().put("battleId", battleId))
            .getJSONObject("data")
            .getJSONObject("battle")
            .toPkBattle()
    }

    suspend fun sendPkGift(token: String, battleId: String, giftId: String, side: PkSideType): PkBattle {
        return post(
            "/pk/$battleId/send-gift",
            token,
            JSONObject()
                .put("giftId", giftId)
                .put("side", side.name)
                .put("idempotencyKey", java.util.UUID.randomUUID().toString())
        ).getJSONObject("data").getJSONObject("battle").toPkBattle()
    }

    suspend fun sendPkReaction(token: String, battleId: String, side: PkSideType, type: String): PkBattle {
        return post(
            "/pk/$battleId/reactions",
            token,
            JSONObject().put("side", side.name).put("type", type)
        ).getJSONObject("data").getJSONObject("battle").toPkBattle()
    }

    suspend fun pkLeaderboard(token: String, battleId: String): List<PkLeaderboardEntry> {
        val data = get("/pk/$battleId/leaderboard", token).getJSONObject("data")
        return data.optJSONArray("entries")?.toPkLeaderboardEntries() ?: emptyList()
    }

    suspend fun pkMediaSession(token: String, battleId: String, roomId: String): PkMediaSession? {
        val data = get("/pk/$battleId/media-sessions?roomId=${java.net.URLEncoder.encode(roomId, "UTF-8")}", token).getJSONObject("data")
        return data.optJSONObject("opponent")?.toPkMediaSession()
    }

    suspend fun pkStats(token: String, userId: String): PkStats {
        val data = get("/users/$userId/pk-stats", token).getJSONObject("data")
        return data.optJSONObject("stats")?.toPkStats() ?: PkStats()
    }

    suspend fun pkHistory(token: String, userId: String): List<PkBattle> {
        val data = get("/users/$userId/pk-history", token).getJSONObject("data")
        val items = data.optJSONArray("battles") ?: JSONArray()
        return buildList {
            for (index in 0 until items.length()) add(items.getJSONObject(index).toPkBattle())
        }
    }

    suspend fun registerFcmToken(token: String, fcmToken: String) {
        post("/notifications/device-token", token, JSONObject().put("token", fcmToken).put("platform", "android"))
    }

    suspend fun searchRooms(query: String): List<Room> {
        val encoded = java.net.URLEncoder.encode(query, "UTF-8")
        val data = get("/rooms/search?q=$encoded", auth = null).getJSONObject("data")
        return data.getJSONArray("rooms").toRooms()
    }

    suspend fun searchUsers(query: String, token: String? = null): List<Host> {
        val encoded = java.net.URLEncoder.encode(query, "UTF-8")
        val data = get("/users/search?q=$encoded", auth = token).getJSONObject("data")
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

    suspend fun markNotificationRead(token: String, notificationId: String) {
        patch("/notifications/$notificationId/read", token, JSONObject())
    }

    suspend fun markAllNotificationsRead(token: String) {
        post("/notifications/read-all", token, JSONObject())
    }

    suspend fun reportUser(token: String, roomId: String, targetUserId: String, reason: String) {
        val body = JSONObject().put("targetUserId", targetUserId).put("reason", reason)
        if (roomId.isBlank()) {
            post("/reports", token, body)
        } else {
            post("/rooms/$roomId/report", token, body.put("roomId", roomId))
        }
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

    suspend fun getBlockedUsers(token: String): List<Host> {
        val data = get("/users/me/blocked", token).getJSONObject("data")
        return data.getJSONArray("users").toHosts()
    }

    suspend fun getRecentMessages(token: String): List<DirectMessage> {
        val data = get("/users/messages", token).getJSONObject("data")
        return data.getJSONArray("messages").toDirectMessages()
    }

    suspend fun datingExplore(token: String): List<Host> {
        val data = get("/dating/explore", token).getJSONObject("data")
        return data.getJSONArray("candidates").toHosts()
    }

    suspend fun datingLike(token: String, likedId: String, type: String): Pair<Boolean, String?> {
        val body = JSONObject().put("likedId", likedId).put("type", type)
        val data = post("/dating/like", token, body).getJSONObject("data")
        val isMatch = data.optBoolean("isMatch", false)
        val matchObj = data.optJSONObject("match")
        val matchId = matchObj?.optString("_id") ?: matchObj?.optString("id")
        return Pair(isMatch, matchId)
    }

    suspend fun datingPass(token: String, likedId: String) {
        val body = JSONObject().put("likedId", likedId)
        post("/dating/pass", token, body)
    }

    suspend fun datingMatches(token: String): List<Host> {
        val data = get("/dating/matches", token).getJSONObject("data")
        val matchesArray = data.getJSONArray("matches")
        return buildList {
            for (i in 0 until matchesArray.length()) {
                val matchItem = matchesArray.getJSONObject(i)
                val partnerObj = matchItem.optJSONObject("partner")
                if (partnerObj != null) {
                    add(partnerObj.toHost())
                }
            }
        }
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

    suspend fun gameCatalog(token: String): GameCatalog {
        return get("/games/catalog", token).getJSONObject("data").toGameCatalog()
    }

    suspend fun gameMissions(token: String): GameMissions {
        return get("/games/missions", token).getJSONObject("data").toGameMissions()
    }

    suspend fun gameLeaderboard(token: String, gameId: String): GameLeaderboard {
        val encoded = java.net.URLEncoder.encode(gameId, "UTF-8")
        return get("/games/leaderboard?gameId=$encoded", token).getJSONObject("data").toGameLeaderboard()
    }

    suspend fun gameChallenges(token: String): GameChallenges {
        return get("/games/challenges", token).getJSONObject("data").toGameChallenges()
    }

    suspend fun submitGameScore(
        token: String,
        gameId: String,
        score: Int,
        durationMs: Int? = null,
        rounds: Int? = null
    ): SavedGameScoreResult {
        val body = JSONObject()
            .put("gameId", gameId)
            .put("score", score)
        if (durationMs != null) body.put("durationMs", durationMs)
        if (rounds != null) body.put("rounds", rounds)
        return post("/games/scores", token, body).getJSONObject("data").toSavedGameScoreResult()
    }

    suspend fun sendGameChallenge(
        token: String,
        gameId: String,
        score: Int,
        scoreId: String,
        targetUserId: String? = null,
        clanId: String? = null,
        message: String? = null
    ): MiniGameChallenge {
        val body = JSONObject()
            .put("gameId", gameId)
            .put("score", score)
        if (scoreId.isNotBlank()) body.put("scoreId", scoreId)
        if (!targetUserId.isNullOrBlank()) body.put("targetUserId", targetUserId)
        if (!clanId.isNullOrBlank()) body.put("clanId", clanId)
        if (!message.isNullOrBlank()) body.put("message", message)
        return post("/games/challenges", token, body).getJSONObject("data").getJSONObject("challenge").toMiniGameChallenge()
    }

    suspend fun shareGameScore(token: String, scoreId: String, targetUserId: String) {
        post("/games/scores/$scoreId/share", token, JSONObject().put("targetUserId", targetUserId))
    }

    suspend fun closeFriends(token: String): List<Host> {
        val data = get("/users/me/close-friends", token).getJSONObject("data")
        return data.optJSONArray("users")?.toHosts() ?: emptyList()
    }

    suspend fun myClan(token: String): ClanSummary? {
        val data = get("/clans/me", token).getJSONObject("data")
        return data.optJSONObject("clan")?.toClanSummary()
    }

    suspend fun notificationPreferences(token: String): NotificationPreferences {
        val data = get("/experience/notification-preferences", token).getJSONObject("data")
        val prefs = data.optJSONObject("preferences") ?: JSONObject()
        return NotificationPreferences(prefs.toBooleanMap())
    }

    suspend fun updateNotificationPreferences(token: String, preferences: Map<String, Boolean>): NotificationPreferences {
        val body = JSONObject()
        preferences.forEach { (key, value) -> body.put(key, value) }
        val data = put("/experience/notification-preferences", token, body).getJSONObject("data")
        val prefs = data.optJSONObject("preferences") ?: JSONObject()
        return NotificationPreferences(prefs.toBooleanMap())
    }

    suspend fun sendFeedback(token: String, subject: String, message: String, category: String = "OTHER") {
        post(
            "/users/me/feedback",
            token,
            JSONObject()
                .put("category", category)
                .put("subject", subject)
                .put("message", message)
        )
    }

    private fun contactPayload(identifier: String): JSONObject {
        return JSONObject().put(if (identifier.contains("@")) "email" else "phone", identifier)
    }

    private suspend fun get(path: String, auth: String?): JSONObject = request("GET", path, auth, null)
    private suspend fun post(path: String, auth: String?, body: JSONObject): JSONObject = request("POST", path, auth, body)
    private suspend fun put(path: String, auth: String?, body: JSONObject): JSONObject = request("PUT", path, auth, body)
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
                    "PUT" -> builder.put(requestBody ?: "{}".toRequestBody(json))
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
    vibe = optString("bio", optString("vibeLine", "")),
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
    isFollowing = optBoolean("isFollowing", false),
    age = optInt("age", 0),
    gender = optString("gender", ""),
    vibeScore = optInt("vibeScore", 0),
    interestedIn = optString("interestedIn", ""),
    lookingFor = optString("lookingFor", ""),
    languages = optJSONArray("languages")?.let { arr -> List(arr.length()) { arr.optString(it) } } ?: emptyList(),
    interests = optJSONArray("interests")?.let { arr -> List(arr.length()) { arr.optString(it) } } ?: emptyList(),
    isOnline = optBoolean("isOnline", false)
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
    val hostJson = optJSONObject("hostId") ?: optJSONObject("host")
    val tagsJson = optJSONArray("tags") ?: JSONArray()
    val type = if (optString("type").equals("VIDEO", ignoreCase = true)) RoomType.Video else RoomType.Voice
    return Room(
        id = optString("_id", optString("id", "")),
        title = optString("title", ""),
        description = optString("description", ""),
        type = type,
        status = optString("status", "LIVE"),
        scheduledFor = optString("scheduledFor", ""),
        host = hostJson?.toHost(),
        category = optString("category", ""),
        language = optString("language", ""),
        tags = buildList {
            for (index in 0 until tagsJson.length()) add(tagsJson.optString(index))
        },
        participants = optInt("participantCount", optInt("participants", 0)),
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

fun JSONObject.toRoomDetail(): RoomDetail = RoomDetail(
    room = getJSONObject("room").toRoom(),
    participants = optJSONArray("participants")?.toRoomParticipants() ?: emptyList(),
    speakerRequests = optJSONArray("speakerRequests")?.toSpeakerRequests() ?: emptyList()
)

fun JSONObject.toRoomParticipant(): RoomParticipant {
    val userJson = optJSONObject("userId") ?: optJSONObject("user") ?: JSONObject()
    return RoomParticipant(
        id = optString("_id", optString("id", "")),
        user = userJson.toHost(),
        role = optString("role", "AUDIENCE"),
        micEnabled = optBoolean("micEnabled", true),
        cameraEnabled = optBoolean("cameraEnabled", false)
    )
}

fun JSONArray.toRoomParticipants(): List<RoomParticipant> = buildList {
    for (index in 0 until length()) add(getJSONObject(index).toRoomParticipant())
}

fun JSONObject.toSpeakerRequest(): SpeakerRequest {
    val userJson = optJSONObject("userId") ?: optJSONObject("user") ?: JSONObject()
    return SpeakerRequest(
        id = optString("_id", optString("id", "")),
        user = userJson.toHost()
    )
}

fun JSONArray.toSpeakerRequests(): List<SpeakerRequest> = buildList {
    for (index in 0 until length()) add(getJSONObject(index).toSpeakerRequest())
}

fun JSONObject.toRoomPoll(): RoomPoll {
    val optionsJson = optJSONArray("options") ?: JSONArray()
    return RoomPoll(
        id = optString("_id", optString("id", "")),
        question = optString("question", ""),
        options = buildList {
            for (index in 0 until optionsJson.length()) {
                val option = optionsJson.getJSONObject(index)
                add(PollOption(text = option.optString("text", ""), votes = option.optInt("votes", 0)))
            }
        },
        isActive = optBoolean("isActive", true)
    )
}

fun JSONArray.toRoomPolls(): List<RoomPoll> = buildList {
    for (index in 0 until length()) add(getJSONObject(index).toRoomPoll())
}

fun JSONObject.toRoomMission(): RoomMission = RoomMission(
    id = optString("id", optString("_id", "")),
    title = optString("title", ""),
    progress = optInt("progress", 0),
    target = optInt("target", 0),
    reward = optInt("reward", 0),
    complete = optBoolean("complete", false)
)

fun JSONArray.toRoomMissions(): List<RoomMission> = buildList {
    for (index in 0 until length()) add(getJSONObject(index).toRoomMission())
}

fun JSONObject.toRoomActivityItem(): RoomActivityItem = RoomActivityItem(
    id = optString("_id", optString("id", "")),
    label = optString("label", ""),
    type = optString("type", ""),
    createdAt = optString("createdAt", "")
)

fun JSONArray.toRoomActivityItems(): List<RoomActivityItem> = buildList {
    for (index in 0 until length()) add(getJSONObject(index).toRoomActivityItem())
}

fun JSONObject.toProfileCompletion(): ProfileCompletion {
    val checksJson = optJSONArray("checks") ?: JSONArray()
    return ProfileCompletion(
        checks = buildList {
            for (index in 0 until checksJson.length()) {
                val check = checksJson.getJSONObject(index)
                add(ProfileCheck(check.optString("id", ""), check.optString("label", ""), check.optBoolean("done", false)))
            }
        },
        completed = optInt("completed", 0),
        total = optInt("total", 0),
        percent = optInt("percent", 0)
    )
}

fun JSONObject.toAchievement(): Achievement = Achievement(
    id = optString("id", ""),
    title = optString("title", ""),
    description = optString("description", ""),
    target = optInt("target", 0),
    rewardCoins = optInt("rewardCoins", 0),
    progress = optInt("progress", 0),
    complete = optBoolean("complete", false)
)

fun JSONArray.toAchievements(): List<Achievement> = buildList {
    for (index in 0 until length()) add(getJSONObject(index).toAchievement())
}

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
        profileCompletion = optJSONObject("profileCompletion")?.toProfileCompletion() ?: ProfileCompletion(),
        level = optJSONObject("level")?.toLevelStatus() ?: LevelStatus(),
        achievements = optJSONArray("achievements")?.toAchievements() ?: emptyList(),
        feed = optJSONArray("feed")?.toExperienceFeedItems() ?: emptyList(),
        liveRooms = roomsJson.optJSONArray("live")?.toRooms() ?: emptyList(),
        scheduledRooms = roomsJson.optJSONArray("scheduled")?.toRooms() ?: emptyList(),
        followingRooms = roomsJson.optJSONArray("following")?.toRooms() ?: emptyList(),
        suggestedHosts = peopleJson.optJSONArray("suggestedHosts")?.toHosts() ?: emptyList(),
        unreadNotifications = notificationsJson.optInt("unreadCount", 0)
    )
}

fun String.toPkStatus(): PkStatus = runCatching { PkStatus.valueOf(uppercase()) }.getOrDefault(PkStatus.INVITED)
fun String.toPkMode(): PkMode = runCatching { PkMode.valueOf(uppercase()) }.getOrDefault(PkMode.GIFT)
fun String.toPkBattleType(): PkBattleType = runCatching { PkBattleType.valueOf(uppercase()) }.getOrDefault(PkBattleType.VOICE)
fun String.toPkSideTypeOrNull(): PkSideType? = runCatching { PkSideType.valueOf(uppercase()) }.getOrNull()

fun JSONObject.toPkSide(): PkSide = PkSide(
    roomId = optString("roomId", ""),
    roomTitle = optString("roomTitle", ""),
    hostId = optString("hostId", ""),
    hostName = optString("hostName", "Host"),
    hostAvatar = if (has("hostAvatar") && !isNull("hostAvatar")) optString("hostAvatar") else null,
    score = optInt("score", 0),
    participantCount = optInt("participantCount", 0),
    activeCosmetics = optJSONObject("activeCosmetics")?.toActiveCosmetics() ?: ActiveCosmetics()
)

fun JSONObject.toPkBattle(): PkBattle = PkBattle(
    id = optString("battleId", optString("id", optString("_id", ""))),
    battleCode = optString("battleCode", ""),
    title = optString("title", ""),
    status = optString("status", "INVITED").toPkStatus(),
    mode = optString("mode", "GIFT").toPkMode(),
    battleType = optString("battleType", "VOICE").toPkBattleType(),
    durationSeconds = optInt("durationSeconds", 180),
    remainingSeconds = optInt("remainingSeconds", optInt("durationSeconds", 180)),
    left = optJSONObject("left")?.toPkSide() ?: PkSide(),
    right = optJSONObject("right")?.toPkSide() ?: PkSide(),
    leader = optString("leader", "").toPkSideTypeOrNull(),
    winnerSide = optString("winnerSide", "").toPkSideTypeOrNull()
)

fun JSONObject.toPkStats(): PkStats = PkStats(
    played = optInt("played", 0),
    wins = optInt("wins", 0),
    losses = optInt("losses", 0),
    draws = optInt("draws", 0),
    totalScore = optInt("totalScore", 0),
    bestBattle = optInt("bestBattle", 0),
    bestStreak = optInt("bestStreak", 0),
    winRate = optInt("winRate", 0)
)

fun JSONObject.toPkMediaSession(): PkMediaSession = PkMediaSession(
    token = optString("token", ""),
    url = optString("url", ""),
    roomId = optString("roomId", ""),
    roomName = optString("roomName", ""),
    title = optString("title", ""),
    role = optString("role", "")
)

fun JSONObject.toPkInvite(): PkInvite = PkInvite(
    id = optString("_id", optString("id", "")),
    battleId = optString("battleId", ""),
    status = optString("status", "PENDING"),
    expiresAt = optString("expiresAt", "")
)

fun JSONObject.toPkOpponent(): PkOpponent = PkOpponent(
    roomId = optString("roomId", ""),
    roomTitle = optString("roomTitle", ""),
    hostId = optString("hostId", ""),
    hostName = optString("hostName", ""),
    hostAvatar = if (has("hostAvatar") && !isNull("hostAvatar")) optString("hostAvatar") else null,
    battleType = optString("battleType", "VOICE").toPkBattleType(),
    category = optString("category", ""),
    language = optString("language", ""),
    participantCount = optInt("participantCount", 0),
    activeCosmetics = optJSONObject("activeCosmetics")?.toActiveCosmetics() ?: ActiveCosmetics()
)

fun JSONArray.toPkOpponents(): List<PkOpponent> = buildList {
    for (index in 0 until length()) add(getJSONObject(index).toPkOpponent())
}

fun JSONObject.toPkLeaderboardEntry(): PkLeaderboardEntry {
    val user = optJSONObject("userId")
    return PkLeaderboardEntry(
        userId = user?.entityId() ?: optString("userId", ""),
        name = user?.optString("name", "") ?: "",
        avatar = if (user != null && user.has("avatar") && !user.isNull("avatar")) user.optString("avatar") else null,
        side = optString("side", "LEFT").toPkSideTypeOrNull() ?: PkSideType.LEFT,
        totalPoints = optInt("totalPoints", 0),
        totalGiftsSent = optInt("totalGiftsSent", 0)
    )
}

fun JSONArray.toPkLeaderboardEntries(): List<PkLeaderboardEntry> = buildList {
    for (index in 0 until length()) add(getJSONObject(index).toPkLeaderboardEntry())
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

fun JSONObject.toTrustVerificationStatus(): TrustVerificationStatus = TrustVerificationStatus(
    status = optString("status", "NOT_STARTED"),
    level = optString("level", "BASIC"),
    faceStatus = optString("faceStatus", "NOT_SUBMITTED"),
    voiceStatus = optString("voiceStatus", "NOT_SUBMITTED"),
    livenessStatus = optString("livenessStatus", "NOT_SUBMITTED"),
    verifiedBadgeEnabled = optBoolean("verifiedBadgeEnabled", false),
    creatorTrustEnabled = optBoolean("creatorTrustEnabled", false),
    rejectionReason = if (has("rejectionReason") && !isNull("rejectionReason")) optString("rejectionReason") else null
)

fun JSONObject.toCreatorPayoutKycStatus(): CreatorPayoutKycStatus = CreatorPayoutKycStatus(
    kycStatus = optString("kycStatus", "NOT_SUBMITTED"),
    payoutStatus = optString("payoutStatus", "DISABLED"),
    legalFullName = if (has("legalFullName") && !isNull("legalFullName")) optString("legalFullName") else null,
    panLast4 = if (has("panLast4") && !isNull("panLast4")) optString("panLast4") else null,
    upiIdMasked = if (has("upiIdMasked") && !isNull("upiIdMasked")) optString("upiIdMasked") else null,
    bankAccountLast4 = if (has("bankAccountLast4") && !isNull("bankAccountLast4")) optString("bankAccountLast4") else null,
    rejectionReason = if (has("rejectionReason") && !isNull("rejectionReason")) optString("rejectionReason") else null
)

fun JSONObject.toCreatorEarningBalance(): CreatorEarningBalance = CreatorEarningBalance(
    earnedCoins = optInt("earnedCoins", 0),
    lockedCoins = optInt("lockedCoins", 0),
    availableCoins = optInt("availableCoins", 0)
)

fun JSONObject.toGameCatalog(): GameCatalog = GameCatalog(
    games = optJSONArray("games")?.toMiniGames() ?: emptyList(),
    recent = optJSONArray("recent")?.toMiniGameScores() ?: emptyList()
)

fun JSONObject.toMiniGame(): MiniGame = MiniGame(
    id = optString("id", optString("_id", "")),
    title = optString("title", "Mini Game"),
    description = optString("description", ""),
    durationSeconds = optInt("durationSeconds", 0),
    scoring = optString("scoring", "Higher score wins"),
    best = optJSONObject("best")?.toMiniGameBest()
)

fun JSONArray.toMiniGames(): List<MiniGame> = buildList {
    for (index in 0 until length()) add(getJSONObject(index).toMiniGame())
}

fun JSONObject.toMiniGameBest(): MiniGameBest = MiniGameBest(
    score = optInt("score", 0),
    createdAt = optString("createdAt", "")
)

fun JSONObject.toMiniGameScore(): MiniGameScore = MiniGameScore(
    id = optString("_id", optString("id", "")),
    gameId = optString("gameId", ""),
    score = optInt("score", 0),
    durationMs = if (has("durationMs") && !isNull("durationMs")) optInt("durationMs") else null,
    rounds = if (has("rounds") && !isNull("rounds")) optInt("rounds") else null,
    createdAt = optString("createdAt", "")
)

fun JSONArray.toMiniGameScores(): List<MiniGameScore> = buildList {
    for (index in 0 until length()) add(getJSONObject(index).toMiniGameScore())
}

fun JSONObject.toGameMissions(): GameMissions = GameMissions(
    date = optString("date", ""),
    missions = optJSONArray("missions")?.toDailyGameMissions() ?: emptyList()
)

fun JSONObject.toDailyGameMission(): DailyGameMission = DailyGameMission(
    id = optString("id", optString("_id", "")),
    title = optString("title", ""),
    progress = optInt("progress", 0),
    target = optInt("target", 0),
    rewardXp = optInt("rewardXp", optInt("reward", 0)),
    complete = optBoolean("complete", false)
)

fun JSONArray.toDailyGameMissions(): List<DailyGameMission> = buildList {
    for (index in 0 until length()) add(getJSONObject(index).toDailyGameMission())
}

fun JSONObject.toGameLeaderboard(): GameLeaderboard = GameLeaderboard(
    gameId = optString("gameId", ""),
    leaderboard = optJSONArray("leaderboard")?.toGameLeaderboardEntries() ?: emptyList(),
    personalBest = optJSONObject("personalBest")?.toMiniGameScore()
)

fun JSONObject.toGameLeaderboardEntry(): GameLeaderboardEntry {
    val userObject = optJSONObject("user")
    return GameLeaderboardEntry(
        userId = optString("userId", userObject?.entityId() ?: ""),
        score = optInt("score", 0),
        createdAt = optString("createdAt", ""),
        user = userObject?.toHost() ?: Host(id = optString("userId", ""), name = "Player", username = "yugm")
    )
}

fun JSONArray.toGameLeaderboardEntries(): List<GameLeaderboardEntry> = buildList {
    for (index in 0 until length()) add(getJSONObject(index).toGameLeaderboardEntry())
}

fun JSONObject.toGameChallenges(): GameChallenges = GameChallenges(
    incoming = optJSONArray("incoming")?.toMiniGameChallenges() ?: emptyList(),
    outgoing = optJSONArray("outgoing")?.toMiniGameChallenges() ?: emptyList(),
    clan = optJSONArray("clan")?.toMiniGameChallenges() ?: emptyList()
)

fun JSONObject.toMiniGameChallenge(): MiniGameChallenge = MiniGameChallenge(
    id = optString("_id", optString("id", "")),
    gameId = optString("gameId", ""),
    score = optInt("score", 0),
    message = optString("message", ""),
    expiresAt = optString("expiresAt", ""),
    createdAt = optString("createdAt", ""),
    challenger = optJSONObject("challenger")?.toHost() ?: optJSONObject("challengerId")?.toHost(),
    targetUser = optJSONObject("targetUser")?.toHost() ?: optJSONObject("targetUserId")?.toHost(),
    clan = optJSONObject("clan")?.toClanSummary() ?: optJSONObject("clanId")?.toClanSummary()
)

fun JSONArray.toMiniGameChallenges(): List<MiniGameChallenge> = buildList {
    for (index in 0 until length()) add(getJSONObject(index).toMiniGameChallenge())
}

fun JSONObject.toClanSummary(): ClanSummary = ClanSummary(
    id = optString("_id", optString("id", "")),
    name = optString("name", "Family"),
    slug = optString("slug", ""),
    avatar = if (has("avatar") && !isNull("avatar")) optString("avatar") else null,
    familyLabel = optString("familyLabel", ""),
    memberCount = optInt("memberCount", 0)
)

fun JSONObject.toSavedGameScoreResult(): SavedGameScoreResult = SavedGameScoreResult(
    score = optJSONObject("score")?.toMiniGameScore() ?: MiniGameScore(),
    isPersonalBest = optBoolean("isPersonalBest", false),
    personalBest = optJSONObject("personalBest")?.toMiniGameScore(),
    reward = optJSONObject("reward")?.toGameReward() ?: GameReward()
)

fun JSONObject.toGameReward(): GameReward = GameReward(
    xpAwarded = optInt("xpAwarded", 0),
    levelUpReward = optInt("levelUpReward", 0)
)

fun JSONObject.toBooleanMap(): Map<String, Boolean> = buildMap {
    val iterator = keys()
    while (iterator.hasNext()) {
        val key = iterator.next()
        put(key, optBoolean(key, false))
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
