package com.yugm.app.feature.social.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Button
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.yugm.app.core.model.DailyCheckInResult
import com.yugm.app.core.ui.components.GlassCard
import com.yugm.app.feature.social.viewmodel.GrowthViewModel
import com.yugm.app.core.ui.components.LoadingState
import com.yugm.app.core.util.cosmeticDisplayName
import com.yugm.app.core.ui.components.RoomCard
import com.yugm.app.core.ui.components.SectionTitle
import com.yugm.app.core.ui.components.StatCard
import com.yugm.app.core.ui.theme.Gold
import com.yugm.app.core.ui.theme.BorderColor
import com.yugm.app.core.ui.theme.Pink
import com.yugm.app.core.ui.theme.SurfaceElevated
import com.yugm.app.core.ui.theme.TextMuted
import com.yugm.app.core.ui.theme.TextPrimary

@Composable
fun GrowthScreen(
    token: String,
    onBack: () -> Unit,
    onCreateRoom: () -> Unit,
    onPayoutVerification: () -> Unit,
    onWithdraw: () -> Unit,
    onOpenRoom: (com.yugm.app.core.model.Room) -> Unit
) {
    val viewModel: GrowthViewModel = hiltViewModel()
    var checkInResult by remember { mutableStateOf<DailyCheckInResult?>(null) }
    var streakCount by rememberSaveable { mutableStateOf(0) }

    val home = viewModel.home
    val creator = viewModel.creator
    val levelOverview = viewModel.levelOverview
    val isLoading = viewModel.isLoading
    val error = viewModel.error

    LaunchedEffect(token) { viewModel.load(token) }
    LaunchedEffect(home) { home?.let { streakCount = it.streakCount } }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(horizontal = 20.dp),
        contentPadding = PaddingValues(top = 18.dp, bottom = 100.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                TextButton(onClick = onBack) { Text("Back", color = TextMuted) }
                Column(Modifier.weight(1f)) {
                    Text("Grow", color = TextPrimary, fontSize = 32.sp, fontWeight = FontWeight.Black)
                    Text("Missions, scheduled rooms, and creator momentum.", color = TextMuted)
                }
                TextButton(onClick = onCreateRoom) { Text("Create", color = Gold, fontWeight = FontWeight.Black) }
            }
        }
        when {
            isLoading -> item { LoadingState("Loading growth cockpit...") }
            error != null -> item { Text(error ?: "", color = TextMuted) }
            home != null -> {
                val payload = home!!
                val scheduledRooms = if (payload.userRole in setOf("HOST", "MODERATOR", "ADMIN")) creator?.scheduledRooms.orEmpty() else payload.scheduledRooms
                val creatorSteps = creator?.nextSteps.orEmpty()

                item {
                    val level = payload.level
                    val progress = if (level.requiredXp > 0) (level.progressXp.toFloat() / level.requiredXp).coerceIn(0f, 1f) else 1f
                    GlassCard(Modifier.fillMaxWidth()) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Column {
                                Text("Level ${level.level} · ${level.title}", color = Gold, fontWeight = FontWeight.Black, fontSize = 18.sp)
                                Text(if (level.nextLevel != null) "${level.requiredXp - level.progressXp} XP to Level ${level.nextLevel}" else "Max level reached", color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 3.dp))
                            }
                            val reward = levelOverview?.milestones?.firstOrNull { it.level == level.nextLevel }?.coinReward ?: 0
                            if (reward > 0) Text("+$reward coins", color = Gold, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        }
                        LinearProgressIndicator(
                            progress = { progress },
                            modifier = Modifier.fillMaxWidth().padding(top = 12.dp).height(7.dp),
                            color = Gold,
                            trackColor = TextMuted.copy(alpha = 0.24f)
                        )
                        Text("${level.progressXp} / ${level.requiredXp} XP", color = TextMuted, fontSize = 11.sp, modifier = Modifier.padding(top = 5.dp))
                    }
                }
                levelOverview?.let { overview ->
                    val preferredEvents = listOf("DAILY_CHECKIN", "ROOM_JOIN", "ROOM_CREATE", "CHAT_MESSAGE")
                    val earningEvents = preferredEvents.mapNotNull { key -> overview.xpEvents.firstOrNull { it.key == key } }
                    if (earningEvents.isNotEmpty()) {
                        item {
                            GlassCard(Modifier.fillMaxWidth()) {
                                Text("Earn XP", color = TextPrimary, fontWeight = FontWeight.Black)
                                earningEvents.chunked(2).forEach { rowEvents ->
                                    Row(Modifier.fillMaxWidth().padding(top = 9.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        rowEvents.forEach { event ->
                                            Column(Modifier.weight(1f)) {
                                                Text(event.name, color = TextMuted, fontSize = 11.sp)
                                                Text("+${event.xp} XP", color = Gold, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                            }
                                        }
                                        if (rowEvents.size == 1) Spacer(Modifier.weight(1f))
                                    }
                                }
                            }
                        }
                    }
                }
                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                        StatCard("Profile", "${payload.profileCompletion.percent}%", Modifier.weight(1f))
                        StatCard("Level", "${payload.level.level}", Modifier.weight(1f))
                        StatCard("Unread", "${payload.unreadNotifications}", Modifier.weight(1f))
                    }
                }
                item {
                    Column(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(22.dp)).background(SurfaceElevated).border(1.dp, BorderColor, RoundedCornerShape(22.dp)).padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text("Daily Streak", color = TextPrimary, fontWeight = FontWeight.Black, fontSize = 18.sp)
                        Row(
                            Modifier.padding(top = 12.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            (0..6).forEach { day ->
                                val filled = day < streakCount
                                Box(
                                    Modifier.size(36.dp).clip(CircleShape).background(if (filled) Gold else BorderColor),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text("${day + 1}", color = if (filled) TextPrimary else TextMuted, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                }
                            }
                        }
                        Text("$streakCount-day streak", color = Gold, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 8.dp))
                        levelOverview?.nextMilestone?.let { milestone ->
                            Text("Next reward: $milestone days · ${levelOverview.nextMilestoneReward} coins", color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 3.dp))
                        }
                        Button(
                            onClick = {
                                viewModel.checkIn(token) { result ->
                                    checkInResult = result
                                    streakCount = result.streak
                                }
                            },
                            modifier = Modifier.padding(top = 10.dp),
                            enabled = payload.level.canDailyCheckIn,
                            colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = Gold, disabledContainerColor = BorderColor)
                        ) { Text(if (payload.level.canDailyCheckIn) "Check in today" else "Checked in today", color = TextPrimary, fontWeight = FontWeight.Black) }
                        checkInResult?.let { result ->
                            if (result.claimed) {
                                Text("Checked in! Streak: ${result.streak}", color = Gold, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 6.dp))
                                if (result.unlockedCosmetic.isNotBlank()) {
                                    Text("Unlocked: ${cosmeticDisplayName(result.unlockedCosmetic)}", color = Pink, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 4.dp))
                                }
                            }
                        }
                    }
                }
                item { SectionTitle("Next best actions") }
                items(payload.achievements.take(5), key = { it.id }) { item ->
                    GlassCard(Modifier.fillMaxWidth()) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(item.title, color = TextPrimary, fontWeight = FontWeight.Black)
                                Text(item.description, color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 3.dp))
                            }
                            if (item.complete) {
                                var claiming by remember { mutableStateOf(false) }
                                Button(
                                    onClick = {
                                        claiming = true
                                        viewModel.claimAchievement(token, item.id) {
                                            claiming = false
                                            checkInResult = DailyCheckInResult(unlockedCosmetic = "", claimed = true)
                                        }
                                    },
                                    enabled = !claiming,
                                    colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = Gold)
                                ) {
                                    Text(if (claiming) "..." else "Claim", color = TextPrimary, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                        LinearProgressIndicator(
                            progress = { if (item.target > 0) (item.progress.toFloat() / item.target).coerceIn(0f, 1f) else 0f },
                            modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
                            color = if (item.complete) Gold else Pink,
                            trackColor = TextMuted.copy(alpha = 0.24f)
                        )
                        Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("${item.progress}/${item.target}", color = if (item.complete) Gold else Pink, fontWeight = FontWeight.Bold)
                            if (item.rewardCosmetic.isNotBlank()) {
                                Text("${cosmeticDisplayName(item.rewardCosmetic)}", color = Gold, fontWeight = FontWeight.Bold)
                            } else {
                                Text("${item.rewardCoins} coins", color = Gold, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
                if (payload.userRole in setOf("HOST", "MODERATOR", "ADMIN")) {
                    creator?.let { dashboard ->
                        item { SectionTitle("30-day creator performance") }
                        item {
                            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                                StatCard("Gift coins", "${dashboard.summary.giftCoins}", Modifier.weight(1f))
                                StatCard("Rooms", "${dashboard.summary.hostedRooms}", Modifier.weight(1f))
                                StatCard("Supporters", "${dashboard.summary.uniqueSupporters}", Modifier.weight(1f))
                            }
                        }
                        item {
                            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                                StatCard("Visits", "${dashboard.summary.participants}", Modifier.weight(1f))
                                StatCard("Avg / room", "${dashboard.summary.averageParticipants}", Modifier.weight(1f))
                                StatCard("Est. INR", "₹${"%.2f".format(dashboard.summary.estimatedInr)}", Modifier.weight(1f))
                            }
                        }
                    }
                    item {
                        GlassCard(Modifier.fillMaxWidth()) {
                            Text("Creator earnings", color = Gold, fontWeight = FontWeight.Black)
                            Text("Creator Payout Verification is required only when you withdraw real money earned from gifts.", color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth().padding(top = 12.dp)) {
                                Button(onClick = onPayoutVerification, modifier = Modifier.weight(1f)) { Text("Payout verification") }
                                Button(onClick = onWithdraw, modifier = Modifier.weight(1f)) { Text("Withdraw") }
                            }
                        }
                    }
                    if (creatorSteps.isNotEmpty()) {
                        item { SectionTitle("Creator playbook") }
                        items(creatorSteps, key = { it }) { step ->
                            GlassCard(Modifier.fillMaxWidth()) {
                                Text(step, color = TextPrimary, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
                item {
                    SectionTitle(if (payload.userRole in setOf("HOST", "MODERATOR", "ADMIN")) "My scheduled rooms" else "Upcoming rooms")
                    Spacer(Modifier.height(8.dp))
                }
                if (scheduledRooms.isEmpty()) {
                    item {
                        GlassCard(Modifier.fillMaxWidth()) {
                            Text("No scheduled rooms yet.", color = TextPrimary, fontWeight = FontWeight.Black)
                            Text("Schedule one from room creation to give followers a reason to come back.", color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
                        }
                    }
                } else {
                    items(scheduledRooms.take(6), key = { it.id }) { room ->
                        RoomCard(room = room, wide = true, onClick = { onOpenRoom(room) })
                    }
                }
                item { SectionTitle("Social feed") }
                items(payload.feed.take(8), key = { "${it.type}-${it.title}" }) { item ->
                    GlassCard(Modifier.fillMaxWidth()) {
                        Text(item.title, color = TextPrimary, fontWeight = FontWeight.Black)
                        Text(item.type.replace("_", " ").lowercase(), color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 3.dp))
                    }
                }
            }
        }
    }
}
