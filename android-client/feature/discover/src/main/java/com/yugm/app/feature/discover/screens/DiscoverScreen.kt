package com.yugm.app.feature.discover.screens

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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.ui.layout.ContentScale
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.selected as selectedSemantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import coil.compose.AsyncImage
import com.yugm.app.core.model.Room
import com.yugm.app.core.model.RoomType
import com.yugm.app.core.ui.components.Avatar
import com.yugm.app.core.ui.components.YugmBottomDock
import com.yugm.app.core.ui.components.YugmDockTab
import com.yugm.app.core.ui.theme.Background
import com.yugm.app.core.ui.theme.BorderColor
import com.yugm.app.core.ui.theme.Danger
import com.yugm.app.core.ui.theme.Pink
import com.yugm.app.core.ui.theme.PrimaryPurple
import com.yugm.app.core.ui.theme.Success
import com.yugm.app.core.ui.theme.SurfaceElevated
import com.yugm.app.core.ui.theme.TextMuted
import com.yugm.app.core.ui.theme.TextPrimary
import com.yugm.app.feature.discover.viewmodel.DiscoverViewModel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private data class DiscoveryFilter(val label: String, val icon: ImageVector)

private val discoveryFilters = listOf(
    DiscoveryFilter("Trending", Icons.Filled.LocalFireDepartment),
    DiscoveryFilter("Nearby", Icons.Filled.LocationOn),
    DiscoveryFilter("Voice", Icons.Filled.Mic),
    DiscoveryFilter("Video", Icons.Filled.Videocam),
    DiscoveryFilter("Music", Icons.Filled.MusicNote)
)

