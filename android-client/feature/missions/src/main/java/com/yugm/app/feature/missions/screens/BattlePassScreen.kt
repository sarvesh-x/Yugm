package com.yugm.app.feature.missions.screens

import com.yugm.app.core.api.SyncTopic
import com.yugm.app.core.ui.components.AutomaticSyncEffect
import com.yugm.app.core.util.DateUtils
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
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.LinearProgressIndicator
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yugm.app.core.api.YugmApi
import com.yugm.app.core.model.BattlePassResponse
import com.yugm.app.core.model.BattlePassTrackReward
import com.yugm.app.core.model.SeasonReward
import com.yugm.app.core.ui.theme.LocalYugmColors
import kotlinx.coroutines.launch
import com.yugm.app.core.ui.components.YugmLoadingSpinner

@Composable
fun BattlePassScreen(token: String, onBack: () -> Unit) {
    val colors = LocalYugmColors.current
    val scope = rememberCoroutineScope()
    var data by remember { mutableStateOf<BattlePassResponse?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var isPurchasing by remember { mutableStateOf(false) }
    var claiming by remember { mutableStateOf<Pair<Int, String>?>(null) }
    var showPurchaseConfirmation by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var message by remember { mutableStateOf<String?>(null) }

    fun reload() {
        scope.launch {
            isLoading = true
            error = null
            runCatching { YugmApi.battlePass(token) }
                .onSuccess { data = it }
                .onFailure { error = it.message ?: "Could not load your season" }
            isLoading = false
        }
    }
    AutomaticSyncEffect(token, topics = setOf(SyncTopic.TASKS), enabled = token.isNotBlank(), isBusy = { isLoading }) { reload() }

    Column(Modifier.fillMaxSize().background(colors.background)) {
        Row(
            Modifier.fillMaxWidth().height(56.dp).padding(horizontal = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            TextButton(onClick = onBack, contentPadding = PaddingValues(horizontal = 8.dp)) { Text("‹", color = colors.textPrimary, fontSize = 30.sp) }
            Text("Level & Rewards", color = colors.textPrimary, fontSize = 19.sp, fontWeight = FontWeight.Black, modifier = Modifier.weight(1f))
        }

        when {
            isLoading && data == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { YugmLoadingSpinner(size = 40.dp) }
            data == null -> Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(error ?: "Season information is unavailable.", color = colors.textSecondary)
                    Button(onClick = ::reload, modifier = Modifier.padding(top = 12.dp)) { Text("Try again") }
                }
            }
            data?.season == null || data?.battlePass == null -> Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
                Text("There isn’t an active season right now. Please check back soon.", color = colors.textSecondary)
            }
            else -> {
                val response = data!!
                val bp = response.battlePass!!
                val season = response.season!!
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 10.dp, bottom = 30.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    item {
                        PassHero(
                            name = season.name,
                            startDate = season.startDate,
                            endDate = season.endDate,
                            description = season.description,
                            level = bp.level,
                            xp = bp.xp,
                            xpPerLevel = season.xpPerLevel,
                            maxLevel = season.maxLevel,
                            premium = bp.premium,
                            price = season.premiumPrice,
                            isPurchasing = isPurchasing,
                            onPurchase = { showPurchaseConfirmation = true }
                        )
                    }
                    response.previousSeasonSummary?.let { previous ->
                        item { PreviousSeasonSummaryCard(previous) }
                    }
                    message?.let { msg -> item { Text(msg, color = colors.accent, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 4.dp)) } }
                    error?.let { msg -> item { Text(msg, color = colors.danger, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 4.dp)) } }
                    item {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text("Season rewards", color = colors.textPrimary, fontSize = 19.sp, fontWeight = FontWeight.Black)
                                Text("Claim each unlocked reward as you progress.", color = colors.textSecondary, fontSize = 11.sp, modifier = Modifier.padding(top = 2.dp))
                            }
                            Text("${season.rewards.size} LEVELS", color = colors.accent, fontSize = 10.sp, fontWeight = FontWeight.Black)
                        }
                    }
                    items(season.rewards, key = { it.level }) { reward ->
                        val rewardState = bp.rewards.firstOrNull { it.level == reward.level }
                        val unlocked = reward.level <= bp.level
                        PassRewardLevel(
                            reward = reward,
                            freeClaimed = rewardState?.freeClaimed == true || rewardState?.claimed == true,
                            premiumClaimed = rewardState?.premiumClaimed == true,
                            unlocked = unlocked,
                            premium = bp.premium,
                            claimingTrack = claiming?.takeIf { it.first == reward.level }?.second,
                            onClaim = { track ->
                                scope.launch {
                                    claiming = reward.level to track
                                    error = null
                                    runCatching { YugmApi.claimBattlePassReward(token, reward.level, track) }
                                        .onSuccess { result ->
                                            data = result.copy(previousSeasonSummary = data?.previousSeasonSummary)
                                            message = "Level ${reward.level} ${track} reward claimed."
                                        }
                                        .onFailure { error = it.message ?: "Could not claim this reward" }
                                    claiming = null
                                }
                            }
                        )
                    }
                }
            }
        }
        if (showPurchaseConfirmation) {
            val price = data?.season?.premiumPrice ?: 0
            AlertDialog(
                onDismissRequest = { if (!isPurchasing) showPurchaseConfirmation = false },
                title = { Text("Unlock premium rewards?", color = colors.textPrimary, fontWeight = FontWeight.Bold) },
                text = { Text("Unlock this season’s premium track for $price coins. Your free-track progress will stay the same.", color = colors.textSecondary) },
                confirmButton = {
                    TextButton(
                        enabled = !isPurchasing,
                        onClick = {
                            showPurchaseConfirmation = false
                            scope.launch {
                                isPurchasing = true
                                error = null
                                runCatching { YugmApi.purchaseBattlePass(token) }
                                    .onSuccess { result ->
                                        data = BattlePassResponse(result.battlePass, result.season, data?.previousSeasonSummary)
                                        message = "Premium rewards unlocked for this season."
                                    }
                                    .onFailure { error = it.message ?: "Premium pass purchase failed" }
                                isPurchasing = false
                            }
                        }
                    ) { Text(if (isPurchasing) "Unlocking…" else "Unlock · $price coins", color = colors.primary, fontWeight = FontWeight.Bold) }
                },
                dismissButton = { TextButton(onClick = { showPurchaseConfirmation = false }, enabled = !isPurchasing) { Text("Cancel", color = colors.textSecondary) } },
                containerColor = colors.surface
            )
        }
    }
}

