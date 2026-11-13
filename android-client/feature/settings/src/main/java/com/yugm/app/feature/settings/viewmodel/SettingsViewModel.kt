package com.yugm.app.feature.settings.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.yugm.app.core.api.IYugmApi
import com.yugm.app.core.model.Host
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val yugmApi: IYugmApi
) : ViewModel() {

    var blockedUsers by mutableStateOf<List<Host>>(emptyList())
        private set

    var isLoading by mutableStateOf(false)
        private set

    fun loadBlocked(token: String) {
        viewModelScope.launch {
            isLoading = true
            blockedUsers = withContext(Dispatchers.IO) { yugmApi.getBlockedUsers(token) }
            isLoading = false
        }
    }

    fun unblock(token: String, userId: String) {
        viewModelScope.launch {
            isLoading = true
            withContext(Dispatchers.IO) { yugmApi.unblockUser(userId, token) }
            blockedUsers = withContext(Dispatchers.IO) { yugmApi.getBlockedUsers(token) }
            isLoading = false
        }
    }
}
