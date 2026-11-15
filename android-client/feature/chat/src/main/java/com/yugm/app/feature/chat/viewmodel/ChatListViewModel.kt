package com.yugm.app.feature.chat.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.yugm.app.core.api.IYugmApi
import com.yugm.app.core.api.SocketManager
import com.yugm.app.core.api.SocketEvent
import com.yugm.app.core.model.Clan
import com.yugm.app.core.model.ClanMessage
import com.yugm.app.core.model.DirectMessage
import com.yugm.app.core.model.Host
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.withContext
import javax.inject.Inject

@HiltViewModel
class ChatListViewModel @Inject constructor(
    private val yugmApi: IYugmApi,
    private val socketManager: SocketManager
) : ViewModel() {


    var matches by mutableStateOf<List<Host>>(emptyList())
        private set
    var recentMessages by mutableStateOf<List<DirectMessage>>(emptyList())
        private set
    var unreadCounts by mutableStateOf<Map<String, Int>>(emptyMap())
        private set
    var mutedPartnerIds by mutableStateOf<Set<String>>(emptySet())
        private set
    var followers by mutableStateOf<List<Host>>(emptyList())
        private set
    var following by mutableStateOf<List<Host>>(emptyList())
        private set
    var recommendedChatUsers by mutableStateOf<List<Host>>(emptyList())
        private set
    var myClan by mutableStateOf<Clan?>(null)
        private set
    var clanLastMessage by mutableStateOf<ClanMessage?>(null)
        private set
    var isLoading by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
        private set

    init {
        viewModelScope.launch {
            socketManager.events.collectLatest { event ->
                when (event) {
                    is SocketEvent.DirectConversationDeleted -> {
                        val partnerId = event.partnerId
                        recentMessages = recentMessages.filterNot { it.senderId == partnerId || it.receiverId == partnerId }
                        unreadCounts = unreadCounts - partnerId
                        matches = matches.filterNot { it.id == partnerId }
                        followers = followers.filterNot { it.id == partnerId }
                        following = following.filterNot { it.id == partnerId }
                        recommendedChatUsers = recommendedChatUsers.filterNot { it.id == partnerId }
                    }
                    is SocketEvent.UserOnline -> updateHostOnline(event.userId, true)
                    is SocketEvent.UserOffline -> updateHostOnline(event.userId, false)
                    else -> Unit
                }
            }
        }
    }

    private fun updateHostOnline(userId: String, online: Boolean) {
        matches = matches.map { if (it.id == userId) it.copy(isOnline = online) else it }
        followers = followers.map { if (it.id == userId) it.copy(isOnline = online) else it }
        following = following.map { if (it.id == userId) it.copy(isOnline = online) else it }
        recommendedChatUsers = recommendedChatUsers.map { if (it.id == userId) it.copy(isOnline = online) else it }
    }

    fun clearError() {
        error = null
    }

    fun load(token: String, currentUserId: String = "") {
        if (isLoading) return
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                coroutineScope {
                    val matchesRequest = async(Dispatchers.IO) { yugmApi.datingMatches(token) }
                    val messagesRequest = async(Dispatchers.IO) { yugmApi.getRecentMessages(token) }
                    val followersRequest = async(Dispatchers.IO) {
                        if (currentUserId.isBlank()) emptyList() else runCatching {
                            yugmApi.getFollowers(currentUserId, token)
                        }.getOrDefault(emptyList())
                    }
                    val followingRequest = async(Dispatchers.IO) {
                        if (currentUserId.isBlank()) emptyList() else runCatching {
                            yugmApi.getFollowing(currentUserId, token)
                        }.getOrDefault(emptyList())
                    }
                    val recommendedRequest = async(Dispatchers.IO) {
                        runCatching { yugmApi.recommendedChatUsers(token) }.getOrDefault(emptyList())
                    }

                    matches = matchesRequest.await()
                    recentMessages = messagesRequest.await()
                    unreadCounts = async(Dispatchers.IO) { runCatching { yugmApi.unreadCounts(token) }.getOrDefault(emptyMap()) }.await()
                    mutedPartnerIds = async(Dispatchers.IO) { runCatching { yugmApi.mutedConversations(token) }.getOrDefault(emptySet()) }.await()
                    followers = followersRequest.await()
                    following = followingRequest.await()
                    recommendedChatUsers = recommendedRequest.await()
                    val clan = runCatching { yugmApi.myClan(token) }.getOrNull()
                    myClan = clan
                    clanLastMessage = if (clan != null) {
                        runCatching { yugmApi.getClanMessages(token, clan.id).lastOrNull() }.getOrNull()
                    } else {
                        null
                    }
                }
            }.onFailure {
                error = it.message ?: "Failed to load messages"
            }
            isLoading = false
        }
    }

    fun markAllRead(token: String, currentUserId: String = "") {
        viewModelScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    yugmApi.markAllMessagesRead(token)
                }
            }
            load(token, currentUserId)
        }
    }

}
