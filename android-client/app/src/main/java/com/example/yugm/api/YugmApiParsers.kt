package com.example.yugm.api

import androidx.compose.ui.graphics.Color
import com.example.yugm.model.Achievement
import com.example.yugm.model.ActiveCosmetics
import com.example.yugm.model.Clan
import com.example.yugm.model.ClanMessage
import com.example.yugm.model.ClanReaction
import com.example.yugm.model.ClanSummary
import com.example.yugm.model.CoinPack
import com.example.yugm.model.CosmeticCatalog
import com.example.yugm.model.CreatorEarningBalance
import com.example.yugm.model.CreatorPayoutKycStatus
import com.example.yugm.model.DailyGameMission
import com.example.yugm.model.DirectMessage
import com.example.yugm.model.ExperienceFeedItem
import com.example.yugm.model.ExperienceHome
import com.example.yugm.model.GameCatalog
import com.example.yugm.model.GameChallenges
import com.example.yugm.model.GameLeaderboard
import com.example.yugm.model.GameLeaderboardEntry
import com.example.yugm.model.GameMissions
import com.example.yugm.model.GameReward
import com.example.yugm.model.Host
import com.example.yugm.model.LevelStatus
import com.example.yugm.model.MiniGame
import com.example.yugm.model.MiniGameBest
import com.example.yugm.model.MiniGameChallenge
import com.example.yugm.model.MiniGameScore
import com.example.yugm.model.NotificationItem
import com.example.yugm.model.PkBattle
import com.example.yugm.model.PkBattleType
import com.example.yugm.model.PkInvite
import com.example.yugm.model.PkLeaderboardEntry
import com.example.yugm.model.PkMediaSession
import com.example.yugm.model.PkMode
import com.example.yugm.model.PkOpponent
import com.example.yugm.model.PkSide
import com.example.yugm.model.PkSideType
import com.example.yugm.model.PkStats
import com.example.yugm.model.PkStatus
import com.example.yugm.model.PollOption
import com.example.yugm.model.ProfileCheck
import com.example.yugm.model.ProfileCompletion
import com.example.yugm.model.ProfileCosmetic
import com.example.yugm.model.RelationshipStatus
import com.example.yugm.model.Room
import com.example.yugm.model.RoomActivityItem
import com.example.yugm.model.RoomDetail
import com.example.yugm.model.RoomMission
import com.example.yugm.model.RoomParticipant
import com.example.yugm.model.RoomPoll
import com.example.yugm.model.RoomType
import com.example.yugm.model.SavedGameScoreResult
import com.example.yugm.model.SpeakerRequest
import com.example.yugm.model.TrustVerificationStatus
import com.example.yugm.model.VipPlan
import com.example.yugm.model.VipStatus
import com.example.yugm.model.WalletOverview
import com.example.yugm.model.WalletTransaction
import com.example.yugm.model.YugmUser
import org.json.JSONArray
import org.json.JSONObject

fun JSONArray.toRooms(): List<Room> = buildList {
    for (index in 0 until length()) {
        add(getJSONObject(index).toRoom())
    }
}

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

