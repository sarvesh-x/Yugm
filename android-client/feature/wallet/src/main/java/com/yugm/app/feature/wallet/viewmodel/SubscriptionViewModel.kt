package com.yugm.app.feature.wallet.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.yugm.app.core.api.IYugmApi
import com.yugm.app.core.model.SubscribersResponse
import com.yugm.app.core.model.Subscription
import com.yugm.app.core.util.UiState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

@HiltViewModel
class SubscriptionViewModel @Inject constructor(
    private val yugmApi: IYugmApi
) : ViewModel() {

    var subscriptionsState by mutableStateOf<UiState<List<Subscription>>>(UiState.Idle)
        private set

    var subscribersState by mutableStateOf<UiState<SubscribersResponse>>(UiState.Idle)
        private set

    var checkResult by mutableStateOf<com.yugm.app.core.model.SubscriptionCheckResponse?>(null)
        private set

    var checkError by mutableStateOf<String?>(null)
        private set

    fun clearCheckError() {
        checkError = null
    }

    fun loadSubscriptions(token: String) {
        viewModelScope.launch {
            subscriptionsState = UiState.Loading
            subscribersState = UiState.Loading
            runCatching {
                val subs = withContext(Dispatchers.IO) { yugmApi.mySubscriptions(token) }
                val subsResp = withContext(Dispatchers.IO) { yugmApi.mySubscribers(token) }
                Pair(subs, subsResp)
            }.onSuccess { (subs, subsResp) ->
                subscriptionsState = UiState.Success(subs)
                subscribersState = UiState.Success(subsResp)
            }.onFailure {
                subscriptionsState = UiState.Error(it.message ?: "Failed to load subscriptions")
                subscribersState = UiState.Error(it.message ?: "Failed to load subscribers")
            }
        }
    }

    fun subscribe(token: String, creatorId: String, plan: String) {
        viewModelScope.launch {
            subscriptionsState = UiState.Loading
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.subscribeCreator(token, creatorId, plan) }
                withContext(Dispatchers.IO) { yugmApi.mySubscriptions(token) }
            }.onSuccess {
                subscriptionsState = UiState.Success(it)
            }.onFailure {
                subscriptionsState = UiState.Error(it.message ?: "Failed to subscribe")
            }
        }
    }

    fun cancelSubscription(token: String, creatorId: String) {
        viewModelScope.launch {
            subscriptionsState = UiState.Loading
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.cancelSubscription(token, creatorId) }
                withContext(Dispatchers.IO) { yugmApi.mySubscriptions(token) }
            }.onSuccess {
                subscriptionsState = UiState.Success(it)
            }.onFailure {
                subscriptionsState = UiState.Error(it.message ?: "Failed to cancel subscription")
            }
        }
    }

    fun checkSubscription(token: String, creatorId: String) {
        viewModelScope.launch {
            checkError = null
            runCatching {
                checkResult = withContext(Dispatchers.IO) { yugmApi.checkSubscription(token, creatorId) }
            }.onFailure {
                checkError = it.message ?: "Failed to check subscription"
            }
        }
    }
}
