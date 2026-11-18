package com.yugm.app.feature.social.screens

import android.content.Intent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yugm.app.core.api.CreatorApi
import com.yugm.app.core.api.SyncTopic
import com.yugm.app.core.model.Achievement
import com.yugm.app.core.model.AchievementTier
import com.yugm.app.core.model.BadgeGallery
import com.yugm.app.core.ui.components.AutomaticSyncEffect
import com.yugm.app.core.ui.components.Avatar
import com.yugm.app.core.ui.components.BadgeArtwork
import com.yugm.app.core.ui.theme.LocalYugmColors
import com.yugm.app.core.util.cosmeticDisplayName
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AchievementsScreen(token: String, onBack: () -> Unit) {
    val colors = LocalYugmColors.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val snackbar = remember { SnackbarHostState() }
    var gallery by remember(token) { mutableStateOf<BadgeGallery?>(null) }
    var loading by remember(token) { mutableStateOf(false) }
    var saving by remember(token) { mutableStateOf(false) }
    var error by remember(token) { mutableStateOf<String?>(null) }
    var honor by rememberSaveable { mutableStateOf(false) }
    var category by rememberSaveable { mutableStateOf<String?>(null) }
    var wearPicker by remember { mutableStateOf(false) }
    var rules by remember { mutableStateOf(false) }
    var selectedId by remember { mutableStateOf<String?>(null) }

    suspend fun refresh() {
        if (loading) return
        loading = true
        try {
            gallery = CreatorApi.badgeGallery(token)
            error = null
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (failure: Exception) {
            error = failure.message ?: "Could not load badges."
        } finally {
            loading = false
        }
    }

    fun change(operation: suspend () -> Unit) {
        if (saving || loading) return
        scope.launch {
            saving = true
            try {
                operation()
                refresh()
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (failure: Exception) {
                scope.launch { snackbar.showSnackbar(failure.message ?: "Could not update your badges.") }
            } finally {
                saving = false
            }
        }
    }

    fun claimReward(badge: Achievement) {
        change {
            val claim = CreatorApi.claimAchievement(token, badge.id)
            scope.launch { snackbar.showSnackbar(if (claim.rewardCoins > 0) "+${claim.rewardCoins} coins claimed" else "Reward claimed") }
        }
    }

    fun share(badge: Achievement) {
        scope.launch {
            try {
                val text = CreatorApi.shareAchievement(token, badge.id)
                val intent = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text)
                context.startActivity(Intent.createChooser(intent, "Share achievement"))
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (failure: Exception) {
                snackbar.showSnackbar(failure.message ?: "Could not share achievement.")
            }
        }
    }

    fun setBadgeWorn(ids: List<String>) {
        change {
            CreatorApi.updateBadgeShowcase(token, ids)
            selectedId = null
            wearPicker = false
        }
    }

    AutomaticSyncEffect(token, topics = setOf(SyncTopic.TASKS, SyncTopic.PROFILE), enabled = token.isNotBlank(),
        isBusy = { loading || saving }) { refresh() }

    val data = gallery
    val worn = data?.wornIds.orEmpty()
    val achievements = data?.badges.orEmpty().filterNot { it.badgeKind == "HONOR" }
    val categories = achievements.map { it.category }.filter(String::isNotBlank).distinct().sorted()
    val selectedCategory = category?.takeIf { it in categories }
    val visible = if (honor) data?.badges.orEmpty().filter { it.badgeKind == "HONOR" }
        else achievements.filter { selectedCategory == null || it.category == selectedCategory }
    val availableToWear = data?.badges.orEmpty().filter { it.badgeUnlocked && it.id !in worn }
    val selected = data?.badges?.firstOrNull { it.id == selectedId }

    Scaffold(
        containerColor = colors.background,
        snackbarHost = { SnackbarHost(snackbar) },
        topBar = {
            TopAppBar(
                title = { Text("Achievements & Badges", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { rules = true }) { Icon(Icons.Filled.Info, contentDescription = "Badge rules") }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = colors.background, titleContentColor = colors.textPrimary,
                    navigationIconContentColor = colors.textPrimary, actionIconContentColor = colors.textPrimary)
            )
        }
    ) { padding ->
        LazyVerticalGrid(
            columns = GridCells.Fixed(2),
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 24.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            if (data != null) {
                item(span = { GridItemSpan(maxLineSpan) }) {
                    BadgeShowcase(data, onEmptySlot = { wearPicker = true }, onBadge = { selectedId = it })
                }
                item(span = { GridItemSpan(maxLineSpan) }) {
                    TabRow(
                        selectedTabIndex = if (honor) 1 else 0,
                        containerColor = colors.background,
                        contentColor = colors.primary
                    ) {
                        Tab(selected = !honor, onClick = { honor = false }, text = { Text("Achievements") })
                        Tab(selected = honor, onClick = { honor = true }, text = { Text("Honor") })
                    }
                }
                if (!honor) {
                    item(span = { GridItemSpan(maxLineSpan) }) {
                        AchievementFilters(
                            complete = achievements.count { it.complete },
                            claimable = achievements.count { it.canClaim },
                            categories = categories,
                            selected = selectedCategory,
                            onSelect = { category = it }
                        )
                    }
                }
            }
            if (error != null || data == null || visible.isEmpty()) {
                item(span = { GridItemSpan(maxLineSpan) }) {
                    Column(Modifier.fillMaxWidth().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        when {
                            error != null -> {
                                Text(error.orEmpty(), color = colors.textSecondary, textAlign = TextAlign.Center)
                                TextButton(onClick = { scope.launch { refresh() } }) { Text("Try again") }
                            }
                            data == null -> CircularProgressIndicator(color = colors.primary)
                            honor -> Text("No honor badges are available yet.", color = colors.textSecondary)
                            else -> Text("No achievements in this category yet.", color = colors.textSecondary)
                        }
                    }
                }
            }
            if (honor) {
                items(visible, key = { it.id }) { badge ->
                    BadgeTile(badge, badge.id in worn, onClick = { selectedId = badge.id })
                }
            } else {
                items(visible, key = { it.id }, span = { GridItemSpan(maxLineSpan) }) { badge ->
                    AchievementCard(
                        badge = badge,
                        worn = badge.id in worn,
                        busy = saving || loading,
                        onDetails = { selectedId = badge.id },
                        onClaim = { claimReward(badge) },
                        onShare = { share(badge) }
                    )
                }
            }
        }
    }

    if (wearPicker) AlertDialog(
        onDismissRequest = { wearPicker = false },
        title = { Text("Choose a badge to wear") },
        text = {
            Column(Modifier.heightIn(max = 320.dp).verticalScroll(rememberScrollState())) {
                if (availableToWear.isEmpty()) Text("Earn an achievement or honor badge to fill this slot.")
                availableToWear.forEach { badge ->
                    Row(
                        Modifier.fillMaxWidth().clickable(enabled = !saving && !loading && worn.size < 3) {
                            setBadgeWorn(worn + badge.id)
                        }.padding(vertical = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        BadgeArtwork(badge, Modifier.size(36.dp))
                        Text(badge.title)
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = { wearPicker = false }) { Text("Close") } }
    )

    if (rules) AlertDialog(
        onDismissRequest = { rules = false },
        title = { Text("Badge rules") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("You can wear up to three earned badges. New badges fill empty slots automatically. Worn badges appear on your profile and in your room profile card.")
                Text("Achievement badges can have up to six levels. Keep progressing to raise your badge level and claim available rewards.")
                Text("Honor badges are awarded each Sunday at 00:00 UTC for activity in the previous week. They expire the following Sunday.")
            }
        },
        confirmButton = { TextButton(onClick = { rules = false }) { Text("Got it") } }
    )

    if (selected != null) {
        val isWorn = selected.id in worn
        AlertDialog(
            onDismissRequest = { selectedId = null },
            title = { Text(selected.title) },
            text = {
                Column(Modifier.heightIn(max = 340.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    BadgeArtwork(selected, Modifier.size(64.dp), locked = !selected.badgeUnlocked)
                    Text(selected.description)
                    if (selected.badgeKind == "HONOR") {
                        Text(if (selected.badgeUnlocked) "Valid until ${selected.expiresAt?.substringBefore('T').orEmpty()} (UTC)"
                        else "Awarded on Sundays for the previous week’s activity.")
                    } else {
                        if (selected.target > 0) {
                            Text("${selected.progress} / ${selected.target}", fontWeight = FontWeight.SemiBold)
                            LinearProgressIndicator(progress = { (selected.progress.toFloat() / selected.target).coerceIn(0f, 1f) }, modifier = Modifier.fillMaxWidth())
                        }
                        selected.tiers.forEach { tier ->
                            val state = when { tier.claimed -> "Claimed"; tier.reached -> "Reached"; else -> "Locked" }
                            val reward = achievementRewardLabel(tier)
                            Text("${badgeLevelLabel(tier.tier)} · ${tier.target} · $state", fontSize = 13.sp)
                            if (reward.isNotEmpty()) Text(reward, color = colors.textSecondary, fontSize = 12.sp)
                        }
                        if (selected.canClaim) TextButton(enabled = !saving && !loading, onClick = { claimReward(selected) }) {
                            Text("Claim ${badgeLevelLabel(selected.nextTier.orEmpty())} reward")
                        }
                        if (selected.highestClaimedTier != null) TextButton(enabled = !saving && !loading, onClick = { share(selected) }) {
                            Text("Share")
                        }
                    }
                    if (selected.badgeUnlocked && !isWorn && worn.size >= 3) Text("Remove a worn badge to free a slot.")
                }
            },
            confirmButton = {
                if (selected.badgeUnlocked) {
                    TextButton(enabled = !saving && !loading && (isWorn || worn.size < 3), onClick = {
                        setBadgeWorn(if (isWorn) worn - selected.id else worn + selected.id)
                    }) { Text(if (isWorn) "Unwear" else "Wear badge") }
                }
            },
            dismissButton = { TextButton(onClick = { selectedId = null }) { Text("Close") } }
        )
    }
}

@Composable
private fun BadgeShowcase(data: BadgeGallery, onEmptySlot: () -> Unit, onBadge: (String) -> Unit) {
    val shape = RoundedCornerShape(24.dp)
    val ink = Color(0xFF39261F)
    Column(
        modifier = Modifier.fillMaxWidth().background(Brush.linearGradient(listOf(Color(0xFFFFF4E9), Color(0xFFF0D5C2))), shape).padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Avatar(initial = data.name.take(1), size = 42, imageUrl = data.avatar)
            Column(Modifier.weight(1f)) {
                Text(data.name.ifBlank { "Your collection" }, color = ink, fontWeight = FontWeight.Bold, maxLines = 1)
                Text("${data.wornIds.size} of 3 badges worn", color = Color(0xFF6A5144), fontSize = 12.sp)
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            repeat(3) { slot ->
                val current = data.badges.firstOrNull { it.id == data.wornIds.getOrNull(slot) }
                Surface(
                    modifier = Modifier.weight(1f).height(90.dp).clickable(
                        onClickLabel = if (current != null) "Manage ${current.title}" else "Wear a badge"
                    ) {
                        if (current != null) onBadge(current.id) else onEmptySlot()
                    },
                    shape = RoundedCornerShape(16.dp), color = Color.White.copy(alpha = .64f)
                ) {
                    Column(Modifier.padding(6.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                        if (current == null) Icon(Icons.Filled.Add, contentDescription = null, modifier = Modifier.size(30.dp), tint = Color(0xFF986D59))
                        else BadgeArtwork(current, Modifier.size(38.dp))
                        Text(current?.title ?: "Add badge", color = ink, fontSize = 11.sp, maxLines = 1, modifier = Modifier.padding(top = 5.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun AchievementFilters(complete: Int, claimable: Int, categories: List<String>, selected: String?, onSelect: (String?) -> Unit) {
    val colors = LocalYugmColors.current
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text("$complete completed · $claimable ready to claim", color = colors.textSecondary, fontSize = 13.sp)
        if (categories.size > 1) {
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(selected = selected == null, onClick = { onSelect(null) }, label = { Text("All") })
                categories.forEach { category ->
                    FilterChip(selected = selected == category, onClick = { onSelect(category) }, label = { Text(badgeLevelLabel(category)) })
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun AchievementCard(
    badge: Achievement,
    worn: Boolean,
    busy: Boolean,
    onDetails: () -> Unit,
    onClaim: () -> Unit,
    onShare: () -> Unit
) {
    val colors = LocalYugmColors.current
    val reward = badge.tiers.firstOrNull { !it.claimed }?.let(::achievementRewardLabel).orEmpty()
    val progress = if (badge.target > 0) (badge.progress.toFloat() / badge.target).coerceIn(0f, 1f) else 0f
    val earnedLevel = badge.earnedBadgeTier?.let(::badgeLevelLabel)
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        color = colors.surfaceElevated,
        border = BorderStroke(1.dp, if (worn) colors.primary.copy(alpha = .5f) else colors.border)
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                Modifier.fillMaxWidth().clickable(onClickLabel = "View achievement and badge", onClick = onDetails),
                horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically
            ) {
                BadgeArtwork(badge, Modifier.size(50.dp), locked = !badge.badgeUnlocked)
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text(badge.title, color = colors.textPrimary, fontWeight = FontWeight.SemiBold)
                    Text(badge.description, color = colors.textSecondary, fontSize = 12.sp)
                }
                if (worn || earnedLevel != null) {
                    Text(if (worn) "Worn" else earnedLevel.orEmpty(), color = colors.primary, fontSize = 12.sp)
                }
            }
            if (badge.target > 0) {
                LinearProgressIndicator(progress = { progress }, modifier = Modifier.fillMaxWidth(), color = colors.primary, trackColor = colors.border)
                val tier = badge.nextTier?.let(::badgeLevelLabel)
                Text(
                    if (badge.complete) "All levels claimed" else "${badge.progress} / ${badge.target}${tier?.let { " · $it" }.orEmpty()}",
                    color = colors.textSecondary,
                    fontSize = 12.sp
                )
            }
            if (reward.isNotBlank()) Text("Reward: $reward", color = colors.textSecondary, fontSize = 12.sp)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                if (badge.canClaim) Button(enabled = !busy, onClick = onClaim) { Text("Claim reward") }
                TextButton(onClick = onDetails) { Text(if (badge.badgeUnlocked) "Badge details" else "View levels") }
                if (badge.highestClaimedTier != null) TextButton(onClick = onShare) { Text("Share") }
            }
        }
    }
}

private fun achievementRewardLabel(tier: AchievementTier): String = buildList {
    if (tier.rewardCoins > 0) add("${tier.rewardCoins} coins")
    if (tier.rewardCosmetic.isNotBlank()) add(cosmeticDisplayName(tier.rewardCosmetic))
}.joinToString(" + ")

@Composable
private fun BadgeTile(badge: Achievement, worn: Boolean, onClick: () -> Unit) {
    val colors = LocalYugmColors.current
    Surface(
        onClick = onClick, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(20.dp),
        color = colors.surfaceElevated, border = BorderStroke(1.dp, if (worn) colors.primary.copy(alpha = .5f) else colors.border)
    ) {
        Column(Modifier.padding(14.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
            BadgeArtwork(badge, Modifier.size(60.dp), locked = !badge.badgeUnlocked)
            Text(badge.title, color = colors.textPrimary, fontWeight = FontWeight.SemiBold, maxLines = 2, textAlign = TextAlign.Center)
            Text(
                when {
                    worn -> "Worn"
                    badge.badgeUnlocked -> badge.earnedBadgeTier?.let(::badgeLevelLabel) ?: "Earned"
                    else -> "Locked"
                },
                color = if (worn) colors.primary else colors.textSecondary, fontSize = 12.sp
            )
        }
    }
}

private fun badgeLevelLabel(tier: String) = tier.lowercase().replaceFirstChar { it.uppercase() }
