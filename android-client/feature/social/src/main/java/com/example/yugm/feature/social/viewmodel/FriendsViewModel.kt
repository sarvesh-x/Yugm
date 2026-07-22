package com.example.yugm.feature.social.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.yugm.core.api.IYugmApi
import com.example.yugm.core.model.FriendRequest
import com.example.yugm.core.model.FriendUser
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

@HiltViewModel
class FriendsViewModel @Inject constructor(private val yugmApi: IYugmApi) : ViewModel() {

    var friends by mutableStateOf<List<FriendUser>>(emptyList())
        private set
    var requests by mutableStateOf<List<FriendRequest>>(emptyList())
        private set
    var sent by mutableStateOf<List<FriendRequest>>(emptyList())
        private set
    var isLoading by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
        private set

    fun clearError() {
        error = null
    }

    fun load(token: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                val resultFriends = withContext(Dispatchers.IO) {
                    yugmApi.friendList(token)
                }
                val resultRequests = withContext(Dispatchers.IO) {
                    yugmApi.friendRequests(token)
                }
                val resultSent = withContext(Dispatchers.IO) {
                    yugmApi.friendSent(token)
                }
                friends = resultFriends
                requests = resultRequests
                sent = resultSent
            }.onFailure {
                error = it.message ?: "Failed to load friends"
            }
            isLoading = false
        }
    }

    fun accept(token: String, userId: String) {
        viewModelScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    yugmApi.friendAccept(token, userId)
                }
            }
            load(token)
        }
    }

    fun decline(token: String, userId: String) {
        viewModelScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    yugmApi.friendDecline(token, userId)
                }
            }
            load(token)
        }
    }
}
