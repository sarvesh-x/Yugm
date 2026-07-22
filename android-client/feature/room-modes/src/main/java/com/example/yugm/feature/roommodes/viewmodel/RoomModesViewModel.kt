package com.example.yugm.feature.roommodes.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.yugm.core.api.IYugmApi
import com.example.yugm.core.model.Room
import com.example.yugm.core.model.RoomModeInfo
import com.example.yugm.core.model.RoomModeState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

@HiltViewModel
class RoomModesViewModel @Inject constructor(
    private val yugmApi: IYugmApi
) : ViewModel() {

    var availableModes by mutableStateOf<List<RoomModeInfo>>(emptyList())
        private set
    var currentModeState by mutableStateOf<RoomModeState?>(null)
        private set
    var currentModeInfo by mutableStateOf<RoomModeInfo?>(null)
        private set
    var room by mutableStateOf<Room?>(null)
        private set
    var isLoading by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
        private set

    fun clearError() { error = null }

    fun loadModes(token: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.roomModes() }
                    .onSuccess { availableModes = it }
                    .onFailure { error = it.message }
            }
            isLoading = false
        }
    }

    fun setMode(token: String, roomId: String, modeKey: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.roomSetMode(token, roomId, modeKey) }
                    .onSuccess { (r, state) ->
                        room = r
                        currentModeState = state
                        currentModeInfo = availableModes.find { it.key == modeKey }
                    }
                    .onFailure { error = it.message }
            }
            isLoading = false
        }
    }

    fun loadModeState(token: String, roomId: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.roomModeState(token, roomId) }
                    .onSuccess { (mode, state) ->
                        currentModeState = state
                        currentModeInfo = availableModes.find { it.key == mode }
                    }
                    .onFailure { error = it.message }
            }
            isLoading = false
        }
    }

    fun performAction(token: String, roomId: String, action: String, data: Map<String, Any>? = null) {
        viewModelScope.launch {
            isLoading = true
            error = null
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.roomModeAction(token, roomId, action, data) }
                    .onSuccess { currentModeState = it }
                    .onFailure { error = it.message }
            }
            isLoading = false
        }
    }

    fun startMode(token: String, roomId: String) = performAction(token, roomId, "start")
    fun nextRound(token: String, roomId: String) = performAction(token, roomId, "next_round")
    fun submitAnswer(token: String, roomId: String, answer: String) = performAction(token, roomId, "submit_answer", mapOf("answer" to answer))
    fun submitDare(token: String, roomId: String, dare: String) = performAction(token, roomId, "submit_dare", mapOf("dare" to dare))
    fun vote(token: String, roomId: String, targetUserId: String, value: Int = 1) = performAction(token, roomId, "vote", mapOf("targetUserId" to targetUserId, "value" to value))
    fun endMode(token: String, roomId: String) = performAction(token, roomId, "end")

    fun joinRandomModeRoom(token: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.roomModeRandom(token) }
                    .onSuccess { (mode, r, _) ->
                        room = r
                        currentModeInfo = availableModes.find { it.key == mode }
                    }
                    .onFailure { error = it.message }
            }
            isLoading = false
        }
    }
}
