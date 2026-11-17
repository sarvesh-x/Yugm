package com.yugm.app.feature.room.screens

import android.Manifest
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.content.pm.PackageManager
import android.graphics.Paint
import android.graphics.Typeface
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CardGiftcard
import androidx.compose.material.icons.filled.Casino
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MicOff
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PowerSettingsNew
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.QueueMusic
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.SkipPrevious
import androidx.compose.material.icons.filled.SentimentSatisfiedAlt
import androidx.compose.material.icons.filled.VolumeOff
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import kotlinx.coroutines.launch
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import coil.compose.AsyncImage
import com.yugm.app.core.api.YugmMediaRoom
import com.yugm.app.core.api.resolveMediaUrl
import com.yugm.app.core.model.ChatMessage
import com.yugm.app.core.model.GiftItem
import com.yugm.app.core.model.Host
import com.yugm.app.core.model.PkBattle
import com.yugm.app.core.model.PkLeaderboardEntry
import com.yugm.app.core.model.PkLiveEffect
import com.yugm.app.core.model.PkMode
import com.yugm.app.core.model.PkOpponent
import com.yugm.app.core.model.PkSideType
import com.yugm.app.core.model.PkStatus
import com.yugm.app.core.model.Room
import com.yugm.app.core.model.RoomActivityItem
import com.yugm.app.core.model.RoomMission
import com.yugm.app.core.model.RoomParticipant
import com.yugm.app.core.model.RoomPoll
import com.yugm.app.core.model.RoomReaction
import com.yugm.app.core.model.RoomReactionAccess
import com.yugm.app.core.model.RoomReactionEvent
import com.yugm.app.core.model.SpeakerRequest
import com.yugm.app.core.ui.components.AuroraBackground
import com.yugm.app.core.ui.components.Avatar
import com.yugm.app.core.ui.components.FloatingEmoji
import com.yugm.app.core.ui.components.FloatingEmojiOverlay
import com.yugm.app.core.ui.components.GiftPanel
import com.yugm.app.core.ui.components.GlassCard
import com.yugm.app.core.ui.components.PkBattleHeader
import com.yugm.app.core.ui.components.PkBattleScoreBar
import com.yugm.app.core.ui.components.PkGiftPanel
import com.yugm.app.core.ui.components.PkInviteCard
import com.yugm.app.core.ui.components.PkLeaderboard
import com.yugm.app.core.ui.components.PkLiveEffectBurst
import com.yugm.app.core.ui.components.PkOpponentSearchSheet
import com.yugm.app.core.ui.components.PkReactionPanel
import com.yugm.app.core.ui.components.PkResultDialog
import com.yugm.app.core.ui.components.PkSetupBottomSheet
import com.yugm.app.core.ui.components.PkSideCard
import com.yugm.app.core.ui.components.PkTeamSelector
import com.yugm.app.core.ui.components.PkWaitingState
import com.yugm.app.core.ui.theme.Background
import com.yugm.app.core.ui.theme.Gold
import com.yugm.app.core.ui.theme.Pink
import com.yugm.app.core.ui.theme.PrimaryPink
import com.yugm.app.core.ui.theme.PrimaryPurple
import com.yugm.app.core.ui.theme.SaffronGold
import com.yugm.app.core.ui.theme.TextMuted
import com.yugm.app.core.ui.theme.TextPrimary
import kotlinx.coroutines.delay

// Room Theme Colors matching the visual reference & dark cosmic aesthetic
private val RoomPurplePrimary = Color(0xFF8D35F6)
private val RoomDarkOverlay = Color(0xB8090715)
private val RoomGlassBorder = Color(0x33FFFFFF)
private val RoomSeatEmptyBg = Color(0x40161426)
private val RoomGoldAccent = Color(0xFFFFB300)

private data class RoomMusicItem(val uri: Uri, val title: String)

