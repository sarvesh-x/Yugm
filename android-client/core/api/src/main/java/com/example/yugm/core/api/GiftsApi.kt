package com.example.yugm.core.api

import com.example.yugm.core.api.parsers.*
import com.example.yugm.core.model.*
import org.json.JSONArray
import org.json.JSONObject

object GiftsApi {

    suspend fun giftsV2(token: String, category: String? = null, rarity: String? = null, page: Int = 1, limit: Int = 20): Pair<List<GiftV2>, Int> {
        val params = buildString {
            append("?page=$page&limit=$limit")
            if (category != null) append("&category=$category")
            if (rarity != null) append("&rarity=$rarity")
        }
        val data = YugmHttpClient.get("/gifts/v2$params", token).getJSONObject("data")
        val arr = data.getJSONArray("gifts")
        val list = buildList { for (i in 0 until arr.length()) add(arr.getJSONObject(i).toGiftV2()) }
        return Pair(list, data.optInt("total", 0))
    }

    suspend fun collections(token: String): List<GiftCollection> {
        val data = YugmHttpClient.get("/gifts/collections", token).getJSONObject("data")
        val arr = data.getJSONArray("collections")
        return buildList { for (i in 0 until arr.length()) add(arr.getJSONObject(i).toGiftCollection()) }
    }

    suspend fun comboGift(token: String, roomId: String, giftId: String, participants: List<String>): ComboResult {
        val body = JSONObject().put("roomId", roomId).put("giftId", giftId).put("participants", JSONArray(participants))
        val data = YugmHttpClient.post("/gifts/combo", token, body).getJSONObject("data")
        return data.toComboResult()
    }

    suspend fun roomWideGift(token: String, roomId: String, giftId: String, receiverIds: List<String>): RoomWideGiftResult {
        val body = JSONObject().put("roomId", roomId).put("giftId", giftId).put("receiverIds", JSONArray(receiverIds))
        val data = YugmHttpClient.post("/gifts/room-wide", token, body).getJSONObject("data")
        return data.toRoomWideGiftResult()
    }

    suspend fun surpriseBox(token: String, tier: String): SurpriseBoxResult {
        val body = JSONObject().put("tier", tier)
        val data = YugmHttpClient.post("/gifts/surprise-box", token, body).getJSONObject("data")
        return data.toSurpriseBoxResult()
    }

    suspend fun upgradeGift(token: String, inventoryId: String): UpgradeResult {
        val body = JSONObject().put("inventoryId", inventoryId)
        val data = YugmHttpClient.post("/gifts/upgrade", token, body).getJSONObject("data")
        return data.toUpgradeResult()
    }

    suspend fun inventory(token: String): InventoryResponse {
        val data = YugmHttpClient.get("/inventory", token).getJSONObject("data")
        val arr = data.getJSONArray("items")
        val items = buildList { for (i in 0 until arr.length()) add(arr.getJSONObject(i).toInventoryItem()) }
        return InventoryResponse(items = items)
    }

    suspend fun tradeGift(token: String, targetUserId: String, offerItems: List<String>, requestItems: List<String>): TradeResult {
        val body = JSONObject()
            .put("targetUserId", targetUserId)
            .put("offerItems", JSONArray(offerItems))
            .put("requestItems", JSONArray(requestItems))
        val data = YugmHttpClient.post("/inventory/trade", token, body).getJSONObject("data")
        return data.toTradeResult()
    }
}
