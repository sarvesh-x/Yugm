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
import com.yugm.app.core.api.SocketManager
import com.yugm.app.core.api.SocketEvent
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

@HiltViewModel
class DiscoverViewModel @Inject constructor(
    private val yugmApi: IYugmApi,
    private val socketManager: SocketManager
) : ViewModel() {

    var rooms by mutableStateOf<List<Room>>(emptyList())
        private set

    var recommendedRooms by mutableStateOf<List<Room>>(emptyList())
        private set

    var scheduledRooms by mutableStateOf<List<Room>>(emptyList())
        private set

    var home by mutableStateOf<ExperienceHome?>(null)
        private set

    var totalOnlineCount by mutableStateOf(0)
        private set

    private var currentPresenceToken: String = ""

    init {
        viewModelScope.launch {
            socketManager.events.collect { event ->
                when (event) {
                    is SocketEvent.Connected,
                    is SocketEvent.UserOnline,
                    is SocketEvent.UserOffline -> {
                        if (currentPresenceToken.isNotBlank()) {
                            refreshPresenceCount(currentPresenceToken)
                        }
                    }
                    else -> {}
                }
            }
        }
    }

    fun refreshPresenceCount(token: String) {
        if (token.isNotBlank()) currentPresenceToken = token
        if (token.isBlank()) return
        viewModelScope.launch {
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.presenceCount(token) }
            }.onSuccess { totalOnlineCount = it }
        }
    }

    var discoverState by mutableStateOf<UiState<List<Room>>>(UiState.Idle)
        private set
    private var roomLoadJob: Job? = null

    fun refreshRooms(type: RoomType? = null) {
        roomLoadJob?.cancel()
        roomLoadJob = viewModelScope.launch {
            discoverState = UiState.Loading
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.rooms(type) }
            }.onSuccess {
                rooms = it
                discoverState = UiState.Success(it)
            }.onFailure {
                if (it is CancellationException) throw it
                discoverState = UiState.Error(it.message ?: "Failed to load rooms")
            }
        }
    }

    suspend fun randomLivePublicRoom(): Room? = withContext(Dispatchers.IO) {
        yugmApi.rooms().filter { it.status.equals("LIVE", ignoreCase = true) && !it.vipOnly }.randomOrNull()
    }

    suspend fun searchRandomFriend(token: String): Room? = withContext(Dispatchers.IO) {
        yugmApi.searchRandomFriend(token)
    }

    suspend fun randomFriendMatch(token: String): Room? = withContext(Dispatchers.IO) {
        yugmApi.randomFriendMatch(token)
    }

    suspend fun cancelRandomFriendSearch(token: String) = withContext(Dispatchers.IO) {
        yugmApi.cancelRandomFriendSearch(token)
    }

    private var activeHomeToken: String = ""
    private var homeLoadJob: Job? = null

    fun refreshHome(token: String) {
        if (token.isBlank()) return
        refreshPresenceCount(token)
        if (isLoading && activeHomeToken == token) return
        activeHomeToken = token
        homeLoadJob?.cancel()
        homeLoadJob = viewModelScope.launch {
            isLoading = true
            error = null
            try {
                val payload = withContext(Dispatchers.IO) { yugmApi.experienceHome(token) }
                if (activeHomeToken != token) return@launch
                home = payload
                rooms = payload.liveRooms
                recommendedRooms = payload.followingRooms.ifEmpty { payload.liveRooms }
                scheduledRooms = payload.scheduledRooms
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (primary: Exception) {
                if (activeHomeToken != token) return@launch
                try {
                    val live = withContext(Dispatchers.IO) { yugmApi.trendingRooms() }
                    val scheduled = withContext(Dispatchers.IO) { yugmApi.scheduledRooms() }
                    if (activeHomeToken != token) return@launch
                    home = null
                    rooms = live
                    recommendedRooms = live
                    scheduledRooms = scheduled
                    error = null
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (fallback: Exception) {
                    if (activeHomeToken == token) error = fallback.message ?: primary.message ?: "Failed to load discovery"
                }
            } finally {
                if (activeHomeToken == token) isLoading = false
            }
        }
    }

    var isLoading by mutableStateOf(true)
        private set

    var error by mutableStateOf<String?>(null)
        private set
}
