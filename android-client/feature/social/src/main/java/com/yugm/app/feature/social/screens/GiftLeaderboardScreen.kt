package com.yugm.app.feature.social.screens

import com.yugm.app.core.api.SyncTopic
import com.yugm.app.core.ui.components.AutomaticSyncEffect
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
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

    AutomaticSyncEffect(token, selectedPeriod, topics = setOf(SyncTopic.GIFTS), enabled = token.isNotBlank(), isBusy = { viewModel.isLoading }) { viewModel.loadLeaderboardHub(token, selectedPeriod) }

    YugmAmbientBackground {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 30.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                YugmPageHeader("Yugm", "Leaderboards", onBack = onBack)
            }
            item { LeaderboardIntroCard() }
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
            if (viewModel.isLoading && (viewModel.leaderboard == null)) {
                item { Box(Modifier.padding(horizontal = 20.dp)) { LoadingState("Loading rankings...") } }
            } else when (selectedBoard) {
                0 -> {
                    val entries = if (selectedTab == 0) viewModel.leaderboard?.topSenders else viewModel.leaderboard?.topReceivers
                    if (entries.isNullOrEmpty()) item { EmptyLeaderboard("No gift activity for this period yet.") }
                    else {
                        item { GiftPodiumCard(if (selectedTab == 0) "Top Users" else "Top Hosts", entries.take(3)) }
                        itemsIndexed(entries.drop(3)) { index, entry -> LeaderboardRow(rank = index + 4, entry = entry) }
                    }
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
                    else {
                        item { HostPodiumCard(viewModel.levelRankings.take(3)) }
                        itemsIndexed(viewModel.levelRankings.drop(3)) { index, host -> HostRankingRow(index + 4, host) }
                    }
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
                            room.host?.let { Avatar(it.name.firstOrNull()?.toString() ?: "?", 40, it.avatar, it.activeCosmetics, avatarType = it.avatarType, avatarParts = it.avatarParts) }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LeaderboardIntroCard() {
    Row(
        Modifier.padding(horizontal = 20.dp).fillMaxWidth().clip(RoundedCornerShape(20.dp))
            .background(Brush.horizontalGradient(listOf(Color(0xFF321827), Color(0xFF542239))))
            .border(1.dp, Pink.copy(alpha = .24f), RoundedCornerShape(20.dp)).padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(Modifier.weight(1f)) {
            Text("Top List", color = TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Black)
            Text("Celebrate this month’s standout users, hosts, rooms, and clans.", color = TextMuted, fontSize = 12.sp, lineHeight = 17.sp, modifier = Modifier.padding(top = 4.dp))
        }
        Text("🏆", fontSize = 38.sp, modifier = Modifier.padding(start = 8.dp))
    }
}

@Composable
private fun GiftPodiumCard(title: String, entries: List<LeaderboardEntry>) {
    if (entries.isEmpty()) return
    Column(
        Modifier.padding(horizontal = 20.dp).fillMaxWidth().clip(RoundedCornerShape(22.dp))
            .background(Brush.verticalGradient(listOf(Color(0xFF54223B), Color(0xFF291A2C))))
            .border(1.dp, Pink.copy(alpha = .28f), RoundedCornerShape(22.dp)).padding(14.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("🎁", fontSize = 20.sp)
            Text(title, color = TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Black, modifier = Modifier.weight(1f).padding(start = 8.dp))
            Text("TOP 3", color = Color(0xFFFFC857), fontSize = 9.sp, fontWeight = FontWeight.Black)
        }
        Spacer(Modifier.height(18.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.Bottom) {
            if (entries.size > 1) PodiumGiftEntry(entries[1], 2, Modifier.weight(1f), 56)
            PodiumGiftEntry(entries[0], 1, Modifier.weight(1.15f), 74)
            if (entries.size > 2) PodiumGiftEntry(entries[2], 3, Modifier.weight(1f), 56)
        }
    }
}

@Composable
private fun PodiumGiftEntry(entry: LeaderboardEntry, rank: Int, modifier: Modifier, avatarSize: Int) {
    val name = entry.user?.name ?: entry.user?.username ?: "User"
    val accent = when (rank) { 1 -> Color(0xFFFFC857); 2 -> Color(0xFFC7CAD6); else -> Color(0xFFD89462) }
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(if (rank == 1) "👑" else "✦", fontSize = if (rank == 1) 18.sp else 14.sp, color = accent)
        Box(Modifier.padding(top = 3.dp).border(2.dp, accent, CircleShape).padding(3.dp)) {
            Avatar(name.firstOrNull()?.toString() ?: "?", avatarSize, entry.user?.avatar, avatarType = entry.user?.avatarType, avatarParts = entry.user?.avatarParts)
        }
        Text(name, color = TextPrimary, fontSize = 11.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 6.dp))
        Text("${entry.totalCoins} coins", color = accent, fontSize = 10.sp, fontWeight = FontWeight.Bold, maxLines = 1)
        Text("${entry.giftCount} gifts", color = TextMuted, fontSize = 9.sp)
        Box(
            Modifier.fillMaxWidth().padding(top = 7.dp).height(if (rank == 1) 38.dp else 28.dp)
                .clip(RoundedCornerShape(topStart = 9.dp, topEnd = 9.dp))
                .background(Brush.verticalGradient(listOf(accent.copy(alpha = .78f), accent.copy(alpha = .18f)))),
            contentAlignment = Alignment.Center
        ) { Text("$rank", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Black) }
    }
}

@Composable
private fun HostPodiumCard(hosts: List<com.yugm.app.core.model.Host>) {
    if (hosts.isEmpty()) return
    Column(
        Modifier.padding(horizontal = 20.dp).fillMaxWidth().clip(RoundedCornerShape(22.dp))
            .background(Brush.verticalGradient(listOf(Color(0xFF4A391B), Color(0xFF261E20))))
            .border(1.dp, Gold.copy(alpha = .28f), RoundedCornerShape(22.dp)).padding(14.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("🎙️", fontSize = 20.sp)
            Text("Top Hosts", color = TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Black, modifier = Modifier.weight(1f).padding(start = 8.dp))
            Text("TOP 3", color = Gold, fontSize = 9.sp, fontWeight = FontWeight.Black)
        }
        Spacer(Modifier.height(18.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.Bottom) {
            if (hosts.size > 1) PodiumHostEntry(hosts[1], 2, Modifier.weight(1f), 56)
            PodiumHostEntry(hosts[0], 1, Modifier.weight(1.15f), 74)
            if (hosts.size > 2) PodiumHostEntry(hosts[2], 3, Modifier.weight(1f), 56)
        }
    }
}

@Composable
private fun PodiumHostEntry(host: com.yugm.app.core.model.Host, rank: Int, modifier: Modifier, avatarSize: Int) {
    val accent = when (rank) { 1 -> Color(0xFFFFC857); 2 -> Color(0xFFC7CAD6); else -> Color(0xFFD89462) }
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(if (rank == 1) "👑" else "✦", fontSize = if (rank == 1) 18.sp else 14.sp)
        Box(Modifier.padding(top = 3.dp).border(2.dp, accent, CircleShape).padding(3.dp)) {
            Avatar(host.name.firstOrNull()?.toString() ?: "?", avatarSize, host.avatar, host.activeCosmetics, avatarType = host.avatarType, avatarParts = host.avatarParts)
        }
        Text(host.name, color = TextPrimary, fontSize = 11.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 6.dp))
        Text("${host.xp} XP", color = accent, fontSize = 10.sp, fontWeight = FontWeight.Bold, maxLines = 1)
        Text(host.levelTitle.ifBlank { "Level ${host.level}" }, color = TextMuted, fontSize = 9.sp, maxLines = 1)
        Box(Modifier.fillMaxWidth().padding(top = 7.dp).height(if (rank == 1) 38.dp else 28.dp).clip(RoundedCornerShape(topStart = 9.dp, topEnd = 9.dp)).background(Brush.verticalGradient(listOf(accent.copy(alpha = .78f), accent.copy(alpha = .18f)))), contentAlignment = Alignment.Center) {
            Text("$rank", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Black)
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
        Avatar(host.name.firstOrNull()?.toString() ?: "?", 42, host.avatar, host.activeCosmetics, avatarType = host.avatarType, avatarParts = host.avatarParts)
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
        Avatar(initial = name.firstOrNull()?.toString() ?: "?", size = 44, imageUrl = avatarUrl, avatarType = entry.user?.avatarType, avatarParts = entry.user?.avatarParts)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(name, color = TextPrimary, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text("${entry.giftCount} gifts", color = TextMuted, fontSize = 12.sp)
        }
        Spacer(Modifier.width(8.dp))
        Text("● ${entry.totalCoins}", color = Gold, fontWeight = FontWeight.Black, fontSize = 16.sp)
    }
}
