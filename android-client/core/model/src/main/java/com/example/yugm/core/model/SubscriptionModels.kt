package com.example.yugm.core.model

data class Subscription(
    val _id: String = "",
    val subscriberId: String = "",
    val creatorId: SubscriptionCreator? = null,
    val plan: String = "",
    val coinAmount: Int = 0,
    val active: Boolean = true,
    val expiresAt: String = "",
    val createdAt: String = ""
)

data class SubscriptionCreator(
    val _id: String = "",
    val name: String = "",
    val username: String = "",
    val avatar: String? = null
)

data class SubscriberInfo(
    val _id: String = "",
    val subscriberId: String = "",
    val subscriber: SubscriptionCreator? = null,
    val plan: String = "",
    val active: Boolean = true,
    val createdAt: String = ""
)

data class SubscriptionCheckResponse(
    val subscribed: Boolean = false,
    val subscription: Subscription? = null
)

data class SubscribersResponse(
    val subscribers: List<SubscriberInfo> = emptyList()
)
