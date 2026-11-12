package com.example.yugm.feature.room.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.clickable
import androidx.compose.foundation.lazy.items
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.TextButton as MaterialTextButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import android.Manifest
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
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
import com.example.yugm.core.model.PkMode
import com.example.yugm.core.model.PkOpponent
import com.example.yugm.core.model.PkSideType
import com.example.yugm.core.model.PkStatus
import com.example.yugm.core.model.Room
import com.example.yugm.core.model.RoomActivityItem
import com.example.yugm.core.model.RoomMission
import com.example.yugm.core.model.RoomParticipant
import com.example.yugm.core.model.RoomPoll
import com.example.yugm.core.model.SpeakerRequest
import com.example.yugm.core.util.cosmeticDisplayName
import com.example.yugm.core.ui.components.*
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import com.example.yugm.core.ui.theme.TextMuted
import com.example.yugm.core.ui.theme.TextPrimary
import com.example.yugm.core.ui.theme.Gold
import com.example.yugm.core.ui.theme.PrimaryPurple
import com.example.yugm.core.ui.theme.Pink
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.geometry.Offset
import kotlinx.coroutines.delay

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ActiveVoiceRoomScreen(
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
    speakerRequests: List<SpeakerRequest> = emptyList(),
    polls: List<RoomPoll> = emptyList(),
    missions: List<RoomMission> = emptyList(),
    activity: List<RoomActivityItem> = emptyList(),
    onRequestSpeaker: () -> Unit = {},
    onApproveSpeaker: (String) -> Unit = {},
    onRejectSpeaker: (String) -> Unit = {},
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
    onSetRoomAdmin: (String, Boolean) -> Unit = { _, _ -> },
    onReportUser: (String) -> Unit = {},
    isRoomAdmin: Boolean = false,
    forcedMuteVersion: Int = 0,
    forcedRemoveVersion: Int = 0,
    roomReactionEvent: Pair<Int, String> = 0 to "",
    onOpenModes: (() -> Unit)? = null,
    onOpenThemes: (() -> Unit)? = null,
    canSpeak: Boolean = isHost
) {
    DisposableEffect(room.id) {
        onJoin()
        onDispose {
            YugmSocket.disconnect()
            YugmMediaRoom.disconnect()
        }
    }
    var muted by rememberSaveable(room.id) { mutableStateOf(true) }
    val speakingIdentities by YugmMediaRoom.speakingIdentities.collectAsState()
    val context = LocalContext.current
    val microphonePermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) {
            muted = false
            YugmMediaRoom.setMicEnabled(true)
        } else {
            onToast("Microphone permission is needed to speak")
        }
    }
    LaunchedEffect(room.id, canSpeak) {
        if (canSpeak && ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            microphonePermission.launch(Manifest.permission.RECORD_AUDIO)
        }
    }
    LaunchedEffect(forcedMuteVersion) {
        if (forcedMuteVersion > 0) {
            muted = true
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
    var giftOpen by rememberSaveable { mutableStateOf(false) }
    var reactionBurst by rememberSaveable { mutableStateOf("") }
    val floatingEmojis = remember { mutableStateListOf<FloatingEmoji>() }
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
    var showEntryOverlay by rememberSaveable { mutableStateOf(true) }
    LaunchedEffect(Unit) {
        delay(2000)
        showEntryOverlay = false
    }
    LaunchedEffect(reactionBurst) {
        if (reactionBurst.isNotBlank()) {
            delay(1200)
            reactionBurst = ""
        }
    }
    val emojiCounter = remember { mutableStateOf(0) }
    val emojiClicks = remember { androidx.compose.runtime.mutableStateMapOf<String, Int>() }
    LaunchedEffect(floatingEmojis.size) {
        if (floatingEmojis.isNotEmpty()) {
            delay(2200)
            floatingEmojis.removeFirstOrNull()
        }
    }
    LaunchedEffect(roomReactionEvent.first) {
        val emoji = when (roomReactionEvent.second) {
            "heart" -> "🫶"
            "fire" -> "✨"
            "laugh" -> "😹"
            "clap" -> "🙌"
            "wow" -> "🤯"
            else -> "✨"
        }
        if (roomReactionEvent.first > 0) {
            emojiCounter.value++
            floatingEmojis.add(FloatingEmoji(id = "live-${emojiCounter.value}", emoji = emoji))
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
            val guestId = participants.firstOrNull { it.user.id.isNotBlank() && it.user.id != room.host?.id && !it.isRoomAdmin }?.user?.id
            if (canSpeak) {
                ControlButton(
                    if (muted) "Unmute" else "Mute",
                    active = !muted,
                    accessibilityLabel = if (muted) "Unmute microphone" else "Mute microphone"
                ) {
                    if (!muted) {
                        muted = true
                        YugmMediaRoom.setMicEnabled(false)
                    } else if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                        muted = false
                        YugmMediaRoom.setMicEnabled(true)
                    } else {
                        microphonePermission.launch(Manifest.permission.RECORD_AUDIO)
                    }
                }
            }
            if (!canSpeak && !isHost) {
                val requestPending = speakerRequests.isNotEmpty()
                ControlButton(if (requestPending) "Mic pending" else "Request mic", active = requestPending) { onRequestSpeaker() }
            }
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
            }
            if (!isHost) room.host?.let { host ->
                ControlButton("Report", danger = true) { onReportUser(host.id) }
            }
            if (!isHost) ControlButton("Leave", danger = true) { onBack() }
        }
    ) {
        AnimatedEntrance(delay = 200) {
            Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                if (room.ambience.isNotBlank()) {
                    androidx.compose.foundation.layout.Row(
                        modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        ReferenceChip("♪ ${cosmeticDisplayName(room.ambience)}", selected = true, onClick = {})
                    }
                }
                room.host?.let { HostCard(it) }
                if (pkBattle != null && pkBattle.status == PkStatus.ACTIVE) {
                    PkBattleHeader(pkBattle, isHost = isHost, onEnd = onEndPk)
                    androidx.compose.foundation.layout.Row(horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(10.dp)) {
                        PkSideCard(pkBattle.left, PkSideType.LEFT, pkBattle.leader == PkSideType.LEFT, modifier = Modifier.weight(1f))
                        PkSideCard(pkBattle.right, PkSideType.RIGHT, pkBattle.leader == PkSideType.RIGHT, modifier = Modifier.weight(1f))
                    }
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
                if (isHost && speakerRequests.isNotEmpty()) {
                    SectionTitle("Speaker requests")
                    speakerRequests.forEach { request ->
                        GlassCard {
                            Text("${request.user.name} wants to speak", color = TextPrimary, fontWeight = FontWeight.Bold)
                            androidx.compose.foundation.layout.Row(horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(8.dp)) {
                                ControlButton("Approve") { onApproveSpeaker(request.user.id) }
                                ControlButton("Deny", danger = true) { onRejectSpeaker(request.user.id) }
                            }
                        }
                    }
                }
                SectionTitle(if (isHost) "Speaker seats · tap to manage" else "Speaker seats")
                val speakers = participants.filter { it.role in listOf("HOST", "SPEAKER", "MODERATOR") }
                androidx.compose.foundation.layout.Column(verticalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(10.dp)) {
                    repeat((room.maxSpeakers + 2) / 3) { row ->
                        androidx.compose.foundation.layout.Row(horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(10.dp)) {
                            repeat(3) { col ->
                                val index = row * 3 + col
                                if (index < room.maxSpeakers) {
                                    val participant = speakers.getOrNull(index)
                                    Box(
                                        Modifier.weight(1f).then(
                                            if (participant != null && (isHost || isRoomAdmin)) {
                                                Modifier.semantics { contentDescription = "${participant.user.name}${if (participant.isRoomAdmin) ", room admin" else ""}" }
                                                    .clickable(role = Role.Button, onClickLabel = "Manage ${participant.user.name}") { selectedParticipant = participant }
                                            } else Modifier
                                        )
                                    ) {
                                        SeatCard(
                                            name = participant?.user?.name ?: if (index == 0) room.host?.name ?: "Open seat" else "Open seat",
                                            cosmetics = participant?.user?.activeCosmetics ?: room.host?.activeCosmetics ?: com.example.yugm.core.model.ActiveCosmetics(),
                                            isSpeaking = participant?.user?.id?.let(speakingIdentities::contains) == true,
                                            showEntry = participant != null || index == 0,
                                            modifier = Modifier.fillMaxWidth()
                                        )
                                        if (participant?.isRoomAdmin == true) {
                                            Text(
                                                "ADMIN",
                                                color = Gold,
                                                fontSize = 8.sp,
                                                fontWeight = FontWeight.Black,
                                                modifier = Modifier.align(Alignment.TopEnd).padding(top = 8.dp, end = 8.dp)
                                            )
                                        }
                                    }
                                } else {
                                    androidx.compose.foundation.layout.Spacer(androidx.compose.ui.Modifier.weight(1f))
                                }
                            }
                        }
                    }
                }
                SectionTitle("Audience")
                val audience = participants.filter { it.role == "AUDIENCE" }
                Text("${audience.size} listening / ${room.participants} live", color = TextMuted, fontSize = 13.sp)
                if (audience.isNotEmpty()) {
                    androidx.compose.foundation.lazy.LazyRow(horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(12.dp)) {
                        items(audience.take(12).size) { index ->
                            val listener = audience[index].user
                            androidx.compose.foundation.layout.Column(
                                horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally,
                                modifier = Modifier
                                    .semantics { contentDescription = "${listener.name}${if (audience[index].isRoomAdmin) ", room admin" else ""}" }
                                    .clickable(role = Role.Button, onClickLabel = if (isHost || isRoomAdmin) "Manage ${listener.name}" else null) { if (isHost || isRoomAdmin) selectedParticipant = audience[index] }
                            ) {
                                com.example.yugm.core.ui.components.Avatar(listener.name.take(1), 42, listener.avatar, listener.activeCosmetics)
                                Text(listener.name.take(12), color = TextPrimary, fontSize = 11.sp, maxLines = 1)
                                if (audience[index].isRoomAdmin) Text("ADMIN", color = Gold, fontSize = 8.sp, fontWeight = FontWeight.Black)
                            }
                        }
                    }
                } else {
                    Text("No listeners yet. Invite someone to join the room.", color = TextMuted, fontSize = 13.sp)
                }
                SectionTitle("Room reactions")
                val emojiRow = listOf(
                    Triple("🥹", "heart", "Send a touched reaction"),
                    Triple("✨", "fire", "Send a sparkle reaction"),
                    Triple("😹", "laugh", "Send a laugh reaction"),
                    Triple("🙌", "clap", "Send a celebration reaction"),
                    Triple("🤯", "wow", "Send a mind blown reaction"),
                    Triple("🫶", "heart", "Send a heart hands reaction")
                )
                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp)
                ) {
                    emojiRow.forEach { (emoji, type, description) ->
                        val scale by animateFloatAsState(
                            targetValue = if ((emojiClicks[emoji] ?: 0) % 2 == 1) 1.18f else 1f,
                            animationSpec = spring(dampingRatio = 0.42f, stiffness = 520f),
                            label = "reaction-scale-$emoji"
                        )
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .heightIn(min = 56.dp)
                                .clip(androidx.compose.foundation.shape.CircleShape)
                                .background(Brush.linearGradient(listOf(Color(0xFF30234E), Color(0xFF1A1930))))
                                .semantics { contentDescription = description }
                                .clickable(role = Role.Button, onClickLabel = description) {
                                    onReact(type)
                                    emojiClicks[emoji] = (emojiClicks[emoji] ?: 0) + 1
                                }
                                .padding(vertical = 6.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(emoji, fontSize = 27.sp, modifier = Modifier.graphicsLayer { scaleX = scale; scaleY = scale })
                        }
                    }
                }
                Spacer(Modifier.height(4.dp))
                MissionStrip(missions)
                PollCard(poll = polls.firstOrNull(), isHost = isHost, onCreate = { showPollComposer = true }, onVote = onVotePoll)
                ActivityFeed(activity)
            }
        }
    }
        if (showEntryOverlay) {
            RoomEntryOverlay(room.host?.activeCosmetics?.roomEntry ?: "")
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
    selectedParticipant?.let { target ->
        val isSelf = target.user.id == room.host?.id
        val canManageTarget = target.user.id != room.host?.id && (!target.isRoomAdmin || isHost)
        AlertDialog(
            onDismissRequest = { selectedParticipant = null },
            title = { Text(target.user.name, fontWeight = FontWeight.Bold) },
            text = { Text(if (target.isRoomAdmin) "Room admin" else target.role.lowercase().replaceFirstChar { it.uppercase() }) },
            confirmButton = {
                androidx.compose.foundation.layout.Column {
                    if (isHost && !isSelf) {
                        MaterialTextButton(onClick = {
                            onSetRoomAdmin(target.user.id, !target.isRoomAdmin)
                            selectedParticipant = null
                        }) { Text(if (target.isRoomAdmin) "Remove room admin" else "Promote to room admin") }
                    }
                    if (canManageTarget && (isHost || isRoomAdmin)) {
                        MaterialTextButton(onClick = { onMuteUser(target.user.id); selectedParticipant = null }) { Text("Mute microphone") }
                        MaterialTextButton(onClick = { onRemoveUser(target.user.id); selectedParticipant = null }) { Text("Remove from room", color = Pink) }
                    }
                }
            },
            dismissButton = { MaterialTextButton(onClick = { selectedParticipant = null }) { Text("Close") } }
        )
    }
}

