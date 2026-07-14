package com.example.yugm.api

import com.example.yugm.model.ChatMessage
import com.example.yugm.model.Host
import com.example.yugm.model.MediaSession
import com.example.yugm.model.Room
import com.example.yugm.model.RoomActivityItem
import com.example.yugm.model.RoomDetail
import com.example.yugm.model.RoomLeaderboard
import com.example.yugm.model.RoomMission
import com.example.yugm.model.RoomParticipant
import com.example.yugm.model.RoomPoll
import com.example.yugm.model.RoomType
import com.example.yugm.model.SpeakerRequest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject

object RoomApi {
    suspend fun rooms(type: RoomType? = null): List<Room> {
        val query = type?.let { "?type=${it.name.uppercase()}" }.orEmpty()
        val data = YugmHttpClient.get("/rooms$query", auth = null).getJSONObject("data")
        return data.getJSONArray("rooms").toRooms()
    }

    suspend fun roomMessages(roomId: String, token: String? = null): List<ChatMessage> {
        val data = YugmHttpClient.get("/rooms/$roomId/messages", auth = token).getJSONObject("data")
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
        return YugmHttpClient.post("/rooms", token, body).getJSONObject("data").getJSONObject("room").toRoom()
    }

    suspend fun roomDetail(token: String, roomId: String): RoomDetail {
        val data = YugmHttpClient.get("/rooms/$roomId", token).getJSONObject("data")
        return data.toRoomDetail()
    }

    suspend fun trendingRooms(): List<Room> {
        val data = YugmHttpClient.get("/rooms/trending", auth = null).getJSONObject("data")
        return data.getJSONArray("rooms").toRooms()
    }

    suspend fun recommendedRooms(token: String): List<Room> {
        val data = YugmHttpClient.get("/rooms/recommended", token).getJSONObject("data")
        return data.getJSONArray("rooms").toRooms()
    }

    suspend fun scheduledRooms(): List<Room> {
        val data = YugmHttpClient.get("/rooms/scheduled", auth = null).getJSONObject("data")
        return data.getJSONArray("rooms").toRooms()
    }

    suspend fun leaderboard(): RoomLeaderboard {
        val data = YugmHttpClient.get("/rooms/leaderboard", auth = null).getJSONObject("data")
        return RoomLeaderboard(
            topRooms = data.optJSONArray("topRooms")?.toRooms() ?: emptyList(),
            topHosts = data.optJSONArray("topHosts")?.toHosts() ?: emptyList()
        )
    }

    suspend fun joinRoom(token: String, roomId: String) {
        YugmHttpClient.post("/rooms/$roomId/join", token, JSONObject())
    }

    suspend fun leaveRoom(token: String, roomId: String) {
        YugmHttpClient.post("/rooms/$roomId/leave", token, JSONObject())
    }

    suspend fun liveKitToken(token: String, roomId: String): MediaSession {
        val data = YugmHttpClient.post("/livekit/token", token, JSONObject().put("roomId", roomId)).getJSONObject("data")
        return MediaSession(
            token = data.optString("token"),
            url = data.optString("url"),
            roomName = data.optString("roomName"),
            role = data.optString("role", "AUDIENCE")
        )
    }

    suspend fun sendMessage(token: String, roomId: String, message: String) {
        YugmHttpClient.post("/rooms/$roomId/messages", token, JSONObject().put("message", message))
    }

    suspend fun requestSpeaker(token: String, roomId: String) {
        YugmHttpClient.post("/rooms/$roomId/request-speaker", token, JSONObject())
    }

    suspend fun approveSpeaker(token: String, roomId: String, userId: String) {
        YugmHttpClient.post("/rooms/$roomId/approve-speaker", token, JSONObject().put("userId", userId))
    }

    suspend fun rejectSpeaker(token: String, roomId: String, userId: String) {
        YugmHttpClient.post("/rooms/$roomId/reject-speaker", token, JSONObject().put("userId", userId))
    }

    suspend fun roomActivity(roomId: String): List<RoomActivityItem> {
        val data = YugmHttpClient.get("/rooms/$roomId/activity", auth = null).getJSONObject("data")
        return data.optJSONArray("activity")?.toRoomActivityItems() ?: emptyList()
    }

    suspend fun roomPolls(roomId: String): List<RoomPoll> {
        val data = YugmHttpClient.get("/rooms/$roomId/polls", auth = null).getJSONObject("data")
        return data.optJSONArray("polls")?.toRoomPolls() ?: emptyList()
    }

    suspend fun createPoll(token: String, roomId: String, question: String, options: List<String>) {
        YugmHttpClient.post("/rooms/$roomId/polls", token, JSONObject().put("question", question).put("options", JSONArray(options)))
    }

