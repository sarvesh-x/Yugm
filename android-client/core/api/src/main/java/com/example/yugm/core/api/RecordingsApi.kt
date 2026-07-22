package com.example.yugm.core.api

import com.example.yugm.core.model.RoomRecording
import org.json.JSONObject

object RecordingsApi {
    suspend fun start(token: String, roomId: String, title: String? = null): RoomRecording {
        val body = JSONObject().put("roomId", roomId)
        if (!title.isNullOrBlank()) body.put("title", title)
        val json = YugmHttpClient.post("/recordings", token, body)
        val data = json.getJSONObject("data")
        return parseRecording(data.getJSONObject("recording"))
    }

    suspend fun stop(token: String, recordingId: String, recordingUrl: String, duration: Int): RoomRecording {
        val body = JSONObject().put("recordingUrl", recordingUrl).put("duration", duration)
        val json = YugmHttpClient.patch("/recordings/$recordingId/stop", token, body)
        val data = json.getJSONObject("data")
        return parseRecording(data.getJSONObject("recording"))
    }

    suspend fun listByRoom(token: String, roomId: String, page: Int = 1, limit: Int = 20): Pair<List<RoomRecording>, Int> {
        val json = YugmHttpClient.get("/recordings/room/$roomId?page=$page&limit=$limit", token)
        val data = json.getJSONObject("data")
        val array = data.optJSONArray("recordings") ?: org.json.JSONArray()
        val recordings = mutableListOf<RoomRecording>()
        for (i in 0 until array.length()) {
            recordings.add(parseRecording(array.getJSONObject(i)))
        }
        return Pair(recordings, data.optInt("total", 0))
    }

    suspend fun detail(token: String, recordingId: String): RoomRecording {
        val json = YugmHttpClient.get("/recordings/$recordingId", token)
        val data = json.getJSONObject("data")
        return parseRecording(data.getJSONObject("recording"))
    }

    suspend fun update(token: String, recordingId: String, title: String): RoomRecording {
        val json = YugmHttpClient.patch("/recordings/$recordingId", token, JSONObject().put("title", title))
        val data = json.getJSONObject("data")
        return parseRecording(data.getJSONObject("recording"))
    }

    suspend fun delete(token: String, recordingId: String) {
        YugmHttpClient.delete("/recordings/$recordingId", token)
    }

    suspend fun view(token: String, recordingId: String): Int {
        val json = YugmHttpClient.post("/recordings/$recordingId/view", token, JSONObject())
        return json.getJSONObject("data").optInt("viewCount", 0)
    }

    private fun parseRecording(obj: JSONObject): RoomRecording {
        val hostObj = obj.optJSONObject("hostId")
        val roomObj = obj.optJSONObject("roomId")
        return RoomRecording(
            id = obj.optString("_id", ""),
            roomId = if (roomObj != null) roomObj.optString("_id", obj.optString("roomId", "")) else obj.optString("roomId", ""),
            hostId = hostObj?.optString("_id", "") ?: obj.optString("hostId", ""),
            hostName = hostObj?.optString("name", "") ?: "",
            hostAvatar = hostObj?.optString("avatar", "")?.ifEmpty { null },
            title = obj.optString("title", ""),
            recordingUrl = obj.optString("recordingUrl", ""),
            duration = obj.optInt("duration", 0),
            viewCount = obj.optInt("viewCount", 0),
            status = obj.optString("status", "PROCESSING"),
            createdAt = obj.optString("createdAt", "")
        )
    }
}
