package com.yugm.app.feature.room.screens

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.CardGiftcard
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MicOff
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.SentimentSatisfiedAlt
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.StopCircle
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.compose.ui.viewinterop.AndroidView
import com.yugm.app.core.api.YugmMediaRoom
import com.yugm.app.core.api.YugmSocket
import com.yugm.app.core.model.ChatMessage
import com.yugm.app.core.model.GiftItem
import com.yugm.app.core.model.Host
import com.yugm.app.core.model.Room
import com.yugm.app.core.model.RoomParticipant
import com.yugm.app.core.model.SpeakerRequest
import com.yugm.app.core.model.PkBattle
import com.yugm.app.core.model.PkLeaderboardEntry
import com.yugm.app.core.model.PkLiveEffect
import com.yugm.app.core.model.PkMediaSession
import com.yugm.app.core.model.PkMode
import com.yugm.app.core.model.PkOpponent
import com.yugm.app.core.model.PkSideType
import com.yugm.app.core.model.PkStatus
import com.yugm.app.core.ui.components.Avatar
import com.yugm.app.core.ui.components.GiftPanel
import com.yugm.app.core.ui.components.*
import livekit.org.webrtc.SurfaceViewRenderer
import kotlinx.coroutines.delay

private val StreamInk = Color(0xFFF8FAFC)
private val StreamMuted = Color(0xFFD0D1DB)
private val StreamPink = Color(0xFFFF3E87)
private val StreamPanel = Color(0xCC101118)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VideoLivestreamScreen(
    room: Room,
    chat: List<ChatMessage>,
    gifts: List<GiftItem>,
    balance: Int,
    diamondBalance: Int = 0,
    isHost: Boolean,
    currentUserId: String,
    participants: List<RoomParticipant>,
    speakerRequests: List<SpeakerRequest>,
    inviteCandidates: List<Host>,
    pkBattle: PkBattle?,
    pkInviteId: String?,
    pkOpponents: List<PkOpponent>,
    pkLeaderboard: List<PkLeaderboardEntry>,
    pkLiveEffect: PkLiveEffect?,
    pkOpponentMedia: PkMediaSession?,
    onBack: () -> Unit,
    onMinimize: () -> Unit,
    onJoin: (cameraGranted: Boolean, microphoneGranted: Boolean) -> Unit,
    onSendMessage: (String) -> Unit,
    onGift: (GiftItem, String) -> Unit,
    onToast: (String) -> Unit,
    onRequestSpeaker: () -> Unit,
    onApproveSpeaker: (String) -> Unit,
    onRejectSpeaker: (String) -> Unit,
    onInviteFriend: (String) -> Unit,
    onReact: (String) -> Unit,
    onReportHost: (String) -> Unit,
    onLoadPkOpponents: (String) -> Unit,
    onInvitePk: (PkOpponent, PkMode, Int, String) -> Unit,
    onAutoMatchPk: (PkMode, Int, String) -> Unit,
    onSendPkGift: (GiftItem, PkSideType) -> Unit,
    onSendPkReaction: (String, PkSideType) -> Unit,
    onAcceptPk: (String) -> Unit,
    onRejectPk: (String) -> Unit,
    onEndPk: () -> Unit,
    onEndRoom: () -> Unit
) {
    val context = LocalContext.current
    val ownRole = participants.firstOrNull { it.user.id == currentUserId }?.role.orEmpty()
    val isOnVoiceStage = isHost || ownRole in setOf("HOST", "SPEAKER", "MODERATOR")
    val hasPendingRequest = speakerRequests.any { it.user.id == currentUserId }
    var cameraOn by rememberSaveable(room.id) { mutableStateOf(isHost) }
    var micOn by rememberSaveable(room.id) { mutableStateOf(isHost) }
    var localRequestSent by rememberSaveable(room.id) { mutableStateOf(false) }
    var giftOpen by rememberSaveable(room.id) { mutableStateOf(false) }
    var moreActionsOpen by rememberSaveable(room.id) { mutableStateOf(false) }
    var reactionPickerOpen by rememberSaveable(room.id) { mutableStateOf(false) }
    var requestQueueOpen by rememberSaveable(room.id) { mutableStateOf(false) }
    var inviteOpen by rememberSaveable(room.id) { mutableStateOf(false) }
    var showHeaderInfo by rememberSaveable(room.id) { mutableStateOf(false) }
    var confirmEnd by rememberSaveable(room.id) { mutableStateOf(false) }
    var showHostExit by rememberSaveable(room.id) { mutableStateOf(false) }
    var showLeavePrompt by rememberSaveable(room.id) { mutableStateOf(false) }
    var showPkSetup by rememberSaveable(room.id) { mutableStateOf(false) }
    var showPkOpponents by rememberSaveable(room.id) { mutableStateOf(false) }
    var pkSearch by rememberSaveable(room.id) { mutableStateOf("") }
    var pkMode by rememberSaveable(room.id) { mutableStateOf(PkMode.GIFT) }
    var pkDuration by rememberSaveable(room.id) { mutableStateOf(180) }
    var pkTitle by rememberSaveable(room.id) { mutableStateOf("Video PK") }
    var pkGiftSide by rememberSaveable(room.id) { mutableStateOf(PkSideType.LEFT) }
    var dismissedPkResultId by rememberSaveable(room.id) { mutableStateOf<String?>(null) }
    var message by rememberSaveable(room.id) { mutableStateOf("") }
    var feeds by remember { mutableStateOf<List<YugmMediaRoom.VideoFeed>>(emptyList()) }
    var opponentFeeds by remember { mutableStateOf<List<YugmMediaRoom.VideoFeed>>(emptyList()) }
    var joined by rememberSaveable(room.id) { mutableStateOf(false) }
    var requestVoiceAfterPermission by rememberSaveable(room.id) { mutableStateOf(false) }
    val ownCameraGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
    val ownMicGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

    val joinPermissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result ->
        val cameraAllowed = result[Manifest.permission.CAMERA] == true || ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        val micAllowed = result[Manifest.permission.RECORD_AUDIO] == true || ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        cameraOn = isHost && cameraAllowed
        micOn = isHost && micAllowed
        onJoin(cameraAllowed && isHost, micAllowed && isHost)
        if (isHost && (!cameraAllowed || !micAllowed)) onToast("Allow camera and microphone to start your livestream with video and sound.")
    }
    val cameraPermissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        cameraOn = granted
        if (granted) YugmMediaRoom.setCameraEnabled(true) else onToast("Camera permission is needed to stream video.")
    }
    val microphonePermissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (requestVoiceAfterPermission) {
            requestVoiceAfterPermission = false
            if (granted) { localRequestSent = true; onRequestSpeaker() }
            else onToast("Microphone access is needed before you can request to speak.")
        } else {
            micOn = granted
            if (granted) YugmMediaRoom.setMicEnabled(true) else onToast("Microphone permission is needed to speak.")
        }
    }

    LaunchedEffect(room.id, isHost) {
        if (!joined) {
            joined = true
            if (isHost && (!ownCameraGranted || !ownMicGranted)) {
                joinPermissionLauncher.launch(arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO))
            } else {
                cameraOn = isHost && ownCameraGranted
                micOn = isHost && ownMicGranted
                onJoin(isHost && ownCameraGranted, isHost && ownMicGranted)
            }
        }
    }
    LaunchedEffect(room.id) {
        while (true) {
            val allFeeds = YugmMediaRoom.videoFeeds()
            feeds = allFeeds.filter { feed ->
                if (isHost) feed.isLocal && feed.identity == currentUserId
                else feed.identity == room.host?.id || feed.label == room.host?.name
            }.take(1)
            opponentFeeds = YugmMediaRoom.opponentVideoFeeds().filter { !it.isLocal }.take(1)
            delay(700)
        }
    }
    LaunchedEffect(ownRole, isHost) {
        if (isHost || ownRole in setOf("SPEAKER", "MODERATOR")) micOn = true
    }
    LaunchedEffect(hasPendingRequest) { if (hasPendingRequest) localRequestSent = true }
    DisposableEffect(room.id) {
        onDispose {
            YugmSocket.disconnect()
            YugmMediaRoom.disconnect()
        }
    }

    val hostFeed = feeds.firstOrNull()
    Box(Modifier.fillMaxSize().background(Color(0xFF05060A))) {
        if (pkBattle?.status == PkStatus.ACTIVE && pkBattle.battleType.name == "VIDEO") {
            Box(Modifier.fillMaxSize().background(Color(0xFF07070B)))
        } else if (hostFeed != null) {
            HostVideoStage(hostFeed, Modifier.fillMaxSize(), mirror = isHost)
        } else {
            Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xFF251642), Color(0xFF11121B), Color(0xFF05060A)))), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(Modifier.size(116.dp).clip(CircleShape).border(2.dp, Color.White.copy(alpha = .74f), CircleShape), contentAlignment = Alignment.Center) {
                        Avatar(room.host?.name?.take(1) ?: "?", 110, room.host?.avatar, room.host?.activeCosmetics ?: com.yugm.app.core.model.ActiveCosmetics())
                    }
                    Text(if (cameraOn && isHost) "Starting your livestream…" else "${room.host?.name ?: "Host"} is getting ready", color = StreamInk, fontSize = 17.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 16.dp))
                    Text("The live video will appear here", color = StreamMuted, fontSize = 13.sp, modifier = Modifier.padding(top = 5.dp))
                    if (isHost && !cameraOn) {
                        Button(onClick = {
                            if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                                cameraOn = true
                                YugmMediaRoom.setCameraEnabled(true)
                            } else cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                        }, modifier = Modifier.padding(top = 14.dp), colors = ButtonDefaults.buttonColors(containerColor = StreamPink)) {
                            Text("Start camera", color = Color.White, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }

        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xB8000000), Color.Transparent, Color.Transparent, Color(0xE8000000)))))
        Column(Modifier.fillMaxSize()) {
            SharedRoomHeader(
                room = room,
                participants = participants,
                isHost = isHost,
                modifier = Modifier.statusBarsPadding(),
                onShare = {
                    val shareIntent = Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(Intent.EXTRA_TEXT, "Join ${room.title.ifBlank { "my room" }} on Yugm: yugm.live/room/${room.id}")
                    }
                    context.startActivity(Intent.createChooser(shareIntent, "Share room"))
                },
                onMore = { showHeaderInfo = true },
                onRankClick = { onToast("Room Ranking #1 in Live Video") },
                onLeave = { if (isHost) showHostExit = true else showLeavePrompt = true }
            )

            if (pkBattle?.status == PkStatus.ACTIVE && pkBattle.battleType.name == "VIDEO") {
                PkBattleHeader(pkBattle, isHost = isHost, onEnd = onEndPk)
                PkBattleScoreBar(pkBattle)
                Row(Modifier.fillMaxWidth().height(180.dp).padding(horizontal = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    hostFeed?.let { HostVideoStage(it, Modifier.weight(1f).fillMaxSize(), mirror = isHost) }
                    val opponentFeed = opponentFeeds.firstOrNull()
                    if (opponentFeed != null) OpponentVideoStage(opponentFeed, Modifier.weight(1f).fillMaxSize())
                    else Box(Modifier.weight(1f).fillMaxSize().clip(RoundedCornerShape(18.dp)).background(StreamPanel), contentAlignment = Alignment.Center) {
                        Text("Connecting to ${if (pkBattle.left.roomId == room.id) pkBattle.right.hostName else pkBattle.left.hostName}…", color = StreamMuted, fontSize = 12.sp)
                    }
                }
                PkLiveEffectBurst(pkLiveEffect)
                PkTeamSelector(pkBattle, pkGiftSide) { pkGiftSide = it }
                PkGiftPanel(gifts, balance, pkGiftSide, { pkGiftSide = it }) { gift, side -> onSendPkGift(gift, side) }
                PkReactionPanel(onSendPkReaction, pkGiftSide)
                PkLeaderboard(pkLeaderboard)
            } else if (pkBattle != null && pkBattle.status == PkStatus.INVITED && isHost && pkBattle.right.roomId == room.id && !pkInviteId.isNullOrBlank()) {
                PkInviteCard(pkBattle, pkBattle.left.hostName, { onAcceptPk(pkInviteId) }, { onRejectPk(pkInviteId) })
            } else if (pkBattle?.status == PkStatus.WAITING || pkBattle?.status == PkStatus.INVITED) {
                PkWaitingState(pkBattle)
            }

            Spacer(Modifier.weight(1f))

            Column(Modifier.fillMaxWidth().padding(horizontal = 14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                chat.takeLast(4).forEach { item ->
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Text(item.author.ifBlank { "Viewer" }, color = Color(0xFFFFC0D5), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        Text("  ${item.text}", color = Color.White, fontSize = 12.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
            Text("Be kind. Keep personal information private.", color = Color.White.copy(alpha = .75f), fontSize = 10.sp, modifier = Modifier.padding(start = 16.dp, top = 10.dp, bottom = 8.dp))

            Row(
                Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 8.dp).navigationBarsPadding(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Row(
                    Modifier.weight(1f).height(44.dp).clip(CircleShape).background(Color(0x66201B2B))
                        .border(1.dp, Color(0x553C3154), CircleShape).padding(start = 15.dp, end = 7.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    BasicTextField(
                        value = message,
                        onValueChange = { message = it.take(300) },
                        textStyle = androidx.compose.ui.text.TextStyle(color = StreamInk, fontSize = 13.sp),
                        cursorBrush = androidx.compose.ui.graphics.SolidColor(StreamPink),
                        modifier = Modifier.weight(1f).semantics { contentDescription = "Write a livestream message" },
                        singleLine = true,
                        decorationBox = { inner -> Box { if (message.isBlank()) Text("Say Something...", color = StreamMuted, fontSize = 13.sp); inner() } }
                    )
                    if (message.isNotBlank()) {
                        IconButton(onClick = {
                            val text = message.trim()
                            if (text.isNotEmpty()) { onSendMessage(text); message = "" }
                        }, modifier = Modifier.size(34.dp).semantics { contentDescription = "Send message" }) {
                            Icon(Icons.Filled.Send, contentDescription = null, tint = StreamPink, modifier = Modifier.size(18.dp))
                        }
                    }
                }
                IconButton(
                    onClick = { reactionPickerOpen = true },
                    modifier = Modifier.size(32.dp).clip(CircleShape).border(1.dp, Color(0x667E718D), CircleShape)
                        .semantics { contentDescription = "Open emoji reactions" }
                ) { Icon(Icons.Filled.SentimentSatisfiedAlt, contentDescription = null, tint = StreamInk, modifier = Modifier.size(14.dp)) }
                if (!isHost) {
                    val requested = localRequestSent || hasPendingRequest
                    IconButton(
                        enabled = isOnVoiceStage,
                        onClick = {
                            if (micOn) { micOn = false; YugmMediaRoom.setMicEnabled(false) }
                            else if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) { micOn = true; YugmMediaRoom.setMicEnabled(true) }
                            else microphonePermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                        },
                        modifier = Modifier.size(32.dp).clip(CircleShape).border(1.dp, Color(0x667E718D), CircleShape)
                    ) {
                        Icon(
                            if (isOnVoiceStage && micOn) Icons.Filled.Mic else Icons.Filled.MicOff,
                            contentDescription = if (isOnVoiceStage) "Toggle microphone" else if (requested) "Voice request sent; microphone unavailable until approved" else "Microphone unavailable until host approves voice request",
                            tint = if (isOnVoiceStage && micOn) StreamPink else StreamInk,
                            modifier = Modifier.size(14.dp)
                        )
                    }
                }
                IconButton(
                    onClick = { giftOpen = true },
                    modifier = Modifier.size(32.dp).clip(CircleShape).border(1.dp, Color(0x667E718D), CircleShape)
                        .semantics { contentDescription = "Open gifts" }
                ) { Icon(Icons.Filled.CardGiftcard, contentDescription = null, tint = StreamPink, modifier = Modifier.size(14.dp)) }
                IconButton(
                    onClick = { moreActionsOpen = true },
                    modifier = Modifier.size(32.dp).clip(CircleShape).border(1.dp, Color(0x667E718D), CircleShape)
                        .semantics { contentDescription = "More livestream actions" }
                ) { Icon(Icons.Filled.MoreVert, contentDescription = null, tint = StreamInk, modifier = Modifier.size(16.dp)) }
            }
        }

        if (isHost) {
            Column(
                modifier = Modifier.align(Alignment.BottomEnd).navigationBarsPadding().padding(end = 10.dp, bottom = 70.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                StreamIconControl(if (micOn) Icons.Filled.Mic else Icons.Filled.MicOff, "${if (micOn) "Mute" else "Unmute"} microphone", active = micOn) {
                    if (micOn) { micOn = false; YugmMediaRoom.setMicEnabled(false) }
                    else if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) { micOn = true; YugmMediaRoom.setMicEnabled(true) }
                    else microphonePermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                }
                StreamIconControl(Icons.Filled.Videocam, if (cameraOn) "Turn camera off" else "Turn camera on", active = cameraOn) {
                    if (cameraOn) { cameraOn = false; YugmMediaRoom.setCameraEnabled(false) }
                    else if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) { cameraOn = true; YugmMediaRoom.setCameraEnabled(true) }
                    else cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                }
                StreamIconControl(Icons.Filled.Groups, "Voice requests, ${speakerRequests.size} waiting", active = speakerRequests.isNotEmpty()) { requestQueueOpen = true }
                StreamIconControl(Icons.Filled.PersonAdd, "Invite to room") { inviteOpen = true }
                if (pkBattle == null || pkBattle.status !in setOf(PkStatus.ACTIVE, PkStatus.INVITED, PkStatus.WAITING)) {
                    StreamIconControl(Icons.Filled.Bolt, "Start video PK") { showPkSetup = true }
                }
                StreamIconControl(Icons.Filled.StopCircle, "End livestream", danger = true) { confirmEnd = true }
            }
        } else {
            Column(
                modifier = Modifier.align(Alignment.BottomEnd).navigationBarsPadding().padding(end = 12.dp, bottom = 76.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(3.dp)
            ) {
                Box(
                    Modifier.size(48.dp).clip(CircleShape).background(Color(0x884B225E)).border(1.dp, Color(0x88FFFFFF), CircleShape)
                        .semantics { contentDescription = if (localRequestSent || hasPendingRequest) "Voice request sent" else "Request to join voice call" }
                        .clickable(role = Role.Button) {
                            if (!localRequestSent && !hasPendingRequest) {
                                if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) { localRequestSent = true; onRequestSpeaker() }
                                else { requestVoiceAfterPermission = true; microphonePermissionLauncher.launch(Manifest.permission.RECORD_AUDIO) }
                            }
                        },
                    contentAlignment = Alignment.Center
                ) { Text(if (localRequestSent || hasPendingRequest) "✓" else "∞", color = Color.White, fontSize = 27.sp, fontWeight = FontWeight.Bold) }
                Text(if (localRequestSent || hasPendingRequest) "Request sent" else "Join Call", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }

    if (moreActionsOpen) {
        ModalBottomSheet(onDismissRequest = { moreActionsOpen = false }, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = Color(0xFF14151E)) {
            Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 12.dp).navigationBarsPadding(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Livestream actions", color = StreamInk, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                TextButton(onClick = { moreActionsOpen = false; onReact("heart") }) { Text("♥  Send a like", color = StreamInk) }
                if (!isHost) TextButton(onClick = { moreActionsOpen = false; onReportHost(room.host?.id.orEmpty()) }) { Text("⚑  Report host", color = StreamInk) }
                if (isHost) TextButton(onClick = { moreActionsOpen = false; requestQueueOpen = true }) { Text("✋  Voice requests (${speakerRequests.size})", color = StreamInk) }
                Spacer(Modifier.height(12.dp))
            }
        }
    }

    if (reactionPickerOpen) {
        ModalBottomSheet(onDismissRequest = { reactionPickerOpen = false }, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = Color(0xFF14151E)) {
            Column(Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 12.dp).navigationBarsPadding()) {
                Text("Live reactions", color = StreamInk, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Row(Modifier.fillMaxWidth().padding(vertical = 18.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                    listOf("🙌" to "clap", "😍" to "heart", "🔥" to "fire", "😂" to "laugh", "🤯" to "wow", "🎉" to "party").forEach { (emoji, reaction) ->
                        Text(emoji, modifier = Modifier.clip(RoundedCornerShape(12.dp)).clickable {
                            onReact(reaction)
                            reactionPickerOpen = false
                        }.padding(8.dp), fontSize = 25.sp)
                    }
                }
            }
        }
    }

    GiftPanel(
        open = giftOpen,
        gifts = gifts,
        balance = balance,
        diamondBalance = diamondBalance,
        onDismiss = { giftOpen = false },
        onSend = { gift -> onGift(gift, "COINS") },
        onSendWithCurrency = onGift
    )

    if (requestQueueOpen) {
        ModalBottomSheet(onDismissRequest = { requestQueueOpen = false }, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = Color(0xFF14151E)) {
            Column(Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Requests to join voice", color = StreamInk, fontSize = 20.sp, fontWeight = FontWeight.Black)
                if (speakerRequests.isEmpty()) Text("No one is waiting to join the conversation.", color = StreamMuted, modifier = Modifier.padding(vertical = 12.dp))
                speakerRequests.forEach { request ->
                    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Color(0xFF22232D)).padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
                        Avatar(request.user.name.take(1), 42, request.user.avatar, request.user.activeCosmetics)
                        Column(Modifier.weight(1f).padding(horizontal = 10.dp)) {
                            Text(request.user.name, color = StreamInk, fontWeight = FontWeight.Bold)
                            Text("Wants to join by voice", color = StreamMuted, fontSize = 11.sp)
                        }
                        TextButton(onClick = { onRejectSpeaker(request.user.id) }) { Text("Decline", color = StreamMuted) }
                        Button(onClick = { onApproveSpeaker(request.user.id) }, colors = ButtonDefaults.buttonColors(containerColor = StreamPink), shape = RoundedCornerShape(12.dp)) { Text("Allow", color = Color.White) }
                    }
                }
                Spacer(Modifier.height(16.dp))
            }
        }
    }
    if (inviteOpen) {
        FriendInviteSheet(hosts = inviteCandidates, onDismiss = { inviteOpen = false }, onInvite = { inviteOpen = false; onInviteFriend(it) })
    }
    if (showPkSetup) {
        PkSetupBottomSheet(
            onDismiss = { showPkSetup = false },
            onContinue = { mode, duration, title ->
                pkMode = mode; pkDuration = duration; pkTitle = title
                showPkSetup = false; showPkOpponents = true
                onLoadPkOpponents("")
            },
            onAutoMatch = { mode, duration, title ->
                showPkSetup = false
                onAutoMatchPk(mode, duration, title)
            }
        )
    }
    if (showPkOpponents) {
        PkOpponentSearchSheet(
            opponents = pkOpponents,
            search = pkSearch,
            onSearchChange = { pkSearch = it; onLoadPkOpponents(it) },
            onDismiss = { showPkOpponents = false },
            onInvite = { opponent ->
                showPkOpponents = false
                onInvitePk(opponent, pkMode, pkDuration, pkTitle)
            }
        )
    }
    PkResultDialog(
        battle = pkBattle?.takeUnless { it.id == dismissedPkResultId },
        onDismiss = { dismissedPkResultId = pkBattle?.id },
        onRematch = { dismissedPkResultId = pkBattle?.id; showPkSetup = true }
    )
    if (showHeaderInfo) {
        AlertDialog(
            onDismissRequest = { showHeaderInfo = false },
            title = { Text(room.title.ifBlank { "Livestream details" }, color = StreamInk, fontWeight = FontWeight.Black) },
            text = { Text("Room ID: ${room.id}\nHost: ${room.host?.name ?: "Host"}\n${room.participants} people watching", color = StreamMuted) },
            confirmButton = { TextButton(onClick = { showHeaderInfo = false }) { Text("Done", color = StreamPink) } },
            containerColor = Color(0xFF171821)
        )
    }
    if (confirmEnd) {
        AlertDialog(
            onDismissRequest = { confirmEnd = false },
            title = { Text("End livestream?", color = StreamInk, fontWeight = FontWeight.Black) },
            text = { Text("Viewers will be disconnected from this live room.", color = StreamMuted) },
            confirmButton = { TextButton(onClick = { confirmEnd = false; onEndRoom() }) { Text("End live", color = StreamPink, fontWeight = FontWeight.Bold) } },
            dismissButton = { TextButton(onClick = { confirmEnd = false }) { Text("Keep streaming", color = StreamMuted) } },
            containerColor = Color(0xFF171821)
        )
    }
    if (showHostExit) {
        AlertDialog(
            onDismissRequest = { showHostExit = false },
            title = { Text("Leave livestream?", color = StreamInk, fontWeight = FontWeight.Black) },
            text = { Text("Minimize the livestream to keep it active, or end it and leave.", color = StreamMuted) },
            confirmButton = {
                Column(horizontalAlignment = Alignment.End) {
                    TextButton(onClick = { showHostExit = false; onMinimize() }) { Text("Minimize livestream", color = StreamInk, fontWeight = FontWeight.Bold) }
                    TextButton(onClick = { showHostExit = false; onEndRoom() }) { Text("End and leave", color = StreamPink, fontWeight = FontWeight.Bold) }
                }
            },
            containerColor = Color(0xFF171821)
        )
    }
    if (showLeavePrompt) {
        AlertDialog(
            onDismissRequest = { showLeavePrompt = false },
            title = { Text("Leave livestream?", color = StreamInk, fontWeight = FontWeight.Black) },
            text = { Text("Minimize to keep watching in a floating room, or leave the livestream.", color = StreamMuted) },
            confirmButton = {
                Column(horizontalAlignment = Alignment.End) {
                    TextButton(onClick = { showLeavePrompt = false; onMinimize() }) { Text("Minimize room", color = StreamInk, fontWeight = FontWeight.Bold) }
                    TextButton(onClick = { showLeavePrompt = false; onBack() }) { Text("Leave room", color = StreamPink, fontWeight = FontWeight.Bold) }
                }
            },
            containerColor = Color(0xFF171821)
        )
    }
}

@Composable
private fun StreamIconControl(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    active: Boolean = false,
    danger: Boolean = false,
    onClick: () -> Unit
) {
    val tint = when {
        danger -> StreamPink
        active -> StreamPink
        else -> StreamInk
    }
    Box(
        modifier = Modifier
            .size(34.dp)
            .clip(CircleShape)
            .border(1.dp, if (danger) StreamPink.copy(alpha = .72f) else Color(0x667E718D), CircleShape)
            .semantics { contentDescription = label }
            .clickable(role = Role.Button, onClickLabel = label, onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(16.dp))
    }
}

@Composable
private fun HostVideoStage(feed: YugmMediaRoom.VideoFeed, modifier: Modifier, mirror: Boolean) {
    var renderer by remember(feed.track) { mutableStateOf<SurfaceViewRenderer?>(null) }
    DisposableEffect(feed.track) {
        onDispose {
            renderer?.let { feed.track.removeRenderer(it); it.release() }
            renderer = null
        }
    }
    AndroidView(
        factory = { context ->
            SurfaceViewRenderer(context).also { view ->
                YugmMediaRoom.initializeVideoRenderer(view)
                view.setMirror(mirror)
                feed.track.addRenderer(view)
                renderer = view
            }
        },
        modifier = modifier.background(Color.Black).semantics {
            contentDescription = "Live video stream from ${feed.label}"
        }
    )
}

@Composable
private fun OpponentVideoStage(feed: YugmMediaRoom.VideoFeed, modifier: Modifier) {
    var renderer by remember(feed.track) { mutableStateOf<SurfaceViewRenderer?>(null) }
    DisposableEffect(feed.track) {
        onDispose {
            renderer?.let { feed.track.removeRenderer(it); it.release() }
            renderer = null
        }
    }
    AndroidView(
        factory = { context ->
            SurfaceViewRenderer(context).also { view ->
                YugmMediaRoom.initializeOpponentVideoRenderer(view)
                view.setMirror(false)
                feed.track.addRenderer(view)
                renderer = view
            }
        },
        modifier = modifier.background(Color.Black).semantics {
            contentDescription = "Video PK stream from ${feed.label}"
        }
    )
}

@Composable
private fun LiveBadge(label: String) {
    Row(Modifier.clip(CircleShape).background(if (label == "HOST") Color(0xCC35224A) else Color(0xDDE83E5F)).padding(horizontal = 9.dp, vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(if (label == "HOST") "●" else "●", color = Color.White, fontSize = 8.sp)
        Text(" $label", color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.Black)
    }
}

@Composable
private fun StreamControl(icon: String, label: String, active: Boolean, danger: Boolean = false, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Column(
        modifier.clip(RoundedCornerShape(14.dp)).background(if (danger) Color(0xC9301019) else if (active) Color(0xC934244D) else StreamPanel)
            .border(1.dp, if (active) Color(0x88B98AFF) else Color(0x33FFFFFF), RoundedCornerShape(14.dp))
            .semantics { contentDescription = label }.clickable(role = Role.Button, onClickLabel = label, onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 9.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(3.dp)
    ) {
        Text(icon, fontSize = 18.sp)
        Text(label, color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
    }
}