@Composable
fun MissionStrip(missions: List<RoomMission>) {
    if (missions.isEmpty()) return
    SectionTitle("Room missions")
    missions.forEach { mission ->
        GlassCard {
            Text(mission.title, color = TextPrimary, fontWeight = FontWeight.Black)
            Text("${mission.progress}/${mission.target} / ${mission.reward} coins", color = if (mission.complete) Gold else TextMuted, fontSize = 12.sp)
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
                Text("ROOM PROMPT", color = Pink, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.1.sp)
                Text("Ask the room", color = TextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Black)
                Text("Create a quick vote and let everyone weigh in.", color = TextMuted, fontSize = 13.sp)
                PrimaryButton(
                    text = "Create poll",
                    modifier = androidx.compose.ui.Modifier.fillMaxWidth(),
                    onClick = onCreate
                )
            }
        }
        return
    }
    val total = poll.options.sumOf { it.votes }.coerceAtLeast(1)
    GlassCard {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
            Text("ROOM POLL", color = Pink, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.1.sp)
            Text(poll.question, color = TextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Black)
            poll.options.forEachIndexed { index, option ->
                val pct = (option.votes * 100) / total
                androidx.compose.foundation.layout.Row(
                    modifier = androidx.compose.ui.Modifier
                        .fillMaxWidth()
                        .heightIn(min = 48.dp)
                        .clip(androidx.compose.foundation.shape.RoundedCornerShape(14.dp))
                        .background(com.example.yugm.core.ui.theme.SurfaceElevated)
                        .semantics { contentDescription = "Vote for ${option.text}, $pct percent" }
                        .clickable(role = Role.Button, onClickLabel = "Vote for ${option.text}") { onVote(poll.id, index) }
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                    verticalAlignment = androidx.compose.ui.Alignment.CenterVertically
                ) {
                    Text(option.text, color = TextPrimary, modifier = Modifier.weight(1f), fontSize = 14.sp)
                    Text("$pct%", color = Gold, fontWeight = FontWeight.Black, fontSize = 13.sp)
                }
            }
        }
    }
}