@Composable
private fun PassHero(
    name: String,
    startDate: String,
    endDate: String,
    description: String,
    level: Int,
    xp: Int,
    xpPerLevel: Int,
    maxLevel: Int,
    premium: Boolean,
    price: Int,
    isPurchasing: Boolean,
    onPurchase: () -> Unit
) {
    val colors = LocalYugmColors.current
    val isMaxLevel = level >= maxLevel
    val progress = if (isMaxLevel) 1f else (xp.toFloat() / xpPerLevel.coerceAtLeast(1)).coerceIn(0f, 1f)
    val daysRemaining = DateUtils.daysUntilIso(endDate)
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp))
            .background(Brush.linearGradient(if (colors.isDark) listOf(Color(0xFF381B48), Color(0xFF211932), Color(0xFF18223B)) else listOf(Color(0xFFF0E7FF), Color(0xFFFFEFF5), Color.White)))
            .border(1.dp, colors.primary.copy(alpha = .25f), RoundedCornerShape(24.dp)).padding(18.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(46.dp).clip(RoundedCornerShape(15.dp)).background(Brush.linearGradient(listOf(colors.accent, colors.primary))), contentAlignment = Alignment.Center) {
                Text("✦", color = colors.primaryOn, fontSize = 25.sp, fontWeight = FontWeight.Black)
            }
            Column(Modifier.weight(1f).padding(start = 12.dp)) {
                Text(name, color = colors.textPrimary, fontSize = 20.sp, fontWeight = FontWeight.Black, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text("${startDate.take(10)}  —  ${endDate.take(10)}${daysRemaining?.let { " · $it days left" }.orEmpty()}", color = colors.textSecondary, fontSize = 10.sp, modifier = Modifier.padding(top = 3.dp))
            }
            if (premium) PassBadge("PREMIUM", colors.accent)
        }
        if (description.isNotBlank()) Text(description, color = colors.textSecondary, fontSize = 12.sp, lineHeight = 17.sp, modifier = Modifier.padding(top = 12.dp))
        Row(Modifier.fillMaxWidth().padding(top = 16.dp, bottom = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("LEVEL $level", color = colors.accent, fontSize = 14.sp, fontWeight = FontWeight.Black, modifier = Modifier.weight(1f))
            Text(if (isMaxLevel) "MAX LEVEL" else "${xpPerLevel.coerceAtLeast(0) - xp.coerceAtLeast(0)} XP TO NEXT", color = colors.textSecondary, fontSize = 9.sp, fontWeight = FontWeight.Bold)
        }
        LinearProgressIndicator(
            progress = { progress }, modifier = Modifier.fillMaxWidth().height(8.dp).clip(CircleShape),
            color = colors.accent, trackColor = colors.border
        )
        Row(Modifier.fillMaxWidth().padding(top = 6.dp), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(if (isMaxLevel) "Every season reward unlocked" else "$xp / $xpPerLevel XP", color = colors.textSecondary, fontSize = 10.sp)
            Text("MAX $maxLevel", color = colors.textSecondary, fontSize = 10.sp)
        }
        if (!premium) {
            Button(
                onClick = onPurchase,
                enabled = !isPurchasing,
                modifier = Modifier.fillMaxWidth().padding(top = 15.dp).height(48.dp),
                shape = RoundedCornerShape(15.dp),
                colors = ButtonDefaults.buttonColors(containerColor = colors.accent, contentColor = colors.primaryOn)
            ) { Text(if (isPurchasing) "Unlocking…" else "Unlock Premium  ·  $price coins", fontWeight = FontWeight.Black) }
        } else {
            Text("Premium track unlocked · rewards are ready when you reach them", color = colors.accent, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 13.dp))
        }
    }
}