@Composable
private fun OutlinedButtonRoomMusic(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Surface(
        modifier = modifier.height(46.dp).clickable(onClick = onClick),
        color = Color(0xFF211C32),
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, Color(0x447E718D))
    ) {
        Row(Modifier.padding(horizontal = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) {
            Icon(icon, null, tint = Color(0xFFFF8DC3), modifier = Modifier.size(17.dp))
            Spacer(Modifier.width(7.dp))
            Text(label, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun ActiveVoiceRoomScreen(
    room: Room,
    chat: List<ChatMessage>,
    gifts: List<GiftItem>,
    balance: Int,
    diamondBalance: Int = 0,
    onBack: () -> Unit,
    onSendMessage: (String) -> Unit,
    onGift: (GiftItem, String, String) -> Unit,
    onToast: (String) -> Unit,
    onJoin: () -> Unit,
    participants: List<RoomParticipant> = emptyList(),
    inviteCandidates: List<Host> = emptyList(),
    pkBattle: PkBattle? = null,
    pkInviteId: String? = null,
    pkOpponents: List<PkOpponent> = emptyList(),
    pkLeaderboard: List<PkLeaderboardEntry> = emptyList(),
    pkLiveEffect: PkLiveEffect? = null,
    speakerRequests: List<SpeakerRequest> = emptyList(),
    polls: List<RoomPoll> = emptyList(),
    missions: List<RoomMission> = emptyList(),
    activity: List<RoomActivityItem> = emptyList(),
    onRequestSpeaker: () -> Unit = {},
    onApproveSpeaker: (String) -> Unit = {},
    onRejectSpeaker: (String) -> Unit = {},
    onTakeSeat: (Int) -> Unit = {},
    onSetMicLocked: (Boolean) -> Unit = {},
    onClearRoomChat: () -> Unit = {},
    onMuteAllRoom: () -> Unit = {},
    onUnmuteAllRoom: () -> Unit = {},
    onReportRoom: () -> Unit = {},
    onBlockRoom: () -> Unit = {},
    onRoomFeedback: () -> Unit = {},
    onSetSeatLocked: (Int, Boolean) -> Unit = { _, _ -> },
    onInviteSpeaker: (String) -> Unit = {},
    onCreatePoll: (() -> Unit)? = null,
    onCreateCustomPoll: (String, List<String>, () -> Unit, (String) -> Unit) -> Unit = { _, _, _, _ -> },
    onVotePoll: (String, Int) -> Unit = { _, _ -> },
    onClosePoll: (String) -> Unit = {},
    onInviteFriend: (String) -> Unit = {},
    onDirectMessage: (String?) -> Unit = {},
    onOpenProfile: (String) -> Unit = {},
    onMinimize: () -> Unit = {},
    onReact: (String) -> Unit = {},
    onLoadPkOpponents: (String) -> Unit = {},
    onInvitePk: (PkOpponent, PkMode, Int, String) -> Unit = { _, _, _, _ -> },
    onAutoMatchPk: (PkMode, Int, String) -> Unit = { _, _, _ -> },
    onSendPkGift: (GiftItem, PkSideType) -> Unit = { _, _ -> },
    onSendPkReaction: (String, PkSideType) -> Unit = { _, _ -> },
    onAcceptPk: (String) -> Unit = {},
    onRejectPk: (String) -> Unit = {},
    onEndPk: () -> Unit = {},
    isHost: Boolean = false,
    currentUserId: String = "",
    onEndRoom: () -> Unit = {},
    onMuteUser: (String) -> Unit = {},
    onOwnMicStateChanged: (Boolean) -> Unit = {},
    onRemoveUser: (String) -> Unit = {},
    onFollowUser: (String) -> Unit = {},
    onUnfollowUser: (String) -> Unit = {},
    onRemoveSpeaker: (String) -> Unit = {},
    onLeaveSeat: () -> Unit = {},
    onSetRoomAdmin: (String, Boolean) -> Unit = { _, _ -> },
    onReportUser: (String) -> Unit = {},
    isRoomAdmin: Boolean = false,
    forcedMuteVersion: Int = 0,
    forcedRemoveVersion: Int = 0,
    roomEndedVersion: Int = 0,
    roomReactionEvent: Pair<Int, RoomReactionEvent?> = 0 to null,
    roomGiftEvent: Pair<Int, com.yugm.app.core.model.RoomGiftEvent?> = 0 to null,
    onOpenModes: (() -> Unit)? = null,
    roomReactions: List<RoomReaction> = emptyList(),
    isCurrentUserVip: Boolean = false,
    onOpenThemes: (() -> Unit)? = null,
    onEditRoom: (() -> Unit)? = null,
    canSpeak: Boolean = participants.any {
        it.user.id == currentUserId && it.role in listOf("HOST", "SPEAKER", "MODERATOR")
    }
) {
    DisposableEffect(room.id) {
        onJoin()
        onDispose { }
    }

    var muted by rememberSaveable(room.id) { mutableStateOf(true) }
    var roomAudioMuted by rememberSaveable(room.id) { mutableStateOf(false) }
    val speakingIdentities by YugmMediaRoom.speakingIdentities.collectAsState()
    val context = LocalContext.current
    val selfParticipant = participants.firstOrNull { it.user.id == currentUserId }
    val micMutedByRoomAdmin = selfParticipant?.moderatorMuted == true
    var blockedPermission by remember(room.id) { mutableStateOf<String?>(null) }

    val microphonePermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted && !micMutedByRoomAdmin) {
            blockedPermission = null
            muted = false
            YugmMediaRoom.setMicEnabled(true)
            onOwnMicStateChanged(true)
        } else if (micMutedByRoomAdmin) {
            muted = true
            YugmMediaRoom.setMicEnabled(false)
            onToast("The host or an admin muted your microphone")
        } else {
            blockedPermission = "microphone"
            onToast("Microphone permission is needed to speak")
        }
    }

    LaunchedEffect(room.id, canSpeak, selfParticipant?.micEnabled, micMutedByRoomAdmin) {
        when {
            !canSpeak || micMutedByRoomAdmin || selfParticipant?.micEnabled == false -> {
                muted = true
                YugmMediaRoom.setMicEnabled(false)
            }
            ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED -> {
                muted = false
                YugmMediaRoom.setMicEnabled(true)
            }
            else -> {
                muted = true
                microphonePermission.launch(Manifest.permission.RECORD_AUDIO)
            }
        }
    }
    RoomPermissionDialog(blockedPermission) { blockedPermission = null }

    LaunchedEffect(forcedMuteVersion) {
        if (forcedMuteVersion > 0) {
            muted = true
            YugmMediaRoom.setMicEnabled(false)
            onToast("A room admin muted your microphone")
        }
    }

    LaunchedEffect(forcedRemoveVersion) {
        if (forcedRemoveVersion > 0) {
            onToast("You were removed from this room")
            delay(500)
            onBack()
        }
    }

    LaunchedEffect(roomEndedVersion) {
        if (roomEndedVersion > 0) {
            onToast("This room has ended")
            delay(500)
            onBack()
        }
    }

    // Dialog & bottom sheet states
    var giftOpen by rememberSaveable { mutableStateOf(false) }
    var giftRecipientId by remember(room.id) { mutableStateOf(room.host?.id.orEmpty()) }
    var showInvitePicker by rememberSaveable(room.id) { mutableStateOf(false) }
    var showPollComposer by rememberSaveable(room.id) { mutableStateOf(false) }
    var showPkSetup by rememberSaveable(room.id) { mutableStateOf(false) }
    var showPkOpponents by rememberSaveable { mutableStateOf(false) }
    var pkMode by rememberSaveable { mutableStateOf(PkMode.GIFT) }
    var pkDuration by rememberSaveable { mutableStateOf(180) }
    var pkTitle by rememberSaveable { mutableStateOf("Late Night PK") }
    var pkSearch by rememberSaveable { mutableStateOf("") }
    var pkGiftSide by rememberSaveable { mutableStateOf(PkSideType.LEFT) }
    var dismissedPkResultId by rememberSaveable { mutableStateOf<String?>(null) }
    var selectedParticipant by remember { mutableStateOf<RoomParticipant?>(null) }
    var selectedEmptySeat by remember { mutableStateOf<Int?>(null) }
    var showReactionPicker by rememberSaveable { mutableStateOf(false) }
    var showExitPrompt by rememberSaveable { mutableStateOf(false) }
    var showToolsSheet by rememberSaveable { mutableStateOf(false) }
    var showMusicSheet by rememberSaveable { mutableStateOf(false) }
    var showMusicLibrary by rememberSaveable { mutableStateOf(false) }
    var showMusicQueue by rememberSaveable { mutableStateOf(false) }
    var roomMusicQueue by remember(room.id) { mutableStateOf(emptyList<RoomMusicItem>()) }
    var roomMusicIndex by rememberSaveable(room.id) { mutableStateOf(-1) }
    var roomMusicPlaying by rememberSaveable(room.id) { mutableStateOf(false) }
    var roomMusicLoaded by rememberSaveable(room.id) { mutableStateOf(false) }
    var roomMusicVolume by rememberSaveable(room.id) { mutableStateOf(0.8f) }
    var musicControlsOffset by remember(room.id) { mutableStateOf(Offset.Zero) }
    var pendingMusicUri by remember { mutableStateOf<Uri?>(null) }
    var pendingMusicIndex by remember { mutableStateOf(-1) }
    var showListenersSheet by rememberSaveable { mutableStateOf(false) }
    var showLuckyWheelDialog by rememberSaveable { mutableStateOf(false) }
    var showRoomInfoSheet by rememberSaveable { mutableStateOf(false) }
    var chatMessageDraft by rememberSaveable { mutableStateOf("") }
    val seatReactions = remember { mutableStateMapOf<Int, RoomReactionEvent>() }
    var activeGiftBanner by remember { mutableStateOf<Pair<String, GiftItem>?>(null) }
    var seenJoinActivityIds by remember(room.id) { mutableStateOf<Set<String>?>(null) }
    var activeEntranceActivity by remember(room.id) { mutableStateOf<com.yugm.app.core.model.RoomActivityItem?>(null) }
    var floatingReaction by remember { mutableStateOf<RoomReactionEvent?>(null) }
    val scope = rememberCoroutineScope()
    val roomMusicPlaybackStatus by YugmMediaRoom.roomMusicStatus.collectAsState()
    val musicPermissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        val uri = pendingMusicUri
        val index = pendingMusicIndex
        pendingMusicUri = null
        if (granted && uri != null) {
            blockedPermission = null
            scope.launch {
                val started = runCatching { YugmMediaRoom.startRoomMusic(uri) }.getOrDefault(false)
                if (started) {
                    roomMusicIndex = index
                    roomMusicPlaying = true
                    roomMusicLoaded = true
                } else onToast("Could not share this track. Try another audio file or reconnect to the room.")
            }
        } else {
            blockedPermission = "microphone"
            onToast("Microphone access is needed to stream music to the room")
        }
    }
    fun playRoomMusic(index: Int) {
        val item = roomMusicQueue.getOrNull(index) ?: return
        if (micMutedByRoomAdmin) {
            onToast("Music sharing is unavailable while your audio is restricted")
            return
        }
        if (androidx.core.content.ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            pendingMusicUri = item.uri
            pendingMusicIndex = index
            musicPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
            return
        }
        scope.launch {
            val started = runCatching { YugmMediaRoom.startRoomMusic(item.uri) }.getOrDefault(false)
            if (started) {
                roomMusicIndex = index
                roomMusicPlaying = true
                roomMusicLoaded = true
            } else onToast("Could not share this track. Try another audio file or reconnect to the room.")
        }
    }

    fun playNextRoomMusic() {
        if (roomMusicQueue.isNotEmpty()) playRoomMusic((roomMusicIndex + 1).mod(roomMusicQueue.size))
    }

    fun playPreviousRoomMusic() {
        if (roomMusicQueue.isNotEmpty()) playRoomMusic(if (roomMusicIndex <= 0) roomMusicQueue.lastIndex else roomMusicIndex - 1)
    }

    fun removeRoomMusic(index: Int) {
        if (index !in roomMusicQueue.indices) return
        val wasCurrent = index == roomMusicIndex
        val updatedQueue = roomMusicQueue.toMutableList().apply { removeAt(index) }
        roomMusicQueue = updatedQueue
        when {
            updatedQueue.isEmpty() -> {
                scope.launch { YugmMediaRoom.stopRoomMusic() }
                roomMusicIndex = -1
                roomMusicPlaying = false
                roomMusicLoaded = false
            }
            wasCurrent -> {
                scope.launch { YugmMediaRoom.stopRoomMusic() }
                roomMusicPlaying = false
                roomMusicLoaded = false
                roomMusicIndex = index.coerceAtMost(updatedQueue.lastIndex)
            }
            index < roomMusicIndex -> roomMusicIndex--
        }
    }

    LaunchedEffect(roomMusicPlaybackStatus) {
        when (roomMusicPlaybackStatus.state) {
            com.yugm.app.core.api.RoomMusicPlaybackState.COMPLETED -> {
                if (roomMusicIndex in 0 until roomMusicQueue.lastIndex) playRoomMusic(roomMusicIndex + 1)
                else roomMusicPlaying = false
            }
            com.yugm.app.core.api.RoomMusicPlaybackState.ERROR -> {
                roomMusicPlaying = false
                roomMusicLoaded = false
                scope.launch { YugmMediaRoom.stopRoomMusic() }
                onToast(roomMusicPlaybackStatus.error.ifBlank { "This audio file could not be played. Try another track." })
            }
            else -> Unit
        }
    }

    BackHandler { showExitPrompt = true }

    // Live gift payloads carry the image URL; activity labels are intentionally
    // not used to reconstruct artwork because they only contain text.
    LaunchedEffect(roomGiftEvent.first) {
        val event = roomGiftEvent.second ?: return@LaunchedEffect
        val catalogGift = gifts.firstOrNull { it.id == event.giftId || it.name.equals(event.giftName, ignoreCase = true) }
        val gift = catalogGift?.copy(icon = event.giftIcon.ifBlank { catalogGift.icon })
            ?: GiftItem(id = event.giftId, name = event.giftName, price = event.price, icon = event.giftIcon.ifBlank { "??" })
        activeGiftBanner = event.senderName.ifBlank { "Someone" } to gift
    }

    LaunchedEffect(activeGiftBanner) {
        if (activeGiftBanner != null) {
            delay(3200)
            activeGiftBanner = null
        }
    }

    LaunchedEffect(activity) {
        val joins = activity.filter { it.type.equals("JOIN", ignoreCase = true) }
        val known = seenJoinActivityIds
        if (known == null) {
            seenJoinActivityIds = joins.map { it.id }.toSet()
        } else {
            val newJoin = joins.lastOrNull { it.id.isNotBlank() && it.id !in known }
            seenJoinActivityIds = known + joins.map { it.id }
            if (newJoin != null && (newJoin.roomEntry.isNotBlank() || newJoin.entranceEffect.isNotBlank())) {
                activeEntranceActivity = newJoin
            }
        }
    }

    // Show the selected reaction on the reacting user's seat or as floating overlay.
    LaunchedEffect(roomReactionEvent.first) {
        val event = roomReactionEvent.second ?: return@LaunchedEffect
        val reactionId = roomReactionEvent.first
        if (reactionId <= 0) return@LaunchedEffect
        val normalized = event.copy(
            reactionId = event.reactionId.ifBlank { event.type },
            label = event.label.ifBlank { event.reactionId.ifBlank { event.type } }
        )
        val reactingParticipant = participants.firstOrNull { it.user.id == normalized.userId }
        val seatIdx = reactingParticipant?.seatIndex
        if (seatIdx != null) {
            seatReactions[seatIdx] = normalized
            scope.launch {
                delay(1800)
                if (seatReactions[seatIdx]?.reactionId == normalized.reactionId && seatReactions[seatIdx]?.userId == normalized.userId) {
                    seatReactions.remove(seatIdx)
                }
            }
        } else {
            floatingReaction = normalized
            delay(1800)
            if (floatingReaction?.reactionId == normalized.reactionId && floatingReaction?.userId == normalized.userId) {
                floatingReaction = null
            }
        }
    }

    val speakers = participants.filter { it.role in listOf("HOST", "SPEAKER", "MODERATOR") }
    val chatListState = rememberLazyListState()

    LaunchedEffect(chat.size) {
        if (chat.isNotEmpty()) {
            chatListState.animateScrollToItem((chat.size - 1).coerceAtLeast(0))
        }
    }

    GiftPanel(
        open = giftOpen,
        gifts = gifts,
        balance = balance,
        diamondBalance = diamondBalance,
        onDismiss = { giftOpen = false },
        onSend = { gift ->
            onGift(gift, "COINS", giftRecipientId)
            giftRecipientId = room.host?.id.orEmpty()
        },
        onSendWithCurrency = { gift, currency ->
            onGift(gift, currency, giftRecipientId)
            giftRecipientId = room.host?.id.orEmpty()
        }
    )

    Box(modifier = Modifier.fillMaxSize()) {
        // Atmospheric Sunset / Dusk Rooftop Background matching reference image
        Image(
            painter = painterResource(com.yugm.app.feature.room.R.drawable.late_night_rooftop),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize()
        )

        // Gradient dusk tint overlay (Warm dusk purple -> deep twilight black)
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        listOf(
                            Color(0x772B1055),
                            Color(0x9952174A),
                            Color(0xB31C132B),
                            Color(0xF00A0915)
                        )
                    )
                )
        )

        // Subtle aurora shimmer for extra polish
        AuroraBackground(speed = 0.25f)

        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
        ) {
            SharedRoomHeader(
                room = room,
                participants = participants,
                isHost = isHost,
                isRoomAdmin = isRoomAdmin,
                onShare = {
                    val shareIntent = Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(Intent.EXTRA_TEXT, "Join ${room.title.ifBlank { "my room" }} on Yugm: yugm.live/room/${room.id}")
                    }
                    context.startActivity(Intent.createChooser(shareIntent, "Share room"))
                },
                onRoomInfo = { showRoomInfoSheet = true },
                onClearChat = onClearRoomChat,
                onMuteAll = onMuteAllRoom,
                onUnmuteAll = onUnmuteAllRoom,
                onLockAllMics = { onSetMicLocked(true) },
                onUnlockAllMics = { onSetMicLocked(false) },
                onReportRoom = onReportRoom,
                onBlockRoom = onBlockRoom,
                onFeedback = onRoomFeedback,
                onRankClick = { onToast("Room Ranking #1 in Live Audio") },
                onLeave = { showExitPrompt = true }
            )

            // ================= 2. VOICE STAGE (DYNAMIC USER-CONFIGURED SEATS) =================
            // Render exactly the capacity saved during room creation. Keep the
            // UI in sync with the server's seat index validation and lobby count.
            val totalSeats = room.maxSpeakers.coerceIn(2, 20)
            val itemsPerRow = if (totalSeats <= 4) totalSeats else if (totalSeats <= 6) 3 else if (totalSeats <= 8) 4 else 5
            val seatRows = (0 until totalSeats).chunked(itemsPerRow)

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 10.dp, vertical = 6.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                seatRows.forEach { rowIndices ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceAround
                    ) {
                        rowIndices.forEach { index ->
                            VoiceSeatItem(
                                index = index,
                                participant = speakers.firstOrNull { it.seatIndex == index },
                                isSpeaking = speakers.firstOrNull { it.seatIndex == index }?.user?.id?.let(speakingIdentities::contains) == true,
                                isLocked = index in room.lockedSeatIndices,
                                isCurrentMuted = speakers.firstOrNull { it.seatIndex == index }?.let { p ->
                                    (p.user.id == currentUserId && muted) || p.micEnabled == false || p.moderatorMuted
                                } ?: false,
                                reaction = seatReactions[index],
                                modifier = Modifier.weight(1f),
                                onClick = {
                                    val p = speakers.firstOrNull { it.seatIndex == index }
                                    if (p != null) selectedParticipant = p else selectedEmptySeat = index
                                }
                            )
                        }
                    }
                }
            }

            // ================= 3. MIDDLE AREA: PK / FEED / CHAT =================
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
            ) {
                // PK Battle Banner (if battle is active)
                if (pkBattle != null && pkBattle.status == PkStatus.ACTIVE) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 14.dp)
                            .align(Alignment.TopCenter),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        PkBattleHeader(pkBattle, isHost = isHost, onEnd = onEndPk)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            PkSideCard(pkBattle.left, PkSideType.LEFT, pkBattle.leader == PkSideType.LEFT, modifier = Modifier.weight(1f))
                            PkSideCard(pkBattle.right, PkSideType.RIGHT, pkBattle.leader == PkSideType.RIGHT, modifier = Modifier.weight(1f))
                        }
                        PkBattleScoreBar(pkBattle)
                        PkTeamSelector(pkBattle, selectedSide = pkGiftSide, onSelect = { pkGiftSide = it })
                        PkLiveEffectBurst(pkLiveEffect)
                    }
                } else if (pkBattle != null && pkBattle.status == PkStatus.INVITED && isHost && pkBattle.right.roomId == room.id && !pkInviteId.isNullOrBlank()) {
                    PkInviteCard(
                        battle = pkBattle,
                        inviterName = pkBattle.left.hostName,
                        onAccept = { onAcceptPk(pkInviteId) },
                        onReject = { onRejectPk(pkInviteId) }
                    )
                } else if (pkBattle != null && pkBattle.status in listOf(PkStatus.INVITED, PkStatus.WAITING)) {
                    PkWaitingState(pkBattle)
                }

                val visiblePoll = polls.firstOrNull { it.isActive }
                if (visiblePoll != null) {
                    Box(
                        Modifier.align(Alignment.TopEnd).padding(
                            top = if (pkBattle?.status == PkStatus.ACTIVE) 210.dp else 8.dp,
                            end = 12.dp
                        ).widthIn(max = 300.dp)
                    ) {
                        PollCard(
                            poll = visiblePoll,
                            isHost = isHost,
                            currentUserId = currentUserId,
                            onCreate = { showPollComposer = true },
                            onVote = onVotePoll,
                            onClose = { visiblePoll.id.let(onClosePoll) }
                        )
                    }
                }

                // Feed / Live Chat / Entrance announcements
                LazyColumn(
                    state = chatListState,
                    modifier = Modifier
                        .fillMaxWidth(0.85f)
                        .fillMaxHeight()
                        .padding(start = 14.dp, bottom = 6.dp)
                        .align(Alignment.BottomStart),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    contentPadding = PaddingValues(bottom = 8.dp)
                ) {
                    // System entrance cards (matching reference screenshot with purple clap pill button!)
                    val recentEntrances = activity.asReversed()
                        .filter { it.type.uppercase() == "JOIN" }
                        .distinctBy { it.userId.ifBlank { it.label } }
                        .take(4)
                        .reversed()
                    items(recentEntrances, key = { "join-${it.id}" }) { item ->
                        EntranceAnnouncementCard(
                            label = item.label,
                            userName = item.userName,
                            avatarUrl = item.avatar,
                            onWelcomeClick = {
                                onReact("clap")
                                onToast("Welcomed to the room! ??")
                            }
                        )
                    }

                    // Chat messages
                    itemsIndexed(chat.takeLast(16), key = { index, msg -> "$index-${msg.author}-${msg.text.hashCode()}" }) { _, msg ->
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .clip(RoundedCornerShape(14.dp))
                                .background(Color(0x88141424))
                                .border(1.dp, Color(0x1AFFFFFF), RoundedCornerShape(14.dp))
                                .padding(horizontal = 10.dp, vertical = 6.dp)
                        ) {
                            Text(
                                text = "${msg.author}: ",
                                color = if (msg.author == "System") Pink else Color(0xFFC084FC),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = msg.text,
                                color = Color.White,
                                fontSize = 12.sp
                            )
                        }
                    }
                }

            }

            // Compact room composer matching the reference controls.
            Surface(
                color = Color.Transparent,
                border = BorderStroke(0.dp, Color.Transparent),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(22.dp)
                ) {
                    Row(
                        modifier = Modifier.weight(1f).height(44.dp).clip(CircleShape)
                            .background(Color(0x66201B2B)).border(1.dp, Color(0x553C3154), CircleShape)
                            .padding(start = 15.dp, end = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        BasicTextField(
                            value = chatMessageDraft,
                            onValueChange = { chatMessageDraft = it.take(200) },
                            modifier = Modifier.weight(1f).semantics { contentDescription = "Write a room message" },
                            singleLine = true,
                            textStyle = TextStyle(color = Color.White, fontSize = 14.sp),
                            cursorBrush = androidx.compose.ui.graphics.SolidColor(RoomPurplePrimary),
                            decorationBox = { inner ->
                                Box {
                                    if (chatMessageDraft.isBlank()) Text("Say Something...", color = Color(0xFFBAB6C3), fontSize = 14.sp)
                                    inner()
                                }
                            }
                        )
                        if (chatMessageDraft.isNotBlank()) {
                            IconButton(onClick = {
                                onSendMessage(chatMessageDraft.trim())
                                chatMessageDraft = ""
                            }, modifier = Modifier.size(34.dp).semantics { contentDescription = "Send message" }) {
                                Icon(Icons.Filled.Send, contentDescription = null, tint = RoomPurplePrimary, modifier = Modifier.size(18.dp))
                            }
                        }
                    }
                    IconButton(
                        onClick = { showReactionPicker = true },
                        modifier = Modifier.size(32.dp).clip(CircleShape)
                            .border(1.dp, Color(0x667E718D), CircleShape)
                            .semantics { contentDescription = "Open emoji reactions" }
                    ) {
                        Icon(Icons.Filled.SentimentSatisfiedAlt, contentDescription = null, tint = Color.White, modifier = Modifier.size(14.dp))
                    }
                    IconButton(
                        onClick = {
                            if (!canSpeak) {
                                if (isHost) {
                                    onToast("Take an open mic seat to speak")
                                } else {
                                    onRequestSpeaker()
                                    onToast("Requested microphone seat")
                                }
                            } else if (!muted) {
                                muted = true
                                YugmMediaRoom.setMicEnabled(false)
                                onOwnMicStateChanged(false)
                            } else if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                                muted = false
                                YugmMediaRoom.setMicEnabled(true)
                                onOwnMicStateChanged(true)
        } else microphonePermission.launch(Manifest.permission.RECORD_AUDIO)
                        },
                        modifier = Modifier.size(32.dp).clip(CircleShape)
                            .border(1.dp, Color(0x667E718D), CircleShape)
                    ) {
                        Icon(
                            if (muted || (!canSpeak && !isHost)) Icons.Filled.MicOff else Icons.Filled.Mic,
                            contentDescription = if (!canSpeak && !isHost) "Request microphone" else if (!canSpeak) "Take a mic seat to speak" else if (muted) "Unmute microphone" else "Mute microphone",
                            tint = if (muted || (!canSpeak && !isHost)) Color(0xFFE5DDEC) else Color(0xFFFF79BC),
                            modifier = Modifier.size(14.dp)
                        )
                    }
                    IconButton(
                        onClick = { giftOpen = true },
                        modifier = Modifier.size(32.dp).clip(CircleShape)
                            .border(1.dp, Color(0x667E718D), CircleShape).semantics { contentDescription = "Send a gift" }
                    ) {
                        Icon(Icons.Filled.CardGiftcard, contentDescription = null, tint = Color(0xFFFF80B8), modifier = Modifier.size(14.dp))
                    }
                    IconButton(
                        onClick = { showToolsSheet = true },
                        modifier = Modifier.size(32.dp).clip(CircleShape)
                            .background(Color(0x553A1E3E), CircleShape)
                            .border(1.dp, Color(0x88FFC247), CircleShape)
                            .semantics { contentDescription = "Open room tools and features" }
                    ) {
                        Icon(Icons.Filled.GridView, contentDescription = null, tint = Color(0xFFFFC247), modifier = Modifier.size(17.dp))
                    }
                }
            }
        }

        // Full-Room Gift Celebratory Animation Overlay
        AnimatedVisibility(
            visible = activeGiftBanner != null,
            enter = scaleIn(initialScale = 0.6f) + fadeIn() + slideInVertically { -it / 3 },
            exit = scaleOut(targetScale = 1.2f) + fadeOut() + slideOutVertically { -it },
            modifier = Modifier.align(Alignment.Center)
        ) {
            activeGiftBanner?.let { (sender, gift) ->
                Box(
                    modifier = Modifier
                        .padding(horizontal = 24.dp)
                        .clip(RoundedCornerShape(26.dp))
                        .background(
                            Brush.radialGradient(
                                listOf(Color(0xF54A154B), Color(0xF7130B29))
                            )
                        )
                        .border(2.dp, Brush.linearGradient(listOf(Gold, Pink)), RoundedCornerShape(26.dp))
                        .padding(horizontal = 28.dp, vertical = 20.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        GiftCelebrationArtwork(gift, Modifier.size(76.dp))
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "$sender sent ${gift.name}!",
                            color = Gold,
                            fontSize = 19.sp,
                            fontWeight = FontWeight.Black,
                            textAlign = TextAlign.Center
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = "? Room Intimacy Boosted +100 ?",
                            color = Color.White.copy(alpha = 0.85f),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }

        RoomEntryCosmeticOverlay(activeEntranceActivity)

        floatingReaction?.let { reaction ->
            FloatingEmojiOverlay(
                emojis = listOf(
                    FloatingEmoji(
                        id = "${roomReactionEvent.first}-${reaction.userId}-${reaction.reactionId}",
                        emoji = reaction.emoji,
                        assetUrl = reaction.assetUrl,
                        label = reaction.label.ifBlank { reaction.reactionId },
                        userName = reaction.userName
                    )
                ),
                modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 220.dp).height(260.dp).fillMaxWidth()
            )
        }

        if (roomMusicLoaded) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.CenterEnd) {
                Surface(
                    modifier = Modifier
                        .offset { IntOffset(musicControlsOffset.x.toInt(), musicControlsOffset.y.toInt()) }
                        .pointerInput(room.id) {
                            detectDragGestures { change, dragAmount ->
                                change.consume()
                                musicControlsOffset += dragAmount
                            }
                        },
                    color = Color(0xEE211C32),
                    shape = RoundedCornerShape(28.dp),
                    border = BorderStroke(1.dp, Color(0x667E718D)),
                    shadowElevation = 12.dp
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp), modifier = Modifier.padding(horizontal = 5.dp, vertical = 3.dp)) {
                        IconButton(onClick = ::playPreviousRoomMusic) {
                            Icon(Icons.Filled.SkipPrevious, "Previous track", tint = Color.White)
                        }
                        IconButton(onClick = {
                            if (roomMusicPlaying) { roomMusicPlaying = false; YugmMediaRoom.pauseRoomMusic(true) }
                            else if (roomMusicPlaybackStatus.state == com.yugm.app.core.api.RoomMusicPlaybackState.COMPLETED && roomMusicIndex >= 0) playRoomMusic(roomMusicIndex)
                            else if (roomMusicLoaded) { YugmMediaRoom.pauseRoomMusic(false); roomMusicPlaying = true }
                            else if (roomMusicIndex >= 0) playRoomMusic(roomMusicIndex)
                        }) {
                            Icon(if (roomMusicPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow, if (roomMusicPlaying) "Pause room music" else "Play room music", tint = Color.White)
                        }
                        IconButton(onClick = ::playNextRoomMusic) {
                            Icon(Icons.Filled.SkipNext, "Next track", tint = Color.White)
                        }
                        IconButton(onClick = {
                            scope.launch { YugmMediaRoom.stopRoomMusic() }
                            roomMusicPlaying = false
                            roomMusicLoaded = false
                            roomMusicIndex = -1
                        }) {
                            Icon(Icons.Filled.Close, "Stop and close music player", tint = Color(0xFFFF8DC3))
                        }
                    }
                }
            }
        }
    }

    // ================= ALL BOTTOM SHEETS & DIALOGS =================

    // Room Info, Settings & Perks Sheet
    if (showRoomInfoSheet) {
        RoomSettingsAndInfoSheet(
            room = room,
            isHost = isHost,
            isRoomAdmin = isRoomAdmin,
            participantCount = participants.size,
            onDismiss = { showRoomInfoSheet = false },
            onFollowHost = {
                room.host?.let { h ->
                    if (h.isFollowing) onUnfollowUser(h.id) else onFollowUser(h.id)
                    onToast(if (h.isFollowing) "Unfollowed room host" else "Following room host")
                }
            },
            onOpenThemes = {
                showRoomInfoSheet = false
                onOpenThemes?.invoke()
            },
            onOpenTools = {
                scope.launch {
                    showRoomInfoSheet = false
                    delay(220)
                    showToolsSheet = true
                }
            },
            onViewListeners = {
                scope.launch {
                    showRoomInfoSheet = false
                    delay(220)
                    showListenersSheet = true
                }
            },
            onMinimize = {
                showRoomInfoSheet = false
                onMinimize()
            },
            onExit = {
                scope.launch {
                    showRoomInfoSheet = false
                    delay(220)
                    showExitPrompt = true
                }
            },
            onToast = onToast
        )
    }

    // 2. Room Tools Menu Sheet (Grid button)
    if (showToolsSheet) {
        ModalBottomSheet(
            onDismissRequest = { showToolsSheet = false },
            containerColor = Color(0xFF141224)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 12.dp)
                    .navigationBarsPadding(),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Text("Room Features & Tools", color = Color.White, fontWeight = FontWeight.Black, fontSize = 18.sp)

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceAround
                ) {
                    ToolGridItem("⚔️", "PK Battle") {
                        showToolsSheet = false
                        showPkSetup = true
                    }
                    ToolGridItem("✨", "Reactions") {
                        showToolsSheet = false
                        showReactionPicker = true
                    }
                    ToolGridItem("🎨", "Themes") {
                        showToolsSheet = false
                        onOpenThemes?.invoke()
                    }
                    ToolGridItem("📊", "Poll") {
                        showToolsSheet = false
                        showPollComposer = true
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceAround
                ) {
                    ToolGridItem("⚙️", "Settings") {
                        showToolsSheet = false
                        showRoomInfoSheet = true
                    }
                    ToolGridItem("📨", "Invite") {
                        showToolsSheet = false
                        showInvitePicker = true
                    }
                    ToolGridItem("💬", "DM Host") {
                        showToolsSheet = false
                        onDirectMessage(room.host?.id)
                    }
                    ToolGridItem("🎭", "Modes") {
                        showToolsSheet = false
                        onOpenModes?.invoke()
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceAround
                ) {
                    ToolGridItem("🎡", "Lucky wheel") {
                        showToolsSheet = false
                        showLuckyWheelDialog = true
                    }
                    ToolGridItem(if (roomAudioMuted) "🔇" else "🔊", "Room audio") {
                        roomAudioMuted = !roomAudioMuted
                        YugmMediaRoom.setRoomAudioMuted(roomAudioMuted)
                        onToast(if (roomAudioMuted) "Room audio muted" else "Room audio unmuted")
                        showToolsSheet = false
                    }
                    ToolGridItem("🎵", "Music player") {
                        showToolsSheet = false
                        showMusicSheet = true
                    }
                    ToolGridItem("⬇️", "Minimize") {
                        showToolsSheet = false
                        onMinimize()
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))
            }
        }
    }

    if (showMusicSheet) {
        ModalBottomSheet(
            onDismissRequest = { showMusicSheet = false },
            containerColor = Color(0xFF141224),
            tonalElevation = 0.dp
        ) {
            Column(
                modifier = Modifier.fillMaxWidth().navigationBarsPadding().padding(start = 20.dp, end = 20.dp, top = 8.dp, bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(18.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Box(Modifier.size(42.dp).clip(RoundedCornerShape(14.dp)).background(Brush.linearGradient(listOf(Color(0xFF9B43E8), Color(0xFFE84A98)))), contentAlignment = Alignment.Center) {
                        Icon(Icons.Filled.MusicNote, null, tint = Color.White, modifier = Modifier.size(22.dp))
                    }
                    Column(Modifier.weight(1f)) {
                        Text("Room Music", color = Color.White, fontSize = 19.sp, fontWeight = FontWeight.Bold)
                        Text("Share a track with everyone listening", color = Color(0xFFAAA6B8), fontSize = 12.sp)
                    }
                    IconButton(onClick = { showMusicQueue = !showMusicQueue }) {
                        Icon(Icons.Filled.QueueMusic, contentDescription = "Toggle music queue", tint = if (showMusicQueue) Color(0xFFFF79BC) else Color.White)
                    }
                }

                Surface(color = Color(0xFF211C32), shape = RoundedCornerShape(18.dp), border = BorderStroke(1.dp, Color(0x337E718D))) {
                    Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                        Box(Modifier.size(48.dp).clip(RoundedCornerShape(14.dp)).background(Color(0xFF302344)), contentAlignment = Alignment.Center) {
                            Icon(Icons.Filled.MusicNote, null, tint = Color(0xFFFF8DC3), modifier = Modifier.size(24.dp))
                        }
                        Column(Modifier.weight(1f)) {
                            Text(roomMusicQueue.getOrNull(roomMusicIndex)?.title ?: "Choose a track", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
                            Text(if (roomMusicPlaying) "Streaming to everyone in the room" else "Pick a track and let the room listen", color = Color(0xFFAAA6B8), fontSize = 11.sp, maxLines = 1)
                        }
                        Row(verticalAlignment = Alignment.CenterVertically) {
                        IconButton(onClick = ::playPreviousRoomMusic) {
                            Icon(Icons.Filled.SkipPrevious, "Previous track", tint = Color(0xFFD4CDDE), modifier = Modifier.size(24.dp))
                        }
                        IconButton(
                            onClick = {
                                if (roomMusicPlaying) {
                                    roomMusicPlaying = false
                                    YugmMediaRoom.pauseRoomMusic(true)
                                } else if (roomMusicIndex >= 0) {
                                    if (roomMusicPlaybackStatus.state == com.yugm.app.core.api.RoomMusicPlaybackState.COMPLETED) {
                                        playRoomMusic(roomMusicIndex)
                                    } else if (roomMusicLoaded) {
                                        YugmMediaRoom.pauseRoomMusic(false)
                                        roomMusicPlaying = true
                                    } else playRoomMusic(roomMusicIndex)
                                } else showMusicLibrary = true
                            },
                            modifier = Modifier.size(44.dp).clip(CircleShape).background(Color(0xFFE83E91))
                        ) {
                            Icon(if (roomMusicPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow, contentDescription = if (roomMusicPlaying) "Pause room music" else "Play room music", tint = Color.White)
                        }
                        IconButton(onClick = ::playNextRoomMusic) {
                            Icon(Icons.Filled.SkipNext, "Next track", tint = Color(0xFFD4CDDE), modifier = Modifier.size(24.dp))
                        }
                        }
                    }
                }

                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Icon(
                        if (roomMusicVolume <= 0.01f) Icons.Filled.VolumeOff else Icons.Filled.VolumeUp,
                        contentDescription = "Music volume",
                        tint = Color(0xFFFF8DC3),
                        modifier = Modifier.size(19.dp)
                    )
                    Slider(
                        value = roomMusicVolume,
                        onValueChange = { value ->
                            roomMusicVolume = value
                            YugmMediaRoom.setRoomMusicVolume(value)
                        },
                        modifier = Modifier.weight(1f),
                        colors = SliderDefaults.colors(
                            thumbColor = Color(0xFFFF79BC),
                            activeTrackColor = Color(0xFFE83E91),
                            inactiveTrackColor = Color(0xFF41384F)
                        )
                    )
                    Text("${(roomMusicVolume * 100).toInt()}%", color = Color(0xFFD4CDDE), fontSize = 11.sp, modifier = Modifier.width(34.dp))
                }

                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    OutlinedButtonRoomMusic(
                        icon = Icons.Filled.Add,
                        label = "Add music",
                        modifier = Modifier.weight(1f),
                        onClick = { showMusicLibrary = true }
                    )
                    OutlinedButtonRoomMusic(
                        icon = Icons.Filled.QueueMusic,
                        label = "Queue � ${roomMusicQueue.size}",
                        modifier = Modifier.weight(1f),
                        onClick = { showMusicQueue = !showMusicQueue }
                    )
                }

                if (showMusicQueue) {
                    if (roomMusicQueue.isEmpty()) {
                        Text("Your queue is empty. Add tracks from your device to get started.", color = Color(0xFFAAA6B8), fontSize = 13.sp, modifier = Modifier.padding(vertical = 4.dp))
                    } else {
                        LazyColumn(modifier = Modifier.fillMaxWidth().heightIn(max = 300.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                            itemsIndexed(roomMusicQueue) { index, track ->
                                Surface(
                                    color = if (index == roomMusicIndex) Color(0x332A9D6C) else Color(0xFF1C1929),
                                    shape = RoundedCornerShape(12.dp),
                                    modifier = Modifier.fillMaxWidth().clickable { playRoomMusic(index) }
                                ) {
                                    Row(Modifier.padding(horizontal = 13.dp, vertical = 11.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                        Icon(if (index == roomMusicIndex && roomMusicPlaying) Icons.Filled.Pause else Icons.Filled.MusicNote, null, tint = Color(0xFFFF8DC3), modifier = Modifier.size(18.dp))
                                        Text(track.title, color = Color.White, fontSize = 13.sp, maxLines = 1, modifier = Modifier.weight(1f))
                                        Text("${index + 1}", color = Color(0xFFAAA6B8), fontSize = 11.sp)
                                        IconButton(onClick = { removeRoomMusic(index) }, modifier = Modifier.size(32.dp)) {
                                            Icon(Icons.Filled.Close, contentDescription = "Remove ${track.title} from queue", tint = Color(0xFFAAA6B8), modifier = Modifier.size(16.dp))
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                Text("Only the audio file you choose is sent through the room music track.", color = Color(0xFF8F899F), fontSize = 11.sp)

            }
        }
    }

    if (showMusicLibrary) {
        RoomMusicLibraryDialog(
            onDismiss = { showMusicLibrary = false },
            onAddToQueue = { tracks ->
                val existingUris = roomMusicQueue.mapTo(mutableSetOf()) { it.uri.toString() }
                val additions = tracks.filter { existingUris.add(it.uri.toString()) }
                if (additions.isEmpty()) {
                    onToast("Those tracks are already in the queue")
                } else {
                    val oldSize = roomMusicQueue.size
                    roomMusicQueue = roomMusicQueue + additions.map { RoomMusicItem(it.uri, it.title) }
                    if (roomMusicIndex < 0) roomMusicIndex = oldSize
                    onToast("Added ${additions.size} ${if (additions.size == 1) "track" else "tracks"} to the queue")
                }
                showMusicLibrary = false
                showMusicSheet = true
            }
        )
    }

    // 3. Reaction Picker Sheet
    if (showReactionPicker) {
        ModalBottomSheet(
            onDismissRequest = { showReactionPicker = false },
            containerColor = Color(0xFF141224)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 12.dp)
                    .navigationBarsPadding()
            ) {
                Text("Live Reactions", color = Color.White, fontWeight = FontWeight.Black, fontSize = 18.sp)
                Text("React live on the stage", color = TextMuted, fontSize = 12.sp)
                Spacer(modifier = Modifier.height(14.dp))

                val fallback = listOf("heart", "fire", "laugh", "clap", "wow", "crown", "stars", "party")
                val catalog = if (roomReactions.isNotEmpty()) roomReactions else fallback.mapIndexed { index, id ->
                    RoomReaction(id = id, label = id.replaceFirstChar { it.uppercase() }, access = RoomReactionAccess.EVERYONE, sortOrder = index)
                }
                val everyone = catalog.filter { it.access == RoomReactionAccess.EVERYONE }
                val vipOnly = catalog.filter { it.access == RoomReactionAccess.VIP_EXCLUSIVE }

                fun sendReaction(reaction: RoomReaction) {
                    val event = RoomReactionEvent(
                        type = reaction.id,
                        reactionId = reaction.id,
                        label = reaction.label.ifBlank { reaction.id },
                        assetUrl = reaction.assetUrl,
                        assetKind = reaction.assetKind,
                        access = reaction.access,
                        userId = currentUserId,
                        userName = selfParticipant?.user?.name.orEmpty()
                    )
                    onReact(reaction.id)
                    val seatIdx = selfParticipant?.seatIndex
                    if (seatIdx != null) {
                        seatReactions[seatIdx] = event
                        scope.launch {
                            delay(1800)
                            if (seatReactions[seatIdx]?.reactionId == event.reactionId && seatReactions[seatIdx]?.userId == event.userId) seatReactions.remove(seatIdx)
                        }
                    } else {
                        floatingReaction = event
                        scope.launch {
                            delay(1800)
                            if (floatingReaction?.reactionId == event.reactionId && floatingReaction?.userId == event.userId) floatingReaction = null
                        }
                    }
                    showReactionPicker = false
                }

                @Composable
                fun ReactionTile(reaction: RoomReaction, locked: Boolean) {
                    Box(
                        modifier = Modifier
                            .size(56.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(if (locked) Color(0xFF1C1828) else Color(0xFF26203B))
                            .border(1.dp, if (locked) Color(0x33FFD66B) else RoomGlassBorder, RoundedCornerShape(16.dp))
                            .clickable {
                                if (locked) onToast("VIP exclusive reaction. Upgrade to VIP to use it.")
                                else sendReaction(reaction)
                            },
                        contentAlignment = Alignment.Center
                    ) {
                        Box(contentAlignment = Alignment.Center, modifier = Modifier.alpha(if (locked) 0.45f else 1f)) {
                            if (reaction.emoji.isNotBlank() || reaction.assetUrl.isBlank()) {
                                Text(
                                    text = reaction.emoji.ifBlank { reaction.label.take(2).ifBlank { "•" } },
                                    fontSize = 26.sp
                                )
                            }
                            if (reaction.assetUrl.isNotBlank()) {
                                AsyncImage(
                                    model = reaction.assetUrl,
                                    contentDescription = reaction.label.ifBlank { reaction.id },
                                    modifier = Modifier.size(if (locked) 24.dp else 30.dp)
                                )
                            }
                        }
                        if (locked) {
                            Box(
                                modifier = Modifier
                                    .align(Alignment.BottomEnd)
                                    .padding(4.dp)
                                    .clip(CircleShape)
                                    .background(Color(0xCC171321))
                                    .padding(3.dp)
                            ) {
                                Icon(Icons.Filled.Lock, contentDescription = "VIP only", tint = Gold, modifier = Modifier.size(10.dp))
                            }
                        }
                    }
                }

                if (everyone.isNotEmpty()) {
                    Text("Everyone", color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                    Spacer(modifier = Modifier.height(8.dp))
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp), contentPadding = PaddingValues(bottom = 12.dp)) {
                        items(everyone, key = { it.id }) { reaction ->
                            ReactionTile(reaction, locked = false)
                        }
                    }
                }

                if (vipOnly.isNotEmpty()) {
                    Text("VIP Exclusive", color = Gold, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                    Spacer(modifier = Modifier.height(8.dp))
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp), contentPadding = PaddingValues(bottom = 16.dp)) {
                        items(vipOnly, key = { it.id }) { reaction ->
                            val locked = !isCurrentUserVip
                            ReactionTile(reaction, locked = locked)
                        }
                    }
                }
            }
        }
    }

    // 4. Lucky Wheel Dialog
    if (showLuckyWheelDialog) {
        AlertDialog(
            onDismissRequest = { showLuckyWheelDialog = false },
            title = { Text("?? Lucky Draw & Mini-Games", color = Color.White, fontWeight = FontWeight.Black) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Spin the wheel for a chance to win exclusive room frames, badges, and coin boosts!", color = TextMuted, fontSize = 13.sp)
                    Text("� Grand Prize: Legendary Electric Dragon Frame ??", color = RoomGoldAccent, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Text("� Tier 2: Supreme Crown Frame ??", color = Color.White, fontSize = 12.sp)
                    Text("� Tier 3: 500 Coins Bonus ??", color = Color(0xFF60A5FA), fontSize = 12.sp)
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        showLuckyWheelDialog = false
                        onToast("Spinning wheel... You won 50 Bonus Coins! ??")
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = RoomPurplePrimary)
                ) {
                    Text("Spin for 20 Coins", color = Color.White, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showLuckyWheelDialog = false }) {
                    Text("Close", color = TextMuted)
                }
            },
            containerColor = Color(0xFF18152B)
        )
    }

    // 6. Audience / Listeners Sheet
    if (showListenersSheet) {
        ModalBottomSheet(
            onDismissRequest = { showListenersSheet = false },
            containerColor = Color(0xFF141224)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 12.dp)
                    .navigationBarsPadding()
            ) {
                Text("People in this room (${participants.size})", color = Color.White, fontWeight = FontWeight.Black, fontSize = 18.sp)
                Text(
                    "The host owns this room. Admins help manage mics and members; only the host can appoint admins or end it. A room closes when its host leaves or everyone is gone.",
                    color = TextMuted,
                    fontSize = 11.sp,
                    lineHeight = 15.sp,
                    modifier = Modifier.padding(top = 5.dp, bottom = 10.dp)
                )
                Spacer(modifier = Modifier.height(12.dp))
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 350.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(participants, key = { it.user.id }) { p ->
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    showListenersSheet = false
                                    selectedParticipant = p
                                }
                                .padding(vertical = 4.dp)
                        ) {
                            Avatar(p.user.name.take(1), 38, p.user.avatar, p.user.activeCosmetics)
                            Spacer(modifier = Modifier.width(10.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(p.user.name, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                when {
                                    p.user.id == room.host?.id -> RoomRoleBadge("HOST", Color(0xFFFFC857), "?")
                                    p.isRoomAdmin -> RoomRoleBadge("ROOM ADMIN", Color(0xFFC8A2FF), "??")
                                    p.role in listOf("SPEAKER", "MODERATOR") -> Text("Speaker � Mic on stage", color = TextMuted, fontSize = 11.sp)
                                    else -> Text("Listener", color = TextMuted, fontSize = 11.sp)
                                }
                            }
                            if (p.user.id != currentUserId) {
                                TextButton(onClick = {
                                    if (p.user.isFollowing) onUnfollowUser(p.user.id) else onFollowUser(p.user.id)
                                }) {
                                    Text(if (p.user.isFollowing) "Following" else "+ Follow", color = RoomPurplePrimary, fontSize = 12.sp)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // 7. Empty Seat Click BottomSheet
    selectedEmptySeat?.let { seatIndex ->
        val locked = seatIndex in room.lockedSeatIndices
        val canManage = isHost || isRoomAdmin
        ModalBottomSheet(
            onDismissRequest = { selectedEmptySeat = null },
            containerColor = Color(0xFF171522)
        ) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 22.dp)
                    .padding(bottom = 24.dp)
            ) {
                Text("Mic Seat ${seatIndex + 1}", color = TextPrimary, fontSize = 21.sp, fontWeight = FontWeight.Bold)
                Text(
                    when {
                        locked && canManage -> "This seat is locked. Unlock it before taking the seat."
                        locked -> "This mic is locked by the host or an admin."
                        else -> "Take this open seat to join the stage and speak."
                    },
                    color = TextMuted,
                    fontSize = 14.sp,
                    modifier = Modifier.padding(top = 6.dp, bottom = 16.dp)
                )
                Button(
                    onClick = {
                        onTakeSeat(seatIndex)
                        selectedEmptySeat = null
                    },
                    enabled = !locked,
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = RoomPurplePrimary)
                ) {
                    Text("Take Seat", color = Color.White, fontWeight = FontWeight.Bold)
                }
                if (canManage) {
                    Spacer(modifier = Modifier.height(8.dp))
                    TextButton(
                        onClick = {
                            onSetSeatLocked(seatIndex, !locked)
                            selectedEmptySeat = null
                        },
                        modifier = Modifier.fillMaxWidth().height(48.dp)
                    ) {
                        Text(if (locked) "Unlock Mic Seat" else "Lock Mic Seat", color = if (locked) RoomPurplePrimary else Pink, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }

    // 8. Selected Participant Details Sheet
    selectedParticipant?.let { target ->
        val isSelf = target.user.id == currentUserId
        val targetIsHost = target.role == "HOST" || target.user.id == room.host?.id
        val canManageTarget = !isSelf && !targetIsHost && (!target.isRoomAdmin || isHost)
        ModalBottomSheet(onDismissRequest = { selectedParticipant = null }, containerColor = Color(0xFF171522)) {
            Column(
                Modifier.fillMaxWidth().heightIn(max = 690.dp).verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp).padding(bottom = 22.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box(Modifier.fillMaxWidth().height(104.dp).padding(top = 8.dp), contentAlignment = Alignment.TopCenter) {
                    Box(Modifier.size(90.dp).clip(CircleShape)
                        .background(Brush.linearGradient(listOf(Pink, PrimaryPurple)))
                        .border(2.dp, Color.White.copy(alpha = .85f), CircleShape).padding(3.dp), contentAlignment = Alignment.Center) {
                        Avatar(target.user.name.take(1), 70, target.user.avatar, target.user.activeCosmetics)
                    }
                }
                Text(target.user.name.ifBlank { "Yugm user" }, color = TextPrimary, fontSize = 21.sp, fontWeight = FontWeight.Black)
                Text(
                    buildString {
                        append("ID: ${target.user.id.takeLast(10)}")
                        if (target.user.city.isNotBlank()) append(" � ${target.user.city}")
                    },
                    color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp)
                )
                Row(Modifier.padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    ProfileInfoChip("Lv.${target.user.level}", Color(0xFF547BB8))
                    if (target.user.isVip) ProfileInfoChip(target.user.vipTier.ifBlank { "VIP" }, Gold.copy(alpha = .85f))
                    if (target.isRoomAdmin && !targetIsHost) RoomRoleBadge("ROOM ADMIN", Color(0xFFC8A2FF), "??")
                    else ProfileInfoChip(if (targetIsHost) "Host" else target.role.lowercase().replaceFirstChar { it.uppercase() }, PrimaryPurple.copy(alpha = .8f))
                    target.seatIndex?.let { ProfileInfoChip("Mic ${it + 1}", Pink.copy(alpha = .75f)) }
                }
                Row(Modifier.fillMaxWidth().padding(top = 18.dp, bottom = 16.dp), horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                    ProfileStat("FOLLOWERS", target.user.followers.toString(), Modifier.weight(1f))
                    ProfileStat("FOLLOWING", target.user.followingCount.toString(), Modifier.weight(1f))
                    ProfileStat("LEVEL", target.user.level.toString(), Modifier.weight(1f))
                }
                if (target.user.bio.isNotBlank()) {
                    Text(target.user.bio, color = TextMuted, fontSize = 12.sp, lineHeight = 17.sp, textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp))
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                    if (!isSelf) ProfileActionButton(if (target.user.isFollowing) "? Following" else "?  Follow", listOf(Color(0xFF08AEEA), Color(0xFF297DE2)), Modifier.weight(1f)) {
                        if (target.user.isFollowing) onUnfollowUser(target.user.id) else onFollowUser(target.user.id)
                        selectedParticipant = target.copy(user = target.user.copy(isFollowing = !target.user.isFollowing))
                    }
                    if (!isSelf) ProfileActionButton("Chat", listOf(Color(0xFFB94BEE), Color(0xFF713AE6)), Modifier.weight(1f)) {
                        onDirectMessage(target.user.id); selectedParticipant = null
                    }
                    ProfileActionButton("Profile", listOf(Color(0xFF343144), Color(0xFF282536)), Modifier.weight(1f)) {
                        onOpenProfile(target.user.id); selectedParticipant = null
                    }
                }
                if (isSelf && target.role in listOf("HOST", "SPEAKER", "MODERATOR")) {
                    ProfileActionButton("Leave microphone", listOf(Color(0xFF6C334B), Color(0xFF3D2336)), Modifier.fillMaxWidth().padding(top = 10.dp)) {
                        onLeaveSeat(); selectedParticipant = null; onToast("You left the mic and returned to the audience")
                    }
                }
                if (!isSelf) {
                    ProfileActionButton("??  Send gifts", listOf(Color(0xFFEA477D), Color(0xFFC72F9F)), Modifier.fillMaxWidth().padding(top = 10.dp)) {
                        giftRecipientId = target.user.id
                        giftOpen = true
                        selectedParticipant = null
                    }
                }
                if ((isHost || isRoomAdmin) && canManageTarget) {
                    Column(Modifier.fillMaxWidth().padding(top = 18.dp).clip(RoundedCornerShape(18.dp))
                        .background(Color.White.copy(alpha = .045f)).border(1.dp, Color.White.copy(alpha = .08f), RoundedCornerShape(18.dp)).padding(12.dp)) {
                        Text("ROOM CONTROLS", color = TextMuted, fontSize = 10.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(bottom = 8.dp))
                        Text(
                            "Admins can manage microphones and members. Only the host can appoint admins or end the room; when the host leaves, the room closes.",
                            color = TextMuted,
                            fontSize = 11.sp,
                            lineHeight = 15.sp,
                            modifier = Modifier.padding(bottom = 10.dp)
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            if (target.role == "AUDIENCE") ProfileActionButton("Invite to mic", listOf(Color(0xFF29243A), Color(0xFF29243A)), Modifier.weight(1f), compact = true) { onInviteSpeaker(target.user.id); selectedParticipant = null }
                            if (target.role in listOf("SPEAKER", "MODERATOR")) ProfileActionButton("Remove from mic", listOf(Color(0xFF422638), Color(0xFF422638)), Modifier.weight(1f), compact = true) { onRemoveSpeaker(target.user.id); selectedParticipant = null }
                            if (isHost && !targetIsHost) ProfileActionButton(if (target.isRoomAdmin) "Remove admin" else "Make admin", listOf(Color(0xFF29243A), Color(0xFF29243A)), Modifier.weight(1f), compact = true) { onSetRoomAdmin(target.user.id, !target.isRoomAdmin); selectedParticipant = null }
                        }
                        if ((isHost || isRoomAdmin) && canManageTarget) {
                            Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                ProfileActionButton("Mute mic", listOf(Color(0xFF29243A), Color(0xFF29243A)), Modifier.weight(1f), compact = true) { onMuteUser(target.user.id); selectedParticipant = null }
                                ProfileActionButton("Kick from room", listOf(Color(0xFF422638), Color(0xFF422638)), Modifier.weight(1f), compact = true) { onRemoveUser(target.user.id); selectedParticipant = null }
                            }
                        }
                    }
                }
                if (!isSelf) TextButton(onClick = { onReportUser(target.user.id); selectedParticipant = null }, modifier = Modifier.padding(top = 4.dp)) {
                    Text("Report user", color = TextMuted, fontSize = 12.sp)
                }
            }
        }
    }

    // 9. Friend Invite Sheet
    if (showInvitePicker) {
        FriendInviteSheet(
            hosts = inviteCandidates,
            onDismiss = { showInvitePicker = false },
            onInvite = {
                showInvitePicker = false
                onInviteFriend(it)
            }
        )
    }

    // 10. Poll Composer Sheet
    if (showPollComposer) {
        var isCreatingPoll by remember { mutableStateOf(false) }
        var createPollError by remember { mutableStateOf<String?>(null) }
        PollComposerSheet(
            isSubmitting = isCreatingPoll,
            errorMessage = createPollError,
            onDismiss = { if (!isCreatingPoll) showPollComposer = false },
            onCreate = { question, options ->
                if (isCreatingPoll) return@PollComposerSheet
                isCreatingPoll = true
                createPollError = null
                onCreateCustomPoll(
                    question,
                    options,
                    {
                        isCreatingPoll = false
                        showPollComposer = false
                    },
                    { msg ->
                        isCreatingPoll = false
                        createPollError = msg
                    }
                )
            }
        )
    }

    // 11. PK Setup Sheets
    if (showPkSetup) {
        PkSetupBottomSheet(
            onDismiss = { showPkSetup = false },
            onContinue = { mode, duration, title ->
                pkMode = mode
                pkDuration = duration
                pkTitle = title
                showPkSetup = false
                showPkOpponents = true
                onLoadPkOpponents("")
            },
            onAutoMatch = { mode, duration, title ->
                showPkSetup = false
                pkMode = mode
                pkDuration = duration
                pkTitle = title
                onAutoMatchPk(mode, duration, title)
            }
        )
    }

    if (showPkOpponents) {
        PkOpponentSearchSheet(
            opponents = pkOpponents,
            search = pkSearch,
            onSearchChange = {
                pkSearch = it
                onLoadPkOpponents(it)
            },
            onDismiss = { showPkOpponents = false },
            onInvite = {
                showPkOpponents = false
                onInvitePk(it, pkMode, pkDuration, pkTitle)
            }
        )
    }

    PkResultDialog(
        battle = pkBattle?.takeUnless { it.id == dismissedPkResultId },
        onDismiss = { dismissedPkResultId = pkBattle?.id },
        onRematch = {
            dismissedPkResultId = pkBattle?.id
            showPkSetup = true
        }
    )

    // 12. Exit Confirmation Prompt
    if (showExitPrompt) {
        AlertDialog(
            onDismissRequest = { showExitPrompt = false },
            title = { Text(if (isHost) "Close this room?" else "Leave this room?", fontWeight = FontWeight.Black, color = Color.White) },
            text = { Text("Keep the room active in floating bubble, or exit now.", color = TextMuted) },
            confirmButton = {
                Column(horizontalAlignment = Alignment.End) {
                    TextButton(onClick = {
                        showExitPrompt = false
                        onMinimize()
                    }) { Text("Minimize room", color = RoomPurplePrimary, fontWeight = FontWeight.Bold) }
                    TextButton(onClick = {
                        showExitPrompt = false
                        if (isHost) onEndRoom() else onBack()
                    }) { Text(if (isHost) "Close and exit" else "Leave and exit", color = Pink, fontWeight = FontWeight.Bold) }
                }
            },
            containerColor = Color(0xFF171522)
        )
    }
}

/**
 * Individual Voice Seat component matching the screenshot:
 * - Empty: clean circular disc with mic/lock icon and seat number below
 * - Occupied: avatar with speaking wave aura, mic status indicator badge, and index pill + name below
 */
@Composable
private fun ProfileInfoChip(label: String, tint: Color) {
    Box(Modifier.clip(CircleShape).background(tint.copy(alpha = .2f)).border(1.dp, tint.copy(alpha = .35f), CircleShape).padding(horizontal = 11.dp, vertical = 6.dp)) {
        Text(label, color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold, maxLines = 1)
    }
}

@Composable
private fun RoomRoleBadge(label: String, tint: Color, icon: String) {
    Row(
        Modifier.padding(top = 3.dp).clip(CircleShape)
            .background(tint.copy(alpha = 0.14f))
            .border(1.dp, tint.copy(alpha = 0.42f), CircleShape)
            .padding(horizontal = 8.dp, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Text(icon, color = tint, fontSize = 9.sp, fontWeight = FontWeight.Black)
        Text(label, color = tint, fontSize = 9.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.35.sp)
    }
}

@Composable
private fun ProfileStat(label: String, value: String, modifier: Modifier = Modifier) {
    Column(
        modifier.clip(RoundedCornerShape(14.dp)).background(Color.White.copy(alpha = .045f))
            .border(1.dp, Color.White.copy(alpha = .08f), RoundedCornerShape(14.dp)).padding(vertical = 10.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(value, color = TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Black)
        Text(label, color = TextMuted, fontSize = 8.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 2.dp))
    }
}

@Composable
private fun GiftCelebrationArtwork(gift: GiftItem, modifier: Modifier = Modifier) {
    val icon = gift.icon.trim()
    val isArtworkPath = icon.startsWith("http", ignoreCase = true) || icon.startsWith("/") ||
        icon.contains('/') || Regex("\\.(png|jpe?g|webp|gif|svg)(?:\\?.*)?$", RegexOption.IGNORE_CASE).containsMatchIn(icon)
    if (isArtworkPath) {
        AsyncImage(
            model = resolveMediaUrl(icon),
            contentDescription = gift.name,
            contentScale = ContentScale.Fit,
            modifier = modifier
        )
    } else {
        val displayEmoji = getGiftEmoji(gift.name, icon)
        Box(modifier, contentAlignment = Alignment.Center) {
            Text(displayEmoji, fontSize = 58.sp)
        }
    }
}

private fun getGiftEmoji(name: String, icon: String): String {
    val query = "$name $icon".lowercase()
    return when {
        query.contains("diya", true) -> "??"
        query.contains("rose", true) -> "??"
        query.contains("crown", true) -> "??"
        query.contains("lotus", true) -> "??"
        query.contains("heart", true) -> "??"
        query.contains("ring", true) -> "??"
        query.contains("car", true) -> "???"
        query.contains("diamond", true) -> "??"
        query.contains("fire", true) -> "??"
        query.contains("rocket", true) -> "??"
        query.contains("mic", true) -> "??"
        query.contains("cake", true) -> "??"
        query.contains("bear", true) -> "??"
        query.contains("star", true) -> "?"
        else -> {
            if (icon.isNotBlank() && icon.length <= 4 && !icon.any { it.isLetterOrDigit() }) icon
            else "??"
        }
    }
}

@Composable
private fun ProfileActionButton(
    label: String,
    colors: List<Color>,
    modifier: Modifier = Modifier,
    compact: Boolean = false,
    onClick: () -> Unit
) {
    Box(
        modifier.height(if (compact) 40.dp else 48.dp).clip(RoundedCornerShape(if (compact) 12.dp else 16.dp))
            .background(Brush.horizontalGradient(colors)).border(1.dp, Color.White.copy(alpha = .12f), RoundedCornerShape(if (compact) 12.dp else 16.dp))
            .clickable(role = Role.Button, onClick = onClick).padding(horizontal = if (compact) 8.dp else 10.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(label, color = Color.White, fontSize = if (compact) 10.sp else 12.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center)
    }
}

@Composable
private fun RoomHeaderAction(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .size(36.dp)
            .clip(CircleShape)
            .background(Color(0x66000000))
            .border(1.dp, RoomGlassBorder, CircleShape)
            .clickable(onClick = onClick)
            .semantics { contentDescription = label },
        contentAlignment = Alignment.Center
    ) {
        Icon(icon, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
    }
}

@Composable
private fun VoiceSeatItem(
    modifier: Modifier = Modifier,
    index: Int,
    participant: RoomParticipant?,
    isSpeaking: Boolean,
    isLocked: Boolean,
    isCurrentMuted: Boolean,
    reaction: RoomReactionEvent? = null,
    onClick: () -> Unit
) {
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = if (isSpeaking) 1.14f else 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(600, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulseScale"
    )

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = 92.dp)
            .clickable(onClick = onClick)
    ) {
        if (participant != null) {
            // Occupied Seat Avatar
            Box(
                modifier = Modifier.size(54.dp),
                contentAlignment = Alignment.Center
            ) {
                // Speaking pulse ripple ring
                if (isSpeaking) {
                    Box(
                        modifier = Modifier
                            .size(54.dp * pulseScale)
                            .clip(CircleShape)
                            .border(2.dp, Color(0xFF00E5FF), CircleShape)
                    )
                }

                // Avatar with custom frame
                Avatar(
                    initial = participant.user.name.take(1).uppercase(),
                    size = 40,
                    imageUrl = participant.user.avatar,
                    cosmetics = participant.user.activeCosmetics,
                    isSpeaking = isSpeaking,
                    isMuted = isCurrentMuted
                )

                if (participant.isRoomAdmin || participant.role == "HOST") {
                    Box(
                        Modifier.align(Alignment.TopEnd).size(18.dp).clip(CircleShape)
                            .background(if (participant.role == "HOST") Color(0xFF8B6418) else Color(0xFF6941A5))
                            .border(1.dp, if (participant.role == "HOST") Color(0xFFFFD66B) else Color(0xFFD5B8FF), CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(if (participant.role == "HOST") "H" else "A", color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.Black)
                    }
                }

                // Animated live reaction centered directly over the avatar!
                if (reaction != null) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.Center)
                            .clip(CircleShape)
                            .background(Color(0xD9000000))
                            .border(1.5.dp, Gold, CircleShape)
                            .padding(8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            if (reaction.emoji.isNotBlank() || reaction.assetUrl.isBlank()) {
                                Text(reaction.emoji.ifBlank { reaction.label.take(2).ifBlank { "•" } }, fontSize = 24.sp)
                            }
                            if (reaction.assetUrl.isNotBlank()) {
                                AsyncImage(
                                    model = reaction.assetUrl,
                                    contentDescription = reaction.label.ifBlank { reaction.reactionId },
                                    modifier = Modifier.size(28.dp)
                                )
                            }
                        }
                    }
                }


            }

            Spacer(modifier = Modifier.height(4.dp))

            // Pill with Seat Number + Name
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
                modifier = Modifier.fillMaxWidth().height(26.dp).padding(horizontal = 2.dp)
            ) {
                // Number badge
                Canvas(
                    modifier = Modifier.size(16.dp).semantics {
                        contentDescription = "Mic ${index + 1}"
                    }
                ) {
                    drawCircle(color = Color(0xFF3B82F6), radius = size.minDimension / 2f)
                    val numberPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                        color = android.graphics.Color.WHITE
                        textSize = 10.sp.toPx()
                        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                        textAlign = Paint.Align.CENTER
                    }
                    val metrics = numberPaint.fontMetrics
                    val centeredBaseline = size.height / 2f - (metrics.ascent + metrics.descent) / 2f
                    drawIntoCanvas { canvas ->
                        canvas.nativeCanvas.drawText("${index + 1}", size.width / 2f, centeredBaseline, numberPaint)
                    }
                }

                Text(
                    text = participant.user.name,
                    color = Color.White,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    textAlign = TextAlign.Start,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false).padding(start = 4.dp)
                )
            }
        } else {
            // Empty Seat: Circular disc with mic / lock icon
            Box(
                modifier = Modifier
                    .size(50.dp)
                    .clip(CircleShape)
                    .background(RoomSeatEmptyBg)
                    .border(1.dp, RoomGlassBorder, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = if (isLocked) Icons.Filled.Lock else Icons.Filled.Mic,
                    contentDescription = null,
                    tint = if (isLocked) Color(0xFFFFB300) else Color(0xB3FFFFFF),
                    modifier = Modifier.size(22.dp)
                )
            }

            Spacer(modifier = Modifier.height(4.dp))

            // Seat number below empty disc
            Text(
                text = "${index + 1}",
                color = TextMuted,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold
            )
        }

    }
}

/**
 * Entrance Announcement Card matching the reference screenshot:
 * Translucent dark card with avatar, badge, name, "entered the room" subtitle, and purple clap pill button
 */
@Composable
private fun EntranceAnnouncementCard(
    label: String,
    userName: String = "",
    avatarUrl: String? = null,
    onWelcomeClick: () -> Unit
) {
    val name = userName.ifBlank { label.substringBefore(" joined").substringBefore(" entered").ifBlank { label } }

    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Color(0xA6181729))
            .border(1.dp, Color(0x22FFFFFF), RoundedCornerShape(16.dp))
            .padding(horizontal = 10.dp, vertical = 7.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.weight(1f)
        ) {
            Avatar(name.take(1).uppercase(), 28, avatarUrl)

            Spacer(modifier = Modifier.width(8.dp))

            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("✨", fontSize = 11.sp)
                    Spacer(modifier = Modifier.width(3.dp))
                    Text(
                        text = name,
                        color = Color.White,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                Text(
                    text = "entered the room",
                    color = RoomGoldAccent,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium
                )
            }
        }

        // Welcome / Clap action button (purple pill button with clapping emoji)
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(50))
                .background(RoomPurplePrimary)
                .clickable(onClick = onWelcomeClick)
                .padding(horizontal = 14.dp, vertical = 6.dp),
            contentAlignment = Alignment.Center
        ) {
            Text("👏", fontSize = 16.sp)
        }
    }
}

