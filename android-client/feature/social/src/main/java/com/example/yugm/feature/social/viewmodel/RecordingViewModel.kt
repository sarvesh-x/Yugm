package com.example.yugm.feature.social.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.yugm.core.api.IYugmApi
import com.example.yugm.core.model.RoomRecording
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

@HiltViewModel
class RecordingViewModel @Inject constructor(
    private val yugmApi: IYugmApi
) : ViewModel() {

    var recordings by mutableStateOf<List<RoomRecording>>(emptyList())
        private set

    var recordingDetail by mutableStateOf<RoomRecording?>(null)
        private set

    var isLoading by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
        private set

    fun clearError() {
        error = null
    }

    fun loadRecordings(token: String, roomId: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                recordings = withContext(Dispatchers.IO) { yugmApi.roomRecordings(token, roomId).first }
            }.onFailure {
                error = it.message ?: "Failed to load recordings"
            }
            isLoading = false
        }
    }

    fun loadDetail(token: String, recordingId: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                recordingDetail = withContext(Dispatchers.IO) { yugmApi.recordingDetail(token, recordingId) }
            }.onFailure {
                error = it.message ?: "Failed to load recording"
            }
            isLoading = false
        }
    }

    fun updateRecording(token: String, recordingId: String, title: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                recordingDetail = withContext(Dispatchers.IO) { yugmApi.updateRecording(token, recordingId, title) }
            }.onFailure {
                error = it.message ?: "Failed to update recording"
            }
            isLoading = false
        }
    }

    fun deleteRecording(token: String, recordingId: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.deleteRecording(token, recordingId) }
            }.onFailure {
                error = it.message ?: "Failed to delete recording"
            }
            isLoading = false
        }
    }

    fun viewRecording(token: String, recordingId: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.viewRecording(token, recordingId) }
            }.onFailure {
                error = it.message ?: "Failed to view recording"
            }
            isLoading = false
        }
    }
}
