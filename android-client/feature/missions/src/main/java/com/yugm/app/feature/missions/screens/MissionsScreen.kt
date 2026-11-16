package com.yugm.app.feature.missions.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yugm.app.core.api.YugmApi
import com.yugm.app.core.model.ActiveMissionsResponse
import com.yugm.app.core.model.Mission
import com.yugm.app.core.ui.theme.LocalYugmColors
import kotlinx.coroutines.launch

@Composable
fun MissionsScreen(token: String, onBack: () -> Unit, onBattlePass: () -> Unit) {
    var missions by remember { mutableStateOf<ActiveMissionsResponse?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var claimingId by remember { mutableStateOf<String?>(null) }
    var refreshKey by remember { mutableIntStateOf(0) }
    val scope = rememberCoroutineScope()
    val colors = LocalYugmColors.current

    LaunchedEffect(token, refreshKey) {
        loading = true
        error = null
        runCatching { YugmApi.activeMissions(token) }
            .onSuccess { missions = it }
            .onFailure { error = it.message ?: "Couldn't load your missions." }
        loading = false
    }

    val allMissions = listOfNotNull(missions?.daily, missions?.weekly, missions?.monthly, missions?.seasonal).flatten()
    val completed = allMissions.count { it.completed }
    val claimed = allMissions.count { it.claimed }

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(colors.background),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 12.dp, bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                TextButton(onClick = onBack, contentPadding = PaddingValues(horizontal = 0.dp)) {
                    Text("‹  Back", color = colors.secondary, fontWeight = FontWeight.SemiBold)
                }
                Spacer(Modifier.weight(1f))
                Text("TASKS & REWARDS", color = colors.textSecondary, fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
            }
        }
        item {
            Column(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp))
                    .background(Brush.linearGradient(listOf(colors.secondary, colors.primary)))
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text("Your next reward is close", color = colors.primaryOn, fontSize = 22.sp, fontWeight = FontWeight.Black)
                Text("Complete small goals as you chat, join rooms and build your community.", color = colors.primaryOn.copy(alpha = 0.82f), fontSize = 13.sp, lineHeight = 19.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    RewardStat("${allMissions.size}", "Goals", Modifier.weight(1f))
                    RewardStat("$completed", "Completed", Modifier.weight(1f))
                    RewardStat("$claimed", "Claimed", Modifier.weight(1f))
                }
                OutlinedButton(onClick = onBattlePass, colors = ButtonDefaults.outlinedButtonColors(contentColor = colors.primaryOn), border = ButtonDefaults.outlinedButtonBorder) {
                    Text("Explore Battle Pass  →", fontWeight = FontWeight.Bold)
                }
            }
        }
        if (loading && missions == null) item { Box(Modifier.fillMaxWidth().padding(48.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = colors.secondary) } }
        error?.let { message ->
            item {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(message, color = colors.danger)
                    TextButton(onClick = { refreshKey++ }) { Text("Try again", color = colors.secondary) }
                }
            }
        }
        missions?.let { data ->
            item { MissionSection("Today", "A fresh set of goals, renewed daily", data.daily, claimingId, onClaim = { mission ->
                scope.launch {
                    claimingId = mission.id
                    runCatching { YugmApi.claimMission(token, mission.id) }
                        .onSuccess { refreshKey++ }
                        .onFailure { error = it.message ?: "Couldn't claim this reward." }
                    claimingId = null
                }
            }) }
            item { MissionSection("This week", "Build momentum over the week", data.weekly, claimingId, onClaim = { mission ->
                scope.launch { claimingId = mission.id; runCatching { YugmApi.claimMission(token, mission.id) }.onSuccess { refreshKey++ }.onFailure { error = it.message }; claimingId = null }
            }) }
            item { MissionSection("This month", "Longer goals with bigger progress", data.monthly, claimingId, onClaim = { mission ->
                scope.launch { claimingId = mission.id; runCatching { YugmApi.claimMission(token, mission.id) }.onSuccess { refreshKey++ }.onFailure { error = it.message }; claimingId = null }
            }) }
            item { MissionSection("Seasonal", "Limited-time community challenges", data.seasonal, claimingId, onClaim = { mission ->
                scope.launch { claimingId = mission.id; runCatching { YugmApi.claimMission(token, mission.id) }.onSuccess { refreshKey++ }.onFailure { error = it.message }; claimingId = null }
            }) }
        }
    }
}

@Composable
private fun RewardStat(value: String, label: String, modifier: Modifier = Modifier) {
    val colors = LocalYugmColors.current
    Column(modifier.clip(RoundedCornerShape(14.dp)).background(colors.primaryOn.copy(alpha = 0.12f)).padding(10.dp)) {
        Text(value, color = colors.primaryOn, fontSize = 18.sp, fontWeight = FontWeight.Black)
        Text(label, color = colors.primaryOn.copy(alpha = 0.78f), fontSize = 11.sp)
    }
}

@Composable
private fun MissionSection(title: String, subtitle: String, missions: List<Mission>, claimingId: String?, onClaim: (Mission) -> Unit) {
    if (missions.isEmpty()) return
    val colors = LocalYugmColors.current
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Column {
            Text(title, color = colors.textPrimary, fontSize = 18.sp, fontWeight = FontWeight.Black)
            Text(subtitle, color = colors.textSecondary, fontSize = 12.sp)
        }
        missions.forEach { mission -> MissionCard(mission, claimingId == mission.id, onClaim) }
    }
}

@Composable
private fun MissionCard(mission: Mission, claiming: Boolean, onClaim: (Mission) -> Unit) {
    val colors = LocalYugmColors.current
    val target = mission.requirements.target.coerceAtLeast(1)
    val progress = (mission.progress.toFloat() / target).coerceIn(0f, 1f)
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(colors.surface)
            .border(1.dp, colors.border, RoundedCornerShape(18.dp)).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(Modifier.size(42.dp).clip(RoundedCornerShape(13.dp)).background(colors.secondary.copy(alpha = 0.12f)), contentAlignment = Alignment.Center) {
                Text(mission.icon.ifBlank { "✦" }, color = colors.secondary, fontWeight = FontWeight.Black)
            }
            Column(Modifier.weight(1f)) {
                Text(mission.title, color = colors.textPrimary, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                if (mission.description.isNotBlank()) Text(mission.description, color = colors.textSecondary, fontSize = 12.sp, lineHeight = 17.sp)
            }
            if (mission.completed && !mission.claimed) {
                Button(onClick = { onClaim(mission) }, enabled = !claiming, contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp)) {
                    if (claiming) CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                    else Text("Claim", fontWeight = FontWeight.Bold)
                }
            } else if (mission.claimed) Text("✓", color = colors.success, fontSize = 18.sp, fontWeight = FontWeight.Black)
        }
        LinearProgressIndicator(progress = { progress }, modifier = Modifier.fillMaxWidth().height(7.dp).clip(RoundedCornerShape(8.dp)), color = colors.secondary, trackColor = colors.surfaceVariant)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("${mission.progress.coerceAtMost(target)} / $target", color = colors.textSecondary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (mission.rewards.xp > 0) Text("+${mission.rewards.xp} XP", color = colors.secondary, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                if (mission.rewards.coins > 0) Text("+${mission.rewards.coins} coins", color = colors.accent, fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}
