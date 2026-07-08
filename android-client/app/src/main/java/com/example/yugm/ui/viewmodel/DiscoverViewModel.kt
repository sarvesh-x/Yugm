package com.example.yugm.ui.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.yugm.api.YugmApi
import com.example.yugm.model.Room
import com.example.yugm.model.RoomType
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class DiscoverViewModel @Inject constructor() : ViewModel() {

    var rooms by mutableStateOf<List<Room>>(emptyList())
        private set

    var isLoading by mutableStateOf(false)
        private set

    var error by mutableStateOf<String?>(null)
        private set

    fun refreshRooms(type: RoomType? = null) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                YugmApi.rooms(type)
            }.onSuccess {
                rooms = it
            }.onFailure {
                error = it.message ?: "Failed to load rooms"
            }
            isLoading = false
        }
    }
}
