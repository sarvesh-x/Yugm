package com.example.yugm.feature.wallet.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.yugm.core.api.IYugmApi
import com.example.yugm.core.model.VipPlan
import com.example.yugm.core.model.VipStatus
import com.example.yugm.core.util.UiState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

@HiltViewModel
class VipViewModel @Inject constructor(
    private val yugmApi: IYugmApi
) : ViewModel() {

    var vipState by mutableStateOf<UiState<Pair<List<VipPlan>, VipStatus?>>>(UiState.Idle)
        private set

    fun loadVip(token: String) {
        viewModelScope.launch {
            vipState = UiState.Loading
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.vipPlans(token) }
            }.onSuccess { pair ->
                vipState = UiState.Success(pair)
            }.onFailure {
                vipState = UiState.Error(it.message ?: "Failed to load VIP plans")
            }
        }
    }

    fun activateVip(token: String, planId: String) {
        viewModelScope.launch {
            vipState = UiState.Loading
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.activateVip(token, planId) }
                withContext(Dispatchers.IO) { yugmApi.vipPlans(token) }
            }.onSuccess { pair ->
                vipState = UiState.Success(pair)
            }.onFailure {
                vipState = UiState.Error(it.message ?: "Failed to activate VIP")
            }
        }
    }
}
