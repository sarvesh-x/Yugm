package com.example.yugm.api

import com.example.yugm.model.StoryGroup
import com.example.yugm.model.StoryItem
import com.example.yugm.model.StoryUser
import com.example.yugm.model.StoryCommentItem
import com.example.yugm.model.StoryHighlight
import org.json.JSONObject

object StoryApi {
    suspend fun feed(token: String): List<StoryGroup> {
        val json = YugmHttpClient.get("/stories/feed", token)
        val data = json.getJSONObject("data")
        val array = data.optJSONArray("feed") ?: org.json.JSONArray()
        val groups = mutableListOf<StoryGroup>()
        for (i in 0 until array.length()) {
            groups.add(parseStoryGroup(array.getJSONObject(i)))
        }
        return groups
    }

    suspend fun userStories(token: String, userId: String): List<StoryItem> {
        val json = YugmHttpClient.get("/stories/user/$userId", token)
        val data = json.getJSONObject("data")
        val array = data.optJSONArray("stories") ?: org.json.JSONArray()
        val stories = mutableListOf<StoryItem>()
        for (i in 0 until array.length()) {
            stories.add(parseStoryItem(array.getJSONObject(i)))
        }
        return stories
    }

    suspend fun create(token: String, mediaUrl: String, mediaType: String, caption: String? = null, backgroundColor: String? = null, textColor: String? = null, font: String? = null, sticker: String? = null, linkUrl: String? = null): StoryItem {
        val body = JSONObject().apply {
            put("mediaUrl", mediaUrl)
            put("mediaType", mediaType)
            if (!caption.isNullOrBlank()) put("caption", caption)
            if (!backgroundColor.isNullOrBlank()) put("backgroundColor", backgroundColor)
            if (!textColor.isNullOrBlank()) put("textColor", textColor)
            if (!font.isNullOrBlank()) put("font", font)
            if (!sticker.isNullOrBlank()) put("sticker", sticker)
            if (!linkUrl.isNullOrBlank()) put("linkUrl", linkUrl)
        }
        val json = YugmHttpClient.post("/stories", token, body)
        return parseStoryItem(json.getJSONObject("data").getJSONObject("story"))
    }

    suspend fun view(token: String, storyId: String) {
        YugmHttpClient.post("/stories/$storyId/view", token, JSONObject())
    }

    suspend fun like(token: String, storyId: String) {
        YugmHttpClient.post("/stories/$storyId/like", token, JSONObject())
    }

    suspend fun hide(token: String, storyId: String) {
        YugmHttpClient.post("/stories/$storyId/hide", token, JSONObject())
    }

    suspend fun delete(token: String, storyId: String) {
        YugmHttpClient.delete("/stories/$storyId", token)
    }

    suspend fun viewers(token: String, storyId: String): List<StoryUser> {
        val json = YugmHttpClient.get("/stories/$storyId/views", token)
        val data = json.getJSONObject("data")
        val array = data.optJSONArray("viewers") ?: org.json.JSONArray()
        val viewers = mutableListOf<StoryUser>()
        for (i in 0 until array.length()) {
            val v = array.getJSONObject(i)
            viewers.add(StoryUser(
                _id = v.optString("_id", ""),
                name = v.optString("name", ""),
                avatar = v.optString("avatar", "").ifEmpty { null }
            ))
        }
        return viewers
    }

    suspend fun comments(token: String, storyId: String, skip: Int = 0, limit: Int = 50): List<StoryCommentItem> {
        val json = YugmHttpClient.get("/stories/$storyId/comments?skip=$skip&limit=$limit", token)
        val data = json.getJSONObject("data")
        val array = data.optJSONArray("comments") ?: org.json.JSONArray()
        val comments = mutableListOf<StoryCommentItem>()
        for (i in 0 until array.length()) {
            comments.add(parseComment(array.getJSONObject(i)))
        }
        return comments
    }

    suspend fun addComment(token: String, storyId: String, text: String): StoryCommentItem {
        val json = YugmHttpClient.post("/stories/$storyId/comments", token, JSONObject().put("text", text))
        return parseComment(json.getJSONObject("data").getJSONObject("comment"))
    }

