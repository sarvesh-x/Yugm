package com.example.yugm.feature.missions.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.yugm.core.api.IYugmApi
import com.example.yugm.core.model.ActiveMissionsResponse
import com.example.yugm.core.model.BattlePassResponse
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

@HiltViewModel
class MissionsViewModel @Inject constructor(
    private val yugmApi: IYugmApi
) : ViewModel() {

    var missions by mutableStateOf<ActiveMissionsResponse?>(null)
        private set
    var battlePass by mutableStateOf<BattlePassResponse?>(null)
        private set
    var isLoading by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
        private set
    var claimResult by mutableStateOf<String?>(null)
        private set
    var purchaseResult by mutableStateOf<String?>(null)
        private set

    fun clearError() { error = null }

    fun loadMissions(token: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.activeMissions(token) }
                    .onSuccess { missions = it }
                    .onFailure { error = it.message }
            }
            isLoading = false
        }
    }

    fun loadBattlePass(token: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.battlePass(token) }
                    .onSuccess { battlePass = it }
                    .onFailure { error = it.message }
            }
            isLoading = false
        }
    }

    fun claimMission(token: String, missionId: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.claimMission(token, missionId) }
                    .onSuccess {
                        claimResult = "Claimed: ${it.key}"
                        loadMissions(token)
                    }
                    .onFailure { error = it.message }
            }
            isLoading = false
        }
    }

    fun purchaseBattlePass(token: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.purchaseBattlePass(token) }
                    .onSuccess {
                        purchaseResult = "Battle Pass purchased!"
                        loadBattlePass(token)
                    }
                    .onFailure { error = it.message }
            }
            isLoading = false
        }
    }
}
