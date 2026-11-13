package com.yugm.app.core.api

import com.yugm.app.core.model.YugmEvent
import com.yugm.app.core.model.EventPagination
import com.yugm.app.core.model.MyEvents
import org.json.JSONObject

object EventsApi {
    suspend fun list(token: String? = null, page: Int = 1, limit: Int = 20, status: String? = null, type: String? = null, category: String? = null, upcoming: Boolean? = null, festival: String? = null, featured: Boolean? = null): Pair<List<YugmEvent>, EventPagination> {
        val params = mutableListOf("page=$page", "limit=$limit")
        if (status != null) params.add("status=$status")
        if (type != null) params.add("type=$type")
        if (category != null) params.add("category=$category")
        if (upcoming != null) params.add("upcoming=$upcoming")
        if (festival != null) params.add("festival=$festival")
        if (featured != null) params.add("featured=$featured")
        val json = YugmHttpClient.get("/events?${params.joinToString("&")}", token)
        val data = json.getJSONObject("data")
        val paginationObj = data.optJSONObject("pagination") ?: JSONObject()
        val pagination = EventPagination(
            page = paginationObj.optInt("page", 1),
            limit = paginationObj.optInt("limit", 20),
            total = paginationObj.optInt("total", 0),
            pages = paginationObj.optInt("pages", 1)
        )
        return Pair(parseEvents(data.optJSONArray("events")), pagination)
    }

    suspend fun detail(eventId: String, token: String? = null): YugmEvent {
        val json = YugmHttpClient.get("/events/$eventId", token)
        return parseEvent(json.getJSONObject("data").getJSONObject("event"))
    }

    suspend fun create(token: String, title: String, description: String? = null, coverImage: String? = null, category: String, type: String, eventDate: String, eventEndDate: String? = null, timezone: String? = null, roomId: String? = null, maxParticipants: Int? = null, tags: List<String>? = null, festival: String? = null): YugmEvent {
        val body = JSONObject().apply {
            put("title", title)
            put("category", category)
            put("type", type)
            put("eventDate", eventDate)
            if (!description.isNullOrBlank()) put("description", description)
            if (!coverImage.isNullOrBlank()) put("coverImage", coverImage)
            if (!eventEndDate.isNullOrBlank()) put("eventEndDate", eventEndDate)
            if (!timezone.isNullOrBlank()) put("timezone", timezone)
            if (!roomId.isNullOrBlank()) put("roomId", roomId)
            if (maxParticipants != null) put("maxParticipants", maxParticipants)
            if (!tags.isNullOrEmpty()) put("tags", org.json.JSONArray(tags))
            if (!festival.isNullOrBlank()) put("festival", festival)
        }
        val json = YugmHttpClient.post("/events", token, body)
        return parseEvent(json.getJSONObject("data").getJSONObject("event"))
    }

    suspend fun join(token: String, eventId: String): YugmEvent {
        val json = YugmHttpClient.post("/events/$eventId/join", token, JSONObject())
        return parseEvent(json.getJSONObject("data").getJSONObject("event"))
    }

    suspend fun leave(token: String, eventId: String): YugmEvent {
        val json = YugmHttpClient.post("/events/$eventId/leave", token, JSONObject())
        return parseEvent(json.getJSONObject("data").getJSONObject("event"))
    }

    suspend fun cancel(token: String, eventId: String): YugmEvent {
        val json = YugmHttpClient.post("/events/$eventId/cancel", token, JSONObject())
        return parseEvent(json.getJSONObject("data").getJSONObject("event"))
    }

    suspend fun myEvents(token: String): MyEvents {
        val json = YugmHttpClient.get("/events/user/me", token)
        val data = json.getJSONObject("data")
        return MyEvents(
            hosting = parseEvents(data.optJSONArray("hosting")),
            joined = parseEvents(data.optJSONArray("joined"))
        )
    }

    private fun parseEvents(array: org.json.JSONArray?): List<YugmEvent> {
        if (array == null) return emptyList()
        val result = mutableListOf<YugmEvent>()
        for (i in 0 until array.length()) {
            result.add(parseEvent(array.getJSONObject(i)))
        }
        return result
    }

    private fun parseEvent(obj: JSONObject): YugmEvent {
        val hostObj = obj.optJSONObject("hostId")
        val participantsArray = obj.optJSONArray("participantIds")
        val participants = mutableListOf<String>()
        if (participantsArray != null) {
            for (i in 0 until participantsArray.length()) {
                val p = participantsArray.optJSONObject(i)
                if (p != null) participants.add(p.optString("_id", participantsArray.optString(i, "")))
                else participants.add(participantsArray.optString(i, ""))
            }
        }
        return YugmEvent(
            id = obj.optString("_id", ""),
            title = obj.optString("title", ""),
            description = obj.optString("description", "").ifEmpty { null },
            hostId = hostObj?.optString("_id", "") ?: obj.optString("hostId", ""),
            hostName = hostObj?.optString("name", "") ?: "",
            hostAvatar = hostObj?.optString("avatar", "")?.ifEmpty { null },
            coverImage = obj.optString("coverImage", "").ifEmpty { null },
            category = obj.optString("category", ""),
            type = obj.optString("type", ""),
            eventDate = obj.optString("eventDate", ""),
            eventEndDate = obj.optString("eventEndDate", "").ifEmpty { null },
            timezone = obj.optString("timezone", "").ifEmpty { null },
            roomId = obj.optString("roomId", "").ifEmpty { null },
            maxParticipants = if (obj.has("maxParticipants") && !obj.isNull("maxParticipants")) obj.optInt("maxParticipants") else null,
            participantIds = participants,
            tags = obj.optJSONArray("tags")?.let { arr ->
                (0 until arr.length()).map { arr.optString(it, "") }
            } ?: emptyList(),
            status = obj.optString("status", "UPCOMING"),
            festival = obj.optString("festival", "none"),
            featured = obj.optBoolean("featured", false),
            createdAt = obj.optString("createdAt", "")
        )
    }
}
