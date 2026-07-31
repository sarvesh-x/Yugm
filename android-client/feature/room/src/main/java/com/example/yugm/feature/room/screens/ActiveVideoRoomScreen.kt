package com.example.yugm.feature.room.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.remember
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.core.api.YugmMediaRoom
import com.example.yugm.core.api.YugmSocket
import com.example.yugm.core.model.ChatMessage
import com.example.yugm.core.model.GiftItem
import com.example.yugm.core.model.Host
import com.example.yugm.core.model.PkBattle
import com.example.yugm.core.model.PkLeaderboardEntry
import com.example.yugm.core.model.PkLiveEffect
import com.example.yugm.core.model.PkMediaSession
import com.example.yugm.core.model.PkMode
import com.example.yugm.core.model.PkOpponent
import com.example.yugm.core.model.PkSideType
import com.example.yugm.core.model.PkStatus
import com.example.yugm.core.model.Room
import com.example.yugm.core.model.RoomActivityItem
import com.example.yugm.core.model.RoomMission
import com.example.yugm.core.model.RoomParticipant
import com.example.yugm.core.model.RoomPoll
import com.example.yugm.core.ui.components.*
import com.example.yugm.core.ui.theme.TextMuted
import com.example.yugm.core.ui.theme.Background
import com.example.yugm.core.ui.theme.PrimaryPurple
import com.example.yugm.core.ui.theme.Pink
import com.example.yugm.core.ui.theme.TextPrimary
import livekit.org.webrtc.SurfaceViewRenderer
import kotlinx.coroutines.delay

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ActiveVideoRoomScreen(
    room: Room,
    chat: List<ChatMessage>,
    gifts: List<GiftItem>,
    balance: Int,
    onBack: () -> Unit,
    onSendMessage: (String) -> Unit,
    onGift: (GiftItem) -> Unit,
    onToast: (String) -> Unit,
    onJoin: () -> Unit,
    participants: List<RoomParticipant> = emptyList(),
    inviteCandidates: List<Host> = emptyList(),
    pkBattle: PkBattle? = null,
    pkInviteId: String? = null,
    pkOpponents: List<PkOpponent> = emptyList(),
    pkLeaderboard: List<PkLeaderboardEntry> = emptyList(),
    pkLiveEffect: PkLiveEffect? = null,
    pkOpponentMedia: PkMediaSession? = null,
    polls: List<RoomPoll> = emptyList(),
    missions: List<RoomMission> = emptyList(),
    activity: List<RoomActivityItem> = emptyList(),
    onRequestSpeaker: () -> Unit = {},
    onCreatePoll: () -> Unit = {},
    onCreateCustomPoll: (String, List<String>) -> Unit = { _, _ -> },
    onVotePoll: (String, Int) -> Unit = { _, _ -> },
    onInviteFriend: (String) -> Unit = {},
    onDirectMessage: (String?) -> Unit = {},
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
    onEndRoom: () -> Unit = {},
    onMuteUser: (String) -> Unit = {},
    onRemoveUser: (String) -> Unit = {},
    onReportUser: (String) -> Unit = {},
    onOpenModes: (() -> Unit)? = null,
    onOpenThemes: (() -> Unit)? = null
) {
    DisposableEffect(room.id) {
        onJoin()
        onDispose {
            YugmSocket.disconnect()
            YugmMediaRoom.disconnect()
        }
    }
    var mic by rememberSaveable { mutableStateOf(true) }
    var camera by rememberSaveable { mutableStateOf(true) }
    var giftOpen by rememberSaveable { mutableStateOf(false) }
    var reactionBurst by rememberSaveable { mutableStateOf("") }
    val floatingEmojis = remember { mutableStateListOf<FloatingEmoji>() }
    var showInvitePicker by rememberSaveable { mutableStateOf(false) }
    var showPollComposer by rememberSaveable { mutableStateOf(false) }
    var showPkSetup by rememberSaveable { mutableStateOf(false) }
    var showPkOpponents by rememberSaveable { mutableStateOf(false) }
    var pkMode by rememberSaveable { mutableStateOf(PkMode.GIFT) }
    var pkDuration by rememberSaveable { mutableStateOf(180) }
    var pkTitle by rememberSaveable { mutableStateOf("Video PK") }
    var pkSearch by rememberSaveable { mutableStateOf("") }
    var pkGiftSide by rememberSaveable { mutableStateOf(PkSideType.LEFT) }
    var dismissedPkResultId by rememberSaveable { mutableStateOf<String?>(null) }
    var liveVideoFeeds by remember { mutableStateOf<List<YugmMediaRoom.VideoFeed>>(emptyList()) }
    var isPollingActive by rememberSaveable { mutableStateOf(true) }
    LaunchedEffect(room.id) {
        isPollingActive = true
        while (isPollingActive) {
            liveVideoFeeds = YugmMediaRoom.videoFeeds()
            delay(500)
        }
    }
    DisposableEffect(room.id) {
        onDispose { isPollingActive = false }
    }
    LaunchedEffect(reactionBurst) {
        if (reactionBurst.isNotBlank()) {
            delay(1200)
            reactionBurst = ""
        }
    }
    val emojiCounter = remember { mutableStateOf(0) }
    LaunchedEffect(floatingEmojis.size) {
        if (floatingEmojis.isNotEmpty()) {
            delay(2200)
            floatingEmojis.removeFirstOrNull()
        }
    }
    Box(Modifier.fillMaxSize()) {
        AuroraBackground(speed = 0.4f)
        RoomShell(
            room = room,
            chat = chat,
            onBack = onBack,
            onSendMessage = onSendMessage,
            giftOpen = giftOpen,
            gifts = gifts,
            balance = balance,
            onGiftOpen = { giftOpen = it },
            onGift = onGift,
            controls = {
            val guestId = participants.firstOrNull { it.user.id.isNotBlank() && it.user.id != room.host?.id }?.user?.id
            ControlButton(if (mic) "Mic on" else "Mic off", active = mic) {
                mic = !mic
                YugmMediaRoom.setMicEnabled(mic)
            }
            ControlButton(if (camera) "Cam on" else "Cam off", active = camera) {
                camera = !camera
                YugmMediaRoom.setCameraEnabled(camera)
            }
            ControlButton("Flip") { onToast("Camera switched") }
            if (!isHost) ControlButton("Speak") { onRequestSpeaker() }
            if (!isHost) {
                ControlButton("Gift") { giftOpen = true }
            }
            ControlButton("React") {
                onReact("fire")
            }
            ControlButton("Invite") {
                showInvitePicker = true
            }
            ControlButton("Share") { onToast("Room link copied") }
            ControlButton("DM") { onDirectMessage(if (isHost) guestId else null) }
            if (onOpenModes != null && room.mode != null) {
                ControlButton("🎮 Modes") { onOpenModes() }
            }
            if (onOpenThemes != null) {
                ControlButton("🎨 Themes") { onOpenThemes() }
            }
            if (isHost) {
                Spacer(Modifier.width(8.dp))
                if (pkBattle == null || pkBattle.status !in listOf(PkStatus.ACTIVE, PkStatus.INVITED, PkStatus.WAITING)) {
                    ControlButton("Start PK") { showPkSetup = true }
                }
                ControlButton("End", danger = true) { onEndRoom() }
                if (guestId != null) {
                    ControlButton("Mute user") { onMuteUser(guestId) }
                    ControlButton("Remove user", danger = true) { onRemoveUser(guestId) }
                }
            }
            if (!isHost) room.host?.let { host ->
                ControlButton("Report", danger = true) { onReportUser(host.id) }
            }
            if (!isHost) ControlButton("Leave", danger = true) { onBack() }
        }
    ) {
        AnimatedEntrance(delay = 200) {
        if (pkBattle != null && pkBattle.status == PkStatus.ACTIVE) {
            PkBattleHeader(pkBattle, isHost = isHost, onEnd = onEndPk)
            PkVideoStage(pkBattle, pkOpponentMedia)
            PkBattleScoreBar(pkBattle)
            PkTeamSelector(pkBattle, selectedSide = pkGiftSide, onSelect = { pkGiftSide = it })
            PkLiveEffectBurst(pkLiveEffect)
            val ownPkSide = when (room.id) {
                pkBattle.left.roomId -> PkSideType.LEFT
                pkBattle.right.roomId -> PkSideType.RIGHT
                else -> null
            }
            PkGiftPanel(
                gifts = gifts,
                balance = balance,
                selectedSide = pkGiftSide,
                onSideChange = { pkGiftSide = it },
                onSend = { gift, side ->
                    if (isHost && side == ownPkSide) {
                        onToast("Choose the opponent side for PK gifts")
                    } else {
                        onSendPkGift(gift, side)
                    }
                }
            )
            PkReactionPanel(
                onReact = { reaction, side ->
                    if (isHost && side == ownPkSide) {
                        onToast("Choose the opponent side for PK reactions")
                    } else {
                        onSendPkReaction(reaction, side)
                    }
                },
                side = pkGiftSide
            )
            PkLeaderboard(pkLeaderboard)
        } else if (pkBattle != null && pkBattle.status == PkStatus.INVITED && isHost && pkBattle.right.roomId == room.id && !pkInviteId.isNullOrBlank()) {
            PkInviteCard(
                battle = pkBattle,
                inviterName = pkBattle.left.hostName,
                onAccept = { onAcceptPk(pkInviteId) },
                onReject = { onRejectPk(pkInviteId) }
            )
        } else if (pkBattle != null && pkBattle.status in listOf(PkStatus.INVITED, PkStatus.WAITING)) {
            PkWaitingState(pkBattle)
        } else if (isHost) {
            PkBattleButton { showPkSetup = true }
        }
        val overlayId = room.host?.activeCosmetics?.videoCallOverlay ?: ""
        Box(Modifier.fillMaxWidth()) {
            if (liveVideoFeeds.isNotEmpty()) {
                LiveVideoGrid(liveVideoFeeds)
            } else {
                VideoGrid(room = room, camera = camera, participants = participants.filter { it.role in listOf("HOST", "SPEAKER", "MODERATOR") })
            }
            CallScreenOverlay(overlayId)
        }
        SectionTitle("Room reactions")
        val emojiRow = listOf(
            "❤️" to "heart", "🔥" to "fire", "😂" to "laugh",
            "👏" to "clap", "😮" to "wow", "🎉" to "laugh"
        )
        Row(
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp)
        ) {
            emojiRow.forEach { (emoji, type) ->
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clickable {
                            onReact(type)
                            emojiCounter.value++
                            floatingEmojis.add(
                                FloatingEmoji(id = "${emojiCounter.value}-${type}", emoji = emoji)
                            )
                        }
                        .padding(vertical = 6.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(emoji, fontSize = 26.sp)
                }
            }
        }
        Spacer(Modifier.height(4.dp))
        MissionStrip(missions)
        PollCard(poll = polls.firstOrNull(), isHost = isHost, onCreate = { showPollComposer = true }, onVote = onVotePoll)
        ActivityFeed(activity)
        Text("Audience mode supported / Host highlighted / Video seats limit ${room.maxSpeakers}", color = TextMuted, fontSize = 12.sp)
    }
    }
        FloatingEmojiOverlay(
            emojis = floatingEmojis.toList(),
            modifier = Modifier.matchParentSize()
        )
    }
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
    if (showPollComposer) {
        PollComposerSheet(
            onDismiss = { showPollComposer = false },
            onCreate = { question, options ->
                showPollComposer = false
                onCreateCustomPoll(question, options)
            }
        )
    }
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
}

