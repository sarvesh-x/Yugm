package com.yugm.app.feature.social.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.yugm.app.core.api.IYugmApi
import com.yugm.app.core.api.SocketEvent
import com.yugm.app.core.api.SocketManager
import com.yugm.app.core.model.NotificationItem
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

@HiltViewModel
class NotificationsViewModel @Inject constructor(
    private val yugmApi: IYugmApi,
    socketManager: SocketManager
) : ViewModel() {

    var notifications by mutableStateOf<List<NotificationItem>>(emptyList())
        private set
    var unreadCount by mutableStateOf(0)
        private set
    var isLoading by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
        private set
    var isMarkingAllRead by mutableStateOf(false)
        private set
    private var activeToken = ""
    private var loadJob: kotlinx.coroutines.Job? = null

    init {
        viewModelScope.launch {
            socketManager.events.collect { event ->
                if (event is SocketEvent.NotificationReceived) {
                    val item = event.notification
                    if (item.id.isNotBlank() && notifications.none { it.id == item.id }) {
                        notifications = listOf(item) + notifications
                        if (!item.read) unreadCount += 1
                    }
                }
            }
        }
    }

    fun clearError() {
        error = null
    }

    fun load(token: String) {
        if (token.isBlank()) return
        if (activeToken != token) {
            notifications = emptyList()
            unreadCount = 0
        }
        activeToken = token
        loadJob?.cancel()
        loadJob = viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                val (notifList, unread) = withContext(Dispatchers.IO) {
                    yugmApi.getNotifications(token)
                }
                // Fresh server read flags override cached entries with the same ID.
                notifications = (notifList + notifications).distinctBy { it.id }
                    .sortedByDescending { it.createdAt }
                unreadCount = unread
            }.onFailure {
                if (it is kotlinx.coroutines.CancellationException) throw it
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
        if (isMarkingAllRead || unreadCount == 0) return
        viewModelScope.launch {
            isMarkingAllRead = true
            val previousNotifications = notifications
            val previousUnread = unreadCount
            notifications = notifications.map { it.copy(read = true) }
            unreadCount = 0
            runCatching {
                withContext(Dispatchers.IO) {
                    yugmApi.markAllNotificationsRead(token)
                }
            }.onFailure {
                notifications = previousNotifications
                unreadCount = previousUnread
                error = it.message ?: "Could not mark notifications as read"
            }
            isMarkingAllRead = false
        }
    }
}
