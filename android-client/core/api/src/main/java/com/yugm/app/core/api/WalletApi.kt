package com.yugm.app.core.api

import com.yugm.app.core.api.parsers.*
import com.yugm.app.core.model.CoinPack
import com.yugm.app.core.model.Conversation
import com.yugm.app.core.model.CosmeticCatalog
import com.yugm.app.core.model.DailyRewardClaimResult
import com.yugm.app.core.model.DirectMessage
import com.yugm.app.core.model.GiftItem
import com.yugm.app.core.model.LevelStatus
import com.yugm.app.core.model.PurchaseRecord
import com.yugm.app.core.model.RazorpayCheckoutData
import com.yugm.app.core.model.VipPlan
import com.yugm.app.core.model.VipStatus
import com.yugm.app.core.model.WalletOverview
import com.yugm.app.core.model.WalletProgressResult
import com.yugm.app.core.model.WalletTransaction
import org.json.JSONArray
import org.json.JSONObject

object WalletApi {
    suspend fun balance(token: String): Int {
        return YugmHttpClient.get("/wallet", token).getJSONObject("data").optInt("balance", 0)
    }

    suspend fun walletOverview(token: String): WalletOverview {
        return YugmHttpClient.get("/wallet", token).getJSONObject("data").toWalletOverview()
    }

    suspend fun coinPacks(token: String): List<CoinPack> {
        val data = YugmHttpClient.get("/wallet/packs", token).getJSONObject("data").optJSONArray("packs") ?: JSONArray()
        return data.toCoinPacks()
    }

    suspend fun vipPlans(token: String): Pair<List<VipPlan>, VipStatus> {
        val data = YugmHttpClient.get("/wallet/vip/plans", token).getJSONObject("data")
        return Pair(data.optJSONArray("plans")?.toVipPlans() ?: emptyList(), data.optJSONObject("vip")?.toVipStatus() ?: VipStatus())
    }

    suspend fun activateVip(token: String, planId: String): WalletProgressResult {
        val data = YugmHttpClient.post("/wallet/vip/activate", token, JSONObject().put("planId", planId)).getJSONObject("data")
        return WalletProgressResult(
            balance = data.optInt("balance", 0),
            vip = data.optJSONObject("vip")?.toVipStatus() ?: VipStatus(),
            level = data.optJSONObject("level")?.toLevelStatus() ?: LevelStatus()
        )
    }

    suspend fun verifyGooglePlayPurchase(
        token: String,
        packId: String,
        productId: String,
        purchaseToken: String,
        orderId: String? = null
    ): Int {
        val body = JSONObject()
            .put("packId", packId)
            .put("productId", productId)
            .put("purchaseToken", purchaseToken)
        if (orderId != null) body.put("orderId", orderId)
        val data = YugmHttpClient.post("/wallet/purchases/google-play/verify", token, body).getJSONObject("data")
        return data.optInt("balance", 0)
    }

    suspend fun createRazorpayOrder(token: String, packId: String): RazorpayCheckoutData {
        val data = YugmHttpClient.post(
            "/wallet/purchases/razorpay/order",
            token,
            JSONObject().put("packId", packId).put("provider", "RAZORPAY")
        ).getJSONObject("data")
        val purchase = data.optJSONObject("purchase") ?: JSONObject()
        val checkout = data.optJSONObject("checkout") ?: JSONObject()
        return RazorpayCheckoutData(
            purchaseId = purchase.optString("_id", purchase.optString("id")),
            key = checkout.optString("key"),
            amount = checkout.optInt("amount"),
            currency = checkout.optString("currency", "INR"),
            orderId = checkout.optString("orderId"),
            name = checkout.optString("name", "Yugm"),
            description = checkout.optString("description", "Yugm coins")
        )
    }

