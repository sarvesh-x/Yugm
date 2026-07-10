package com.example.yugm.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.example.yugm.api.YugmApi
import com.example.yugm.model.Host
import com.example.yugm.model.Room
import com.example.yugm.ui.components.CategoryChips
import com.example.yugm.ui.components.GlassCard
import com.example.yugm.ui.components.HostRow
import com.example.yugm.ui.components.LoadingState
import com.example.yugm.ui.components.RoomCarousel
import com.example.yugm.ui.components.RoomCard
import com.example.yugm.ui.components.SearchBar
import com.example.yugm.ui.components.SectionTitle
import com.example.yugm.ui.theme.Gold
import com.example.yugm.ui.theme.Pink
import com.example.yugm.ui.theme.TextMuted
import com.example.yugm.ui.theme.TextPrimary
import com.example.yugm.ui.viewmodel.DiscoverViewModel
import kotlinx.coroutines.launch

@Composable
fun DiscoverScreen(
    token: String,
    onOpenRoom: (Room) -> Unit,
    onOpenProfile: (String) -> Unit,
    onCreateRoom: () -> Unit,
    onNotifications: () -> Unit,
    onSearch: () -> Unit,
    onGames: () -> Unit = {},
    viewModel: DiscoverViewModel = hiltViewModel()
) {
    LaunchedEffect(Unit) {
        viewModel.refreshHome(token)
    }
    val scope = rememberCoroutineScope()
    var busyHostId by remember { mutableStateOf("") }
    var suggestedHosts by remember(viewModel.home) { mutableStateOf(viewModel.home?.suggestedHosts ?: emptyList()) }

    LaunchedEffect(viewModel.home?.suggestedHosts) {
        suggestedHosts = viewModel.home?.suggestedHosts ?: emptyList()
    }

    LazyColumn(
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 18.dp, bottom = 104.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
        modifier = Modifier.fillMaxSize()
    ) {
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.weight(1f)) {
                    Text("Discover", color = TextPrimary, fontSize = 32.sp, fontWeight = FontWeight.Black)
                    Text("Find your tribe. Join live audio and video vibes.", color = TextMuted, modifier = Modifier.padding(top = 6.dp))
                }
                Button(onClick = onNotifications, colors = ButtonDefaults.buttonColors(containerColor = Gold)) {
                    Text("${viewModel.home?.unreadNotifications ?: 0}", color = Color.Black, fontWeight = FontWeight.Black)
                }
                Button(onClick = onGames, colors = ButtonDefaults.buttonColors(containerColor = Gold)) {
                    Text("Games", color = Color.Black, fontWeight = FontWeight.Black)
                }
                Button(onClick = onCreateRoom, colors = ButtonDefaults.buttonColors(containerColor = Pink)) {
                    Text("+", color = Color.White, fontWeight = FontWeight.Black, fontSize = 20.sp)
                }
            }
            SearchBar(onSearch = onSearch)
            CategoryChips()
        }

        if (viewModel.isLoading) {
            item { LoadingState("Fetching live rooms...") }
        } else {
            viewModel.home?.let { home ->
                item {
                    GlassCard(Modifier.fillMaxWidth()) {
                        Text("Creator OS", color = Gold, fontWeight = FontWeight.Black)
                        Text("Profile ${home.profileCompletion.percent}% / Level ${home.level.level} / ${home.achievements.count { it.complete }} missions done", color = TextPrimary, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 4.dp))
                    }
                }
            }

            if (viewModel.recommendedRooms.isNotEmpty()) {
                item { SectionTitle("Recommended") }
                item { RoomCarousel(viewModel.recommendedRooms, onOpenRoom) }
            }

            if (viewModel.scheduledRooms.isNotEmpty()) {
                item { SectionTitle("Scheduled rooms") }
                items(viewModel.scheduledRooms.take(4), key = { "scheduled-${it.id}" }) { room ->
                    RoomCard(room = room, wide = true, onClick = { onOpenRoom(room) })
                }
            }

            if (suggestedHosts.isNotEmpty()) {
                item { SectionTitle("Trending hosts") }
                items(suggestedHosts.take(6), key = { "host-${it.id}" }) { host ->
                    HostRow(
                        host = host,
                        onClick = { onOpenProfile(it.id) },
                        onFollow = { hostId ->
                            if (token.isBlank() || busyHostId.isNotBlank()) return@HostRow
                            busyHostId = hostId
                            scope.launch {
                                runCatching {
                                    if (host.isFollowing) YugmApi.unfollowUser(token, hostId) else YugmApi.followUser(token, hostId)
                                }.onSuccess {
                                    suggestedHosts = suggestedHosts.map {
                                        if (it.id == hostId) it.copy(isFollowing = !it.isFollowing) else it
                                    }
                                }
                                busyHostId = ""
                            }
                        }
                    )
                }
            }

            item { SectionTitle("Trending now") }
            items(viewModel.rooms, key = { it.id }) { room ->
                RoomCard(room = room, wide = true, onClick = { onOpenRoom(room) })
            }
        }
    }
}
