package com.example.yugm.feature.profile.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.yugm.core.api.IYugmApi
import com.example.yugm.core.model.Host
import com.example.yugm.core.model.PkBattle
import com.example.yugm.core.model.PkStats
import com.example.yugm.core.model.Room
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val yugmApi: IYugmApi
) : ViewModel() {

    var profile by mutableStateOf<Host?>(null)
        private set
    var rooms by mutableStateOf<List<Room>>(emptyList())
        private set
    var followers by mutableStateOf<List<Host>>(emptyList())
        private set
    var following by mutableStateOf<List<Host>>(emptyList())
        private set
    var pkStats by mutableStateOf<PkStats?>(null)
        private set
    var pkHistory by mutableStateOf<List<PkBattle>>(emptyList())
        private set
    var isFollowing by mutableStateOf(false)
        private set
    var isLoading by mutableStateOf(false)
        private set

    fun loadProfile(token: String, userId: String) {
        viewModelScope.launch {
            isLoading = true
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.getUser(userId, token.ifBlank { null }) }
                    .onSuccess { profile = it }
                runCatching { yugmApi.getUserRooms(userId, token.ifBlank { null }) }
                    .onSuccess { rooms = it }
                runCatching { yugmApi.getFollowers(userId, token.ifBlank { null }) }
                    .onSuccess { followers = it }
                runCatching { yugmApi.getFollowing(userId, token.ifBlank { null }) }
                    .onSuccess { following = it }
                runCatching { yugmApi.pkStats(token, userId) }
                    .onSuccess { pkStats = it }
                runCatching { yugmApi.pkHistory(token, userId) }
                    .onSuccess { pkHistory = it }
            }
            isLoading = false
        }
    }

    fun follow(token: String, userId: String) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.followUser(token, userId) }.onSuccess { isFollowing = true }
            }
        }
    }

    fun unfollow(token: String, userId: String) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.unfollowUser(token, userId) }.onSuccess { isFollowing = false }
            }
        }
    }

    fun report(token: String, roomId: String, userId: String, reason: String) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.reportUser(token, roomId, userId, reason) }
            }
        }
    }

    fun block(token: String, userId: String) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.blockUser(userId, token) }
            }
        }
    }

    fun like(token: String, likedId: String, onResult: (Boolean) -> Unit = {}) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.datingLike(token, likedId, "LIKE") }
                    .onSuccess { onResult(it.first) }
            }
        }
    }
}
