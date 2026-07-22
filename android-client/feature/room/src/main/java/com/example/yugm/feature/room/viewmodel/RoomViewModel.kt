package com.example.yugm.feature.room.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.yugm.core.api.IYugmApi
import com.example.yugm.core.api.YugmMediaRoom
import com.example.yugm.core.api.YugmSocket
import com.example.yugm.core.data.SessionManager
import com.example.yugm.core.model.ChatMessage
import com.example.yugm.core.model.CosmeticCatalog
import com.example.yugm.core.model.FeedResponse
import com.example.yugm.core.model.GiftItem
import com.example.yugm.core.model.Host
import com.example.yugm.core.model.PkBattle
import com.example.yugm.core.model.PkBattleType
import com.example.yugm.core.model.Room
import com.example.yugm.core.model.PkInvite
import com.example.yugm.core.model.PkLeaderboardEntry
import com.example.yugm.core.model.PkLiveEffect
import com.example.yugm.core.model.PkMediaSession
import com.example.yugm.core.model.PkMode
import com.example.yugm.core.model.PkOpponent
import com.example.yugm.core.model.PkSideType
import com.example.yugm.core.model.PkStatus
import com.example.yugm.core.model.RoomActivityItem
import com.example.yugm.core.model.RoomDetail
import com.example.yugm.core.model.RoomMission
import com.example.yugm.core.model.RoomPoll
import com.example.yugm.core.model.RoomType
import com.example.yugm.core.model.SupportTicket
import com.example.yugm.core.model.WatchParty
import com.example.yugm.core.util.UiState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlin.time.Duration.Companion.milliseconds
import javax.inject.Inject