@Composable
private fun PassRewardLevel(
    reward: SeasonReward,
    freeClaimed: Boolean,
    premiumClaimed: Boolean,
    unlocked: Boolean,
    premium: Boolean,
    claimingTrack: String?,
    onClaim: (String) -> Unit
) {
    val colors = LocalYugmColors.current
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(19.dp))
            .background(if (unlocked) colors.surfaceElevated else colors.surface)
            .border(1.dp, if (unlocked) colors.accent.copy(alpha = .25f) else colors.border, RoundedCornerShape(19.dp)).padding(12.dp)
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(30.dp).clip(CircleShape).background(if (unlocked) colors.accent.copy(alpha = .16f) else colors.surfaceVariant), contentAlignment = Alignment.Center) {
                Text("${reward.level}", color = if (unlocked) colors.accent else colors.textSecondary, fontWeight = FontWeight.Black, fontSize = 12.sp)
            }
            Text("Level ${reward.level}", color = colors.textPrimary, fontSize = 14.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f).padding(start = 9.dp))
            Text(if (unlocked) "UNLOCKED" else "${(reward.level - 1).coerceAtLeast(0)} LEVELS TO GO", color = if (unlocked) colors.accent else colors.textSecondary, fontSize = 9.sp, fontWeight = FontWeight.Bold)
        }
        Row(Modifier.fillMaxWidth().padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            RewardTrackCard("FREE", reward.freeReward, freeClaimed, unlocked, true, claimingTrack == "free", Modifier.weight(1f)) { onClaim("free") }
            RewardTrackCard("PREMIUM", reward.premiumReward, premiumClaimed, unlocked, premium, claimingTrack == "premium", Modifier.weight(1f)) { onClaim("premium") }
        }
    }
}

