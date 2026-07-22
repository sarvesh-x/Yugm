package com.example.yugm.feature.chat.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.yugm.core.api.IYugmApi
import com.example.yugm.core.model.DirectMessage
import com.example.yugm.core.model.Host
import com.example.yugm.core.model.RelationshipStatus
import com.example.yugm.core.api.SocketEvent
import com.example.yugm.core.api.SocketManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

@HiltViewModel
class ChatViewModel @Inject constructor(
    private val socketManager: SocketManager,
    private val yugmApi: IYugmApi
) : ViewModel() {

    val messages = mutableStateListOf<DirectMessage>()

    var partner by mutableStateOf<Host?>(null)
        private set

    var relationship by mutableStateOf<RelationshipStatus?>(null)
        private set

    var isLoading by mutableStateOf(false)
        private set

    var isSending by mutableStateOf(false)
        private set

    var error by mutableStateOf("")
        private set

    var isPartnerTyping by mutableStateOf(false)
        private set

    private var authToken = ""
    private var currentUserId = ""
    private var partnerUserId = ""

    init {
        viewModelScope.launch {
            socketManager.events.collectLatest { event ->
                when (event) {
                    is SocketEvent.DirectMessageReceived -> {
                        if (event.message.belongsToConversation(currentUserId, partnerUserId)) {
                            appendMessage(event.message)
                        }
                    }
                    is SocketEvent.TypingUpdate -> {
                        if (event.userId == partnerUserId) {
                            isPartnerTyping = event.typing
                        }
                    }
                    is SocketEvent.Disconnected -> isPartnerTyping = false
                    else -> Unit
                }
            }
        }
    }

    fun connect(token: String, userId: String, partnerId: String) {
        authToken = token
        currentUserId = userId
        partnerUserId = partnerId
        isPartnerTyping = false

        if (token.isBlank() || userId.isBlank() || partnerId.isBlank()) {
            error = "Unable to open this conversation"
            return
        }

        socketManager.connect(token)
        refresh()
    }

    fun refresh() {
        if (authToken.isBlank() || partnerUserId.isBlank()) return
        viewModelScope.launch {
            isLoading = true
            error = ""

            var loadError: Throwable? = null
            try {
                val conversation = withContext(Dispatchers.IO) { yugmApi.conversation(authToken, partnerUserId) }
                mergeMessages(conversation.messages)
                relationship = conversation.relationship
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (failure: Throwable) {
                loadError = failure
            }

            try {
                partner = withContext(Dispatchers.IO) { yugmApi.getUser(partnerUserId, authToken) }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (failure: Throwable) {
                if (loadError == null) loadError = failure
            }

            error = loadError?.message.orEmpty()
            isLoading = false
        }
    }

    fun sendMessage(text: String) {
        val normalized = text.trim()
        if (normalized.isBlank() || isSending || authToken.isBlank() || partnerUserId.isBlank()) return

        viewModelScope.launch {
            isSending = true
            error = ""
            try {
                val result = withContext(Dispatchers.IO) { yugmApi.sendDirectMessage(authToken, partnerUserId, normalized) }
                result.messages.forEach(::appendMessage)
                relationship = result.relationship ?: relationship
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (failure: Throwable) {
                error = failure.message ?: "Message could not be sent"
            } finally {
                isSending = false
            }
        }
    }

    fun sendTypingStatus(isTyping: Boolean) {
        if (partnerUserId.isBlank()) return
        socketManager.sendTypingStatus(partnerUserId, isTyping)
    }

    private fun mergeMessages(history: List<DirectMessage>) {
        val merged = (history + messages)
            .distinctBy { it.stableKey() }
            .sortedBy { it.createdAt }
        messages.clear()
        messages.addAll(merged)
    }

    private fun appendMessage(message: DirectMessage) {
        if (messages.none { it.stableKey() == message.stableKey() }) {
            messages.add(message)
        }
    }

    override fun onCleared() {
        socketManager.disconnect()
        super.onCleared()
    }
}

internal fun DirectMessage.belongsToConversation(currentUserId: String, partnerUserId: String): Boolean {
    if (currentUserId.isBlank() || partnerUserId.isBlank()) return false
    return (senderId == currentUserId && receiverId == partnerUserId) ||
        (senderId == partnerUserId && receiverId == currentUserId)
}

private fun DirectMessage.stableKey(): String = id.ifBlank {
    "$senderId|$receiverId|$createdAt|$message"
}
