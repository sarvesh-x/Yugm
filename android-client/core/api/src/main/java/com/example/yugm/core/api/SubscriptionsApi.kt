package com.example.yugm.core.api

import com.example.yugm.core.model.Subscription
import com.example.yugm.core.model.SubscriptionCheckResponse
import com.example.yugm.core.model.SubscriptionCreator
import com.example.yugm.core.model.SubscriberInfo
import com.example.yugm.core.model.SubscribersResponse
import org.json.JSONObject

object SubscriptionsApi {
    suspend fun subscribe(token: String, creatorId: String, plan: String): Subscription {
        val body = JSONObject().apply {
            put("plan", plan)
        }
        val json = YugmHttpClient.post("/subscriptions/$creatorId", token, body)
        return parseSubscription(json.getJSONObject("data").getJSONObject("subscription"))
    }

    suspend fun cancel(token: String, creatorId: String) {
        YugmHttpClient.delete("/subscriptions/$creatorId", token)
    }

    suspend fun list(token: String): List<Subscription> {
        val json = YugmHttpClient.get("/subscriptions", token)
        val data = json.getJSONObject("data")
        val array = data.optJSONArray("subscriptions") ?: org.json.JSONArray()
        val result = mutableListOf<Subscription>()
        for (i in 0 until array.length()) {
            result.add(parseSubscription(array.getJSONObject(i)))
        }
        return result
    }

    suspend fun subscribers(token: String): SubscribersResponse {
        val json = YugmHttpClient.get("/subscriptions/subscribers", token)
        val data = json.getJSONObject("data")
        val array = data.optJSONArray("subscribers") ?: org.json.JSONArray()
        val list = mutableListOf<SubscriberInfo>()
        for (i in 0 until array.length()) {
            list.add(parseSubscriberInfo(array.getJSONObject(i)))
        }
        return SubscribersResponse(subscribers = list)
    }

    suspend fun check(token: String, creatorId: String): SubscriptionCheckResponse {
        val json = YugmHttpClient.get("/subscriptions/check/$creatorId", token)
        val data = json.getJSONObject("data")
        val subscribed = data.optBoolean("subscribed", false)
        val subscription = if (data.has("subscription") && !data.isNull("subscription")) {
            parseSubscription(data.getJSONObject("subscription"))
        } else null
        return SubscriptionCheckResponse(subscribed = subscribed, subscription = subscription)
    }

    private fun parseSubscription(obj: JSONObject): Subscription {
        val creatorObj = obj.optJSONObject("creatorId")
        return Subscription(
            _id = obj.optString("_id", ""),
            subscriberId = obj.optString("subscriberId", ""),
            creatorId = if (creatorObj != null) SubscriptionCreator(
                _id = creatorObj.optString("_id", ""),
                name = creatorObj.optString("name", ""),
                username = creatorObj.optString("username", ""),
                avatar = creatorObj.optString("avatar", "").ifEmpty { null }
            ) else null,
            plan = obj.optString("plan", ""),
            coinAmount = obj.optInt("coinAmount", 0),
            active = obj.optBoolean("active", true),
            expiresAt = obj.optString("expiresAt", ""),
            createdAt = obj.optString("createdAt", "")
        )
    }

    private fun parseSubscriberInfo(obj: JSONObject): SubscriberInfo {
        val subscriberObj = obj.optJSONObject("subscriber")
        return SubscriberInfo(
            _id = obj.optString("_id", ""),
            subscriberId = obj.optString("subscriberId", ""),
            subscriber = if (subscriberObj != null) SubscriptionCreator(
                _id = subscriberObj.optString("_id", ""),
                name = subscriberObj.optString("name", ""),
                username = subscriberObj.optString("username", ""),
                avatar = subscriberObj.optString("avatar", "").ifEmpty { null }
            ) else null,
            plan = obj.optString("plan", ""),
            active = obj.optBoolean("active", true),
            createdAt = obj.optString("createdAt", "")
        )
    }
}
