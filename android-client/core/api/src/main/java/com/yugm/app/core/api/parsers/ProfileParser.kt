package com.yugm.app.core.api.parsers

import com.yugm.app.core.model.Achievement
import com.yugm.app.core.model.AchievementTier
import com.yugm.app.core.model.ActiveCosmetics
import com.yugm.app.core.model.CosmeticCatalog
import com.yugm.app.core.model.CreatorDashboard
import com.yugm.app.core.model.CreatorDashboardSummary
import com.yugm.app.core.model.CreatorEarningBalance
import com.yugm.app.core.model.CreatorPayoutKycStatus
import com.yugm.app.core.model.LevelStatus
import com.yugm.app.core.model.ProfileCheck
import com.yugm.app.core.model.ProfileCompletion
import com.yugm.app.core.model.ProfileCosmetic
import com.yugm.app.core.model.RelationshipStatus
import com.yugm.app.core.model.TrustVerificationStatus
import com.yugm.app.core.model.VipStatus
import com.yugm.app.core.model.VipPrivacySettings
import com.yugm.app.core.model.YugmUser
import com.yugm.app.core.model.InventoryCosmetic
import com.yugm.app.core.model.InventoryBadge
import com.yugm.app.core.model.InventorySummary
import com.yugm.app.core.model.UserFullInventory
import com.yugm.app.core.model.InventoryItem
import com.yugm.app.core.model.GiftV2
import com.yugm.app.core.model.LevelMilestoneInfo
import com.yugm.app.core.model.XpEventInfo
import com.yugm.app.core.model.StreakMilestoneInfo
import com.yugm.app.core.model.LevelOverview
import com.yugm.app.core.model.ProgressionTrackStatus
import com.yugm.app.core.model.Host
import org.json.JSONArray
import org.json.JSONObject

fun JSONObject.toUser(): YugmUser = YugmUser(
    id = optString("_id", optString("id", "")),
    name = optString("name", ""),
    username = optString("username", ""),
    profileCompleted = optBoolean("profileCompleted", false),
    emailVerified = optBoolean("emailVerified", false),
    walletBalance = optInt("walletBalance", 0),
    isVip = optBoolean("isVip", false),
    vipTier = optString("vipTier", ""),
    level = optJSONObject("levelStatus")?.optInt("level", optInt("level", 1)) ?: optInt("level", 1),
    levelTitle = optJSONObject("levelStatus")?.optString("title", optString("levelTitle", "New Vibe")) ?: optString("levelTitle", "New Vibe"),
    xp = optJSONObject("levelStatus")?.optInt("xp", optInt("xp", 0)) ?: optInt("xp", 0),
    levelStatus = optJSONObject("levelStatus")?.toLevelStatus() ?: LevelStatus(level = optInt("level", 1), title = optString("levelTitle", "New Vibe"), xp = optInt("xp", 0)),
    activeCosmetics = optJSONObject("activeCosmetics")?.toActiveCosmetics() ?: ActiveCosmetics()
)

fun JSONObject.toLevelStatus(): LevelStatus = LevelStatus(
    level = optInt("level", 1),
    title = optString("title", optString("levelTitle", "New Vibe")),
    xp = optInt("xp", 0),
    progress = optDouble("progress", 0.0).toFloat().coerceIn(0f, 1f),
    progressXp = optInt("progressXp", 0),
    requiredXp = optInt("requiredXp", 0),
    nextLevel = if (has("nextLevel") && !isNull("nextLevel")) optInt("nextLevel") else null,
    canDailyCheckIn = optBoolean("canDailyCheckIn", false),
    dailyCheckInXp = optInt("dailyCheckInXp", 25),
    currentLevelXp = optInt("currentLevelXp", 0),
    nextLevelXp = if (has("nextLevelXp") && !isNull("nextLevelXp")) optInt("nextLevelXp") else null
)

