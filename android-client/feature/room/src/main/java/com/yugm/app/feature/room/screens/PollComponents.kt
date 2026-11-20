package com.yugm.app.feature.room.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import com.yugm.app.core.ui.theme.Gold
import com.yugm.app.core.ui.theme.Pink
import com.yugm.app.core.ui.theme.PrimaryPurple
import com.yugm.app.core.ui.theme.LocalYugmColors
import com.yugm.app.core.ui.theme.TextMuted
import com.yugm.app.core.ui.theme.TextPrimary
import com.yugm.app.core.ui.components.YugmLoadingSpinner

@Composable
fun PollComposerSheet(
    onDismiss: () -> Unit,
    onCreate: (String, List<String>) -> Unit,
    isSubmitting: Boolean = false,
    errorMessage: String? = null
) {
    var question by rememberSaveable { mutableStateOf("") }
    var options by rememberSaveable { mutableStateOf(listOf("", "")) }

    val trimmed = options.map { it.trim() }.filter { it.isNotBlank() }
    val canCreate = !isSubmitting && question.trim().isNotBlank() && trimmed.size in 2..6

    val inputColors = OutlinedTextFieldDefaults.colors(
        focusedTextColor = RoomSheetText,
        unfocusedTextColor = RoomSheetText,
        focusedLabelColor = RoomSheetAccent,
        unfocusedLabelColor = RoomSheetMuted,
        focusedBorderColor = RoomSheetAccent,
        unfocusedBorderColor = RoomSheetBorder,
        focusedContainerColor = RoomSheetTile,
        unfocusedContainerColor = RoomSheetTile,
        cursorColor = RoomSheetAccent
    )
    val inputShape = RoundedCornerShape(14.dp)

    VoiceRoomSheet(onDismiss = onDismiss, canDismiss = !isSubmitting) {
        Column(
            verticalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(start = 16.dp, end = 16.dp, bottom = 18.dp)
        ) {
            VoiceRoomSheetHeader("Create a poll", Icons.Filled.BarChart, subtitle = "Add 2 to 6 options for the room to vote on") {
                IconButton(onClick = onDismiss, enabled = !isSubmitting) {
                    Icon(Icons.Filled.Close, contentDescription = "Close poll composer", tint = RoomSheetMuted)
                }
            }
            OutlinedTextField(
                value = question,
                onValueChange = { if (!isSubmitting) question = it.take(120) },
                label = { Text("Question") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                enabled = !isSubmitting,
                colors = inputColors,
                shape = inputShape
            )
            options.forEachIndexed { index, value ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                    OutlinedTextField(
                        value = value,
                        onValueChange = { v ->
                            if (!isSubmitting && v.length <= 60) {
                                options = options.toMutableList().also { it[index] = v }
                            }
                        },
                        label = { Text("Option ${index + 1}") },
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        enabled = !isSubmitting,
                        colors = inputColors,
                        shape = inputShape
                    )
                    if (options.size > 2) {
                        IconButton(
                            onClick = { options = options.toMutableList().also { it.removeAt(index) } },
                            enabled = !isSubmitting
                        ) {
                            Icon(Icons.Filled.Close, contentDescription = "Remove option ${index + 1}", tint = RoomSheetMuted)
                        }
                    }
                }
            }
            if (options.size < 6) {
                TextButton(onClick = { options = options + "" }, enabled = !isSubmitting) {
                    Icon(Icons.Filled.Add, contentDescription = null, tint = RoomSheetAccent, modifier = Modifier.size(18.dp))
                    Text("Add option", color = RoomSheetAccent, modifier = Modifier.padding(start = 5.dp))
                }
            }
            if (!errorMessage.isNullOrBlank()) {
                Text(errorMessage, color = Color(0xFFFFA8B9), fontSize = 13.sp)
            }
            Button(
                onClick = { if (canCreate) onCreate(question.trim(), trimmed) },
                enabled = canCreate,
                modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = RoomSheetAction,
                    contentColor = Color.White,
                    disabledContentColor = RoomSheetMuted,
                    disabledContainerColor = RoomSheetTile
                )
            ) {
                if (isSubmitting) {
                    YugmLoadingSpinner(size = 16.dp, modifier = Modifier.padding(end = 8.dp))
                }
                Text(if (isSubmitting) "Launching…" else "Launch poll", fontWeight = FontWeight.Bold)
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
    val colors = LocalYugmColors.current
    if (poll == null) {
        if (isHost) {
            GlassCard {
                Text("Ask the room", color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Black)
                Text("Create a quick vote and let everyone weigh in.", color = TextMuted, fontSize = 12.sp)
                Button(
                    onClick = onCreate,
                    modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = colors.secondary)
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
                Text(if (poll.isActive) "LIVE POLL" else "POLL", color = colors.accent, fontSize = 9.sp, fontWeight = FontWeight.Black)
                Spacer(Modifier.weight(1f))
                Text(if (!poll.isActive) "Ended • $voteTotal votes" else "$voteTotal votes", color = colors.textSecondary, fontSize = 10.sp)
                if (isHost && poll.isActive) {
                    Text(
                        if (closeRequested) "  Closing..." else "  Close",
                        color = if (closeRequested) colors.textSecondary else colors.danger,
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
                        .background(colors.surfaceVariant)
                        .border(1.dp, colors.border, RoundedCornerShape(12.dp))
                ) {
                    Box(
                        Modifier
                            .fillMaxWidth((pct / 100f).coerceIn(0f, 1f))
                            .height(34.dp)
                            .background(Brush.horizontalGradient(listOf(PrimaryPurple.copy(alpha = 0.66f), Pink.copy(alpha = 0.48f))))
                    )
                    Row(Modifier.fillMaxWidth().height(34.dp).padding(horizontal = 11.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(option.text, color = colors.textPrimary, modifier = Modifier.weight(1f), fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        when {
                            pendingVoteIndex == index -> Text("…", color = colors.secondary, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                            !poll.isActive || hasVoted -> Text("$pct%", color = colors.secondary, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                            else -> Text(
                                "Vote",
                                color = Color.White,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier
                                    .clip(RoundedCornerShape(999.dp))
                                    .background(PrimaryPurple.copy(alpha = 0.9f))
                                    .clickable(enabled = canVote) {
                                        pendingVoteIndex = index
                                        onVote(poll.id, index)
                                    }
                                    .padding(horizontal = 10.dp, vertical = 4.dp)
                            )
                        }
                    }
                }
            }
            if (hasVoted) Text("Your vote is in", color = colors.success, fontSize = 10.sp)
            else if (!poll.isActive) Text("Poll ended", color = colors.textSecondary, fontSize = 10.sp)
        }
    }
}
