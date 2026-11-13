package com.yugm.app.feature.profile.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.yugm.app.core.api.IYugmApi
import com.yugm.app.core.model.Host
import com.yugm.app.core.model.PkBattle
import com.yugm.app.core.model.PkStats
import com.yugm.app.core.model.Room
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.Job
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
    var profileLoadError by mutableStateOf<String?>(null)
        private set

    fun setOwnProfile(
        name: String,
        username: String,
        bio: String,
        vibeLine: String,
        city: String,
        interests: List<String> = profile?.interests ?: emptyList(),
        hobbies: List<String> = profile?.hobbies ?: emptyList()
    ) {
        profile = profile?.copy(
            name = name,
            username = username,
            bio = bio,
            vibeLine = vibeLine,
            city = city,
            interests = interests,
            hobbies = hobbies
        )
    }

    fun setOwnAvatar(url: String) {
        profile = profile?.let { current ->
            current.copy(
                avatar = url,
                activeCosmetics = current.activeCosmetics.copy(avatarAsset = "")
            )
        }
    }

    fun loadProfile(token: String, userId: String, force: Boolean = false): Job {
        return viewModelScope.launch {
            if (!force && profile?.id == userId && !isLoading) return@launch
            if (profile?.id != userId) {
                profile = null
                rooms = emptyList()
                followers = emptyList()
                following = emptyList()
                pkStats = null
                pkHistory = emptyList()
            }
            isLoading = true
            profileLoadError = null
            val userResult = withContext(Dispatchers.IO) {
                runCatching { yugmApi.getUser(userId, token.ifBlank { null }) }
            }
            userResult.onFailure {
                profile = null
                profileLoadError = it.message?.takeIf(String::isNotBlank) ?: "Couldn't load this profile. Check your connection and retry."
                isLoading = false
            }.onSuccess { loadedProfile ->
                profile = loadedProfile
                isFollowing = loadedProfile.isFollowing
                isLoading = false

                // The profile shell is useful as soon as its primary request returns.
                // Load optional sections in parallel without keeping the whole page blocked.
                coroutineScope {
                    val roomsRequest = async(Dispatchers.IO) { runCatching { yugmApi.getUserRooms(userId, token.ifBlank { null }) } }
                    val followersRequest = async(Dispatchers.IO) { runCatching { yugmApi.getFollowers(userId, token.ifBlank { null }) } }
                    val followingRequest = async(Dispatchers.IO) { runCatching { yugmApi.getFollowing(userId, token.ifBlank { null }) } }
                    val statsRequest = async(Dispatchers.IO) { runCatching { yugmApi.pkStats(token, userId) } }
                    val historyRequest = async(Dispatchers.IO) { runCatching { yugmApi.pkHistory(token, userId) } }
                    roomsRequest.await().onSuccess { rooms = it }
                    followersRequest.await().onSuccess { followers = it }
                    followingRequest.await().onSuccess { following = it }
                    statsRequest.await().onSuccess { pkStats = it }
                    historyRequest.await().onSuccess { pkHistory = it }
                }
            }
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
