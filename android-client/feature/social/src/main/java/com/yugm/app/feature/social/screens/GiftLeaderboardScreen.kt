package com.yugm.app.feature.social.screens

import android.widget.Toast
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.yugm.app.core.model.GiftLeaderboardResponse
import com.yugm.app.core.model.LeaderboardEntry
import com.yugm.app.core.ui.components.Avatar
import com.yugm.app.core.ui.components.GlassCard
import com.yugm.app.core.ui.components.LoadingState
import com.yugm.app.core.ui.components.SegmentedTabs
import com.yugm.app.core.ui.components.YugmAmbientBackground
import com.yugm.app.core.ui.components.YugmPageHeader
import com.yugm.app.core.ui.theme.Background
import com.yugm.app.core.ui.theme.BorderColor
import com.yugm.app.feature.social.viewmodel.SocialViewModel
import com.yugm.app.core.ui.theme.Cyan
import com.yugm.app.core.ui.theme.Gold
import com.yugm.app.core.ui.theme.Pink
import com.yugm.app.core.ui.theme.PrimaryPurple
import com.yugm.app.core.ui.theme.SurfaceElevated
import com.yugm.app.core.ui.theme.TextMuted
import com.yugm.app.core.ui.theme.TextPrimary

@Composable
fun GiftLeaderboardScreen(
    token: String,
    onBack: () -> Unit
) {
    val viewModel: SocialViewModel = hiltViewModel()
    val context = LocalContext.current
    var selectedTab by remember { mutableStateOf(0) }
    var selectedBoard by remember { mutableStateOf(0) }
    var selectedPeriod by remember { mutableStateOf("all") }

    LaunchedEffect(token, selectedPeriod) { viewModel.loadLeaderboardHub(token, selectedPeriod) }

    YugmAmbientBackground {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 30.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                YugmPageHeader("Yugm", "Leaderboards", onBack = onBack)
            }
            item {
                SegmentedTabs(
                    items = listOf("✦" to "Gifts", "♛" to "Clans", "⚡" to "Hosts", "◈" to "Rooms"),
                    selectedIndex = selectedBoard,
                    onSelected = { selectedBoard = it },
                    modifier = Modifier.padding(horizontal = 20.dp)
                )
            }
            if (selectedBoard == 0) item {
                SegmentedTabs(
                    items = listOf("↗" to "Top Senders", "↙" to "Top Receivers"),
                    selectedIndex = selectedTab,
                    onSelected = { selectedTab = it },
                    modifier = Modifier.padding(horizontal = 20.dp)
                )
            }
            if (selectedBoard == 0) item {
                Row(
                    modifier = Modifier.padding(horizontal = 20.dp).fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    listOf("all" to "All Time", "monthly" to "Monthly", "weekly" to "Weekly").forEach { (value, label) ->
                        val active = selectedPeriod == value
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(12.dp))
                                .background(if (active) PrimaryPurple.copy(alpha = 0.26f) else SurfaceElevated)
                                .border(1.dp, if (active) Pink else BorderColor, RoundedCornerShape(12.dp))
                                .clickable { selectedPeriod = value }
                                .padding(horizontal = 14.dp, vertical = 8.dp)
                        ) {
                            Text(label, color = if (active) TextPrimary else TextMuted, fontSize = 12.sp, fontWeight = if (active) FontWeight.Bold else FontWeight.Normal)
                        }
                    }
                }
            }
            if (viewModel.isLoading) {
                item { Box(Modifier.padding(horizontal = 20.dp)) { LoadingState("Loading rankings...") } }
            } else when (selectedBoard) {
                0 -> {
                    val entries = if (selectedTab == 0) viewModel.leaderboard?.topSenders else viewModel.leaderboard?.topReceivers
                    if (entries.isNullOrEmpty()) item { EmptyLeaderboard("No gift activity for this period yet.") }
                    else itemsIndexed(entries) { index, entry -> LeaderboardRow(rank = index + 1, entry = entry) }
                }
                1 -> {
                    if (viewModel.clanRankings.isEmpty()) item { EmptyLeaderboard("Public clan rankings appear as members earn XP.") }
                    itemsIndexed(viewModel.clanRankings) { index, entry ->
                        Row(
                            Modifier.padding(horizontal = 20.dp).fillMaxWidth().clip(RoundedCornerShape(16.dp))
                                .background(if (index < 3) PrimaryPurple.copy(alpha = .12f) else SurfaceElevated)
                                .border(1.dp, if (index < 3) Gold.copy(alpha = .3f) else BorderColor, RoundedCornerShape(16.dp)).padding(13.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("#${entry.rank}", color = Gold, fontWeight = FontWeight.Black, modifier = Modifier.width(38.dp))
                            Column(Modifier.weight(1f)) {
                                Text(entry.name, color = TextPrimary, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Text("${entry.familyLabel} · ${entry.memberCount} members", color = TextMuted, fontSize = 11.sp)
                            }
                            Text("${entry.totalXp} XP", color = Gold, fontWeight = FontWeight.Black, fontSize = 12.sp)
                        }
                    }
                }
                2 -> {
                    if (viewModel.levelRankings.isEmpty()) item { EmptyLeaderboard("No host level rankings are available yet.") }
                    itemsIndexed(viewModel.levelRankings) { index, host -> HostRankingRow(index + 1, host) }
                }
                else -> {
                    val rooms = viewModel.roomRankings.topRooms
                    if (rooms.isEmpty()) item { EmptyLeaderboard("No live room rankings are available yet.") }
                    itemsIndexed(rooms) { index, room ->
                        Row(
                            Modifier.padding(horizontal = 20.dp).fillMaxWidth().clip(RoundedCornerShape(16.dp))
                                .background(if (index < 3) PrimaryPurple.copy(alpha = .12f) else SurfaceElevated)
                                .border(1.dp, if (index < 3) Gold.copy(alpha = .3f) else BorderColor, RoundedCornerShape(16.dp)).padding(13.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("#${index + 1}", color = Gold, fontWeight = FontWeight.Black, modifier = Modifier.width(38.dp))
                            Column(Modifier.weight(1f)) {
                                Text(room.title.ifBlank { "Live room" }, color = TextPrimary, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Text("${room.category.ifBlank { "Live" }} · ${room.participants} watching", color = TextMuted, fontSize = 11.sp)
                            }
                            room.host?.let { Avatar(it.name.firstOrNull()?.toString() ?: "?", 40, it.avatar, it.activeCosmetics) }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun EmptyLeaderboard(message: String) {
    Box(Modifier.padding(horizontal = 20.dp)) {
        GlassCard { Text(message, color = TextPrimary, fontWeight = FontWeight.Medium, fontSize = 13.sp) }
    }
}

@Composable
private fun HostRankingRow(rank: Int, host: com.yugm.app.core.model.Host) {
    Row(
        Modifier.padding(horizontal = 20.dp).fillMaxWidth().clip(RoundedCornerShape(16.dp))
            .background(if (rank <= 3) PrimaryPurple.copy(alpha = .12f) else SurfaceElevated)
            .border(1.dp, if (rank <= 3) Gold.copy(alpha = .3f) else BorderColor, RoundedCornerShape(16.dp)).padding(13.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text("#$rank", color = Gold, fontWeight = FontWeight.Black, modifier = Modifier.width(38.dp))
        Avatar(host.name.firstOrNull()?.toString() ?: "?", 42, host.avatar, host.activeCosmetics)
        Column(Modifier.weight(1f).padding(start = 10.dp)) {
            Text(host.name, color = TextPrimary, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(host.levelTitle.ifBlank { "Level ${host.level}" }, color = TextMuted, fontSize = 11.sp)
        }
        Text("${host.xp} XP", color = Gold, fontWeight = FontWeight.Black, fontSize = 12.sp)
    }
}

@Composable
private fun LeaderboardRow(rank: Int, entry: LeaderboardEntry) {
    val name = entry.user?.name ?: entry.user?.username ?: "Unknown"
    val avatarUrl = entry.user?.avatar

    Row(
        modifier = Modifier
            .padding(horizontal = 20.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(if (rank <= 3) PrimaryPurple.copy(alpha = 0.12f) else SurfaceElevated)
            .border(1.dp, if (rank <= 3) Gold.copy(alpha = 0.3f) else BorderColor, RoundedCornerShape(16.dp))
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier.size(36.dp),
            contentAlignment = Alignment.Center
        ) {
            if (rank <= 3) {
                Text(
                    when (rank) { 1 -> "1" 2 -> "2" else -> "3" },
                    color = Gold,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Black
                )
            } else {
                Text("$rank", color = TextMuted, fontSize = 14.sp, fontWeight = FontWeight.Bold)
            }
        }
        Spacer(Modifier.width(8.dp))
        Avatar(initial = name.firstOrNull()?.toString() ?: "?", size = 44, imageUrl = avatarUrl)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(name, color = TextPrimary, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text("${entry.giftCount} gifts", color = TextMuted, fontSize = 12.sp)
        }
        Spacer(Modifier.width(8.dp))
        Text("● ${entry.totalCoins}", color = Gold, fontWeight = FontWeight.Black, fontSize = 16.sp)
    }
}
