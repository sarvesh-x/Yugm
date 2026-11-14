package com.yugm.app.core.api.parsers

import androidx.compose.ui.graphics.Color
import com.yugm.app.core.api.resolveMediaUrl
import com.yugm.app.core.model.ActiveCosmetics
import com.yugm.app.core.model.ChatMessage
import com.yugm.app.core.model.Host
import com.yugm.app.core.model.LevelStatus
import com.yugm.app.core.model.PollOption
import com.yugm.app.core.model.Room
import com.yugm.app.core.model.RoomActivityItem
import com.yugm.app.core.model.RoomDetail
import com.yugm.app.core.model.RoomMission
import com.yugm.app.core.model.RoomParticipant
import com.yugm.app.core.model.RoomPoll
import com.yugm.app.core.model.RoomType
import com.yugm.app.core.model.SpeakerRequest
import org.json.JSONArray
import org.json.JSONObject

fun JSONArray.toRooms(): List<Room> = buildList {
    for (index in 0 until length()) {
        add(getJSONObject(index).toRoom())
    }
}

fun JSONObject.toHost(): Host = Host(
    id = optString("_id", optString("id", "")),
    name = optString("name", ""),
    username = optString("username", ""),
    city = optString("city", ""),
    state = optString("state", ""),
    vibe = optString("bio", optString("vibeLine", "")),
    vibeLine = optString("vibeLine", ""),
    followers = optInt("followersCount", 0),
    followingCount = optInt("followingCount", 0),
    closeFriendsCount = optInt("closeFriendsCount", 0),
    walletBalance = optInt("walletBalance", 0),
    diamondBalance = optInt("diamondBalance", 0),
    bio = optString("bio", ""),
    avatar = if (has("avatar") && !isNull("avatar")) resolveMediaUrl(optString("avatar", "")) else null,
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
    hobbies = optJSONArray("hobbies")?.let { arr -> List(arr.length()) { arr.optString(it) } } ?: emptyList(),
    isOnline = optBoolean("isOnline", false),
    isVerified = optBoolean("isVerified", false),
    verificationLevel = optString("verificationLevel", "NONE")
)

fun JSONArray.toHosts(): List<Host> = buildList {
    for (index in 0 until length()) {
        add(getJSONObject(index).toHost())
    }
}

fun JSONObject.toRoom(): Room {
    val hostJson = optJSONObject("hostId") ?: optJSONObject("host")
    val tagsJson = optJSONArray("tags") ?: JSONArray()
    val type = if (optString("type").equals("VIDEO", ignoreCase = true)) RoomType.Video else RoomType.Voice
    val desc = optString("description", optString("bio", ""))
    val bioStr = optString("bio", desc)
    val maxMicsCount = optInt("maxSpeakers", optInt("maxMics", optInt("maxSeats", optInt("speakerLimit", optInt("micCount", if (type == RoomType.Video) 4 else 8))))).coerceIn(2, 20)
    return Room(
        id = optString("_id", optString("id", "")),
        title = optString("title", ""),
        description = desc,
        bio = bioStr,
        type = type,
        status = optString("status", "LIVE"),
        scheduledFor = optString("scheduledFor", ""),
        coverImage = if (has("coverImage") && !isNull("coverImage")) resolveMediaUrl(optString("coverImage", "")) else null,
        host = hostJson?.toHost(),
        category = optString("category", ""),
        language = optString("language", ""),
        tags = buildList {
            for (index in 0 until tagsJson.length()) add(tagsJson.optString(index))
        },
        participants = optInt("participantCount", optInt("participants", 0)),
        maxSpeakers = maxMicsCount,
        gradient = roomGradient(optString("_id", optString("title"))),
        theme = optString("theme", ""),
        vipOnly = optBoolean("vipOnly", false),
        badge = optString("badge", ""),
        ambience = optString("ambience", ""),
        micLocked = optBoolean("micLocked", false),
        lockedSeatIndices = optJSONArray("lockedSeatIndices")?.let { array -> List(array.length()) { array.optInt(it) } } ?: emptyList(),
        allowAudienceMicRequests = optBoolean("allowAudienceMicRequests", true),
        mode = if (has("mode") && !isNull("mode")) optString("mode") else null
    )
}

fun JSONObject.toRoomDetail(): RoomDetail = RoomDetail(
    room = getJSONObject("room").toRoom(),
    participants = optJSONArray("participants")?.toRoomParticipants() ?: emptyList(),
    speakerRequests = optJSONArray("speakerRequests")?.toSpeakerRequests() ?: emptyList()
)

fun JSONObject.toRoomChatMessage(): ChatMessage {
    val sender = optJSONObject("senderId") ?: optJSONObject("sender") ?: JSONObject()
    return ChatMessage(
        id = optString("_id", optString("id", "")),
        authorId = if (has("senderId") && !isNull("senderId")) {
            if (opt("senderId") is JSONObject) sender.optString("_id", sender.optString("id", "")) else optString("senderId", "")
        } else "",
        author = sender.optString("name", optString("senderName", "User")),
        authorAvatar = sender.optString("avatar", "").ifBlank { null },
        text = optString("message", ""),
        createdAt = optString("createdAt", "")
    )
}

fun JSONObject.toRoomParticipant(): RoomParticipant {
    val userJson = optJSONObject("userId") ?: optJSONObject("user") ?: JSONObject()
    return RoomParticipant(
        id = optString("_id", optString("id", "")),
        user = userJson.toHost(),
        role = optString("role", "AUDIENCE"),
        isRoomAdmin = optBoolean("isRoomAdmin", optString("role") == "MODERATOR"),
        micEnabled = optBoolean("micEnabled", true),
        moderatorMuted = optBoolean("moderatorMuted", false),
        cameraEnabled = optBoolean("cameraEnabled", false),
        seatIndex = if (has("seatIndex") && !isNull("seatIndex")) optInt("seatIndex") else null
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

fun roomGradient(seed: String): List<Color> {
    return when ((seed.hashCode() and Int.MAX_VALUE) % 4) {
        0 -> listOf(Color(0xFF25164C), Color(0xFF8A3FFC), Color(0xFFFF3E93))
        1 -> listOf(Color(0xFF12263A), Color(0xFF165DFF), Color(0xFF27D3FF))
        2 -> listOf(Color(0xFF1B1A38), Color(0xFFFF8A22), Color(0xFFF6B44B))
        else -> listOf(Color(0xFF101028), Color(0xFF7C2DFF), Color(0xFFFFB547))
    }
}
