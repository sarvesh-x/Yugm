package com.yugm.app.core.api

import com.yugm.app.core.model.GroupChat
import com.yugm.app.core.model.GroupMessage
import org.json.JSONObject

object GroupsApi {
    suspend fun list(token: String): List<GroupChat> {
        val json = YugmHttpClient.get("/groups", token)
        val data = json.getJSONObject("data")
        val array = data.optJSONArray("groups") ?: org.json.JSONArray()
        val groups = mutableListOf<GroupChat>()
        for (i in 0 until array.length()) {
            groups.add(parseGroup(array.getJSONObject(i)))
        }
        return groups
    }

    suspend fun detail(token: String, groupId: String): Pair<GroupChat, Int> {
        val json = YugmHttpClient.get("/groups/$groupId", token)
        val data = json.getJSONObject("data")
        return Pair(parseGroup(data.getJSONObject("group")), data.optInt("messageCount", 0))
    }

    suspend fun create(token: String, name: String, participantIds: List<String>): GroupChat {
        val body = JSONObject().put("name", name).put("participantIds", org.json.JSONArray(participantIds))
        val json = YugmHttpClient.post("/groups", token, body)
        return parseGroup(json.getJSONObject("data").getJSONObject("group"))
    }

    suspend fun addParticipants(token: String, groupId: String, participantIds: List<String>): GroupChat {
        val body = JSONObject().put("participantIds", org.json.JSONArray(participantIds))
        val json = YugmHttpClient.post("/groups/$groupId/add", token, body)
        return parseGroup(json.getJSONObject("data").getJSONObject("group"))
    }

    suspend fun removeParticipant(token: String, groupId: String, userId: String): GroupChat {
        val json = YugmHttpClient.post("/groups/$groupId/remove", token, JSONObject().put("userId", userId))
        return parseGroup(json.getJSONObject("data").getJSONObject("group"))
    }

    suspend fun leave(token: String, groupId: String) {
        YugmHttpClient.post("/groups/$groupId/leave", token, JSONObject())
    }

    suspend fun messages(token: String, groupId: String, skip: Int = 0, limit: Int = 30): List<GroupMessage> {
        val json = YugmHttpClient.get("/groups/$groupId/messages?skip=$skip&limit=$limit", token)
        val data = json.getJSONObject("data")
        val array = data.optJSONArray("messages") ?: org.json.JSONArray()
        val messages = mutableListOf<GroupMessage>()
        for (i in 0 until array.length()) {
            messages.add(parseMessage(array.getJSONObject(i)))
        }
        return messages
    }

    suspend fun sendMessage(token: String, groupId: String, message: String, mediaUrl: String? = null, mediaType: String? = null, duration: Int? = null): GroupMessage {
        val body = JSONObject().put("message", message)
        if (!mediaUrl.isNullOrBlank()) body.put("mediaUrl", mediaUrl)
        if (!mediaType.isNullOrBlank()) body.put("mediaType", mediaType)
        if (duration != null) body.put("duration", duration)
        val json = YugmHttpClient.post("/groups/$groupId/message", token, body)
        val data = json.getJSONObject("data")
        return parseMessage(data.getJSONObject("message"))
    }

    private fun parseGroup(obj: JSONObject): GroupChat {
        val createdByObj = obj.optJSONObject("createdBy")
        val participantsArray = obj.optJSONArray("participantIds")
        val participants = mutableListOf<String>()
        if (participantsArray != null) {
            for (i in 0 until participantsArray.length()) {
                val p = participantsArray.optJSONObject(i)
                if (p != null) participants.add(p.optString("_id", participantsArray.optString(i, "")))
                else participants.add(participantsArray.optString(i, ""))
            }
        }
        return GroupChat(
            id = obj.optString("_id", ""),
            name = obj.optString("name", ""),
            createdBy = createdByObj?.optString("_id", "") ?: obj.optString("createdBy", ""),
            createdByName = createdByObj?.optString("name", "") ?: "",
            createdByAvatar = createdByObj?.optString("avatar", "")?.ifEmpty { null },
            participantIds = participants,
            lastMessage = obj.optString("lastMessage", "").ifEmpty { null },
            lastMessageAt = obj.optString("lastMessageAt", "").ifEmpty { null },
            createdAt = obj.optString("createdAt", ""),
            participantCount = participants.size
        )
    }

    private fun parseMessage(obj: JSONObject): GroupMessage {
        val senderObj = obj.optJSONObject("senderId")
        return GroupMessage(
            id = obj.optString("_id", ""),
            groupId = obj.optString("groupId", ""),
            senderId = senderObj?.optString("_id", "") ?: obj.optString("senderId", ""),
            senderName = senderObj?.optString("name", "") ?: "",
            senderAvatar = senderObj?.optString("avatar", "")?.ifEmpty { null },
            message = obj.optString("message", ""),
            mediaUrl = obj.optString("mediaUrl", ""),
            mediaType = obj.optString("mediaType", ""),
            duration = obj.optInt("duration", 0),
            createdAt = obj.optString("createdAt", "")
        )
    }
}
