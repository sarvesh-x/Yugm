package com.example.yugm.feature.room.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.feature.room.viewmodel.RoomViewModel
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import kotlinx.coroutines.launch
import com.example.yugm.core.model.RoomActivityItem
import com.example.yugm.core.util.cosmeticDisplayName
import com.example.yugm.core.model.RoomDetail
import com.example.yugm.core.model.RoomMission
import com.example.yugm.core.model.RoomPoll
import com.example.yugm.core.model.RoomType
import com.example.yugm.core.ui.components.*
import com.example.yugm.core.ui.theme.DangerRed
import com.example.yugm.core.ui.theme.Gold
import com.example.yugm.core.ui.theme.TextMuted
import com.example.yugm.core.ui.theme.TextPrimary

@Composable
fun RoomLobbyScreen(
    token: String,
    roomId: String,
    fallbackType: RoomType,
    currentUserId: String = "",
    onBack: () -> Unit,
    onJoin: (RoomType) -> Unit,
    onOpenProfile: (String) -> Unit,
    onEdit: ((String) -> Unit)? = null,
    onOpenModes: (() -> Unit)? = null,
    viewModel: RoomViewModel = hiltViewModel()
) {
    var detail by remember { mutableStateOf<RoomDetail?>(null) }
    var polls by remember { mutableStateOf<List<RoomPoll>>(emptyList()) }
    var missions by remember { mutableStateOf<List<RoomMission>>(emptyList()) }
    var activity by remember { mutableStateOf<List<RoomActivityItem>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var showReportDialog by remember { mutableStateOf(false) }
    var reportReason by remember { mutableStateOf("") }
    var reportHostId by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    LaunchedEffect(roomId, token) {
        isLoading = true
        viewModel.connect(token, roomId, currentUserId)
    }
    LaunchedEffect(viewModel.roomDetail) {
        viewModel.roomDetail?.let { rd ->
            detail = rd
            polls = viewModel.polls
            missions = viewModel.missions
            activity = viewModel.activity
            isLoading = false
        }
    }

    Box(Modifier.fillMaxSize()) {
        AuroraBackground(speed = 0.8f)
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(horizontal = 20.dp),
            contentPadding = PaddingValues(top = 18.dp, bottom = 100.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                TextButton(onClick = onBack) { Text("Back", color = TextMuted) }
                Column(Modifier.weight(1f)) {
                    Text("Room Preview", color = TextPrimary, fontSize = 30.sp, fontWeight = FontWeight.Black)
                    Text("See the vibe before you step in.", color = TextMuted)
                }
            }
        }
        when {
            isLoading -> item { LoadingState("Loading room preview...") }
            error != null -> item { Text(error ?: "", color = TextMuted) }
            detail != null -> {
                val payload = detail!!
                val room = payload.room
                item {
                    AnimatedEntrance(delay = 100) {
                        GlassCard(Modifier.fillMaxWidth()) {
                            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    LiveBadge()
                                    if (room.vipOnly) {
                                        Text("VIP", color = TextPrimary, fontWeight = FontWeight.Black, fontSize = 10.sp, modifier = Modifier.background(color = Gold.copy(alpha = 0.85f), shape = RoundedCornerShape(4.dp)).padding(horizontal = 6.dp, vertical = 2.dp))
                                    }
                                    if (room.badge.isNotBlank()) {
                                        Text("🏷️ ${cosmeticDisplayName(room.badge)}", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 10.sp)
                                    }
                                }
                                Text(room.type.name.uppercase(), color = Gold, fontWeight = FontWeight.Black)
                            }
                            Text(room.title, color = TextPrimary, fontSize = 26.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 12.dp))
                            Text(room.description.ifBlank { "A live Yugm room." }, color = TextMuted, modifier = Modifier.padding(top = 6.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 10.dp)) {
                                Text("${room.participants} live / ${room.language} / ${room.category}", color = TextMuted, fontSize = 12.sp)
                                if (room.theme.isNotBlank()) {
                                    Text("🎨 ${cosmeticDisplayName(room.theme)}", color = TextMuted, fontSize = 12.sp)
                                }
                                if (room.ambience.isNotBlank()) {
                                    Text("♪ ${cosmeticDisplayName(room.ambience)}", color = TextMuted, fontSize = 12.sp)
                                }
                            }
                        }
                    }
                }
                room.host?.let { host ->
                    item { HostCard(host) }
                }
                val speakers = payload.participants.filter { it.role in listOf("HOST", "SPEAKER", "MODERATOR") }
                if (speakers.isNotEmpty()) {
                    item { SectionTitle("On stage") }
                    item {
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            speakers.take(4).forEach { participant ->
                                Column {
                                    Avatar(
                                        initial = participant.user.name.firstOrNull()?.toString() ?: "?",
                                        size = 46,
                                        imageUrl = participant.user.avatar,
                                        cosmetics = participant.user.activeCosmetics,
                                        isSpeaking = participant.micEnabled,
                                        showEntry = true
                                    )
                                    Text(participant.user.name.take(10), color = TextPrimary, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }
                if (polls.isNotEmpty()) {
                    item {
                        SectionTitle("Live poll")
                        Spacer(Modifier.height(8.dp))
                        PollCard(poll = polls.first(), isHost = false, onCreate = {}, onVote = { _, _ -> })
                    }
                }
                item { MissionStrip(missions) }
                if (activity.isNotEmpty()) {
                    item { SectionTitle("Recent activity") }
                    items(activity.takeLast(5), key = { it.id }) {
                        Text(it.label, color = TextMuted, fontSize = 13.sp)
                    }
                }
                item {
                    if (room.status.equals("LIVE", ignoreCase = true)) {
                        PrimaryButton("Join as audience") { onJoin(room.type.takeUnless { room.id.isBlank() } ?: fallbackType) }
                    } else {
                        GlassCard(Modifier.fillMaxWidth()) {
                            Text("Scheduled for later", color = Gold, fontWeight = FontWeight.Black)
                            Text(room.scheduledFor.ifBlank { "This room is not live yet." }, color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
                        }
                    }
                }
                room.host?.id?.takeIf { it.isNotBlank() }?.let { hostId ->
                    item {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                            TextButton(onClick = { onOpenProfile(hostId) }) {
                                Text("View host profile", color = Gold, fontWeight = FontWeight.Black)
                            }
                            if (onEdit != null && hostId == currentUserId) {
                                TextButton(onClick = { onEdit(roomId) }) {
                                    Text("Edit room", color = Gold, fontWeight = FontWeight.Black)
                                }
                            }
                            if (onOpenModes != null && hostId == currentUserId) {
                                TextButton(onClick = onOpenModes) {
                                    Text("🎮 Modes", color = Gold, fontWeight = FontWeight.Black)
                                }
                            }
                            if (hostId != currentUserId) {
                                TextButton(onClick = { showReportDialog = true; reportHostId = hostId }) {
                                    Text("Report", color = DangerRed, fontWeight = FontWeight.Black)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    }

    if (showReportDialog) {
        val reasons = listOf("Inappropriate content", "Harassment", "Spam", "Fake profile", "Other")
        AlertDialog(
            onDismissRequest = { showReportDialog = false },
            title = { Text("Report Host", color = Color.White, fontWeight = FontWeight.Black) },
            text = {
                Column {
                    Text("Select a reason for reporting:", color = TextMuted)
                    reasons.forEach { reason ->
                        Row(Modifier.fillMaxWidth().clickable { reportReason = reason }.padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                            RadioButton(selected = reportReason == reason, onClick = { reportReason = reason })
                            Text(reason, color = Color.White, modifier = Modifier.padding(start = 8.dp))
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.reportUser(reportHostId, reportReason)
                        android.widget.Toast.makeText(context, "Report submitted", android.widget.Toast.LENGTH_SHORT).show()
                        showReportDialog = false
                    },
                    enabled = reportReason.isNotBlank()
                ) {
                    Text("Submit Report", color = DangerRed, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showReportDialog = false }) {
                    Text("Cancel", color = TextMuted)
                }
            }
        )
    }
}
