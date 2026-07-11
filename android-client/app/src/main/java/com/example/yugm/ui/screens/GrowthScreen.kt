package com.example.yugm.ui.screens

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
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Button
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
import com.example.yugm.model.ExperienceHome
import com.example.yugm.model.CreatorDashboard
import com.example.yugm.ui.components.GlassCard
import com.example.yugm.ui.components.LoadingState
import com.example.yugm.ui.components.RoomCard
import com.example.yugm.ui.components.SectionTitle
import com.example.yugm.ui.components.StatCard
import com.example.yugm.ui.theme.Gold
import com.example.yugm.ui.theme.Pink
import com.example.yugm.ui.theme.TextMuted
import com.example.yugm.ui.theme.TextPrimary

@Composable
fun GrowthScreen(
    token: String,
    onBack: () -> Unit,
    onCreateRoom: () -> Unit,
    onPayoutVerification: () -> Unit,
    onWithdraw: () -> Unit,
    onOpenRoom: (com.example.yugm.model.Room) -> Unit
) {
    var home by remember { mutableStateOf<ExperienceHome?>(null) }
    var creator by remember { mutableStateOf<CreatorDashboard?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(token) {
        isLoading = true
        runCatching { YugmApi.experienceHome(token) }
            .onSuccess {
                home = it
                error = null
            }
            .onFailure { error = it.message ?: "Failed to load growth" }
        runCatching { YugmApi.creatorDashboard(token) }
            .onSuccess { creator = it }
        isLoading = false
    }

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
                item { SectionTitle("Next best actions") }
                items(payload.achievements.take(5), key = { it.id }) { item ->
                    GlassCard(Modifier.fillMaxWidth()) {
                        Text(item.title, color = TextPrimary, fontWeight = FontWeight.Black)
                        Text(item.description, color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 3.dp))
                        LinearProgressIndicator(
                            progress = { if (item.target > 0) (item.progress.toFloat() / item.target).coerceIn(0f, 1f) else 0f },
                            modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
                            color = if (item.complete) Gold else Pink,
                            trackColor = TextMuted.copy(alpha = 0.24f)
                        )
                        Text("${item.progress}/${item.target} / ${item.rewardCoins} coins", color = if (item.complete) Gold else Pink, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 8.dp))
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