@Composable
fun DiscoverScreen(
    token: String,
    onOpenRoom: (Room) -> Unit,
    onOpenProfile: (String) -> Unit,
    onCreateRoom: () -> Unit,
    onNotifications: () -> Unit,
    onSearch: () -> Unit,
    onGames: () -> Unit = {},
    onEvents: () -> Unit = {},
    onDating: () -> Unit = {},
    onChat: () -> Unit = {},
    onWallet: () -> Unit = {},
    onSelfProfile: () -> Unit = {},
    onVoiceRooms: () -> Unit = {},
    onJoinParty: (Room) -> Unit = onOpenRoom,
    onOpenMatchedCall: (Room) -> Unit = onJoinParty,
    onVibeGraph: () -> Unit = {},
    onCreatorDashboard: () -> Unit = {},
    onLeaderboards: () -> Unit = {},
    onClans: () -> Unit = {},
    showBottomDock: Boolean = true,
    viewModel: DiscoverViewModel = hiltViewModel()
) {
    com.yugm.app.core.ui.components.AutomaticSyncEffect(token, topics = setOf(com.yugm.app.core.api.SyncTopic.ROOMS, com.yugm.app.core.api.SyncTopic.NOTIFICATIONS, com.yugm.app.core.api.SyncTopic.PROFILE), enabled = token.isNotBlank(), isBusy = { viewModel.isLoading }) {
        if (token.isNotBlank()) viewModel.refreshHome(token)
    }

    val rooms = remember(viewModel.recommendedRooms, viewModel.rooms) {
        (viewModel.recommendedRooms + viewModel.rooms).distinctBy(Room::id)
    }
    val onlineHosts = viewModel.home?.suggestedHosts.orEmpty().filter { it.isOnline }
    val currentCity = viewModel.home?.city.orEmpty()
    var selectedFilter by rememberSaveable { mutableStateOf("Trending") }
    var friendSearchOpen by remember { mutableStateOf(false) }
    var friendSearchError by remember { mutableStateOf<String?>(null) }
    var joiningParty by remember { mutableStateOf(false) }
    val context = androidx.compose.ui.platform.LocalContext.current
    val scope = rememberCoroutineScope()
    val visibleRooms = remember(rooms, selectedFilter, currentCity) {
        filterDiscoveryRooms(rooms, selectedFilter, currentCity)
    }

    LaunchedEffect(friendSearchOpen, token) {
        if (!friendSearchOpen) return@LaunchedEffect
        friendSearchError = null
        try {
            val deadline = System.currentTimeMillis() + 90_000
            var match = viewModel.searchRandomFriend(token)
            while (friendSearchOpen && match == null && System.currentTimeMillis() < deadline) {
                delay(2_000)
                match = viewModel.randomFriendMatch(token)
            }
            if (friendSearchOpen && match != null) {
                friendSearchOpen = false
                onOpenMatchedCall(match)
            } else if (friendSearchOpen) {
                viewModel.cancelRandomFriendSearch(token)
                friendSearchError = "No one joined the search yet. Try again in a little while."
            }
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (error: Exception) {
            friendSearchError = error.message ?: "Could not find a friend right now. Please try again."
        }
    }

    Box(Modifier.fillMaxSize().background(Background)) {
        Box(modifier = Modifier.fillMaxSize()) {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(top = 8.dp, bottom = if (showBottomDock) 120.dp else 32.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                item {
                    DiscoverHero(
                        onlineCount = viewModel.totalOnlineCount,
                        unreadCount = viewModel.home?.unreadNotifications ?: 0,
                        onSearch = onSearch,
                        onNotifications = onNotifications,
                        onOnline = { onlineHosts.firstOrNull()?.let { onOpenProfile(it.id) } ?: onSearch() }
                    )
                }
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 18.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        DiscoverActionCard(
                            title = "Find Friends",
                            subtitle = "Meet someone new",
                            icon = Icons.Filled.Call,
                            colors = listOf(Color(0xFF7138E9), Color(0xFF9D32DC)),
                            modifier = Modifier.weight(1f),
                            onClick = { friendSearchOpen = true }
                        )
                        DiscoverActionCard(
                            title = "Join Party",
                            subtitle = if (joiningParty) "Finding a live room…" else "Join a live conversation",
                            icon = Icons.Filled.Groups,
                            colors = listOf(Color(0xFFED2FA7), Color(0xFFC42084)),
                            loading = joiningParty,
                            modifier = Modifier.weight(1f),
                            onClick = {
                                if (!joiningParty) scope.launch {
                                    joiningParty = true
                                    try {
                                        val room = viewModel.randomLivePublicRoom()
                                        if (room == null) {
                                            Toast.makeText(context, "No joinable public rooms are live right now. Try again soon.", Toast.LENGTH_SHORT).show()
                                        } else {
                                            onJoinParty(room)
                                        }
                                    } catch (error: Exception) {
                                        Toast.makeText(context, error.message ?: "Could not join a party.", Toast.LENGTH_SHORT).show()
                                    } finally {
                                        joiningParty = false
                                    }
                                }
                            }
                        )
                    }
                }
                item {
                    DiscoverSectionHeading(
                        title = if (selectedFilter == "Trending") "Recommended" else selectedFilter,
                        subtitle = when (selectedFilter) {
                            "Nearby" -> if (currentCity.isBlank()) "Add your city to see rooms near you" else "Live rooms in $currentCity"
                            else -> "Live rooms picked for you"
                        }
                    )
                }
                item {
                    FilterRail(selected = selectedFilter, onSelected = { selectedFilter = it })
                }
                if (viewModel.isLoading && rooms.isEmpty()) {
                    item { DiscoverLoadingState() }
                } else if (visibleRooms.isEmpty()) {
                    item {
                        EmptyRecommendations(
                            filter = selectedFilter,
                            hasCity = currentCity.isNotBlank(),
                            error = viewModel.error,
                            onAddCity = onSelfProfile,
                            onCreateRoom = onCreateRoom,
                            onRetry = { viewModel.refreshHome(token) }
                        )
                    }
                } else {
                    items(visibleRooms.take(12), key = { "discover-room-${it.id}" }) { room ->
                        RecommendedRoomCard(
                            room = room,
                            onOpen = { onOpenRoom(room) },
                            onJoin = { onJoinParty(room) }
                        )
                    }
                }
            }
        }

        if (showBottomDock) {
            YugmBottomDock(
                modifier = Modifier.align(Alignment.BottomCenter),
                selected = YugmDockTab.DISCOVER,
                onDiscover = {},
                onCreate = onCreateRoom,
                onLive = onVoiceRooms,
                onChat = onChat,
                onWallet = onWallet,
                onProfile = onSelfProfile,
                onGameZone = onGames
            )
        }
    }

    if (friendSearchOpen) {
        AlertDialog(
            onDismissRequest = {
                friendSearchOpen = false
                scope.launch { runCatching { viewModel.cancelRandomFriendSearch(token) } }
            },
            title = { Text("Find a friend", fontWeight = FontWeight.Black) },
            text = {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    Text(friendSearchError ?: "We’re finding someone who is looking for a private voice call too.", color = TextMuted)
                    if (friendSearchError == null) CircularProgressIndicator(color = PrimaryPurple)
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    friendSearchOpen = false
                    scope.launch { runCatching { viewModel.cancelRandomFriendSearch(token) } }
                }) { Text("Cancel search") }
            },
            containerColor = SurfaceElevated
        )
    }
}

