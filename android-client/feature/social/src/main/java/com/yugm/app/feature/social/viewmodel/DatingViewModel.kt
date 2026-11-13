package com.yugm.app.feature.social.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.yugm.app.core.api.IYugmApi
import com.yugm.app.core.model.Host
import com.yugm.app.core.util.UiState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject
import timber.log.Timber

@HiltViewModel
class DatingViewModel @Inject constructor(
    private val yugmApi: IYugmApi
) : ViewModel() {

    var candidates by mutableStateOf<List<Host>>(emptyList())
        private set

    var matches by mutableStateOf<List<Host>>(emptyList())
        private set

    var isLoading by mutableStateOf(false)
        private set

    var datingState by mutableStateOf<UiState<List<Host>>>(UiState.Idle)
        private set

    var error by mutableStateOf<String?>(null)
        private set

    var activeFilters by mutableStateOf<Set<String>>(emptySet())
        private set

    private val _matchEvent = MutableSharedFlow<Host>()
    val matchEvent = _matchEvent.asSharedFlow()

    fun toggleFilter(key: String) {
        activeFilters = if (activeFilters.contains(key)) {
            activeFilters - key
        } else {
            activeFilters + key
        }
    }

    fun loadCandidates(token: String) {
        viewModelScope.launch {
            isLoading = true
            datingState = UiState.Loading
            error = null
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.datingExplore(token, activeFilters) }
            }.onSuccess {
                candidates = it
                datingState = UiState.Success(it)
            }.onFailure {
                error = it.message ?: "Failed to load discovery profiles"
                datingState = UiState.Error(error!!)
            }
            isLoading = false
        }
    }

    fun like(token: String, candidate: Host, type: String = "LIKE") {
        viewModelScope.launch {
            candidates = candidates.filter { it.id != candidate.id }
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.datingLike(token, candidate.id, type) }
            }.onSuccess { (isMatch, matchId) ->
                if (isMatch) {
                    _matchEvent.emit(candidate)
                }
            }.onFailure {
                Timber.tag("DatingViewModel").e(it, "Failed to like user")
            }
        }
    }

    fun pass(token: String, likedId: String) {
        viewModelScope.launch {
            candidates = candidates.filter { it.id != likedId }
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.datingPass(token, likedId) }
            }.onFailure {
                Timber.tag("DatingViewModel").e(it, "Failed to pass user")
            }
        }
    }

    fun loadMatches(token: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.datingMatches(token) }
            }.onSuccess {
                matches = it
            }.onFailure {
                error = it.message ?: "Failed to load matches"
            }
            isLoading = false
        }
    }
}
