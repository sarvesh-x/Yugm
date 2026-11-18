package com.yugm.app.feature.profile.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.yugm.app.core.api.IYugmApi
import com.yugm.app.core.api.SocketManager
import com.yugm.app.core.api.SocketEvent
import com.yugm.app.core.api.VoiceRoomJoinCoordinator
import com.yugm.app.core.model.Host
import com.yugm.app.core.model.Clan
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
    private val yugmApi: IYugmApi,
    private val socketManager: SocketManager
) : ViewModel() {

    var profile by mutableStateOf<Host?>(null)
        private set
    var rooms by mutableStateOf<List<Room>>(emptyList())
        private set
    var followers by mutableStateOf<List<Host>>(emptyList())
        private set
    var following by mutableStateOf<List<Host>>(emptyList())
        private set
    var visitors by mutableStateOf<List<Host>>(emptyList())
        private set
    var pkStats by mutableStateOf<PkStats?>(null)
        private set
    var pkHistory by mutableStateOf<List<PkBattle>>(emptyList())
        private set
    var ownClan by mutableStateOf<Clan?>(null)
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
    var isJoiningVoiceParty by mutableStateOf(false)
        private set

    init {
        viewModelScope.launch {
            socketManager.events.collect { event ->
                when (event) {
                    is SocketEvent.VoiceRoomPresenceUpdated -> {
                        if (profile?.id == event.userId) {
                            val currentVersion = profile?.voiceRoomPresence?.presenceVersion ?: 0L
                            if (event.presence.presenceVersion >= currentVersion) {
                                profile = profile?.copy(voiceRoomPresence = event.presence)
                            }
                        }
                    }
                    is SocketEvent.VoiceRoomPresenceEnded -> {
                        if (profile?.id == event.userId) {
                            profile = profile?.copy(voiceRoomPresence = null)
                        }
                    }
                    else -> {}
                }
            }
        }
    }

    fun joinVoiceParty(
        context: android.content.Context,
        token: String,
        currentUserId: String,
        onNavigateToRoom: (String) -> Unit,
        onShowToast: (String) -> Unit = {}
    ) {
        val presence = profile?.voiceRoomPresence ?: return
        val targetUserId = profile?.id ?: return
        viewModelScope.launch {
            if (isJoiningVoiceParty) return@launch
            isJoiningVoiceParty = true
            try {
                VoiceRoomJoinCoordinator.joinVoiceParty(
                    context = context,
                    token = token,
                    targetUserId = targetUserId,
                    presence = presence,
                    currentUserId = currentUserId,
                    onNavigateToRoom = onNavigateToRoom,
                    onShowToast = onShowToast
                )
            } finally {
                isJoiningVoiceParty = false
            }
        }
    }

    fun setOwnProfile(
        name: String,
        username: String,
        bio: String,
        vibeLine: String,
        city: String,
        interests: List<String> = profile?.interests ?: emptyList(),
        hobbies: List<String> = profile?.hobbies ?: emptyList(),
        state: String = profile?.state.orEmpty(),
        gender: String = profile?.gender.orEmpty(),
        age: Int = profile?.age ?: 0
    ) {
        profile = profile?.copy(
            name = name,
            username = username,
            bio = bio,
            vibeLine = vibeLine,
            city = city,
            state = state,
            gender = gender,
            age = age,
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
                visitors = emptyList()
                pkStats = null
                pkHistory = emptyList()
                ownClan = null
            }
            isLoading = true
            profileLoadError = null
            val userResult = withContext(Dispatchers.IO) {
                runCatching { yugmApi.getUser(userId, token.ifBlank { null }) }
            }
            userResult.onFailure {
                if (it is kotlinx.coroutines.CancellationException) throw it
                profileLoadError = it.message?.takeIf(String::isNotBlank) ?: "Couldn't load this profile. Check your connection and retry."
                isLoading = false
            }.onSuccess { loadedProfile ->
                profile = loadedProfile
                isFollowing = loadedProfile.isFollowing
                // Reveal the profile as soon as the user document arrives. The
                // optional sections below hydrate independently so one slow
                // followers/pk/ clan call cannot hold the whole screen.
                isLoading = false
                launch {
                    coroutineScope {
                        val roomsRequest = async(Dispatchers.IO) { runCatching { yugmApi.getUserRooms(userId, token.ifBlank { null }) } }
                        val followersRequest = async(Dispatchers.IO) { runCatching { yugmApi.getFollowers(userId, token.ifBlank { null }) } }
                        val followingRequest = async(Dispatchers.IO) { runCatching { yugmApi.getFollowing(userId, token.ifBlank { null }) } }
                        val statsRequest = async(Dispatchers.IO) { runCatching { yugmApi.pkStats(token, userId) } }
                        val historyRequest = async(Dispatchers.IO) { runCatching { yugmApi.pkHistory(token, userId) } }
                        val clanRequest = if (token.isNotBlank()) async(Dispatchers.IO) { runCatching { yugmApi.myClan(token) } } else null
                        roomsRequest.await().onSuccess { if (profile?.id == userId) rooms = it }
                        followersRequest.await().onSuccess { if (profile?.id == userId) followers = it }
                        followingRequest.await().onSuccess { if (profile?.id == userId) following = it }
                        statsRequest.await().onSuccess { if (profile?.id == userId) pkStats = it }
                        historyRequest.await().onSuccess { if (profile?.id == userId) pkHistory = it }
                        if (clanRequest != null) clanRequest.await().onSuccess { if (profile?.id == userId) ownClan = it }
                    }
                }
            }
        }
    }

    fun loadVisitors(token: String, userId: String) {
        if (token.isBlank()) return
        viewModelScope.launch {
            withContext(Dispatchers.IO) { runCatching { yugmApi.getProfileVisitors(userId, token) } }
                .onSuccess { visitors = it }
        }
    }

    fun follow(token: String, userId: String) {
        viewModelScope.launch {
            if (followBusy) return@launch
            followBusy = true
            followError = null
            val result = withContext(Dispatchers.IO) { runCatching { yugmApi.followUser(token, userId) } }
            result.onSuccess {
                val refreshed = withContext(Dispatchers.IO) { runCatching { yugmApi.getUser(userId, token) }.getOrNull() }
                if (refreshed != null) {
                    profile = refreshed
                    isFollowing = refreshed.isFollowing
                } else {
                    isFollowing = true
                    profile = profile?.copy(isFollowing = true, followers = (profile?.followers ?: 0) + 1)
                }
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
                val refreshed = withContext(Dispatchers.IO) { runCatching { yugmApi.getUser(userId, token) }.getOrNull() }
                if (refreshed != null) {
                    profile = refreshed
                    isFollowing = refreshed.isFollowing
                } else {
                    isFollowing = false
                    profile = profile?.copy(isFollowing = false, followers = ((profile?.followers ?: 0) - 1).coerceAtLeast(0))
                }
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
