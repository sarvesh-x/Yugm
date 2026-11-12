package com.example.yugm.core.api.parsers

import androidx.compose.ui.graphics.Color
import com.example.yugm.core.model.ActiveCosmetics
import com.example.yugm.core.model.Host
import com.example.yugm.core.model.LevelStatus
import com.example.yugm.core.model.PollOption
import com.example.yugm.core.model.Room
import com.example.yugm.core.model.RoomActivityItem
import com.example.yugm.core.model.RoomDetail
import com.example.yugm.core.model.RoomMission
import com.example.yugm.core.model.RoomParticipant
import com.example.yugm.core.model.RoomPoll
import com.example.yugm.core.model.RoomType
import com.example.yugm.core.model.SpeakerRequest
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

fun JSONArray.toHosts(): List<Host> = buildList {
    for (index in 0 until length()) {
        add(getJSONObject(index).toHost())
    }
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
        gradient = roomGradient(optString("_id", optString("title"))),
        theme = optString("theme", ""),
        vipOnly = optBoolean("vipOnly", false),
        badge = optString("badge", ""),
        ambience = optString("ambience", ""),
        mode = if (has("mode") && !isNull("mode")) optString("mode") else null
    )
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
        isRoomAdmin = optBoolean("isRoomAdmin", optString("role") == "MODERATOR"),
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

fun roomGradient(seed: String): List<Color> {
    return when ((seed.hashCode() and Int.MAX_VALUE) % 4) {
        0 -> listOf(Color(0xFF25164C), Color(0xFF8A3FFC), Color(0xFFFF3E93))
        1 -> listOf(Color(0xFF12263A), Color(0xFF165DFF), Color(0xFF27D3FF))
        2 -> listOf(Color(0xFF1B1A38), Color(0xFFFF8A22), Color(0xFFF6B44B))
        else -> listOf(Color(0xFF101028), Color(0xFF7C2DFF), Color(0xFFFFB547))
    }
}
