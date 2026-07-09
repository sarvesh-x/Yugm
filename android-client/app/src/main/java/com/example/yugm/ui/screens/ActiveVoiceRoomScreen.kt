package com.example.yugm.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import com.example.yugm.model.PkMode
import com.example.yugm.model.PkOpponent
import com.example.yugm.model.PkSideType
import com.example.yugm.model.PkStatus
import com.example.yugm.model.Room
import com.example.yugm.model.RoomActivityItem
import com.example.yugm.model.RoomMission
import com.example.yugm.model.RoomParticipant
import com.example.yugm.model.RoomPoll
import com.example.yugm.model.SpeakerRequest
import com.example.yugm.ui.components.ControlButton
import com.example.yugm.ui.components.GlassCard
import com.example.yugm.ui.components.HostCard
import com.example.yugm.ui.components.HostRow
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
import com.example.yugm.ui.components.PkSideCard
import com.example.yugm.ui.components.PkTeamSelector
import com.example.yugm.ui.components.PkWaitingState
import com.example.yugm.ui.components.RoomShell
import com.example.yugm.ui.components.SectionTitle
import com.example.yugm.ui.components.SeatCard
import com.example.yugm.ui.components.YugmTextField
import com.example.yugm.ui.theme.TextMuted
import com.example.yugm.ui.theme.TextPrimary
import com.example.yugm.ui.theme.Gold
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
    var muted by rememberSaveable { mutableStateOf(false) }
    var giftOpen by rememberSaveable { mutableStateOf(false) }
    var reactionBurst by rememberSaveable { mutableStateOf("") }
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
            ControlButton(if (muted) "Unmute" else "Mute", active = !muted) {
                muted = !muted
                YugmMediaRoom.setMicEnabled(!muted)
            }
            val requestPending = !isHost && speakerRequests.isNotEmpty()
            ControlButton(if (requestPending) "Mic pending" else "Request mic", active = requestPending) { onRequestSpeaker() }
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
        SectionTitle("Speaker seats")
        val speakers = participants.filter { it.role in listOf("HOST", "SPEAKER", "MODERATOR") }
        androidx.compose.foundation.layout.Column(verticalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(10.dp)) {
            repeat((room.maxSpeakers + 2) / 3) { row ->
                androidx.compose.foundation.layout.Row(horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(10.dp)) {
                    repeat(3) { col ->
                        val index = row * 3 + col
                        if (index < room.maxSpeakers) {
                            val participant = speakers.getOrNull(index)
                            SeatCard(
                                name = participant?.user?.name ?: if (index == 0) room.host?.name ?: "Open seat" else "Open seat",
                                cosmetics = participant?.user?.activeCosmetics ?: room.host?.activeCosmetics ?: com.example.yugm.model.ActiveCosmetics(),
                                isSpeaking = participant?.micEnabled ?: (index == 0),
                                showEntry = participant != null || index == 0,
                                modifier = androidx.compose.ui.Modifier.weight(1f)
                            )
                        } else {
                            androidx.compose.foundation.layout.Spacer(androidx.compose.ui.Modifier.weight(1f))
                        }
                    }
                }
            }
        }
        SectionTitle("Audience")
        Text("${participants.count { it.role == "AUDIENCE" }} listening / ${room.participants} live", color = TextMuted, fontSize = 12.sp)
        MissionStrip(missions)
        PollCard(poll = polls.firstOrNull(), isHost = isHost, onCreate = { showPollComposer = true }, onVote = onVotePoll)
        ActivityFeed(activity)
        ReactionBurst(reactionBurst)
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
                Text("Start room prompt", color = TextPrimary, fontWeight = FontWeight.Black)
                Text("Create a quick vote for the room.", color = TextMuted, fontSize = 12.sp)
                ControlButton("Create poll") { onCreate() }
            }
        }
        return
    }
    val total = poll.options.sumOf { it.votes }.coerceAtLeast(1)
    GlassCard {
        Text(poll.question, color = TextPrimary, fontWeight = FontWeight.Black)
        poll.options.forEachIndexed { index, option ->
            val pct = (option.votes * 100) / total
            Text(
                "${option.text} / $pct%",
                color = TextPrimary,
                modifier = androidx.compose.ui.Modifier
                    .padding(top = 8.dp)
                    .clickable { onVote(poll.id, index) }
            )
        }
    }
}

@Composable
fun ActivityFeed(activity: List<RoomActivityItem>) {
    if (activity.isEmpty()) return
    SectionTitle("Live activity")
    activity.takeLast(5).forEach {
        Text(it.label, color = TextMuted, fontSize = 12.sp)
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
