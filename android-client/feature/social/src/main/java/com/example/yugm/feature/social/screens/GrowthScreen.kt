package com.example.yugm.feature.social.screens

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
import com.example.yugm.core.model.DailyCheckInResult
import com.example.yugm.core.ui.components.GlassCard
import com.example.yugm.feature.social.viewmodel.GrowthViewModel
import com.example.yugm.core.ui.components.LoadingState
import com.example.yugm.core.util.cosmeticDisplayName
import com.example.yugm.core.ui.components.RoomCard
import com.example.yugm.core.ui.components.SectionTitle
import com.example.yugm.core.ui.components.StatCard
import com.example.yugm.core.ui.theme.Gold
import com.example.yugm.core.ui.theme.BorderColor
import com.example.yugm.core.ui.theme.Pink
import com.example.yugm.core.ui.theme.SurfaceElevated
import com.example.yugm.core.ui.theme.TextMuted
import com.example.yugm.core.ui.theme.TextPrimary

@Composable
fun GrowthScreen(
    token: String,
    onBack: () -> Unit,
    onCreateRoom: () -> Unit,
    onPayoutVerification: () -> Unit,
    onWithdraw: () -> Unit,
    onOpenRoom: (com.example.yugm.core.model.Room) -> Unit
) {
    val viewModel: GrowthViewModel = hiltViewModel()
    var checkInResult by remember { mutableStateOf<DailyCheckInResult?>(null) }
    var streakCount by rememberSaveable { mutableStateOf(0) }

    val home = viewModel.home
    val creator = viewModel.creator
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
                        Button(
                            onClick = {
                                viewModel.checkIn(token) { result ->
                                    checkInResult = result
                                    streakCount = result.streak
                                }
                            },
                            modifier = Modifier.padding(top = 10.dp),
                            colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = Gold)
                        ) { Text("Check In", color = TextPrimary, fontWeight = FontWeight.Black) }
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
                item {
                    GlassCard(Modifier.fillMaxWidth()) {
                        Text("Next Best Action", color = Gold, fontWeight = FontWeight.Black)
                        val next = payload.achievements.firstOrNull { !it.complete }
                        Text(next?.description ?: "You are caught up. Schedule a room to build momentum.", color = TextPrimary, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 4.dp))
                        Text("Unread notifications: ${payload.unreadNotifications} / Scheduled rooms: ${payload.scheduledRooms.size}", color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 6.dp))
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