fun JSONObject.toVipStatus(): VipStatus = VipStatus(
    isVip = optBoolean("isVip", false),
    vipTier = optString("vipTier", ""),
    vipLevel = optInt("vipLevel", 0),
    vipExp = optInt("vipExp", 0),
    vipExpRequired = optInt("vipExpRequired", 1000),
    nextVipExpRequired = if (has("nextVipExpRequired") && !isNull("nextVipExpRequired")) optInt("nextVipExpRequired", 1000) else null,
    vipStartedAt = optString("vipStartedAt", ""),
    vipExpiresAt = optString("vipExpiresAt", ""),
    daysRemaining = optInt("daysRemaining", 0),
    frozen = optBoolean("frozen", false),
    freezeDaysRemaining = optInt("freezeDaysRemaining", 0)
)

fun JSONObject.toVipPrivacySettings(): VipPrivacySettings = VipPrivacySettings(
    mysteriousVisitors = optBoolean("mysteriousVisitors", false),
    chatPrivacy = optString("chatPrivacy", "EVERYONE")
)

fun JSONObject.toActiveCosmetics(): ActiveCosmetics = ActiveCosmetics(
    avatarAsset = optString("avatarAsset", ""),
    avatarFrame = optString("avatarFrame", ""),
    speakingWave = optString("speakingWave", ""),
    profileTheme = optString("profileTheme", ""),
    entranceEffect = optString("entranceEffect", ""),
    profileBadge = optString("profileBadge", ""),
    nameStyle = optString("nameStyle", ""),
    roomEntry = optString("roomEntry", ""),
    moodStatus = optString("moodStatus", ""),
    profileMusic = optString("profileMusic", ""),
    voiceBadge = optString("voiceBadge", ""),
    roomTheme = optString("roomTheme", ""),
    avatarDecoration = optString("avatarDecoration", ""),
    reactionPack = optString("reactionPack", ""),
    profileLayout = optString("profileLayout", ""),
    profileBanner = optString("profileBanner", ""),
    introCard = optString("introCard", ""),
    collectibleTitle = optString("collectibleTitle", ""),
    giftShelf = optString("giftShelf", ""),
    chatBubble = optString("chatBubble", ""),
    seasonalEvent = optString("seasonalEvent", ""),
    videoCallOverlay = optString("videoCallOverlay", ""),
    roomBadge = optString("roomBadge", ""),
    roomAmbience = optString("roomAmbience", "")
)

fun JSONObject.toCosmeticCatalog(): CosmeticCatalog {
    val cosmeticArray = optJSONArray("cosmetics") ?: JSONArray()
    val ownedArray = optJSONArray("ownedCosmeticIds") ?: JSONArray()
    return CosmeticCatalog(
        cosmetics = buildList {
            for (index in 0 until cosmeticArray.length()) {
                val item = cosmeticArray.getJSONObject(index)
                add(ProfileCosmetic(
                    id = item.optString("id", ""),
                    type = item.optString("type", ""),
                    name = item.optString("name", "Cosmetic"),
                    coinPrice = item.optInt("coinPrice", 0),
                    rarity = item.optString("rarity", "COMMON"),
                    preview = item.optString("preview", ""),
                    assetUrl = item.optString("assetUrl", "")
                ))
            }
        },
        ownedCosmeticIds = buildList {
            for (index in 0 until ownedArray.length()) add(ownedArray.optString(index))
        },
        activeCosmetics = optJSONObject("activeCosmetics")?.toActiveCosmetics() ?: ActiveCosmetics()
    )
}

fun JSONObject.toRelationshipStatus(): RelationshipStatus = RelationshipStatus(
    level = optInt("level", 1),
    title = optString("title", "First Spark"),
    xp = optInt("xp", 0),
    progress = optDouble("progress", 0.0).toFloat().coerceIn(0f, 1f),
    progressXp = optInt("progressXp", 0),
    requiredXp = optInt("requiredXp", 0),
    nextLevel = if (has("nextLevel") && !isNull("nextLevel")) optInt("nextLevel") else null,
    nextPerk = optString("nextPerk", ""),
    streakDays = optInt("streakDays", 0)
)