/**
 * Tool item in the 4-square grid sheet
 */
@Composable
private fun ToolGridItem(
    glyph: String,
    label: String,
    onClick: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .width(72.dp)
            .clickable(onClick = onClick)
            .padding(vertical = 6.dp)
    ) {
        Box(
            modifier = Modifier
                .size(50.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(Color(0xFF231E38))
                .border(1.dp, RoomGlassBorder, RoundedCornerShape(16.dp)),
            contentAlignment = Alignment.Center
        ) {
            Text(glyph, fontSize = 22.sp)
        }
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            label,
            color = Color.White,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FriendInviteSheet(
    hosts: List<Host>,
    onDismiss: () -> Unit,
    onInvite: (String) -> Unit
) {
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = Color(0xFF141224)) {
        Column(
            verticalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 18.dp, vertical = 8.dp)
                .navigationBarsPadding()
        ) {
            Text("Invite Friends to Room", color = TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Black)
            if (hosts.isEmpty()) {
                Text("Follow people first, then invite them into rooms from here.", color = TextMuted)
            } else {
                LazyColumn(
                    modifier = Modifier.heightIn(max = 300.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(hosts.take(12), key = { it.id }) { host ->
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color(0x33FFFFFF))
                                .clickable { onInvite(host.id) }
                                .padding(10.dp)
                        ) {
                            Avatar(host.name.take(1), 38, host.avatar, host.activeCosmetics)
                            Spacer(modifier = Modifier.width(10.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(host.name, color = Color.White, fontWeight = FontWeight.Bold)
                                Text("@${host.username}", color = TextMuted, fontSize = 11.sp)
                            }
                            Text("Invite", color = RoomPurplePrimary, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}


@Composable
fun ActivityFeed(activity: List<RoomActivityItem>) {
    if (activity.isEmpty()) return
    GlassCard {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
            Text("LIVE ACTIVITY", color = TextMuted, fontSize = 10.sp, fontWeight = FontWeight.Black)
            activity.takeLast(4).forEach {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Box(Modifier.size(6.dp).background(Pink, CircleShape))
                    Text(it.label, color = TextPrimary, fontSize = 12.sp)
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RoomSettingsAndInfoSheet(
    room: Room,
    isHost: Boolean,
    isRoomAdmin: Boolean,
    participantCount: Int,
    onDismiss: () -> Unit,
    onFollowHost: () -> Unit,
    onOpenThemes: () -> Unit,
    onOpenTools: () -> Unit,
    onViewListeners: () -> Unit,
    onMinimize: () -> Unit,
    onExit: () -> Unit,
    onToast: (String) -> Unit
) {
    val context = LocalContext.current
    val host = room.host
    val cover = room.coverImage?.takeIf(String::isNotBlank)

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFF141224)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 10.dp)
                .navigationBarsPadding(),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // Room Avatar, Title, Unique ID
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(14.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(Brush.linearGradient(listOf(RoomPurplePrimary, Pink))),
                    contentAlignment = Alignment.Center
                ) {
                    if (!cover.isNullOrBlank()) {
                        AsyncImage(
                            model = cover,
                            contentDescription = "Room Avatar",
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Crop
                        )
                    } else {
                        Icon(Icons.Filled.Mic, contentDescription = null, tint = Color.White, modifier = Modifier.size(30.dp))
                    }
                }

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = room.title.ifBlank { "Voice Room" },
                        color = Color.White,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Black,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "Unique ID: ${room.id.takeLast(8)}",
                            color = Gold,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "Copy",
                            color = RoomPurplePrimary,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier
                                .clip(RoundedCornerShape(4.dp))
                                .background(Color(0x338D35F6))
                                .clickable {
                                    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                                    clipboard.setPrimaryClip(ClipData.newPlainText("Room ID", room.id))
                                    onToast("Room ID copied: ${room.id.takeLast(8)}")
                                }
                                .padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }
                }
            }

            // Description
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(Color(0xFF1E1A34))
                    .padding(12.dp)
            ) {
                Text("Room Vibe & Description", color = TextMuted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = room.description.ifBlank { "Welcome to our room! Join the live voice stream, share your thoughts, and vibe together." },
                    color = Color.White,
                    fontSize = 13.sp,
                    lineHeight = 18.sp
                )
            }

            // Follow / Unfollow Host Button
            if (host != null) {
                Button(
                    onClick = onFollowHost,
                    modifier = Modifier.fillMaxWidth().height(42.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (host.isFollowing) Color(0x33FFFFFF) else RoomPurplePrimary
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text(
                        text = if (host.isFollowing) "Following Room Host ?" else "+ Follow Room Host (${host.name})",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp
                    )
                }
            }

            // Room Perks Section
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(Color(0xFF1E1A34))
                    .padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Text("Room Perks & Privileges", color = Gold, fontSize = 12.sp, fontWeight = FontWeight.Black)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("💎", fontSize = 13.sp)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("1.5x Intimacy & Room XP on all gifts", color = Color.White, fontSize = 12.sp)
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("🎧", fontSize = 13.sp)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("High-Fidelity Spatial Audio Active", color = Color.White, fontSize = 12.sp)
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("👑", fontSize = 13.sp)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("VIP Stage Frame priority unlocked", color = Color.White, fontSize = 12.sp)
                }
            }

            // Cosmetics Section
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(Color(0xFF1E1A34))
                    .padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text("Room Cosmetics", color = Color(0xFFC084FC), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                Text("Theme: ${room.theme.ifBlank { "Cosmic Twilight" }}", color = TextMuted, fontSize = 12.sp)
                Text("Ambience: ${room.ambience.ifBlank { "Lofi Chill" }}", color = TextMuted, fontSize = 12.sp)
                if (room.badge.isNotBlank()) {
                    Text("Badge: ${room.badge}", color = Gold, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }

            if (isHost || isRoomAdmin) {
                Button(
                    onClick = onOpenThemes,
                    modifier = Modifier.fillMaxWidth().height(44.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF3B2D60)),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text("Customize Room Themes & Ambience", color = Gold, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                }
            }

            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = onOpenTools,
                    modifier = Modifier.weight(1.2f).height(42.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF3B2D60)),
                    shape = RoundedCornerShape(12.dp),
                    contentPadding = PaddingValues(horizontal = 8.dp)
                ) {
                    Icon(Icons.Filled.GridView, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(5.dp))
                    Text("Tools", fontSize = 12.sp, maxLines = 1)
                }
                Button(
                    onClick = onViewListeners,
                    modifier = Modifier.weight(1f).height(42.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF28243A)),
                    shape = RoundedCornerShape(12.dp),
                    contentPadding = PaddingValues(horizontal = 8.dp)
                ) {
                    Icon(Icons.Filled.Groups, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(5.dp))
                    Text("People � $participantCount", fontSize = 12.sp, maxLines = 1)
                }
            }
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = onMinimize,
                    modifier = Modifier.weight(1f).height(42.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF28243A)),
                    shape = RoundedCornerShape(12.dp),
                    contentPadding = PaddingValues(horizontal = 8.dp)
                ) {
                    Text("Minimize", fontSize = 12.sp, maxLines = 1)
                }
                Button(
                    onClick = onExit,
                    modifier = Modifier.weight(1f).height(42.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF8E3045)),
                    shape = RoundedCornerShape(12.dp),
                    contentPadding = PaddingValues(horizontal = 8.dp)
                ) {
                    Text(if (isHost) "End room" else "Leave", fontSize = 12.sp, maxLines = 1)
                }
            }

            Spacer(modifier = Modifier.height(10.dp))
        }
    }
}