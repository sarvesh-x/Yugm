package com.yugm.app.core.api

import com.yugm.app.core.model.WishlistItem
import com.yugm.app.core.model.WishlistGift
import org.json.JSONObject

object WishlistApi {
    suspend fun myWishlist(token: String): List<WishlistItem> {
        val json = YugmHttpClient.get("/wishlist/me", token)
        val data = json.getJSONObject("data")
        return parseItems(data.optJSONArray("items"))
    }

    suspend fun userWishlist(token: String, userId: String): List<WishlistItem> {
        val json = YugmHttpClient.get("/wishlist/$userId", token)
        val data = json.getJSONObject("data")
        return parseItems(data.optJSONArray("items"))
    }

    suspend fun addItem(token: String, giftId: String, message: String? = null, isPublic: Boolean = true): WishlistItem {
        val body = JSONObject().apply {
            put("giftId", giftId)
            put("isPublic", isPublic)
            if (!message.isNullOrBlank()) put("message", message)
        }
        val json = YugmHttpClient.post("/wishlist", token, body)
        val data = json.getJSONObject("data")
        return parseItem(data.getJSONObject("item"))
    }

    suspend fun deleteItem(token: String, itemId: String) {
        YugmHttpClient.delete("/wishlist/$itemId", token)
    }

    suspend fun sendGiftFromWishlist(token: String, itemId: String) {
        YugmHttpClient.post("/wishlist/$itemId/send", token, JSONObject())
    }

    private fun parseItems(array: org.json.JSONArray?): List<WishlistItem> {
        if (array == null) return emptyList()
        val result = mutableListOf<WishlistItem>()
        for (i in 0 until array.length()) {
            result.add(parseItem(array.getJSONObject(i)))
        }
        return result
    }

    private fun parseItem(obj: JSONObject): WishlistItem {
        val giftObj = obj.optJSONObject("giftId")
        return WishlistItem(
            _id = obj.optString("_id", ""),
            userId = obj.optString("userId", ""),
            giftId = giftObj?.let { WishlistGift(
                name = it.optString("name", ""),
                icon = it.optString("icon", ""),
                coinPrice = it.optInt("coinPrice", 0)
            ) },
            message = obj.optString("message", "").ifEmpty { null },
            isPublic = obj.optBoolean("isPublic", true),
            createdAt = obj.optString("createdAt", "").ifEmpty { null }
        )
    }
}