fun JSONObject.toProfileCompletion(): ProfileCompletion {
    val checksJson = optJSONArray("checks") ?: JSONArray()
    return ProfileCompletion(
        checks = buildList {
            for (index in 0 until checksJson.length()) {
                val check = checksJson.getJSONObject(index)
                add(ProfileCheck(check.optString("id", ""), check.optString("label", ""), check.optBoolean("done", false)))
            }
        },
        completed = optInt("completed", 0),
        total = optInt("total", 0),
        percent = optInt("percent", 0)
    )
}

fun JSONObject.toAchievement(): Achievement = Achievement(
    id = optString("id", ""),
    title = optString("title", ""),
    description = optString("description", ""),
    target = optInt("target", optInt("total", 0)),
    rewardCoins = optInt("rewardCoins", 0),
    rewardCosmetic = optString("rewardCosmetic", ""),
    progress = optInt("progress", 0),
    complete = optBoolean("complete", false),
    category = optString("category", ""),
    icon = optString("icon", "🏅"),
    currentTier = optString("currentTier").takeIf { it.isNotBlank() && it != "null" },
    highestClaimedTier = optString("highestClaimedTier").takeIf { it.isNotBlank() && it != "null" },
    tiers = optJSONArray("tiers")?.let { tiers -> buildList {
        for (i in 0 until tiers.length()) {
            val tier = tiers.optJSONObject(i) ?: continue
            add(AchievementTier(
                tier = tier.optString("tier", "BRONZE"),
                target = tier.optInt("target", 0),
                rewardCoins = tier.optInt("rewardCoins", 0),
                rewardCosmetic = tier.optString("rewardCosmetic", ""),
                reached = tier.optBoolean("reached", false),
                claimed = tier.optBoolean("claimed", false)
            ))
        }
    } } ?: emptyList(),
    nextTier = optString("nextTier").takeIf { it.isNotBlank() && it != "null" },
    canClaim = optBoolean("canClaim", false),
    canUpgrade = optBoolean("canUpgrade", false),
    badgeKind = optString("kind", "ACHIEVEMENT"),
    imageUrl = optString("imageUrl"),
    earnedBadgeTier = optString("tier").takeIf { it.isNotBlank() && it != "null" },
    badgeUnlocked = optBoolean("unlocked"),
    expiresAt = optString("expiresAt").takeIf { it.isNotBlank() && it != "null" },
    weeklyTarget = optInt("weeklyTarget")
)

fun JSONArray.toAchievements(): List<Achievement> = buildList {
    for (index in 0 until length()) add(getJSONObject(index).toAchievement())
}

fun JSONObject.toTrustVerificationStatus(): TrustVerificationStatus = TrustVerificationStatus(
    status = optString("status", "NOT_STARTED"),
    level = optString("level", "BASIC"),
    faceStatus = optString("faceStatus", "NOT_SUBMITTED"),
    voiceStatus = optString("voiceStatus", "NOT_SUBMITTED"),
    livenessStatus = optString("livenessStatus", "NOT_SUBMITTED"),
    verifiedBadgeEnabled = optBoolean("verifiedBadgeEnabled", false),
    creatorTrustEnabled = optBoolean("creatorTrustEnabled", false),
    rejectionReason = if (has("rejectionReason") && !isNull("rejectionReason")) optString("rejectionReason") else null
)

fun JSONObject.toCreatorPayoutKycStatus(): CreatorPayoutKycStatus = CreatorPayoutKycStatus(
    kycStatus = optString("kycStatus", "NOT_SUBMITTED"),
    payoutStatus = optString("payoutStatus", "DISABLED"),
    legalFullName = if (has("legalFullName") && !isNull("legalFullName")) optString("legalFullName") else null,
    panLast4 = if (has("panLast4") && !isNull("panLast4")) optString("panLast4") else null,
    upiIdMasked = if (has("upiIdMasked") && !isNull("upiIdMasked")) optString("upiIdMasked") else null,
    bankAccountLast4 = if (has("bankAccountLast4") && !isNull("bankAccountLast4")) optString("bankAccountLast4") else null,
    rejectionReason = if (has("rejectionReason") && !isNull("rejectionReason")) optString("rejectionReason") else null
)

