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
    var isLoading by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
        private set

    fun clearError() {
        error = null
    }

    fun load(token: String, currentUserId: String = "") {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                val resultMatches = withContext(Dispatchers.IO) {
                    yugmApi.datingMatches(token)
                }
                val resultMessages = withContext(Dispatchers.IO) {
                    yugmApi.getRecentMessages(token)
                }
                val socialLists = if (currentUserId.isNotBlank()) withContext(Dispatchers.IO) {
                    kotlinx.coroutines.coroutineScope {
                        val followerRequest = async { runCatching { yugmApi.getFollowers(currentUserId, token) } }
                        val followingRequest = async { runCatching { yugmApi.getFollowing(currentUserId, token) } }
                        followerRequest.await().getOrDefault(emptyList()) to followingRequest.await().getOrDefault(emptyList())
                    }
                } else emptyList<Host>() to emptyList()
                matches = resultMatches
                recentMessages = resultMessages
                followers = socialLists.first
                following = socialLists.second
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