@Composable
fun ActivityFeed(activity: List<RoomActivityItem>) {
    if (activity.isEmpty()) return
    GlassCard {
        Column(verticalArrangement = Arrangement.spacedBy(9.dp), modifier = Modifier.fillMaxWidth()) {
            Text("LIVE ACTIVITY", color = TextMuted, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.1.sp)
            activity.takeLast(4).forEach {
                androidx.compose.foundation.layout.Row(
                    verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(9.dp)
                ) {
                    Box(Modifier.size(7.dp).background(Pink, androidx.compose.foundation.shape.CircleShape))
                    Text(it.label, color = TextPrimary, fontSize = 13.sp)
                }
            }
        }
    }
}

@Composable
fun ReactionBurst(label: String) {
    AnimatedVisibility(
        visible = label.isNotBlank(),
        enter = fadeIn() + scaleIn(initialScale = 0.82f) + slideInVertically { it / 2 },
        exit = fadeOut() + scaleOut(targetScale = 1.18f) + slideOutVertically { -it / 2 }
    ) {
        GlassCard {
            Text(label, color = Gold, fontSize = 24.sp, fontWeight = FontWeight.Black)
            Text("Reaction sent", color = TextMuted, fontSize = 12.sp)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FriendInviteSheet(
    hosts: List<Host>,
    onDismiss: () -> Unit,
    onInvite: (String) -> Unit
) {
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            verticalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 8.dp)
        ) {
            Text("Invite friends", color = TextPrimary, fontSize = 22.sp, fontWeight = FontWeight.Black)
            if (hosts.isEmpty()) {
                Text("Follow people first, then invite them into rooms from here.", color = TextMuted)
            } else {
                hosts.take(12).forEach { host ->
                    HostRow(host = host, onClick = { onInvite(host.id) })
                }
            }
            Spacer(Modifier.width(1.dp))
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
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            verticalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 8.dp)
        ) {
            Text("Create poll", color = TextPrimary, fontSize = 22.sp, fontWeight = FontWeight.Black)
            YugmTextField(question, { question = it }, "Question")
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                YugmTextField(optionA, { optionA = it }, "Option 1", modifier = Modifier.weight(1f))
                YugmTextField(optionB, { optionB = it }, "Option 2", modifier = Modifier.weight(1f))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                YugmTextField(optionC, { optionC = it }, "Option 3", modifier = Modifier.weight(1f))
                YugmTextField(optionD, { optionD = it }, "Option 4", modifier = Modifier.weight(1f))
            }
            TextButton(
                onClick = {
                    val options = listOf(optionA, optionB, optionC, optionD).map { it.trim() }.filter { it.isNotBlank() }
                    if (question.isNotBlank() && options.size >= 2) onCreate(question.trim(), options)
                },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Launch poll", color = Gold, fontWeight = FontWeight.Black)
            }
        }
    }
}

@Composable
private fun RoomEntryOverlay(entryId: String) {
    if (entryId.isBlank()) return
    val alpha by animateFloatAsState(targetValue = 0f, animationSpec = tween(1800), finishedListener = {})
    Box(
        Modifier.fillMaxSize().alpha(alpha),
        contentAlignment = Alignment.Center
    ) {
        when (entryId) {
            "room_entry_confetti" -> {
                Text("🎉✨🎊", fontSize = 60.sp)
            }
            "room_entry_spotlight" -> {
                Box(Modifier.fillMaxSize().background(Brush.radialGradient(listOf(Color.White.copy(alpha = 0.4f), Color.Transparent), radius = 200f)))
            }
            "entry_rainbow" -> {
                Box(Modifier.fillMaxSize().background(Brush.sweepGradient(listOf(Color.Red, Color.Yellow, Color.Green, Color.Cyan, Color.Blue, Color.Magenta, Color.Red), Offset(500f, 500f))))
            }
            "entry_ghost" -> {
                Text("👻💨", fontSize = 64.sp)
            }
        }
    }
}