fun JSONObject.toCreatorEarningBalance(): CreatorEarningBalance = CreatorEarningBalance(
    earnedCoins = optInt("earnedCoins", 0),
    lockedCoins = optInt("lockedCoins", 0),
    withdrawnCoins = optInt("withdrawnCoins", 0),
    availableCoins = optInt("availableCoins", 0)
)

fun JSONObject.toCreatorDashboard(): CreatorDashboard {
    val summaryJson = optJSONObject("summary") ?: JSONObject()
    val steps = optJSONArray("nextSteps")
    return CreatorDashboard(
        windowDays = optInt("windowDays", 30),
        summary = CreatorDashboardSummary(
            giftCoins = summaryJson.optInt("giftCoins", 0),
            giftCount = summaryJson.optInt("giftCount", 0),
            uniqueSupporters = summaryJson.optInt("uniqueSupporters", 0),
            hostedRooms = summaryJson.optInt("hostedRooms", 0),
            participants = summaryJson.optInt("participants", 0),
            uniqueParticipants = summaryJson.optInt("uniqueParticipants", 0),
            averageParticipants = summaryJson.optDouble("averageParticipants", 0.0),
            estimatedInr = summaryJson.optDouble("estimatedInr", 0.0)
        ),
        rooms = optJSONArray("rooms")?.toRooms() ?: emptyList(),
        scheduledRooms = optJSONArray("scheduledRooms")?.toRooms() ?: emptyList(),
        nextSteps = if (steps == null) emptyList() else List(steps.length()) { steps.optString(it) }
    )
}

fun JSONObject.toUserFullInventory(): UserFullInventory {
    val cosmeticsArr = optJSONArray("cosmetics") ?: JSONArray()
    val giftsArr = optJSONArray("gifts") ?: JSONArray()
    val badgesArr = optJSONArray("badges") ?: JSONArray()
    val summaryJson = optJSONObject("summary") ?: JSONObject()

    return UserFullInventory(
        cosmetics = buildList {
            for (i in 0 until cosmeticsArr.length()) {
                val item = cosmeticsArr.getJSONObject(i)
                add(InventoryCosmetic(
                    id = item.optString("id", ""),
                    type = item.optString("type", ""),
                    name = item.optString("name", ""),
                    coinPrice = item.optInt("coinPrice", 0),
                    rarity = item.optString("rarity", "COMMON"),
                    preview = item.optString("preview", ""),
                    assetUrl = item.optString("assetUrl", ""),
                    isEquipped = item.optBoolean("isEquipped", false)
                ))
            }
        },
        activeCosmetics = optJSONObject("activeCosmetics")?.toActiveCosmetics() ?: ActiveCosmetics(),
        gifts = buildList {
            for (i in 0 until giftsArr.length()) {
                val item = giftsArr.getJSONObject(i)
                add(InventoryItem(
                    id = item.optString("id", ""),
                    gift = GiftV2(
                        id = item.optString("giftId", ""),
                        name = item.optString("name", "Gift"),
                        icon = item.optString("icon", "🎁"),
                        coinPrice = item.optInt("coinPrice", 0),
                        tradable = item.optBoolean("tradable", false),
                        upgradeable = item.optBoolean("upgradeable", false),
                        rarity = item.optString("rarity", "common")
                    ),
                    quantity = item.optInt("quantity", 1),
                    tradable = item.optBoolean("tradable", false),
                    source = item.optString("source", "purchased"),
                    upgradeLevel = item.optInt("upgradeLevel", 1),
                    upgradeCost = item.optInt("upgradeCost", 0)
                ))
            }
        },
        badges = buildList {
            for (i in 0 until badgesArr.length()) {
                val item = badgesArr.getJSONObject(i)
                add(InventoryBadge(
                    achievementId = item.optString("achievementId", ""),
                    tier = item.optString("tier", "BRONZE"),
                    title = item.optString("title", ""),
                    description = item.optString("description", ""),
                    icon = item.optString("icon", "🏅"),
                    claimedAt = item.optString("claimedAt", "")
                ))
            }
        },
        summary = InventorySummary(
            totalCosmetics = summaryJson.optInt("totalCosmetics", 0),
            equippedCosmetics = summaryJson.optInt("equippedCosmetics", 0),
            totalGifts = summaryJson.optInt("totalGifts", 0),
            totalBadges = summaryJson.optInt("totalBadges", 0),
            walletBalance = summaryJson.optInt("walletBalance", 0)
        )
    )
}

