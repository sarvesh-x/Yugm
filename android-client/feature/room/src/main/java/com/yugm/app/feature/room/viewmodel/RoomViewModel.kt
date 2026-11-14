package com.yugm.app.feature.room.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.yugm.app.core.api.IYugmApi
import com.yugm.app.core.api.YugmMediaRoom
import com.yugm.app.core.api.YugmSocket
import com.yugm.app.core.data.SessionManager
import com.yugm.app.core.model.ChatMessage
import com.yugm.app.core.model.CosmeticCatalog
import com.yugm.app.core.model.FeedResponse
import com.yugm.app.core.model.GiftItem
import com.yugm.app.core.model.Host
import com.yugm.app.core.model.PkBattle
import com.yugm.app.core.model.PkBattleType
import com.yugm.app.core.model.Room
import com.yugm.app.core.model.PkInvite
import com.yugm.app.core.model.PkLeaderboardEntry
import com.yugm.app.core.model.PkLiveEffect
import com.yugm.app.core.model.PkMediaSession
import com.yugm.app.core.model.PkMode
import com.yugm.app.core.model.PkOpponent
import com.yugm.app.core.model.PkSideType
import com.yugm.app.core.model.PkStatus
import com.yugm.app.core.model.RoomActivityItem
import com.yugm.app.core.model.RoomDetail
import com.yugm.app.core.model.RoomMission
import com.yugm.app.core.model.RoomPoll
import com.yugm.app.core.model.RoomType
import com.yugm.app.core.model.SupportTicket
import com.yugm.app.core.model.WatchParty
import com.yugm.app.core.util.UiState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
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

    var diamondBalance by mutableStateOf(0)
        private set

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
    var forcedMuteVersion by mutableStateOf(0)
        private set
    var forcedRemoveVersion by mutableStateOf(0)
        private set
    var roomEndedVersion by mutableStateOf(0)
        private set
    var roomReactionEvent by mutableStateOf(0 to "")
        private set

    var roomState by mutableStateOf<UiState<RoomDetail>>(UiState.Idle)
        private set

    var rooms by mutableStateOf<List<Room>>(emptyList())
        private set
    var isLoading by mutableStateOf(false)
        private set
    var isRoomListLoading by mutableStateOf(false)
        private set
    var cosmeticCatalog by mutableStateOf<CosmeticCatalog?>(null)
        private set
    var watchParty by mutableStateOf<WatchParty?>(null)
        private set
    var cosmeticError by mutableStateOf<String?>(null)
        private set
    var roomError by mutableStateOf<String?>(null)
        private set
    var roomListError by mutableStateOf<String?>(null)
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
    private var realtimeRefreshJob: Job? = null

    fun connect(token: String, roomId: String, userId: String, video: Boolean = false) {
        this.authToken = token
        this.roomId = roomId
        this.currentUserId = userId
        this.isVideo = video
        refresh()
    }

    fun disconnect() {
        viewModelScope.launch {
            closeMediaConnections()
        }
    }

    fun leaveAndDisconnect(onComplete: () -> Unit) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) { runCatching { yugmApi.leaveRoom(authToken, roomId) } }
            closeMediaConnections()
            onComplete()
        }
    }

    fun endRoomAndDisconnect(onComplete: () -> Unit) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) { runCatching { yugmApi.endRoom(roomId, authToken) } }
            closeMediaConnections()
            onComplete()
        }
    }

    private suspend fun closeMediaConnections() {
        withContext(Dispatchers.IO) {
            runCatching { YugmSocket.disconnect() }
            runCatching { YugmMediaRoom.disconnect() }
        }
        isConnected = false
    }

    fun refresh() {
        viewModelScope.launch {
            roomState = UiState.Loading
            val detailResult = withContext(Dispatchers.IO) { runCatching { yugmApi.roomDetail(authToken, roomId) } }
            detailResult.onSuccess {
                roomDetail = it
                roomError = null
                roomState = UiState.Success(it)
            }.onFailure { error ->
                roomError = error.message ?: "Couldn't open this room."
                roomState = UiState.Error(roomError!!, error)
            }
            val pollsResult = withContext(Dispatchers.IO) { runCatching { yugmApi.roomPolls(roomId) } }
            pollsResult.onSuccess { polls = it }
            val missionsResult = withContext(Dispatchers.IO) { runCatching { yugmApi.roomMissions(authToken, roomId) } }
            missionsResult.onSuccess { missions = it }
            val activityResult = withContext(Dispatchers.IO) { runCatching { yugmApi.roomActivity(roomId) } }
            activityResult.onSuccess { activity = it }
            val messagesResult = withContext(Dispatchers.IO) { runCatching { yugmApi.roomMessages(roomId, authToken) } }
            messagesResult.onSuccess {
                mergeChat(it)
            }
            val giftsResult = withContext(Dispatchers.IO) { runCatching { yugmApi.gifts(authToken) } }
            giftsResult.onSuccess {
                gifts.clear(); gifts.addAll(it)
            }
            runCatching { withContext(Dispatchers.IO) { yugmApi.walletOverview(authToken).diamondBalance } }
                .onSuccess { diamondBalance = it }
            if (currentUserId.isNotBlank()) {
                val followingResult = withContext(Dispatchers.IO) { runCatching { yugmApi.getFollowing(currentUserId, authToken) } }
                followingResult.onSuccess { inviteCandidates = it }
            }
            val pkResult = withContext(Dispatchers.IO) { runCatching { yugmApi.activePkWithInvite(authToken, roomId) } }
            pkResult.onSuccess { (battle, invite) ->
                pkBattle = battle
                pkInviteId = invite?.id
                if (battle != null) {
                    viewModelScope.launch {
                        val leaderboardResult = withContext(Dispatchers.IO) { runCatching { yugmApi.pkLeaderboard(authToken, battle.id) } }
                        leaderboardResult.onSuccess { pkLeaderboard = it }
                        if (isVideo && battle.status == PkStatus.ACTIVE && battle.battleType == PkBattleType.VIDEO) {
                            val mediaResult = withContext(Dispatchers.IO) { runCatching { yugmApi.pkMediaSession(authToken, battle.id, roomId) } }
                            mediaResult.onSuccess {
                                pkOpponentMedia = it
                                it?.let { YugmMediaRoom.connectOpponent(it.token, it.url, it.roomName) }
                            }
                        }
                    }
                } else {
                    pkLeaderboard = emptyList()
                    pkOpponentMedia = null
                }
            }
        }
    }

    fun join() = joinInternal()

    fun joinVideo(publishCamera: Boolean, publishMicrophone: Boolean) = joinInternal(publishCamera, publishMicrophone)

    private fun joinInternal(cameraPermissionGranted: Boolean? = null, microphonePermissionGranted: Boolean? = null) {
        viewModelScope.launch {
            val result = withContext(Dispatchers.IO) {
                runCatching {
                    yugmApi.joinRoom(authToken, roomId)
                    val mediaSession = yugmApi.liveKitToken(authToken, roomId)
                    val isHostVideoRoom = isVideo && roomDetail?.room?.host?.id == currentUserId
                    YugmMediaRoom.connect(
                        mediaSession.token,
                        mediaSession.url,
                        publishCamera = cameraPermissionGranted ?: isHostVideoRoom,
                        publishMicrophone = microphonePermissionGranted ?: isHostVideoRoom
                    )
                    YugmSocket.connect(
                        // API calls above may have rotated an expired access token.
                        // Read the session source of truth for Socket.IO too; the
                        // navigation argument can still hold the pre-refresh token.
                        token = sessionManager.authToken.takeIf { it.isNotBlank() } ?: authToken,
                        roomId = roomId,
                        onMessage = { message ->
                            viewModelScope.launch { mergeChat(listOf(message)) }
                        },
                        onPkState = { battle ->
                            viewModelScope.launch {
                                pkBattle = battle
                                if (battle.status == PkStatus.ACTIVE) pkInviteId = null
                                val leaderboardResult = withContext(Dispatchers.IO) { runCatching { yugmApi.pkLeaderboard(authToken, battle.id) } }
                                leaderboardResult.onSuccess { pkLeaderboard = it }
                                if (isVideo && battle.status == PkStatus.ACTIVE && battle.battleType == PkBattleType.VIDEO) {
                                    val mediaResult = withContext(Dispatchers.IO) { runCatching { yugmApi.pkMediaSession(authToken, battle.id, roomId) } }
                                    mediaResult.onSuccess {
                                        pkOpponentMedia = it
                                        it?.let { YugmMediaRoom.connectOpponent(it.token, it.url, it.roomName) }
                                    }
                                }
                            }
                        },
                        onPkInvite = { battle, invite ->
                            viewModelScope.launch {
                                pkBattle = battle
                                pkInviteId = invite.id
                            }
                        },
                        onPkEffect = { effect ->
                            viewModelScope.launch {
                                pkLiveEffect = effect
                                delay(1400.milliseconds)
                                if (pkLiveEffect == effect) pkLiveEffect = null
                            }
                        },
                        onPkRefresh = { refresh() },
                        onPkLeadChanged = { leader, leftScore, rightScore ->
                            viewModelScope.launch {
                                val current = pkBattle ?: return@launch
                                pkBattle = current.copy(
                                    leader = PkSideType.valueOf(leader),
                                    left = current.left.copy(score = leftScore),
                                    right = current.right.copy(score = rightScore)
                                )
                            }
                        },
                        onPkRematchRequested = { refresh() },
                        onRoomReaction = { type, _, _ ->
                            viewModelScope.launch { roomReactionEvent = (roomReactionEvent.first + 1) to type }
                        },
                        onSpeakerApproved = { approvedUserId ->
                            if (approvedUserId == currentUserId) {
                                scheduleRealtimeRefresh("room:speaker:approve")
                                refreshMediaSession(enableMicrophone = true)
                            }
                        },
                        onUserMuted = { targetId ->
                            if (targetId == currentUserId) {
                                viewModelScope.launch {
                                    YugmMediaRoom.setMicEnabled(false)
                                    forcedMuteVersion++
                                }
                            }
                        },
                        onUserRemoved = { targetId ->
                            if (targetId == currentUserId) {
                                viewModelScope.launch { forcedRemoveVersion++ }
                            }
                        },
                        onRoomParticipantChanged = { action, targetId ->
                            scheduleRealtimeRefresh("room:participant:update")
                            if (action == "removed" && targetId == currentUserId) {
                                viewModelScope.launch { forcedRemoveVersion++ }
                            }
                        },
                        onRoomDataChanged = { event -> scheduleRealtimeRefresh(event) }
                    )
                }
            }
            if (result.isSuccess) {
                isConnected = true
            }
            refresh()
        }
    }

    fun sendMessage(text: String) {
        viewModelScope.launch {
            actionLoading = true
            actionError = null
            val result = withContext(Dispatchers.IO) {
                runCatching {
                    yugmApi.sendMessage(authToken, roomId, text)
                }
            }
            result.onSuccess {
                mergeChat(listOf(it))
            }.onFailure {
                actionError = it.message ?: "Failed to send message"
            }
            actionLoading = false
        }
    }

    fun sendGift(gift: GiftItem, receiverId: String, currency: String = "COINS") {
        viewModelScope.launch {
            actionLoading = true
            actionError = null
            val result = withContext(Dispatchers.IO) {
                runCatching {
                    yugmApi.sendGift(token = authToken, roomId = roomId, gift = gift, receiverId = receiverId, currency = currency)
                }
            }
            result.onSuccess {
                viewModelScope.launch {
                    runCatching {
                        val overview = withContext(Dispatchers.IO) { yugmApi.walletOverview(authToken) }
                        sessionManager.balance = overview.balance
                        diamondBalance = overview.diamondBalance
                    }
                }
                gifts.add(gift)
            }.onFailure {
                actionError = it.message ?: "Failed to send gift"
            }
            actionLoading = false
        }
    }

    fun requestSpeaker() {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.requestSpeaker(authToken, roomId) }.onSuccess { scheduleRealtimeRefresh("room:speaker:request") }
            }
        }
    }

    fun takeSeat(seatIndex: Int) {
        viewModelScope.launch {
            actionError = null
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.takeRoomSeat(authToken, roomId, seatIndex) }
                    .onSuccess { scheduleRealtimeRefresh("room:speaker:approve") }
                    .onFailure { actionError = it.message ?: "Could not take the seat" }
            }
        }
    }

    fun setSeatLocked(seatIndex: Int, locked: Boolean) {
        viewModelScope.launch {
            actionError = null
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.setRoomSeatLocked(roomId, seatIndex, locked, authToken) }
                    .onFailure { actionError = it.message ?: "Could not update this mic seat" }
            }
            if (actionError == null) scheduleRealtimeRefresh("room:participant:update")
        }
    }

    fun followRoomUser(userId: String) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.followUser(authToken, userId) }
                    .onFailure { actionError = it.message ?: "Could not follow this user" }
            }
        }
    }

    fun unfollowRoomUser(userId: String) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.unfollowUser(authToken, userId) }
                    .onFailure { actionError = it.message ?: "Could not unfollow this user" }
            }
        }
    }

    fun setMicLocked(locked: Boolean) {
        viewModelScope.launch {
            actionError = null
            actionLoading = true
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.setRoomMicLocked(roomId, locked, authToken) }
                    .onFailure { actionError = it.message ?: "Could not update the mic lock" }
            }
            actionLoading = false
            if (actionError == null) scheduleRealtimeRefresh("room:participant:update")
        }
    }

    fun inviteSpeaker(userId: String) {
        viewModelScope.launch {
            actionError = null
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.inviteSpeaker(authToken, roomId, userId) }
                    .onSuccess { scheduleRealtimeRefresh("room:speaker:approve") }
                    .onFailure { actionError = it.message ?: "Could not invite this listener to speak" }
            }
        }
    }

    fun removeSpeaker(userId: String) {
        viewModelScope.launch {
            actionError = null
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.removeSpeaker(authToken, roomId, userId) }
                    .onSuccess { scheduleRealtimeRefresh("room:participant:update") }
                    .onFailure { actionError = it.message ?: "Could not remove this speaker from the seat" }
            }
        }
    }

    private fun mergeChat(incoming: List<ChatMessage>) {
        val merged = (chat.toList() + incoming)
            .distinctBy { message ->
                if (message.id.isNotBlank()) "id:${message.id}"
                else "legacy:${message.authorId}:${message.author}:${message.text}:${message.createdAt}"
            }
            .takeLast(250)
        chat.clear()
        chat.addAll(merged)
    }

    private fun scheduleRealtimeRefresh(event: String) {
        viewModelScope.launch {
            if (event == "room:ended") {
                roomEndedVersion++
                return@launch
            }
            realtimeRefreshJob?.cancel()
            realtimeRefreshJob = launch {
                delay(180)
                val shouldRefreshDetail = event in setOf(
                    "room:participant:update", "room:speaker:request", "room:speaker:approve",
                    "room:speaker:reject", "room:user:mute", "room:user:remove", "room:gift:send"
                )
                if (shouldRefreshDetail) {
                    withContext(Dispatchers.IO) { runCatching { yugmApi.roomDetail(authToken, roomId) } }
                        .onSuccess { roomDetail = it; roomState = UiState.Success(it) }
                }
                if (event.startsWith("room:poll:")) {
                    withContext(Dispatchers.IO) { runCatching { yugmApi.roomPolls(roomId) } }.onSuccess { polls = it }
                }
                if (event == "room:activity:new" || event == "room:gift:send") {
                    withContext(Dispatchers.IO) { runCatching { yugmApi.roomActivity(roomId) } }.onSuccess { activity = it }
                }
            }
        }
    }

    private fun refreshMediaSession(enableMicrophone: Boolean = false) {
        viewModelScope.launch {
            runCatching {
                withContext(Dispatchers.IO) { yugmApi.liveKitToken(authToken, roomId) }
            }.onSuccess {
                val isHostVideoRoom = isVideo && roomDetail?.room?.host?.id == currentUserId
                YugmMediaRoom.connect(
                    it.token,
                    it.url,
                    publishCamera = isHostVideoRoom,
                    publishMicrophone = enableMicrophone || YugmMediaRoom.isMicEnabled()
                )
            }
                .onFailure { actionError = it.message ?: "Could not enable room audio" }
        }
    }

    fun approveSpeaker(userId: String) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.approveSpeaker(authToken, roomId, userId) }.onSuccess { scheduleRealtimeRefresh("room:speaker:approve") }
            }
        }
    }

    fun rejectSpeaker(userId: String) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.rejectSpeaker(authToken, roomId, userId) }.onSuccess { scheduleRealtimeRefresh("room:speaker:reject") }
            }
        }
    }

    fun createPoll(question: String, options: List<String>) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.createPoll(authToken, roomId, question, options) }.onSuccess { scheduleRealtimeRefresh("room:poll:new") }
            }
        }
    }

    fun votePoll(pollId: String, optionIndex: Int) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.votePoll(authToken, roomId, pollId, optionIndex) }.onSuccess { scheduleRealtimeRefresh("room:poll:vote") }
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
                    .onFailure { actionError = "Failed to react" }
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
            val result = withContext(Dispatchers.IO) {
                runCatching { yugmApi.updateRoom(authToken, roomId, room, coverImage) }
            }
            result.onSuccess { updatedRoom ->
                roomDetail = roomDetail?.copy(room = updatedRoom)
                roomState = UiState.Success(roomDetail!!)
                onSuccess()
            }.onFailure {
                onFailure(it.message ?: "Update failed")
            }
        }
    }

    fun resetRoomRanking(onSuccess: () -> Unit = {}) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.reactToRoom(authToken, roomId, "RESET_RANKING") }
            }
            onSuccess()
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

    fun setOwnMicState(enabled: Boolean) {
        viewModelScope.launch {
            actionError = null
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.setOwnRoomMicState(roomId, enabled, authToken) }
                    .onSuccess {
                        scheduleRealtimeRefresh("room:participant:update")
                        YugmMediaRoom.setMicEnabled(enabled)
                        if (enabled) refreshMediaSession(enableMicrophone = true)
                    }
                    .onFailure { actionError = it.message ?: "Could not update microphone state" }
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

    fun setRoomAdmin(userId: String, isAdmin: Boolean) {
        viewModelScope.launch {
            actionLoading = true
            actionError = null
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.setRoomAdmin(roomId, userId, isAdmin, authToken) }
                    .onFailure { actionError = it.message ?: "Couldn't update room admin" }
            }
            actionLoading = false
            if (actionError == null) refresh()
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

    fun loadRooms(type: RoomType? = null) {
        if (isRoomListLoading) return
        viewModelScope.launch {
            isRoomListLoading = true
            roomListError = null
            runCatching { withContext(Dispatchers.IO) { yugmApi.rooms(type) } }
                .onSuccess { rooms = it }
                .onFailure { roomListError = it.message ?: "Couldn't load live rooms" }
            isRoomListLoading = false
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
