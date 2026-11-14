package com.yugm.app.feature.room.screens

import android.Manifest
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
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
import androidx.compose.foundation.layout.widthIn
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
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.PowerSettingsNew
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Send
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
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
import com.yugm.app.core.model.SpeakerRequest
import com.yugm.app.core.ui.components.AuroraBackground
import com.yugm.app.core.ui.components.Avatar
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ActiveVoiceRoomScreen(
    room: Room,
    chat: List<ChatMessage>,
    gifts: List<GiftItem>,
    balance: Int,
    diamondBalance: Int = 0,
    onBack: () -> Unit,
    onSendMessage: (String) -> Unit,
    onGift: (GiftItem, String) -> Unit,
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
    onSetSeatLocked: (Int, Boolean) -> Unit = { _, _ -> },
    onInviteSpeaker: (String) -> Unit = {},
    onCreatePoll: () -> Unit = {},
    onCreateCustomPoll: (String, List<String>) -> Unit = { _, _ -> },
    onVotePoll: (String, Int) -> Unit = { _, _ -> },
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
    onSetRoomAdmin: (String, Boolean) -> Unit = { _, _ -> },
    onReportUser: (String) -> Unit = {},
    isRoomAdmin: Boolean = false,
    forcedMuteVersion: Int = 0,
    forcedRemoveVersion: Int = 0,
    roomEndedVersion: Int = 0,
    roomReactionEvent: Pair<Int, String> = 0 to "",
    onOpenModes: (() -> Unit)? = null,
    onOpenThemes: (() -> Unit)? = null,
    onEditRoom: (() -> Unit)? = null,
    canSpeak: Boolean = isHost
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

    val microphonePermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted && !micMutedByRoomAdmin) {
            muted = false
            YugmMediaRoom.setMicEnabled(true)
            onOwnMicStateChanged(true)
        } else if (micMutedByRoomAdmin) {
            muted = true
            YugmMediaRoom.setMicEnabled(false)
            onToast("The host or an admin muted your microphone")
        } else {
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
    var showInvitePicker by rememberSaveable { mutableStateOf(false) }
    var showPollComposer by rememberSaveable { mutableStateOf(false) }
    var showPkSetup by rememberSaveable { mutableStateOf(false) }
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
    var showListenersSheet by rememberSaveable { mutableStateOf(false) }
    var showLuckyWheelDialog by rememberSaveable { mutableStateOf(false) }
    var showRoomInfoSheet by rememberSaveable { mutableStateOf(false) }
    var chatMessageDraft by rememberSaveable { mutableStateOf("") }
    val seatReactions = remember { mutableStateMapOf<Int, String>() }
    var activeGiftBanner by remember { mutableStateOf<Triple<String, String, String>?>(null) }
    val scope = rememberCoroutineScope()

    BackHandler { showExitPrompt = true }

    // Listen to gift activities across the room
    LaunchedEffect(activity.size) {
        val latest = activity.lastOrNull()
        if (latest != null && latest.type.uppercase() == "GIFT") {
            val sender = latest.label.substringBefore(" sent").ifBlank { "Someone" }
            val giftName = latest.label.substringAfter("sent ").ifBlank { "Gift" }
            activeGiftBanner = Triple(sender, giftName, "🎁")
        }
    }

    LaunchedEffect(activeGiftBanner) {
        if (activeGiftBanner != null) {
            delay(3200)
            activeGiftBanner = null
        }
    }

    // Show the selected reaction on the reacting user's seat.
    LaunchedEffect(roomReactionEvent.first) {
        val emoji = roomReactionEmoji(roomReactionEvent.second)
        if (roomReactionEvent.first > 0) {
            val seatIdx = selfParticipant?.seatIndex ?: 0
            seatReactions[seatIdx] = emoji
            scope.launch {
                delay(1800)
                if (seatReactions[seatIdx] == emoji) seatReactions.remove(seatIdx)
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
            onGift(gift, "COINS")
            activeGiftBanner = Triple("You", gift.name, "🎁")
        },
        onSendWithCurrency = { gift, currency ->
            onGift(gift, currency)
            activeGiftBanner = Triple("You", gift.name, "🎁")
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
                onShare = {
                    val shareIntent = Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(Intent.EXTRA_TEXT, "Join ${room.title.ifBlank { "my room" }} on Yugm: yugm.live/room/${room.id}")
                    }
                    context.startActivity(Intent.createChooser(shareIntent, "Share room"))
                },
                onMore = { showRoomInfoSheet = true },
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
                                reactionEmoji = seatReactions[index],
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
                    val recentEntrances = activity.filter { it.type.uppercase() == "JOIN" }.takeLast(4)
                    items(recentEntrances, key = { "join-${it.id}" }) { item ->
                        EntranceAnnouncementCard(
                            label = item.label,
                            onWelcomeClick = {
                                onReact("clap")
                                onToast("Welcomed to the room! 👏")
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
                    modifier = Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 10.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(14.dp)
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
                            if (!canSpeak && !isHost) {
                                onRequestSpeaker()
                                onToast("Requested microphone seat")
                            } else if (!muted) {
                                muted = true
                                YugmMediaRoom.setMicEnabled(false)
                                onOwnMicStateChanged(false)
                            } else if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                                muted = false
                                YugmMediaRoom.setMicEnabled(true)
                                onOwnMicStateChanged(true)
                                onToast("Microphone unmuted")
                            } else microphonePermission.launch(Manifest.permission.RECORD_AUDIO)
                        },
                        modifier = Modifier.size(32.dp).clip(CircleShape)
                            .border(1.dp, Color(0x667E718D), CircleShape)
                    ) {
                        Icon(
                            if (muted || (!canSpeak && !isHost)) Icons.Filled.MicOff else Icons.Filled.Mic,
                            contentDescription = if (!canSpeak && !isHost) "Request microphone" else if (muted) "Unmute microphone" else "Mute microphone",
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
                            .border(1.dp, Color(0x667E718D), CircleShape).semantics { contentDescription = "More room actions" }
                    ) {
                        Icon(Icons.Filled.MoreVert, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
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
            activeGiftBanner?.let { (sender, giftName, icon) ->
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
                        Text(icon, fontSize = 58.sp)
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "$sender sent $giftName!",
                            color = Gold,
                            fontSize = 19.sp,
                            fontWeight = FontWeight.Black,
                            textAlign = TextAlign.Center
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = "✨ Room Intimacy Boosted +100 ✨",
                            color = Color.White.copy(alpha = 0.85f),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
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
                    ToolGridItem("😍", "Reactions") {
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
                    ToolGridItem("👥", "Invite") {
                        showToolsSheet = false
                        showInvitePicker = true
                    }
                    ToolGridItem("💬", "DM Host") {
                        showToolsSheet = false
                        onDirectMessage(room.host?.id)
                    }
                    ToolGridItem("📻", "Modes") {
                        showToolsSheet = false
                        onOpenModes?.invoke()
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceAround
                ) {
                    ToolGridItem("🎲", "Lucky wheel") {
                        showToolsSheet = false
                        showLuckyWheelDialog = true
                    }
                    ToolGridItem(if (roomAudioMuted) "🔇" else "🔊", "Room audio") {
                        roomAudioMuted = !roomAudioMuted
                        onToast(if (roomAudioMuted) "Room audio muted" else "Room audio unmuted")
                        showToolsSheet = false
                    }
                    ToolGridItem("↙️", "Minimize") {
                        showToolsSheet = false
                        onMinimize()
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))
            }
        }
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
                Text("Tap an emoji to react live on the stage", color = TextMuted, fontSize = 12.sp)
                Spacer(modifier = Modifier.height(14.dp))
                val reactions = listOf(
                    "🙌" to "clap",
                    "😍" to "heart",
                    "🔥" to "fire",
                    "😂" to "laugh",
                    "🤯" to "wow",
                    "👑" to "crown",
                    "✨" to "stars",
                    "🎉" to "party"
                )
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    contentPadding = PaddingValues(bottom = 16.dp)
                ) {
                    items(reactions) { (emoji, type) ->
                        Box(
                            modifier = Modifier
                                .size(56.dp)
                                .clip(RoundedCornerShape(16.dp))
                                .background(Color(0xFF26203B))
                                .clickable {
                                    onReact(type)
                                    val seatIdx = selfParticipant?.seatIndex ?: 0
                                    seatReactions[seatIdx] = emoji
                                    scope.launch {
                                        delay(1800)
                                        if (seatReactions[seatIdx] == emoji) seatReactions.remove(seatIdx)
                                    }
                                    showReactionPicker = false
                                },
                            contentAlignment = Alignment.Center
                        ) {
                            Text(emoji, fontSize = 28.sp)
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
            title = { Text("🦁 Lucky Draw & Mini-Games", color = Color.White, fontWeight = FontWeight.Black) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Spin the wheel for a chance to win exclusive room frames, badges, and coin boosts!", color = TextMuted, fontSize = 13.sp)
                    Text("• Grand Prize: Legendary Electric Dragon Frame 🐉", color = RoomGoldAccent, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Text("• Tier 2: Supreme Crown Frame 👑", color = Color.White, fontSize = 12.sp)
                    Text("• Tier 3: 500 Coins Bonus 💎", color = Color(0xFF60A5FA), fontSize = 12.sp)
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        showLuckyWheelDialog = false
                        onToast("Spinning wheel... You won 50 Bonus Coins! 🎉")
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
                                Text(
                                    when {
                                        p.user.id == room.host?.id -> "Host 👑"
                                        p.isRoomAdmin -> "Admin 🛡️"
                                        p.role in listOf("SPEAKER", "MODERATOR") -> "Speaker 🎙️"
                                        else -> "Listener"
                                    },
                                    color = TextMuted,
                                    fontSize = 11.sp
                                )
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
        ModalBottomSheet(
            onDismissRequest = { selectedParticipant = null },
            containerColor = Color(0xFF171522)
        ) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp)
                    .padding(bottom = 20.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Avatar(target.user.name.take(1), 76, target.user.avatar, target.user.activeCosmetics)
                Text(target.user.name.ifBlank { "Yugm user" }, color = TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 10.dp))
                Text(
                    buildString {
                        append(if (targetIsHost) "Host" else if (target.isRoomAdmin) "Room admin" else target.role.lowercase().replaceFirstChar { it.uppercase() })
                        if (target.role in listOf("SPEAKER", "MODERATOR", "HOST")) target.seatIndex?.let { append(" · Mic ${it + 1}") }
                    },
                    color = TextMuted,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(top = 3.dp, bottom = 12.dp)
                )
                Column(Modifier.fillMaxWidth()) {
                    TextButton(onClick = { onOpenProfile(target.user.id); selectedParticipant = null }, modifier = Modifier.fillMaxWidth()) {
                        Text("View Profile", color = TextPrimary, fontWeight = FontWeight.Bold)
                    }
                    if (isSelf && target.role in listOf("SPEAKER", "MODERATOR")) {
                        TextButton(
                            onClick = {
                                onRemoveSpeaker(target.user.id)
                                selectedParticipant = null
                                onToast("Stepped down from stage. Tap any open mic to join again.")
                            },
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Leave Seat (Step Down to Audience)", color = Pink, fontWeight = FontWeight.Bold)
                        }
                    }
                    if (!isSelf) {
                        TextButton(onClick = {
                            if (target.user.isFollowing) onUnfollowUser(target.user.id) else onFollowUser(target.user.id)
                            selectedParticipant = target.copy(user = target.user.copy(isFollowing = !target.user.isFollowing))
                        }, modifier = Modifier.fillMaxWidth()) {
                            Text(if (target.user.isFollowing) "Following" else "+ Follow", color = RoomPurplePrimary, fontWeight = FontWeight.Bold)
                        }
                        TextButton(onClick = { onDirectMessage(target.user.id); selectedParticipant = null }, modifier = Modifier.fillMaxWidth()) {
                            Text("Direct Message", color = TextPrimary)
                        }
                    }
                    if ((isHost || isRoomAdmin) && target.role == "AUDIENCE" && canManageTarget) {
                        TextButton(onClick = { onInviteSpeaker(target.user.id); selectedParticipant = null }, modifier = Modifier.fillMaxWidth()) {
                            Text("Invite to Mic", color = RoomPurplePrimary)
                        }
                    }
                    if ((isHost || isRoomAdmin) && target.role in listOf("SPEAKER", "MODERATOR") && canManageTarget) {
                        TextButton(onClick = { onRemoveSpeaker(target.user.id); selectedParticipant = null }, modifier = Modifier.fillMaxWidth()) {
                            Text("Remove from Mic", color = Pink)
                        }
                    }
                    if (isHost && !isSelf && !targetIsHost) {
                        TextButton(onClick = { onSetRoomAdmin(target.user.id, !target.isRoomAdmin); selectedParticipant = null }, modifier = Modifier.fillMaxWidth()) {
                            Text(if (target.isRoomAdmin) "Remove Admin" else "Make Room Admin", color = Gold)
                        }
                    }
                    if ((isHost || isRoomAdmin) && canManageTarget) {
                        TextButton(onClick = { onMuteUser(target.user.id); selectedParticipant = null }, modifier = Modifier.fillMaxWidth()) {
                            Text("Mute Microphone", color = Pink)
                        }
                        TextButton(onClick = { onRemoveUser(target.user.id); selectedParticipant = null }, modifier = Modifier.fillMaxWidth()) {
                            Text("Kick from Room", color = Pink)
                        }
                    }
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
        PollComposerSheet(
            onDismiss = { showPollComposer = false },
            onCreate = { question, options ->
                showPollComposer = false
                onCreateCustomPoll(question, options)
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
private fun roomReactionEmoji(type: String): String = when (type.lowercase()) {
    "heart" -> "😍"
    "fire" -> "🔥"
    "laugh" -> "😂"
    "clap" -> "🙌"
    "wow" -> "🤯"
    "crown" -> "👑"
    "stars" -> "✨"
    "party" -> "🎉"
    else -> "✨"
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
    reactionEmoji: String? = null,
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
            .height(82.dp)
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

                // Animated live reaction centered directly over the avatar!
                if (!reactionEmoji.isNullOrBlank()) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.Center)
                            .clip(CircleShape)
                            .background(Color(0xD9000000))
                            .border(1.5.dp, Gold, CircleShape)
                            .padding(8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(reactionEmoji, fontSize = 24.sp)
                    }
                }


            }

            Spacer(modifier = Modifier.height(4.dp))

            // Pill with Seat Number + Name
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 2.dp, vertical = 3.dp)
            ) {
                // Number badge
                Box(
                    modifier = Modifier
                        .size(13.dp)
                        .clip(CircleShape)
                        .background(
                            when (index) {
                                0 -> Color(0xFF3B82F6)
                                1 -> Color(0xFF60A5FA)
                                2 -> Color(0xFFEC4899)
                                3 -> Color(0xFF8B5CF6)
                                else -> Color(0xFFA855F7)
                            }
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        "${index + 1}",
                        color = Color.White,
                        fontSize = 8.sp,
                        fontWeight = FontWeight.Black
                    )
                }

                Text(
                    text = participant.user.name,
                    color = Color.White,
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    textAlign = TextAlign.Start,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false).padding(start = 3.dp)
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
    onWelcomeClick: () -> Unit
) {
    val name = label.substringBefore(" joined").substringBefore(" entered").ifBlank { label }

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
            // User Avatar
            Box(
                modifier = Modifier
                    .size(34.dp)
                    .clip(CircleShape)
                    .background(Brush.linearGradient(listOf(RoomPurplePrimary, Pink))),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    name.take(1).uppercase(),
                    color = Color.White,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Black
                )
            }

            Spacer(modifier = Modifier.width(8.dp))

            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("🛡️", fontSize = 11.sp)
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PollComposerSheet(
    onDismiss: () -> Unit,
    onCreate: (String, List<String>) -> Unit
) {
    var question by rememberSaveable { mutableStateOf("") }
    var optionA by rememberSaveable { mutableStateOf("") }
    var optionB by rememberSaveable { mutableStateOf("") }
    var optionC by rememberSaveable { mutableStateOf("") }
    var optionD by rememberSaveable { mutableStateOf("") }

    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = Color(0xFF141224)) {
        Column(
            verticalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 18.dp, vertical = 8.dp)
                .navigationBarsPadding()
        ) {
            Text("Create Room Poll", color = TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Black)
            OutlinedTextField(
                value = question,
                onValueChange = { question = it },
                label = { Text("Poll Question") },
                modifier = Modifier.fillMaxWidth()
            )
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                OutlinedTextField(optionA, { optionA = it }, label = { Text("Option 1") }, modifier = Modifier.weight(1f))
                OutlinedTextField(optionB, { optionB = it }, label = { Text("Option 2") }, modifier = Modifier.weight(1f))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                OutlinedTextField(optionC, { optionC = it }, label = { Text("Option 3") }, modifier = Modifier.weight(1f))
                OutlinedTextField(optionD, { optionD = it }, label = { Text("Option 4") }, modifier = Modifier.weight(1f))
            }
            Button(
                onClick = {
                    val options = listOf(optionA, optionB, optionC, optionD).map { it.trim() }.filter { it.isNotBlank() }
                    if (question.isNotBlank() && options.size >= 2) onCreate(question.trim(), options)
                },
                modifier = Modifier.fillMaxWidth().height(48.dp),
                colors = ButtonDefaults.buttonColors(containerColor = RoomGoldAccent)
            ) {
                Text("Launch Poll", color = Background, fontWeight = FontWeight.Black)
            }
        }
    }
}

@Composable
fun MissionStrip(missions: List<RoomMission>) {
    if (missions.isEmpty()) return
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        missions.forEach { mission ->
            GlassCard {
                Text(mission.title, color = TextPrimary, fontWeight = FontWeight.Black)
                Text("${mission.progress}/${mission.target} / ${mission.reward} coins", color = if (mission.complete) Gold else TextMuted, fontSize = 12.sp)
            }
        }
    }
}

@Composable
fun PollCard(
    poll: RoomPoll?,
    isHost: Boolean,
    onCreate: () -> Unit,
    onVote: (String, Int) -> Unit
) {
    if (poll == null) {
        if (isHost) {
            GlassCard {
                Text("Ask the room", color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Black)
                Text("Create a quick vote and let everyone weigh in.", color = TextMuted, fontSize = 12.sp)
                Button(
                    onClick = onCreate,
                    modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryPurple)
                ) {
                    Text("Create poll", color = Color.White)
                }
            }
        }
        return
    }
    val total = poll.options.sumOf { it.votes }.coerceAtLeast(1)
    GlassCard {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            Text(poll.question, color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Black)
            poll.options.forEachIndexed { index, option ->
                val pct = (option.votes * 100) / total
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0x33FFFFFF))
                        .clickable { onVote(poll.id, index) }
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(option.text, color = TextPrimary, modifier = Modifier.weight(1f), fontSize = 13.sp)
                    Text("$pct%", color = Gold, fontWeight = FontWeight.Bold, fontSize = 12.sp)
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
                    Text("✨", fontSize = 13.sp)
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
                    Text("People · $participantCount", fontSize = 12.sp, maxLines = 1)
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
