package com.example.yugm.feature.settings.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.yugm.core.api.IYugmApi
import com.example.yugm.core.model.Host
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

@HiltViewModel
class BlockedUsersViewModel @Inject constructor(private val yugmApi: IYugmApi) : ViewModel() {

    var blockedUsers by mutableStateOf<List<Host>>(emptyList())
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
                val result = withContext(Dispatchers.IO) {
                    yugmApi.getBlockedUsers(token)
                }
                blockedUsers = result
            }.onFailure {
                error = it.message ?: "Failed to load blocked users"
            }
            isLoading = false
        }
    }

    fun unblock(token: String, userId: String) {
        viewModelScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    yugmApi.unblockUser(token, userId)
                }
            }
            load(token)
        }
    }
}
