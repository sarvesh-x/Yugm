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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
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
import com.yugm.app.core.model.Mission
import com.yugm.app.core.ui.components.GlassCard
import com.yugm.app.feature.social.viewmodel.GrowthViewModel
import com.yugm.app.core.ui.components.LoadingState
import com.yugm.app.core.util.cosmeticDisplayName
import com.yugm.app.core.ui.components.RoomCard
import com.yugm.app.core.ui.components.SectionTitle
import com.yugm.app.core.ui.components.StatCard
import com.yugm.app.core.ui.theme.LocalYugmColors

@Composable
fun GrowthScreen(
    token: String,
    onBack: () -> Unit,
    onCreateRoom: () -> Unit,
    onPayoutVerification: () -> Unit,
    onWithdraw: () -> Unit,
    onOpenBattlePass: () -> Unit,
    onOpenAchievements: () -> Unit,
    onOpenLeaderboard: () -> Unit,
    onOpenRoom: (com.yugm.app.core.model.Room) -> Unit
) {
    val colors = LocalYugmColors.current
    val viewModel: GrowthViewModel = hiltViewModel()
    var checkInResult by remember { mutableStateOf<DailyCheckInResult?>(null) }
    var streakCount by rememberSaveable { mutableStateOf(0) }

    val home = viewModel.home
    val creator = viewModel.creator
    val levelOverview = viewModel.levelOverview
                val battlePass = viewModel.battlePass
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
                TextButton(onClick = onBack) { Text("Back", color = colors.textSecondary) }
                Column(Modifier.weight(1f)) {
                    Text("Progress & rewards", color = colors.textPrimary, fontSize = 25.sp, fontWeight = FontWeight.Black)
                    Text("Your level, streak, missions, and season progress.", color = colors.textSecondary, fontSize = 12.sp)
                }
                TextButton(onClick = onCreateRoom) { Text("Create", color = colors.accent, fontWeight = FontWeight.Black) }
            }
        }
        when {
            isLoading -> item { LoadingState("Loading growth cockpit...") }
            error != null -> item { Text(error ?: "", color = colors.textSecondary) }
            home != null -> {
                val payload = home!!
                val scheduledRooms = if (payload.userRole in setOf("HOST", "MODERATOR", "ADMIN")) creator?.scheduledRooms.orEmpty() else payload.scheduledRooms
                val creatorSteps = creator?.nextSteps.orEmpty()

                item {
                    SectionTitle("Daily missions")
                    Text("Complete today’s goals to earn XP and coins.", color = colors.textSecondary, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
                }
                val dailyMissions = viewModel.missions?.daily.orEmpty()
                if (dailyMissions.isEmpty()) {
                    item {
                        GlassCard(Modifier.fillMaxWidth()) {
                            Text("No daily missions available", color = colors.textPrimary, fontWeight = FontWeight.Bold)
                            Text("Check back soon for new goals and rewards.", color = colors.textSecondary, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
                        }
                    }
                } else {
                    items(dailyMissions, key = { "daily-${it.id}" }) { mission ->
                        GrowthMissionCard(
                            mission = mission,
                            onClaim = { complete -> viewModel.claimMission(token, mission.id, complete) }
                        )
                    }
                }
                viewModel.missionClaimMessage?.let { message ->
                    item { Text(message, color = colors.accent, fontSize = 12.sp, fontWeight = FontWeight.Bold) }
                }
                viewModel.missionClaimError?.let { message ->
                    item { Text(message, color = colors.primary, fontSize = 12.sp, fontWeight = FontWeight.Bold) }
                }

                item {
                    val level = levelOverview?.level ?: payload.level
                    val progress = if (level.requiredXp > 0) (level.progressXp.toFloat() / level.requiredXp).coerceIn(0f, 1f) else 1f
                    GlassCard(Modifier.fillMaxWidth()) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Column {
                                Text("Level ${level.level} · ${level.title}", color = colors.accent, fontWeight = FontWeight.Black, fontSize = 18.sp)
                                Text(if (level.nextLevel != null) "${level.requiredXp - level.progressXp} XP to Level ${level.nextLevel}" else "Max level reached", color = colors.textSecondary, fontSize = 12.sp, modifier = Modifier.padding(top = 3.dp))
                            }
                            val reward = levelOverview?.milestones?.firstOrNull { it.level == level.nextLevel }?.coinReward ?: 0
                            if (reward > 0) Text("+$reward coins", color = colors.accent, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        }
                        LinearProgressIndicator(
                            progress = { progress },
                            modifier = Modifier.fillMaxWidth().padding(top = 12.dp).height(7.dp),
                            color = colors.accent,
                            trackColor = colors.textSecondary.copy(alpha = 0.24f)
                        )
                        Text("${level.progressXp} / ${level.requiredXp} XP", color = colors.textSecondary, fontSize = 11.sp, modifier = Modifier.padding(top = 5.dp))
                        Text("${level.xp} total XP", color = colors.textSecondary, fontSize = 10.sp, modifier = Modifier.padding(top = 2.dp))
                    }
                }
                levelOverview?.let { overview ->
                    if (overview.milestones.isNotEmpty()) item {
                        Column {
                            SectionTitle("Level roadmap")
                            Text("See what you’ve unlocked and what’s ahead.", color = colors.textSecondary, fontSize = 12.sp, modifier = Modifier.padding(top = 3.dp, bottom = 9.dp))
                            LazyRow(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                                items(overview.milestones, key = { it.level }) { milestone ->
                                    val reached = overview.level.level >= milestone.level
                                    val current = overview.level.level == milestone.level
                                    val tint = when {
                                        current -> colors.accent
                                        reached -> colors.success
                                        else -> colors.textSecondary
                                    }
                                    Column(
                                        Modifier.width(138.dp).clip(RoundedCornerShape(17.dp)).background(colors.surfaceElevated)
                                            .border(1.dp, if (current) colors.accent.copy(alpha = .65f) else colors.border, RoundedCornerShape(17.dp))
                                            .padding(12.dp)
                                    ) {
                                        Text(if (current) "CURRENT LEVEL" else if (reached) "UNLOCKED" else "LEVEL ${milestone.level}", color = tint, fontSize = 9.sp, fontWeight = FontWeight.Black)
                                        Text(milestone.title, color = colors.textPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 5.dp), maxLines = 1)
                                        Text("${milestone.requiredXp} XP", color = colors.textSecondary, fontSize = 11.sp, modifier = Modifier.padding(top = 3.dp))
                                        if (milestone.coinReward > 0) Text("${milestone.coinReward} coin reward", color = colors.accent, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 5.dp))
                                    }
                                }
                            }
                        }
                    }
                }
                levelOverview?.let { overview ->
                    val earningEvents = overview.xpEvents.sortedByDescending { it.cap != null }
                    if (earningEvents.isNotEmpty()) {
                        item {
                            GlassCard(Modifier.fillMaxWidth()) {
                                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                    Text("XP earning guide", color = colors.textPrimary, fontWeight = FontWeight.Black)
                                    Text("Today ${overview.todayXpEarned} / ${overview.todayXpCap}", color = colors.accent, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                }
                                if (overview.todayXpCap > 0) {
                                    LinearProgressIndicator(
                                        progress = { (overview.todayXpEarned.toFloat() / overview.todayXpCap).coerceIn(0f, 1f) },
                                        modifier = Modifier.fillMaxWidth().padding(top = 8.dp).height(5.dp),
                                        color = colors.accent,
                                        trackColor = colors.textSecondary.copy(alpha = 0.24f)
                                    )
                                    Text("XP from activities with daily limits · resets at 00:00 UTC", color = colors.textSecondary, fontSize = 10.sp, modifier = Modifier.padding(top = 5.dp))
                                }
                                earningEvents.chunked(2).forEach { rowEvents ->
                                    Row(Modifier.fillMaxWidth().padding(top = 9.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        rowEvents.forEach { event ->
                                            Column(Modifier.weight(1f)) {
                                                Text("${event.icon}  ${event.name}", color = colors.textPrimary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                                                val earningText = if (event.cap != null) "${event.earnedToday} / ${event.cap} XP today · +${event.xp} each" else "+${event.xp} XP · no daily cap"
                                                Text(earningText, color = colors.textSecondary, fontSize = 10.sp, modifier = Modifier.padding(top = 3.dp))
                                            }
                                        }
                                        if (rowEvents.size == 1) Spacer(Modifier.weight(1f))
                                    }
                                }
                            }
                        }
                    }
                    if (overview.leaderboard.isNotEmpty()) item {
                        GlassCard(Modifier.fillMaxWidth()) {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                Text("Level leaderboard", color = colors.textPrimary, fontWeight = FontWeight.Black)
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text("Your rank #${overview.leaderboardRank ?: "—"}", color = colors.accent, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                    TextButton(onClick = onOpenLeaderboard) { Text("See all", color = colors.primary, fontSize = 11.sp) }
                                }
                            }
                            overview.leaderboard.take(3).forEachIndexed { index, member ->
                                Row(Modifier.fillMaxWidth().padding(top = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                                    Text("${index + 1}", color = colors.accent, fontWeight = FontWeight.Black, modifier = Modifier.width(26.dp))
                                    Column(Modifier.weight(1f)) {
                                        Text(member.name, color = colors.textPrimary, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                                        Text("@${member.username}", color = colors.textSecondary, fontSize = 10.sp)
                                    }
                                    Text("Lv. ${member.level}", color = colors.accent, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }
                battlePass?.let { passResponse ->
                    val pass = passResponse.battlePass
                    val season = passResponse.season
                    if (pass != null && season != null) item {
                        GlassCard(Modifier.fillMaxWidth()) {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                Column(Modifier.weight(1f)) {
                                    Text(season.name, color = colors.textPrimary, fontWeight = FontWeight.Black)
                                    Text("Season pass · ${if (pass.premium) "Premium unlocked" else "Free track"}", color = colors.textSecondary, fontSize = 11.sp, modifier = Modifier.padding(top = 3.dp))
                                }
                                TextButton(onClick = onOpenBattlePass) { Text("View pass →", color = colors.accent, fontWeight = FontWeight.Bold) }
                            }
                            val passProgress = if (season.xpPerLevel > 0) (pass.xp.toFloat() / season.xpPerLevel).coerceIn(0f, 1f) else 0f
                            LinearProgressIndicator(
                                progress = { passProgress },
                                modifier = Modifier.fillMaxWidth().padding(top = 9.dp).height(6.dp),
                                color = colors.primary,
                                trackColor = colors.textSecondary.copy(alpha = .24f)
                            )
                            val claimable = pass.rewards.count { it.level <= pass.level && (!it.freeClaimed || (pass.premium && !it.premiumClaimed)) }
                            Text("Level ${pass.level} · ${pass.xp} / ${season.xpPerLevel} season XP${if (claimable > 0) " · $claimable rewards ready" else ""}", color = colors.textSecondary, fontSize = 11.sp, modifier = Modifier.padding(top = 5.dp))
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
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(22.dp)).background(colors.surfaceElevated).border(1.dp, colors.border, RoundedCornerShape(22.dp)).padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text("Daily Streak", color = colors.textPrimary, fontWeight = FontWeight.Black, fontSize = 18.sp)
                        Row(
                            Modifier.padding(top = 12.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            (0..6).forEach { day ->
                                val filled = day < streakCount
                                Box(
                                    Modifier.size(36.dp).clip(CircleShape).background(if (filled) colors.accent else colors.border),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text("${day + 1}", color = if (filled) colors.textPrimary else colors.textSecondary, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                }
                            }
                        }
                        Text("$streakCount-day streak", color = colors.accent, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 8.dp))
                        Text("Your streak rolls over at 00:00 UTC", color = colors.textSecondary, fontSize = 11.sp, modifier = Modifier.padding(top = 2.dp))
                        levelOverview?.nextMilestone?.let { milestone ->
                            Text("Next reward: $milestone days · ${levelOverview.nextMilestoneReward} coins", color = colors.textSecondary, fontSize = 12.sp, modifier = Modifier.padding(top = 3.dp))
                        }
                        Button(
                            onClick = {
                                viewModel.checkIn(token) { result ->
                                    checkInResult = result
                                    streakCount = result.streak
                                }
                            },
                            modifier = Modifier.padding(top = 10.dp),
                            enabled = payload.level.canDailyCheckIn && !viewModel.isCheckingIn,
                            colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = colors.accent, disabledContainerColor = colors.border)
                        ) { Text(if (viewModel.isCheckingIn) "Checking in…" else if (payload.level.canDailyCheckIn) "Check in today" else "Checked in today", color = colors.textPrimary, fontWeight = FontWeight.Black) }
                        checkInResult?.let { result ->
                            if (result.claimed) {
                                val rewards = buildList {
                                    if (result.xpAwarded > 0) add("+${result.xpAwarded} XP")
                                    if (result.streakBonus > 0) add("+${result.streakBonus} coins")
                                }.joinToString(" · ")
                                Text("Check-in complete · ${result.streak}-day streak${if (rewards.isNotBlank()) " · $rewards" else ""}", color = colors.accent, fontWeight = FontWeight.Bold, fontSize = 12.sp, modifier = Modifier.padding(top = 6.dp))
                                if (result.unlockedCosmetic.isNotBlank()) {
                                    Text("Unlocked: ${cosmeticDisplayName(result.unlockedCosmetic)}", color = colors.primary, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 4.dp))
                                }
                            }
                        }
                        viewModel.checkInError?.let { message ->
                            Text(message, color = colors.primary, fontSize = 12.sp, modifier = Modifier.padding(top = 6.dp))
                        }
                    }
                }
                item {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) { SectionTitle("Next best actions") }
                        TextButton(onClick = onOpenAchievements) { Text("All achievements →", color = colors.primary, fontSize = 12.sp) }
                    }
                }
                items(payload.achievements.take(5), key = { it.id }) { item ->
                    GlassCard(Modifier.fillMaxWidth()) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(item.title, color = colors.textPrimary, fontWeight = FontWeight.Black)
                                Text(item.description, color = colors.textSecondary, fontSize = 12.sp, modifier = Modifier.padding(top = 3.dp))
                            }
                            if (item.canClaim) {
                                var claiming by remember { mutableStateOf(false) }
                                Button(
                                    onClick = {
                                        claiming = true
                                        viewModel.claimAchievement(token, item.id) {
                                            claiming = false
                                        }
                                    },
                                    enabled = !claiming,
                                    colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = colors.accent)
                                ) {
                                    Text(if (claiming) "..." else "Claim", color = colors.textPrimary, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                        LinearProgressIndicator(
                            progress = { if (item.target > 0) (item.progress.toFloat() / item.target).coerceIn(0f, 1f) else 0f },
                            modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
                            color = if (item.canClaim) colors.accent else colors.primary,
                            trackColor = colors.textSecondary.copy(alpha = 0.24f)
                        )
                        Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("${item.progress}/${item.target}", color = if (item.canClaim) colors.accent else colors.primary, fontWeight = FontWeight.Bold)
                            if (item.rewardCosmetic.isNotBlank()) {
                                Text("${cosmeticDisplayName(item.rewardCosmetic)}", color = colors.accent, fontWeight = FontWeight.Bold)
                            } else {
                                Text("${item.rewardCoins} coins", color = colors.accent, fontWeight = FontWeight.Bold)
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
                            Text("Creator earnings", color = colors.accent, fontWeight = FontWeight.Black)
                            Text("Creator Payout Verification is required only when you withdraw real money earned from gifts.", color = colors.textSecondary, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
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
                                Text(step, color = colors.textPrimary, fontWeight = FontWeight.Bold)
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
                            Text("No scheduled rooms yet.", color = colors.textPrimary, fontWeight = FontWeight.Black)
                            Text("Schedule one from room creation to give followers a reason to come back.", color = colors.textSecondary, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
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
                        Text(item.title, color = colors.textPrimary, fontWeight = FontWeight.Black)
                        Text(item.type.replace("_", " ").lowercase(), color = colors.textSecondary, fontSize = 12.sp, modifier = Modifier.padding(top = 3.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun GrowthMissionCard(mission: Mission, onClaim: (() -> Unit) -> Unit) {
    val colors = LocalYugmColors.current
    var claiming by remember(mission.id) { mutableStateOf(false) }
    val progress = if (mission.requirements.target > 0) {
        (mission.progress.toFloat() / mission.requirements.target).coerceIn(0f, 1f)
    } else 0f
    GlassCard(Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(mission.title, color = colors.textPrimary, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                if (mission.description.isNotBlank()) Text(mission.description, color = colors.textSecondary, fontSize = 12.sp)
            }
            when {
                mission.claimed -> Text("✓ Claimed", color = colors.accent, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                mission.completed -> Button(onClick = { claiming = true; onClaim { claiming = false } }, enabled = !claiming) {
                    Text(if (claiming) "Claiming…" else "Claim")
                }
            }
        }
        LinearProgressIndicator(
            progress = { progress },
            modifier = Modifier.fillMaxWidth().padding(top = 10.dp).height(6.dp),
            color = if (mission.completed) colors.accent else colors.primary,
            trackColor = colors.textSecondary.copy(alpha = 0.24f)
        )
        Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("${mission.progress}/${mission.requirements.target}", color = colors.textSecondary, fontSize = 11.sp)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (mission.rewards.xp > 0) Text("+${mission.rewards.xp} XP", color = colors.accent, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                if (mission.rewards.coins > 0) Text("+${mission.rewards.coins} coins", color = colors.accent, fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}
