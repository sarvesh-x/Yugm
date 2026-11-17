package com.yugm.app.feature.room.viewmodel

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.yugm.app.core.api.IYugmApi
import com.yugm.app.core.api.ReactionCatalogCache
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
import com.yugm.app.core.model.RoomReaction
import com.yugm.app.core.model.RoomReactionEvent
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
    var roomReactionEvent by mutableStateOf(0 to (null as RoomReactionEvent?))
        private set
    var roomGiftEvent by mutableStateOf(0 to (null as com.yugm.app.core.model.RoomGiftEvent?))
        private set

    var roomReactions by mutableStateOf<List<RoomReaction>>(emptyList())
        private set
    var isReactionCatalogLoading by mutableStateOf(false)
        private set
    var reactionCatalogError by mutableStateOf<String?>(null)
        private set
    private var reactionCatalogLoadedAt = 0L
    private var reactionCatalogJob: Job? = null

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

    private var reactionCatalogOwner = ""

    fun loadRoomReactions(force: Boolean = false) {
        val requestToken = sessionManager.authToken
        if (reactionCatalogOwner != requestToken) {
            reactionCatalogJob?.cancel()
            roomReactions = emptyList()
            reactionCatalogLoadedAt = 0L
            reactionCatalogOwner = requestToken
        }
        val now = System.currentTimeMillis()
        // A catalog is global, so avoid refetching on every picker open. Force is used
        // on room entry and from the picker's retry button. Reuse shared process-wide cache
        // (e.g. warmed by DMs) to avoid redundant network calls across features.
        val cachedFresh = ReactionCatalogCache.getIfFresh(requestToken, now)
        if (!force && cachedFresh != null) {
            roomReactions = cachedFresh
            reactionCatalogLoadedAt = ReactionCatalogCache.loadedAt(requestToken)
            reactionCatalogError = null
            return
        }
        val anyCached = ReactionCatalogCache.getAny(requestToken)
        if (anyCached.isNotEmpty() && roomReactions.isEmpty()) {
            roomReactions = anyCached
            reactionCatalogLoadedAt = ReactionCatalogCache.loadedAt(requestToken)
        }
        val minIntervalMs = if (force) 4_000L else 45_000L
        if (reactionCatalogJob?.isActive == true) return
        if (!force && roomReactions.isNotEmpty() && now - reactionCatalogLoadedAt < minIntervalMs) return
        reactionCatalogJob = viewModelScope.launch {
            isReactionCatalogLoading = true
            reactionCatalogError = null
            runCatching {
                withContext(Dispatchers.IO) {
                    yugmApi.roomReactions(requestToken.takeIf { it.isNotBlank() })
                }
            }
                .onSuccess { catalog ->
                    if (sessionManager.authToken != requestToken) return@launch
                    roomReactions = catalog
                    reactionCatalogLoadedAt = System.currentTimeMillis()
                    ReactionCatalogCache.put(requestToken, catalog)
                    reactionCatalogError = null
                }
                .onFailure { error ->
                    // Keep a previously loaded catalog on screen; only surface an error
                    // when there is nothing usable to show.
                    if (roomReactions.isEmpty()) {
                        reactionCatalogError = error.message?.takeIf { it.isNotBlank() }
                            ?: "Couldn't load reactions"
                    }
                }
            isReactionCatalogLoading = false
        }
    }

    fun reloadRoomReactions() = loadRoomReactions(force = true)

    fun clearActionError() {
        actionError = null
    }

    private var authToken: String = ""
    private var roomId: String = ""
    private var currentUserId: String = ""
    private var isVideo: Boolean = false
    private var realtimeRefreshJob: Job? = null
    private val pendingRealtimeEvents = mutableSetOf<String>()
    private var roomRecoveryJob: Job? = null

    fun connect(token: String, roomId: String, userId: String, video: Boolean = false) {
        realtimeRefreshJob?.cancel()
        pendingRealtimeEvents.clear()
        // This ViewModel can outlive a room destination. Never carry one session's
        // cached chat into the next room entry (including rejoining the same room).
        chat.clear()
        activity = emptyList()
        this.authToken = token
        this.roomId = roomId
        this.currentUserId = userId
        this.isVideo = video
        loadRoomReactions(force = true)
        refresh()
        roomRecoveryJob?.cancel()
        roomRecoveryJob = viewModelScope.launch {
            while (true) {
                delay(15_000)
                if (!com.yugm.app.core.api.YugmHttpClient.isOnline) continue
                withContext(Dispatchers.IO) { runCatching { yugmApi.roomDetail(authToken, roomId) } }
                    .onSuccess { detail ->
                        roomDetail = detail
                        roomState = UiState.Success(detail)
                    }
                refreshPollList()
                withContext(Dispatchers.IO) { runCatching { yugmApi.roomMessages(roomId, authToken) } }.onSuccess(::mergeChat)
                withContext(Dispatchers.IO) { runCatching { yugmApi.roomActivity(roomId, authToken) } }.onSuccess { activity = it }
            }
        }
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
        realtimeRefreshJob?.cancel()
        pendingRealtimeEvents.clear()
        roomRecoveryJob?.cancel()
        roomRecoveryJob = null
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
            val pollsResult = withContext(Dispatchers.IO) { runCatching { yugmApi.roomPolls(authToken, roomId) } }
            pollsResult.onSuccess { polls = it }
            val missionsResult = withContext(Dispatchers.IO) { runCatching { yugmApi.roomMissions(authToken, roomId) } }
            missionsResult.onSuccess { missions = it }
            val activityResult = withContext(Dispatchers.IO) { runCatching { yugmApi.roomActivity(roomId, authToken) } }
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
                    // This may be a second entry through a retained destination.
                    // Treat every successful join as a fresh visible feed snapshot.
                    withContext(Dispatchers.Main) {
                        chat.clear()
                        activity = emptyList()
                    }
                    // Keep chat/reaction delivery available even if LiveKit is
                    // temporarily unreachable or microphone publishing fails.
                    viewModelScope.launch(Dispatchers.IO) {
                        runCatching {
                            val mediaSession = yugmApi.liveKitToken(authToken, roomId)
                            val isHostVideoRoom = isVideo && roomDetail?.room?.host?.id == currentUserId
                            // An approved viewer was previously listening with mic off.
                            // Apply their explicit permission choice before reconnecting.
                            microphonePermissionGranted?.let { YugmMediaRoom.setMicEnabled(it) }
                            YugmMediaRoom.connect(
                                mediaSession.token,
                                mediaSession.url,
                                publishCamera = cameraPermissionGranted ?: isHostVideoRoom,
                                publishMicrophone = microphonePermissionGranted ?: isHostVideoRoom,
                                canPublishMicrophone = mediaSession.canPublishMicrophone
                            )
                        }.onFailure { error ->
                            withContext(Dispatchers.Main) {
                                actionError = error.message ?: "Could not connect room audio"
                            }
                        }
                    }
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
                        onRoomReaction = { reaction ->
                            viewModelScope.launch { roomReactionEvent = (roomReactionEvent.first + 1) to reaction }
                        },
                        onSpeakerApproved = { approvedUserId ->
                            if (approvedUserId == currentUserId) {
                                scheduleRealtimeRefresh("room:speaker:approve")
                                // Video guests reconnect after the screen obtains
                                // camera/microphone consent; avoid racing that session.
                                if (!isVideo) refreshMediaSession(enableMicrophone = true)
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
                        onRoomDataChanged = { event -> scheduleRealtimeRefresh(event) },
                        onRoomGift = { giftEvent ->
                            viewModelScope.launch {
                                roomGiftEvent = (roomGiftEvent.first + 1) to giftEvent
                            }
                        },
                        onRoomJoined = { refreshRoomMessages() }
                    )
                }
            }
            val joinFailure = result.exceptionOrNull()
            if (result.isSuccess) {
                isConnected = true
                refresh()
            } else if (joinFailure != null) {
                // Join can legitimately be rejected (ended, scheduled, VIP-only,
                // invite-only, blocked, restricted). Surface it instead of leaving
                // the user in a half-joined room where chat and reactions later
                // fail with "You are not a participant in this room".
                actionError = joinFailure.message ?: "Couldn't join this room"
                refresh()
            }
        }
    }

    private fun isNotParticipantFailure(error: Throwable): Boolean =
        error.message?.contains("not a participant", ignoreCase = true) == true

    /**
     * Participant-gated actions can race the room join (the screen mounts and
     * the user acts before POST /rooms/:id/join finishes). Re-join once and
     * retry instead of surfacing "You are not a participant in this room".
     */
    private suspend fun <T> retryAfterJoin(block: suspend () -> T): T {
        return try {
            block()
        } catch (error: Throwable) {
            if (!isNotParticipantFailure(error)) throw error
            yugmApi.joinRoom(authToken, roomId)
            block()
        }
    }

    fun sendMessage(text: String) {
        viewModelScope.launch {
            actionLoading = true
            actionError = null
            val result = withContext(Dispatchers.IO) {
                runCatching {
                    retryAfterJoin { yugmApi.sendMessage(authToken, roomId, text) }
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
                    retryAfterJoin {
                        yugmApi.sendGift(token = authToken, roomId = roomId, gift = gift, receiverId = receiverId, currency = currency)
                    }
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
                runCatching { retryAfterJoin { yugmApi.requestSpeaker(authToken, roomId) } }
                    .onSuccess {
                        actionError = null
                        scheduleRealtimeRefresh("room:speaker:request")
                    }
                    .onFailure { actionError = it.message ?: "Could not send the request to join the call" }
            }
        }
    }

    fun takeSeat(seatIndex: Int) {
        viewModelScope.launch {
            actionError = null
            withContext(Dispatchers.IO) {
                runCatching { retryAfterJoin { yugmApi.takeRoomSeat(authToken, roomId, seatIndex) } }
                    .onSuccess { scheduleRealtimeRefresh("room:speaker:approve") }
                    .onFailure { actionError = it.message ?: "Could not take the seat" }
            }
        }
    }

    fun leaveOwnSeat() {
        viewModelScope.launch {
            actionError = null
            // Stop publishing immediately; the server call updates the seat
            // role and broadcasts the change to everyone else in the room.
            YugmMediaRoom.setMicEnabled(false)
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.leaveRoomSeat(authToken, roomId) }
                    .onSuccess { scheduleRealtimeRefresh("room:participant:update") }
                    .onFailure { actionError = it.message ?: "Could not leave your mic seat" }
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

    private fun refreshRoomMessages() {
        viewModelScope.launch {
            withContext(Dispatchers.IO) { runCatching { yugmApi.roomMessages(roomId, authToken) } }
                .onSuccess(::mergeChat)
        }
    }

    private suspend fun refreshPollList() {
        withContext(Dispatchers.IO) { runCatching { yugmApi.roomPolls(authToken, roomId) } }
            .onSuccess { polls = it }
    }

    private fun scheduleRealtimeRefresh(event: String) {
        viewModelScope.launch {
            if (event == "room:ended") {
                realtimeRefreshJob?.cancel()
                pendingRealtimeEvents.clear()
                chat.clear()
                activity = emptyList()
                roomEndedVersion++
                return@launch
            }
            // Joining/requesting also emits an activity event. Preserve the
            // whole burst so that activity never cancels the roster refresh.
            pendingRealtimeEvents.add(event)
            if (realtimeRefreshJob?.isActive == true) return@launch
            realtimeRefreshJob = launch {
                while (pendingRealtimeEvents.isNotEmpty()) {
                    delay(180)
                    val events = pendingRealtimeEvents.toSet()
                    pendingRealtimeEvents.clear()
                    val shouldRefreshDetail = events.any { it in setOf(
                        "room:participant:update", "room:speaker:request", "room:speaker:approve",
                        "room:speaker:reject", "room:user:mute", "room:user:remove", "room:gift:send"
                    ) }
                    if (shouldRefreshDetail) {
                        withContext(Dispatchers.IO) { runCatching { yugmApi.roomDetail(authToken, roomId) } }
                            .onSuccess { roomDetail = it; roomState = UiState.Success(it) }
                    }
                    if (events.any { it.startsWith("room:poll:") }) {
                        withContext(Dispatchers.IO) { runCatching { yugmApi.roomPolls(authToken, roomId) } }.onSuccess { polls = it }
                    }
                    if (events.any { it == "room:activity:new" || it == "room:gift:send" }) {
                        withContext(Dispatchers.IO) { runCatching { yugmApi.roomActivity(roomId, authToken) } }.onSuccess { activity = it }
                    }
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
                    publishMicrophone = enableMicrophone || YugmMediaRoom.isMicEnabled(),
                    canPublishMicrophone = it.canPublishMicrophone
                )
            }
                .onFailure { actionError = it.message ?: "Could not enable room audio" }
        }
    }

    fun approveSpeaker(userId: String) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.approveSpeaker(authToken, roomId, userId) }
                    .onSuccess {
                        actionError = null
                        scheduleRealtimeRefresh("room:speaker:approve")
                    }
                    .onFailure { actionError = it.message ?: "Could not approve the voice request" }
            }
        }
    }

    fun rejectSpeaker(userId: String) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.rejectSpeaker(authToken, roomId, userId) }
                    .onSuccess {
                        actionError = null
                        scheduleRealtimeRefresh("room:speaker:reject")
                    }
                    .onFailure { actionError = it.message ?: "Could not decline the voice request" }
            }
        }
    }

    fun createPoll(
        question: String,
        options: List<String>,
        onSuccess: () -> Unit = {},
        onFailure: (String) -> Unit = {}
    ) {
        viewModelScope.launch {
            actionError = null
            val result = withContext(Dispatchers.IO) {
                runCatching { yugmApi.createPoll(authToken, roomId, question, options) }
            }
            result.onSuccess {
                refreshPollList()
                scheduleRealtimeRefresh("room:poll:new")
                onSuccess()
            }.onFailure { e ->
                val msg = e.message ?: "Failed to create poll"
                actionError = msg
                onFailure(msg)
            }
        }
    }

    fun votePoll(
        pollId: String,
        optionIndex: Int,
        onSuccess: () -> Unit = {},
        onFailure: (String) -> Unit = {}
    ) {
        viewModelScope.launch {
            actionError = null
            val result = withContext(Dispatchers.IO) {
                runCatching { yugmApi.votePoll(authToken, roomId, pollId, optionIndex) }
            }
            result.onSuccess {
                refreshPollList()
                scheduleRealtimeRefresh("room:poll:vote")
                onSuccess()
            }.onFailure { e ->
                val msg = e.message ?: "Failed to submit your vote"
                actionError = msg
                onFailure(msg)
            }
        }
    }

    fun closePoll(
        pollId: String,
        onSuccess: () -> Unit = {},
        onFailure: (String) -> Unit = {}
    ) {
        viewModelScope.launch {
            actionError = null
            val result = withContext(Dispatchers.IO) {
                runCatching { yugmApi.closePoll(authToken, roomId, pollId) }
            }
            result.onSuccess {
                refreshPollList()
                scheduleRealtimeRefresh("room:poll:closed")
                onSuccess()
            }.onFailure { e ->
                val msg = e.message ?: "Failed to close poll"
                actionError = msg
                onFailure(msg)
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
                runCatching { retryAfterJoin { yugmApi.reactToRoom(authToken, roomId, type) } }
                    .onFailure { error -> actionError = error.message ?: "Failed to react" }
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

    fun unmuteUser(userId: String) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.unmuteUser(roomId, userId, authToken) }.onSuccess { refresh() }
            }
        }
    }

    fun muteAll() {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                roomDetail?.participants?.forEach { participant ->
                    if (participant.user.id != currentUserId && !participant.isRoomAdmin) {
                        runCatching { yugmApi.muteUser(roomId, participant.user.id, authToken) }
                    }
                }
            }
            refresh()
        }
    }

    fun unmuteAll() {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                roomDetail?.participants?.forEach { participant ->
                    if (participant.user.id != currentUserId && !participant.isRoomAdmin) {
                        runCatching { yugmApi.unmuteUser(roomId, participant.user.id, authToken) }
                    }
                }
            }
            refresh()
        }
    }

    fun clearChat() {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.clearRoomChat(roomId, authToken) }
            }
            chat.clear()
        }
    }

    fun reportRoom(reason: String = "Inappropriate room") {
        viewModelScope.launch {
            actionLoading = true
            actionError = null
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.reportUser(authToken, roomId, roomDetail?.room?.host?.id.orEmpty(), reason) }
                    .onFailure { actionError = it.message ?: "Failed to report room" }
            }
            actionLoading = false
        }
    }

    fun blockRoomHost() {
        val hostId = roomDetail?.room?.host?.id.orEmpty()
        if (hostId.isBlank()) return
        viewModelScope.launch {
            actionLoading = true
            actionError = null
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.blockUser(hostId, authToken) }
                    .onFailure { actionError = it.message ?: "Failed to block user" }
            }
            actionLoading = false
        }
    }

    fun sendRoomFeedback(subject: String, message: String) {
        viewModelScope.launch {
            actionLoading = true
            actionError = null
            withContext(Dispatchers.IO) {
                runCatching { yugmApi.sendFeedback(authToken, subject, message, "OTHER") }
                    .onFailure { actionError = it.message ?: "Failed to send feedback" }
            }
            actionLoading = false
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
                        if (enabled && !YugmMediaRoom.canPublishMicrophone()) {
                            refreshMediaSession(enableMicrophone = true)
                        }
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

    private var roomListLoadJob: Job? = null
    private var roomListLoadVersion = 0L
    private var roomListType: RoomType? = null

    fun loadRooms(type: RoomType? = null) {
        if (isRoomListLoading && roomListType == type) return
        roomListLoadJob?.cancel()
        roomListType = type
        val version = ++roomListLoadVersion
        roomListLoadJob = viewModelScope.launch {
            isRoomListLoading = true
            roomListError = null
            try {
                val loaded = withContext(Dispatchers.IO) { yugmApi.rooms(type) }
                if (version == roomListLoadVersion) rooms = loaded
            } catch (cancelled: kotlinx.coroutines.CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                if (version == roomListLoadVersion) roomListError = error.message ?: "Couldn't load live rooms"
            } finally {
                if (version == roomListLoadVersion) isRoomListLoading = false
            }
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
