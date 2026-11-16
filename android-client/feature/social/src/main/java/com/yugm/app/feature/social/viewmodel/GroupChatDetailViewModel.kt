package com.yugm.app.feature.social.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.yugm.app.core.api.IYugmApi
import com.yugm.app.core.api.SocketEvent
import com.yugm.app.core.api.SocketManager
import com.yugm.app.core.model.GroupMessage
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

@HiltViewModel
class GroupChatDetailViewModel @Inject constructor(
    private val yugmApi: IYugmApi,
    private val socketManager: SocketManager
) : ViewModel() {
    val messages = androidx.compose.runtime.mutableStateListOf<GroupMessage>()
    var messageText by mutableStateOf("")
        private set
    var isLoading by mutableStateOf(false)
        private set
    var isSending by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
        private set

    private var authToken = ""
    private var groupId = ""

    init {
        viewModelScope.launch {
            socketManager.events.collectLatest { event ->
                when (event) {
                    is SocketEvent.GroupMessageReceived -> {
                        if (event.groupId == groupId && messages.none { it.id == event.message.id }) {
                            messages.add(event.message)
                        }
                    }
                    else -> Unit
                }
            }
        }
    }

    fun connect(token: String, id: String) {
        if (token.isNotBlank()) authToken = token
        if (id.isNotBlank()) groupId = id
        socketManager.connect(token)
    }

    fun load() {
        val token = authToken
        val id = groupId
        if (token.isBlank() || id.isBlank()) return
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching { withContext(Dispatchers.IO) { yugmApi.groupMessages(token, id) } }
                .onSuccess { loaded ->
                    messages.clear()
                    messages.addAll(loaded)
                }
                .onFailure { error = it.message ?: "Failed to load messages" }
            isLoading = false
        }
    }

    fun updateText(value: String) {
        messageText = value
    }

    fun send() {
        val token = authToken
        val id = groupId
        val text = messageText.trim()
        if (text.isBlank() || isSending || token.isBlank() || id.isBlank()) return
        viewModelScope.launch {
            isSending = true
            error = null
            runCatching { withContext(Dispatchers.IO) { yugmApi.sendGroupMessage(token, id, text) } }
                .onSuccess { sent ->
                    if (messages.none { it.id == sent.id }) messages.add(sent)
                    messageText = ""
                }
                .onFailure { error = it.message ?: "Failed to send message" }
            isSending = false
        }
    }

    fun clearError() {
        error = null
    }
}