@Composable
private fun RewardTrackCard(
    label: String,
    reward: BattlePassTrackReward?,
    claimed: Boolean,
    levelUnlocked: Boolean,
    trackUnlocked: Boolean,
    isClaiming: Boolean,
    modifier: Modifier = Modifier,
    onClaim: () -> Unit
) {
    val colors = LocalYugmColors.current
    val accent = if (label == "PREMIUM") colors.secondary else colors.accent
    Column(
        modifier.clip(RoundedCornerShape(14.dp)).background(colors.surface)
            .border(1.dp, accent.copy(alpha = .15f), RoundedCornerShape(14.dp)).padding(10.dp)
    ) {
        Text(label, color = accent, fontSize = 9.sp, fontWeight = FontWeight.Black)
        Spacer(Modifier.height(5.dp))
        Text(reward?.let(::rewardTitle) ?: "No reward", color = if (reward == null) colors.textSecondary else colors.textPrimary, fontSize = 12.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text(reward?.let(::rewardDescription) ?: "—", color = colors.textSecondary, fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 2.dp))
        if (reward != null) {
            val buttonLabel = when {
                claimed -> "Claimed"
                !trackUnlocked -> "Premium pass"
                !levelUnlocked -> "Locked"
                isClaiming -> "Claiming…"
                else -> "Claim"
            }
            Button(
                onClick = onClaim,
                enabled = levelUnlocked && trackUnlocked && !claimed && !isClaiming,
                modifier = Modifier.fillMaxWidth().padding(top = 7.dp).height(34.dp),
                contentPadding = PaddingValues(horizontal = 5.dp),
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(containerColor = accent.copy(alpha = .14f), disabledContainerColor = colors.surfaceVariant, contentColor = accent, disabledContentColor = colors.textSecondary)
            ) { Text(buttonLabel, fontSize = 10.sp, fontWeight = FontWeight.Bold, maxLines = 1) }
        }
    }
}

@Composable
private fun PassBadge(label: String, tint: Color) {
    Text(label, color = tint, fontSize = 8.sp, fontWeight = FontWeight.Black,
        modifier = Modifier.clip(CircleShape).background(tint.copy(alpha = .15f)).border(1.dp, tint.copy(alpha = .35f), CircleShape).padding(horizontal = 8.dp, vertical = 5.dp))
}

@Composable
private fun PreviousSeasonSummaryCard(summary: com.yugm.app.core.model.PreviousSeasonSummary) {
    val colors = LocalYugmColors.current
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp))
            .background(colors.surface).border(1.dp, colors.border, RoundedCornerShape(18.dp)).padding(14.dp)
    ) {
        Text("Previous season · ${summary.name}", color = colors.textPrimary, fontWeight = FontWeight.Bold, fontSize = 13.sp)
        Text(
            "Level ${summary.level}/${summary.maxLevel} · ${if (summary.premium) "Premium" else "Free track"} · ended ${summary.endedAt.take(10)}",
            color = colors.textSecondary,
            fontSize = 10.sp,
            modifier = Modifier.padding(top = 4.dp)
        )
        Text(
            if (summary.unclaimedRewards > 0) "${summary.unclaimedRewards} earned rewards were left unclaimed. Previous seasons are read-only."
            else "All earned rewards from this season were claimed.",
            color = if (summary.unclaimedRewards > 0) colors.warning else colors.success,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(top = 8.dp)
        )
    }
}

private fun rewardTitle(reward: BattlePassTrackReward) = when (reward.type.lowercase()) {
    "coins" -> "🪙  ${reward.amount} coins"
    "diamonds" -> "💎  ${reward.amount} diamonds"
    "cosmetic" -> "✨  ${reward.itemId?.replace('_', ' ')?.replaceFirstChar { it.uppercase() } ?: "Cosmetic"}"
    "title" -> "🏷️  ${reward.itemId?.replace('_', ' ')?.replaceFirstChar { it.uppercase() } ?: "Title"}"
    "xp" -> "⭐  ${reward.amount} XP"
    else -> "Season reward"
}

private fun rewardDescription(reward: BattlePassTrackReward) = when (reward.type.lowercase()) {
    "cosmetic" -> "Profile cosmetic"
    "title" -> "Profile title"
    "xp" -> "Level experience"
    else -> "Added to your account"
}