@HiltViewModel
class RoomViewModel @Inject constructor(
    private val yugmApi: IYugmApi,
    private val sessionManager: SessionManager
) : ViewModel() {

    var roomDetail by mutableStateOf<RoomDetail?>(null)
        private set

    var polls by mutableStateOf<List<RoomPoll>>(emptyList())
        private set

    var missions by mutableStateOf<List<RoomMission>>(emptyList())
        private set

    var activity by mutableStateOf<List<RoomActivityItem>>(emptyList())
        private set

    val chat = mutableStateListOf<ChatMessage>()

    val gifts = mutableStateListOf<GiftItem>()

    var inviteCandidates by mutableStateOf<List<Host>>(emptyList())
        private set

    var pkBattle by mutableStateOf<PkBattle?>(null)
        private set

    var pkInviteId by mutableStateOf<String?>(null)
        private set

    var pkOpponents by mutableStateOf<List<PkOpponent>>(emptyList())
        private set

    var pkLeaderboard by mutableStateOf<List<PkLeaderboardEntry>>(emptyList())
        private set

    var pkLiveEffect by mutableStateOf<PkLiveEffect?>(null)
        private set

    var pkOpponentMedia by mutableStateOf<PkMediaSession?>(null)
        private set

    var isConnected by mutableStateOf(false)
        private set

    var roomState by mutableStateOf<UiState<RoomDetail>>(UiState.Idle)
        private set

    var rooms by mutableStateOf<List<Room>>(emptyList())
        private set
    var isLoading by mutableStateOf(false)
        private set
    var cosmeticCatalog by mutableStateOf<CosmeticCatalog?>(null)
        private set
    var watchParty by mutableStateOf<WatchParty?>(null)
        private set
    var cosmeticError by mutableStateOf<String?>(null)
        private set
    var roomError by mutableStateOf<String?>(null)
        private set
    var actionLoading by mutableStateOf(false)
        private set
    var actionError by mutableStateOf<String?>(null)
        private set

    fun clearActionError() {
        actionError = null
    }

    private var authToken: String = ""
    private var roomId: String = ""
    private var currentUserId: String = ""
    private var isVideo: Boolean = false

    fun connect(token: String, roomId: String, userId: String, video: Boolean = false) {
        this.authToken = token
        this.roomId = roomId
        this.currentUserId = userId
        this.isVideo = video
        refresh()
    }

    fun disconnect() {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                runCatching { YugmSocket.disconnect() }
                runCatching { YugmMediaRoom.disconnect() }
            }
            isConnected = false
        }
    }

    fun refresh() {
        viewModelScope.launch {
            roomState = UiState.Loading
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.roomDetail(authToken, roomId) }
                    .onSuccess { roomDetail = it; roomState = UiState.Success(it) }
                runCatching { yugmApi.roomPolls(roomId) }
                    .onSuccess { polls = it }
                runCatching { yugmApi.roomMissions(authToken, roomId) }
                    .onSuccess { missions = it }
                runCatching { yugmApi.roomActivity(roomId) }
                    .onSuccess { activity = it }
                runCatching { yugmApi.roomMessages(roomId, authToken) }
                    .onSuccess {
                        chat.clear(); chat.addAll(it)
                    }
                runCatching { yugmApi.gifts(authToken) }
                    .onSuccess {
                        gifts.clear(); gifts.addAll(it)
                    }
                if (currentUserId.isNotBlank()) {
                    runCatching { yugmApi.getFollowing(currentUserId, authToken) }
                        .onSuccess { inviteCandidates = it }
                }
                runCatching { yugmApi.activePkWithInvite(authToken, roomId) }
                    .onSuccess { (battle, invite) ->
                        pkBattle = battle
                        pkInviteId = invite?.id
                        if (battle != null) {
                            runCatching { yugmApi.pkLeaderboard(authToken, battle.id) }
                                .onSuccess { pkLeaderboard = it }
                            if (isVideo && battle.status == PkStatus.ACTIVE && battle.battleType == PkBattleType.VIDEO) {
                                runCatching { yugmApi.pkMediaSession(authToken, battle.id, roomId) }
                                    .onSuccess {
                                        pkOpponentMedia = it
                                        it?.let { YugmMediaRoom.connectOpponent(it.token, it.url, it.roomName) }
                                    }
                            }
                        } else {
                            pkLeaderboard = emptyList()
                            pkOpponentMedia = null
                        }
                    }
            }
        }
    }

    fun join() {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                runCatching {
                    yugmApi.joinRoom(authToken, roomId)
                    val mediaSession = yugmApi.liveKitToken(authToken, roomId)
                    YugmMediaRoom.connect(mediaSession.token, mediaSession.url)
                    YugmSocket.connect(
                        token = authToken,
                        roomId = roomId,
                        onMessage = { author, text -> chat.add(ChatMessage(author, text)) },
                        onPkState = { battle ->
                            launch {
                                pkBattle = battle
                                if (battle.status == PkStatus.ACTIVE) pkInviteId = null
                                runCatching { yugmApi.pkLeaderboard(authToken, battle.id) }
                                    .onSuccess { pkLeaderboard = it }
                                if (isVideo && battle.status == PkStatus.ACTIVE && battle.battleType == PkBattleType.VIDEO) {
                                    runCatching { yugmApi.pkMediaSession(authToken, battle.id, roomId) }
                                        .onSuccess {
                                            pkOpponentMedia = it
                                            it?.let { YugmMediaRoom.connectOpponent(it.token, it.url, it.roomName) }
                                        }
                                }
                            }
                        },
                        onPkInvite = { battle, invite ->
                            launch {
                                pkBattle = battle
                                pkInviteId = invite.id
                            }
                        },
                        onPkEffect = { effect ->
                            launch {
                                pkLiveEffect = effect
                                delay(1400.milliseconds)
                                if (pkLiveEffect == effect) pkLiveEffect = null
                            }
                        },
                        onPkRefresh = { refresh() },
                        onPkLeadChanged = { leader, leftScore, rightScore ->
                            launch {
                                val current = pkBattle ?: return@launch
                                pkBattle = current.copy(
                                    leader = PkSideType.valueOf(leader),
                                    left = current.left.copy(score = leftScore),
                                    right = current.right.copy(score = rightScore)
                                )
                            }
                        },
                        onPkRematchRequested = { refresh() }
                    )
                    isConnected = true
                }
            }
            refresh()
        }
    }

    fun sendMessage(text: String) {
        viewModelScope.launch {
            actionLoading = true
            actionError = null
            withContext(Dispatchers.IO) {
                runCatching {
                    yugmApi.sendMessage(authToken, roomId, text)
                    chat.add(ChatMessage(sessionManager.userName, text))
                }.onFailure {
                    actionError = it.message ?: "Failed to send message"
                }
            }
            actionLoading = false
        }
    }

    fun sendGift(gift: GiftItem, receiverId: String) {
        viewModelScope.launch {
            actionLoading = true
            actionError = null
            withContext(Dispatchers.IO) {
                runCatching {
                    yugmApi.sendGift(token = authToken, roomId = roomId, gift = gift, receiverId = receiverId)
                }.onSuccess {
                    runCatching { sessionManager.balance = yugmApi.wallet(authToken) }
                    gifts.add(gift)
                }.onFailure {
                    actionError = it.message ?: "Failed to send gift"
                }
            }
            actionLoading = false
        }
    }

    fun requestSpeaker() {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.requestSpeaker(authToken, roomId) }.onSuccess { refresh() }
            }
        }
    }

    fun approveSpeaker(userId: String) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.approveSpeaker(authToken, roomId, userId) }.onSuccess { refresh() }
            }
        }
    }

    fun rejectSpeaker(userId: String) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.rejectSpeaker(authToken, roomId, userId) }.onSuccess { refresh() }
            }
        }
    }

    fun createPoll(question: String, options: List<String>) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.createPoll(authToken, roomId, question, options) }.onSuccess { refresh() }
            }
        }
    }

    fun votePoll(pollId: String, optionIndex: Int) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.votePoll(authToken, roomId, pollId, optionIndex) }.onSuccess { refresh() }
            }
        }
    }

    fun inviteToRoom(userId: String) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.inviteToRoom(authToken, roomId, userId) }
            }
        }
    }

    fun reactToRoom(type: String) {
        viewModelScope.launch {
            actionLoading = true
            actionError = null
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.reactToRoom(authToken, roomId, type) }
                    .onFailure { actionError = it.message ?: "Failed to react" }
            }
            actionLoading = false
        }
    }

    fun loadPkOpponents(battleType: PkBattleType, search: String = "") {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.availablePkOpponents(authToken, battleType, search) }
                    .onSuccess { pkOpponents = it }
            }
        }
    }

    fun invitePk(opponent: PkOpponent, mode: PkMode, duration: Int, title: String) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                runCatching {
                    yugmApi.invitePk(
                        token = authToken, roomId = roomId,
                        opponentRoomId = opponent.roomId, opponentHostId = opponent.hostId,
                        battleType = if (isVideo) PkBattleType.VIDEO else PkBattleType.VOICE,
                        mode = mode, durationSeconds = duration, title = title
                    )
                }.onSuccess { (battle, _) -> pkBattle = battle }
            }
        }
    }

    fun autoMatchPk(mode: PkMode, duration: Int, title: String) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                runCatching {
                    yugmApi.autoMatchPk(
                        token = authToken, roomId = roomId,
                        battleType = if (isVideo) PkBattleType.VIDEO else PkBattleType.VOICE,
                        mode = mode, durationSeconds = duration, title = title
                    )
                }.onSuccess { (battle, invite) ->
                    pkBattle = battle
                    pkInviteId = invite?.id
                }
            }
        }
    }

    fun sendPkGift(giftId: String, side: PkSideType) {
        viewModelScope.launch {
            val battleId = pkBattle?.id ?: return@launch
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.sendPkGift(authToken, battleId, giftId, side) }
                    .onSuccess {
                        pkBattle = it
                        sessionManager.balance = yugmApi.wallet(authToken)
                    }
            }
        }
    }

    fun sendPkReaction(reaction: String, side: PkSideType) {
        viewModelScope.launch {
            val battleId = pkBattle?.id ?: return@launch
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.sendPkReaction(authToken, battleId, side, reaction) }
                    .onSuccess { pkBattle = it }
            }
        }
    }

    fun acceptPk(inviteId: String) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.acceptPk(authToken, inviteId) }
                    .onSuccess {
                        pkBattle = it
                        pkInviteId = null; refresh()
                    }
            }
        }
    }

    fun rejectPk(inviteId: String) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.rejectPk(authToken, inviteId) }
                    .onSuccess { pkBattle = null; pkInviteId = null; refresh() }
            }
        }
    }

    fun endPk() {
        viewModelScope.launch {
            val battleId = pkBattle?.id ?: return@launch
            val battle = pkBattle
            withContext(Dispatchers.IO) {
                if (battle?.status == PkStatus.INVITED || battle?.status == PkStatus.WAITING) {
                    runCatching { yugmApi.cancelPk(authToken, battleId) }
                        .onSuccess { pkBattle = null; pkInviteId = null; pkOpponentMedia = null }
                } else {
                    runCatching { yugmApi.endPk(authToken, battleId) }
                        .onSuccess { pkBattle = it; pkInviteId = null; pkOpponentMedia = null }
                }
            }
        }
    }

    fun updateRoom(room: Room, coverImage: String? = null, onSuccess: () -> Unit = {}, onFailure: (String) -> Unit = {}) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.updateRoom(authToken, roomId, room, coverImage) }
                    .onSuccess { onSuccess() }
                    .onFailure { onFailure(it.message ?: "Update failed") }
            }
        }
    }

    fun endRoom() {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.endRoom(roomId, authToken) }
            }
        }
    }

    fun muteUser(userId: String) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.muteUser(roomId, userId, authToken) }.onSuccess { refresh() }
            }
        }
    }

    fun removeUser(userId: String) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.removeUser(roomId, userId, authToken) }.onSuccess { refresh() }
            }
        }
    }

    fun reportUser(userId: String, reason: String = "Inappropriate behavior") {
        viewModelScope.launch {
            actionLoading = true
            actionError = null
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.reportUser(authToken, roomId, userId, reason) }
                    .onFailure { actionError = it.message ?: "Failed to report user" }
            }
            actionLoading = false
        }
    }

    fun loadRooms(token: String, type: RoomType? = null) {
        viewModelScope.launch {
            isLoading = true
            rooms = withContext(Dispatchers.IO) { yugmApi.rooms(type) }
            isLoading = false
        }
    }

    fun loadScheduledRooms(token: String) {
        viewModelScope.launch {
            isLoading = true
            rooms = withContext(Dispatchers.IO) { yugmApi.scheduledRooms() }
            isLoading = false
        }
    }

    fun loadCosmetics(token: String) {
        viewModelScope.launch {
            isLoading = true
            cosmeticError = null
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.cosmetics(token) }
            }.onSuccess { cosmeticCatalog = it }
                .onFailure { cosmeticError = it.message }
            isLoading = false
        }
    }

    suspend fun uploadCoverSuspend(token: String, bytes: ByteArray, mimeType: String, fileName: String): String {
        return withContext(Dispatchers.IO) { yugmApi.uploadCover(token, bytes, mimeType, fileName) }
    }

    fun createRoom(
        token: String,
        room: Room,
        visibility: String = "PUBLIC",
        allowMicRequests: Boolean = true,
        scheduledFor: String? = null,
        coverImage: String? = null,
        onSuccess: (Room) -> Unit = {},
        onError: (String) -> Unit = {}
    ) {
        viewModelScope.launch {
            isLoading = true
            runCatching {
                withContext(Dispatchers.IO) {
                    yugmApi.createRoom(token, room, visibility, allowMicRequests, scheduledFor, coverImage)
                }
            }.onSuccess { onSuccess(it) }
                .onFailure { onError(it.message ?: "Creation failed") }
            isLoading = false
        }
    }

    fun searchRooms(query: String) {
        viewModelScope.launch {
            isLoading = true
            rooms = withContext(Dispatchers.IO) { yugmApi.searchRooms(query) }
            isLoading = false
        }
    }

    fun loadWatchParty(token: String, roomId: String) {
        viewModelScope.launch {
            isLoading = true
            watchParty = withContext(Dispatchers.IO) { yugmApi.watchPartyGet(token, roomId) }
            isLoading = false
        }
    }

    fun syncWatchParty(token: String, roomId: String, position: Double, isPlaying: Boolean) {
        viewModelScope.launch {
            watchParty = withContext(Dispatchers.IO) { yugmApi.watchPartySync(token, roomId, position, isPlaying) }
        }
    }

    fun stopWatchParty(token: String, roomId: String) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) { yugmApi.watchPartyStop(token, roomId) }
        }
    }

    fun roomDirectMessage(token: String, roomId: String, message: String, receiverId: String? = null) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) { yugmApi.roomDirectMessage(token, roomId, message, receiverId) }
        }
    }

    override fun onCleared() {
        disconnect()
        super.onCleared()
    }
}
