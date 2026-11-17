package com.yugm.app.feature.missions.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
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
import com.yugm.app.core.api.SyncTopic
import com.yugm.app.core.api.YugmApi
import com.yugm.app.core.model.ActiveMissionsResponse
import com.yugm.app.core.model.Mission
import com.yugm.app.core.ui.components.AutomaticSyncEffect
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private val TasksBackground = Color(0xFFF7F7FB)
private val TasksInk = Color(0xFF19182B)
private val TasksMuted = Color(0xFF9298A9)
private val TasksBlue = Color(0xFF2584ED)
private val TasksPurple = Color(0xFF7045F5)

@Composable
fun MissionsScreen(token: String, onBack: () -> Unit, onBattlePass: () -> Unit) {
    var missions by remember { mutableStateOf<ActiveMissionsResponse?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var claimingId by remember { mutableStateOf<String?>(null) }
    var refreshKey by remember { mutableIntStateOf(0) }
    var signingIn by remember { mutableStateOf(false) }
    var checkedIn by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    AutomaticSyncEffect(token, refreshKey, topics = setOf(SyncTopic.TASKS), enabled = token.isNotBlank(), isBusy = { loading }) {
        loading = true
        error = null
        runCatching { YugmApi.activeMissions(token) }
            .onSuccess { missions = it }
            .onFailure { error = it.message ?: "Couldn't load your tasks." }
        loading = false
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(TasksBackground),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp)
    ) {
        item {
            Box(Modifier.fillMaxWidth().height(58.dp), contentAlignment = Alignment.Center) {
                Box(
                    Modifier.align(Alignment.CenterStart).size(42.dp).clip(CircleShape)
                        .background(Color(0xFFEFEFF5)).clickable(onClick = onBack),
                    contentAlignment = Alignment.Center
                ) {
                    Text("‹", color = TasksInk, fontSize = 30.sp, fontWeight = FontWeight.Medium, modifier = Modifier.padding(bottom = 4.dp))
                }
                Text("Tasks", color = TasksInk, fontSize = 20.sp, fontWeight = FontWeight.Bold)
            }
        }
        item {
            CheckInBanner(
                checkedIn = checkedIn,
                loading = signingIn,
                onSignIn = {
                    if (signingIn || checkedIn) return@CheckInBanner
                    scope.launch {
                        signingIn = true
                        runCatching { withContext(Dispatchers.IO) { YugmApi.checkIn(token) } }
                            .onSuccess { checkedIn = it.claimed || it.alreadyClaimed }
                            .onFailure { error = it.message ?: "Couldn't check in today." }
                        signingIn = false
                    }
                }
            )
        }
        if (loading && missions == null) {
            item { Box(Modifier.fillMaxWidth().padding(40.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = TasksPurple) } }
        }
        error?.let { message ->
            item {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text(message, color = Color(0xFFB42336), modifier = Modifier.weight(1f), fontSize = 13.sp)
                    TextButton(onClick = { refreshKey++ }) { Text("Retry", color = TasksBlue) }
                }
            }
        }
        missions?.let { data ->
            if (data.daily.isNotEmpty()) {
                item {
                    TaskGroup("Daily tasks", data.daily, claimingId) { mission ->
                        scope.launch {
                            claimingId = mission.id
                            runCatching { withContext(Dispatchers.IO) { YugmApi.claimMission(token, mission.id) } }
                                .onSuccess { refreshKey++ }
                                .onFailure { error = it.message ?: "Couldn't claim this reward." }
                            claimingId = null
                        }
                    }
                }
            }
            val milestones = listOf("This week" to data.weekly, "This month" to data.monthly, "Seasonal" to data.seasonal)
                .filter { it.second.isNotEmpty() }
            if (milestones.isNotEmpty()) {
                item {
                    Column(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(22.dp)).background(Color.White)
                            .border(1.dp, Color(0xFFECECF2), RoundedCornerShape(22.dp)).padding(horizontal = 16.dp, vertical = 18.dp),
                        verticalArrangement = Arrangement.spacedBy(20.dp)
                    ) {
                        Text("Milestones", color = TasksInk, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                        milestones.forEach { (title, items) ->
                            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                if (milestones.size > 1) Text(title, color = TasksMuted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                                items.forEachIndexed { index, mission ->
                                    MissionRow(mission, claimingId == mission.id) {
                                        scope.launch {
                                            claimingId = mission.id
                                            runCatching { withContext(Dispatchers.IO) { YugmApi.claimMission(token, mission.id) } }
                                                .onSuccess { refreshKey++ }
                                                .onFailure { error = it.message ?: "Couldn't claim this reward." }
                                            claimingId = null
                                        }
                                    }
                                    if (index != items.lastIndex) Box(Modifier.fillMaxWidth().padding(start = 56.dp).height(1.dp).background(Color(0xFFF1F1F5)))
                                }
                            }
                        }
                    }
                }
            }
        }
        item {
            TextButton(onClick = onBattlePass, modifier = Modifier.fillMaxWidth()) {
                Text("Explore Battle Pass  ›", color = TasksPurple, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Composable
private fun CheckInBanner(checkedIn: Boolean, loading: Boolean, onSignIn: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().height(132.dp).clip(RoundedCornerShape(22.dp))
            .background(Brush.linearGradient(listOf(Color(0xFF21134D), Color(0xFF4C2678), Color(0xFF171337))))
            .padding(horizontal = 18.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text("DAILY REWARD", color = Color(0xFFD8C8FF), fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.2.sp)
            Text("A little reward, every day", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text("Keep your streak going", color = Color(0xFFCEC8E0), fontSize = 12.sp)
        }
        Spacer(Modifier.width(10.dp))
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Text("🎁", fontSize = 34.sp)
            Box(
                Modifier.clip(RoundedCornerShape(50)).background(if (checkedIn) Brush.horizontalGradient(listOf(Color(0xFF34334B), Color(0xFF34334B))) else Brush.linearGradient(listOf(Color(0xFFFFC642), Color(0xFFFF9B22))))
                    .clickable(enabled = !loading && !checkedIn, onClick = onSignIn)
                    .padding(horizontal = 20.dp, vertical = 9.dp),
                contentAlignment = Alignment.Center
            ) {
                if (loading) CircularProgressIndicator(Modifier.size(18.dp), color = TasksInk, strokeWidth = 2.dp)
                else Text(if (checkedIn) "Checked in" else "Sign in", color = if (checkedIn) Color.White else Color(0xFF382200), fontSize = 13.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun TaskGroup(title: String, missions: List<Mission>, claimingId: String?, onClaim: (Mission) -> Unit) {
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(22.dp)).background(Color.White)
            .border(1.dp, Color(0xFFECECF2), RoundedCornerShape(22.dp)).padding(horizontal = 16.dp, vertical = 18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(title, color = TasksInk, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        missions.forEachIndexed { index, mission ->
            MissionRow(mission, claimingId == mission.id) { onClaim(mission) }
            if (index != missions.lastIndex) Box(Modifier.fillMaxWidth().padding(start = 56.dp).height(1.dp).background(Color(0xFFF1F1F5)))
        }
    }
}

@Composable
private fun MissionRow(mission: Mission, claiming: Boolean, onClaim: () -> Unit) {
    val target = mission.requirements.target.coerceAtLeast(1)
    val progress = mission.progress.coerceAtLeast(0).coerceAtMost(target)
    val readyToClaim = mission.completed && !mission.claimed
    Row(Modifier.fillMaxWidth().heightIn(min = 84.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(
            Modifier.size(52.dp).clip(RoundedCornerShape(18.dp)).background(Color(0xFFF3F4F8)),
            contentAlignment = Alignment.Center
        ) { Text(mission.icon.ifBlank { "✦" }, fontSize = 27.sp) }
        Column(Modifier.weight(1f).padding(start = 12.dp, end = 8.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text(mission.title, color = TasksInk, fontSize = 14.sp, fontWeight = FontWeight.Medium, lineHeight = 18.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text("($progress/$target)", color = if (mission.completed) TasksPurple else Color(0xFFB1B7C4), fontSize = 11.sp)
            Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                if (mission.rewards.coins > 0) RewardLabel("💎", mission.rewards.coins)
                if (mission.rewards.xp > 0) RewardLabel("✦", mission.rewards.xp, xp = true)
            }
        }
        when {
            mission.claimed -> Text("✓", color = Color(0xFF26A879), fontSize = 21.sp, fontWeight = FontWeight.Bold, modifier = Modifier.width(70.dp))
            readyToClaim -> ActionPill("Get", loading = claiming, get = true, onClick = onClaim)
            else -> ActionPill("Go", onClick = {})
        }
    }
}

@Composable
private fun RewardLabel(icon: String, amount: Int, xp: Boolean = false) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(icon, fontSize = 12.sp)
        Text("x$amount", color = if (xp) TasksPurple else TasksMuted, fontSize = 12.sp, fontWeight = FontWeight.Medium)
    }
}

@Composable
private fun ActionPill(label: String, loading: Boolean = false, get: Boolean = false, onClick: () -> Unit) {
    val background = if (get) Brush.horizontalGradient(listOf(Color(0xFFFF8A00), Color(0xFFFFC400))) else Brush.horizontalGradient(listOf(TasksBlue, TasksBlue))
    Box(
        Modifier.width(86.dp).height(42.dp).clip(RoundedCornerShape(50)).background(background)
            .clickable(enabled = !loading, onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        if (loading) CircularProgressIndicator(Modifier.size(17.dp), color = Color.White, strokeWidth = 2.dp)
        else Text(label, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
    }
}