private fun filterDiscoveryRooms(rooms: List<Room>, filter: String, city: String): List<Room> = when (filter) {
    "Voice" -> rooms.filter { it.type == RoomType.Voice }
    "Video" -> rooms.filter { it.type == RoomType.Video }
    "Music" -> rooms.filter { room ->
        listOf(room.title, room.description, room.category, room.tags.joinToString(" "))
            .any { it.contains("music", ignoreCase = true) }
    }
    "Nearby" -> if (city.isBlank()) emptyList() else rooms.filter { room ->
        room.host?.city?.equals(city.trim(), ignoreCase = true) == true
    }
    else -> rooms.sortedByDescending { it.participants }
}

@Composable
private fun DiscoverHero(
    onlineCount: Int,
    unreadCount: Int,
    onSearch: () -> Unit,
    onNotifications: () -> Unit,
    onOnline: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 14.dp)
            .heightIn(min = 238.dp)
            .shadow(16.dp, RoundedCornerShape(30.dp), ambientColor = PrimaryPurple.copy(alpha = 0.25f))
            .clip(RoundedCornerShape(30.dp))
            .background(Brush.linearGradient(listOf(Color(0xFF7139E8), Color(0xFF8525C9), Color(0xFFD92BA4))))
    ) {
        Box(
            Modifier.align(Alignment.TopEnd).size(190.dp).offset(x = 46.dp, y = (-55).dp)
                .clip(CircleShape).background(Color.White.copy(alpha = 0.08f))
        )
        Box(
            Modifier.align(Alignment.BottomStart).size(150.dp).offset(x = (-50).dp, y = 68.dp)
                .clip(CircleShape).background(Color(0xFFFF69C7).copy(alpha = 0.18f))
        )
        Column(Modifier.fillMaxWidth().padding(18.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier.size(44.dp).clip(RoundedCornerShape(14.dp))
                        .background(Brush.linearGradient(listOf(Color(0xFFFF5F84), Color(0xFFAA35F4)))),
                    contentAlignment = Alignment.Center
                ) {
                    Text("Y", color = Color.White, fontSize = 26.sp, fontWeight = FontWeight.Black)
                }
                Text(
                    "Yugm",
                    color = Color.White,
                    fontSize = 25.sp,
                    fontWeight = FontWeight.Black,
                    modifier = Modifier.padding(start = 10.dp)
                )
                Spacer(Modifier.weight(1f))
                DiscoverHeaderAction(Icons.Filled.Search, "Search", onSearch)
                Spacer(Modifier.width(9.dp))
                DiscoverHeaderAction(Icons.Filled.Notifications, "Notifications", onNotifications, unreadCount)
            }
            Spacer(Modifier.height(18.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(
                        "Find your people.",
                        color = Color.White,
                        fontSize = 28.sp,
                        lineHeight = 32.sp,
                        fontWeight = FontWeight.Black,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        "Make new connections, every day.",
                        color = Color.White.copy(alpha = 0.88f),
                        fontSize = 14.sp,
                        lineHeight = 19.sp,
                        modifier = Modifier.padding(top = 7.dp),
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                ConversationIllustration()
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Start) {
                Row(
                    modifier = Modifier
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.18f))
                        .border(1.dp, Color.White.copy(alpha = 0.28f), CircleShape)
                        .clickable(role = Role.Button, onClickLabel = "View online people", onClick = onOnline)
                        .semantics(mergeDescendants = true) { contentDescription = "$onlineCount people online" }
                        .padding(horizontal = 13.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Box(Modifier.size(10.dp).clip(CircleShape).background(Color(0xFF43E78C)))
                    Text("$onlineCount online", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun DiscoverHeaderAction(icon: ImageVector, label: String, onClick: () -> Unit, badge: Int = 0) {
    Box(
        Modifier
            .semantics(mergeDescendants = true) {
                contentDescription = if (badge > 0) "$label, $badge unread" else label
            }
            .clickable(role = Role.Button, onClickLabel = label, onClick = onClick)
    ) {
        Box(
            Modifier.size(48.dp).clip(RoundedCornerShape(16.dp))
                .background(Color.White.copy(alpha = 0.18f))
                .border(1.dp, Color.White.copy(alpha = 0.26f), RoundedCornerShape(16.dp)),
            contentAlignment = Alignment.Center
        ) {
            Icon(icon, contentDescription = null, tint = Color.White, modifier = Modifier.size(23.dp))
        }
        if (badge > 0) {
            Box(
                Modifier.align(Alignment.TopEnd).offset(x = 4.dp, y = (-4).dp)
                    .widthIn(min = 19.dp).heightIn(min = 19.dp)
                    .clip(CircleShape).background(Danger).border(1.5.dp, Color(0xFF7139E8), CircleShape)
                    .padding(horizontal = 4.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(if (badge > 99) "99+" else badge.toString(), color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.Black, maxLines = 1)
            }
        }
    }
}

@Composable
private fun ConversationIllustration() {
    Box(Modifier.size(width = 124.dp, height = 112.dp)) {
        Box(
            Modifier.align(Alignment.TopStart).size(width = 88.dp, height = 66.dp)
                .clip(RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp, bottomEnd = 24.dp, bottomStart = 7.dp))
                .background(Color.White.copy(alpha = 0.3f))
                .border(1.dp, Color.White.copy(alpha = 0.55f), RoundedCornerShape(24.dp)),
            contentAlignment = Alignment.Center
        ) { BubbleDots() }
        Box(
            Modifier.align(Alignment.BottomEnd).size(width = 88.dp, height = 62.dp)
                .clip(RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp, bottomStart = 22.dp, bottomEnd = 7.dp))
                .background(Color(0xFFFF82D1).copy(alpha = 0.5f))
                .border(1.dp, Color.White.copy(alpha = 0.5f), RoundedCornerShape(22.dp)),
            contentAlignment = Alignment.Center
        ) { BubbleDots(dotColor = Color.White.copy(alpha = 0.8f)) }
        Text("✦", modifier = Modifier.align(Alignment.TopEnd).offset(y = (-4).dp), color = Color(0xFFFFE795), fontSize = 28.sp)
    }
}

@Composable
private fun BubbleDots(dotColor: Color = Color.White) {
    Row(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalAlignment = Alignment.CenterVertically) {
        repeat(3) { Box(Modifier.size(9.dp).clip(CircleShape).background(dotColor)) }
    }
}

@Composable
private fun DiscoverActionCard(
    title: String,
    subtitle: String,
    icon: ImageVector,
    colors: List<Color>,
    modifier: Modifier = Modifier,
    loading: Boolean = false,
    onClick: () -> Unit
) {
    Row(
        modifier = modifier.heightIn(min = 108.dp)
            .clip(RoundedCornerShape(24.dp))
            .background(Brush.linearGradient(colors))
            .border(1.dp, Color.White.copy(alpha = 0.26f), RoundedCornerShape(24.dp))
            .semantics(mergeDescendants = true) { contentDescription = "$title. $subtitle" }
            .clickable(role = Role.Button, onClickLabel = title, onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(9.dp)
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text(title, color = Color.White, fontSize = 17.sp, lineHeight = 20.sp, fontWeight = FontWeight.Black, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(subtitle, color = Color.White.copy(alpha = 0.88f), fontSize = 12.sp, lineHeight = 15.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
        Box(
            Modifier.size(48.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.2f))
                .border(1.dp, Color.White.copy(alpha = 0.3f), CircleShape),
            contentAlignment = Alignment.Center
        ) {
            if (loading) CircularProgressIndicator(Modifier.size(22.dp), color = Color.White, strokeWidth = 2.dp)
            else Icon(icon, contentDescription = null, tint = Color.White, modifier = Modifier.size(23.dp))
        }
    }
}

@Composable
private fun DiscoverSectionHeading(title: String, subtitle: String) {
    Column(Modifier.fillMaxWidth().padding(start = 20.dp, end = 20.dp, top = 2.dp)) {
        Text(title, color = TextPrimary, fontSize = 23.sp, fontWeight = FontWeight.Black)
        Text(subtitle, color = TextMuted, fontSize = 13.sp, modifier = Modifier.padding(top = 3.dp))
    }
}

@Composable
private fun FilterRail(selected: String, onSelected: (String) -> Unit) {
    LazyRow(
        modifier = Modifier
            .fillMaxWidth()
            .selectableGroup(),
        contentPadding = PaddingValues(horizontal = 18.dp),
        horizontalArrangement = Arrangement.spacedBy(9.dp)
    ) {
        items(discoveryFilters, key = { it.label }) { filter ->
            val active = selected == filter.label
            Row(
                modifier = Modifier.heightIn(min = 44.dp)
                    .clip(CircleShape)
                    .background(if (active) Brush.horizontalGradient(listOf(PrimaryPurple, Color(0xFF922CF3))) else Brush.horizontalGradient(listOf(SurfaceElevated, SurfaceElevated)))
                    .border(1.dp, if (active) PrimaryPurple.copy(alpha = 0.55f) else BorderColor, CircleShape)
                    .selectable(selected = active, role = Role.Tab) { onSelected(filter.label) }
                    .semantics(mergeDescendants = true) {
                        contentDescription = filter.label
                        selectedSemantics = active
                    }
                    .padding(horizontal = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(7.dp)
            ) {
                Icon(filter.icon, contentDescription = null, tint = if (active) Color.White else TextMuted, modifier = Modifier.size(18.dp))
                Text(filter.label, color = if (active) Color.White else TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold, maxLines = 1)
            }
        }
    }
}

@Composable
private fun RecommendedRoomCard(room: Room, onOpen: () -> Unit, onJoin: () -> Unit) {
    val fallbackGradient = room.gradient.takeIf { it.size >= 2 } ?: listOf(Color(0xFF7B40DB), Color(0xFFCB3A9D))
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp)
            .heightIn(min = 148.dp)
            .clip(RoundedCornerShape(24.dp))
            .background(SurfaceElevated)
            .border(1.dp, BorderColor, RoundedCornerShape(24.dp))
            .semantics { contentDescription = "${room.title}, ${room.participants} people live" }
            .clickable(role = Role.Button, onClickLabel = "Open ${room.title}", onClick = onOpen)
            .padding(11.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(13.dp)
    ) {
        Box(
            modifier = Modifier.size(width = 104.dp, height = 124.dp)
                .clip(RoundedCornerShape(18.dp))
                .background(Brush.linearGradient(fallbackGradient)),
            contentAlignment = Alignment.Center
        ) {
            if (!room.coverImage.isNullOrBlank()) {
                AsyncImage(model = room.coverImage, contentDescription = null, modifier = Modifier.fillMaxSize(), contentScale = androidx.compose.ui.layout.ContentScale.Crop)
            } else {
                Icon(
                    if (room.type == RoomType.Video) Icons.Filled.Videocam else Icons.Filled.Mic,
                    contentDescription = null,
                    tint = Color.White.copy(alpha = 0.92f),
                    modifier = Modifier.size(38.dp)
                )
            }
            Box(
                Modifier.align(Alignment.TopStart).padding(7.dp).clip(CircleShape)
                    .background(Color(0xFFE34A66)).padding(horizontal = 8.dp, vertical = 4.dp)
            ) { Text("LIVE", color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.Black) }
        }
        Column(Modifier.weight(1f).heightIn(min = 118.dp), verticalArrangement = Arrangement.SpaceBetween) {
            Text(
                room.title.ifBlank { "Live conversation" },
                color = TextPrimary,
                fontSize = 17.sp,
                lineHeight = 20.sp,
                fontWeight = FontWeight.Black,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                room.host?.let { host ->
                    Avatar(host.name.take(1).ifBlank { "Y" }, 30, host.avatar, host.activeCosmetics)
                    Text(
                        host.name.ifBlank { "Yugm host" },
                        color = TextPrimary,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(start = 7.dp).weight(1f)
                    )
                } ?: Text(room.category.ifBlank { "Open room" }, color = TextMuted, fontSize = 12.sp, modifier = Modifier.weight(1f))
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                RoomInfoChip(
                    icon = if (room.type == RoomType.Video) Icons.Filled.Videocam else Icons.Filled.Mic,
                    label = room.category.ifBlank { if (room.type == RoomType.Video) "Video" else "Voice" }
                )
                RoomInfoChip(icon = Icons.Filled.Groups, label = room.participants.toString())
                Spacer(Modifier.weight(1f))
                Box(
                    Modifier.heightIn(min = 42.dp).widthIn(min = 68.dp)
                        .clip(CircleShape)
                        .background(Brush.horizontalGradient(listOf(PrimaryPurple, Color(0xFF8A2DE8))))
                        .clickable(role = Role.Button, onClickLabel = "Join ${room.title}", onClick = onJoin)
                        .padding(horizontal = 15.dp, vertical = 9.dp),
                    contentAlignment = Alignment.Center
                ) { Text("Join", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Black) }
            }
        }
    }
}

@Composable
private fun RoomInfoChip(icon: ImageVector, label: String) {
    Row(
        modifier = Modifier.clip(CircleShape).background(PrimaryPurple.copy(alpha = 0.1f)).padding(horizontal = 9.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp)
    ) {
        Icon(icon, contentDescription = null, tint = PrimaryPurple, modifier = Modifier.size(15.dp))
        Text(label, color = TextMuted, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun DiscoverLoadingState() {
    Box(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 34.dp), contentAlignment = Alignment.Center) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            CircularProgressIndicator(Modifier.size(22.dp), color = PrimaryPurple, strokeWidth = 2.dp)
            Text("Finding conversations for you…", color = TextMuted, fontSize = 14.sp)
        }
    }
}

@Composable
private fun EmptyRecommendations(
    filter: String,
    hasCity: Boolean,
    error: String?,
    onAddCity: () -> Unit,
    onCreateRoom: () -> Unit,
    onRetry: () -> Unit
) {
    val nearbyNeedsCity = filter == "Nearby" && !hasCity
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 18.dp)
            .clip(RoundedCornerShape(22.dp)).background(SurfaceElevated).border(1.dp, BorderColor, RoundedCornerShape(22.dp))
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text(
            when {
                nearbyNeedsCity -> "Find conversations close to you"
                error != null -> "We couldn’t load rooms"
                else -> "No ${filter.lowercase()} rooms are live right now"
            },
            color = TextPrimary,
            fontSize = 17.sp,
            fontWeight = FontWeight.Bold
        )
        Text(
            when {
                nearbyNeedsCity -> "Add your city to get recommendations from people nearby."
                error != null -> error
                else -> "Check back soon, or start a room and bring people together."
            },
            color = TextMuted,
            fontSize = 13.sp,
            lineHeight = 18.sp
        )
        TextButton(
            onClick = when {
                nearbyNeedsCity -> onAddCity
                error != null -> onRetry
                else -> onCreateRoom
            }
        ) {
            Text(when {
                nearbyNeedsCity -> "Add my city"
                error != null -> "Try again"
                else -> "Create a room"
            }, color = PrimaryPurple, fontWeight = FontWeight.Bold)
        }
    }
}
