package com.yugm.app.feature.social.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.yugm.app.core.api.IYugmApi
import com.yugm.app.core.model.FeedResponse
import com.yugm.app.core.util.UiState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

@HiltViewModel
class FeedViewModel @Inject constructor(
    private val yugmApi: IYugmApi
) : ViewModel() {

    var feedState by mutableStateOf<UiState<FeedResponse>>(UiState.Idle)
        private set

    fun loadFeed(token: String) {
        viewModelScope.launch {
            feedState = UiState.Loading
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.feed(token) }
            }.onSuccess {
                feedState = UiState.Success(it)
            }.onFailure {
                feedState = UiState.Error(it.message ?: "Failed to load feed", it)
            }
        }
    }
}
