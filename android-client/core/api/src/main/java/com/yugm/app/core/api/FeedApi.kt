package com.yugm.app.core.api

import com.yugm.app.core.model.FeedActivity
import com.yugm.app.core.model.FeedItem
import com.yugm.app.core.model.FeedResponse
import com.yugm.app.core.model.FeedRoom
import com.yugm.app.core.model.FeedRoomSummary
import com.yugm.app.core.model.FeedUser
import com.yugm.app.core.model.StoryItem
import org.json.JSONObject

object FeedApi {
    suspend fun get(token: String): FeedResponse {
        val json = YugmHttpClient.get("/feed", token)
        return parseFeedResponse(json.getJSONObject("data"))
    }

    private fun parseFeedResponse(obj: JSONObject): FeedResponse {
        val array = obj.optJSONArray("feed") ?: org.json.JSONArray()
        val feed = mutableListOf<FeedItem>()
        for (i in 0 until array.length()) {
            feed.add(parseFeedItem(array.getJSONObject(i)))
        }
        return FeedResponse(feed = feed)
    }

    private fun parseFeedItem(obj: JSONObject): FeedItem {
        val type = obj.optString("type", "")
        val roomObj = obj.optJSONObject("room")
        val room = if (roomObj != null) parseFeedRoom(roomObj) else null
        val storyObj = obj.optJSONObject("story")
        val story = if (storyObj != null) parseStoryItem(storyObj) else null
        val activityObj = obj.optJSONObject("activity")
        val activity = if (activityObj != null) parseFeedActivity(activityObj) else null
        return FeedItem(
            type = type,
            room = room,
            story = story,
            activity = activity,
            createdAt = obj.optString("createdAt", "")
        )
    }

    private fun parseFeedRoom(obj: JSONObject): FeedRoom {
        val hostObj = obj.optJSONObject("hostId")
        return FeedRoom(
            _id = obj.optString("_id", ""),
            title = obj.optString("title", ""),
            hostId = if (hostObj != null) FeedUser(
                _id = hostObj.optString("_id", ""),
                name = hostObj.optString("name", ""),
                username = hostObj.optString("username", ""),
                avatar = hostObj.optString("avatar", "").ifEmpty { null }
            ) else null,
            participantCount = obj.optInt("participantCount", 0),
            status = obj.optString("status", "")
        )
    }

    private fun parseStoryItem(obj: JSONObject): StoryItem {
        val userObj = obj.optJSONObject("userId")
        return StoryItem(
            _id = obj.optString("_id", ""),
            userId = userObj?.optString("_id", "") ?: obj.optString("userId", ""),
            userName = userObj?.optString("name", "") ?: "",
            userAvatar = userObj?.optString("avatar", "")?.ifEmpty { null },
            mediaUrl = obj.optString("mediaUrl", ""),
            mediaType = obj.optString("mediaType", "IMAGE"),
            caption = obj.optString("caption", "").ifEmpty { null },
            createdAt = obj.optString("createdAt", "")
        )
    }

    private fun parseFeedActivity(obj: JSONObject): FeedActivity {
        val userObj = obj.optJSONObject("userId")
        val roomObj = obj.optJSONObject("roomId")
        return FeedActivity(
            _id = obj.optString("_id", ""),
            userId = if (userObj != null) FeedUser(
                _id = userObj.optString("_id", ""),
                name = userObj.optString("name", ""),
                username = userObj.optString("username", ""),
                avatar = userObj.optString("avatar", "").ifEmpty { null }
            ) else null,
            roomId = if (roomObj != null) FeedRoomSummary(
                _id = roomObj.optString("_id", ""),
                title = roomObj.optString("title", "")
            ) else null,
            type = obj.optString("type", ""),
            createdAt = obj.optString("createdAt", "")
        )
    }
}