@Composable
private fun LiveVideoGrid(feeds: List<YugmMediaRoom.VideoFeed>) {
    val main = feeds.first()
    val side = feeds.drop(1).take(2)
    val lower = feeds.drop(3).take(3)
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(Modifier.fillMaxWidth().height(300.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            LiveVideoTile(main, Modifier.weight(2f).fillMaxSize())
            Column(Modifier.weight(1f).fillMaxSize(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                side.forEach { feed -> LiveVideoTile(feed, Modifier.weight(1f).fillMaxWidth()) }
                repeat((2 - side.size).coerceAtLeast(0)) {
                    Box(Modifier.weight(1f).fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(Background))
                }
            }
        }
        if (lower.isNotEmpty()) {
            Row(Modifier.fillMaxWidth().height(150.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                lower.forEach { feed -> LiveVideoTile(feed, Modifier.weight(1f).fillMaxSize()) }
            }
        }
    }
}

@Composable
private fun LiveVideoTile(feed: YugmMediaRoom.VideoFeed, modifier: Modifier = Modifier) {
    var renderer by remember(feed.track) { mutableStateOf<SurfaceViewRenderer?>(null) }
    DisposableEffect(feed.track) {
        onDispose {
            renderer?.let {
                feed.track.removeRenderer(it)
                it.release()
            }
            renderer = null
        }
    }
    Box(modifier.clip(RoundedCornerShape(18.dp)).background(Background)) {
        AndroidView(
            factory = { context ->
                SurfaceViewRenderer(context).also { view ->
                    YugmMediaRoom.initializeVideoRenderer(view)
                    view.setMirror(false)
                    feed.track.addRenderer(view)
                    renderer = view
                }
            },
            modifier = Modifier.fillMaxSize()
        )
        Box(Modifier.align(Alignment.BottomStart).padding(9.dp).clip(RoundedCornerShape(10.dp)).background(Color.Black.copy(alpha = 0.62f)).padding(horizontal = 9.dp, vertical = 5.dp)) {
            Text(feed.label, color = TextPrimary, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun CallScreenOverlay(overlayId: String) {
    if (overlayId.isBlank()) return
    Box(Modifier.fillMaxSize()) {
        when (overlayId) {
            "call_soft_glow" -> {
                Box(Modifier.fillMaxSize().background(Color.White.copy(alpha = 0.08f)))
            }
            "call_neon_frame" -> {
                Box(Modifier.fillMaxSize().border(4.dp, Brush.linearGradient(listOf(Pink, PrimaryPurple, Color.Cyan)), RoundedCornerShape(24.dp)))
            }
            "call_bollywood_lights" -> {
                Canvas(Modifier.fillMaxSize()) {
                    val w = size.width; val h = size.height
                    for (i in 0..11) {
                        val x = w * (i.toFloat() / 11)
                        drawCircle(Color((i * 30 % 255) / 255f, ((i * 60 + 100) % 255) / 255f, ((i * 90 + 50) % 255) / 255f, 0.3f), radius = 18f, center = Offset(x, h * 0.08f * (if (i % 2 == 0) 1f else 3f)))
                    }
                }
            }
            "call_vintage" -> {
                Box(Modifier.fillMaxSize().background(Color(0xFFD4A574).copy(alpha = 0.15f)))
            }
            else -> {}
        }
    }
}
