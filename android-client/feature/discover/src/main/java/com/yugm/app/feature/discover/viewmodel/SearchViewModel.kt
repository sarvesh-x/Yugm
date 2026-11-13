package com.yugm.app.feature.discover.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.yugm.app.core.api.IYugmApi
import com.yugm.app.core.model.Host
import com.yugm.app.core.model.Room
import com.yugm.app.core.util.UiState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

@HiltViewModel
class SearchViewModel @Inject constructor(
    private val yugmApi: IYugmApi
) : ViewModel() {

    var userResults by mutableStateOf<List<Host>>(emptyList())
        private set
    var roomResults by mutableStateOf<List<Room>>(emptyList())
        private set
    var searchState by mutableStateOf<UiState<Any>>(UiState.Idle)
        private set

    fun searchUsers(query: String, token: String? = null) {
        viewModelScope.launch {
            searchState = UiState.Loading
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.searchUsers(query, token) }
            }.onSuccess {
                userResults = it
                searchState = UiState.Success(it)
            }.onFailure {
                searchState = UiState.Error(it.message ?: "Search failed", it)
            }
        }
    }

    fun searchRooms(query: String) {
        viewModelScope.launch {
            searchState = UiState.Loading
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.searchRooms(query) }
            }.onSuccess {
                roomResults = it
                searchState = UiState.Success(it)
            }.onFailure {
                searchState = UiState.Error(it.message ?: "Search failed", it)
            }
        }
    }
}
