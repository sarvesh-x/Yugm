package com.example.yugm.core.api.parsers

import com.example.yugm.core.model.RoomModeState
import org.json.JSONObject

fun JSONObject.toRoomModeState(): RoomModeState {
    val scoresRaw = optJSONObject("scores")
    val scores = if (scoresRaw != null) {
        mutableMapOf<String, Int>().apply {
            for (key in scoresRaw.keys()) {
                put(key, scoresRaw.optInt(key, 0))
            }
        }
    } else emptyMap()

    val participantsArr = optJSONArray("participants")
    val participants = if (participantsArr != null) {
        val list = mutableListOf<String>()
        for (i in 0 until participantsArr.length()) list.add(participantsArr.optString(i))
        list
    } else emptyList()

    val optionsArr = optJSONArray("currentOptions")
    val options = if (optionsArr != null) {
        val list = mutableListOf<String>()
        for (i in 0 until optionsArr.length()) list.add(optionsArr.optString(i))
        list
    } else null

    val metadataRaw = optJSONObject("metadata")
    val metadata = if (metadataRaw != null) {
        mutableMapOf<String, Any>().apply {
            for (key in metadataRaw.keys()) {
                val value = metadataRaw.get(key)
                if (value is String || value is Number || value is Boolean) {
                    put(key, value)
                }
            }
        }
    } else emptyMap()

    return RoomModeState(
        roomId = optString("roomId", ""),
        mode = optString("mode", ""),
        round = optInt("round", 1),
        status = optString("status", "WAITING"),
        scores = scores,
        currentTurnUserId = if (has("currentTurnUserId") && !isNull("currentTurnUserId")) {
            optJSONObject("currentTurnUserId")?.optString("_id")
                ?: optString("currentTurnUserId")
        } else null,
        currentQuestion = if (has("currentQuestion") && !isNull("currentQuestion")) optString("currentQuestion") else null,
        currentOptions = options,
        participants = participants,
        roundStartTime = if (has("roundStartTime") && !isNull("roundStartTime")) optString("roundStartTime") else null,
        roundEndTime = if (has("roundEndTime") && !isNull("roundEndTime")) optString("roundEndTime") else null,
        metadata = metadata
    )
}
