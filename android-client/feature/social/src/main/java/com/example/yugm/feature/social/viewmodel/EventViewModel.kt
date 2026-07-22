package com.example.yugm.feature.social.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.yugm.core.api.IYugmApi
import com.example.yugm.core.model.MyEvents
import com.example.yugm.core.model.YugmEvent
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

@HiltViewModel
class EventViewModel @Inject constructor(
    private val yugmApi: IYugmApi
) : ViewModel() {

    var events by mutableStateOf<List<YugmEvent>>(emptyList())
        private set

    var myEvents by mutableStateOf<MyEvents?>(null)
        private set

    var eventDetail by mutableStateOf<YugmEvent?>(null)
        private set

    var isLoading by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
        private set

    fun clearError() {
        error = null
    }

    fun loadEvents(token: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                events = withContext(Dispatchers.IO) { yugmApi.listEvents(token).first }
            }.onFailure {
                error = it.message ?: "Failed to load events"
            }
            isLoading = false
        }
    }

    fun loadMyEvents(token: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                myEvents = withContext(Dispatchers.IO) { yugmApi.myEvents(token) }
            }.onFailure {
                error = it.message ?: "Failed to load my events"
            }
            isLoading = false
        }
    }

    fun loadDetail(eventId: String, token: String?) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                eventDetail = withContext(Dispatchers.IO) { yugmApi.eventDetail(eventId, token) }
            }.onFailure {
                error = it.message ?: "Failed to load event"
            }
            isLoading = false
        }
    }

    fun create(token: String, title: String, description: String?, coverImage: String?, category: String, type: String, eventDate: String, eventEndDate: String?, timezone: String?, roomId: String?, maxParticipants: Int?, tags: List<String>?) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                eventDetail = withContext(Dispatchers.IO) {
                    yugmApi.createEvent(token, title, description, coverImage, category, type, eventDate, eventEndDate, timezone, roomId, maxParticipants, tags)
                }
            }.onFailure {
                error = it.message ?: "Failed to create event"
            }
            isLoading = false
        }
    }

    fun join(token: String, eventId: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                eventDetail = withContext(Dispatchers.IO) { yugmApi.joinEvent(token, eventId) }
            }.onFailure {
                error = it.message ?: "Failed to join event"
            }
            isLoading = false
        }
    }

    fun cancel(token: String, eventId: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                eventDetail = withContext(Dispatchers.IO) { yugmApi.cancelEvent(token, eventId) }
            }.onFailure {
                error = it.message ?: "Failed to cancel event"
            }
            isLoading = false
        }
    }
}
