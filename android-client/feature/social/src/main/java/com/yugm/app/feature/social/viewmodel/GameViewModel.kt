package com.yugm.app.feature.social.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.yugm.app.core.api.IYugmApi
import com.yugm.app.core.model.Clan
import com.yugm.app.core.model.DailyGameMission
import com.yugm.app.core.model.GameCatalog
import com.yugm.app.core.model.GameChallenges
import com.yugm.app.core.model.GameLeaderboard
import com.yugm.app.core.model.GameMissions
import com.yugm.app.core.model.Host
import com.yugm.app.core.model.MiniGameChallenge
import com.yugm.app.core.model.SavedGameScoreResult
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

@HiltViewModel
class GameViewModel @Inject constructor(
    private val yugmApi: IYugmApi
) : ViewModel() {

    var catalog by mutableStateOf<GameCatalog?>(null)
        private set
    var missions by mutableStateOf<List<DailyGameMission>>(emptyList())
        private set
    var challenges by mutableStateOf<GameChallenges?>(null)
        private set
    var closeFriends by mutableStateOf<List<Host>>(emptyList())
        private set
    var myClan by mutableStateOf<Clan?>(null)
        private set
    var leaderboard by mutableStateOf<GameLeaderboard?>(null)
        private set
    var selectedGameId by mutableStateOf("")
        private set
    var isLoading by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
        private set

    fun refresh(token: String) {
        viewModelScope.launch {
            isLoading = true
            error = null
            withContext(Dispatchers.IO) {
                runCatching {
                    val loadedCatalog = yugmApi.gameCatalog(token)
                    catalog = loadedCatalog
                    missions = yugmApi.gameMissions(token).missions
                    challenges = yugmApi.gameChallenges(token)
                    closeFriends = yugmApi.closeFriends(token)
                    myClan = yugmApi.myClan(token)
                    if (selectedGameId.isNotBlank()) {
                        leaderboard = yugmApi.gameLeaderboard(token, selectedGameId)
                    }
                }.onFailure { error = it.message ?: "Could not load arcade" }
            }
            isLoading = false
        }
    }

    fun selectGame(token: String, gameId: String) {
        selectedGameId = gameId
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.gameLeaderboard(token, gameId) }
                    .onSuccess { leaderboard = it }
                    .onFailure { error = it.message ?: "Failed to load leaderboard" }
            }
        }
    }

    fun submitScore(token: String, gameId: String, score: Int, durationMs: Int? = null, rounds: Int? = null, onResult: (SavedGameScoreResult) -> Unit = {}) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.submitGameScore(token, gameId, score, durationMs, rounds) }
                    .onSuccess { onResult(it) }
                    .onFailure { error = it.message }
            }
        }
    }

    fun shareScore(token: String, scoreId: String, targetUserId: String) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.shareGameScore(token, scoreId, targetUserId) }
            }
        }
    }

    fun sendChallenge(token: String, gameId: String, score: Int, scoreId: String, targetUserId: String? = null, clanId: String? = null, message: String? = null, onResult: (MiniGameChallenge) -> Unit = {}) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.sendGameChallenge(token, gameId, score, scoreId, targetUserId, clanId, message) }
                    .onSuccess { onResult(it) }
                    .onFailure { error = it.message }
            }
        }
    }
}
