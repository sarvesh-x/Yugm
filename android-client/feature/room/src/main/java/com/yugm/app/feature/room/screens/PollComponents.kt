package com.yugm.app.feature.room.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yugm.app.core.model.RoomMission
import com.yugm.app.core.model.RoomPoll
import com.yugm.app.core.ui.components.GlassCard
import com.yugm.app.core.ui.theme.Background
import com.yugm.app.core.ui.theme.Gold
import com.yugm.app.core.ui.theme.Pink
import com.yugm.app.core.ui.theme.PrimaryPurple
import com.yugm.app.core.ui.theme.TextMuted
import com.yugm.app.core.ui.theme.TextPrimary

private val RoomGoldAccent = Color(0xFFFFB300)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PollComposerSheet(
    onDismiss: () -> Unit,
    onCreate: (String, List<String>) -> Unit
) {
    var question by rememberSaveable { mutableStateOf("") }
    var options by rememberSaveable { mutableStateOf(listOf("", "")) }

    val trimmed = options.map { it.trim() }.filter { it.isNotBlank() }
    val canCreate = question.trim().isNotBlank() && trimmed.size in 2..6

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
                onValueChange = { question = it.take(120) },
                label = { Text("Poll Question") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )
            options.forEachIndexed { index, value ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                    OutlinedTextField(
                        value = value,
                        onValueChange = { v ->
                            if (v.length <= 60) {
                                options = options.toMutableList().also { it[index] = v }
                            }
                        },
                        label = { Text("Option ${index + 1}") },
                        modifier = Modifier.weight(1f),
                        singleLine = true
                    )
                    if (options.size > 2) {
                        Text(
                            "Remove",
                            color = TextMuted,
                            fontSize = 12.sp,
                            modifier = Modifier.clickable { options = options.toMutableList().also { it.removeAt(index) } }
                        )
                    }
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                if (options.size < 6) {
                    Button(
                        onClick = { options = options + "" },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0x332F2A4A))
                    ) { Text("+ Add option", color = TextPrimary) }
                }
                Text("${trimmed.size}/6 options", color = TextMuted, fontSize = 12.sp)
            }
            Button(
                onClick = { if (canCreate) onCreate(question.trim(), trimmed) },
                enabled = canCreate,
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
                Text(
                    "${mission.progress}/${mission.target} / ${mission.reward} coins",
                    color = if (mission.complete) Gold else TextMuted,
                    fontSize = 12.sp
                )
            }
        }
    }
}

@Composable
fun PollCard(
    poll: RoomPoll?,
    isHost: Boolean,
    currentUserId: String = "",
    onCreate: () -> Unit,
    onVote: (String, Int) -> Unit,
    onClose: () -> Unit = {}
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

    var pendingVoteIndex by rememberSaveable(poll.id) { mutableStateOf<Int?>(null) }
    var closeRequested by rememberSaveable(poll.id) { mutableStateOf(false) }
    val voteTotal = poll.options.sumOf { it.votes }
    val total = voteTotal.coerceAtLeast(1)
    val hasVoted = currentUserId.isNotBlank() && currentUserId in poll.voters

    LaunchedEffect(poll.id, hasVoted, poll.isActive) {
        if (hasVoted || !poll.isActive) pendingVoteIndex = null
        if (!poll.isActive) closeRequested = false
    }

    LaunchedEffect(poll.id, pendingVoteIndex) {
        val idx = pendingVoteIndex ?: return@LaunchedEffect
        kotlinx.coroutines.delay(6000)
        if (pendingVoteIndex == idx && !hasVoted && poll.isActive) pendingVoteIndex = null
    }

    LaunchedEffect(poll.id, closeRequested) {
        if (!closeRequested) return@LaunchedEffect
        kotlinx.coroutines.delay(6000)
        if (closeRequested && poll.isActive) closeRequested = false
    }

    GlassCard {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(if (poll.isActive) "LIVE POLL" else "POLL", color = Gold, fontSize = 9.sp, fontWeight = FontWeight.Black)
                Spacer(Modifier.weight(1f))
                Text(if (!poll.isActive) "Ended • $voteTotal votes" else "$voteTotal votes", color = TextMuted, fontSize = 10.sp)
                if (isHost && poll.isActive) {
                    Text(
                        if (closeRequested) "  Closing..." else "  Close",
                        color = if (closeRequested) TextMuted else Pink,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = if (closeRequested) Modifier else Modifier.clickable {
                            closeRequested = true
                            onClose()
                        }
                    )
                }
            }
            Text(poll.question, color = TextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Black, lineHeight = 19.sp)
            poll.options.forEachIndexed { index, option ->
                val pct = (option.votes * 100) / total
                val canVote = poll.isActive && !hasVoted && pendingVoteIndex == null
                Box(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0x221FFFFFF))
                        .clickable(enabled = canVote) {
                            pendingVoteIndex = index
                            onVote(poll.id, index)
                        }
                ) {
                    Box(
                        Modifier
                            .fillMaxWidth((pct / 100f).coerceIn(0f, 1f))
                            .height(34.dp)
                            .background(Brush.horizontalGradient(listOf(PrimaryPurple.copy(alpha = 0.66f), Pink.copy(alpha = 0.48f))))
                    )
                    Row(Modifier.fillMaxWidth().height(34.dp).padding(horizontal = 11.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(option.text, color = TextPrimary, modifier = Modifier.weight(1f), fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        when {
                            pendingVoteIndex == index -> Text("...", color = Gold, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                            !poll.isActive || hasVoted -> Text("$pct%", color = Gold, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                            else -> Text("Vote", color = TextMuted, fontSize = 10.sp)
                        }
                    }
                }
            }
            if (hasVoted) Text("Your vote is in", color = Color(0xFF73D8A1), fontSize = 10.sp)
            else if (!poll.isActive) Text("Poll ended", color = TextMuted, fontSize = 10.sp)
        }
    }
}
