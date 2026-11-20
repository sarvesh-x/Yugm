package com.yugm.app.core.api.parsers

import com.yugm.app.core.model.PkBattle
import com.yugm.app.core.model.PkBattleType
import com.yugm.app.core.model.PkInvite
import com.yugm.app.core.model.PkLeaderboardEntry
import com.yugm.app.core.model.PkMediaSession
import com.yugm.app.core.model.PkMode
import com.yugm.app.core.model.PkFormat
import com.yugm.app.core.model.PkOpponent
import com.yugm.app.core.model.PkSide
import com.yugm.app.core.model.PkTeamMember
import com.yugm.app.core.model.PkSideType
import com.yugm.app.core.model.PkStats
import com.yugm.app.core.model.PkStatus
import com.yugm.app.core.model.ActiveCosmetics
import org.json.JSONArray
import org.json.JSONObject

fun String.toPkStatus(): PkStatus = runCatching { PkStatus.valueOf(uppercase()) }.getOrDefault(PkStatus.INVITED)
fun String.toPkMode(): PkMode = runCatching { PkMode.valueOf(uppercase()) }.getOrDefault(PkMode.GIFT)
fun String.toPkFormat(): PkFormat = runCatching { PkFormat.valueOf(uppercase()) }.getOrDefault(PkFormat.ROOM)
fun String.toPkBattleType(): PkBattleType = runCatching { PkBattleType.valueOf(uppercase()) }.getOrDefault(PkBattleType.VOICE)
fun String.toPkSideTypeOrNull(): PkSideType? = runCatching { PkSideType.valueOf(uppercase()) }.getOrNull()

fun JSONObject.toPkSide(): PkSide = PkSide(
    roomId = optString("roomId", ""),
    roomTitle = optString("roomTitle", ""),
    hostId = optString("hostId", ""),
    hostName = optString("hostName", "Host"),
    hostAvatar = if (has("hostAvatar") && !isNull("hostAvatar")) optString("hostAvatar").takeIf { it.isNotBlank() } else null,
    hostAvatarType = optString("hostAvatarType", "").takeIf { it.isNotBlank() },
    hostAvatarParts = optJSONObject("hostAvatarParts")?.let { parts ->
        com.yugm.app.core.model.AvatarPartsPayload(
            background = parts.optInt("background", 0),
            clothes = parts.optInt("clothes", 0),
            head = parts.optInt("head", 0),
            mouth = parts.optInt("mouth", 0),
            eyes = parts.optInt("eyes", 0),
            top = parts.optInt("top", 0)
        )
    },
    score = optInt("score", 0),
    participantCount = optInt("participantCount", 0),
    activeCosmetics = optJSONObject("activeCosmetics")?.toActiveCosmetics() ?: ActiveCosmetics(),
    members = optJSONArray("members")?.let { items ->
        buildList {
            for (index in 0 until items.length()) {
                val item = items.optJSONObject(index) ?: continue
                add(
                    PkTeamMember(
                        userId = item.optString("userId", ""),
                        name = item.optString("name", ""),
                        avatar = item.optString("avatar").takeIf { it.isNotBlank() },
                        avatarType = item.optString("avatarType", "").takeIf { it.isNotBlank() },
                        avatarParts = item.optJSONObject("avatarParts")?.let { parts ->
                            com.yugm.app.core.model.AvatarPartsPayload(
                                background = parts.optInt("background", 0),
                                clothes = parts.optInt("clothes", 0),
                                head = parts.optInt("head", 0),
                                mouth = parts.optInt("mouth", 0),
                                eyes = parts.optInt("eyes", 0),
                                top = parts.optInt("top", 0)
                            )
                        },
                        isReady = item.optBoolean("isReady", false),
                        team = item.optString("team", "A")
                    )
                )
            }
        }
    } ?: emptyList()
)

fun JSONObject.toPkBattle(): PkBattle = PkBattle(
    id = optString("battleId", optString("id", optString("_id", ""))),
    battleCode = optString("battleCode", ""),
    title = optString("title", ""),
    status = optString("status", "INVITED").toPkStatus(),
    stateVersion = optInt("stateVersion", 1),
    countdownSecondsRemaining = optInt("countdownSecondsRemaining", 0),
    mode = optString("mode", "GIFT").toPkMode(),
    format = optString("format", "ROOM").toPkFormat(),
    scope = optString("scope", "CROSS_ROOM"),
    teamSize = optInt("teamSize", 1),
    selectedGiftId = optString("selectedGiftId", ""),
    myVote = optString("myVote", "").toPkSideTypeOrNull(),
    myReady = optBoolean("myReady", false),
    battleType = optString("battleType", "VOICE").toPkBattleType(),
    durationSeconds = optInt("durationSeconds", 180),
    remainingSeconds = optInt("remainingSeconds", optInt("durationSeconds", 180)),
    left = optJSONObject("left")?.toPkSide() ?: PkSide(),
    right = optJSONObject("right")?.toPkSide() ?: PkSide(),
    leader = optString("leader", "").toPkSideTypeOrNull(),
    winnerSide = optString("winnerSide", "").toPkSideTypeOrNull(),
    terminationReason = optString("terminationReason", "")
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
    hostAvatar = if (has("hostAvatar") && !isNull("hostAvatar")) optString("hostAvatar").takeIf { it.isNotBlank() } else null,
    hostAvatarType = optString("hostAvatarType", "").takeIf { it.isNotBlank() },
    hostAvatarParts = optJSONObject("hostAvatarParts")?.let { parts ->
        com.yugm.app.core.model.AvatarPartsPayload(
            background = parts.optInt("background", 0),
            clothes = parts.optInt("clothes", 0),
            head = parts.optInt("head", 0),
            mouth = parts.optInt("mouth", 0),
            eyes = parts.optInt("eyes", 0),
            top = parts.optInt("top", 0)
        )
    },
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
        avatar = if (user != null && user.has("avatar") && !user.isNull("avatar")) user.optString("avatar").takeIf { it.isNotBlank() } else null,
        avatarType = user?.optString("avatarType", "")?.takeIf { it.isNotBlank() },
        avatarParts = user?.optJSONObject("avatarParts")?.let { parts ->
            com.yugm.app.core.model.AvatarPartsPayload(
                background = parts.optInt("background", 0),
                clothes = parts.optInt("clothes", 0),
                head = parts.optInt("head", 0),
                mouth = parts.optInt("mouth", 0),
                eyes = parts.optInt("eyes", 0),
                top = parts.optInt("top", 0)
            )
        },
        side = optString("side", "LEFT").toPkSideTypeOrNull() ?: PkSideType.LEFT,
        totalPoints = optInt("totalPoints", 0),
        totalGiftsSent = optInt("totalGiftsSent", 0)
    )
}

fun JSONArray.toPkLeaderboardEntries(): List<PkLeaderboardEntry> = buildList {
    for (index in 0 until length()) add(getJSONObject(index).toPkLeaderboardEntry())
}
