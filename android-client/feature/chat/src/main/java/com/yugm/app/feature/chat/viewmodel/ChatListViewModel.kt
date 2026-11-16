package com.yugm.app.feature.chat.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.yugm.app.core.api.IYugmApi
import com.yugm.app.core.api.SocketManager
import com.yugm.app.core.api.SocketEvent
import com.yugm.app.core.model.Clan
import com.yugm.app.core.model.ClanMessage
import com.yugm.app.core.model.DirectMessage
import com.yugm.app.core.model.FriendRequest
import com.yugm.app.core.model.FriendUser
import com.yugm.app.core.model.Host
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.withContext
import javax.inject.Inject

@HiltViewModel
class ChatListViewModel @Inject constructor(
    private val yugmApi: IYugmApi,
    private val socketManager: SocketManager
) : ViewModel() {


    var matches by mutableStateOf<List<Host>>(emptyList())
        private set
    var recentMessages by mutableStateOf<List<DirectMessage>>(emptyList())
        private set
    var unreadCounts by mutableStateOf<Map<String, Int>>(emptyMap())
        private set
    var mutedPartnerIds by mutableStateOf<Set<String>>(emptySet())
        private set
    var followers by mutableStateOf<List<Host>>(emptyList())
        private set
    var following by mutableStateOf<List<Host>>(emptyList())
        private set
    var recommendedChatUsers by mutableStateOf<List<Host>>(emptyList())
        private set
    var friends by mutableStateOf<List<FriendUser>>(emptyList())
        private set
    var friendRequests by mutableStateOf<List<FriendRequest>>(emptyList())
        private set
    var friendActionBusyId by mutableStateOf<String?>(null)
        private set
    var myClan by mutableStateOf<Clan?>(null)
        private set
    var clanLastMessage by mutableStateOf<ClanMessage?>(null)
        private set
    var isLoading by mutableStateOf(false)
        private set
    var isLoadingMoreRecent by mutableStateOf(false)
        private set
    var hasMoreRecent by mutableStateOf(false)
        private set
    private var recentNextBefore: String? = null
    var error by mutableStateOf<String?>(null)
        private set

    private var authToken: String = ""
    private var currentUserId: String = ""
    private var refreshRecentJob: Job? = null
    private var pendingRecentRefreshPartnerId: String? = null

    init {
        viewModelScope.launch {
            socketManager.events.collectLatest { event ->
                when (event) {
                    is SocketEvent.DirectConversationDeleted -> {
                        val partnerId = event.partnerId
                        recentMessages = recentMessages.filterNot { it.senderId == partnerId || it.receiverId == partnerId }
                        unreadCounts = unreadCounts - partnerId
                        matches = matches.filterNot { it.id == partnerId }
                        followers = followers.filterNot { it.id == partnerId }
                        following = following.filterNot { it.id == partnerId }
                        recommendedChatUsers = recommendedChatUsers.filterNot { it.id == partnerId }
                    }
                    is SocketEvent.DirectMessageDeleted -> {
                        val removed = recentMessages.firstOrNull { it.id == event.messageId }
                        if (removed != null) {
                            recentMessages = recentMessages.filterNot { it.id == event.messageId }
                            val me = currentUserId
                            if (me.isNotBlank() && removed.receiverId == me && !removed.read) {
                                val partnerId = if (event.partnerId.isNotBlank()) event.partnerId else removed.senderId
                                val current = unreadCounts[partnerId] ?: 0
                                unreadCounts = if (current <= 1) unreadCounts - partnerId else unreadCounts + (partnerId to (current - 1))
                            }
                            val partnerId = if (event.partnerId.isNotBlank()) event.partnerId else {
                                when (currentUserId) {
                                    removed.senderId -> removed.receiverId
                                    removed.receiverId -> removed.senderId
                                    else -> ""
                                }
                            }
                            scheduleRecentRefresh(partnerId)
                        }
                    }
                    is SocketEvent.DirectMessageReceived -> {
                        val msg = event.message
                        val existingIndex = recentMessages.indexOfFirst { it.id == msg.id && msg.id.isNotBlank() }
                        val isNewMessage = existingIndex < 0
                        recentMessages = if (isNewMessage) {
                            (listOf(msg) + recentMessages.filterNot { it.id == msg.id && msg.id.isNotBlank() }).sortedByDescending { it.createdAt }
                        } else {
                            recentMessages.toMutableList().also { it[existingIndex] = msg }
                        }
                        val me = currentUserId
                        if (isNewMessage && me.isNotBlank()) {
                            val partnerId = when (me) {
                                msg.senderId -> msg.receiverId
                                msg.receiverId -> msg.senderId
                                else -> ""
                            }
                            if (partnerId.isNotBlank() && msg.receiverId == me && !msg.read) {
                                unreadCounts = unreadCounts + (partnerId to ((unreadCounts[partnerId] ?: 0) + 1))
                            }
                        }
                    }
                    is SocketEvent.DirectMessageReactionUpdated -> {
                        val msg = event.message
                        val idx = recentMessages.indexOfFirst { it.id == msg.id && msg.id.isNotBlank() }
                        if (idx >= 0) {
                            recentMessages = recentMessages.toMutableList().also { it[idx] = msg }
                        }
                    }
                    is SocketEvent.DirectMessagesRead -> {
                        unreadCounts = unreadCounts - event.partnerId
                    }
                    is SocketEvent.DirectConversationRead -> {
                        unreadCounts = unreadCounts - event.partnerId
                        val partnerId = event.partnerId
                        val me = currentUserId
                        if (partnerId.isNotBlank() && me.isNotBlank()) {
                            val readThroughAtMs = com.yugm.app.feature.chat.parseIsoMillis(event.readThrough)
                            recentMessages = recentMessages.map { message ->
                                val incomingFromPartner = message.senderId == partnerId && message.receiverId == me
                                if (!incomingFromPartner || message.read) return@map message
                                val createdAtMs = com.yugm.app.feature.chat.parseIsoMillis(message.createdAt)
                                val isRead = when {
                                    readThroughAtMs != null && createdAtMs != null -> createdAtMs <= readThroughAtMs
                                    event.readThrough.isNotBlank() -> message.createdAt <= event.readThrough
                                    else -> true
                                }
                                if (isRead) message.copy(read = true) else message
                            }
                        }
                    }
                    is SocketEvent.UserOnline -> updateHostOnline(event.userId, true)
                    is SocketEvent.UserOffline -> updateHostOnline(event.userId, false)
                    else -> Unit
                }
            }
        }
    }

    private fun updateHostOnline(userId: String, online: Boolean) {
        matches = matches.map { if (it.id == userId) it.copy(isOnline = online) else it }
        followers = followers.map { if (it.id == userId) it.copy(isOnline = online) else it }
        following = following.map { if (it.id == userId) it.copy(isOnline = online) else it }
        recommendedChatUsers = recommendedChatUsers.map { if (it.id == userId) it.copy(isOnline = online) else it }
        recentMessages = recentMessages.map { msg ->
            val sender = msg.sender?.let { if (it.id == userId) it.copy(isOnline = online) else it }
            val receiver = msg.receiver?.let { if (it.id == userId) it.copy(isOnline = online) else it }
            if (sender === msg.sender && receiver === msg.receiver) msg else msg.copy(sender = sender, receiver = receiver)
        }
    }

    fun clearError() {
        error = null
    }

    fun load(token: String, currentUserId: String = "") {
        if (token.isNotBlank()) authToken = token
        if (currentUserId.isNotBlank()) this.currentUserId = currentUserId
        if (isLoading) return
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                coroutineScope {
                    val matchesRequest = async(Dispatchers.IO) { yugmApi.datingMatches(token) }
                    val messagesRequest = async(Dispatchers.IO) { yugmApi.getRecentMessagesPage(token) }
                    val followersRequest = async(Dispatchers.IO) {
                        if (currentUserId.isBlank()) emptyList() else runCatching {
                            yugmApi.getFollowers(currentUserId, token)
                        }.getOrDefault(emptyList())
                    }
                    val followingRequest = async(Dispatchers.IO) {
                        if (currentUserId.isBlank()) emptyList() else runCatching {
                            yugmApi.getFollowing(currentUserId, token)
                        }.getOrDefault(emptyList())
                    }
                    val recommendedRequest = async(Dispatchers.IO) {
                        runCatching { yugmApi.recommendedChatUsers(token) }.getOrDefault(emptyList())
                    }
                    val friendsRequest = async(Dispatchers.IO) {
                        runCatching { yugmApi.friendList(token) }.getOrDefault(emptyList())
                    }
                    val friendRequestsRequest = async(Dispatchers.IO) {
                        runCatching { yugmApi.friendRequests(token) }.getOrDefault(emptyList())
                    }

                    matches = matchesRequest.await()
                    val recentPage = messagesRequest.await()
                    var mergedRecent = recentPage.messages
                    hasMoreRecent = recentPage.hasMore
                    recentNextBefore = recentPage.nextBefore ?: recentPage.messages.lastOrNull()?.createdAt
                    unreadCounts = async(Dispatchers.IO) { runCatching { yugmApi.unreadCounts(token) }.getOrDefault(emptyMap()) }.await()
                    val mutedIds = async(Dispatchers.IO) { runCatching { yugmApi.mutedConversations(token) }.getOrDefault(emptySet()) }.await()
                    mutedPartnerIds = mutedIds
                    followers = followersRequest.await()
                    following = followingRequest.await()
                    recommendedChatUsers = recommendedRequest.await()
                    friends = friendsRequest.await()
                    friendRequests = friendRequestsRequest.await()
                    val knownPartnerIds = mergedRecent.map { if (it.senderId == currentUserId) it.receiverId else it.senderId }.toSet()
                    val missingMuted = mutedIds.filter { it.isNotBlank() && it !in knownPartnerIds }
                    if (missingMuted.isNotEmpty()) {
                        val mutedPreviews = missingMuted.map { partnerId ->
                            async(Dispatchers.IO) {
                                runCatching { yugmApi.conversation(token, partnerId, limit = 1, markRead = false) }.getOrNull()?.messages?.lastOrNull()
                            }
                        }.mapNotNull { it.await() }
                        if (mutedPreviews.isNotEmpty()) {
                            mergedRecent = (mergedRecent + mutedPreviews)
                                .distinctBy { it.id.ifBlank { "${it.senderId}|${it.receiverId}|${it.createdAt}|${it.message}" } }
                                .sortedByDescending { it.createdAt }
                        }
                    }
                    recentMessages = mergedRecent
                    val clan = runCatching { yugmApi.myClan(token) }.getOrNull()
                    myClan = clan
                    clanLastMessage = if (clan != null) {
                        runCatching { yugmApi.getClanMessages(token, clan.id).lastOrNull() }.getOrNull()
                    } else {
                        null
                    }
                }
            }.onFailure {
                error = it.message ?: "Failed to load messages"
            }
            isLoading = false
        }
    }

    fun markAllRead(token: String, currentUserId: String = "") {
        if (token.isNotBlank()) authToken = token
        if (currentUserId.isNotBlank()) this.currentUserId = currentUserId
        viewModelScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    yugmApi.markAllMessagesRead(token)
                }
            }
            load(token, currentUserId)
        }
    }

    fun loadMoreRecentMessages(token: String) {
        if (token.isNotBlank()) authToken = token
        val before = recentNextBefore ?: recentMessages.lastOrNull()?.createdAt
        if (isLoading || isLoadingMoreRecent || !hasMoreRecent || before.isNullOrBlank()) return
        viewModelScope.launch {
            isLoadingMoreRecent = true
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.getRecentMessagesPage(token, before = before, limit = 100) }
            }.onSuccess { page ->
                val merged = (recentMessages + page.messages)
                    .distinctBy { it.id.ifBlank { "${it.senderId}|${it.receiverId}|${it.createdAt}|${it.message}" } }
                    .sortedByDescending { it.createdAt }
                recentMessages = merged
                hasMoreRecent = page.hasMore
                recentNextBefore = page.nextBefore ?: page.messages.lastOrNull()?.createdAt ?: recentNextBefore
            }.onFailure {
                if (error == null) error = it.message ?: "Couldn't load more conversations"
            }
            isLoadingMoreRecent = false
        }
    }

    fun acceptFriendRequest(token: String, userId: String) {
        if (userId.isBlank() || friendActionBusyId != null) return
        friendActionBusyId = userId
        viewModelScope.launch {
            runCatching { withContext(Dispatchers.IO) { yugmApi.friendAccept(token, userId) } }
                .onSuccess {
                    friendRequests = friendRequests.filterNot { (it.userId?._id ?: it.friendId?._id) == userId }
                    runCatching { withContext(Dispatchers.IO) { yugmApi.friendList(token) } }
                        .onSuccess { friends = it }
                }
                .onFailure { error = it.message ?: "Couldn't accept this friend request" }
            friendActionBusyId = null
        }
    }

    fun declineFriendRequest(token: String, userId: String) {
        if (userId.isBlank() || friendActionBusyId != null) return
        friendActionBusyId = userId
        viewModelScope.launch {
            runCatching { withContext(Dispatchers.IO) { yugmApi.friendDecline(token, userId) } }
                .onSuccess {
                    friendRequests = friendRequests.filterNot { (it.userId?._id ?: it.friendId?._id) == userId }
                }
                .onFailure { error = it.message ?: "Couldn't decline this friend request" }
            friendActionBusyId = null
        }
    }

    fun removeFriend(token: String, userId: String) {
        if (userId.isBlank() || friendActionBusyId != null) return
        friendActionBusyId = userId
        viewModelScope.launch {
            runCatching { withContext(Dispatchers.IO) { yugmApi.friendUnfriend(token, userId) } }
                .onSuccess { friends = friends.filterNot { it._id == userId } }
                .onFailure { error = it.message ?: "Couldn't remove this friend" }
            friendActionBusyId = null
        }
    }

    fun clearFriendError() {
        error = null
    }

    private fun scheduleRecentRefresh(partnerId: String? = null) {
        val token = authToken
        if (token.isBlank() || isLoading) return
        pendingRecentRefreshPartnerId = partnerId?.takeIf { it.isNotBlank() } ?: pendingRecentRefreshPartnerId
        refreshRecentJob?.cancel()
        refreshRecentJob = viewModelScope.launch {
            delay(350)
            val targetPartnerId = pendingRecentRefreshPartnerId
            pendingRecentRefreshPartnerId = null
            if (!targetPartnerId.isNullOrBlank()) {
                runCatching {
                    withContext(Dispatchers.IO) { yugmApi.conversation(token, targetPartnerId, limit = 1, markRead = false) }
                }.onSuccess { conversation ->
                    val latest = conversation.messages.lastOrNull()
                    val withoutPartner = recentMessages.filterNot { msg ->
                        msg.senderId == targetPartnerId || msg.receiverId == targetPartnerId
                    }
                    recentMessages = if (latest != null) {
                        (withoutPartner + latest).sortedByDescending { it.createdAt }
                    } else {
                        withoutPartner
                    }
                }
            } else {
                runCatching {
                    withContext(Dispatchers.IO) { yugmApi.getRecentMessagesPage(token) }
                }.onSuccess { page ->
                    recentMessages = page.messages
                    hasMoreRecent = page.hasMore
                    recentNextBefore = page.nextBefore ?: page.messages.lastOrNull()?.createdAt
                }
            }
        }
    }

}
