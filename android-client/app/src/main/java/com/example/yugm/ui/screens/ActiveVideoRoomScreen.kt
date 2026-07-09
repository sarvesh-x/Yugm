package com.example.yugm.ui.screens

import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.width
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.api.YugmMediaRoom
import com.example.yugm.api.YugmSocket
import com.example.yugm.model.ChatMessage
import com.example.yugm.model.GiftItem
import com.example.yugm.model.Host
import com.example.yugm.model.PkBattle
import com.example.yugm.model.PkLeaderboardEntry
import com.example.yugm.model.PkLiveEffect
import com.example.yugm.model.PkMediaSession
import com.example.yugm.model.PkMode
import com.example.yugm.model.PkOpponent
import com.example.yugm.model.PkSideType
import com.example.yugm.model.PkStatus
import com.example.yugm.model.Room
import com.example.yugm.model.RoomActivityItem
import com.example.yugm.model.RoomMission
import com.example.yugm.model.RoomParticipant
import com.example.yugm.model.RoomPoll
import com.example.yugm.ui.components.ControlButton
import com.example.yugm.ui.components.PkBattleButton
import com.example.yugm.ui.components.PkBattleHeader
import com.example.yugm.ui.components.PkBattleScoreBar
import com.example.yugm.ui.components.PkGiftPanel
import com.example.yugm.ui.components.PkInviteCard
import com.example.yugm.ui.components.PkLeaderboard
import com.example.yugm.ui.components.PkLiveEffectBurst
import com.example.yugm.ui.components.PkOpponentSearchSheet
import com.example.yugm.ui.components.PkReactionPanel
import com.example.yugm.ui.components.PkResultDialog
import com.example.yugm.ui.components.PkSetupBottomSheet
import com.example.yugm.ui.components.PkTeamSelector
import com.example.yugm.ui.components.PkVideoStage
import com.example.yugm.ui.components.PkWaitingState
import com.example.yugm.ui.components.RoomShell
import com.example.yugm.ui.components.SectionTitle
import com.example.yugm.ui.components.VideoGrid
import com.example.yugm.ui.theme.TextMuted
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
    onReact: () -> Unit = {},
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
    onReportUser: (String) -> Unit = {}
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
    LaunchedEffect(reactionBurst) {
        if (reactionBurst.isNotBlank()) {
            delay(1200)
            reactionBurst = ""
        }
    }
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
            ControlButton(if (mic) "Mic on" else "Mic off", active = mic) { mic = !mic }
            ControlButton(if (camera) "Cam on" else "Cam off", active = camera) { camera = !camera }
            ControlButton("Flip") { onToast("Camera switched") }
            ControlButton("Speak") { onRequestSpeaker() }
            ControlButton("Gift") { giftOpen = true }
            ControlButton("React") {
                reactionBurst = "FIRE"
                onReact()
            }
            ControlButton("Invite") {
                showInvitePicker = true
            }
            ControlButton("DM") { onDirectMessage(if (isHost) participants.firstOrNull { it.user.id != room.host?.id }?.user?.id else null) }
            if (isHost) {
                Spacer(Modifier.width(8.dp))
                if (pkBattle == null || pkBattle.status !in listOf(PkStatus.ACTIVE, PkStatus.INVITED, PkStatus.WAITING)) {
                    ControlButton("Start PK") { showPkSetup = true }
                }
                ControlButton("End", danger = true) { onEndRoom() }
                room.host?.let { host ->
                    ControlButton("Mute user") { onMuteUser(host.id) }
                    ControlButton("Remove user", danger = true) { onRemoveUser(host.id) }
                }
            }
            room.host?.let { host ->
                ControlButton("Report", danger = true) { onReportUser(host.id) }
            }
        }
    ) {
        if (pkBattle != null && pkBattle.status == PkStatus.ACTIVE) {
            PkBattleHeader(pkBattle, isHost = isHost, onEnd = onEndPk)
            PkVideoStage(pkBattle, pkOpponentMedia)
            PkBattleScoreBar(pkBattle)
            PkTeamSelector(pkBattle, selectedSide = pkGiftSide, onSelect = { pkGiftSide = it })
            PkLiveEffectBurst(pkLiveEffect)
            PkGiftPanel(gifts = gifts, balance = balance, selectedSide = pkGiftSide, onSideChange = { pkGiftSide = it }, onSend = onSendPkGift)
            PkReactionPanel(onReact = onSendPkReaction, side = pkGiftSide)
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
        VideoGrid(room = room, camera = camera)
        MissionStrip(missions)
        PollCard(poll = polls.firstOrNull(), isHost = isHost, onCreate = { showPollComposer = true }, onVote = onVotePoll)
        ActivityFeed(activity)
        ReactionBurst(reactionBurst)
        Text("Audience mode supported / Host highlighted / Video seats limit ${room.maxSpeakers}", color = TextMuted, fontSize = 12.sp)
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
