package com.yugm.app.core.api

import com.yugm.app.core.model.FriendUser
import com.yugm.app.core.model.FriendRequest
import com.yugm.app.core.model.FriendStatusResponse
import com.yugm.app.core.model.MutualFriendsResponse
import org.json.JSONObject

object FriendsApi {
    suspend fun request(token: String, userId: String) {
        YugmHttpClient.post("/friends/request/$userId", token, JSONObject())
    }

    suspend fun accept(token: String, userId: String) {
        YugmHttpClient.post("/friends/accept/$userId", token, JSONObject())
    }

    suspend fun decline(token: String, userId: String) {
        YugmHttpClient.post("/friends/decline/$userId", token, JSONObject())
    }

    suspend fun unfriend(token: String, userId: String) {
        YugmHttpClient.post("/friends/unfriend/$userId", token, JSONObject())
    }

    suspend fun list(token: String): List<FriendUser> {
        val json = YugmHttpClient.get("/friends", token)
        val data = json.getJSONObject("data")
        return parseFriendUsers(data.optJSONArray("friends"))
    }

    suspend fun requests(token: String): List<FriendRequest> {
        val json = YugmHttpClient.get("/friends/requests", token)
        val data = json.getJSONObject("data")
        return parseFriendRequests(data.optJSONArray("requests"))
    }

    suspend fun sent(token: String): List<FriendRequest> {
        val json = YugmHttpClient.get("/friends/sent", token)
        val data = json.getJSONObject("data")
        return parseFriendRequests(data.optJSONArray("sent"))
    }

    suspend fun status(token: String, userId: String): FriendStatusResponse {
        val json = YugmHttpClient.get("/friends/status/$userId", token)
        val data = json.getJSONObject("data")
        return FriendStatusResponse(status = data.optString("status", "NONE"))
    }

    suspend fun mutual(token: String, userId: String): MutualFriendsResponse {
        val json = YugmHttpClient.get("/friends/mutual/$userId", token)
        val data = json.getJSONObject("data")
        return MutualFriendsResponse(
            mutualCount = data.optInt("mutualCount", 0),
            mutual = parseFriendUsers(data.optJSONArray("mutual"))
        )
    }

    suspend fun count(token: String, userId: String): Int {
        val json = YugmHttpClient.get("/friends/count/$userId", token)
        val data = json.getJSONObject("data")
        return data.optInt("count", 0)
    }

    private fun parseFriendUsers(array: org.json.JSONArray?): List<FriendUser> {
        if (array == null) return emptyList()
        val result = mutableListOf<FriendUser>()
        for (i in 0 until array.length()) {
            result.add(parseFriendUser(array.getJSONObject(i)))
        }
        return result
    }

    private fun parseFriendUser(obj: JSONObject): FriendUser {
        return FriendUser(
            _id = obj.optString("_id", ""),
            name = obj.optString("name", ""),
            username = obj.optString("username", ""),
            avatar = obj.optString("avatar", "").ifEmpty { null },
            bio = obj.optString("bio", "").ifEmpty { null },
            level = obj.optInt("level", 1),
            levelTitle = obj.optString("levelTitle", ""),
            isVerified = obj.optBoolean("isVerified", false)
        )
    }

    private fun parseFriendRequests(array: org.json.JSONArray?): List<FriendRequest> {
        if (array == null) return emptyList()
        val result = mutableListOf<FriendRequest>()
        for (i in 0 until array.length()) {
            result.add(parseFriendRequest(array.getJSONObject(i)))
        }
        return result
    }

    private fun parseFriendRequest(obj: JSONObject): FriendRequest {
        return FriendRequest(
            _id = obj.optString("_id", ""),
            userId = obj.optJSONObject("userId")?.let { parseFriendUser(it) },
            friendId = obj.optJSONObject("friendId")?.let { parseFriendUser(it) },
            status = obj.optString("status", ""),
            createdAt = obj.optString("createdAt", "")
        )
    }
}
