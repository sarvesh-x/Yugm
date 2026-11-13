package com.yugm.app.feature.discover.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.yugm.app.core.api.IYugmApi
import com.yugm.app.core.model.ExperienceHome
import com.yugm.app.core.model.Room
import com.yugm.app.core.model.RoomType
import com.yugm.app.core.util.UiState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

@HiltViewModel
class DiscoverViewModel @Inject constructor(
    private val yugmApi: IYugmApi
) : ViewModel() {

    var rooms by mutableStateOf<List<Room>>(emptyList())
        private set

    var recommendedRooms by mutableStateOf<List<Room>>(emptyList())
        private set

    var scheduledRooms by mutableStateOf<List<Room>>(emptyList())
        private set

    var home by mutableStateOf<ExperienceHome?>(null)
        private set

    var discoverState by mutableStateOf<UiState<List<Room>>>(UiState.Idle)
        private set

    fun refreshRooms(type: RoomType? = null) {
        viewModelScope.launch {
            discoverState = UiState.Loading
            rooms = emptyList()
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.rooms(type) }
            }.onSuccess {
                rooms = it
                discoverState = UiState.Success(it)
            }.onFailure {
                discoverState = UiState.Error(it.message ?: "Failed to load rooms")
            }
        }
    }

    fun refreshHome(token: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                val payload = withContext(Dispatchers.IO) {
                    if (token.isNotBlank()) yugmApi.experienceHome(token) else null
                }
                home = payload
                if (payload != null) {
                    rooms = payload.liveRooms
                    recommendedRooms = payload.followingRooms.ifEmpty { payload.liveRooms }
                    scheduledRooms = payload.scheduledRooms
                } else {
                    val live = withContext(Dispatchers.IO) { yugmApi.trendingRooms() }
                    rooms = live
                    recommendedRooms = live
                    scheduledRooms = withContext(Dispatchers.IO) { yugmApi.scheduledRooms() }
                }
            }.onFailure { primary ->
                runCatching {
                    val live = withContext(Dispatchers.IO) { yugmApi.trendingRooms() }
                    rooms = live
                    recommendedRooms = live
                    scheduledRooms = withContext(Dispatchers.IO) { yugmApi.scheduledRooms() }
                }.onFailure {
                    error = it.message ?: primary.message ?: "Failed to load discovery"
                }
            }
            isLoading = false
        }
    }

    var isLoading by mutableStateOf(false)
        private set

    var error by mutableStateOf<String?>(null)
        private set
}
