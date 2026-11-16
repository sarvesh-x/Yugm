package com.yugm.app.feature.social.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.yugm.app.core.api.IYugmApi
import com.yugm.app.core.api.SocketEvent
import com.yugm.app.core.api.SocketManager
import com.yugm.app.core.model.Clan
import com.yugm.app.core.model.ClanMessage
import com.yugm.app.core.model.ClanSummary
import com.yugm.app.core.model.ClanInvitation
import com.yugm.app.core.model.ClanSentInvitation
import com.yugm.app.core.model.ClanRankingEntry
import com.yugm.app.core.model.Host
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

@HiltViewModel
class ClanViewModel @Inject constructor(
    private val yugmApi: IYugmApi,
    private val socketManager: SocketManager
) : ViewModel() {

    var myClan by mutableStateOf<Clan?>(null)
        private set

    var clans by mutableStateOf<List<ClanSummary>>(emptyList())
        private set

    var clanDetail by mutableStateOf<Clan?>(null)
        private set

    var messages by mutableStateOf<List<ClanMessage>>(emptyList())
        private set

    var invitations by mutableStateOf<List<ClanInvitation>>(emptyList())
        private set
    var leaderboard by mutableStateOf<List<ClanRankingEntry>>(emptyList())
        private set
    var inviteCandidates by mutableStateOf<List<Host>>(emptyList())
        private set
    var sentInviteIds by mutableStateOf<Set<String>>(emptySet())
        private set
    var sentInvitations by mutableStateOf<List<ClanSentInvitation>>(emptyList())
        private set

    var isLoading by mutableStateOf(false)
        private set
    var isSendingMessage by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
        private set
    var typingUserIds by mutableStateOf<Set<String>>(emptySet())
        private set
    var hasMoreOlder by mutableStateOf(true)
        private set
    var isLoadingOlder by mutableStateOf(false)
        private set

    private var authToken: String = ""
    private var currentClanId: String = ""
    private var currentUserId: String = ""

    init {
        viewModelScope.launch {
            socketManager.events.collectLatest { event ->
                when (event) {
                    is SocketEvent.ClanMessageReceived -> {
                        if (event.clanId == currentClanId && currentClanId.isNotBlank()) {
                            if (messages.none { it.id == event.message.id }) {
                                messages = (messages + event.message).sortedBy { it.createdAt }
                            }
                        }
                    }
                    is SocketEvent.ClanMessageDeleted -> {
                        if (event.clanId == currentClanId) {
                            messages = messages.filterNot { it.id == event.messageId }
                        }
                    }
                    is SocketEvent.ClanMessageUpdated -> {
                        if (event.clanId == currentClanId && currentClanId.isNotBlank()) {
                            val idx = messages.indexOfFirst { it.id == event.message.id }
                            messages = if (idx >= 0) {
                                messages.toMutableList().also { it[idx] = event.message }
                            } else {
                                (messages + event.message).sortedBy { it.createdAt }
                            }
                        }
                    }
                    is SocketEvent.ClanChatCleaned -> {
                        if (event.clanId == currentClanId) messages = emptyList()
                    }
                    is SocketEvent.ClanTypingUpdate -> {
                        if (event.clanId == currentClanId && event.userId != currentUserId) {
                            typingUserIds = if (event.typing) typingUserIds + event.userId else typingUserIds - event.userId
                        }
                    }
                    is SocketEvent.ClanUpdated -> handleClanStateEvent(event.clanId, event.clan)
                    is SocketEvent.ClanDeleted -> handleClanDeleted(event.clanId)
                    is SocketEvent.ClanMembershipChanged -> handleMembershipEvent(event)
                    is SocketEvent.Disconnected -> typingUserIds = emptySet()
                    else -> Unit
                }
            }
        }
    }

    private fun handleClanDeleted(clanId: String) {
        if (clanDetail?.id == clanId) clanDetail = null
        if (myClan?.id == clanId) myClan = null
        if (currentClanId == clanId) {
            messages = emptyList()
            typingUserIds = emptySet()
        }
    }

    private fun handleClanStateEvent(clanId: String, clan: Clan?) {
        if (clan != null) {
            if (clanDetail?.id == clanId) clanDetail = clan
            if (myClan?.id == clanId || clan.isMember) myClan = if (clan.isMember) clan else myClan?.takeUnless { it.id == clanId }
            if (clan.isMember && myClan == null) myClan = clan
        }
        refreshClanState(clanId)
    }

    private fun handleMembershipEvent(event: SocketEvent.ClanMembershipChanged) {
        val clanId = event.clanId
        val removedFromClan = (event.type == "left" || event.type == "removed") && event.userId == currentUserId
        if (removedFromClan) {
            if (myClan?.id == clanId) myClan = null
            if (clanDetail?.id == clanId) clanDetail = event.clan
            if (currentClanId == clanId) {
                messages = emptyList()
                typingUserIds = emptySet()
            }
            if (authToken.isNotBlank()) loadMyClan(authToken)
            return
        }
        if (event.clan != null) {
            if (clanDetail?.id == clanId) clanDetail = event.clan
            if (myClan?.id == clanId) myClan = event.clan
            if (event.type == "joined" && event.userId == currentUserId) myClan = event.clan
        }
        refreshClanState(clanId)
    }

    private fun refreshClanState(clanId: String) {
        if (authToken.isBlank()) return
        if (myClan?.id == clanId || clanDetail?.id == clanId || currentClanId == clanId) {
            viewModelScope.launch {
                runCatching {
                    if (clanDetail?.id == clanId || currentClanId == clanId) {
                        clanDetail = withContext(Dispatchers.IO) { yugmApi.getClanDetail(authToken, clanId) }
                    }
                    myClan = withContext(Dispatchers.IO) { yugmApi.myClan(authToken) }
                }
            }
        } else if (clanId.isNotBlank()) {
            loadMyClan(authToken)
        }
    }

    fun connect(token: String, clanId: String, userId: String) {
        if (token.isBlank() || clanId.isBlank()) return
        authToken = token
        currentClanId = clanId
        currentUserId = userId
        typingUserIds = emptySet()
        socketManager.connect(token)
    }

    fun sendTypingStatus(isTyping: Boolean) {
        if (currentClanId.isBlank()) return
        socketManager.sendClanTypingStatus(currentClanId, isTyping)
    }

    fun clearError() {
        error = null
    }

    fun loadMyClan(token: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                myClan = withContext(Dispatchers.IO) { yugmApi.myClan(token) }
            }.onFailure {
                error = it.message ?: "Failed to load clan"
            }
            isLoading = false
        }
    }

    fun loadClans(token: String, query: String = "") {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                clans = withContext(Dispatchers.IO) { yugmApi.listClans(token, query) }
            }.onFailure {
                error = it.message ?: "Failed to load clans"
            }
            isLoading = false
        }
    }

    fun loadCommunity(token: String) {
        viewModelScope.launch {
            runCatching {
                val result = withContext(Dispatchers.IO) {
                    yugmApi.clanInvitations(token) to yugmApi.clanLeaderboard(token)
                }
                invitations = result.first
                leaderboard = result.second
            }.onFailure { error = it.message ?: "Couldn't load clan community" }
        }
    }

    fun loadInviteCandidates(token: String, userId: String) {
        if (userId.isBlank()) return
        viewModelScope.launch {
            runCatching { inviteCandidates = withContext(Dispatchers.IO) { yugmApi.getFollowing(userId, token) } }
                .onFailure { error = it.message ?: "Couldn't load people to invite" }
        }
    }

    fun loadSentInvitations(token: String, clanId: String) {
        viewModelScope.launch {
            runCatching { sentInvitations = withContext(Dispatchers.IO) { yugmApi.clanSentInvitations(token, clanId) } }
                .onFailure { error = it.message ?: "Couldn't load pending invitations" }
        }
    }

    fun inviteMember(token: String, clanId: String, userId: String) {
        viewModelScope.launch {
            runCatching { withContext(Dispatchers.IO) { yugmApi.inviteClanMember(token, clanId, userId) } }
                .onSuccess {
                    sentInviteIds = sentInviteIds + userId
                    loadSentInvitations(token, clanId)
                }
                .onFailure { error = it.message ?: "Couldn't send clan invitation" }
        }
    }

    fun cancelSentInvitation(token: String, clanId: String, inviteId: String) {
        viewModelScope.launch {
            runCatching { withContext(Dispatchers.IO) { yugmApi.cancelClanInvitation(token, clanId, inviteId) } }
                .onSuccess {
                    sentInvitations = sentInvitations.filterNot { it.id == inviteId }
                }
                .onFailure { error = it.message ?: "Couldn't cancel invitation" }
        }
    }

    fun respondToInvitation(token: String, invitationId: String, accept: Boolean) {
        viewModelScope.launch {
            isLoading = true
            runCatching { withContext(Dispatchers.IO) { yugmApi.respondToClanInvitation(token, invitationId, accept) } }
                .onSuccess {
                    invitations = invitations.filterNot { it.id == invitationId }
                    if (accept) myClan = withContext(Dispatchers.IO) { yugmApi.myClan(token) }
                }
                .onFailure { error = it.message ?: "Couldn't respond to clan invitation" }
            isLoading = false
        }
    }

    fun transferOwnership(token: String, clanId: String, userId: String) {
        viewModelScope.launch {
            isLoading = true
            runCatching { withContext(Dispatchers.IO) { yugmApi.transferClanOwnership(token, clanId, userId) } }
                .onSuccess { loadDetail(token, clanId); loadMyClan(token) }
                .onFailure { error = it.message ?: "Couldn't transfer clan ownership" }
            isLoading = false
        }
    }

    fun loadDetail(token: String, clanId: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                clanDetail = withContext(Dispatchers.IO) { yugmApi.getClanDetail(token, clanId) }
            }.onFailure {
                error = it.message ?: "Failed to load clan detail"
            }
            isLoading = false
        }
    }

    fun loadMessages(token: String, clanId: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                val loaded = withContext(Dispatchers.IO) { yugmApi.getClanMessages(token, clanId) }
                messages = loaded
                hasMoreOlder = loaded.size >= 80
            }.onFailure {
                error = it.message ?: "Failed to load messages"
            }
            isLoading = false
        }
    }

    fun loadOlderMessages(token: String, clanId: String) {
        if (isLoadingOlder || !hasMoreOlder) return
        val oldest = messages.firstOrNull()?.createdAt ?: return
        viewModelScope.launch {
            isLoadingOlder = true
            runCatching {
                val older = withContext(Dispatchers.IO) { yugmApi.getClanMessages(token, clanId, 80, oldest) }
                if (older.isNotEmpty()) {
                    messages = (older + messages).distinctBy { it.id }
                }
                hasMoreOlder = older.size >= 80
            }.onFailure {
                error = it.message ?: "Failed to load older messages"
            }
            isLoadingOlder = false
        }
    }

    fun create(token: String, name: String, description: String, privacy: String, familyLabel: String, avatar: String? = null) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                myClan = withContext(Dispatchers.IO) { yugmApi.createClan(token, name, description, privacy, familyLabel, avatar) }
            }.onFailure {
                error = it.message ?: "Failed to create clan"
            }
            isLoading = false
        }
    }

    fun updateClan(
        token: String,
        clanId: String,
        name: String,
        description: String,
        privacy: String,
        familyLabel: String,
        avatar: String?
    ) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                val updated = withContext(Dispatchers.IO) {
                    yugmApi.updateClan(token, clanId, name, description, privacy, familyLabel, avatar)
                }
                clanDetail = updated
                if (myClan?.id == updated.id) myClan = updated
            }.onFailure {
                error = it.message ?: "Failed to update clan"
            }
            isLoading = false
        }
    }

    fun setMemberRole(token: String, clanId: String, userId: String, role: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                clanDetail = withContext(Dispatchers.IO) { yugmApi.setClanMemberRole(token, clanId, userId, role) }
            }.onFailure {
                error = it.message ?: "Failed to update member role"
            }
            isLoading = false
        }
    }

    fun kickMember(token: String, clanId: String, userId: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                clanDetail = withContext(Dispatchers.IO) { yugmApi.kickClanMember(token, clanId, userId) }
            }.onFailure {
                error = it.message ?: "Failed to remove member"
            }
            isLoading = false
        }
    }

    fun deleteClan(token: String, clanId: String, onComplete: () -> Unit = {}) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.deleteClan(token, clanId) }
                myClan = null
                clanDetail = null
                onComplete()
            }.onFailure {
                error = it.message ?: "Failed to delete clan"
            }
            isLoading = false
        }
    }

    fun join(token: String, clanId: String, onComplete: (Boolean) -> Unit = {}) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching { withContext(Dispatchers.IO) { yugmApi.joinClan(token, clanId) } }
                .onSuccess {
                    myClan = it
                    onComplete(true)
                }.onFailure {
                    error = it.message ?: "Failed to join clan"
                    onComplete(false)
                }
            isLoading = false
        }
    }

    fun leave(token: String, clanId: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.leaveClan(token, clanId) }
                myClan = null
            }.onFailure {
                error = it.message ?: "Failed to leave clan"
            }
            isLoading = false
        }
    }

    fun sendMessage(token: String, clanId: String, text: String, onSent: () -> Unit = {}) {
        viewModelScope.launch {
            isSendingMessage = true
            error = null
            runCatching {
                val sent = withContext(Dispatchers.IO) { yugmApi.sendClanMessage(token, clanId, text) }
                messages = (messages.filterNot { it.id == sent.id } + sent).sortedBy { it.createdAt }
                onSent()
            }.onFailure {
                error = it.message ?: "Failed to send message"
            }
            isSendingMessage = false
        }
    }

    fun reactToMessage(token: String, clanId: String, messageId: String, type: String) {
        viewModelScope.launch {
            error = null
            runCatching {
                val updated = withContext(Dispatchers.IO) { yugmApi.reactToClanMessage(token, clanId, messageId, type) }
                messages = messages.map { if (it.id == messageId) updated else it }
            }.onFailure {
                error = it.message ?: "Failed to react to message"
            }
        }
    }

    fun deleteMessage(token: String, clanId: String, messageId: String) {
        viewModelScope.launch {
            error = null
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.deleteClanMessage(token, clanId, messageId) }
                messages = messages.filterNot { it.id == messageId }
            }.onFailure {
                error = it.message ?: "Failed to delete message"
            }
        }
    }

    fun cleanChat(token: String, clanId: String, onComplete: () -> Unit = {}) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.cleanClanChat(token, clanId) }
                messages = emptyList()
                hasMoreOlder = false
                onComplete()
            }.onFailure {
                error = it.message ?: "Failed to clean chat"
            }
            isLoading = false
        }
    }

    fun reportMessage(token: String, clanId: String, messageId: String) {
        viewModelScope.launch {
            error = null
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.reportClanMessage(token, clanId, messageId, "INAPPROPRIATE") }
            }.onFailure {
                error = it.message ?: "Failed to report message"
            }
        }
    }

    override fun onCleared() {
        // Keep the socket connected for global presence; MainViewModel owns lifecycle.
        super.onCleared()
    }
}