package com.yugm.app.feature.chat.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.yugm.app.core.api.IYugmApi
import com.yugm.app.core.model.ActiveCosmetics
import com.yugm.app.core.model.ChatReplyTo
import com.yugm.app.core.model.Conversation
import com.yugm.app.core.model.DirectMessage
import com.yugm.app.core.model.DirectMessageReaction
import com.yugm.app.core.model.Host
import com.yugm.app.core.model.GiftItem
import com.yugm.app.core.model.ModerationReportRequest
import com.yugm.app.core.model.RelationshipStatus
import com.yugm.app.core.model.Room
import com.yugm.app.core.model.RoomReaction
import com.yugm.app.core.model.RoomType
import com.yugm.app.core.api.ReactionCatalogCache
import com.yugm.app.core.api.SocketEvent
import com.yugm.app.core.api.SocketManager
import com.yugm.app.feature.chat.cache.CachedConversation
import com.yugm.app.feature.chat.cache.ChatConversationCache
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
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
    val sendingMessageIds = mutableStateListOf<String>()
    val failedMessageIds = mutableStateListOf<String>()

    var partner by mutableStateOf<Host?>(null)
        private set

    var relationship by mutableStateOf<RelationshipStatus?>(null)
        private set

    var myActiveCosmetics by mutableStateOf(ActiveCosmetics())
        private set

    var isCurrentUserVip by mutableStateOf(false)
        private set

    var isLoading by mutableStateOf(false)
        private set

    var isSending by mutableStateOf(false)
        private set

    var isUploadingAttachment by mutableStateOf(false)
        private set

    var startingCallType by mutableStateOf<RoomType?>(null)
        private set

    val isStartingCall: Boolean
        get() = startingCallType != null

    var error by mutableStateOf("")
        private set

    var isPartnerTyping by mutableStateOf(false)
        private set

    var isMuted by mutableStateOf(false)
        private set

    var isBlockedByMe by mutableStateOf(false)
        private set

    var isMatched by mutableStateOf(false)
        private set

    var gifts by mutableStateOf<List<GiftItem>>(emptyList())
        private set

    var walletBalance by mutableIntStateOf(0)
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

    var reactionCatalog by mutableStateOf<List<RoomReaction>>(emptyList())
        private set
    var isReactionCatalogLoading by mutableStateOf(false)
        private set
    var reactionCatalogError by mutableStateOf<String?>(null)
        private set
    private var reactionCatalogJob: Job? = null
    private var reactionCatalogOwner = ""
    private var refreshJob: Job? = null
    private var refreshVersion = 0L
    private val cacheScope get() = "$currentUserId|$authToken"

    var hasMoreHistory by mutableStateOf(false)
        private set
    var isLoadingMore by mutableStateOf(false)
        private set
    private var nextBefore: String? = null

    private var authToken = ""
    private var currentUserId = ""
    private var partnerUserId = ""
    private var activeSearchQuery = ""
    private var isMarkingConversationRead = false

    init {
        viewModelScope.launch {
            socketManager.events.collectLatest { event ->
                when (event) {
                    is SocketEvent.DirectMessageReceived -> {
                        if (event.message.belongsToConversation(currentUserId, partnerUserId)) {
                            if (event.message.senderId == currentUserId) {
                                val localId = messages.firstOrNull {
                                    it.id.startsWith("local:") &&
                                        it.senderId == currentUserId &&
                                        it.receiverId == partnerUserId &&
                                        it.message == event.message.message &&
                                        it.mediaUrl == event.message.mediaUrl
                                }?.id
                                if (localId != null) replaceLocalMessage(localId, event.message) else replaceOrAppendMessage(event.message)
                            } else {
                                replaceOrAppendMessage(event.message)
                            }
                            if (event.message.senderId == partnerUserId && event.message.receiverId == currentUserId && !event.message.read) {
                                markConversationReadIfNeeded()
                            }
                            if (event.message.senderId == partnerUserId) {
                                refreshRelationshipSilently()
                            }
                        }
                    }
                    is SocketEvent.DirectMessageReactionUpdated -> {
                        val belongs = event.message.belongsToConversation(currentUserId, partnerUserId) || event.partnerId == partnerUserId
                        if (belongs && event.message.id.isNotBlank() && messages.any { it.id == event.message.id }) {
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
                            val readThroughAtMs = com.yugm.app.feature.chat.parseIsoMillis(event.readThrough)
                            messages.indices.forEach { index ->
                                val message = messages[index]
                                if (message.senderId != currentUserId || message.receiverId != partnerUserId || message.read) return@forEach
                                val createdAtMs = com.yugm.app.feature.chat.parseIsoMillis(message.createdAt)
                                val isRead = when {
                                    readThroughAtMs != null && createdAtMs != null -> createdAtMs <= readThroughAtMs
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
        val isNewConversation = partnerUserId != partnerId || currentUserId != userId
        if (isNewConversation || authToken != token) {
            refreshVersion++
            refreshJob?.cancel()
            reactionCatalogJob?.cancel()
            myActiveCosmetics = ActiveCosmetics()
            isCurrentUserVip = false
            reactionCatalog = emptyList()
        }
        if (isNewConversation) {
            messages.clear()
            isMatched = false
            relationship = null
            partner = null
            isMuted = false
            isBlockedByMe = false
            hasMoreHistory = false
            nextBefore = null
            sendingMessageIds.clear()
            failedMessageIds.clear()
        }
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

        if (isNewConversation) {
            ChatConversationCache.get(cacheScope, partnerId)?.let { cached ->
                messages.clear()
                messages.addAll(cached.messages)
                partner = cached.partner ?: partner
                relationship = cached.relationship
                isMuted = cached.isMuted
                isBlockedByMe = cached.isBlockedByMe
                isMatched = cached.isMatched
                hasMoreHistory = cached.hasMoreHistory
                nextBefore = cached.nextBefore
                if (cached.myActiveCosmetics != ActiveCosmetics()) myActiveCosmetics = cached.myActiveCosmetics
                if (cached.isCurrentUserVip) isCurrentUserVip = true
                error = ""
            }
        }

        socketManager.connect(token)
        reactionCatalog = ReactionCatalogCache.getAny(authToken).ifEmpty { reactionCatalog }
        loadReactionCatalog()
        refresh()
    }

    private fun snapshotConversationCache() {
        val pid = partnerUserId
        if (pid.isBlank()) return
        val stableMessages = messages.filterNot { it.id.startsWith("local:") }
        if (stableMessages.isEmpty() && partner == null) return
        ChatConversationCache.put(
            cacheScope, pid,
            CachedConversation(
                messages = stableMessages.takeLast(200),
                partner = partner,
                relationship = relationship,
                isMuted = isMuted,
                isBlockedByMe = isBlockedByMe,
                isMatched = isMatched,
                hasMoreHistory = hasMoreHistory,
                nextBefore = nextBefore,
                myActiveCosmetics = myActiveCosmetics,
                isCurrentUserVip = isCurrentUserVip
            )
        )
    }

    fun loadReactionCatalog(force: Boolean = false) {
        val now = System.currentTimeMillis()
        val requestToken = authToken
        if (reactionCatalogOwner != requestToken) {
            reactionCatalogJob?.cancel()
            reactionCatalog = emptyList()
            reactionCatalogOwner = requestToken
        }
        val cachedFresh = ReactionCatalogCache.getIfFresh(requestToken, now)
        if (!force && cachedFresh != null) {
            reactionCatalog = cachedFresh
            reactionCatalogError = null
            return
        }
        val anyCached = ReactionCatalogCache.getAny(authToken)
        if (anyCached.isNotEmpty() && reactionCatalog.isEmpty()) {
            reactionCatalog = anyCached
        }
        val minIntervalMs = if (force) 4_000L else 45_000L
        if (reactionCatalogJob?.isActive == true) return
        if (!force && reactionCatalog.isNotEmpty() && now - ReactionCatalogCache.loadedAt(requestToken) < minIntervalMs) return
        reactionCatalogJob = viewModelScope.launch {
            isReactionCatalogLoading = true
            reactionCatalogError = null
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.roomReactions(requestToken.takeIf { it.isNotBlank() }) }
            }.onSuccess { catalog ->
                if (authToken != requestToken) return@launch
                reactionCatalog = catalog
                ReactionCatalogCache.put(requestToken, catalog)
                reactionCatalogError = null
            }.onFailure { e ->
                if (reactionCatalog.isEmpty()) {
                    reactionCatalogError = e.message?.takeIf { it.isNotBlank() } ?: "Couldn't load reactions"
                }
            }
            isReactionCatalogLoading = false
        }
    }

    fun reloadReactionCatalog() = loadReactionCatalog(force = true)

    fun refresh() {
        if (authToken.isBlank() || partnerUserId.isBlank()) return
        loadReactionCatalog()
        val requestToken = authToken
        val requestPartner = partnerUserId
        val requestUser = currentUserId
        val knownAtStart = messages.mapTo(mutableSetOf()) { it.id }
        val version = ++refreshVersion
        refreshJob?.cancel()
        refreshJob = viewModelScope.launch {
            val showBlockingLoader = messages.none { !it.id.startsWith("local:") }
            if (showBlockingLoader) isLoading = true
            var loadError: Throwable? = null
            try {
                supervisorScope {
                    val historyRequest = async(Dispatchers.IO) {
                        runCatching { yugmApi.conversation(requestToken, requestPartner) }
                    }
                    val partnerRequest = async(Dispatchers.IO) {
                        runCatching { yugmApi.getUser(requestPartner, requestToken) }
                    }
                    val myProfileRequest = async(Dispatchers.IO) {
                        runCatching { yugmApi.authMe(requestToken) }
                    }
                    historyRequest.await()
                        .onSuccess { conversation ->
                            val oldestIncoming = conversation.messages.minOfOrNull { it.createdAt }
                            val hasOlderPages = oldestIncoming != null && messages.any { it.id in knownAtStart && !it.id.startsWith("local:") && it.createdAt < oldestIncoming }
                            val reconciled = com.yugm.app.core.api.reconcileRecentSnapshot(messages.toList(), conversation.messages, knownAtStart,
                                { it.id }, { it.createdAt }, { it.id.startsWith("local:") })
                            messages.clear()
                            messages.addAll(reconciled)
                            mergeMessages(conversation.messages)
                            relationship = conversation.relationship
                            isMuted = conversation.muted
                            if (!hasOlderPages) {
                                hasMoreHistory = conversation.hasMore
                                nextBefore = conversation.nextBefore ?: conversation.messages.firstOrNull()?.createdAt
                            }
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
                    myProfileRequest.await().onSuccess {
                        myActiveCosmetics = it.activeCosmetics
                        isCurrentUserVip = it.isVip
                    }
                }
            } finally {
                // Content is usable at this point. The composer/forward bundles
                // below only decorate optional sheets and must not hold the loader.
                if (version == refreshVersion) isLoading = false
            }
            // These six calls only feed the gift picker, wallet chip and forward
            // sheet. Load them in the background instead of delaying the thread.
            launch {
                supervisorScope {
                    val giftsRequest = async(Dispatchers.IO) { runCatching { yugmApi.gifts(requestToken) } }
                    val walletRequest = async(Dispatchers.IO) { runCatching { yugmApi.walletOverview(requestToken) } }
                    val matchesRequest = async(Dispatchers.IO) {
                        runCatching { yugmApi.datingMatches(requestToken) }.getOrDefault(emptyList())
                    }
                    giftsRequest.await().onSuccess { gifts = it }
                    walletRequest.await().onSuccess { walletBalance = it.balance }
                    val matched = matchesRequest.await().any { it.id == partnerUserId }
                    if (version == refreshVersion) isMatched = matched
                    runCatching { yugmApi.getBlockedUsers(requestToken) }
                        .onSuccess { blocked -> if (version == refreshVersion) isBlockedByMe = blocked.any { it.id == partnerUserId } }
                    val recentTargets = runCatching { yugmApi.getRecentMessages(requestToken) }.getOrDefault(emptyList())
                    val followedTargets = runCatching { yugmApi.getFollowing(requestUser, requestToken) }.getOrDefault(emptyList())
                    val friendTargets = runCatching { yugmApi.friendList(requestToken) }.getOrDefault(emptyList())
                        .mapNotNull { friend ->
                            val id = friend._id.takeIf { it.isNotBlank() } ?: return@mapNotNull null
                            Host(
                                id = id,
                                name = friend.name,
                                username = friend.username,
                                avatar = friend.avatar
                            )
                        }
                    val targets = (recentTargets.flatMap { listOfNotNull(it.sender, it.receiver) } + followedTargets + friendTargets)
                        .filter { it.id.isNotBlank() && it.id != currentUserId && it.id != partnerUserId }
                        .distinctBy { it.id }
                    if (version == refreshVersion) forwardTargets = targets
                }
            }
            markConversationReadIfNeeded()
            if (loadError == null || messages.isNotEmpty()) snapshotConversationCache()
            error = if (messages.isEmpty()) loadError?.message.orEmpty() else ""
        }
    }

    private fun nowIso(): String = java.time.Instant.now().toString()

    private fun optimisticMessage(
        localId: String,
        text: String,
        replyTo: DirectMessage? = null,
        mediaUrl: String = "",
        mediaType: String = ""
    ): DirectMessage = DirectMessage(
        id = localId,
        senderId = currentUserId,
        receiverId = partnerUserId,
        message = text,
        createdAt = nowIso(),
        read = false,
        mediaUrl = mediaUrl,
        mediaType = mediaType,
        replyTo = replyTo?.let {
            ChatReplyTo(
                messageId = it.id,
                author = it.sender?.name?.ifBlank { it.sender?.username.orEmpty() }.orEmpty().ifBlank { "Message" },
                authorId = it.senderId,
                text = it.message,
                mediaUrl = it.mediaUrl.takeIf(String::isNotBlank)
            )
        }
    )

    private fun replaceLocalMessage(localId: String, serverMessage: DirectMessage) {
        syncPartnerFromMessage(serverMessage)
        val idx = messages.indexOfFirst { it.id == localId }
        if (idx >= 0) {
            messages[idx] = serverMessage
        } else {
            replaceOrAppendMessage(serverMessage)
        }
        sendingMessageIds.remove(localId)
        failedMessageIds.remove(localId)
    }

    fun retrySend(localId: String) {
        val msg = messages.firstOrNull { it.id == localId } ?: return
        if (!localId.startsWith("local:") || msg.senderId != currentUserId) return
        failedMessageIds.remove(localId)
        if (localId !in sendingMessageIds) sendingMessageIds.add(localId)
        viewModelScope.launch {
            val result = withContext(Dispatchers.IO) {
                runCatching {
                    val replyId = msg.replyTo?.messageId?.takeIf { it.isNotBlank() && !it.startsWith("local:") }
                    if (msg.mediaUrl.isNotBlank()) {
                        yugmApi.sendDirectMediaMessage(authToken, partnerUserId, msg.mediaUrl, msg.mediaType, msg.message.takeIf { it != "Shared a photo" && it != "Shared a video" && it != "🎤 Voice note" } ?: "")
                    } else if (replyId != null) {
                        val replied = yugmApi.replyDirectMessage(authToken, partnerUserId, msg.message, replyId)
                        Conversation(messages = listOf(replied))
                    } else {
                        yugmApi.sendDirectMessage(authToken, partnerUserId, msg.message)
                    }
                }
            }
            result.onSuccess { conversation ->
                conversation.messages.forEach { replaceLocalMessage(localId, it) }
                conversation.relationship?.let { relationship = it }
                snapshotConversationCache()
            }.onFailure {
                sendingMessageIds.remove(localId)
                if (localId !in failedMessageIds) failedMessageIds.add(localId)
                error = it.message ?: "Message could not be sent"
            }
        }
    }

    fun sendMessage(text: String, onSuccess: () -> Unit = {}, onFailure: (String) -> Unit = {}) {
        val normalized = text.trim()
        if (normalized.isBlank() || authToken.isBlank() || partnerUserId.isBlank()) return
        val localId = "local:${java.util.UUID.randomUUID()}"
        val optimistic = optimisticMessage(localId, normalized)
        messages.add(optimistic)
        sendingMessageIds.add(localId)
        onSuccess()
        viewModelScope.launch {
            val result = withContext(Dispatchers.IO) {
                runCatching { yugmApi.sendDirectMessage(authToken, partnerUserId, normalized) }
            }
            result.onSuccess { conversation ->
                conversation.messages.forEach { replaceLocalMessage(localId, it) }
                conversation.relationship?.let { relationship = it }
                snapshotConversationCache()
            }.onFailure { failure ->
                sendingMessageIds.remove(localId)
                if (localId !in failedMessageIds) failedMessageIds.add(localId)
                val message = failure.message ?: "Message could not be sent"
                error = message
                onFailure(message)
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
        if (bytes.isEmpty() || authToken.isBlank() || partnerUserId.isBlank()) return
        viewModelScope.launch {
            isUploadingAttachment = true
            error = ""
            val localId = "local:${java.util.UUID.randomUUID()}"
            try {
                val (mediaUrl, mediaType) = withContext(Dispatchers.IO) {
                    yugmApi.uploadMessageMedia(authToken, bytes, mimeType, fileName)
                }
                val placeholder = optimisticMessage(localId, "", mediaUrl = mediaUrl, mediaType = mediaType)
                messages.add(placeholder)
                sendingMessageIds.add(localId)
                val result = withContext(Dispatchers.IO) {
                    runCatching { yugmApi.sendDirectMediaMessage(authToken, partnerUserId, mediaUrl, mediaType) }
                }
                result.onSuccess { conversation ->
                    conversation.messages.forEach { replaceLocalMessage(localId, it) }
                    conversation.relationship?.let { relationship = it }
                    snapshotConversationCache()
                }.onFailure { failure ->
                    sendingMessageIds.remove(localId)
                    if (localId !in failedMessageIds) failedMessageIds.add(localId)
                    error = failure.message ?: "Media could not be sent"
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (failure: Throwable) {
                error = failure.message ?: "Media could not be sent"
            } finally {
                isUploadingAttachment = false
            }
        }
    }

    fun replyMessage(
        text: String,
        replyTo: DirectMessage,
        onSuccess: () -> Unit = {},
        onFailure: (String) -> Unit = {}
    ) {
        val normalized = text.trim()
        if (normalized.isBlank() || replyTo.id.isBlank() || replyTo.id.startsWith("local:") || authToken.isBlank() || partnerUserId.isBlank()) return
        val localId = "local:${java.util.UUID.randomUUID()}"
        val optimistic = optimisticMessage(localId, normalized, replyTo = replyTo)
        messages.add(optimistic)
        sendingMessageIds.add(localId)
        onSuccess()
        viewModelScope.launch {
            val result = withContext(Dispatchers.IO) {
                runCatching { yugmApi.replyDirectMessage(authToken, partnerUserId, normalized, replyTo.id) }
            }
            result.onSuccess {
                replaceLocalMessage(localId, it)
                snapshotConversationCache()
            }.onFailure {
                sendingMessageIds.remove(localId)
                if (localId !in failedMessageIds) failedMessageIds.add(localId)
                val message = it.message ?: "Reply could not be sent"
                error = message
                onFailure(message)
            }
        }
    }

    fun editMessage(
        message: DirectMessage,
        text: String,
        onSuccess: () -> Unit = {},
        onFailure: (String) -> Unit = {}
    ) {
        if (message.id.isBlank() || message.id.startsWith("local:") || authToken.isBlank() || partnerUserId.isBlank()) return
        viewModelScope.launch {
            error = ""
            runCatching { withContext(Dispatchers.IO) { yugmApi.editDirectMessage(authToken, partnerUserId, message.id, text) } }
                .onSuccess {
                    replaceOrAppendMessage(it)
                    onSuccess()
                }
                .onFailure {
                    val msg = it.message ?: "Message could not be edited"
                    error = msg
                    onFailure(msg)
                }
        }
    }

    fun forwardMessage(
        message: DirectMessage,
        targetUserIds: List<String>,
        onSuccess: (String) -> Unit = {},
        onFailure: (String) -> Unit = {}
    ) {
        val ids = targetUserIds.map { it.trim() }.filter { it.isNotBlank() }.distinct()
        if (message.id.isBlank() || ids.isEmpty() || authToken.isBlank()) return
        viewModelScope.launch {
            var sent = 0
            val failures = mutableListOf<String>()
            for (targetId in ids) {
                val result = withContext(Dispatchers.IO) {
                    runCatching { yugmApi.forwardDirectMessage(authToken, targetId, message.id) }
                }
                if (result.isSuccess) sent++ else failures += (result.exceptionOrNull()?.message ?: "Couldn't forward")
            }
            when {
                failures.isEmpty() -> onSuccess(if (sent == 1) "Message forwarded" else "Forwarded to $sent chats")
                sent > 0 -> {
                    val msg = "Forwarded to $sent of ${ids.size} chats"
                    error = msg
                    onFailure(msg)
                }
                else -> {
                    val msg = failures.firstOrNull() ?: "Message could not be forwarded"
                    error = msg
                    onFailure(msg)
                }
            }
        }
    }

    fun reactToMessage(message: DirectMessage, type: String = "heart") {
        if (message.id.isBlank() || type.isBlank() || authToken.isBlank() || partnerUserId.isBlank()) return
        val current = messages.firstOrNull { it.id == message.id } ?: message
        val optimistic = optimisticReactionToggle(current, type)
        if (optimistic != null) replaceOrAppendMessage(optimistic)
        viewModelScope.launch {
            runCatching { withContext(Dispatchers.IO) { yugmApi.reactToDirectMessage(authToken, partnerUserId, message.id, type) } }
                .onSuccess(::replaceOrAppendMessage)
                .onFailure { e ->
                    replaceOrAppendMessage(current)
                    error = e.message ?: "Reaction could not be sent"
                }
        }
    }

    private fun optimisticReactionToggle(message: DirectMessage, type: String): DirectMessage? {
        val uid = currentUserId.takeIf { it.isNotBlank() } ?: return null
        val normalizedType = type.trim().lowercase()
        if (normalizedType.isBlank()) return null
        val existingMine = message.reactions.firstOrNull { it.userId == uid }
        val withoutMine = message.reactions.filterNot { it.userId == uid }
        val nextReactions = if (existingMine?.type?.equals(normalizedType, ignoreCase = true) == true) {
            withoutMine
        } else {
            withoutMine + DirectMessageReaction(userId = uid, type = normalizedType, createdAt = "")
        }
        return message.copy(reactions = nextReactions, reactionCount = nextReactions.size)
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

    fun reportConversation(
        category: String,
        description: String = "",
        onSuccess: () -> Unit = {},
        onFailure: (String) -> Unit = {}
    ) {
        if (authToken.isBlank() || partnerUserId.isBlank() || category.isBlank()) return
        viewModelScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    yugmApi.moderationReport(
                        authToken,
                        ModerationReportRequest(
                            targetUserId = partnerUserId,
                            category = category,
                            description = description.trim().ifBlank { null }
                        )
                    )
                }
            }.onSuccess {
                onSuccess()
            }.onFailure {
                val message = it.message ?: "Couldn't submit this report"
                error = message
                onFailure(message)
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

    private fun refreshRelationshipSilently() {
        val token = authToken
        val partnerId = partnerUserId
        if (token.isBlank() || partnerId.isBlank()) return
        viewModelScope.launch {
            runCatching { withContext(Dispatchers.IO) { yugmApi.conversation(token, partnerId, limit = 1) } }
                .onSuccess { conversation ->
                    if (partnerUserId != partnerId) return@onSuccess
                    conversation.relationship?.let { relationship = it }
                    isMuted = conversation.muted
                }
        }
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
                snapshotConversationCache()
            }.onFailure { failure ->
                if (error.isBlank()) error = failure.message ?: "Couldn't load older messages"
            }
            isLoadingMore = false
        }
    }

    fun startPrivateCall(
        type: RoomType,
        onSuccess: (Room) -> Unit = {},
        onFailure: (String) -> Unit = {}
    ) {
        if (startingCallType != null) return
        if (authToken.isBlank() || partnerUserId.isBlank()) {
            onFailure("Open a conversation before starting a call")
            return
        }
        if (isBlockedByMe) {
            val message = "Unblock this user to start a call"
            error = message
            onFailure(message)
            return
        }
        viewModelScope.launch {
            startingCallType = type
            error = ""
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.startPrivateCall(authToken, partnerUserId, type) }
            }.onSuccess {
                onSuccess(it)
            }.onFailure {
                val message = it.message ?: "Could not start the call"
                error = message
                onFailure(message)
            }
            startingCallType = null
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
        sendingMessageIds.removeAll(ids)
        failedMessageIds.removeAll(ids)
        searchResults = searchResults?.filterNot { it.id in ids }
    }

    private fun markConversationReadIfNeeded() {
        val token = authToken
        val partnerId = partnerUserId
        val userId = currentUserId
        if (token.isBlank() || partnerId.isBlank() || userId.isBlank() || isMarkingConversationRead) return
        val hasUnreadIncoming = messages.any { it.senderId == partnerId && it.receiverId == userId && !it.read && !it.id.startsWith("local:") }
        if (!hasUnreadIncoming) return
        messages.indices.forEach { index ->
            val message = messages[index]
            if (message.senderId == partnerId && message.receiverId == userId && !message.read) {
                messages[index] = message.copy(read = true)
            }
        }
        viewModelScope.launch {
            if (isMarkingConversationRead) return@launch
            isMarkingConversationRead = true
            runCatching { withContext(Dispatchers.IO) { yugmApi.markConversationRead(token, partnerId) } }
            isMarkingConversationRead = false
        }
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
