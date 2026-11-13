package com.yugm.app.core.api.parsers

import com.yugm.app.core.model.*
import org.json.JSONArray
import org.json.JSONObject

fun JSONObject.toGiftV2(): GiftV2 {
    return GiftV2(
        id = optString("_id", ""),
        name = optString("name", ""),
        icon = optString("icon", ""),
        coinPrice = optInt("coinPrice", 0),
        diamondPrice = optInt("diamondPrice", 0),
        effect3d = optString("effect3d", ""),
        interactive = optBoolean("interactive", false),
        comboMultiplier = optInt("comboMultiplier", 1),
        category = optString("category", "normal"),
        theme = optString("theme", ""),
        rarity = optString("rarity", "common"),
        tradable = optBoolean("tradable", false),
        upgradeable = optBoolean("upgradeable", false),
        achievementGift = optBoolean("achievementGift", false),
        petGift = optBoolean("petGift", false),
        vehicleGift = optBoolean("vehicleGift", false),
        limitedEdition = optJSONObject("limitedEdition")?.toLimitedEdition(),
        collectionId = optString("collectionId", "").ifBlank { null }
    )
}

fun JSONObject.toLimitedEdition(): LimitedEdition {
    return LimitedEdition(
        active = optBoolean("active", false),
        total = optInt("total", 0),
        remaining = optInt("remaining", 0)
    )
}

fun JSONObject.toGiftCollection(): GiftCollection {
    return GiftCollection(
        id = optString("_id", ""),
        name = optString("name", ""),
        description = optString("description", ""),
        icon = optString("icon", ""),
        bonus = optJSONObject("bonus")?.toCollectionBonus() ?: CollectionBonus(),
        gifts = optJSONArray("gifts")?.let { arr ->
            buildList { for (i in 0 until arr.length()) add(arr.getJSONObject(i).toGiftV2()) }
        } ?: emptyList()
    )
}

fun JSONObject.toCollectionBonus(): CollectionBonus {
    return CollectionBonus(
        description = optString("description", ""),
        xpMultiplier = optInt("xpMultiplier", 1),
        coinMultiplier = optInt("coinMultiplier", 1)
    )
}

fun JSONObject.toComboResult(): ComboResult {
    return ComboResult(
        comboCount = optInt("comboCount", 0),
        totalValue = optInt("totalValue", 0),
        perPersonCost = optInt("perPersonCost", 0),
        multiplier = optInt("multiplier", 1),
        transaction = optJSONObject("transaction")?.toGiftTransactionData()
    )
}

fun JSONObject.toGiftTransactionData(): GiftTransactionData {
    return GiftTransactionData(
        id = optString("_id", ""),
        type = optString("type", ""),
        comboCount = optInt("comboCount", 1),
        totalValue = optInt("totalValue", 0),
        effect = optString("effect", "")
    )
}

fun JSONObject.toRoomWideGiftResult(): RoomWideGiftResult {
    return RoomWideGiftResult(
        totalCost = optInt("totalCost", 0),
        receiverCount = optInt("receiverCount", 0),
        transactions = optJSONArray("transactions")?.let { arr ->
            buildList { for (i in 0 until arr.length()) add(arr.getJSONObject(i).toGiftTransactionData()) }
        } ?: emptyList()
    )
}

fun JSONObject.toSurpriseBoxResult(): SurpriseBoxResult {
    return SurpriseBoxResult(
        tier = optString("tier", ""),
        price = optInt("price", 0),
        revealedGift = optJSONObject("revealedGift")?.toGiftV2(),
        source = optString("source", "")
    )
}

fun JSONObject.toUpgradeResult(): UpgradeResult {
    return UpgradeResult(
        upgradeCost = optInt("upgradeCost", 0),
        fromGift = optJSONObject("fromGift")?.toGiftV2(),
        upgradedGift = optJSONObject("upgradedGift")?.toGiftV2()
    )
}

fun JSONObject.toInventoryItem(): InventoryItem {
    val giftObj = optJSONObject("gift")
    return InventoryItem(
        id = optString("id", ""),
        gift = giftObj?.toGiftV2(),
        quantity = optInt("quantity", 1),
        tradable = optBoolean("tradable", false),
        source = optString("source", "purchased")
    )
}

fun JSONObject.toTradeResult(): TradeResult {
    return TradeResult(
        traded = optBoolean("traded", false),
        offeredCount = optInt("offeredCount", 0),
        receivedCount = optInt("receivedCount", 0)
    )
}

fun JSONArray.toGiftV2List(): List<GiftV2> {
    return buildList { for (i in 0 until length()) add(getJSONObject(i).toGiftV2()) }
}
