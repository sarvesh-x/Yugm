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
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
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
    var followBusy by mutableStateOf(false)
        private set
    var followError by mutableStateOf<String?>(null)
        private set
    var isLoading by mutableStateOf(false)
        private set

    fun loadProfile(token: String, userId: String) {
        viewModelScope.launch {
            if (profile?.id == userId && !isLoading) return@launch
            isLoading = true
            val results = coroutineScope {
                val user = async(Dispatchers.IO) { runCatching { yugmApi.getUser(userId, token.ifBlank { null }) } }
                val rooms = async(Dispatchers.IO) { runCatching { yugmApi.getUserRooms(userId, token.ifBlank { null }) } }
                val followers = async(Dispatchers.IO) { runCatching { yugmApi.getFollowers(userId, token.ifBlank { null }) } }
                val following = async(Dispatchers.IO) { runCatching { yugmApi.getFollowing(userId, token.ifBlank { null }) } }
                val stats = async(Dispatchers.IO) { runCatching { yugmApi.pkStats(token, userId) } }
                val history = async(Dispatchers.IO) { runCatching { yugmApi.pkHistory(token, userId) } }
                listOf(user.await(), rooms.await(), followers.await(), following.await(), stats.await(), history.await())
            }
            @Suppress("UNCHECKED_CAST")
            (results[0] as Result<Host>).onSuccess { profile = it; isFollowing = it.isFollowing }
            @Suppress("UNCHECKED_CAST")
            (results[1] as Result<List<Room>>).onSuccess { rooms = it }
            @Suppress("UNCHECKED_CAST")
            (results[2] as Result<List<Host>>).onSuccess { followers = it }
            @Suppress("UNCHECKED_CAST")
            (results[3] as Result<List<Host>>).onSuccess { following = it }
            @Suppress("UNCHECKED_CAST")
            (results[4] as Result<PkStats>).onSuccess { pkStats = it }
            @Suppress("UNCHECKED_CAST")
            (results[5] as Result<List<PkBattle>>).onSuccess { pkHistory = it }
            isLoading = false
        }
    }

    fun follow(token: String, userId: String) {
        viewModelScope.launch {
            if (followBusy) return@launch
            followBusy = true
            followError = null
            val result = withContext(Dispatchers.IO) { runCatching { yugmApi.followUser(token, userId) } }
            result.onSuccess {
                isFollowing = true
                profile = profile?.copy(isFollowing = true, followers = profile!!.followers + 1)
            }.onFailure { followError = it.message ?: "Couldn't follow this user" }
            followBusy = false
        }
    }

    fun unfollow(token: String, userId: String) {
        viewModelScope.launch {
            if (followBusy) return@launch
            followBusy = true
            followError = null
            val result = withContext(Dispatchers.IO) { runCatching { yugmApi.unfollowUser(token, userId) } }
            result.onSuccess {
                isFollowing = false
                profile = profile?.copy(isFollowing = false, followers = (profile?.followers ?: 0).coerceAtLeast(1) - 1)
            }.onFailure { followError = it.message ?: "Couldn't unfollow this user" }
            followBusy = false
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
