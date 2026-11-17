package com.yugm.app.feature.social.screens

import com.yugm.app.core.api.SyncTopic
import com.yugm.app.core.ui.components.AutomaticSyncEffect
import android.content.Intent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.foundation.rememberScrollState
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yugm.app.core.api.YugmApi
import com.yugm.app.core.model.Achievement
import com.yugm.app.core.ui.theme.LocalYugmColors
import kotlinx.coroutines.launch

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun AchievementsScreen(token: String, onBack: () -> Unit) {
    val colors = LocalYugmColors.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var achievements by remember { mutableStateOf<List<Achievement>>(emptyList()) }
    val showcasedIds = remember { mutableStateListOf<String>() }
    var selectedCategory by remember { mutableStateOf("All") }
    var loading by remember { mutableStateOf(true) }
    var busyId by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var message by remember { mutableStateOf<String?>(null) }

    fun refresh() {
        scope.launch {
            loading = true
            error = null
            runCatching {
                val home = YugmApi.experienceHome(token)
                val list = YugmApi.achievements(token)
                val badges = if (home.userId.isNotBlank()) YugmApi.getUserBadges(token, home.userId) else emptyList()
                Triple(list, badges.map { it.id }, Unit)
            }.onSuccess { (list, ids) ->
                achievements = list
                showcasedIds.clear()
                showcasedIds.addAll(ids)
            }.onFailure { error = it.message ?: "Could not load achievements" }
            loading = false
        }
    }

    AutomaticSyncEffect(token, topics = setOf(SyncTopic.TASKS), enabled = token.isNotBlank(), isBusy = { loading }) { refresh() }
    val categories = listOf("All") + achievements.map { it.category }.filter { it.isNotBlank() }.distinct().sorted()
    val visible = achievements.filter { selectedCategory == "All" || it.category.equals(selectedCategory, true) }
    val claimable = achievements.count { it.canClaim }

    Scaffold(
        containerColor = colors.background,
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Achievements", color = colors.textPrimary, fontWeight = FontWeight.Bold)
                        Text("Progress, rewards, and your badge showcase", color = colors.textSecondary, fontSize = 11.sp)
                    }
                },
                navigationIcon = { TextButton(onClick = onBack) { Text("‹", color = colors.textPrimary, fontSize = 28.sp) } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = colors.background)
            )
        }
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            Column(Modifier.padding(horizontal = 18.dp)) {
                Surface(Modifier.fillMaxWidth(), color = colors.surfaceElevated, shape = RoundedCornerShape(20.dp), border = BorderStroke(1.dp, colors.border)) {
                    Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text("${achievements.count { it.complete }} completed · $claimable ready to claim", color = colors.textPrimary, fontWeight = FontWeight.Bold)
                            Text("Showcase up to 5 earned badges on your profile", color = colors.textSecondary, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
                        }
                        Text("${showcasedIds.size}/5", color = colors.primary, fontWeight = FontWeight.Black, fontSize = 17.sp)
                    }
                }
                Row(Modifier.fillMaxWidth().padding(top = 13.dp).horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    categories.forEach { category ->
                        Surface(
                            onClick = { selectedCategory = category },
                            shape = CircleShape,
                            color = if (selectedCategory == category) colors.primary.copy(alpha = .12f) else colors.surface,
                            border = BorderStroke(1.dp, if (selectedCategory == category) colors.primary.copy(alpha = .45f) else colors.border)
                        ) {
                            Text(category.replaceFirstChar { it.uppercase() }, color = if (selectedCategory == category) colors.primary else colors.textSecondary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp))
                        }
                    }
                }
                error?.let { Text(it, color = colors.danger, fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp)) }
                message?.let { Text(it, color = colors.success, fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp)) }
            }

            when {
                loading && achievements.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = colors.primary) }
                error != null && achievements.isEmpty() -> Column(Modifier.fillMaxWidth().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("Achievements are unavailable", color = colors.textPrimary, fontWeight = FontWeight.Bold)
                    TextButton(onClick = ::refresh) { Text("Try again", color = colors.primary) }
                }
                visible.isEmpty() -> Column(Modifier.fillMaxWidth().padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("No achievements in this category yet", color = colors.textPrimary, fontWeight = FontWeight.SemiBold)
                    Text("Keep exploring Yugm and your progress will show up here.", color = colors.textSecondary, fontSize = 12.sp, modifier = Modifier.padding(top = 5.dp))
                }
                else -> LazyColumn(contentPadding = PaddingValues(horizontal = 18.dp, vertical = 14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    items(visible, key = { it.id }) { achievement ->
                        val progress = if (achievement.target > 0) (achievement.progress.toFloat() / achievement.target).coerceIn(0f, 1f) else if (achievement.complete) 1f else 0f
                        Surface(Modifier.fillMaxWidth(), color = colors.surface, shape = RoundedCornerShape(20.dp), border = BorderStroke(1.dp, colors.border)) {
                            Column(Modifier.padding(15.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Box(Modifier.size(44.dp).clip(RoundedCornerShape(14.dp)).background(colors.primary.copy(alpha = .12f)), contentAlignment = Alignment.Center) { Text(achievement.icon, fontSize = 22.sp) }
                                    Column(Modifier.weight(1f).padding(start = 11.dp)) {
                                        Text(achievement.title, color = colors.textPrimary, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                        Text(achievement.description, color = colors.textSecondary, fontSize = 11.sp, modifier = Modifier.padding(top = 3.dp))
                                    }
                                    if (achievement.category.isNotBlank()) Text(achievement.category.replaceFirstChar { it.uppercase() }, color = colors.secondary, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                                }
                                LinearProgressIndicator(progress = { progress }, modifier = Modifier.fillMaxWidth().padding(top = 12.dp).height(5.dp), color = colors.primary, trackColor = colors.border.copy(alpha = .7f))
                                Row(Modifier.fillMaxWidth().padding(top = 6.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                                    Text("${achievement.progress} / ${achievement.target}", color = colors.textSecondary, fontSize = 10.sp)
                                    Text(achievement.highestClaimedTier?.let { "$it earned" } ?: "${achievement.nextTier ?: "Next"} tier", color = colors.accent, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                }
                                if (achievement.tiers.isNotEmpty()) {
                                    Row(Modifier.fillMaxWidth().padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                        achievement.tiers.forEach { tier ->
                                            val tint = when {
                                                tier.claimed -> colors.success
                                                tier.reached -> colors.accent
                                                else -> colors.textSecondary
                                            }
                                            Text("${tier.tier} · ${tier.target}", color = tint, fontSize = 9.sp, fontWeight = FontWeight.Bold, modifier = Modifier.clip(CircleShape).background(tint.copy(alpha = .1f)).padding(horizontal = 8.dp, vertical = 5.dp))
                                        }
                                    }
                                    val nextTier = achievement.tiers.firstOrNull { !it.claimed }
                                    nextTier?.let { tier ->
                                    val reward = buildList {
                                            if (tier.rewardCoins > 0) add("${tier.rewardCoins} coins")
                                        if (tier.rewardCosmetic.isNotBlank()) {
                                            add(tier.rewardCosmetic.replace('_', ' ').lowercase().replaceFirstChar { it.uppercase() })
                                        }
                                        }.joinToString(" + ")
                                        if (reward.isNotBlank()) Text("${tier.tier} reward: $reward", color = colors.textSecondary, fontSize = 10.sp, modifier = Modifier.padding(top = 7.dp))
                                    }
                                }
                                Row(Modifier.fillMaxWidth().padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                                    if (achievement.canClaim && busyId == null) {
                                        Button(onClick = {
                                            scope.launch {
                                                busyId = achievement.id
                                                message = null
                                                runCatching { YugmApi.claimAchievement(token, achievement.id) }
                                                    .onSuccess { result ->
                                                        message = "${result.tier.ifBlank { "Achievement" }} reward claimed${if (result.rewardCoins > 0) " · +${result.rewardCoins} coins" else ""}"
                                                        refresh()
                                                    }
                                                    .onFailure { error = it.message ?: "Claim failed" }
                                                busyId = null
                                            }
                                        }, enabled = !loading, colors = ButtonDefaults.buttonColors(containerColor = colors.primary)) { Text("Claim ${achievement.nextTier ?: "reward"}", fontSize = 11.sp) }
                                    } else if (busyId == achievement.id) {
                                        CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp, color = colors.primary)
                                    }
                                    if (achievement.highestClaimedTier != null) {
                                        TextButton(onClick = {
                                            scope.launch {
                                                runCatching { YugmApi.shareAchievement(token, achievement.id) }
                                                    .onSuccess { url ->
                                                        val text = url.ifBlank { "I earned ${achievement.title} (${achievement.highestClaimedTier}) on Yugm!" }
                                                        context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text), "Share achievement"))
                                                    }
                                                    .onFailure { error = it.message ?: "Could not prepare share" }
                                            }
                                        }) { Text("Share", color = colors.primary, fontSize = 11.sp) }
                                        val isShowcased = achievement.id in showcasedIds
                                        TextButton(onClick = {
                                            scope.launch {
                                                val updated = if (isShowcased) showcasedIds.filterNot { it == achievement.id } else if (showcasedIds.size < 5) showcasedIds + achievement.id else null
                                                if (updated == null) {
                                                    error = "You can showcase up to 5 badges. Remove one first."
                                                } else {
                                                    runCatching { YugmApi.updateBadgeShowcase(token, updated) }
                                                        .onSuccess { showcasedIds.clear(); showcasedIds.addAll(updated); error = null }
                                                        .onFailure { error = it.message ?: "Could not update showcase" }
                                                }
                                            }
                                        }) { Text(if (isShowcased) "Shown ✓" else "Showcase", color = if (isShowcased) colors.success else colors.primary, fontSize = 11.sp) }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
