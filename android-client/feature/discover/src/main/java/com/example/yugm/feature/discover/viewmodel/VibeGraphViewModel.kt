package com.example.yugm.feature.discover.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.yugm.core.api.VibeApi
import com.example.yugm.core.model.VibeDimensionInfo
import com.example.yugm.core.model.VibeMatchUser
import com.example.yugm.core.model.VibeTrendPoint
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed interface VibeGraphUiState {
    object Loading : VibeGraphUiState
    data class Success(
        val dimensions: List<VibeDimensionInfo>,
        val trend: String,
        val history: List<VibeTrendPoint>,
        val topMatches: List<VibeMatchUser>
    ) : VibeGraphUiState
    data class Error(val message: String) : VibeGraphUiState
}

@HiltViewModel
class VibeGraphViewModel @Inject constructor() : ViewModel() {

    private val _uiState = MutableStateFlow<VibeGraphUiState>(VibeGraphUiState.Loading)
    val uiState: StateFlow<VibeGraphUiState> = _uiState.asStateFlow()

    fun loadVibeData(token: String) {
        if (token.isBlank()) {
            _uiState.value = VibeGraphUiState.Error("Please log in to view Vibe Graph")
            return
        }

        viewModelScope.launch {
            _uiState.value = VibeGraphUiState.Loading
            try {
                val dimsRes = runCatching { VibeApi.dimensions(token) }.getOrNull()
                val trendRes = runCatching { VibeApi.trend(token) }.getOrNull()
                val matchesRes = runCatching { VibeApi.matches(token, limit = 10) }.getOrNull()

                val dimensions = dimsRes?.dimensions ?: emptyList()
                val trend = trendRes?.trend ?: "stable"
                val history = trendRes?.history ?: emptyList()
                val topMatches = matchesRes?.matches ?: emptyList()

                _uiState.value = VibeGraphUiState.Success(
                    dimensions = dimensions,
                    trend = trend,
                    history = history,
                    topMatches = topMatches
                )
            } catch (e: Exception) {
                _uiState.value = VibeGraphUiState.Error(e.message ?: "Failed to load Vibe Graph")
            }
        }
    }
}
