package com.example.yugm.model

data class FriendUser(
    val _id: String = "",
    val name: String = "",
    val username: String = "",
    val avatar: String? = null,
    val bio: String? = null,
    val level: Int = 1,
    val levelTitle: String = "",
    val isVerified: Boolean = false
)

data class FriendRequest(
    val _id: String = "",
    val userId: FriendUser? = null,
    val friendId: FriendUser? = null,
    val status: String = "",
    val createdAt: String = ""
)

data class FriendStatusResponse(
    val status: String = "NONE"
)

data class MutualFriendsResponse(
    val mutualCount: Int = 0,
    val mutual: List<FriendUser> = emptyList()
)

data class FriendCountResponse(
    val count: Int = 0
)

data class GiftLeaderboardResponse(
    val topSenders: List<LeaderboardEntry> = emptyList(),
    val topReceivers: List<LeaderboardEntry> = emptyList(),
    val period: String = "all"
)

data class LeaderboardEntry(
    val _id: String = "",
    val totalCoins: Int = 0,
    val giftCount: Int = 0,
    val user: LeaderboardUser? = null
)

data class LeaderboardUser(
    val _id: String = "",
    val name: String? = null,
    val username: String? = null,
    val avatar: String? = null
)

data class ReferralStatsResponse(
    val stats: ReferralStats = ReferralStats(),
    val referrals: List<ReferralDetail> = emptyList()
)

data class ReferralStats(
    val total: Int = 0,
    val completed: Int = 0,
    val rewarded: Int = 0,
    val totalCoins: Int = 0
)

data class ReferralDetail(
    val _id: String = "",
    val referrerId: String = "",
    val referredUserId: ReferralUser? = null,
    val referralCode: String = "",
    val status: String = "PENDING",
    val rewardCoins: Int? = null,
    val createdAt: String? = null
)

data class ReferralUser(
    val name: String? = null,
    val username: String? = null,
    val avatar: String? = null
)

data class WishlistItem(
    val _id: String = "",
    val userId: String = "",
    val giftId: WishlistGift? = null,
    val message: String? = null,
    val isPublic: Boolean = true,
    val createdAt: String? = null
)

data class WishlistGift(
    val name: String = "",
    val icon: String = "",
    val coinPrice: Int = 0
)
