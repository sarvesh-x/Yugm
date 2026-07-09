package com.example.yugm.ui.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.yugm.model.ChatMessage
import com.example.yugm.socket.SocketEvent
import com.example.yugm.socket.SocketManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ChatViewModel @Inject constructor(
    private val socketManager: SocketManager
) : ViewModel() {

    val messages = mutableStateListOf<ChatMessage>()

    var partnerUserId: String? = null
        private set

    var isPartnerTyping by mutableStateOf(false)
        private set

    init {
        viewModelScope.launch {
            socketManager.events.collectLatest { event ->
                when (event) {
                    is SocketEvent.ChatMessage -> {
                        messages.add(ChatMessage(event.senderName, event.message))
                    }
                    is SocketEvent.DirectMessageReceived -> {
                        messages.add(ChatMessage(event.message.senderId, event.message.message))
                    }
                    is SocketEvent.TypingUpdate -> {
                        if (event.userId == partnerUserId) {
                            isPartnerTyping = event.typing
                        }
                    }
                    is SocketEvent.Connected -> {
                        // Handle connection
                    }
                    is SocketEvent.Disconnected -> {
                        // Handle disconnection
                    }
                    else -> {
                        // Ignore other events
                    }
                }
            }
        }
    }

    fun connect(token: String, roomId: String) {
        partnerUserId = roomId
        socketManager.connect(token, roomId)
    }

    fun sendMessage(roomId: String, text: String) {
        socketManager.sendMessage(roomId, text)
    }

    fun sendTypingStatus(isTyping: Boolean) {
        val partnerId = partnerUserId ?: return
        socketManager.sendTypingStatus(partnerId, isTyping)
    }

    override fun onCleared() {
        super.onCleared()
        socketManager.disconnect()
    }
}