    suspend fun verifyRazorpayPurchase(
        token: String,
        purchaseId: String,
        orderId: String,
        paymentId: String,
        signature: String
    ): Int {
        val data = YugmHttpClient.post(
            "/wallet/purchases/razorpay/verify",
            token,
            JSONObject()
                .put("purchaseId", purchaseId)
                .put("razorpay_order_id", orderId)
                .put("razorpay_payment_id", paymentId)
                .put("razorpay_signature", signature)
        ).getJSONObject("data")
        return data.optInt("balance", 0)
    }

    suspend fun gifts(token: String): List<GiftItem> {
        val data = YugmHttpClient.get("/gifts", token).getJSONObject("data").getJSONArray("gifts")
        return buildList {
            for (index in 0 until data.length()) {
                val item = data.getJSONObject(index)
                val gid = item.optString("_id", "")
                val gname = item.optString("name", "Gift")
                if (gid.isNotBlank()) add(GiftItem(gid, gname, item.optInt("coinPrice"), item.optInt("diamondPrice")))
            }
        }
    }

    suspend fun cosmetics(token: String): CosmeticCatalog {
        val data = YugmHttpClient.get("/wallet/cosmetics", token).getJSONObject("data")
        return data.toCosmeticCatalog()
    }

    suspend fun purchaseCosmetic(token: String, cosmeticId: String): CosmeticCatalog {
        val data = YugmHttpClient.post("/wallet/cosmetics/purchase", token, JSONObject().put("cosmeticId", cosmeticId)).getJSONObject("data")
        return data.toCosmeticCatalog()
    }

    suspend fun purchaseCosmeticBundle(token: String, bundleId: String): CosmeticCatalog {
        val data = YugmHttpClient.post("/wallet/cosmetics/bundle-purchase", token, JSONObject().put("bundleId", bundleId)).getJSONObject("data")
        return data.toCosmeticCatalog()
    }

    suspend fun equipCosmetic(token: String, cosmeticId: String, type: String): CosmeticCatalog {
        val data = YugmHttpClient.post(
            "/wallet/cosmetics/equip",
            token,
            JSONObject().put("cosmeticId", cosmeticId).put("type", type)
        ).getJSONObject("data")
        return data.toCosmeticCatalog()
    }

    suspend fun sendGift(token: String, roomId: String, gift: GiftItem, receiverId: String, currency: String = "COINS") {
        YugmHttpClient.post("/rooms/$roomId/send-gift", token, JSONObject().put("giftId", gift.id).put("receiverId", receiverId).put("currency", currency))
    }

    suspend fun devRecharge(token: String, amount: Int) {
        YugmHttpClient.post("/wallet/dev-recharge", token, JSONObject().put("amount", amount))
    }

    suspend fun transactions(token: String): List<WalletTransaction> {
        val data = YugmHttpClient.get("/wallet/transactions", token).getJSONObject("data")
        return data.getJSONArray("transactions").toWalletTransactions()
    }

    suspend fun transferCosmetic(token: String, cosmeticId: String, receiverId: String) {
        YugmHttpClient.post("/wallet/cosmetics/transfer", token, JSONObject().put("cosmeticId", cosmeticId).put("receiverId", receiverId))
    }

    suspend fun claimDailyReward(token: String): DailyRewardClaimResult {
        val data = YugmHttpClient.post("/wallet/rewards/daily", token, JSONObject()).getJSONObject("data")
        return data.toDailyRewardClaimResult()
    }

    suspend fun purchaseHistory(token: String): List<PurchaseRecord> {
        val data = YugmHttpClient.get("/wallet/purchases", token).getJSONObject("data")
        return data.optJSONArray("purchases")?.toPurchaseRecords() ?: emptyList()
    }

    suspend fun sendDirectGift(token: String, giftId: String, receiverId: String): Conversation {
        val data = YugmHttpClient.post("/direct-send-gift", token, JSONObject().put("giftId", giftId).put("receiverId", receiverId)).getJSONObject("data")
        val direct = data.optJSONObject("message")?.toDirectMessage()
        return Conversation(
            messages = if (direct != null) listOf(direct) else emptyList(),
            relationship = data.optJSONObject("relationship")?.toRelationshipStatus()
        )
    }
}