    suspend fun replyToComment(token: String, storyId: String, commentId: String, text: String): StoryCommentItem {
        val json = YugmHttpClient.post("/stories/$storyId/comments/$commentId/reply", token, JSONObject().put("text", text))
        return parseComment(json.getJSONObject("data").getJSONObject("comment"))
    }

    suspend fun deleteComment(token: String, commentId: String) {
        YugmHttpClient.delete("/comments/$commentId", token)
    }

    private fun parseStoryGroup(obj: JSONObject): StoryGroup {
        val userObj = obj.getJSONObject("user")
        val storiesArray = obj.getJSONArray("stories")
        val stories = mutableListOf<StoryItem>()
        for (i in 0 until storiesArray.length()) {
            stories.add(parseStoryItem(storiesArray.getJSONObject(i)))
        }
        return StoryGroup(
            user = StoryUser(
                _id = userObj.optString("_id", ""),
                name = userObj.optString("name", ""),
                avatar = userObj.optString("avatar", "").ifEmpty { null }
            ),
            stories = stories
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
            backgroundColor = obj.optString("backgroundColor", "").ifEmpty { null },
            textColor = obj.optString("textColor", "").ifEmpty { null },
            viewCount = obj.optInt("viewCount", 0),
            likeCount = obj.optInt("likeCount", 0),
            replyCount = obj.optInt("replyCount", 0),
            isViewed = obj.optBoolean("isViewed", false),
            isLiked = obj.optBoolean("isLiked", false),
            createdAt = obj.optString("createdAt", ""),
            expiresAt = obj.optString("expiresAt", "")
        )
    }

    private fun parseComment(obj: JSONObject): StoryCommentItem {
        val userObj = obj.optJSONObject("userId")
        val parentId = obj.optString("parentId", "").ifEmpty { null }
        val repliesArray = obj.optJSONArray("replies")
        val replies = mutableListOf<StoryCommentItem>()
        if (repliesArray != null) {
            for (i in 0 until repliesArray.length()) {
                replies.add(parseComment(repliesArray.getJSONObject(i)))
            }
        }
        return StoryCommentItem(
            _id = obj.optString("_id", ""),
            storyId = obj.optString("storyId", ""),
            userId = userObj?.optString("_id", "") ?: obj.optString("userId", ""),
            userName = userObj?.optString("name", "") ?: "",
            userAvatar = userObj?.optString("avatar", "")?.ifEmpty { null },
            parentId = if (parentId.isNullOrBlank() || parentId == "null") null else parentId,
            text = obj.optString("text", ""),
            replies = replies,
            createdAt = obj.optString("createdAt", "")
        )
    }
}

object HighlightsApi {
    suspend fun getUserHighlights(token: String, userId: String): List<StoryHighlight> {
        val json = YugmHttpClient.get("/highlights/$userId", token)
        val data = json.getJSONObject("data")
        val array = data.optJSONArray("highlights") ?: org.json.JSONArray()
        val highlights = mutableListOf<StoryHighlight>()
        for (i in 0 until array.length()) {
            val h = array.getJSONObject(i)
            highlights.add(StoryHighlight(
                id = h.optString("_id", ""),
                title = h.optString("title", ""),
                coverMediaUrl = h.optString("coverMediaUrl", "").ifEmpty { null },
                storyIds = h.optJSONArray("storyIds")?.let { arr ->
                    (0 until arr.length()).map { arr.optString(it, "") }
                } ?: emptyList(),
                createdAt = h.optString("createdAt", "")
            ))
        }
        return highlights
    }

    suspend fun create(token: String, title: String, storyIds: List<String>): StoryHighlight {
        val body = JSONObject().put("title", title).put("storyIds", org.json.JSONArray(storyIds))
        val json = YugmHttpClient.post("/highlights", token, body)
        val data = json.getJSONObject("data")
        val h = data.getJSONObject("highlight")
        return StoryHighlight(
            id = h.optString("_id", ""),
            title = h.optString("title", ""),
            coverMediaUrl = h.optString("coverMediaUrl", "").ifEmpty { null },
            storyIds = h.optJSONArray("storyIds")?.let { arr ->
                (0 until arr.length()).map { arr.optString(it, "") }
            } ?: emptyList(),
            createdAt = h.optString("createdAt", "")
        )
    }

    suspend fun delete(token: String, highlightId: String) {
        YugmHttpClient.delete("/highlights/$highlightId", token)
    }
}
