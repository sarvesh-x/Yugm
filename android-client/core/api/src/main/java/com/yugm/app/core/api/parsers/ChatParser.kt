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
    mediaType = optString("mediaType", "")
)

fun JSONArray.toDirectMessages(): List<DirectMessage> = buildList {
    for (index in 0 until length()) add(getJSONObject(index).toDirectMessage())
}
