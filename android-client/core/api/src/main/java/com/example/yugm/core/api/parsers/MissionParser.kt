package com.example.yugm.core.api.parsers

import com.example.yugm.core.model.ActiveMissionsResponse
import com.example.yugm.core.model.BattlePass
import com.example.yugm.core.model.BattlePassLevelUpResult
import com.example.yugm.core.model.BattlePassPurchaseResult
import com.example.yugm.core.model.BattlePassResponse
import com.example.yugm.core.model.BattlePassRewardState
import com.example.yugm.core.model.BattlePassSeason
import com.example.yugm.core.model.Mission
import com.example.yugm.core.model.MissionClaimResult
import com.example.yugm.core.model.MissionProgressResult
import com.example.yugm.core.model.MissionRequirement
import com.example.yugm.core.model.MissionReward
import com.example.yugm.core.model.Season
import com.example.yugm.core.model.SeasonReward
import org.json.JSONArray
import org.json.JSONObject

fun JSONObject.toMission(): Mission {
    val reqObj = optJSONObject("requirements")
    val rewObj = optJSONObject("rewards")
    return Mission(
        id = optString("_id", ""),
        key = optString("key", ""),
        title = optString("title", ""),
        description = optString("description", ""),
        type = optString("type", ""),
        category = optString("category", ""),
        icon = optString("icon", ""),
        requirements = if (reqObj != null) MissionRequirement(
            action = reqObj.optString("action", ""),
            target = reqObj.optInt("target", 1),
            context = if (reqObj.has("context") && !reqObj.isNull("context")) reqObj.optString("context") else null
        ) else MissionRequirement(),
        rewards = if (rewObj != null) MissionReward(
            xp = rewObj.optInt("xp", 0),
            coins = rewObj.optInt("coins", 0)
        ) else MissionReward(),
        progress = optInt("progress", 0),
        completed = optBoolean("completed", false),
        claimed = optBoolean("claimed", false)
    )
}

fun JSONArray.toMissions(): List<Mission> {
    val list = mutableListOf<Mission>()
    for (i in 0 until length()) list.add(getJSONObject(i).toMission())
    return list
}

fun JSONObject.toActiveMissionsResponse(): ActiveMissionsResponse {
    return ActiveMissionsResponse(
        daily = optJSONArray("daily")?.toMissions() ?: emptyList(),
        weekly = optJSONArray("weekly")?.toMissions() ?: emptyList(),
        monthly = optJSONArray("monthly")?.toMissions() ?: emptyList(),
        seasonal = optJSONArray("seasonal")?.toMissions() ?: emptyList()
    )
}

fun JSONObject.toMissionProgressResult(): MissionProgressResult {
    return MissionProgressResult(
        missionId = optString("missionId", ""),
        key = optString("key", ""),
        completed = optBoolean("completed", false),
        progress = optInt("progress", 0),
        target = optInt("target", 0)
    )
}

fun JSONObject.toMissionClaimResult(): MissionClaimResult {
    val rewObj = optJSONObject("rewards")
    return MissionClaimResult(
        missionId = optString("missionId", ""),
        key = optString("key", ""),
        rewards = if (rewObj != null) MissionReward(
            xp = rewObj.optInt("xp", 0),
            coins = rewObj.optInt("coins", 0)
        ) else MissionReward()
    )
}

fun JSONObject.toSeasonReward(): SeasonReward {
    return SeasonReward(
        level = optInt("level", 0),
        type = optString("type", ""),
        itemId = if (has("itemId") && !isNull("itemId")) optString("itemId") else null,
        amount = optInt("amount", 0),
        premium = optBoolean("premium", false),
        description = optString("description", "")
    )
}

fun JSONArray.toSeasonRewards(): List<SeasonReward> {
    val list = mutableListOf<SeasonReward>()
    for (i in 0 until length()) list.add(getJSONObject(i).toSeasonReward())
    return list
}

fun JSONObject.toSeason(): Season {
    val rewardsArr = optJSONArray("rewards")
    return Season(
        id = optString("_id", ""),
        name = optString("name", ""),
        active = optBoolean("active", true),
        startDate = optString("startDate", ""),
        endDate = optString("endDate", ""),
        maxLevel = optInt("maxLevel", 50),
        xpPerLevel = optInt("xpPerLevel", 500),
        premiumPrice = optInt("premiumPrice", 500),
        rewards = if (rewardsArr != null) rewardsArr.toSeasonRewards() else emptyList()
    )
}

fun JSONObject.toBattlePassRewardState(): BattlePassRewardState {
    return BattlePassRewardState(
        level = optInt("level", 0),
        claimed = optBoolean("claimed", false)
    )
}

fun JSONArray.toBattlePassRewardStates(): List<BattlePassRewardState> {
    val list = mutableListOf<BattlePassRewardState>()
    for (i in 0 until length()) list.add(getJSONObject(i).toBattlePassRewardState())
    return list
}

fun JSONObject.toBattlePassSeason(): BattlePassSeason {
    val idObj = optJSONObject("id")
    return BattlePassSeason(
        id = idObj?.optString("_id", "") ?: optString("_id", ""),
        name = idObj?.optString("name", "") ?: optString("name", "")
    )
}

fun JSONObject.toBattlePass(): BattlePass {
    val rewardsArr = optJSONArray("rewards")
    return BattlePass(
        id = optString("_id", ""),
        season = optJSONObject("season")?.toBattlePassSeason() ?: BattlePassSeason(),
        tier = optString("tier", ""),
        level = optInt("level", 1),
        xp = optInt("xp", 0),
        premium = optBoolean("premium", false),
        active = optBoolean("active", true),
        rewards = if (rewardsArr != null) rewardsArr.toBattlePassRewardStates() else emptyList(),
        expiresAt = optString("expiresAt", "")
    )
}

fun JSONObject.toBattlePassResponse(): BattlePassResponse {
    return BattlePassResponse(
        battlePass = optJSONObject("battlePass")?.toBattlePass(),
        season = optJSONObject("season")?.toSeason()
    )
}

fun JSONObject.toBattlePassPurchaseResult(): BattlePassPurchaseResult {
    return BattlePassPurchaseResult(
        battlePass = optJSONObject("battlePass")?.toBattlePass(),
        season = optJSONObject("season")?.toSeason()
    )
}

fun JSONObject.toBattlePassLevelUpResult(): BattlePassLevelUpResult {
    val rewardsArr = optJSONArray("newRewards")
    return BattlePassLevelUpResult(
        battlePass = optJSONObject("battlePass")?.toBattlePass(),
        season = optJSONObject("season")?.toSeason(),
        newRewards = if (rewardsArr != null) rewardsArr.toSeasonRewards() else emptyList()
    )
}