fun JSONObject.toHost(): Host = Host(
    id = optString("_id", optString("id", "")),
    name = optString("name", ""),
    username = optString("username", ""),
    city = optString("city", ""),
    vibe = optString("bio", optString("vibeLine", "")),
    followers = optInt("followersCount", 0),
    followingCount = optInt("followingCount", 0),
    bio = optString("bio", ""),
    avatar = if (has("avatar") && !isNull("avatar")) optString("avatar", "") else null,
    isVip = optBoolean("isVip", false),
    vipTier = optString("vipTier", ""),
    level = optJSONObject("levelStatus")?.optInt("level", optInt("level", 1)) ?: optInt("level", 1),
    levelTitle = optJSONObject("levelStatus")?.optString("title", optString("levelTitle", "New Vibe")) ?: optString("levelTitle", "New Vibe"),
    xp = optJSONObject("levelStatus")?.optInt("xp", optInt("xp", 0)) ?: optInt("xp", 0),
    levelStatus = optJSONObject("levelStatus")?.toLevelStatus() ?: LevelStatus(level = optInt("level", 1), title = optString("levelTitle", "New Vibe"), xp = optInt("xp", 0)),
    activeCosmetics = optJSONObject("activeCosmetics")?.toActiveCosmetics() ?: ActiveCosmetics(),
    isFollowing = optBoolean("isFollowing", false),
    age = optInt("age", 0),
    gender = optString("gender", ""),
    vibeScore = optInt("vibeScore", 0),
    interestedIn = optString("interestedIn", ""),
    lookingFor = optString("lookingFor", ""),
    languages = optJSONArray("languages")?.let { arr -> List(arr.length()) { arr.optString(it) } } ?: emptyList(),
    interests = optJSONArray("interests")?.let { arr -> List(arr.length()) { arr.optString(it) } } ?: emptyList(),
    isOnline = optBoolean("isOnline", false)
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

fun JSONObject.entityId(): String = when {
    has("_id") -> optString("_id", "")
    has("id") -> optString("id", "")
    else -> ""
}

fun JSONObject.toDirectMessage(): DirectMessage = DirectMessage(
    id = optString("_id", optString("id", "")),
    senderId = optJSONObject("senderId")?.entityId() ?: optString("senderId", ""),
    receiverId = optJSONObject("receiverId")?.entityId() ?: optString("receiverId", ""),
    message = optString("message", ""),
    createdAt = optString("createdAt", ""),
    read = optBoolean("read", false),
    reactionCount = optJSONArray("reactions")?.length() ?: 0,
    mediaUrl = optString("mediaUrl", ""),
    mediaType = optString("mediaType", "")
)

fun JSONArray.toDirectMessages(): List<DirectMessage> = buildList {
    for (index in 0 until length()) add(getJSONObject(index).toDirectMessage())
}

fun JSONObject.toRoom(): Room {
    val hostJson = optJSONObject("hostId") ?: optJSONObject("host")
    val tagsJson = optJSONArray("tags") ?: JSONArray()
    val type = if (optString("type").equals("VIDEO", ignoreCase = true)) RoomType.Video else RoomType.Voice
    return Room(
        id = optString("_id", optString("id", "")),
        title = optString("title", ""),
        description = optString("description", ""),
        type = type,
        status = optString("status", "LIVE"),
        scheduledFor = optString("scheduledFor", ""),
        host = hostJson?.toHost(),
        category = optString("category", ""),
        language = optString("language", ""),
        tags = buildList {
            for (index in 0 until tagsJson.length()) add(tagsJson.optString(index))
        },
        participants = optInt("participantCount", optInt("participants", 0)),
        maxSpeakers = optInt("maxSpeakers", if (type == RoomType.Video) 4 else 6),
        gradient = roomGradient(optString("_id", optString("title"))),
        theme = optString("theme", ""),
        vipOnly = optBoolean("vipOnly", false),
        badge = optString("badge", ""),
        ambience = optString("ambience", "")
    )
}

fun JSONArray.toHosts(): List<Host> = buildList {
    for (index in 0 until length()) {
        add(getJSONObject(index).toHost())
    }
}

fun JSONArray.toNotificationItems(): List<NotificationItem> = buildList {
    for (index in 0 until length()) {
        val item = getJSONObject(index)
        val metadata = item.optJSONObject("metadata") ?: JSONObject()
        add(NotificationItem(
            id = item.optString("_id", item.optString("id", "")),
            type = metadata.optString("type", item.optString("type", "general")),
            message = item.optString("body", item.optString("message", item.optString("title", ""))),
            actorName = item.optString("title", item.optString("actorName", "")),
            actorId = metadata.optString("userId", item.optString("actorId", "")),
            partnerId = metadata.optString("partnerId", item.optString("partnerId", "")),
            roomId = metadata.optString("roomId", item.optString("roomId", "")),
            read = item.optBoolean("read", false),
            createdAt = item.optString("createdAt", "")
        ))
    }
}

fun JSONObject.toRoomDetail(): RoomDetail = RoomDetail(
    room = getJSONObject("room").toRoom(),
    participants = optJSONArray("participants")?.toRoomParticipants() ?: emptyList(),
    speakerRequests = optJSONArray("speakerRequests")?.toSpeakerRequests() ?: emptyList()
)

fun JSONObject.toRoomParticipant(): RoomParticipant {
    val userJson = optJSONObject("userId") ?: optJSONObject("user") ?: JSONObject()
    return RoomParticipant(
        id = optString("_id", optString("id", "")),
        user = userJson.toHost(),
        role = optString("role", "AUDIENCE"),
        micEnabled = optBoolean("micEnabled", true),
        cameraEnabled = optBoolean("cameraEnabled", false)
    )
}

fun JSONArray.toRoomParticipants(): List<RoomParticipant> = buildList {
    for (index in 0 until length()) add(getJSONObject(index).toRoomParticipant())
}

fun JSONObject.toSpeakerRequest(): SpeakerRequest {
    val userJson = optJSONObject("userId") ?: optJSONObject("user") ?: JSONObject()
    return SpeakerRequest(
        id = optString("_id", optString("id", "")),
        user = userJson.toHost()
    )
}

fun JSONArray.toSpeakerRequests(): List<SpeakerRequest> = buildList {
    for (index in 0 until length()) add(getJSONObject(index).toSpeakerRequest())
}

fun JSONObject.toRoomPoll(): RoomPoll {
    val optionsJson = optJSONArray("options") ?: JSONArray()
    return RoomPoll(
        id = optString("_id", optString("id", "")),
        question = optString("question", ""),
        options = buildList {
            for (index in 0 until optionsJson.length()) {
                val option = optionsJson.getJSONObject(index)
                add(PollOption(text = option.optString("text", ""), votes = option.optInt("votes", 0)))
            }
        },
        isActive = optBoolean("isActive", true)
    )
}

fun JSONArray.toRoomPolls(): List<RoomPoll> = buildList {
    for (index in 0 until length()) add(getJSONObject(index).toRoomPoll())
}

fun JSONObject.toRoomMission(): RoomMission = RoomMission(
    id = optString("id", optString("_id", "")),
    title = optString("title", ""),
    progress = optInt("progress", 0),
    target = optInt("target", 0),
    reward = optInt("reward", 0),
    complete = optBoolean("complete", false)
)

fun JSONArray.toRoomMissions(): List<RoomMission> = buildList {
    for (index in 0 until length()) add(getJSONObject(index).toRoomMission())
}

fun JSONObject.toRoomActivityItem(): RoomActivityItem = RoomActivityItem(
    id = optString("_id", optString("id", "")),
    label = optString("label", ""),
    type = optString("type", ""),
    createdAt = optString("createdAt", "")
)

fun JSONArray.toRoomActivityItems(): List<RoomActivityItem> = buildList {
    for (index in 0 until length()) add(getJSONObject(index).toRoomActivityItem())
}

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

fun JSONObject.toExperienceFeedItem(): ExperienceFeedItem = ExperienceFeedItem(
    type = optString("type", ""),
    title = optString("title", ""),
    room = optJSONObject("room")?.toRoom(),
    user = optJSONObject("user")?.toHost()
)

fun JSONArray.toExperienceFeedItems(): List<ExperienceFeedItem> = buildList {
    for (index in 0 until length()) add(getJSONObject(index).toExperienceFeedItem())
}

fun JSONObject.toExperienceHome(): ExperienceHome {
    val roomsJson = optJSONObject("rooms") ?: JSONObject()
    val peopleJson = optJSONObject("people") ?: JSONObject()
    val notificationsJson = optJSONObject("notifications") ?: JSONObject()
    return ExperienceHome(
        userRole = optJSONObject("user")?.optString("role", "USER") ?: "USER",
        profileCompletion = optJSONObject("profileCompletion")?.toProfileCompletion() ?: ProfileCompletion(),
        level = optJSONObject("level")?.toLevelStatus() ?: LevelStatus(),
        streakCount = optJSONObject("user")?.optInt("streakCount", 0) ?: 0,
        achievements = optJSONArray("achievements")?.toAchievements() ?: emptyList(),
        feed = optJSONArray("feed")?.toExperienceFeedItems() ?: emptyList(),
        liveRooms = roomsJson.optJSONArray("live")?.toRooms() ?: emptyList(),
        scheduledRooms = roomsJson.optJSONArray("scheduled")?.toRooms() ?: emptyList(),
        followingRooms = roomsJson.optJSONArray("following")?.toRooms() ?: emptyList(),
        suggestedHosts = peopleJson.optJSONArray("suggestedHosts")?.toHosts() ?: emptyList(),
        unreadNotifications = notificationsJson.optInt("unreadCount", 0)
    )
}

fun JSONObject.toCreatorDashboard(): com.example.yugm.model.CreatorDashboard {
    val summaryJson = optJSONObject("summary") ?: JSONObject()
    val steps = optJSONArray("nextSteps")
    return com.example.yugm.model.CreatorDashboard(
        windowDays = optInt("windowDays", 30),
        summary = com.example.yugm.model.CreatorDashboardSummary(
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

fun String.toPkStatus(): PkStatus = runCatching { PkStatus.valueOf(uppercase()) }.getOrDefault(PkStatus.INVITED)
fun String.toPkMode(): PkMode = runCatching { PkMode.valueOf(uppercase()) }.getOrDefault(PkMode.GIFT)
fun String.toPkBattleType(): PkBattleType = runCatching { PkBattleType.valueOf(uppercase()) }.getOrDefault(PkBattleType.VOICE)
fun String.toPkSideTypeOrNull(): PkSideType? = runCatching { PkSideType.valueOf(uppercase()) }.getOrNull()

fun JSONObject.toPkSide(): PkSide = PkSide(
    roomId = optString("roomId", ""),
    roomTitle = optString("roomTitle", ""),
    hostId = optString("hostId", ""),
    hostName = optString("hostName", "Host"),
    hostAvatar = if (has("hostAvatar") && !isNull("hostAvatar")) optString("hostAvatar") else null,
    score = optInt("score", 0),
    participantCount = optInt("participantCount", 0),
    activeCosmetics = optJSONObject("activeCosmetics")?.toActiveCosmetics() ?: ActiveCosmetics()
)

fun JSONObject.toPkBattle(): PkBattle = PkBattle(
    id = optString("battleId", optString("id", optString("_id", ""))),
    battleCode = optString("battleCode", ""),
    title = optString("title", ""),
    status = optString("status", "INVITED").toPkStatus(),
    mode = optString("mode", "GIFT").toPkMode(),
    battleType = optString("battleType", "VOICE").toPkBattleType(),
    durationSeconds = optInt("durationSeconds", 180),
    remainingSeconds = optInt("remainingSeconds", optInt("durationSeconds", 180)),
    left = optJSONObject("left")?.toPkSide() ?: PkSide(),
    right = optJSONObject("right")?.toPkSide() ?: PkSide(),
    leader = optString("leader", "").toPkSideTypeOrNull(),
    winnerSide = optString("winnerSide", "").toPkSideTypeOrNull()
)

fun JSONObject.toPkStats(): PkStats = PkStats(
    played = optInt("played", 0),
    wins = optInt("wins", 0),
    losses = optInt("losses", 0),
    draws = optInt("draws", 0),
    totalScore = optInt("totalScore", 0),
    bestBattle = optInt("bestBattle", 0),
    bestStreak = optInt("bestStreak", 0),
    winRate = optInt("winRate", 0)
)

fun JSONObject.toPkMediaSession(): PkMediaSession = PkMediaSession(
    token = optString("token", ""),
    url = optString("url", ""),
    roomId = optString("roomId", ""),
    roomName = optString("roomName", ""),
    title = optString("title", ""),
    role = optString("role", "")
)

fun JSONObject.toPkInvite(): PkInvite = PkInvite(
    id = optString("_id", optString("id", "")),
    battleId = optString("battleId", ""),
    status = optString("status", "PENDING"),
    expiresAt = optString("expiresAt", "")
)

fun JSONObject.toPkOpponent(): PkOpponent = PkOpponent(
    roomId = optString("roomId", ""),
    roomTitle = optString("roomTitle", ""),
    hostId = optString("hostId", ""),
    hostName = optString("hostName", ""),
    hostAvatar = if (has("hostAvatar") && !isNull("hostAvatar")) optString("hostAvatar") else null,
    battleType = optString("battleType", "VOICE").toPkBattleType(),
    category = optString("category", ""),
    language = optString("language", ""),
    participantCount = optInt("participantCount", 0),
    activeCosmetics = optJSONObject("activeCosmetics")?.toActiveCosmetics() ?: ActiveCosmetics()
)

fun JSONArray.toPkOpponents(): List<PkOpponent> = buildList {
    for (index in 0 until length()) add(getJSONObject(index).toPkOpponent())
}

fun JSONArray.toPkBattles(): List<PkBattle> = buildList {
    for (index in 0 until length()) add(getJSONObject(index).toPkBattle())
}

fun JSONObject.toPkLeaderboardEntry(): PkLeaderboardEntry {
    val user = optJSONObject("userId")
    return PkLeaderboardEntry(
        userId = user?.entityId() ?: optString("userId", ""),
        name = user?.optString("name", "") ?: "",
        avatar = if (user != null && user.has("avatar") && !user.isNull("avatar")) user.optString("avatar") else null,
        side = optString("side", "LEFT").toPkSideTypeOrNull() ?: PkSideType.LEFT,
        totalPoints = optInt("totalPoints", 0),
        totalGiftsSent = optInt("totalGiftsSent", 0)
    )
}

fun JSONArray.toPkLeaderboardEntries(): List<PkLeaderboardEntry> = buildList {
    for (index in 0 until length()) add(getJSONObject(index).toPkLeaderboardEntry())
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

fun JSONObject.toGameCatalog(): GameCatalog = GameCatalog(
    games = optJSONArray("games")?.toMiniGames() ?: emptyList(),
    recent = optJSONArray("recent")?.toMiniGameScores() ?: emptyList()
)

fun JSONObject.toMiniGame(): MiniGame = MiniGame(
    id = optString("id", optString("_id", "")),
    title = optString("title", "Mini Game"),
    description = optString("description", ""),
    durationSeconds = optInt("durationSeconds", 0),
    scoring = optString("scoring", "Higher score wins"),
    best = optJSONObject("best")?.toMiniGameBest()
)

fun JSONArray.toMiniGames(): List<MiniGame> = buildList {
    for (index in 0 until length()) add(getJSONObject(index).toMiniGame())
}

fun JSONObject.toMiniGameBest(): MiniGameBest = MiniGameBest(
    score = optInt("score", 0),
    createdAt = optString("createdAt", "")
)

fun JSONObject.toMiniGameScore(): MiniGameScore = MiniGameScore(
    id = optString("_id", optString("id", "")),
    gameId = optString("gameId", ""),
    score = optInt("score", 0),
    durationMs = if (has("durationMs") && !isNull("durationMs")) optInt("durationMs") else null,
    rounds = if (has("rounds") && !isNull("rounds")) optInt("rounds") else null,
    createdAt = optString("createdAt", "")
)

fun JSONArray.toMiniGameScores(): List<MiniGameScore> = buildList {
    for (index in 0 until length()) add(getJSONObject(index).toMiniGameScore())
}

fun JSONObject.toGameMissions(): GameMissions = GameMissions(
    date = optString("date", ""),
    missions = optJSONArray("missions")?.toDailyGameMissions() ?: emptyList()
)

fun JSONObject.toDailyGameMission(): DailyGameMission = DailyGameMission(
    id = optString("id", optString("_id", "")),
    title = optString("title", ""),
    progress = optInt("progress", 0),
    target = optInt("target", 0),
    rewardXp = optInt("rewardXp", optInt("reward", 0)),
    complete = optBoolean("complete", false)
)

fun JSONArray.toDailyGameMissions(): List<DailyGameMission> = buildList {
    for (index in 0 until length()) add(getJSONObject(index).toDailyGameMission())
}

fun JSONObject.toGameLeaderboard(): GameLeaderboard = GameLeaderboard(
    gameId = optString("gameId", ""),
    leaderboard = optJSONArray("leaderboard")?.toGameLeaderboardEntries() ?: emptyList(),
    personalBest = optJSONObject("personalBest")?.toMiniGameScore()
)

fun JSONObject.toGameLeaderboardEntry(): GameLeaderboardEntry {
    val userObject = optJSONObject("user")
    return GameLeaderboardEntry(
        userId = optString("userId", userObject?.entityId() ?: ""),
        score = optInt("score", 0),
        createdAt = optString("createdAt", ""),
        user = userObject?.toHost() ?: Host(id = optString("userId", ""), name = "Player", username = "yugm")
    )
}

fun JSONArray.toGameLeaderboardEntries(): List<GameLeaderboardEntry> = buildList {
    for (index in 0 until length()) add(getJSONObject(index).toGameLeaderboardEntry())
}

fun JSONObject.toGameChallenges(): GameChallenges = GameChallenges(
    incoming = optJSONArray("incoming")?.toMiniGameChallenges() ?: emptyList(),
    outgoing = optJSONArray("outgoing")?.toMiniGameChallenges() ?: emptyList(),
    clan = optJSONArray("clan")?.toMiniGameChallenges() ?: emptyList()
)

fun JSONObject.toMiniGameChallenge(): MiniGameChallenge = MiniGameChallenge(
    id = optString("_id", optString("id", "")),
    gameId = optString("gameId", ""),
    score = optInt("score", 0),
    message = optString("message", ""),
    expiresAt = optString("expiresAt", ""),
    createdAt = optString("createdAt", ""),
    challenger = optJSONObject("challenger")?.toHost() ?: optJSONObject("challengerId")?.toHost(),
    targetUser = optJSONObject("targetUser")?.toHost() ?: optJSONObject("targetUserId")?.toHost(),
    clan = optJSONObject("clan")?.toClanSummary() ?: optJSONObject("clanId")?.toClanSummary()
)

fun JSONArray.toMiniGameChallenges(): List<MiniGameChallenge> = buildList {
    for (index in 0 until length()) add(getJSONObject(index).toMiniGameChallenge())
}

fun JSONObject.toClan(): Clan = Clan(
    id = optString("_id", optString("id", "")),
    name = optString("name", "Family"),
    slug = optString("slug", ""),
    description = optString("description", ""),
    avatar = if (has("avatar") && !isNull("avatar")) optString("avatar") else null,
    familyLabel = optString("familyLabel", "Family"),
    privacy = optString("privacy", "PUBLIC"),
    memberCount = optInt("memberCount", 0),
    ownerId = optString("ownerId", ""),
    members = optJSONArray("members")?.toHosts() ?: emptyList(),
    isMember = optBoolean("isMember", false)
)

fun JSONObject.toClanMessage(): ClanMessage = ClanMessage(
    id = optString("_id", optString("id", "")),
    clanId = optString("clanId", ""),
    senderId = optJSONObject("senderId")?.toHost(),
    message = optString("message", ""),
    reactions = optJSONArray("reactions")?.toClanReactions() ?: emptyList(),
    createdAt = optString("createdAt", "")
)

fun JSONArray.toClanMessages(): List<ClanMessage> = buildList {
    for (index in 0 until length()) {
        add(getJSONObject(index).toClanMessage())
    }
}

fun JSONObject.toClanReaction(): ClanReaction = ClanReaction(
    userId = optString("userId", ""),
    type = optString("type", ""),
    createdAt = optString("createdAt", "")
)

fun JSONArray.toClanReactions(): List<ClanReaction> = buildList {
    for (index in 0 until length()) {
        add(getJSONObject(index).toClanReaction())
    }
}

fun JSONObject.toClanSummary(): ClanSummary = ClanSummary(
    id = optString("_id", optString("id", "")),
    name = optString("name", "Family"),
    slug = optString("slug", ""),
    avatar = if (has("avatar") && !isNull("avatar")) optString("avatar") else null,
    familyLabel = optString("familyLabel", ""),
    memberCount = optInt("memberCount", 0)
)

fun JSONObject.toSavedGameScoreResult(): SavedGameScoreResult = SavedGameScoreResult(
    score = optJSONObject("score")?.toMiniGameScore() ?: MiniGameScore(),
    isPersonalBest = optBoolean("isPersonalBest", false),
    personalBest = optJSONObject("personalBest")?.toMiniGameScore(),
    reward = optJSONObject("reward")?.toGameReward() ?: GameReward()
)

fun JSONObject.toGameReward(): GameReward = GameReward(
    xpAwarded = optInt("xpAwarded", 0),
    levelUpReward = optInt("levelUpReward", 0)
)

fun JSONObject.toBooleanMap(): Map<String, Boolean> = buildMap {
    val iterator = keys()
    while (iterator.hasNext()) {
        val key = iterator.next()
        put(key, optBoolean(key, false))
    }
}

fun roomGradient(seed: String): List<Color> {
    return when ((seed.hashCode() and Int.MAX_VALUE) % 4) {
        0 -> listOf(Color(0xFF25164C), Color(0xFF8A3FFC), Color(0xFFFF3E93))
        1 -> listOf(Color(0xFF12263A), Color(0xFF165DFF), Color(0xFF27D3FF))
        2 -> listOf(Color(0xFF1B1A38), Color(0xFFFF8A22), Color(0xFFF6B44B))
        else -> listOf(Color(0xFF101028), Color(0xFF7C2DFF), Color(0xFFFFB547))
    }
}
