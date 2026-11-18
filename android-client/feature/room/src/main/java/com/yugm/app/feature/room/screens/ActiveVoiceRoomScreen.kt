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
import androidx.compose.material.icons.filled.SportsEsports
import androidx.compose.material.icons.filled.SouthWest
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.ColorLens
import androidx.compose.material.icons.filled.BarChart
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
import androidx.compose.material.icons.filled.Repeat
import androidx.compose.material.icons.filled.RepeatOne
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.Shuffle
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.SkipPrevious
import androidx.compose.material.icons.filled.SentimentSatisfiedAlt
import androidx.compose.material.icons.filled.VolumeOff
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
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
import com.yugm.app.core.model.InventoryItem
import com.yugm.app.core.model.Host
import com.yugm.app.core.model.PkBattle
import com.yugm.app.core.model.PkLeaderboardEntry
import com.yugm.app.core.model.PkLiveEffect
import com.yugm.app.core.model.PkMode
import com.yugm.app.core.model.PkFormat
import com.yugm.app.core.model.PkOpponent
import com.yugm.app.core.model.PkSideType
import com.yugm.app.core.model.PkStatus
import com.yugm.app.core.model.Room
import com.yugm.app.core.model.RoomActivityItem
import com.yugm.app.core.model.RoomMission
import com.yugm.app.core.model.RoomParticipant
import com.yugm.app.core.model.YugmEvent
import com.yugm.app.core.model.RoomPoll
import com.yugm.app.core.model.RoomReaction
import com.yugm.app.core.model.RoomReactionEvent
import com.yugm.app.core.model.SpeakerRequest
import com.yugm.app.core.ui.components.AuroraBackground
import com.yugm.app.core.ui.components.Avatar
import com.yugm.app.core.ui.components.FloatingEmoji
import com.yugm.app.core.ui.components.FloatingEmojiOverlay
import com.yugm.app.core.ui.components.GiftPanel
import com.yugm.app.core.ui.components.GlassCard
import com.yugm.app.core.ui.components.PkBattleHeader
import com.yugm.app.core.ui.components.PkPreparationCard
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
import com.yugm.app.core.ui.components.PrefetchReactionAssets
import com.yugm.app.core.ui.components.ReactionArtwork
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
    giftInventory: List<InventoryItem> = emptyList(),
    onInventoryGift: (GiftItem, String, String) -> Unit = { _, _, _ -> },
    onToast: (String) -> Unit,
    onJoin: () -> Unit,
    participants: List<RoomParticipant> = emptyList(),
    inviteCandidates: List<Host> = emptyList(),
    roomInviteFollowers: List<Host> = emptyList(),
    inviteFriends: List<Host> = emptyList(),
    roomEvents: List<YugmEvent> = emptyList(),
    isFollowingRoom: Boolean = false,
    onToggleRoomFollow: () -> Unit = {},
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
    onInviteFriend: (List<String>) -> Unit = {},
    onDirectMessage: (String?) -> Unit = {},
    onOpenProfile: (String) -> Unit = {},
    onMinimize: () -> Unit = {},
    onReact: (String) -> Unit = {},
    onLoadPkOpponents: (String) -> Unit = {},
    onCreateRoomPk: (List<String>, List<String>, PkFormat, PkMode, Int, String?) -> Unit = { _, _, _, _, _, _ -> },
    onVotePk: (PkSideType) -> Unit = {},
    onReadyPk: () -> Unit = {},
    onClosePk: () -> Unit = {},
    onInvitePk: (PkOpponent, PkMode, Int, String) -> Unit = { _, _, _, _ -> },
    onAutoMatchPk: (PkMode, Int, String) -> Unit = { _, _, _ -> },
    onSendPkGift: (GiftItem, PkSideType, Int) -> Unit = { _, _, _ -> },
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
    currentUserVipLevel: Int = 0,
    onSendImage: (Uri) -> Unit = {},
    reactionCatalogLoading: Boolean = false,
    reactionCatalogError: String? = null,
    onReloadReactions: () -> Unit = {},
    onOpenThemes: (() -> Unit)? = null,
    onEditRoom: (() -> Unit)? = null,
    onRefreshRoom: () -> Unit = {},
    canSpeak: Boolean = participants.any {
        it.user.id == currentUserId && it.role in listOf("HOST", "SPEAKER", "MODERATOR")
    },
    badgeToken: String = "",
    onOpenBonds: ((String) -> Unit)? = null
) {
    DisposableEffect(room.id) {
        onJoin()
        onDispose { }
    }

    PrefetchReactionAssets(roomReactions.map { it.assetUrl })

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
        if (roomEndedVersion > 0 && !isHost && !isRoomAdmin) {
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
    var pkGiftQuantity by rememberSaveable { mutableStateOf(1) }
    var dismissedPkResultId by rememberSaveable { mutableStateOf<String?>(null) }
    var selectedParticipant by remember { mutableStateOf<RoomParticipant?>(null) }
    var selectedEmptySeat by remember { mutableStateOf<Int?>(null) }
    var showReactionPicker by rememberSaveable(room.id) { mutableStateOf(false) }
    val openReactions = {
        showReactionPicker = true
        onReloadReactions()
    }
    var showExitPrompt by rememberSaveable { mutableStateOf(false) }
    var showFollowRoomPrompt by rememberSaveable(room.id) { mutableStateOf(false) }
    val latestParticipants by androidx.compose.runtime.rememberUpdatedState(participants)
    val latestRoomFollowState by androidx.compose.runtime.rememberUpdatedState(isFollowingRoom)
    LaunchedEffect(room.id, currentUserId, isHost) {
        if (!isHost && currentUserId.isNotBlank()) {
            delay(10_000)
            if (!latestRoomFollowState && latestParticipants.any { it.user.id == currentUserId }) showFollowRoomPrompt = true
        }
    }
    var showToolsSheet by rememberSaveable { mutableStateOf(false) }
    var showMusicSheet by rememberSaveable { mutableStateOf(false) }
    var showMusicLibrary by rememberSaveable { mutableStateOf(false) }
    var showMusicQueue by rememberSaveable { mutableStateOf(false) }
    var roomMusicQueue by remember(room.id) { mutableStateOf(emptyList<RoomMusicItem>()) }
    var roomMusicIndex by rememberSaveable(room.id) { mutableStateOf(-1) }
    var roomMusicPlaying by rememberSaveable(room.id) { mutableStateOf(false) }
    var roomMusicLoaded by rememberSaveable(room.id) { mutableStateOf(false) }
    var roomMusicVolume by rememberSaveable(room.id) { mutableStateOf(0.8f) }
    var roomMusicShuffle by rememberSaveable(room.id) { mutableStateOf(false) }
    var roomMusicRepeatMode by rememberSaveable(room.id) { mutableStateOf("OFF") } // OFF, ALL, ONE
    var roomMusicDurationMs by remember(room.id) { mutableStateOf(0L) }
    var roomMusicPositionMs by remember(room.id) { mutableStateOf(0L) }
    var roomMusicUserSeeking by remember { mutableStateOf(false) }
    var musicControlsOffset by remember(room.id) { mutableStateOf(Offset.Zero) }
    var pendingMusicUri by remember { mutableStateOf<Uri?>(null) }
    var pendingMusicIndex by remember { mutableStateOf(-1) }
    var showListenersSheet by rememberSaveable { mutableStateOf(false) }
    var showLuckyWheelDialog by rememberSaveable { mutableStateOf(false) }
    var showRoomInfoSheet by rememberSaveable { mutableStateOf(false) }
    var chatMessageDraft by rememberSaveable { mutableStateOf("") }
    val roomImagePicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri -> uri?.let(onSendImage) }
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
    fun queryMusicDurationMs(uri: Uri): Long = runCatching {
        val retriever = android.media.MediaMetadataRetriever()
        try {
            context.contentResolver.openFileDescriptor(uri, "r")?.use { pfd ->
                retriever.setDataSource(pfd.fileDescriptor)
            } ?: retriever.setDataSource(context, uri)
            retriever.extractMetadata(android.media.MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
        } finally {
            runCatching { retriever.release() }
        }
    }.getOrDefault(0L)

    fun playRoomMusic(index: Int, seekToMs: Long = 0L) {
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
            val duration = if (index == roomMusicIndex && roomMusicDurationMs > 0 && seekToMs > 0) roomMusicDurationMs else queryMusicDurationMs(item.uri)
            val started = runCatching { YugmMediaRoom.startRoomMusic(item.uri, seekToMs) }.getOrDefault(false)
            if (started) {
                roomMusicIndex = index
                roomMusicPlaying = true
                roomMusicLoaded = true
                if (duration > 0) roomMusicDurationMs = duration
                roomMusicPositionMs = seekToMs.coerceAtLeast(0L)
            } else onToast("Could not share this track. Try another audio file or reconnect to the room.")
        }
    }

    fun playNextRoomMusic(auto: Boolean = false) {
        if (roomMusicQueue.isEmpty()) return
        if (auto && roomMusicRepeatMode == "ONE" && roomMusicIndex >= 0) {
            playRoomMusic(roomMusicIndex, 0L)
            return
        }
        val nextIndex = when {
            roomMusicShuffle && roomMusicQueue.size > 1 -> {
                val candidates = roomMusicQueue.indices.filter { it != roomMusicIndex }
                if (candidates.isEmpty()) roomMusicIndex else candidates.random()
            }
            roomMusicIndex >= roomMusicQueue.lastIndex -> {
                if (roomMusicRepeatMode == "ALL" || !auto) 0 else -1
            }
            else -> roomMusicIndex + 1
        }
        if (nextIndex >= 0) playRoomMusic(nextIndex) else {
            roomMusicPlaying = false
            roomMusicPositionMs = roomMusicDurationMs
        }
    }

    fun playPreviousRoomMusic() {
        if (roomMusicQueue.isEmpty()) return
        if (roomMusicPositionMs > 3000 && roomMusicIndex >= 0) {
            playRoomMusic(roomMusicIndex, 0L)
            return
        }
        val prevIndex = when {
            roomMusicIndex <= 0 -> if (roomMusicRepeatMode == "ALL") roomMusicQueue.lastIndex else 0
            else -> roomMusicIndex - 1
        }
        playRoomMusic(prevIndex.coerceAtLeast(0))
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
                roomMusicPositionMs = roomMusicDurationMs
                playNextRoomMusic(auto = true)
            }
            com.yugm.app.core.api.RoomMusicPlaybackState.ERROR -> {
                roomMusicPlaying = false
                roomMusicLoaded = false
                roomMusicPositionMs = 0L
                scope.launch { YugmMediaRoom.stopRoomMusic() }
                onToast(roomMusicPlaybackStatus.error.ifBlank { "This audio file could not be played. Try another track." })
            }
            else -> Unit
        }
    }
    LaunchedEffect(roomMusicPlaying, roomMusicLoaded, roomMusicUserSeeking, room.id) {
        while (roomMusicPlaying && roomMusicLoaded && !roomMusicUserSeeking) {
            kotlinx.coroutines.delay(500)
            if (!roomMusicPlaying || roomMusicUserSeeking) break
            val next = roomMusicPositionMs + 500
            roomMusicPositionMs = if (roomMusicDurationMs > 0) next.coerceAtMost(roomMusicDurationMs) else next
        }
    }

    BackHandler { showExitPrompt = true }

    // Live gift payloads carry the image URL; show only gift image (simple fade).
    LaunchedEffect(roomGiftEvent.first) {
        val event = roomGiftEvent.second ?: return@LaunchedEffect
        val catalogGift = gifts.firstOrNull { it.id == event.giftId || it.name.equals(event.giftName, ignoreCase = true) }
        val gift = catalogGift?.copy(icon = event.giftIcon.ifBlank { catalogGift.icon })
            ?: GiftItem(id = event.giftId, name = event.giftName, price = event.price, icon = event.giftIcon.ifBlank { "🎁" })
        activeGiftBanner = event.senderName.ifBlank { "Someone" } to gift
    }

    LaunchedEffect(activeGiftBanner) {
        if (activeGiftBanner != null) {
            delay(1800)
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
                if (seatReactions[seatIdx] === normalized) {
                    seatReactions.remove(seatIdx)
                }
            }
        } else {
            floatingReaction = normalized
            scope.launch {
                delay(1800)
                if (floatingReaction === normalized) {
                    floatingReaction = null
                }
            }
        }
    }

    val speakers = participants.filter { it.role in listOf("HOST", "SPEAKER", "MODERATOR") }
    val chatListState = rememberLazyListState()

    LaunchedEffect(chat.size) {
        if (chat.isNotEmpty()) {
            val layout = chatListState.layoutInfo
            val lastVisible = layout.visibleItemsInfo.lastOrNull()?.index ?: -1
            // Don't yank the user away from history when new messages arrive.
            if (lastVisible >= layout.totalItemsCount - 2) {
                chatListState.animateScrollToItem((layout.totalItemsCount - 1).coerceAtLeast(0))
            }
        }
    }

    GiftPanel(
        open = giftOpen,
        gifts = gifts,
        balance = balance,
        diamondBalance = diamondBalance,
        currentUserVipLevel = currentUserVipLevel,
        participants = participants,
        currentUserId = currentUserId,
        inventory = giftInventory,
        onDismiss = { giftOpen = false },
        onOpenBondGifts = onOpenBonds?.let { open -> { target -> giftOpen = false; open(target) } },
        onSend = { gift ->
            onGift(gift, "COINS", giftRecipientId)
            giftRecipientId = room.host?.id.orEmpty()
        },
        onSendWithCurrency = { gift, currency ->
            onGift(gift, currency, giftRecipientId)
            giftRecipientId = room.host?.id.orEmpty()
        },
        onSendToRecipients = { gift, currency, recipientIds ->
            recipientIds.forEach { recipientId -> onGift(gift, currency, recipientId) }
            giftRecipientId = room.host?.id.orEmpty()
        },
        onSendInventory = { item, recipientIds ->
            val inventoryGift = item.gift
            if (inventoryGift != null && item.quantity >= recipientIds.size) {
                val gift = GiftItem(
                    id = inventoryGift.id,
                    name = inventoryGift.name,
                    price = inventoryGift.coinPrice,
                    diamondPrice = inventoryGift.diamondPrice,
                    icon = inventoryGift.icon,
                    rarity = inventoryGift.rarity,
                    category = inventoryGift.category,
                    tradable = inventoryGift.tradable,
                    upgradeable = inventoryGift.upgradeable
                )
                recipientIds.forEach { recipientId -> onInventoryGift(gift, recipientId, item.id) }
            } else if (inventoryGift != null) {
                onToast("You need one copy of this gift for each selected person")
            }
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
                .background(Brush.verticalGradient(if (room.host?.isVip == true) listOf(Color(0x775B2B85), Color(0x9952174A), Color(0xB31C132B), Color(0xF00A0915)) else listOf(Color(0x772B1055), Color(0x9952174A), Color(0xB31C132B), Color(0xF00A0915))))
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
                onViewListeners = { showListenersSheet = true },
                isFollowingRoom = isFollowingRoom,
                onToggleRoomFollow = onToggleRoomFollow,
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
                if (pkBattle != null && pkBattle.status in listOf(PkStatus.ACTIVE, PkStatus.FINAL_CRUNCH)) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 14.dp)
                            .align(Alignment.TopCenter),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        PkBattleHeader(pkBattle, isHost = isHost || isRoomAdmin, onEnd = onEndPk)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            PkSideCard(pkBattle.left, PkSideType.LEFT, pkBattle.leader == PkSideType.LEFT, modifier = Modifier.weight(1f))
                            PkSideCard(pkBattle.right, PkSideType.RIGHT, pkBattle.leader == PkSideType.RIGHT, modifier = Modifier.weight(1f))
                        }
                        PkBattleScoreBar(pkBattle)
                        if (pkBattle.mode == PkMode.VOTE) {
                            PkRoomVoteActions(pkBattle, onVote = onVotePk)
                        } else if (pkBattle.selectedGiftId.isNotBlank()) {
                            val pkGift = gifts.firstOrNull { it.id == pkBattle.selectedGiftId }
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                                Surface(shape = RoundedCornerShape(14.dp), color = Color(0xFF242230)) {
                                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp)) {
                                        Text("−", Modifier.clickable { pkGiftQuantity = (pkGiftQuantity - 1).coerceAtLeast(1) }, fontSize = 20.sp)
                                        Text("$pkGiftQuantity", fontWeight = FontWeight.Bold)
                                        Text("+", Modifier.clickable { pkGiftQuantity = (pkGiftQuantity + 1).coerceAtMost(99) }, fontSize = 20.sp)
                                    }
                                }
                                listOf(PkSideType.LEFT, PkSideType.RIGHT).forEach { side ->
                                    Button(
                                        onClick = { if (pkGift != null) onSendPkGift(pkGift, side, pkGiftQuantity) },
                                        enabled = pkGift != null && currentUserId != (if (side == PkSideType.LEFT) pkBattle.left.hostId else pkBattle.right.hostId),
                                        modifier = Modifier.weight(1f),
                                        colors = ButtonDefaults.buttonColors(containerColor = if (side == PkSideType.LEFT) Color(0xFFF4B942) else Color(0xFF299FE8)),
                                        shape = RoundedCornerShape(16.dp)
                                    ) { Text("Support ${if (side == PkSideType.LEFT) pkBattle.left.hostName else pkBattle.right.hostName}", maxLines = 1) }
                                }
                            }
                        }
                        PkLiveEffectBurst(pkLiveEffect)
                    }
                } else if (pkBattle != null && pkBattle.status in listOf(PkStatus.PREPARING, PkStatus.READY, PkStatus.COUNTDOWN)) {
                    PkPreparationCard(pkBattle, currentUserId, onReadyPk)
                } else if (pkBattle != null && pkBattle.status == PkStatus.INVITED && (isHost || isRoomAdmin) && pkBattle.right.roomId == room.id && !pkInviteId.isNullOrBlank()) {
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
                            vipLevel = participants.firstOrNull { it.user.id == item.userId }?.user?.takeIf { it.isVip }?.vipLevel ?: 0,
                            onWelcomeClick = {
                                onReact("clap")
                                onToast("Welcomed to the room! 👏")
                            }
                        )
                    }

                    // Chat messages
                    items(chat.takeLast(16), key = { msg -> msg.id.ifBlank { "${msg.authorId}|${msg.createdAt}|${msg.text}" } }) { msg ->
                        val vipAuthor = msg.authorId.isNotBlank() && participants.firstOrNull { it.user.id == msg.authorId }?.user?.isVip == true
                        Column(
                            modifier = Modifier
                                .widthIn(max = 280.dp)
                                .clip(RoundedCornerShape(14.dp))
                                .background(if (vipAuthor) Brush.linearGradient(listOf(Color(0xAA34233F), Color(0xAA17141F))) else Brush.linearGradient(listOf(Color(0x88141424), Color(0x88141424))))
                                .border(1.dp, if (vipAuthor) Color(0x99EBC77D) else Color(0x1AFFFFFF), RoundedCornerShape(14.dp))
                                .padding(horizontal = 10.dp, vertical = 6.dp)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(text = msg.author, color = if (msg.author == "System") Pink else Color(0xFFC084FC), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                if (vipAuthor) {
                                    Text("  ✦ VIP frame", color = Color(0xFFFFD477), fontSize = 9.sp, fontWeight = FontWeight.Black)
                                }
                            }
                            if (msg.mediaType == "IMAGE" && !msg.mediaUrl.isNullOrBlank()) {
                                AsyncImage(model = resolveMediaUrl(msg.mediaUrl), contentDescription = "Room photo shared by ${msg.author}", contentScale = ContentScale.Crop, modifier = Modifier.padding(top = 6.dp).size(width = 190.dp, height = 130.dp).clip(RoundedCornerShape(10.dp)))
                            }
                            if (msg.text.isNotBlank() && msg.text != "Shared a photo") Text(msg.text, color = Color.White, fontSize = 12.sp)
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
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    if (isCurrentUserVip && currentUserVipLevel >= 4) {
                        IconButton(onClick = { roomImagePicker.launch("image/*") }, modifier = Modifier.size(38.dp).clip(CircleShape).background(Color(0x66201B2B)).semantics { contentDescription = "Share a room image" }) {
                            Text("＋", color = Color.White, fontSize = 23.sp, fontWeight = FontWeight.Medium)
                        }
                    }
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
                        onClick = openReactions,
                        modifier = Modifier.size(36.dp).clip(CircleShape)
                            .background(RoomSheetAction.copy(alpha = 0.26f))
                            .border(1.dp, RoomSheetAccent.copy(alpha = 0.3f), CircleShape)
                    ) {
                        Icon(
                            Icons.Filled.SentimentSatisfiedAlt,
                            contentDescription = "Open live reactions",
                            tint = RoomSheetAccent,
                            modifier = Modifier.size(19.dp)
                        )
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

        // Gift animation: image only, simple fade in/out
        AnimatedVisibility(
            visible = activeGiftBanner != null,
            enter = fadeIn(animationSpec = tween(220)),
            exit = fadeOut(animationSpec = tween(260)),
            modifier = Modifier.align(Alignment.Center)
        ) {
            activeGiftBanner?.let { (_, gift) ->
                GiftCelebrationArtwork(gift, Modifier.size(140.dp))
            }
        }

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
        RoomOverviewTabsSheet(
            room = room,
            isHost = isHost,
            isRoomAdmin = isRoomAdmin,
            participantCount = participants.size,
            roomFollowers = roomInviteFollowers,
            events = roomEvents,
            onFollowUser = onFollowUser,
            onUnfollowUser = onUnfollowUser,
            onDismiss = { showRoomInfoSheet = false },
            onFollowHost = {
                room.host?.let { h ->
                    if (h.isFollowing) onUnfollowUser(h.id) else onFollowUser(h.id)
                    onToast(if (h.isFollowing) "Unfollowed room host" else "Following room host")
                }
            },
            onEditRoomSettings = {
                showRoomInfoSheet = false
                onEditRoom?.invoke()
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
        VoiceRoomToolsSheet(
            tools = buildList {
                add(VoiceRoomTool("Reactions", Icons.Filled.SentimentSatisfiedAlt, openReactions))
                add(VoiceRoomTool("Invite", Icons.Filled.PersonAdd) { showInvitePicker = true })
                add(VoiceRoomTool("Music player", Icons.Filled.MusicNote) { showMusicSheet = true })
                add(VoiceRoomTool(
                    if (roomAudioMuted) "Unmute audio" else "Mute audio",
                    if (roomAudioMuted) Icons.Filled.VolumeOff else Icons.Filled.VolumeUp
                ) {
                    roomAudioMuted = !roomAudioMuted
                    YugmMediaRoom.setRoomAudioMuted(roomAudioMuted)
                    onToast(if (roomAudioMuted) "Room audio muted" else "Room audio unmuted")
                })
                if (isHost || isRoomAdmin) {
                    add(VoiceRoomTool("PK battle", Icons.Filled.EmojiEvents) { showPkSetup = true })
                    add(VoiceRoomTool("Settings", Icons.Filled.Settings) { showRoomInfoSheet = true })
                }
                if (isHost) add(VoiceRoomTool("Poll", Icons.Filled.BarChart) { showPollComposer = true })
                onOpenThemes?.let { add(VoiceRoomTool("Themes", Icons.Filled.ColorLens, it)) }
                onOpenModes?.let { add(VoiceRoomTool("Modes", Icons.Filled.SportsEsports, it)) }
                room.host?.id?.takeUnless { isHost }?.let { hostId ->
                    add(VoiceRoomTool("Message host", Icons.Filled.Chat) { onDirectMessage(hostId) })
                }
                add(VoiceRoomTool("Lucky wheel", Icons.Filled.Casino) { showLuckyWheelDialog = true })
                add(VoiceRoomTool("Minimize", Icons.Filled.SouthWest, onMinimize))
            },
            onDismiss = { showToolsSheet = false }
        )
    }

    if (showMusicSheet && !showMusicLibrary) {
        VoiceRoomSheet(onDismiss = { showMusicSheet = false }) {
            Column(
                modifier = Modifier.fillMaxWidth().verticalScroll(rememberScrollState())
                    .padding(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 18.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                VoiceRoomSheetHeader(
                    title = "Room music",
                    icon = Icons.Filled.MusicNote,
                    subtitle = "Play a track for everyone in the room"
                ) {
                    IconButton(onClick = { showMusicQueue = !showMusicQueue }) {
                        Icon(
                            Icons.Filled.QueueMusic,
                            contentDescription = if (showMusicQueue) "Hide music queue" else "Show music queue",
                            tint = if (showMusicQueue) RoomSheetAccent else RoomSheetMuted
                        )
                    }
                }

                Surface(color = RoomSheetTile, shape = RoundedCornerShape(18.dp), border = BorderStroke(1.dp, RoomSheetBorder)) {
                    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            Box(Modifier.size(48.dp).clip(RoundedCornerShape(14.dp)).background(Color(0xFF302344)), contentAlignment = Alignment.Center) {
                                Icon(Icons.Filled.MusicNote, null, tint = Color(0xFFFF8DC3), modifier = Modifier.size(24.dp))
                            }
                            Column(Modifier.weight(1f)) {
                                Text(roomMusicQueue.getOrNull(roomMusicIndex)?.title ?: "Choose a track", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
                                Text(
                                    when {
                                        roomMusicPlaying -> "Streaming to everyone in the room"
                                        roomMusicLoaded -> "Paused"
                                        else -> "Pick a track and let the room listen"
                                    },
                                    color = Color(0xFFAAA6B8), fontSize = 11.sp, maxLines = 1
                                )
                            }
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                IconButton(onClick = ::playPreviousRoomMusic, modifier = Modifier.size(34.dp)) {
                                    Icon(Icons.Filled.SkipPrevious, "Previous track", tint = Color(0xFFD4CDDE), modifier = Modifier.size(20.dp))
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
                                    modifier = Modifier.size(40.dp).clip(CircleShape).background(Color(0xFFE83E91))
                                ) {
                                    Icon(if (roomMusicPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow, contentDescription = if (roomMusicPlaying) "Pause room music" else "Play room music", tint = Color.White)
                                }
                                IconButton(onClick = { playNextRoomMusic() }, modifier = Modifier.size(34.dp)) {
                                    Icon(Icons.Filled.SkipNext, "Next track", tint = Color(0xFFD4CDDE), modifier = Modifier.size(20.dp))
                                }
                                IconButton(onClick = { roomMusicShuffle = !roomMusicShuffle }, modifier = Modifier.size(32.dp)) {
                                    Icon(
                                        Icons.Filled.Shuffle,
                                        contentDescription = if (roomMusicShuffle) "Shuffle on" else "Shuffle off",
                                        tint = if (roomMusicShuffle) Color(0xFFFF79BC) else Color(0xFFD4CDDE),
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                                IconButton(onClick = {
                                    roomMusicRepeatMode = when (roomMusicRepeatMode) {
                                        "OFF" -> "ALL"
                                        "ALL" -> "ONE"
                                        else -> "OFF"
                                    }
                                }, modifier = Modifier.size(32.dp)) {
                                    Icon(
                                        if (roomMusicRepeatMode == "ONE") Icons.Filled.RepeatOne else Icons.Filled.Repeat,
                                        contentDescription = when (roomMusicRepeatMode) { "ALL" -> "Repeat all"; "ONE" -> "Repeat one"; else -> "Repeat off" },
                                        tint = if (roomMusicRepeatMode == "OFF") Color(0xFFD4CDDE) else Color(0xFFFF79BC),
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                            }
                        }
                        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Slider(
                                value = if (roomMusicDurationMs > 0) roomMusicPositionMs.coerceIn(0L, roomMusicDurationMs).toFloat() else 0f,
                                onValueChange = { value ->
                                    roomMusicUserSeeking = true
                                    roomMusicPositionMs = value.toLong()
                                },
                                onValueChangeFinished = {
                                    val seekTo = roomMusicPositionMs.coerceAtLeast(0L)
                                    roomMusicUserSeeking = false
                                    if (roomMusicIndex >= 0 && (roomMusicLoaded || roomMusicPlaying)) {
                                        playRoomMusic(roomMusicIndex, seekTo)
                                    }
                                },
                                valueRange = 0f..(roomMusicDurationMs.coerceAtLeast(1L).toFloat()),
                                enabled = roomMusicIndex >= 0 && (roomMusicLoaded || roomMusicPlaying),
                                modifier = Modifier.fillMaxWidth(),
                                colors = SliderDefaults.colors(
                                    thumbColor = Color(0xFFFF79BC),
                                    activeTrackColor = Color(0xFFE83E91),
                                    inactiveTrackColor = Color(0xFF41384F),
                                    disabledThumbColor = Color(0xFF6B6478),
                                    disabledActiveTrackColor = Color(0xFF5A4A63),
                                    disabledInactiveTrackColor = Color(0xFF41384F)
                                )
                            )
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text(formatRoomMusicTime(roomMusicPositionMs), color = Color(0xFFAAA6B8), fontSize = 11.sp)
                                Text(formatRoomMusicTime(roomMusicDurationMs), color = Color(0xFFAAA6B8), fontSize = 11.sp)
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
                        label = "Queue • ${roomMusicQueue.size}",
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

    if (showReactionPicker) {
        VoiceRoomReactionSheet(
            reactions = roomReactions,
            loading = reactionCatalogLoading,
            error = reactionCatalogError,
            onRetry = onReloadReactions,
            onDismiss = { showReactionPicker = false },
            onReact = onReact
        )
    }

    if (showLuckyWheelDialog) {
        VoiceRoomWheelPreviewSheet(onDismiss = { showLuckyWheelDialog = false })
    }

    // 6. Audience / Listeners Sheet
    if (showListenersSheet) {
        OnlineUsersSheet(
            participants = participants,
            currentUserId = currentUserId,
            hostId = room.host?.id.orEmpty(),
            onDismiss = { showListenersSheet = false },
            onRefresh = onRefreshRoom,
            onFollow = onFollowUser,
            onUnfollow = onUnfollowUser
        )
    }

    selectedEmptySeat?.let { seatIndex ->
        val locked = seatIndex in room.lockedSeatIndices
        VoiceRoomSeatSheet(
            seatIndex = seatIndex,
            locked = locked,
            canManage = isHost || isRoomAdmin,
            onDismiss = { selectedEmptySeat = null },
            onTakeSeat = {
                selectedEmptySeat = null
                onTakeSeat(seatIndex)
            },
            onToggleLock = {
                selectedEmptySeat = null
                onSetSeatLocked(seatIndex, !locked)
            }
        )
    }

    // 8. Selected Participant Details Sheet
    selectedParticipant?.let { target ->
        val isSelf = target.user.id == currentUserId
        val targetIsHost = target.role == "HOST" || target.user.id == room.host?.id
        val canManageTarget = !isSelf && !targetIsHost && (!target.isRoomAdmin || isHost)
        VoiceRoomSheet(onDismiss = { selectedParticipant = null }) {
            Column(
                Modifier.fillMaxWidth().heightIn(max = 690.dp).verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp).padding(bottom = 22.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box(
                    Modifier.fillMaxWidth().height(112.dp).clip(RoundedCornerShape(18.dp))
                        .background(Brush.verticalGradient(listOf(RoomSheetTile, Color.Transparent))),
                    contentAlignment = Alignment.Center
                ) {
                    Box(Modifier.size(86.dp).clip(CircleShape)
                        .background(Brush.linearGradient(listOf(RoomSheetAccent, RoomSheetAction)))
                        .padding(3.dp), contentAlignment = Alignment.Center) {
                        Avatar(target.user.name.take(1), 70, target.user.avatar, target.user.activeCosmetics)
                    }
                    IconButton(onClick = { selectedParticipant = null }, modifier = Modifier.align(Alignment.TopEnd)) {
                        Icon(Icons.Filled.Close, contentDescription = "Close participant profile", tint = RoomSheetMuted)
                    }
                }
                Text(target.user.name.ifBlank { "Yugm user" }, color = RoomSheetText, fontSize = 21.sp, fontWeight = FontWeight.Bold)
                Text(
                    buildString {
                        append("ID: ${target.user.id.takeLast(10)}")
                        if (target.user.city.isNotBlank()) append(" • ${target.user.city}")
                    },
                    color = RoomSheetMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp)
                )
                Row(Modifier.padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    ProfileInfoChip("Lv.${target.user.level}", Color(0xFF547BB8))
                    if (target.user.isVip) ProfileInfoChip(target.user.vipTier.ifBlank { "VIP" }, Gold.copy(alpha = .85f))
                    if (target.isRoomAdmin && !targetIsHost) RoomRoleBadge("ROOM ADMIN", Color(0xFFC8A2FF), "🛡")
                    else ProfileInfoChip(if (targetIsHost) "Host" else target.role.lowercase().replaceFirstChar { it.uppercase() }, PrimaryPurple.copy(alpha = .8f))
                    target.seatIndex?.let { ProfileInfoChip("Mic ${it + 1}", Pink.copy(alpha = .75f)) }
                }
                RoomProfileBadges(badgeToken, target.user.id)
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
                    if (!isSelf) ProfileActionButton(if (target.user.isFollowing) "✓ Following" else "♡  Follow", listOf(Color(0xFF08AEEA), Color(0xFF297DE2)), Modifier.weight(1f)) {
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
                if (onOpenBonds != null) TextButton(onClick = {
                    selectedParticipant = null
                    onOpenBonds(if (isSelf) "" else target.user.id)
                }) { Text("Bonds", color = RoomSheetAccent) }
                if (isSelf && target.role in listOf("HOST", "SPEAKER", "MODERATOR")) {
                    ProfileActionButton("Leave microphone", listOf(Color(0xFF6C334B), Color(0xFF3D2336)), Modifier.fillMaxWidth().padding(top = 10.dp)) {
                        onLeaveSeat(); selectedParticipant = null; onToast("You left the mic and returned to the audience")
                    }
                }
                if (!isSelf) {
                    ProfileActionButton("🎁  Send gifts", listOf(Color(0xFFEA477D), Color(0xFFC72F9F)), Modifier.fillMaxWidth().padding(top = 10.dp)) {
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
            roomFollowers = roomInviteFollowers,
            friends = inviteFriends,
            roomId = room.id,
            roomTitle = room.title,
            onDismiss = { showInvitePicker = false },
            onInvite = { ids ->
                showInvitePicker = false
                onInviteFriend(ids)
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
    if (showPkSetup && (isHost || isRoomAdmin)) {
        RoomPkSetupSheet(
            participants = participants,
            gifts = gifts,
            onDismiss = { showPkSetup = false },
            onStart = { left, right, format, mode, duration, giftId ->
                showPkSetup = false
                onCreateRoomPk(left, right, format, mode, duration, giftId)
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
        onDismiss = {
            if (isHost || isRoomAdmin) onClosePk()
            dismissedPkResultId = pkBattle?.id
        },
        onRematch = {
            if (isHost || isRoomAdmin) onClosePk()
            dismissedPkResultId = pkBattle?.id
            showPkSetup = true
        }
    )

    // 12. Exit Confirmation Prompt
    if (showExitPrompt) {
        RoomExitOverlay(
            participants = participants,
            currentUserId = currentUserId,
            isHost = isHost,
            onDismiss = { showExitPrompt = false },
            onMinimize = { showExitPrompt = false; onMinimize() },
            onCloseRoom = { showExitPrompt = false; if (isHost || isRoomAdmin) onEndRoom() else onBack() },
            onFollow = onFollowUser
        )
    }
    if (showFollowRoomPrompt) {
        RoomFollowPromptDialog(
            room = room,
            onDismiss = { showFollowRoomPrompt = false },
            onFollow = { showFollowRoomPrompt = false; onToggleRoomFollow() }
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
        query.contains("diya", true) -> "🪔"
        query.contains("rose", true) -> "🌹"
        query.contains("crown", true) -> "👑"
        query.contains("lotus", true) -> "🪷"
        query.contains("heart", true) -> "❤️"
        query.contains("ring", true) -> "💍"
        query.contains("car", true) -> "🏎️"
        query.contains("diamond", true) -> "💎"
        query.contains("fire", true) -> "🔥"
        query.contains("rocket", true) -> "🚀"
        query.contains("mic", true) -> "🎤"
        query.contains("cake", true) -> "🎂"
        query.contains("bear", true) -> "🧸"
        query.contains("star", true) -> "⭐"
        else -> {
            if (icon.isNotBlank() && icon.length <= 4 && !icon.any { it.isLetterOrDigit() }) icon
            else "🎁"
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

private fun formatRoomMusicTime(ms: Long): String {
    val totalSeconds = (ms.coerceAtLeast(0L) / 1000L)
    val minutes = totalSeconds / 60
    val seconds = totalSeconds % 60
    return "%d:%02d".format(minutes, seconds)
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
                        ReactionArtwork(
                            emoji = reaction.emoji,
                            assetUrl = reaction.assetUrl,
                            label = reaction.label.ifBlank { reaction.reactionId },
                            emojiSize = 24.sp,
                            modifier = Modifier.size(32.dp)
                        )
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
    vipLevel: Int = 0,
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
                    Text(if (vipLevel >= 4) "🚘" else "✦", fontSize = 11.sp)
                    Spacer(modifier = Modifier.width(3.dp))
                    Text(
                        text = name,
                        color = Color.White,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    if (vipLevel > 0) Text(" VIP$vipLevel", color = Color(0xFFFFD477), fontSize = 9.sp, fontWeight = FontWeight.Black)
                }
                Text(
                    text = when {
                        vipLevel >= 4 -> "arrived in a VIP car · ${name} joined the room"
                        vipLevel >= 2 -> "${name} joined · VIP entrance"
                        else -> "entered the room"
                    },
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
private fun PkRoomVoteActions(battle: PkBattle, onVote: (PkSideType) -> Unit) {
    val alreadyVoted = battle.myVote != null
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        listOf(PkSideType.LEFT, PkSideType.RIGHT).forEach { side ->
            val contestant = if (side == PkSideType.LEFT) battle.left else battle.right
            Button(
                onClick = { onVote(side) },
                enabled = !alreadyVoted,
                modifier = Modifier.weight(1f),
                colors = ButtonDefaults.buttonColors(containerColor = if (side == PkSideType.LEFT) Color(0xFFF4B942) else Color(0xFF299FE8)),
                shape = RoundedCornerShape(16.dp)
            ) { Text(if (alreadyVoted) "Vote submitted" else "Vote ${contestant.hostName}", maxLines = 1) }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RoomPkSetupSheet(
    participants: List<RoomParticipant>,
    gifts: List<GiftItem>,
    onDismiss: () -> Unit,
    onStart: (List<String>, List<String>, PkFormat, PkMode, Int, String?) -> Unit
) {
    var format by remember { mutableStateOf(PkFormat.PLAYER) }
    var mode by remember { mutableStateOf(PkMode.GIFT) }
    var leftIds by remember { mutableStateOf<List<String>>(emptyList()) }
    var rightIds by remember { mutableStateOf<List<String>>(emptyList()) }
    var teamSize by remember { mutableStateOf(2) }
    var duration by remember { mutableStateOf(180) }
    var giftId by remember { mutableStateOf("") }
    val micUsers = participants.filter { it.role in listOf("HOST", "SPEAKER", "MODERATOR") && it.seatIndex != null && it.micEnabled && !it.moderatorMuted }
    val selectedGift = gifts.firstOrNull { it.id == giftId }
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = Color(0xFF171522), contentColor = Color.White) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(bottom = 22.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text("Start a room PK", fontSize = 23.sp, fontWeight = FontWeight.Bold)
            Text("Choose mic players for each side. Players lead their side; teams can have 2–5 members.", color = Color(0xFFB9B5C6), fontSize = 13.sp)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(PkFormat.PLAYER to "Player PK", PkFormat.TEAM to "Team PK").forEach { (value, label) ->
                    Surface(onClick = { format = value; leftIds = emptyList(); rightIds = emptyList() }, shape = RoundedCornerShape(14.dp), color = if (format == value) Color(0xFF7548F4) else Color(0xFF292638), modifier = Modifier.weight(1f)) {
                        Text(label, Modifier.padding(vertical = 11.dp), textAlign = TextAlign.Center, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
            if (format == PkFormat.TEAM) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    (2..5).forEach { size ->
                        Surface(onClick = { teamSize = size; leftIds = leftIds.take(size); rightIds = rightIds.take(size) }, shape = RoundedCornerShape(12.dp), color = if (teamSize == size) Color(0xFF514078) else Color(0xFF292638), modifier = Modifier.weight(1f)) {
                            Text("${size}v$size", Modifier.padding(vertical = 9.dp), textAlign = TextAlign.Center, fontSize = 12.sp)
                        }
                    }
                }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(PkMode.GIFT to "Gift PK", PkMode.VOTE to "Vote PK").forEach { (value, label) ->
                    val active = mode == value
                    Surface(onClick = { mode = value }, shape = RoundedCornerShape(14.dp), color = if (active) Color(0xFF7548F4) else Color(0xFF292638), modifier = Modifier.weight(1f)) {
                        Text(label, Modifier.padding(vertical = 12.dp), textAlign = TextAlign.Center, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
            Text("Select players", fontWeight = FontWeight.SemiBold)
            val playersPerSide = if (format == PkFormat.TEAM) teamSize else 1
            if (micUsers.size < playersPerSide * 2) Text("${playersPerSide * 2} active mic users are needed for this format.", color = Color(0xFFFFB4A9))
            LazyColumn(Modifier.heightIn(max = 185.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                items(micUsers) { participant ->
                    val id = participant.user.id
                    val leftSelected = id in leftIds
                    val rightSelected = id in rightIds
                    Surface(
                        onClick = {
                            when {
                                leftSelected -> leftIds = leftIds - id
                                rightSelected -> rightIds = rightIds - id
                                leftIds.size < playersPerSide -> leftIds = leftIds + id
                                rightIds.size < playersPerSide -> rightIds = rightIds + id
                            }
                        },
                        shape = RoundedCornerShape(12.dp),
                        color = when { leftSelected -> Color(0xFF604819); rightSelected -> Color(0xFF173F5B); else -> Color(0xFF242230) }
                    ) {
                        Row(Modifier.fillMaxWidth().padding(10.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                            AsyncImage(model = participant.user.avatar?.let(::resolveMediaUrl), contentDescription = null, modifier = Modifier.size(38.dp).clip(CircleShape), contentScale = ContentScale.Crop)
                            Text(participant.user.name, Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text(when { leftSelected -> "GOLD"; rightSelected -> "BLUE"; else -> "ON MIC" }, color = Color(0xFFE8C66D), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
            if (mode == PkMode.GIFT) {
                Text("PK gift · only this gift scores", fontWeight = FontWeight.SemiBold)
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(gifts.filter { it.pkPoints > 0 }.take(20)) { gift ->
                        Surface(onClick = { giftId = gift.id }, shape = RoundedCornerShape(12.dp), color = if (giftId == gift.id) Color(0xFF473171) else Color(0xFF242230)) {
                            Row(Modifier.padding(horizontal = 10.dp, vertical = 9.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                AsyncImage(model = gift.icon.takeIf { it.isNotBlank() }?.let(::resolveMediaUrl), contentDescription = null, modifier = Modifier.size(24.dp))
                                Text("${gift.name} · ${gift.price} coins · ${gift.pkPoints} pts", fontSize = 12.sp)
                            }
                        }
                    }
                }
                if (gifts.none { it.pkPoints > 0 }) Text("PK gift scoring is not configured for available gifts yet.", color = Color(0xFFFFB4A9))
            }
            Text("Duration", fontWeight = FontWeight.SemiBold)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                listOf(60, 180, 300, 600, 900).forEach { seconds ->
                    val label = when (seconds) { 60 -> "1m"; 180 -> "3m"; 300 -> "5m"; 600 -> "10m"; else -> "15m" }
                    Surface(onClick = { duration = seconds }, shape = RoundedCornerShape(12.dp), color = if (duration == seconds) Color(0xFF7548F4) else Color(0xFF292638), modifier = Modifier.weight(1f)) {
                        Text(label, Modifier.padding(vertical = 10.dp), textAlign = TextAlign.Center, fontSize = 12.sp)
                    }
                }
            }
            Button(
                onClick = { onStart(leftIds, rightIds, format, mode, duration, selectedGift?.id) },
                enabled = leftIds.size == playersPerSide && rightIds.size == playersPerSide && (mode == PkMode.VOTE || selectedGift != null),
                modifier = Modifier.fillMaxWidth().height(52.dp), shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF7548F4))
            ) { Text("Start ${if (format == PkFormat.TEAM) "Team" else "Player"} ${if (mode == PkMode.GIFT) "Gift" else "Vote"} PK", fontWeight = FontWeight.Bold) }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FriendInviteSheet(
    hosts: List<Host>,
    roomFollowers: List<Host> = emptyList(),
    friends: List<Host> = emptyList(),
    roomId: String,
    roomTitle: String,
    onDismiss: () -> Unit,
    onInvite: (List<String>) -> Unit
) {
    val context = LocalContext.current
    var selectedTab by remember { mutableStateOf(0) }
    val selected = remember { androidx.compose.runtime.mutableStateListOf<String>() }
    val tabs = listOf("Friends", "Following", "Room followers")
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = Color.White, contentColor = Color(0xFF171421)) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp).navigationBarsPadding(), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Box(Modifier.align(Alignment.CenterHorizontally).width(44.dp).height(5.dp).clip(CircleShape).background(Color(0xFFB8C0CE)))
            Text("Invite your friends", Modifier.align(Alignment.CenterHorizontally), color = Color(0xFF171421), fontSize = 23.sp, fontWeight = FontWeight.Bold)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                listOf("WhatsApp", "Instagram", "Facebook", "SMS").forEach { app ->
                    TextButton(onClick = {
                        val invite = "Join me in $roomTitle on Yugm! https://yugm.app/room/$roomId"
                        val intent = android.content.Intent(android.content.Intent.ACTION_SEND).setType("text/plain").putExtra(android.content.Intent.EXTRA_TEXT, invite)
                        if (app == "SMS") context.startActivity(android.content.Intent(android.content.Intent.ACTION_SENDTO, android.net.Uri.parse("smsto:")).putExtra("sms_body", invite))
                        else context.startActivity(android.content.Intent.createChooser(intent, "Share invite"))
                    }) { Text(app, color = Color(0xFF7045F5), fontWeight = FontWeight.SemiBold) }
                }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                tabs.forEachIndexed { index, label ->
                    TextButton(onClick = { selectedTab = index }) { Text(label, color = if (selectedTab == index) Color(0xFF7045F5) else Color.DarkGray, fontWeight = FontWeight.SemiBold) }
                }
            }
            val people = when (selectedTab) { 0 -> friends; 1 -> hosts; else -> roomFollowers }
            if (people.isEmpty()) Text(if (selectedTab == 2) "Room followers will appear here." else "No people to show yet.", color = Color.Gray, modifier = Modifier.padding(vertical = 22.dp))
            LazyColumn(Modifier.heightIn(max = 360.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                items(people, key = { it.id }) { host ->
                    val checked = host.id in selected
                    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).clickable { if (checked) selected.remove(host.id) else selected.add(host.id) }.padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
                        Avatar(host.name.take(1), 42, host.avatar, host.activeCosmetics)
                        Column(Modifier.weight(1f).padding(start = 12.dp)) { Text(host.name, color = Color(0xFF171421), fontWeight = FontWeight.SemiBold); Text("@${host.username}", color = Color.Gray, fontSize = 12.sp) }
                        androidx.compose.material3.Checkbox(checked, onCheckedChange = { if (it) selected.add(host.id) else selected.remove(host.id) })
                    }
                }
            }
            androidx.compose.material3.Button(onClick = { if (selected.isNotEmpty()) onInvite(selected.toList()) }, enabled = selected.isNotEmpty(), modifier = Modifier.fillMaxWidth(), colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = Color(0xFF7045F5))) { Text("Invite${if (selected.isEmpty()) "" else " (${selected.size})"}") }
            TextButton(onClick = onDismiss, modifier = Modifier.fillMaxWidth()) { Text("Cancel", color = Color.DarkGray) }
        }
    }
}

@Composable
fun RoomExitOverlay(
    participants: List<RoomParticipant>,
    currentUserId: String,
    isHost: Boolean,
    onDismiss: () -> Unit,
    onMinimize: () -> Unit,
    onCloseRoom: () -> Unit,
    onFollow: (String) -> Unit
) {
    val guests = participants.filter { it.user.id.isNotBlank() && it.user.id != currentUserId }
    val followedIds = remember(guests) {
        androidx.compose.runtime.mutableStateListOf<String>().apply { addAll(guests.filter { it.user.isFollowing }.map { it.user.id }) }
    }
    val unfollowed = guests.filter { !it.user.isFollowing && it.user.id !in followedIds }
    androidx.compose.ui.window.Dialog(
        onDismissRequest = onDismiss,
        properties = androidx.compose.ui.window.DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Box(
            Modifier.fillMaxSize().background(Color(0xCC080713)).clickable(onClick = onDismiss),
            contentAlignment = Alignment.Center
        ) {
            Column(
                Modifier.fillMaxWidth().padding(horizontal = 28.dp, vertical = 26.dp).clickable { },
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(15.dp)
            ) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(24.dp), verticalAlignment = Alignment.CenterVertically) {
                    ExitAction("↙", "Minimize", Modifier.weight(1f), onMinimize)
                    ExitAction("×", "Close", Modifier.weight(1f), onCloseRoom)
                }
                Text("Follow people and join next time", color = Color.White, fontSize = 19.sp, fontWeight = FontWeight.Bold, modifier = Modifier.fillMaxWidth().padding(top = 5.dp))
                if (guests.isEmpty()) {
                    Text("No other people are in the room right now.", color = TextMuted, fontSize = 13.sp, modifier = Modifier.padding(vertical = 24.dp))
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxWidth().heightIn(max = 360.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(guests, key = { it.user.id }) { participant ->
                            Row(
                                    Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(Color.Black.copy(alpha = 0.30f)).padding(horizontal = 12.dp, vertical = 10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(11.dp)
                            ) {
                                Avatar(participant.user.name.take(1), 44, participant.user.avatar, participant.user.activeCosmetics)
                                Column(Modifier.weight(1f)) {
                                    Text(participant.user.name.ifBlank { "Yugm user" }, color = Color.White, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    Text("@${participant.user.username}", color = TextMuted, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                }
                                if (participant.user.isFollowing || participant.user.id in followedIds) {
                                    Text("Following", color = Color(0xFFB5AEC9), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                                } else {
                                    androidx.compose.material3.Button(
                                        onClick = { followedIds.add(participant.user.id); onFollow(participant.user.id) },
                                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 6.dp),
                                        shape = CircleShape,
                                        colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = Color(0xFF168BF2))
                                    ) { Text("Follow", fontSize = 12.sp, fontWeight = FontWeight.Bold) }
                                }
                            }
                        }
                    }
                }
                androidx.compose.material3.Button(
                    onClick = { unfollowed.forEach { followedIds.add(it.user.id); onFollow(it.user.id) } },
                    enabled = unfollowed.isNotEmpty(),
                    modifier = Modifier.fillMaxWidth().height(54.dp),
                    shape = RoundedCornerShape(18.dp),
                    colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = Color(0xFF2188F5))
                ) {
                    Text(if (unfollowed.isEmpty()) "You're following everyone" else "Follow All", fontSize = 16.sp, fontWeight = FontWeight.Bold)
                }
                if (!isHost) Text("Room host will close this room when they leave.", color = TextMuted, fontSize = 11.sp)
            }
        }
    }
}

@Composable
private fun ExitAction(icon: String, label: String, modifier: Modifier, onClick: () -> Unit) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Box(
            Modifier.size(82.dp).clip(CircleShape)
                .background(Brush.linearGradient(listOf(Color(0xFF8046FF), Color(0xFF6236F5))))
                .clickable(onClick = onClick),
            contentAlignment = Alignment.Center
        ) { Text(icon, color = Color.White, fontSize = 42.sp, fontWeight = FontWeight.Light) }
        Text(label, color = Color.White, fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
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
    onEditRoomSettings: () -> Unit,
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
                        text = if (host.isFollowing) "Following Room Host ✓" else "+ Follow Room Host (${host.name})",
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
                    onClick = onEditRoomSettings,
                    modifier = Modifier.fillMaxWidth().height(44.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF3B2D60)),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text("Edit Room Settings", color = Gold, fontWeight = FontWeight.Bold, fontSize = 13.sp)
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
                    Text("People • $participantCount", fontSize = 12.sp, maxLines = 1)
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RoomOverviewTabsSheet(
    room: Room,
    isHost: Boolean,
    isRoomAdmin: Boolean,
    participantCount: Int,
    roomFollowers: List<Host>,
    events: List<YugmEvent>,
    onFollowUser: (String) -> Unit,
    onUnfollowUser: (String) -> Unit,
    onDismiss: () -> Unit,
    onFollowHost: () -> Unit,
    onEditRoomSettings: () -> Unit,
    onOpenTools: () -> Unit,
    onViewListeners: () -> Unit,
    onMinimize: () -> Unit,
    onExit: () -> Unit,
    onToast: (String) -> Unit
) {
    val context = LocalContext.current
    var selectedTab by rememberSaveable(room.id) { mutableStateOf(0) }
    var search by rememberSaveable(room.id) { mutableStateOf("") }
    val followedIds = remember(roomFollowers) {
        androidx.compose.runtime.mutableStateListOf<String>().apply { addAll(roomFollowers.filter { it.isFollowing }.map { it.id }) }
    }
    val filteredFollowers = roomFollowers.filter {
        search.isBlank() || it.name.contains(search, true) || it.username.contains(search, true) || it.id.contains(search, true)
    }
    val white = Color.White
    val ink = Color(0xFF171421)
    val muted = Color(0xFF9290A0)
    val purple = Color(0xFF7045F5)
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = white,
        contentColor = ink,
        dragHandle = null,
        sheetState = androidx.compose.material3.rememberModalBottomSheetState(skipPartiallyExpanded = true),
        modifier = Modifier.fillMaxHeight(0.94f)
    ) {
        Column(Modifier.fillMaxSize().navigationBarsPadding()) {
            Row(Modifier.fillMaxWidth().height(58.dp), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onDismiss) {
                    Icon(Icons.Filled.Close, contentDescription = "Close room details", tint = muted)
                }
                listOf("Profile", "Followers (${roomFollowers.size})", "Events").forEachIndexed { index, title ->
                    Column(
                        Modifier.weight(1f).fillMaxHeight().clickable { selectedTab = index },
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Text(title, color = if (selectedTab == index) ink else Color(0xFF4F4D59), fontSize = 14.sp, fontWeight = if (selectedTab == index) FontWeight.Bold else FontWeight.Normal, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Spacer(Modifier.height(7.dp))
                        Box(Modifier.width(32.dp).height(3.dp).clip(CircleShape).background(if (selectedTab == index) purple else Color.Transparent))
                    }
                }
                Spacer(Modifier.width(10.dp))
            }
            androidx.compose.material3.Divider(color = Color(0xFFF0EFF3))

            when (selectedTab) {
                0 -> {
                    Column(Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 22.dp, vertical = 20.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                            Box(Modifier.size(100.dp).clip(RoundedCornerShape(20.dp)).background(Color(0xFFEDE8FF)), contentAlignment = Alignment.Center) {
                                if (!room.coverImage.isNullOrBlank()) AsyncImage(model = room.coverImage, contentDescription = "Room cover", modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                                else Icon(Icons.Filled.Mic, contentDescription = null, tint = purple, modifier = Modifier.size(38.dp))
                            }
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                                Text(room.title.ifBlank { "Live room" }, color = ink, fontSize = 21.sp, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text("ID: ${room.id.takeLast(8)}", color = muted, fontSize = 13.sp)
                                    Text("  Copy", color = purple, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, modifier = Modifier.clickable {
                                        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                                        clipboard.setPrimaryClip(ClipData.newPlainText("Room ID", room.id))
                                        onToast("Room ID copied")
                                    })
                                }
                            }
                        }
                        RoomInfoLine("Level", room.host?.let { "LV.${it.level}" } ?: "—")
                        RoomInfoLine("Tag", room.category.ifBlank { "Chat" })
                        Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Color(0xFFF7F6FA)).padding(16.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                            Text("Announcement", color = muted, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                            Text(room.description.ifBlank { "Welcome to ${room.title.ifBlank { "this room" }}. Join the conversation and meet everyone." }, color = ink, fontSize = 14.sp, lineHeight = 20.sp)
                        }
                        RoomInfoLine("Followers", "${room.host?.followers ?: roomFollowers.size}")
                        RoomInfoLine("People here", "$participantCount")
                        room.host?.city?.takeIf(String::isNotBlank)?.let { RoomInfoLine("Location", it) }
                        room.host?.let { host ->
                            androidx.compose.material3.Button(onClick = onFollowHost, modifier = Modifier.fillMaxWidth().height(50.dp), shape = RoundedCornerShape(16.dp), colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = if (host.isFollowing) Color(0xFFF0EDF7) else purple)) {
                                Text(if (host.isFollowing) "Following ${host.name}" else "Follow ${host.name}", color = if (host.isFollowing) ink else white, fontWeight = FontWeight.Bold)
                            }
                        }
                        if (isHost || isRoomAdmin) {
                            androidx.compose.material3.Button(onClick = onEditRoomSettings, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp), colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = Color(0xFFF0EDF7))) {
                                Text("Room settings", color = purple, fontWeight = FontWeight.SemiBold)
                            }
                        }
                    }
                    Row(Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        androidx.compose.material3.OutlinedButton(onClick = onOpenTools, modifier = Modifier.weight(1f).height(48.dp), shape = RoundedCornerShape(15.dp)) { Text("Tools") }
                        androidx.compose.material3.OutlinedButton(onClick = onViewListeners, modifier = Modifier.weight(1f).height(48.dp), shape = RoundedCornerShape(15.dp)) { Text("People · $participantCount") }
                        androidx.compose.material3.Button(onClick = onMinimize, modifier = Modifier.weight(1f).height(48.dp), shape = RoundedCornerShape(15.dp), colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = purple)) { Text("Minimize") }
                    }
                }
                1 -> {
                    Column(Modifier.weight(1f).fillMaxWidth().padding(horizontal = 20.dp, vertical = 14.dp)) {
                        OutlinedTextField(value = search, onValueChange = { search = it }, modifier = Modifier.fillMaxWidth(), singleLine = true, placeholder = { Text("Search by username or ID", color = Color(0xFFADB7C4)) }, shape = CircleShape, colors = androidx.compose.material3.OutlinedTextFieldDefaults.colors(unfocusedContainerColor = Color(0xFFF4F5F7), focusedContainerColor = Color(0xFFF4F5F7), unfocusedBorderColor = Color.Transparent, focusedBorderColor = purple))
                        if (filteredFollowers.isEmpty()) {
                            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text(if (roomFollowers.isEmpty()) "No followers yet" else "No matching followers", color = muted) }
                        } else LazyColumn(Modifier.weight(1f).padding(top = 10.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            items(filteredFollowers, key = { it.id }) { follower ->
                                Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                    Avatar(follower.name.take(1), 52, follower.avatar, follower.activeCosmetics)
                                    Column(Modifier.weight(1f)) {
                                        Text(follower.name.ifBlank { "Yugm user" }, color = ink, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                        Text("@${follower.username}", color = muted, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    }
                                    val following = follower.isFollowing || follower.id in followedIds
                                    androidx.compose.material3.Button(onClick = {
                                        if (following) { followedIds.remove(follower.id); onUnfollowUser(follower.id) }
                                        else { followedIds.add(follower.id); onFollowUser(follower.id) }
                                    }, shape = CircleShape, contentPadding = PaddingValues(horizontal = 16.dp, vertical = 6.dp), colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = if (following) Color(0xFFF0EDF7) else purple)) {
                                        Text(if (following) "Following" else "Follow", color = if (following) muted else white, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                    }
                                }
                                androidx.compose.material3.Divider(color = Color(0xFFF1F0F4), modifier = Modifier.padding(start = 62.dp))
                            }
                        }
                    }
                    androidx.compose.material3.Button(onClick = { roomFollowers.filterNot { it.isFollowing || it.id in followedIds }.forEach { followedIds.add(it.id); onFollowUser(it.id) } }, enabled = roomFollowers.any { !it.isFollowing && it.id !in followedIds }, modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 12.dp).height(54.dp), shape = RoundedCornerShape(18.dp), colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = purple)) { Text("Follow All", fontWeight = FontWeight.Bold, fontSize = 16.sp) }
                }
                else -> {
                    if (events.isEmpty()) {
                        Column(Modifier.weight(1f).fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                            Text("No room events yet", color = ink, fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
                            Text("Upcoming and past events for this room will show here.", color = muted, fontSize = 13.sp, modifier = Modifier.padding(top = 6.dp))
                        }
                    } else LazyColumn(Modifier.weight(1f).fillMaxWidth().padding(horizontal = 20.dp, vertical = 14.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                        items(events, key = { it.id }) { event ->
                            Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(Color(0xFFF4F3F7))) {
                                if (!event.coverImage.isNullOrBlank()) AsyncImage(model = event.coverImage, contentDescription = event.title, modifier = Modifier.fillMaxWidth().height(190.dp), contentScale = ContentScale.Crop)
                                Column(Modifier.padding(15.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                                    Text(event.type.ifBlank { "Room event" }, color = purple, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                    Text(event.title, color = ink, fontSize = 17.sp, fontWeight = FontWeight.Bold)
                                    Text(event.description.orEmpty().ifBlank { event.eventDate.replace('T', ' ').take(16) }, color = muted, fontSize = 13.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                                    Text("${event.status.lowercase().replaceFirstChar { it.uppercase() }} · ${event.participantIds.size} joined", color = muted, fontSize = 12.sp)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun RoomInfoLine(label: String, value: String) {
    Row(Modifier.fillMaxWidth().padding(vertical = 7.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(label, color = Color(0xFF8C8999), fontSize = 14.sp, modifier = Modifier.weight(1f))
        Text(value, color = Color(0xFF25232C), fontSize = 14.sp, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun OnlineUsersSheet(
    participants: List<RoomParticipant>,
    currentUserId: String,
    hostId: String,
    onDismiss: () -> Unit,
    onRefresh: () -> Unit,
    onFollow: (String) -> Unit,
    onUnfollow: (String) -> Unit
) {
    var query by rememberSaveable { mutableStateOf("") }
    val followingIds = remember(participants) {
        androidx.compose.runtime.mutableStateListOf<String>().apply {
            addAll(participants.filter { it.user.isFollowing }.map { it.user.id })
        }
    }
    val onlineUsers = participants.filter { participant ->
        val user = participant.user
        query.isBlank() || user.name.contains(query, true) || user.username.contains(query, true) || user.id.contains(query, true)
    }
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = Color.White,
        contentColor = Color(0xFF171421),
        dragHandle = null,
        sheetState = androidx.compose.material3.rememberModalBottomSheetState(skipPartiallyExpanded = true),
        modifier = Modifier.fillMaxHeight(0.94f)
    ) {
        Column(Modifier.fillMaxSize().navigationBarsPadding()) {
            Row(Modifier.fillMaxWidth().height(60.dp).padding(horizontal = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onDismiss) {
                    Icon(Icons.Filled.Close, contentDescription = "Close online users", tint = Color(0xFF8A8795))
                }
                Text("Online users · ${participants.size}", modifier = Modifier.weight(1f), color = Color(0xFF171421), fontSize = 17.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
                TextButton(onClick = onRefresh) {
                    Text("↻", color = Color(0xFF858292), fontSize = 25.sp, fontWeight = FontWeight.Medium)
                }
            }
            androidx.compose.material3.Divider(color = Color(0xFFF0EFF3))
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 14.dp),
                singleLine = true,
                placeholder = { Text("Search people", color = Color(0xFFAEB7C3)) },
                shape = CircleShape,
                colors = androidx.compose.material3.OutlinedTextFieldDefaults.colors(
                    unfocusedContainerColor = Color(0xFFF4F5F7),
                    focusedContainerColor = Color(0xFFF4F5F7),
                    unfocusedBorderColor = Color.Transparent,
                    focusedBorderColor = Color(0xFF7045F5)
                )
            )
            if (onlineUsers.isEmpty()) {
                Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                    Text(if (participants.isEmpty()) "No one is in the room yet" else "No users match your search", color = Color(0xFF8C8999), fontSize = 14.sp)
                }
            } else LazyColumn(
                Modifier.weight(1f).fillMaxWidth().padding(horizontal = 20.dp),
                verticalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                items(onlineUsers, key = { it.user.id.ifBlank { it.id } }) { participant ->
                    val user = participant.user
                    val isFollowing = user.isFollowing || user.id in followingIds
                    Row(Modifier.fillMaxWidth().padding(vertical = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Avatar(user.name.firstOrNull()?.toString() ?: "?", 54, user.avatar, user.activeCosmetics)
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                            Text(user.name.ifBlank { "Yugm user" }, color = Color(0xFF171421), fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text(
                                when {
                                    user.id == hostId -> "Room host · Lv.${user.level}"
                                    participant.isRoomAdmin -> "Room admin · Lv.${user.level}"
                                    participant.role == "SPEAKER" || participant.role == "MODERATOR" -> "Speaker · Lv.${user.level}"
                                    else -> "Listener · Lv.${user.level}"
                                },
                                color = Color(0xFF898697), fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis
                            )
                            if (user.username.isNotBlank()) Text("@${user.username}", color = Color(0xFFAAA7B4), fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                        if (user.id != currentUserId && user.id.isNotBlank()) {
                            androidx.compose.material3.Button(
                                onClick = {
                                    if (isFollowing) { followingIds.remove(user.id); onUnfollow(user.id) }
                                    else { followingIds.add(user.id); onFollow(user.id) }
                                },
                                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 6.dp),
                                shape = CircleShape,
                                colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = if (isFollowing) Color(0xFFF0EDF7) else Color(0xFF7045F5))
                            ) { Text(if (isFollowing) "Following" else "Follow", color = if (isFollowing) Color(0xFF777383) else Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold) }
                        }
                    }
                    androidx.compose.material3.Divider(color = Color(0xFFF1F0F4), modifier = Modifier.padding(start = 66.dp))
                }
            }
            Spacer(Modifier.height(10.dp))
        }
    }
}
