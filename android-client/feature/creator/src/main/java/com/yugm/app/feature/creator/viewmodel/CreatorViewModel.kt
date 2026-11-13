package com.yugm.app.feature.creator.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.yugm.app.core.api.CreatorApi
import com.yugm.app.core.model.CreatorDashboard
import com.yugm.app.core.model.ExperienceHome
import com.yugm.app.core.model.WithdrawalEligibility
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed interface CreatorUiState {
    object Loading : CreatorUiState
    data class Success(
        val dashboard: CreatorDashboard?,
        val experience: ExperienceHome?,
        val withdrawal: WithdrawalEligibility?
    ) : CreatorUiState
    data class Error(val message: String) : CreatorUiState
}

@HiltViewModel
class CreatorViewModel @Inject constructor() : ViewModel() {

    private val _uiState = MutableStateFlow<CreatorUiState>(CreatorUiState.Loading)
    val uiState: StateFlow<CreatorUiState> = _uiState.asStateFlow()

    fun loadData(token: String) {
        if (token.isBlank()) {
            _uiState.value = CreatorUiState.Error("Please log in to view Creator Dashboard")
            return
        }

        viewModelScope.launch {
            _uiState.value = CreatorUiState.Loading
            try {
                val dashboard = runCatching { CreatorApi.creatorDashboard(token) }.getOrNull()
                val experience = runCatching { CreatorApi.experienceHome(token) }.getOrNull()
                val withdrawal = runCatching { CreatorApi.withdrawalEligibility(token) }.getOrNull()

                _uiState.value = CreatorUiState.Success(
                    dashboard = dashboard,
                    experience = experience,
                    withdrawal = withdrawal
                )
            } catch (e: Exception) {
                _uiState.value = CreatorUiState.Error(e.message ?: "Failed to load creator data")
            }
        }
    }
}
