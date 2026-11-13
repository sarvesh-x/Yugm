package com.yugm.app.core.model

data class Mission(
    val id: String = "",
    val key: String = "",
    val title: String = "",
    val description: String = "",
    val type: String = "",
    val category: String = "",
    val icon: String = "",
    val requirements: MissionRequirement = MissionRequirement(),
    val rewards: MissionReward = MissionReward(),
    val progress: Int = 0,
    val completed: Boolean = false,
    val claimed: Boolean = false
)

data class MissionRequirement(
    val action: String = "",
    val target: Int = 1,
    val context: String? = null
)

data class MissionReward(
    val xp: Int = 0,
    val coins: Int = 0
)

data class ActiveMissionsResponse(
    val daily: List<Mission> = emptyList(),
    val weekly: List<Mission> = emptyList(),
    val monthly: List<Mission> = emptyList(),
    val seasonal: List<Mission> = emptyList()
)

data class MissionProgressResult(
    val missionId: String = "",
    val key: String = "",
    val completed: Boolean = false,
    val progress: Int = 0,
    val target: Int = 0
)

data class MissionClaimResult(
    val missionId: String = "",
    val key: String = "",
    val rewards: MissionReward = MissionReward()
)

data class BattlePass(
    val id: String = "",
    val season: BattlePassSeason = BattlePassSeason(),
    val tier: String = "",
    val level: Int = 1,
    val xp: Int = 0,
    val premium: Boolean = false,
    val active: Boolean = true,
    val rewards: List<BattlePassRewardState> = emptyList(),
    val expiresAt: String = ""
)

data class BattlePassSeason(
    val id: String = "",
    val name: String = ""
)

data class BattlePassRewardState(
    val level: Int = 0,
    val claimed: Boolean = false
)

data class BattlePassResponse(
    val battlePass: BattlePass? = null,
    val season: Season? = null
)

data class Season(
    val id: String = "",
    val name: String = "",
    val active: Boolean = true,
    val startDate: String = "",
    val endDate: String = "",
    val maxLevel: Int = 50,
    val xpPerLevel: Int = 500,
    val premiumPrice: Int = 500,
    val rewards: List<SeasonReward> = emptyList()
)

data class SeasonReward(
    val level: Int = 0,
    val type: String = "",
    val itemId: String? = null,
    val amount: Int = 0,
    val premium: Boolean = false,
    val description: String = ""
)

data class BattlePassPurchaseResult(
    val battlePass: BattlePass? = null,
    val season: Season? = null
)

data class BattlePassLevelUpResult(
    val battlePass: BattlePass? = null,
    val season: Season? = null,
    val newRewards: List<SeasonReward> = emptyList()
)
