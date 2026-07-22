package com.example.yugm.feature.social.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.yugm.core.api.IYugmApi
import com.example.yugm.core.model.CreatorDashboard
import com.example.yugm.core.model.DailyCheckInResult
import com.example.yugm.core.model.ExperienceHome
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
    var checkInResult by mutableStateOf<DailyCheckInResult?>(null)
        private set
    var isLoading by mutableStateOf(false)
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
                runCatching { yugmApi.creatorDashboard(token) }
                    .onSuccess { creator = it }
            }
            isLoading = false
        }
    }

    fun checkIn(token: String, onResult: (DailyCheckInResult) -> Unit = {}) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.checkIn(token) }
                    .onSuccess { checkInResult = it; onResult(it); load(token) }
                    .onFailure { error = it.message }
            }
        }
    }

    fun claimAchievement(token: String, achievementId: String, onResult: () -> Unit = {}) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.claimAchievement(token, achievementId) }
                    .onSuccess { onResult(); load(token) }
                    .onFailure { error = it.message }
            }
        }
    }
}
