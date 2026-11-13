package com.yugm.app.core.api

import com.yugm.app.core.api.parsers.*
import com.yugm.app.core.model.ChatMessage
import com.yugm.app.core.model.Host
import com.yugm.app.core.model.MediaSession
import com.yugm.app.core.model.Room
import com.yugm.app.core.model.RoomActivityItem
import com.yugm.app.core.model.RoomDetail
import com.yugm.app.core.model.RoomLeaderboard
import com.yugm.app.core.model.RoomMission
import com.yugm.app.core.model.RoomParticipant
import com.yugm.app.core.model.RoomPoll
import com.yugm.app.core.model.RoomType
import com.yugm.app.core.model.SpeakerRequest
import okhttp3.MediaType.Companion.toMediaType
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
                add(item.toRoomChatMessage())
            }
        }
    }

    suspend fun updateRoom(
        token: String,
        roomId: String,
        room: Room,
        coverImage: String? = null
    ): Room {
        val body = JSONObject()
            .put("type", room.type.name.uppercase())
            .put("title", room.title)
            .put("description", room.description)
            .put("bio", room.bio.ifBlank { room.description })
            .put("tags", JSONArray(room.tags))
            .put("language", room.language)
            .put("category", room.category)
            .put("maxSpeakers", room.maxSpeakers)
            .put("maxMics", room.maxSpeakers)
            .put("maxSeats", room.maxSpeakers)
            .put("vipOnly", room.vipOnly)
            .put("micLocked", room.micLocked)
        if (room.theme.isNotBlank()) body.put("theme", room.theme)
        if (room.badge.isNotBlank()) body.put("badge", room.badge)
        if (room.ambience.isNotBlank()) body.put("ambience", room.ambience)
        if (!room.mode.isNullOrBlank()) body.put("mode", room.mode)
        if (!coverImage.isNullOrBlank()) body.put("coverImage", coverImage)
        return YugmHttpClient.patch("/rooms/$roomId", token, body).getJSONObject("data").getJSONObject("room").toRoom()
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
            .put("bio", room.bio.ifBlank { room.description })
            .put("tags", JSONArray(room.tags))
            .put("language", room.language)
            .put("category", room.category)
            .put("maxSpeakers", room.maxSpeakers)
            .put("maxMics", room.maxSpeakers)
            .put("maxSeats", room.maxSpeakers)
            .put("visibility", visibility)
            .put("allowAudienceMicRequests", allowAudienceMicRequests)
            .put("vipOnly", room.vipOnly)
        if (room.theme.isNotBlank()) body.put("theme", room.theme)
        if (room.badge.isNotBlank()) body.put("badge", room.badge)
        if (room.ambience.isNotBlank()) body.put("ambience", room.ambience)
        if (!room.mode.isNullOrBlank()) body.put("mode", room.mode)
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

    suspend fun sendMessage(token: String, roomId: String, message: String): ChatMessage {
        val data = YugmHttpClient.post("/rooms/$roomId/messages", token, JSONObject().put("message", message)).getJSONObject("data")
        return data.getJSONObject("message").toRoomChatMessage()
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

    suspend fun takeRoomSeat(token: String, roomId: String, seatIndex: Int) {
        YugmHttpClient.post("/rooms/$roomId/take-seat", token, JSONObject().put("seatIndex", seatIndex))
    }

    suspend fun inviteSpeaker(token: String, roomId: String, userId: String) {
        YugmHttpClient.post("/rooms/$roomId/invite-speaker", token, JSONObject().put("userId", userId))
    }

    suspend fun removeSpeaker(token: String, roomId: String, userId: String) {
        YugmHttpClient.post("/rooms/$roomId/remove-speaker", token, JSONObject().put("userId", userId))
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

    suspend fun setOwnRoomMicState(roomId: String, enabled: Boolean, token: String) {
        YugmHttpClient.post("/rooms/$roomId/mic-state", token, JSONObject().put("enabled", enabled))
    }

    suspend fun removeUser(roomId: String, userId: String, token: String) {
        YugmHttpClient.post("/rooms/$roomId/remove-user", token, JSONObject().put("userId", userId))
    }

    suspend fun setRoomAdmin(roomId: String, userId: String, isAdmin: Boolean, token: String) {
        YugmHttpClient.post("/rooms/$roomId/admin", token, JSONObject().put("userId", userId).put("isAdmin", isAdmin))
    }

    suspend fun setRoomMicLocked(roomId: String, locked: Boolean, token: String) {
        YugmHttpClient.post("/rooms/$roomId/mic-lock", token, JSONObject().put("locked", locked))
    }

    suspend fun setRoomSeatLocked(roomId: String, seatIndex: Int, locked: Boolean, token: String) {
        YugmHttpClient.post("/rooms/$roomId/seat-lock", token, JSONObject().put("seatIndex", seatIndex).put("locked", locked))
    }

    suspend fun searchRooms(query: String): List<Room> {
        val encoded = java.net.URLEncoder.encode(query, "UTF-8")
        val data = YugmHttpClient.get("/rooms/search?q=$encoded", auth = null).getJSONObject("data")
        return data.getJSONArray("rooms").toRooms()
    }

    suspend fun uploadCover(token: String, bytes: ByteArray, mimeType: String, fileName: String): String {
        val data = YugmHttpClient.multipartUpload("/upload/cover", token) {
            val mediaType = mimeType.ifBlank { "image/jpeg" }.toMediaType()
            addFormDataPart("cover", fileName.ifBlank { "room-cover.jpg" }, bytes.toRequestBody(mediaType))
        }
        val url = data.getJSONObject("data").optString("url")
        if (url.isBlank()) throw ApiProtocolException("Cover upload returned no URL")
        return url
    }

    suspend fun roomPkHistory(roomId: String, token: String): List<com.yugm.app.core.model.PkBattle> {
        val data = YugmHttpClient.get("/rooms/$roomId/pk-history", token).getJSONObject("data")
        return data.optJSONArray("battles")?.toPkBattles() ?: emptyList()
    }

    suspend fun uploadAvatar(token: String, bytes: ByteArray, mimeType: String): String {
        val data = YugmHttpClient.multipartUpload("/upload/avatar", token) {
            val mediaType = mimeType.ifBlank { "image/jpeg" }.toMediaType()
            val ext = mimeType.substringAfter('/', "jpg")
            addFormDataPart("avatar", "avatar.$ext", bytes.toRequestBody(mediaType))
        }
        val url = data.getJSONObject("data").optString("url")
        if (url.isBlank()) throw ApiProtocolException("Avatar upload returned no URL")
        return url
    }

    suspend fun uploadMessageMedia(token: String, bytes: ByteArray, mimeType: String, fileName: String): Pair<String, String> {
        val data = YugmHttpClient.multipartUpload("/upload/profile-media", token) {
            val mediaType = mimeType.ifBlank { "image/jpeg" }.toMediaType()
            addFormDataPart("media", fileName.ifBlank { "message-media.jpg" }, bytes.toRequestBody(mediaType))
        }
        val d = data.getJSONObject("data")
        val url = d.optString("url")
        val type = d.optString("type")
        if (url.isBlank() || type.isBlank()) throw ApiProtocolException("Media upload returned invalid data")
        return url to type
    }

    suspend fun coHosts(token: String, roomId: String): List<Host> {
        val data = YugmHttpClient.get("/rooms/$roomId/co-hosts", token).getJSONObject("data")
        val arr = data.optJSONArray("coHosts") ?: JSONArray()
        val result = mutableListOf<Host>()
        for (i in 0 until arr.length()) {
            val obj = arr.optJSONObject(i)
            if (obj != null) result.add(Host(id = obj.optString("_id", ""), name = obj.optString("name", ""), username = obj.optString("username", ""), avatar = obj.optString("avatar", "").ifEmpty { null }))
        }
        return result
    }

    suspend fun addCoHost(token: String, roomId: String, userId: String): Host {
        val data = YugmHttpClient.post("/rooms/$roomId/co-host", token, JSONObject().put("userId", userId)).getJSONObject("data")
        val room = data.optJSONObject("room") ?: JSONObject()
        val arr = room.optJSONArray("coHostIds") ?: JSONArray()
        val added = mutableListOf<Host>()
        for (i in 0 until arr.length()) {
            val obj = arr.optJSONObject(i)
            if (obj != null && obj.optString("_id", "") == userId) return Host(id = obj.optString("_id", ""), name = obj.optString("name", ""), username = obj.optString("username", ""), avatar = obj.optString("avatar", "").ifEmpty { null })
        }
        return Host(id = userId)
    }

    suspend fun removeCoHost(token: String, roomId: String, userId: String) {
        YugmHttpClient.post("/rooms/$roomId/remove-co-host", token, JSONObject().put("userId", userId))
    }

    suspend fun uploadTrustVerificationMedia(token: String, bytes: ByteArray, mimeType: String, purpose: String): String {
        val ext = when {
            mimeType.startsWith("image/") -> "jpg"
            mimeType.startsWith("audio/") -> "mp3"
            mimeType.startsWith("video/") -> "mp4"
            else -> "bin"
        }
        val data = YugmHttpClient.multipartUpload("/upload/trust-verification?purpose=$purpose", token) {
            val mediaType = mimeType.ifBlank { "image/jpeg" }.toMediaType()
            addFormDataPart("media", "trust-$purpose.$ext", bytes.toRequestBody(mediaType))
        }
        val url = data.getJSONObject("data").optString("url")
        if (url.isBlank()) throw ApiProtocolException("Trust verification upload returned no URL")
        return url
    }
}
