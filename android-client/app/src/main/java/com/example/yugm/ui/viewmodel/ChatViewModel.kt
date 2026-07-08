package com.example.yugm.ui.viewmodel

import androidx.compose.runtime.mutableStateListOf
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
                    is SocketEvent.Connected -> {
                        // Handle connection
                    }
                    is SocketEvent.Disconnected -> {
                        // Handle disconnection
                    }
                    else -> {
                        // Ignore typing indicators or online updates in this viewmodel
                    }
                }
            }
        }
    }

    fun connect(token: String, roomId: String) {
        socketManager.connect(token, roomId)
    }

    fun sendMessage(roomId: String, text: String) {
        socketManager.sendMessage(roomId, text)
    }

    override fun onCleared() {
        super.onCleared()
        socketManager.disconnect()
    }
}
