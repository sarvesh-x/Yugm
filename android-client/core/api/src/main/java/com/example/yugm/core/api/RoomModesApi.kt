package com.example.yugm.core.api

import com.example.yugm.core.api.parsers.toRoom
import com.example.yugm.core.api.parsers.toRoomModeState
import com.example.yugm.core.model.Room
import com.example.yugm.core.model.RoomModeInfo
import com.example.yugm.core.model.RoomModeState
import org.json.JSONObject
import org.json.JSONArray

object RoomModesApi {
    suspend fun modes(): List<RoomModeInfo> {
        val data = YugmHttpClient.get("/rooms/modes", auth = null).getJSONObject("data")
        val arr = data.getJSONArray("modes")
        return buildList { for (i in 0 until arr.length()) add(arr.getJSONObject(i).toRoomModeInfo()) }
    }

    suspend fun setMode(token: String, roomId: String, mode: String): Pair<Room, RoomModeState> {
        val body = JSONObject().put("mode", mode)
        val data = YugmHttpClient.post("/rooms/$roomId/mode", token, body).getJSONObject("data")
        val room = data.getJSONObject("room").toRoom()
        val state = data.getJSONObject("modeState").toRoomModeState()
        return room to state
    }

    suspend fun modeState(token: String, roomId: String): Pair<String?, RoomModeState?> {
        val data = YugmHttpClient.get("/rooms/$roomId/mode-state", token).getJSONObject("data")
        val mode: String? = if (data.has("mode") && !data.isNull("mode")) data.optString("mode", "") else null
        val state = if (data.has("modeState") && !data.isNull("modeState")) {
            data.getJSONObject("modeState").toRoomModeState()
        } else null
        return mode to state
    }

    suspend fun modeAction(
        token: String,
        roomId: String,
        action: String,
        data: Map<String, Any>? = null
    ): RoomModeState {
        val body = JSONObject().put("action", action)
        data?.forEach { (key, value) ->
            when (value) {
                is String -> body.put(key, value)
                is Number -> body.put(key, value)
                is Boolean -> body.put(key, value)
                else -> body.put(key, value.toString())
            }
        }
        val response = YugmHttpClient.post("/rooms/$roomId/mode/action", token, body).getJSONObject("data")
        return response.getJSONObject("modeState").toRoomModeState()
    }

    suspend fun randomModeRoom(token: String): Triple<String, Room?, List<Room>> {
        val data = YugmHttpClient.post("/rooms/mode/random", token, JSONObject()).getJSONObject("data")
        val mode = data.optString("mode", "")
        val room = if (data.has("room") && !data.isNull("room")) data.getJSONObject("room").toRoom() else null
        val rooms = data.optJSONArray("rooms")?.toRooms() ?: emptyList()
        return Triple(mode, room, rooms)
    }

    private fun JSONObject.toRoomModeInfo(): RoomModeInfo = RoomModeInfo(
        key = optString("key", ""),
        name = optString("name", ""),
        description = optString("description", ""),
        icon = optString("icon", ""),
        minParticipants = optInt("minParticipants", 2),
        maxParticipants = optInt("maxParticipants", 10),
        durationSeconds = optInt("durationSeconds", 300)
    )

    private fun JSONArray.toRooms(): List<Room> = buildList {
        for (i in 0 until length()) add(getJSONObject(i).toRoom())
    }
}