    suspend fun votePoll(token: String, roomId: String, pollId: String, optionIndex: Int) {
        YugmHttpClient.post("/rooms/$roomId/polls/$pollId/vote", token, JSONObject().put("optionIndex", optionIndex))
    }

    suspend fun roomMissions(token: String, roomId: String): List<RoomMission> {
        val data = YugmHttpClient.get("/rooms/$roomId/missions", token).getJSONObject("data")
        return data.optJSONArray("missions")?.toRoomMissions() ?: emptyList()
    }

    suspend fun reactToRoom(token: String, roomId: String, type: String) {
        YugmHttpClient.post("/rooms/$roomId/reactions", token, JSONObject().put("type", type))
    }

    suspend fun inviteToRoom(token: String, roomId: String, userId: String) {
        YugmHttpClient.post("/rooms/$roomId/invites", token, JSONObject().put("userId", userId))
    }

    suspend fun roomDirectMessage(token: String, roomId: String, message: String, receiverId: String? = null) {
        val body = JSONObject().put("message", message)
        if (!receiverId.isNullOrBlank()) body.put("receiverId", receiverId)
        YugmHttpClient.post("/rooms/$roomId/messages/direct", token, body)
    }

    suspend fun endRoom(roomId: String, token: String) {
        YugmHttpClient.post("/rooms/$roomId/end", token, JSONObject())
    }

    suspend fun muteUser(roomId: String, userId: String, token: String) {
        YugmHttpClient.post("/rooms/$roomId/mute-user", token, JSONObject().put("userId", userId))
    }

    suspend fun removeUser(roomId: String, userId: String, token: String) {
        YugmHttpClient.post("/rooms/$roomId/remove-user", token, JSONObject().put("userId", userId))
    }

    suspend fun searchRooms(query: String): List<Room> {
        val encoded = java.net.URLEncoder.encode(query, "UTF-8")
        val data = YugmHttpClient.get("/rooms/search?q=$encoded", auth = null).getJSONObject("data")
        return data.getJSONArray("rooms").toRooms()
    }

    suspend fun uploadCover(token: String, bytes: ByteArray, mimeType: String, fileName: String): String = withContext(Dispatchers.IO) {
        if (!YugmHttpClient.isOnline) throw IllegalStateException("No internet connection")
        val base = YugmHttpClient.workingBaseUrl ?: YugmHttpClient.baseCandidates.firstOrNull()
            ?: throw IllegalStateException("API_BASE_URL is not configured for this build")
        val mediaType = mimeType.ifBlank { "image/jpeg" }.toMediaType()
        val body = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart("cover", fileName.ifBlank { "room-cover.jpg" }, bytes.toRequestBody(mediaType))
            .build()
        val okClient = okhttp3.OkHttpClient()
        val request = Request.Builder()
            .url("$base/upload/cover")
            .header("Authorization", "Bearer $token")
            .post(body)
            .build()
        okClient.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                val message = runCatching { JSONObject(raw).optJSONObject("error")?.optString("message") }.getOrNull()
                throw ApiHttpException(response.code, message ?: "Cover upload failed")
            }
            val url = JSONObject(raw).getJSONObject("data").optString("url")
            if (url.isBlank()) throw ApiProtocolException("Cover upload returned no URL")
            YugmHttpClient.workingBaseUrl = base
            url
        }
    }

    suspend fun uploadMessageMedia(token: String, bytes: ByteArray, mimeType: String, fileName: String): Pair<String, String> = withContext(Dispatchers.IO) {
        if (!YugmHttpClient.isOnline) throw IllegalStateException("No internet connection")
        val base = YugmHttpClient.workingBaseUrl ?: YugmHttpClient.baseCandidates.firstOrNull()
            ?: throw IllegalStateException("API_BASE_URL is not configured for this build")
        val body = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart("media", fileName.ifBlank { "message-media.jpg" }, bytes.toRequestBody(mimeType.ifBlank { "image/jpeg" }.toMediaType()))
            .build()
        val okClient = okhttp3.OkHttpClient()
        val request = Request.Builder().url("$base/upload/profile-media").header("Authorization", "Bearer $token").post(body).build()
        okClient.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) throw ApiHttpException(response.code, "Message media upload failed")
            val data = JSONObject(raw).getJSONObject("data")
            val url = data.optString("url")
            val type = data.optString("type")
            if (url.isBlank() || type.isBlank()) throw ApiProtocolException("Media upload returned invalid data")
            YugmHttpClient.workingBaseUrl = base
            url to type
        }
    }
}
