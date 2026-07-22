package com.example.yugm.core.api.parsers

import com.example.yugm.core.model.Achievement
import com.example.yugm.core.model.ActiveCosmetics
import com.example.yugm.core.model.CosmeticCatalog
import com.example.yugm.core.model.CreatorDashboard
import com.example.yugm.core.model.CreatorDashboardSummary
import com.example.yugm.core.model.CreatorEarningBalance
import com.example.yugm.core.model.CreatorPayoutKycStatus
import com.example.yugm.core.model.LevelStatus
import com.example.yugm.core.model.ProfileCheck
import com.example.yugm.core.model.ProfileCompletion
import com.example.yugm.core.model.ProfileCosmetic
import com.example.yugm.core.model.RelationshipStatus
import com.example.yugm.core.model.TrustVerificationStatus
import com.example.yugm.core.model.VipStatus
import com.example.yugm.core.model.YugmUser
import org.json.JSONArray
import org.json.JSONObject

fun JSONObject.toUser(): YugmUser = YugmUser(
    id = optString("_id", optString("id", "")),
    name = optString("name", ""),
    username = optString("username", ""),
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
    dailyCheckInXp = optInt("dailyCheckInXp", 25)
)

fun JSONObject.toVipStatus(): VipStatus = VipStatus(
    isVip = optBoolean("isVip", false),
    vipTier = optString("vipTier", ""),
    vipStartedAt = optString("vipStartedAt", ""),
    vipExpiresAt = optString("vipExpiresAt", "")
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
                    rarity = item.optString("rarity", "COMMON")
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
    target = optInt("target", 0),
    rewardCoins = optInt("rewardCoins", 0),
    rewardCosmetic = optString("rewardCosmetic", ""),
    progress = optInt("progress", 0),
    complete = optBoolean("complete", false)
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
