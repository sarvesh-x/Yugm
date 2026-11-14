package com.yugm.app.feature.social.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.yugm.app.core.api.IYugmApi
import com.yugm.app.core.model.Clan
import com.yugm.app.core.model.ClanMessage
import com.yugm.app.core.model.ClanSummary
import com.yugm.app.core.model.ClanInvitation
import com.yugm.app.core.model.ClanRankingEntry
import com.yugm.app.core.model.Host
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

@HiltViewModel
class ClanViewModel @Inject constructor(
    private val yugmApi: IYugmApi
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

    var isLoading by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
        private set

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

    fun inviteMember(token: String, clanId: String, userId: String) {
        viewModelScope.launch {
            runCatching { withContext(Dispatchers.IO) { yugmApi.inviteClanMember(token, clanId, userId) } }
                .onSuccess { sentInviteIds = sentInviteIds + userId }
                .onFailure { error = it.message ?: "Couldn't send clan invitation" }
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
                messages = withContext(Dispatchers.IO) { yugmApi.getClanMessages(token, clanId) }
            }.onFailure {
                error = it.message ?: "Failed to load messages"
            }
            isLoading = false
        }
    }

    fun create(token: String, name: String, description: String, privacy: String, familyLabel: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                myClan = withContext(Dispatchers.IO) { yugmApi.createClan(token, name, description, privacy, familyLabel) }
            }.onFailure {
                error = it.message ?: "Failed to create clan"
            }
            isLoading = false
        }
    }

    fun join(token: String, clanId: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                myClan = withContext(Dispatchers.IO) { yugmApi.joinClan(token, clanId) }
            }.onFailure {
                error = it.message ?: "Failed to join clan"
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

    fun sendMessage(token: String, clanId: String, text: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.sendClanMessage(token, clanId, text) }
                messages = withContext(Dispatchers.IO) { yugmApi.getClanMessages(token, clanId) }
            }.onFailure {
                error = it.message ?: "Failed to send message"
            }
            isLoading = false
        }
    }

    fun reactToMessage(token: String, clanId: String, messageId: String, type: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.reactToClanMessage(token, clanId, messageId, type) }
                messages = withContext(Dispatchers.IO) { yugmApi.getClanMessages(token, clanId) }
            }.onFailure {
                error = it.message ?: "Failed to react to message"
            }
            isLoading = false
        }
    }
}
