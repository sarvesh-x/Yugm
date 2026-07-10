package com.example.yugm.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.api.YugmApi
import com.example.yugm.model.RoomActivityItem
import com.example.yugm.model.RoomDetail
import com.example.yugm.model.RoomMission
import com.example.yugm.model.RoomPoll
import com.example.yugm.model.RoomType
import com.example.yugm.ui.components.Avatar
import com.example.yugm.ui.components.GlassCard
import com.example.yugm.ui.components.HostCard
import com.example.yugm.ui.components.LiveBadge
import com.example.yugm.ui.components.LoadingState
import com.example.yugm.ui.components.PrimaryButton
import com.example.yugm.ui.components.SectionTitle
import com.example.yugm.ui.theme.Gold
import com.example.yugm.ui.theme.TextMuted
import com.example.yugm.ui.theme.TextPrimary

@Composable
fun RoomLobbyScreen(
    token: String,
    roomId: String,
    fallbackType: RoomType,
    onBack: () -> Unit,
    onJoin: (RoomType) -> Unit,
    onOpenProfile: (String) -> Unit
) {
    var detail by remember { mutableStateOf<RoomDetail?>(null) }
    var polls by remember { mutableStateOf<List<RoomPoll>>(emptyList()) }
    var missions by remember { mutableStateOf<List<RoomMission>>(emptyList()) }
    var activity by remember { mutableStateOf<List<RoomActivityItem>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(roomId, token) {
        isLoading = true
        runCatching {
            val roomDetail = YugmApi.roomDetail(token, roomId)
            detail = roomDetail
            polls = YugmApi.roomPolls(roomId)
            missions = YugmApi.roomMissions(token, roomId)
            activity = YugmApi.roomActivity(roomId)
        }.onFailure {
            error = it.message ?: "Failed to load room preview"
        }
        isLoading = false
    }

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
                    AnimatedVisibility(visible = true, enter = fadeIn() + slideInVertically { it / 3 }) {
                        GlassCard(Modifier.fillMaxWidth()) {
                            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                                LiveBadge()
                                Text(room.type.name.uppercase(), color = Gold, fontWeight = FontWeight.Black)
                            }
                            Text(room.title, color = TextPrimary, fontSize = 26.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 12.dp))
                            Text(room.description.ifBlank { "A live Yugm room." }, color = TextMuted, modifier = Modifier.padding(top = 6.dp))
                            Text("${room.participants} live / ${room.language} / ${room.category}", color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 10.dp))
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
                        TextButton(onClick = { onOpenProfile(hostId) }) {
                            Text("View host profile", color = Gold, fontWeight = FontWeight.Black)
                        }
                    }
                }
            }
        }
    }
}
