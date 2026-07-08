package com.example.yugm.ui.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.yugm.api.YugmApi
import com.example.yugm.model.Host
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class DatingViewModel @Inject constructor() : ViewModel() {

    var candidates by mutableStateOf<List<Host>>(emptyList())
        private set

    var matches by mutableStateOf<List<Host>>(emptyList())
        private set

    var isLoading by mutableStateOf(false)
        private set

    var error by mutableStateOf<String?>(null)
        private set

    // Shared flow to trigger fullscreen mutual match overlays
    private val _matchEvent = MutableSharedFlow<Host>()
    val matchEvent = _matchEvent.asSharedFlow()

    fun loadCandidates(token: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                YugmApi.datingExplore(token)
            }.onSuccess {
                candidates = it
            }.onFailure {
                error = it.message ?: "Failed to load discovery profiles"
            }
            isLoading = false
        }
    }

    fun like(token: String, candidate: Host, type: String = "LIKE") {
        viewModelScope.launch {
            // Remove candidate from list immediately for smooth swipe feel
            candidates = candidates.filter { it.id != candidate.id }
            runCatching {
                YugmApi.datingLike(token, candidate.id, type)
            }.onSuccess { (isMatch, matchId) ->
                if (isMatch) {
                    _matchEvent.emit(candidate)
                }
            }.onFailure {
                Log.e("DatingViewModel", "Failed to like user: ${it.message}")
            }
        }
    }

    fun pass(token: String, likedId: String) {
        viewModelScope.launch {
            candidates = candidates.filter { it.id != likedId }
            runCatching {
                YugmApi.datingPass(token, likedId)
            }.onFailure {
                Log.e("DatingViewModel", "Failed to pass user: ${it.message}")
            }
        }
    }

    fun loadMatches(token: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                YugmApi.datingMatches(token)
            }.onSuccess {
                matches = it
            }.onFailure {
                error = it.message ?: "Failed to load matches"
            }
            isLoading = false
        }
    }
}

// Simple Log fallback since android.util.Log is sometimes stubbed in VM tests
object Log {
    fun e(tag: String, msg: String) {
        android.util.Log.e(tag, msg)
    }
}
