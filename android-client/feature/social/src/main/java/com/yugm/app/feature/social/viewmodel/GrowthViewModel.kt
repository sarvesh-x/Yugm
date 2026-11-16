package com.yugm.app.feature.social.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.yugm.app.core.api.IYugmApi
import com.yugm.app.core.model.CreatorDashboard
import com.yugm.app.core.model.DailyCheckInResult
import com.yugm.app.core.model.ExperienceHome
import com.yugm.app.core.model.LevelOverview
import com.yugm.app.core.model.ActiveMissionsResponse
import com.yugm.app.core.model.BattlePassResponse
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

@HiltViewModel
class GrowthViewModel @Inject constructor(
    private val yugmApi: IYugmApi
) : ViewModel() {

    var home by mutableStateOf<ExperienceHome?>(null)
        private set
    var creator by mutableStateOf<CreatorDashboard?>(null)
        private set
    var levelOverview by mutableStateOf<LevelOverview?>(null)
        private set
    var checkInResult by mutableStateOf<DailyCheckInResult?>(null)
        private set
    var missions by mutableStateOf<ActiveMissionsResponse?>(null)
        private set
    var battlePass by mutableStateOf<BattlePassResponse?>(null)
        private set
    var missionClaimMessage by mutableStateOf<String?>(null)
        private set
    var missionClaimError by mutableStateOf<String?>(null)
        private set
    var isLoading by mutableStateOf(false)
        private set
    var isCheckingIn by mutableStateOf(false)
        private set
    var checkInError by mutableStateOf<String?>(null)
        private set
    var error by mutableStateOf<String?>(null)
        private set

    fun load(token: String) {
        viewModelScope.launch {
            isLoading = true
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.experienceHome(token) }
                    .onSuccess { home = it; error = null }
                    .onFailure { error = it.message ?: "Failed to load growth" }
                runCatching { yugmApi.levelOverview(token) }
                    .onSuccess { levelOverview = it }
                runCatching { yugmApi.creatorDashboard(token) }
                    .onSuccess { creator = it }
                runCatching { yugmApi.activeMissions(token) }
                    .onSuccess { missions = it }
                runCatching { yugmApi.battlePass(token) }
                    .onSuccess { battlePass = it }
            }
            isLoading = false
        }
    }

    fun claimMission(token: String, missionId: String, onComplete: () -> Unit = {}) {
        viewModelScope.launch {
            runCatching { withContext(Dispatchers.IO) { yugmApi.claimMission(token, missionId) } }
                .onSuccess { result ->
                    missionClaimMessage = "Reward claimed: +${result.rewards.xp} XP · +${result.rewards.coins} coins"
                    missionClaimError = null
                    runCatching { withContext(Dispatchers.IO) { yugmApi.activeMissions(token) } }
                        .onSuccess { missions = it }
                    runCatching { withContext(Dispatchers.IO) { yugmApi.levelOverview(token) } }
                        .onSuccess { levelOverview = it }
                    runCatching { withContext(Dispatchers.IO) { yugmApi.experienceHome(token) } }
                        .onSuccess { home = it }
                }
                .onFailure { missionClaimError = it.message ?: "Could not claim this reward" }
                .also { onComplete() }
        }
    }

    fun checkIn(token: String, onResult: (DailyCheckInResult) -> Unit = {}) {
        if (isCheckingIn) return
        viewModelScope.launch {
            isCheckingIn = true
            checkInError = null
            try {
                val result = withContext(Dispatchers.IO) { runCatching { yugmApi.checkIn(token) } }
                result.onSuccess {
                    checkInResult = it
                    onResult(it)
                    load(token)
                }
                result.onFailure { checkInError = it.message ?: "Check-in could not be completed" }
            } finally {
                isCheckingIn = false
            }
        }
    }

    fun claimAchievement(token: String, achievementId: String, onResult: () -> Unit = {}) {
        viewModelScope.launch {
            try {
                val result = withContext(Dispatchers.IO) {
                    runCatching { yugmApi.claimAchievement(token, achievementId) }
                }
                result.onSuccess { load(token) }
                    .onFailure { error = it.message ?: "Could not claim this achievement" }
            } finally {
                onResult()
            }
        }
    }
}
