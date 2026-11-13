package com.yugm.app.core.api.parsers

import com.yugm.app.core.model.ActiveCosmetics
import com.yugm.app.core.model.CoinPack
import com.yugm.app.core.model.CosmeticCatalog
import com.yugm.app.core.model.LevelStatus
import com.yugm.app.core.model.VipPlan
import com.yugm.app.core.model.VipStatus
import com.yugm.app.core.model.WalletOverview
import com.yugm.app.core.model.WalletTransaction
import org.json.JSONArray
import org.json.JSONObject

fun JSONObject.toWalletOverview(): WalletOverview {
    val cosmeticsJson = optJSONObject("cosmetics") ?: JSONObject()
    return WalletOverview(
        balance = optInt("balance", 0),
        vip = optJSONObject("vip")?.toVipStatus() ?: VipStatus(),
        level = optJSONObject("level")?.toLevelStatus() ?: LevelStatus(),
        cosmetics = CosmeticCatalog(
            ownedCosmeticIds = buildList {
                val owned = cosmeticsJson.optJSONArray("ownedCosmeticIds") ?: JSONArray()
                for (index in 0 until owned.length()) add(owned.optString(index))
            },
            activeCosmetics = cosmeticsJson.optJSONObject("activeCosmetics")?.toActiveCosmetics() ?: ActiveCosmetics()
        )
    )
}

fun JSONArray.toVipPlans(): List<VipPlan> = buildList {
    for (index in 0 until length()) {
        val item = getJSONObject(index)
        val benefits = item.optJSONArray("benefits") ?: JSONArray()
        add(VipPlan(
            id = item.optString("id", ""),
            name = item.optString("name", "VIP"),
            durationDays = item.optInt("durationDays", 0),
            coinPrice = item.optInt("coinPrice", 0),
            benefits = buildList {
                for (benefitIndex in 0 until benefits.length()) add(benefits.optString(benefitIndex))
            }
        ))
    }
}

fun JSONArray.toCoinPacks(): List<CoinPack> = buildList {
    for (index in 0 until length()) {
        val item = getJSONObject(index)
        add(CoinPack(
            id = item.optString("id", ""),
            coinAmount = item.optInt("coinAmount", 0),
            priceInr = item.optInt("priceInr", 0),
            googleProductId = item.optString("googleProductId", "")
        ))
    }
}

fun JSONArray.toWalletTransactions(): List<WalletTransaction> = buildList {
    for (index in 0 until length()) {
        val item = getJSONObject(index)
        add(WalletTransaction(
            type = item.optString("type", ""),
            amount = item.optInt("amount", 0),
            description = item.optString("label", item.optString("description", item.optString("source", ""))),
            balanceAfter = item.optInt("balanceAfter", 0),
            createdAt = item.optString("createdAt", "")
        ))
    }
}
