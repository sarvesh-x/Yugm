package com.yugm.app.feature.chat.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.yugm.app.core.api.IYugmApi
import com.yugm.app.core.model.ActiveCosmetics
import com.yugm.app.core.model.DirectMessage
import com.yugm.app.core.model.Host
import com.yugm.app.core.model.GiftItem
import com.yugm.app.core.model.RelationshipStatus
import com.yugm.app.core.model.Room
import com.yugm.app.core.model.RoomType
import com.yugm.app.core.api.SocketEvent
import com.yugm.app.core.api.SocketManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.supervisorScope
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

    var myActiveCosmetics by mutableStateOf(ActiveCosmetics())
        private set

    var isLoading by mutableStateOf(false)
        private set

    var isSending by mutableStateOf(false)
        private set

    var error by mutableStateOf("")
        private set

    var isPartnerTyping by mutableStateOf(false)
        private set

    var isMuted by mutableStateOf(false)
        private set

    var isBlockedByMe by mutableStateOf(false)
        private set

    var gifts by mutableStateOf<List<GiftItem>>(emptyList())
        private set

    var walletBalance by mutableStateOf(0)
        private set

    var searchResults by mutableStateOf<List<DirectMessage>?>(null)
        private set
    var hasMoreSearchResults by mutableStateOf(false)
        private set
    var isLoadingMoreSearch by mutableStateOf(false)
        private set
    private var searchNextBefore: String? = null

    var forwardTargets by mutableStateOf<List<Host>>(emptyList())
        private set

    var hasMoreHistory by mutableStateOf(false)
        private set
    var isLoadingMore by mutableStateOf(false)
        private set
    private var nextBefore: String? = null

    private var authToken = ""
    private var currentUserId = ""
    private var partnerUserId = ""
    private var activeSearchQuery = ""

    init {
        viewModelScope.launch {
            socketManager.events.collectLatest { event ->
                when (event) {
                    is SocketEvent.DirectMessageReceived -> {
                        if (event.message.belongsToConversation(currentUserId, partnerUserId)) {
                            replaceOrAppendMessage(event.message)
                        }
                    }
                    is SocketEvent.DirectMessageDeleted -> {
                        if (event.partnerId == partnerUserId) removeMessages(setOf(event.messageId))
                    }
                    is SocketEvent.DirectConversationDeleted -> {
                        if (event.partnerId == partnerUserId) {
                            messages.clear()
                            searchResults = null
                            hasMoreSearchResults = false
                            searchNextBefore = null
                        }
                    }
                    is SocketEvent.DirectMessagesRead -> {
                        if (event.partnerId == partnerUserId) {
                            val readThroughAt = runCatching { java.time.Instant.parse(event.readThrough) }.getOrNull()
                            messages.indices.forEach { index ->
                                val message = messages[index]
                                if (message.senderId != currentUserId || message.receiverId != partnerUserId || message.read) return@forEach
                                val createdAt = runCatching { java.time.Instant.parse(message.createdAt) }.getOrNull()
                                val isRead = when {
                                    readThroughAt != null && createdAt != null -> !createdAt.isAfter(readThroughAt)
                                    event.readThrough.isNotBlank() -> message.createdAt <= event.readThrough
                                    else -> false
                                }
                                if (isRead) messages[index] = message.copy(read = true)
                            }
                        }
                    }
                    is SocketEvent.TypingUpdate -> {
                        if (event.userId == partnerUserId) {
                            isPartnerTyping = event.typing
                        }
                    }
                    is SocketEvent.Disconnected -> isPartnerTyping = false
                    is SocketEvent.UserOnline -> if (event.userId == partnerUserId) partner = partner?.copy(isOnline = true)
                    is SocketEvent.UserOffline -> if (event.userId == partnerUserId) partner = partner?.copy(isOnline = false)
                    else -> Unit
                }
            }
        }
    }

    fun connect(token: String, userId: String, partnerId: String) {
        if (partnerUserId != partnerId || currentUserId != userId) messages.clear()
        activeSearchQuery = ""
        searchResults = null
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
                supervisorScope {
                    val historyRequest = async(Dispatchers.IO) {
                        runCatching { yugmApi.conversation(authToken, partnerUserId) }
                    }
                    val partnerRequest = async(Dispatchers.IO) {
                        runCatching { yugmApi.getUser(partnerUserId, authToken) }
                    }
                    val myProfileRequest = async(Dispatchers.IO) {
                        runCatching { yugmApi.authMe(authToken) }
                    }
                    val giftsRequest = async(Dispatchers.IO) { runCatching { yugmApi.gifts(authToken) } }
                    val walletRequest = async(Dispatchers.IO) { runCatching { yugmApi.walletOverview(authToken) } }
                    historyRequest.await()
                        .onSuccess { conversation ->
                            mergeMessages(conversation.messages)
                            relationship = conversation.relationship
                            isMuted = conversation.muted
                            hasMoreHistory = conversation.hasMore
                            nextBefore = conversation.nextBefore ?: conversation.messages.firstOrNull()?.createdAt
                        }
                        .onFailure { failure ->
                            if (failure is CancellationException) throw failure
                            loadError = failure
                        }
                    partnerRequest.await()
                        .onSuccess { partner = it }
                        .onFailure { failure ->
                            if (failure is CancellationException) throw failure
                            if (loadError == null) loadError = failure
                        }
                    myProfileRequest.await().onSuccess { myActiveCosmetics = it.activeCosmetics }
                    giftsRequest.await().onSuccess { gifts = it }
                    walletRequest.await().onSuccess { walletBalance = it.balance }
                    runCatching { yugmApi.getBlockedUsers(authToken) }
                        .onSuccess { blocked -> isBlockedByMe = blocked.any { it.id == partnerUserId } }
                    val recentTargets = runCatching { yugmApi.getRecentMessages(authToken) }.getOrDefault(emptyList())
                    val followedTargets = runCatching { yugmApi.getFollowing(currentUserId, authToken) }.getOrDefault(emptyList())
                    forwardTargets = (recentTargets.flatMap { listOfNotNull(it.sender, it.receiver) } + followedTargets)
                            .filter { it.id != currentUserId && it.id != partnerUserId }
                            .distinctBy { it.id }
                }
            } finally {
                isLoading = false
            }
            error = loadError?.message.orEmpty()
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

    fun sendGift(gift: GiftItem) {
        if (gift.id.isBlank() || walletBalance < gift.price || authToken.isBlank() || partnerUserId.isBlank()) return
        viewModelScope.launch {
            error = ""
            runCatching { withContext(Dispatchers.IO) { yugmApi.sendDirectGift(authToken, gift.id, partnerUserId) } }
                .onSuccess { conversation ->
                    conversation.messages.forEach(::replaceOrAppendMessage)
                    conversation.relationship?.let { relationship = it }
                    runCatching { withContext(Dispatchers.IO) { yugmApi.walletOverview(authToken) } }
                        .onSuccess { walletBalance = it.balance }
                }
                .onFailure { error = it.message ?: "Gift could not be sent" }
        }
    }

    fun sendAttachment(bytes: ByteArray, mimeType: String, fileName: String) {
        if (bytes.isEmpty() || isSending || authToken.isBlank() || partnerUserId.isBlank()) return
        viewModelScope.launch {
            isSending = true
            error = ""
            try {
                val (mediaUrl, mediaType) = withContext(Dispatchers.IO) {
                    yugmApi.uploadMessageMedia(authToken, bytes, mimeType, fileName)
                }
                val conversation = withContext(Dispatchers.IO) {
                    yugmApi.sendDirectMediaMessage(authToken, partnerUserId, mediaUrl, mediaType)
                }
                conversation.messages.forEach(::replaceOrAppendMessage)
                conversation.relationship?.let { relationship = it }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (failure: Throwable) {
                error = failure.message ?: "Photo could not be sent"
            } finally {
                isSending = false
            }
        }
    }

    fun replyMessage(text: String, replyTo: DirectMessage) {
        val normalized = text.trim()
        if (normalized.isBlank() || replyTo.id.isBlank() || isSending || authToken.isBlank() || partnerUserId.isBlank()) return
        viewModelScope.launch {
            isSending = true
            error = ""
            runCatching { withContext(Dispatchers.IO) { yugmApi.replyDirectMessage(authToken, partnerUserId, normalized, replyTo.id) } }
                .onSuccess(::appendMessage)
                .onFailure { error = it.message ?: "Reply could not be sent" }
            isSending = false
        }
    }

    fun editMessage(message: DirectMessage, text: String) {
        if (message.id.isBlank() || isSending || authToken.isBlank() || partnerUserId.isBlank()) return
        viewModelScope.launch {
            isSending = true
            error = ""
            runCatching { withContext(Dispatchers.IO) { yugmApi.editDirectMessage(authToken, partnerUserId, message.id, text) } }
                .onSuccess(::replaceOrAppendMessage)
                .onFailure { error = it.message ?: "Message could not be edited" }
            isSending = false
        }
    }

    fun forwardMessage(message: DirectMessage, targetUserId: String) {
        viewModelScope.launch {
            runCatching { withContext(Dispatchers.IO) { yugmApi.forwardDirectMessage(authToken, targetUserId, message.id) } }
                .onFailure { error = it.message ?: "Message could not be forwarded" }
        }
    }

    fun reactToMessage(message: DirectMessage) {
        if (message.id.isBlank()) return
        viewModelScope.launch {
            runCatching { withContext(Dispatchers.IO) { yugmApi.reactToDirectMessage(authToken, partnerUserId, message.id) } }
                .onSuccess(::replaceOrAppendMessage)
                .onFailure { error = it.message ?: "Reaction could not be sent" }
        }
    }

    fun search(query: String) {
        activeSearchQuery = query
        if (query.length < 2) {
            searchResults = null
            hasMoreSearchResults = false
            searchNextBefore = null
            return
        }
        viewModelScope.launch {
            runCatching { withContext(Dispatchers.IO) { yugmApi.searchConversationPage(authToken, partnerUserId, query) } }
                .onSuccess { page ->
                    if (activeSearchQuery == query) {
                        searchResults = page.messages
                        hasMoreSearchResults = page.hasMore
                        searchNextBefore = page.nextBefore ?: page.messages.firstOrNull()?.createdAt
                    }
                }
                .onFailure { error = it.message ?: "Search failed" }
        }
    }

    fun loadMoreSearchResults() {
        val query = activeSearchQuery
        val before = searchNextBefore ?: searchResults?.firstOrNull()?.createdAt
        if (query.length < 2 || before.isNullOrBlank() || isLoadingMoreSearch || !hasMoreSearchResults) return
        viewModelScope.launch {
            isLoadingMoreSearch = true
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.searchConversationPage(authToken, partnerUserId, query, before = before) }
            }.onSuccess { page ->
                if (activeSearchQuery == query) {
                    val current = searchResults.orEmpty()
                    val merged = (page.messages + current)
                        .distinctBy { it.id.ifBlank { "${it.senderId}|${it.receiverId}|${it.createdAt}|${it.message}" } }
                        .sortedBy { it.createdAt }
                    searchResults = merged
                    hasMoreSearchResults = page.hasMore
                    searchNextBefore = page.nextBefore ?: page.messages.firstOrNull()?.createdAt ?: searchNextBefore
                }
            }.onFailure { error = it.message ?: "Couldn't load more results" }
            isLoadingMoreSearch = false
        }
    }

    fun mute(muted: Boolean) {
        viewModelScope.launch {
            runCatching { withContext(Dispatchers.IO) { yugmApi.muteConversation(authToken, partnerUserId, muted) } }
                .onSuccess { isMuted = muted }
                .onFailure { error = it.message ?: "Mute setting could not be changed" }
        }
    }

    fun toggleBlock() {
        if (authToken.isBlank() || partnerUserId.isBlank()) return
        val targetBlocked = !isBlockedByMe
        viewModelScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    if (targetBlocked) yugmApi.blockUser(partnerUserId, authToken)
                    else yugmApi.unblockUser(partnerUserId, authToken)
                }
            }.onSuccess {
                isBlockedByMe = targetBlocked
                error = if (targetBlocked) "User blocked. You can unblock them anytime." else "User unblocked."
            }.onFailure {
                error = it.message ?: "Could not update block setting"
            }
        }
    }

    fun deleteConversation(onDone: () -> Unit = {}, onFailure: (String) -> Unit = {}) {
        if (authToken.isBlank() || partnerUserId.isBlank()) return
        viewModelScope.launch {
            runCatching { withContext(Dispatchers.IO) { yugmApi.deleteConversation(authToken, partnerUserId) } }
                .onSuccess { messages.clear(); onDone() }
                .onFailure {
                    val message = it.message ?: "Could not delete conversation"
                    error = message
                    onFailure(message)
                }
        }
    }

    fun deleteSelectedMessages(messageIds: List<String>, scope: String) {
        if (messageIds.isEmpty() || authToken.isBlank() || partnerUserId.isBlank()) return
        viewModelScope.launch {
            runCatching { withContext(Dispatchers.IO) { yugmApi.deleteSelectedDirectMessages(authToken, partnerUserId, messageIds, scope) } }
                .onSuccess { deletedIds ->
                    val deletedIdSet = deletedIds.toSet()
                    removeMessages(deletedIdSet)
                }
                .onFailure { error = it.message ?: "Selected messages could not be deleted" }
        }
    }

    fun sendTypingStatus(isTyping: Boolean) {
        if (partnerUserId.isBlank()) return
        socketManager.sendTypingStatus(partnerUserId, isTyping)
    }

    fun loadOlderMessages() {
        val token = authToken
        val partnerId = partnerUserId
        val before = nextBefore ?: messages.minByOrNull { it.createdAt }?.createdAt
        if (token.isBlank() || partnerId.isBlank() || before.isNullOrBlank() || isLoading || isLoadingMore || !hasMoreHistory) return
        viewModelScope.launch {
            isLoadingMore = true
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.conversation(token, partnerId, before = before, limit = 50) }
            }.onSuccess { conversation ->
                val older = conversation.messages.filter { olderMsg -> messages.none { it.id == olderMsg.id } }
                if (older.isNotEmpty()) {
                    messages.addAll(0, older.sortedBy { it.createdAt })
                }
                hasMoreHistory = conversation.hasMore
                nextBefore = conversation.nextBefore ?: older.minByOrNull { it.createdAt }?.createdAt ?: nextBefore
            }.onFailure { failure ->
                if (error.isBlank()) error = failure.message ?: "Couldn't load older messages"
            }
            isLoadingMore = false
        }
    }

    fun startPrivateCall(
        type: RoomType,
        onSuccess: (Room) -> Unit,
        onFailure: (String) -> Unit
    ) {
        if (authToken.isBlank() || partnerUserId.isBlank()) {
            onFailure("Open a conversation before starting a call")
            return
        }
        viewModelScope.launch {
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.startPrivateCall(authToken, partnerUserId, type) }
            }.onSuccess(onSuccess).onFailure {
                onFailure(it.message ?: "Could not start the call")
            }
        }
    }

    private fun syncPartnerFromMessage(message: DirectMessage) {
        val candidate = when (partnerUserId) {
            message.senderId -> message.sender
            message.receiverId -> message.receiver
            else -> null
        } ?: return
        val current = partner
        partner = if (current == null) {
            candidate
        } else {
            current.copy(
                name = if (candidate.name.isNotBlank()) candidate.name else current.name,
                username = if (candidate.username.isNotBlank()) candidate.username else current.username,
                avatar = candidate.avatar ?: current.avatar,
                activeCosmetics = if (candidate.activeCosmetics != com.yugm.app.core.model.ActiveCosmetics()) candidate.activeCosmetics else current.activeCosmetics,
                isOnline = candidate.isOnline || current.isOnline
            )
        }
    }

    private fun mergeMessages(history: List<DirectMessage>) {
        history.forEach(::syncPartnerFromMessage)
        val merged = (history + messages)
            .distinctBy { it.stableKey() }
            .sortedBy { it.createdAt }
        messages.clear()
        messages.addAll(merged)
    }

    private fun appendMessage(message: DirectMessage) {
        syncPartnerFromMessage(message)
        if (messages.none { it.stableKey() == message.stableKey() }) {
            messages.add(message)
        }
    }

    private fun replaceOrAppendMessage(message: DirectMessage) {
        syncPartnerFromMessage(message)
        val index = messages.indexOfFirst { it.id == message.id }
        if (index >= 0) messages[index] = message else appendMessage(message)
    }

    private fun removeMessages(ids: Set<String>) {
        messages.removeAll { it.id in ids }
        searchResults = searchResults?.filterNot { it.id in ids }
    }

    override fun onCleared() {
        // Keep the socket connected for global presence; MainViewModel owns lifecycle.
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
