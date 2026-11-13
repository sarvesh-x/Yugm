package com.yugm.app.feature.chat.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.yugm.app.core.api.IYugmApi
import com.yugm.app.core.model.DirectMessage
import com.yugm.app.core.model.Host
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

@HiltViewModel
class ChatListViewModel @Inject constructor(private val yugmApi: IYugmApi) : ViewModel() {

    var matches by mutableStateOf<List<Host>>(emptyList())
        private set
    var recentMessages by mutableStateOf<List<DirectMessage>>(emptyList())
        private set
    var followers by mutableStateOf<List<Host>>(emptyList())
        private set
    var following by mutableStateOf<List<Host>>(emptyList())
        private set
    var recommendedChatUsers by mutableStateOf<List<Host>>(emptyList())
        private set
    var isLoading by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
        private set

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
                    followers = followersRequest.await()
                    following = followingRequest.await()
                    recommendedChatUsers = recommendedRequest.await()
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