fun JSONObject.toLevelOverview(): LevelOverview {
    val levelJson = optJSONObject("level") ?: JSONObject()
    val streakJson = optJSONObject("streak") ?: JSONObject()
    val milestonesArr = optJSONArray("milestones") ?: JSONArray()
    val xpEventsJson = optJSONObject("xpEvents") ?: JSONObject()
    val leaderboardArr = optJSONArray("leaderboard") ?: JSONArray()

    return LevelOverview(
        level = levelJson.toLevelStatus(),
        wealthLevel = optJSONObject("wealthLevel")?.toProgressionTrackStatus() ?: ProgressionTrackStatus(),
        charmLevel = optJSONObject("charmLevel")?.toProgressionTrackStatus() ?: ProgressionTrackStatus(),
        streak = streakJson.optInt("count", 0),
        canCheckIn = streakJson.optBoolean("canCheckIn", false),
        nextMilestone = if (streakJson.has("nextMilestone") && !streakJson.isNull("nextMilestone")) streakJson.optInt("nextMilestone") else null,
        nextMilestoneReward = streakJson.optInt("nextMilestoneReward", 0),
        streakMilestones = streakJson.optJSONArray("milestones")?.let { milestones -> buildList {
            for (i in 0 until milestones.length()) {
                val item = milestones.optJSONObject(i) ?: continue
                add(StreakMilestoneInfo(
                    streakDays = item.optInt("streakDays", 0),
                    rewardCoins = item.optInt("rewardCoins", 0),
                    cosmeticId = item.optString("cosmeticId", ""),
                    reached = item.optBoolean("reached", false)
                ))
            }
        } } ?: emptyList(),
        milestones = buildList {
            for (i in 0 until milestonesArr.length()) {
                val item = milestonesArr.getJSONObject(i)
                add(LevelMilestoneInfo(
                    level = item.optInt("level", i + 1),
                    requiredXp = item.optInt("requiredXp", 0),
                    title = item.optString("title", "Level ${i + 1}"),
                    coinReward = item.optInt("coinReward", 0)
                ))
            }
        },
        xpEvents = buildList {
            val keys = xpEventsJson.keys()
            while (keys.hasNext()) {
                val key = keys.next()
                val event = xpEventsJson.optJSONObject(key)
                if (event != null) {
                    add(XpEventInfo(
                        key = key,
                        name = event.optString("name", key),
                        xp = event.optInt("xp", 0),
                        icon = event.optString("icon", "⭐"),
                        category = event.optString("category", ""),
                        cap = if (event.has("cap") && !event.isNull("cap")) event.optInt("cap") else null,
                        earnedToday = event.optInt("earnedToday", 0)
                    ))
                }
            }
        },
        leaderboard = buildList {
            for (i in 0 until leaderboardArr.length()) {
                add(leaderboardArr.getJSONObject(i).toHost())
            }
        },
        leaderboardRank = if (has("leaderboardRank") && !isNull("leaderboardRank")) optInt("leaderboardRank") else null,
        todayXpEarned = optInt("todayXpEarned", 0),
        todayXpCap = optInt("todayXpCap", 0)
    )
}

private fun JSONObject.toProgressionTrackStatus() = ProgressionTrackStatus(
    level = optInt("level", 0),
    exp = optInt("exp", 0),
    currentLevelExp = optInt("currentLevelExp", 0),
    nextLevel = optInt("nextLevel", 1),
    nextLevelExp = optInt("nextLevelExp", 500),
    requiredExp = optInt("requiredExp", 500),
    progress = optDouble("progress", 0.0).toFloat().coerceIn(0f, 1f)
)
