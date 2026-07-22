package com.example.yugm.feature.settings.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.yugm.core.api.IYugmApi
import com.example.yugm.core.model.SupportTicket
import com.example.yugm.core.util.UiState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

@HiltViewModel
class SupportViewModel @Inject constructor(
    private val yugmApi: IYugmApi
) : ViewModel() {

    var ticketsState by mutableStateOf<UiState<List<SupportTicket>>>(UiState.Idle)
        private set
    var currentTicketState by mutableStateOf<UiState<SupportTicket>>(UiState.Idle)
        private set

    fun listTickets(token: String, status: String? = null, page: Int = 1, limit: Int = 20) {
        viewModelScope.launch {
            ticketsState = UiState.Loading
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.listSupportTickets(token, status, page, limit).first }
            }.onSuccess {
                ticketsState = UiState.Success(it)
            }.onFailure {
                ticketsState = UiState.Error(it.message ?: "Failed to load tickets", it)
            }
        }
    }

    fun getTicket(token: String, ticketId: String) {
        viewModelScope.launch {
            currentTicketState = UiState.Loading
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.getSupportTicket(token, ticketId) }
            }.onSuccess {
                currentTicketState = UiState.Success(it)
            }.onFailure {
                currentTicketState = UiState.Error(it.message ?: "Failed to load ticket", it)
            }
        }
    }

    fun createTicket(token: String, subject: String, message: String, category: String = "General") {
        viewModelScope.launch {
            currentTicketState = UiState.Loading
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.createSupportTicket(token, subject, message, category) }
            }.onSuccess {
                currentTicketState = UiState.Success(it)
            }.onFailure {
                currentTicketState = UiState.Error(it.message ?: "Failed to create ticket", it)
            }
        }
    }

    fun addMessage(token: String, ticketId: String, message: String) {
        viewModelScope.launch {
            currentTicketState = UiState.Loading
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.addSupportMessage(token, ticketId, message) }
            }.onSuccess {
                currentTicketState = UiState.Success(it)
            }.onFailure {
                currentTicketState = UiState.Error(it.message ?: "Failed to add message", it)
            }
        }
    }

    fun closeTicket(token: String, ticketId: String) {
        viewModelScope.launch {
            currentTicketState = UiState.Loading
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.closeSupportTicket(token, ticketId) }
            }.onSuccess {
                currentTicketState = UiState.Success(it)
            }.onFailure {
                currentTicketState = UiState.Error(it.message ?: "Failed to close ticket", it)
            }
        }
    }
}
