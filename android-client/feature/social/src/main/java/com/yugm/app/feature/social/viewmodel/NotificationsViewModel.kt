package com.yugm.app.feature.social.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.yugm.app.core.api.IYugmApi
import com.yugm.app.core.model.NotificationItem
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

@HiltViewModel
class NotificationsViewModel @Inject constructor(private val yugmApi: IYugmApi) : ViewModel() {

    var notifications by mutableStateOf<List<NotificationItem>>(emptyList())
        private set
    var unreadCount by mutableStateOf(0)
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
                val (notifList, unread) = withContext(Dispatchers.IO) {
                    yugmApi.getNotifications(token)
                }
                notifications = notifList
                unreadCount = unread
            }.onFailure {
                error = it.message ?: "Failed to load notifications"
            }
            isLoading = false
        }
    }

    fun markRead(token: String, notificationId: String, onDone: () -> Unit = {}) {
        viewModelScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    yugmApi.markNotificationRead(token, notificationId)
                }
            }
            onDone()
            load(token)
        }
    }

    fun markAllRead(token: String) {
        viewModelScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    yugmApi.markAllNotificationsRead(token)
                }
            }
            load(token)
        }
    }
}
