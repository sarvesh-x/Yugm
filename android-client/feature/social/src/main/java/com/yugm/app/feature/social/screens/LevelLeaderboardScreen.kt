package com.yugm.app.feature.social.screens

import com.yugm.app.core.api.SyncTopic
import com.yugm.app.core.ui.components.AutomaticSyncEffect
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yugm.app.core.api.YugmApi
import com.yugm.app.core.model.LevelLeaderboardEntry
import com.yugm.app.core.model.LevelLeaderboardPage
import com.yugm.app.core.ui.components.Avatar
import com.yugm.app.core.ui.theme.LocalYugmColors
import kotlinx.coroutines.launch

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun LevelLeaderboardScreen(
    token: String,
    onBack: () -> Unit,
    onOpenProfile: (String) -> Unit
) {
    val colors = LocalYugmColors.current
    val scope = rememberCoroutineScope()
    val entries = remember { mutableStateListOf<LevelLeaderboardEntry>() }
    var pageInfo by remember { mutableStateOf(LevelLeaderboardPage()) }
    var loading by remember { mutableStateOf(true) }
    var loadingMore by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    fun refresh() {
        scope.launch {
            loading = true
            error = null
            runCatching {
                (1..pageInfo.page.coerceAtLeast(1)).map { page -> YugmApi.levelLeaderboardPage(token, page = page, pageSize = pageInfo.pageSize) }
            }.onSuccess { pages ->
                    entries.clear()
                    entries.addAll(pages.flatMap { it.entries }.distinctBy { it.user.id })
                    pageInfo = pages.last()
                }
                .onFailure { error = it.message ?: "Could not load the leaderboard" }
            loading = false
        }
    }

    fun loadMore() {
        if (loadingMore || !pageInfo.hasMore) return
        scope.launch {
            loadingMore = true
            error = null
            runCatching { YugmApi.levelLeaderboardPage(token, page = pageInfo.page + 1, pageSize = pageInfo.pageSize) }
                .onSuccess { result ->
                    val knownIds = entries.mapTo(mutableSetOf()) { it.user.id }
                    entries.addAll(result.entries.filter { it.user.id !in knownIds })
                    pageInfo = result
                }
                .onFailure { error = it.message ?: "Could not load more ranks" }
            loadingMore = false
        }
    }

    AutomaticSyncEffect(token, topics = setOf(SyncTopic.TASKS), enabled = token.isNotBlank(), isBusy = { loading }) { refresh() }

    Scaffold(
        containerColor = colors.background,
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Level leaderboard", color = colors.textPrimary, fontWeight = FontWeight.Bold)
                        Text("All time · ranked by level and XP", color = colors.textSecondary, fontSize = 11.sp)
                    }
                },
                navigationIcon = { TextButton(onClick = onBack) { Text("‹", color = colors.textPrimary, fontSize = 28.sp) } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = colors.background)
            )
        }
    ) { padding ->
        when {
            loading && entries.isEmpty() -> Column(
                Modifier.fillMaxSize().padding(padding),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) { CircularProgressIndicator(color = colors.primary) }

            entries.isEmpty() -> Column(
                Modifier.fillMaxSize().padding(padding).padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Text(error ?: "No rankings yet", color = colors.textPrimary, fontWeight = FontWeight.Bold)
                Text("Earn XP through your daily activity to appear here.", color = colors.textSecondary, fontSize = 12.sp, modifier = Modifier.padding(top = 6.dp))
                Button(onClick = ::refresh, modifier = Modifier.padding(top = 14.dp)) { Text("Try again") }
            }

            else -> LazyColumn(
                modifier = Modifier.fillMaxSize().padding(padding),
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 10.dp, bottom = 28.dp),
                verticalArrangement = Arrangement.spacedBy(9.dp)
            ) {
                item {
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(20.dp),
                        color = colors.surfaceElevated,
                        border = BorderStroke(1.dp, colors.border)
                    ) {
                        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text("Your position", color = colors.textSecondary, fontSize = 11.sp)
                                Text(pageInfo.requesterRank?.let { "#$it" } ?: "—", color = colors.primary, fontSize = 27.sp, fontWeight = FontWeight.Black)
                            }
                            Column(horizontalAlignment = Alignment.End) {
                                Text("${pageInfo.total}", color = colors.textPrimary, fontWeight = FontWeight.Bold)
                                Text("players ranked", color = colors.textSecondary, fontSize = 11.sp)
                            }
                        }
                    }
                }
                item { Text("Top players", color = colors.textPrimary, fontWeight = FontWeight.Black, fontSize = 17.sp, modifier = Modifier.padding(top = 5.dp, bottom = 2.dp)) }
                items(entries, key = { it.user.id.ifBlank { "rank-${it.rank}" } }) { entry ->
                    val isRequester = entry.user.id == pageInfo.requesterId
                    Surface(
                        modifier = Modifier.fillMaxWidth().clickable(enabled = entry.user.id.isNotBlank()) { onOpenProfile(entry.user.id) },
                        shape = RoundedCornerShape(18.dp),
                        color = if (isRequester) colors.primary.copy(alpha = .10f) else colors.surface,
                        border = BorderStroke(1.dp, if (isRequester) colors.primary.copy(alpha = .42f) else colors.border)
                    ) {
                        Row(
                            Modifier.padding(horizontal = 13.dp, vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(11.dp)
                        ) {
                            Text(
                                when (entry.rank) { 1 -> "🥇"; 2 -> "🥈"; 3 -> "🥉"; else -> "#${entry.rank}" },
                                color = colors.primary,
                                fontSize = if (entry.rank <= 3) 21.sp else 12.sp,
                                fontWeight = FontWeight.Black,
                                modifier = Modifier.then(if (entry.rank <= 3) Modifier.size(30.dp) else Modifier)
                            )
                            Avatar(
                                initial = entry.user.name.firstOrNull()?.toString() ?: "?",
                                size = 43,
                                imageUrl = entry.user.avatar,
                                cosmetics = entry.user.activeCosmetics
                            )
                            Column(Modifier.weight(1f)) {
                                Text(entry.user.name.ifBlank { "Yugm member" }, color = colors.textPrimary, fontWeight = FontWeight.Bold, maxLines = 1)
                                Text("@${entry.user.username} · ${entry.user.levelTitle}", color = colors.textSecondary, fontSize = 11.sp, maxLines = 1)
                            }
                            Column(horizontalAlignment = Alignment.End) {
                                Text("LV ${entry.user.level}", color = colors.primary, fontWeight = FontWeight.Black, fontSize = 12.sp)
                                Text("${entry.user.xp} XP", color = colors.textSecondary, fontSize = 10.sp)
                            }
                        }
                    }
                }
                error?.let { message -> item { Text(message, color = colors.danger, fontSize = 12.sp, modifier = Modifier.padding(vertical = 4.dp)) } }
                if (pageInfo.hasMore) item {
                    Button(onClick = ::loadMore, enabled = !loadingMore, modifier = Modifier.fillMaxWidth().padding(top = 4.dp)) {
                        if (loadingMore) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp, color = colors.primaryOn)
                        else Text("Load more · ${entries.size} of ${pageInfo.total}")
                    }
                }
            }
        }
    }
}
