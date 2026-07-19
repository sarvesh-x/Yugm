package com.example.yugm.ui.screens

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
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.api.YugmApi
import com.example.yugm.model.GiftLeaderboardResponse
import com.example.yugm.model.LeaderboardEntry
import com.example.yugm.ui.components.Avatar
import com.example.yugm.ui.components.GlassCard
import com.example.yugm.ui.components.LoadingState
import com.example.yugm.ui.components.SegmentedTabs
import com.example.yugm.ui.components.YugmAmbientBackground
import com.example.yugm.ui.components.YugmPageHeader
import com.example.yugm.ui.theme.Background
import kotlinx.coroutines.launch
import com.example.yugm.ui.theme.BorderColor
import com.example.yugm.ui.theme.Cyan
import com.example.yugm.ui.theme.Gold
import com.example.yugm.ui.theme.Pink
import com.example.yugm.ui.theme.PrimaryPurple
import com.example.yugm.ui.theme.SurfaceElevated
import com.example.yugm.ui.theme.TextMuted
import com.example.yugm.ui.theme.TextPrimary

@Composable
fun GiftLeaderboardScreen(
    token: String,
    onBack: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    var selectedTab by remember { mutableStateOf(0) }
    var selectedPeriod by remember { mutableStateOf("all") }
    var loading by remember { mutableStateOf(true) }
    var response by remember { mutableStateOf<GiftLeaderboardResponse?>(null) }

    fun load() {
        scope.launch {
            loading = true
            runCatching { YugmApi.giftLeaderboard(token, selectedPeriod) }
                .onSuccess { response = it }
                .onFailure { Toast.makeText(context, it.message ?: "Failed to load", Toast.LENGTH_SHORT).show() }
            loading = false
        }
    }

    LaunchedEffect(token, selectedPeriod) { load() }

    YugmAmbientBackground {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 30.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                YugmPageHeader("Gift Leaderboard", onBack = onBack)
            }
            item {
                SegmentedTabs(
                    items = listOf("" to "Top Senders", "" to "Top Receivers"),
                    selectedIndex = selectedTab,
                    onSelected = { selectedTab = it },
                    modifier = Modifier.padding(horizontal = 20.dp)
                )
            }
            item {
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
            if (loading) {
                item { Box(Modifier.padding(horizontal = 20.dp)) { LoadingState("Loading leaderboard...") } }
            } else {
                val entries = if (selectedTab == 0) response?.topSenders else response?.topReceivers
                if (entries.isNullOrEmpty()) {
                    item {
                        Box(Modifier.padding(horizontal = 20.dp)) {
                            GlassCard {
                                Text("No entries yet.", color = TextPrimary, fontWeight = FontWeight.Black)
                            }
                        }
                    }
                } else {
                    itemsIndexed(entries) { index, entry ->
                        LeaderboardRow(rank = index + 1, entry = entry)
                    }
                }
            }
        }
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
