package com.yugm.app.core.api.parsers

import com.yugm.app.core.model.DirectMessage
import org.json.JSONArray
import org.json.JSONObject

fun JSONObject.toDirectMessage(): DirectMessage = DirectMessage(
    id = optString("_id", optString("id", "")),
    senderId = optJSONObject("senderId")?.entityId() ?: optString("senderId", ""),
    receiverId = optJSONObject("receiverId")?.entityId() ?: optString("receiverId", ""),
    sender = optJSONObject("senderId")?.toHost(),
    receiver = optJSONObject("receiverId")?.toHost(),
    message = optString("message", ""),
    createdAt = optString("createdAt", ""),
    read = optBoolean("read", false),
    reactionCount = optJSONArray("reactions")?.length() ?: 0,
    mediaUrl = optString("mediaUrl", ""),
    mediaType = optString("mediaType", ""),
    replyTo = optJSONObject("replyTo")?.takeIf { it.optString("messageId").isNotBlank() }?.let { reply ->
        com.yugm.app.core.model.ChatReplyTo(
            messageId = reply.optString("messageId", ""),
            author = reply.optString("author", ""),
            authorId = reply.optJSONObject("authorId")?.entityId() ?: reply.optString("authorId", ""),
            text = reply.optString("text", ""),
            mediaUrl = reply.optString("mediaUrl", "").takeIf { it.isNotBlank() }
        )
    },
    forwarded = optBoolean("forwarded", false),
    isEdited = optBoolean("isEdited", false)
)

fun JSONArray.toDirectMessages(): List<DirectMessage> = buildList {
    for (index in 0 until length()) add(getJSONObject(index).toDirectMessage())
}
