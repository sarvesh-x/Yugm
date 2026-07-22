package com.example.yugm.feature.social.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.yugm.core.api.IYugmApi
import com.example.yugm.core.model.Clan
import com.example.yugm.core.model.ClanMessage
import com.example.yugm.core.model.ClanSummary
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
