package com.yugm.app.feature.missions.screens

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
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
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
import com.yugm.app.core.ui.theme.Background
import com.yugm.app.core.ui.theme.Gold
import com.yugm.app.core.ui.theme.Panel
import com.yugm.app.core.ui.theme.Pink
import com.yugm.app.core.ui.theme.PrimaryPurple
import com.yugm.app.core.ui.theme.TextMuted
import com.yugm.app.core.ui.theme.TextPrimary
import com.yugm.app.core.ui.theme.TextSecondary
import kotlinx.coroutines.launch

@Composable
fun BattlePassScreen(token: String, onBack: () -> Unit) {
    val scope = rememberCoroutineScope()
    var data by remember { mutableStateOf<BattlePassResponse?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var isPurchasing by remember { mutableStateOf(false) }
    var claiming by remember { mutableStateOf<Pair<Int, String>?>(null) }
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
    LaunchedEffect(token) { reload() }

    Column(Modifier.fillMaxSize().background(Background)) {
        Row(
            Modifier.fillMaxWidth().height(56.dp).padding(horizontal = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            TextButton(onClick = onBack, contentPadding = PaddingValues(horizontal = 8.dp)) { Text("‹", color = TextPrimary, fontSize = 30.sp) }
            Text("Level & Rewards", color = TextPrimary, fontSize = 19.sp, fontWeight = FontWeight.Black, modifier = Modifier.weight(1f))
            TextButton(onClick = ::reload, enabled = !isLoading) { Text("Refresh", color = Gold, fontSize = 12.sp) }
        }

        when {
            isLoading && data == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Pink) }
            data == null -> Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(error ?: "Season information is unavailable.", color = TextSecondary)
                    Button(onClick = ::reload, modifier = Modifier.padding(top = 12.dp)) { Text("Try again") }
                }
            }
            data?.season == null || data?.battlePass == null -> Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
                Text("There isn’t an active season right now. Please check back soon.", color = TextSecondary)
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
                            onPurchase = {
                                scope.launch {
                                    isPurchasing = true
                                    error = null
                                    runCatching { YugmApi.purchaseBattlePass(token) }
                                        .onSuccess { result ->
                                            data = BattlePassResponse(result.battlePass, result.season)
                                            message = "Premium rewards unlocked for this season."
                                        }
                                        .onFailure { error = it.message ?: "Premium pass purchase failed" }
                                    isPurchasing = false
                                }
                            }
                        )
                    }
                    message?.let { msg -> item { Text(msg, color = Gold, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 4.dp)) } }
                    error?.let { msg -> item { Text(msg, color = Pink, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 4.dp)) } }
                    item {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text("Season rewards", color = TextPrimary, fontSize = 19.sp, fontWeight = FontWeight.Black)
                                Text("Claim each unlocked reward as you progress.", color = TextMuted, fontSize = 11.sp, modifier = Modifier.padding(top = 2.dp))
                            }
                            Text("${season.rewards.size} LEVELS", color = Gold, fontSize = 10.sp, fontWeight = FontWeight.Black)
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
                                        .onSuccess {
                                            data = it
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
    val isMaxLevel = level >= maxLevel
    val progress = if (isMaxLevel) 1f else (xp.toFloat() / xpPerLevel.coerceAtLeast(1)).coerceIn(0f, 1f)
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp))
            .background(Brush.linearGradient(listOf(Color(0xFF381B48), Color(0xFF211932), Color(0xFF18223B))))
            .border(1.dp, Pink.copy(alpha = .25f), RoundedCornerShape(24.dp)).padding(18.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(46.dp).clip(RoundedCornerShape(15.dp)).background(Brush.linearGradient(listOf(Gold, Color(0xFFE48F54)))), contentAlignment = Alignment.Center) {
                Text("✦", color = Color(0xFF3A2340), fontSize = 25.sp, fontWeight = FontWeight.Black)
            }
            Column(Modifier.weight(1f).padding(start = 12.dp)) {
                Text(name, color = TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Black, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text("${startDate.take(10)}  —  ${endDate.take(10)}", color = TextMuted, fontSize = 10.sp, modifier = Modifier.padding(top = 3.dp))
            }
            if (premium) PassBadge("PREMIUM", Gold)
        }
        if (description.isNotBlank()) Text(description, color = TextSecondary, fontSize = 12.sp, lineHeight = 17.sp, modifier = Modifier.padding(top = 12.dp))
        Row(Modifier.fillMaxWidth().padding(top = 16.dp, bottom = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("LEVEL $level", color = Gold, fontSize = 14.sp, fontWeight = FontWeight.Black, modifier = Modifier.weight(1f))
            Text(if (isMaxLevel) "MAX LEVEL" else "${xpPerLevel.coerceAtLeast(0) - xp.coerceAtLeast(0)} XP TO NEXT", color = TextMuted, fontSize = 9.sp, fontWeight = FontWeight.Bold)
        }
        LinearProgressIndicator(
            progress = { progress }, modifier = Modifier.fillMaxWidth().height(8.dp).clip(CircleShape),
            color = Gold, trackColor = Color.White.copy(alpha = .14f)
        )
        Row(Modifier.fillMaxWidth().padding(top = 6.dp), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(if (isMaxLevel) "Every season reward unlocked" else "$xp / $xpPerLevel XP", color = TextMuted, fontSize = 10.sp)
            Text("MAX $maxLevel", color = TextMuted, fontSize = 10.sp)
        }
        if (!premium) {
            Button(
                onClick = onPurchase,
                enabled = !isPurchasing,
                modifier = Modifier.fillMaxWidth().padding(top = 15.dp).height(48.dp),
                shape = RoundedCornerShape(15.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Gold, contentColor = Color(0xFF2D1B34))
            ) { Text(if (isPurchasing) "Unlocking…" else "Unlock Premium  ·  $price coins", fontWeight = FontWeight.Black) }
        } else {
            Text("Premium track unlocked · rewards are ready when you reach them", color = Gold, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 13.dp))
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
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(19.dp))
            .background(if (unlocked) Color(0xFF201D31) else Panel.copy(alpha = .84f))
            .border(1.dp, if (unlocked) Gold.copy(alpha = .19f) else Color.White.copy(alpha = .045f), RoundedCornerShape(19.dp)).padding(12.dp)
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(30.dp).clip(CircleShape).background(if (unlocked) Gold.copy(alpha = .2f) else Color.White.copy(alpha = .07f)), contentAlignment = Alignment.Center) {
                Text("${reward.level}", color = if (unlocked) Gold else TextMuted, fontWeight = FontWeight.Black, fontSize = 12.sp)
            }
            Text("Level ${reward.level}", color = TextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f).padding(start = 9.dp))
            Text(if (unlocked) "UNLOCKED" else "${(reward.level - 1).coerceAtLeast(0)} LEVELS TO GO", color = if (unlocked) Gold else TextMuted, fontSize = 9.sp, fontWeight = FontWeight.Bold)
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
    val accent = if (label == "PREMIUM") Pink else Gold
    Column(
        modifier.clip(RoundedCornerShape(14.dp)).background(Color.Black.copy(alpha = .17f))
            .border(1.dp, accent.copy(alpha = .15f), RoundedCornerShape(14.dp)).padding(10.dp)
    ) {
        Text(label, color = accent, fontSize = 9.sp, fontWeight = FontWeight.Black)
        Spacer(Modifier.height(5.dp))
        Text(reward?.let(::rewardTitle) ?: "No reward", color = if (reward == null) TextMuted else TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text(reward?.let(::rewardDescription) ?: "—", color = TextMuted, fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 2.dp))
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
                colors = ButtonDefaults.buttonColors(containerColor = accent.copy(alpha = .19f), disabledContainerColor = Color.White.copy(alpha = .05f), contentColor = accent, disabledContentColor = TextMuted)
            ) { Text(buttonLabel, fontSize = 10.sp, fontWeight = FontWeight.Bold, maxLines = 1) }
        }
    }
}

@Composable
private fun PassBadge(label: String, tint: Color) {
    Text(label, color = tint, fontSize = 8.sp, fontWeight = FontWeight.Black,
        modifier = Modifier.clip(CircleShape).background(tint.copy(alpha = .15f)).border(1.dp, tint.copy(alpha = .35f), CircleShape).padding(horizontal = 8.dp, vertical = 5.dp))
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