package com.yugm.app.feature.discover.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
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
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.selected as selectedSemantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Casino
import androidx.compose.material.icons.filled.ChatBubble
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.EventNote
import androidx.compose.material.icons.filled.Event
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.SportsEsports
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Coffee
import androidx.compose.material.icons.filled.Videocam
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.yugm.app.core.api.YugmApi
import com.yugm.app.core.model.Host
import com.yugm.app.core.model.Room
import com.yugm.app.core.model.RoomType
import com.yugm.app.core.ui.components.*
import com.yugm.app.core.ui.theme.Background
import com.yugm.app.core.ui.theme.BorderColor
import com.yugm.app.core.ui.theme.Danger
import com.yugm.app.core.ui.theme.Gold
import com.yugm.app.core.ui.theme.Ink2
import com.yugm.app.core.ui.theme.Pink
import com.yugm.app.core.ui.theme.PrimaryPurple
import com.yugm.app.core.ui.theme.Success
import com.yugm.app.core.ui.theme.SurfaceElevated
import com.yugm.app.core.ui.theme.TextMuted
import com.yugm.app.core.ui.theme.TextPrimary
import com.yugm.app.feature.discover.viewmodel.DiscoverViewModel
import com.yugm.app.feature.discover.R
import kotlinx.coroutines.launch

private data class DiscoveryFilter(val label: String, val icon: ImageVector)

private val discoveryFilters = listOf(
    DiscoveryFilter("Trending", Icons.Filled.LocalFireDepartment),
    DiscoveryFilter("Nearby", Icons.Filled.LocationOn),
    DiscoveryFilter("Voice", Icons.Filled.Mic),
    DiscoveryFilter("Video", Icons.Filled.Videocam),
    DiscoveryFilter("Music", Icons.Filled.MusicNote),
    DiscoveryFilter("Gaming", Icons.Filled.SportsEsports),
    DiscoveryFilter("Events", Icons.Filled.Event),
    DiscoveryFilter("Chill", Icons.Filled.Coffee)
)

@Composable
fun DiscoverScreen(
    token: String,
    onOpenRoom: (Room) -> Unit,
    onOpenProfile: (String) -> Unit,
    onCreateRoom: () -> Unit,
    onNotifications: () -> Unit,
    onGrowth: () -> Unit,
    onSearch: () -> Unit,
    onGames: () -> Unit = {},
    onEvents: () -> Unit = {},
    onDating: () -> Unit = {},
    onChat: () -> Unit = {},
    onWallet: () -> Unit = {},
    onSelfProfile: () -> Unit = {},
    onVoiceRooms: () -> Unit = {},
    onVibeGraph: () -> Unit = {},
    onCreatorDashboard: () -> Unit = {},
    viewModel: DiscoverViewModel = hiltViewModel(),
) {
    LaunchedEffect(token) {
        if (token.isNotBlank()) viewModel.refreshHome(token)
    }

    val rooms = remember(viewModel.recommendedRooms, viewModel.rooms) {
        (viewModel.recommendedRooms + viewModel.rooms).distinctBy { it.id }
    }
    val onlineHosts = viewModel.home?.suggestedHosts.orEmpty().filter { it.isOnline }
    var selectedDiscoveryFilter by remember { mutableStateOf("Trending") }

    Box(Modifier.fillMaxSize()) {
        Box(Modifier.fillMaxSize().background(Background)) {
            AmbientBackdrop()
            LazyColumn(
                contentPadding = PaddingValues(top = 8.dp, bottom = 150.dp),
                verticalArrangement = Arrangement.spacedBy(18.dp),
                modifier = Modifier.fillMaxSize().statusBarsPadding()
            ) {
                item {
                    HomeTopBar(
                        unreadCount = viewModel.home?.unreadNotifications ?: 0,
                        onSearch = onSearch,
                        onNotifications = onNotifications,
                        onTasks = onGrowth
                    )
                }
                item {
                    Row(
                        Modifier.fillMaxWidth().padding(horizontal = 18.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        HomeFeatureCard(
                            title = "Find Friends",
                            subtitle = "${viewModel.home?.suggestedHosts?.size ?: 0} people to meet",
                            icon = Icons.Filled.Favorite,
                            colors = listOf(Color(0xFFD946A6), Color(0xFF8B35E8)),
                            modifier = Modifier.weight(1f),
                            onClick = onGrowth
                        )
                        HomeFeatureCard(
                            title = "Truth & Dare",
                            subtitle = "Play together",
                            icon = Icons.Filled.Casino,
                            colors = listOf(Color(0xFFB241CA), Color(0xFF6932D6)),
                            modifier = Modifier.weight(1f),
                            onClick = onGames
                        )
                    }
                }
                item {
                    Row(
                        Modifier.fillMaxWidth().padding(horizontal = 18.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        HomeShortcut("Ranking", Icons.Filled.EmojiEvents, Modifier.weight(1f), onGrowth)
                        HomeShortcut("Blind Date", Icons.Filled.Favorite, Modifier.weight(1f), onDating)
                        HomeShortcut("Game", Icons.Filled.SportsEsports, Modifier.weight(1f), onGames)
                    }
                }
                item {
                    Row(
                        Modifier.fillMaxWidth().padding(horizontal = 20.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Recommend", color = TextPrimary, fontSize = 22.sp, fontWeight = FontWeight.Black, modifier = Modifier.weight(1f))
                        HomeCreateButton(onClick = onCreateRoom)
                    }
                }
                item {
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 18.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        items(discoveryFilters, key = { it.label }) { filter ->
                            HomeDiscoveryChip(
                                filter = filter,
                                selected = selectedDiscoveryFilter == filter.label,
                                onClick = { selectedDiscoveryFilter = filter.label }
                            )
                        }
                    }
                }
                if (viewModel.isLoading && rooms.isEmpty()) {
                    item {
                        Box(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 40.dp), contentAlignment = Alignment.Center) {
                            LoadingState("Finding live rooms…")
                        }
                    }
                } else if (rooms.isEmpty()) {
                    item {
                        HomeEmptyRooms(error = viewModel.error, onCreateRoom = onCreateRoom, onRetry = { viewModel.refreshHome(token) })
                    }
                } else {
                    items(rooms.take(12), key = { "home-room-${it.id}" }) { room ->
                        HomeRoomCard(room = room, onClick = { onOpenRoom(room) })
                    }
                }
            }
        }

        onlineHosts.firstOrNull()?.let { host ->
            HomeOnlineBubble(
                host = host,
                onlineCount = onlineHosts.size,
                onClick = { onOpenProfile(host.id) },
                modifier = Modifier.align(Alignment.BottomEnd).padding(end = 0.dp, bottom = 116.dp)
            )
        }

        YugmBottomDock(
            modifier = Modifier.align(Alignment.BottomCenter),
            selected = YugmDockTab.DISCOVER,
            onDiscover = {},
            onCreate = onCreateRoom,
            onLive = onVoiceRooms,
            onChat = onChat,
            onWallet = onWallet,
            onProfile = onSelfProfile
        )
    }
}

@Composable
private fun HomeTopBar(
    unreadCount: Int,
    onSearch: () -> Unit,
    onNotifications: () -> Unit,
    onTasks: () -> Unit
) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 20.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        BrandHeader(compact = true)
        Spacer(Modifier.weight(1f))
        HeaderAction(Icons.Filled.Search, "Search", onClick = onSearch)
        Spacer(Modifier.width(8.dp))
        HeaderAction(Icons.Filled.Notifications, "Notifications", badge = unreadCount, onClick = onNotifications)
        Spacer(Modifier.width(8.dp))
        HeaderAction(Icons.Filled.EventNote, "Tasks and events", gradient = true, onClick = onTasks)
    }
}

@Composable
private fun HomeFeatureCard(
    title: String,
    subtitle: String,
    icon: ImageVector,
    colors: List<Color>,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Box(
        modifier
            .height(108.dp)
            .clip(RoundedCornerShape(23.dp))
            .background(Brush.linearGradient(colors))
            .border(1.dp, Color.White.copy(alpha = 0.25f), RoundedCornerShape(23.dp))
            .semantics { contentDescription = "$title. $subtitle" }
            .clickable(role = Role.Button, onClickLabel = title, onClick = onClick)
            .padding(start = 14.dp, top = 12.dp, bottom = 10.dp, end = 48.dp)
    ) {
        Column(Modifier.align(Alignment.CenterStart)) {
            Text(title, color = Color.White, fontSize = 16.sp, lineHeight = 19.sp, fontWeight = FontWeight.Black, maxLines = 2)
            Text(subtitle, color = Color.White.copy(alpha = 0.78f), fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Icon(icon, contentDescription = null, modifier = Modifier.align(Alignment.CenterEnd).padding(end = 3.dp).size(32.dp), tint = Color.White)
    }
}

@Composable
private fun HomeShortcut(label: String, icon: ImageVector, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Column(
        modifier.height(78.dp)
            .clip(RoundedCornerShape(18.dp))
            .background(Brush.horizontalGradient(listOf(Color(0xFF15223F), Color(0xFF24203A))))
            .border(1.dp, Color.White.copy(alpha = 0.2f), RoundedCornerShape(18.dp))
            .semantics { contentDescription = label }
            .clickable(role = Role.Button, onClickLabel = label, onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, color = TextPrimary, fontSize = 13.sp, lineHeight = 15.sp, fontWeight = FontWeight.Bold, maxLines = 2)
        Icon(icon, contentDescription = null, modifier = Modifier.align(Alignment.End).size(24.dp), tint = Color(0xFFD5C4FF))
    }
}

@Composable
private fun HomeCreateButton(onClick: () -> Unit) {
    Row(
        Modifier.clip(CircleShape)
            .background(Brush.horizontalGradient(listOf(PrimaryPurple.copy(alpha = 0.65f), Pink.copy(alpha = 0.72f))))
            .border(1.dp, Color.White.copy(alpha = 0.24f), CircleShape)
            .clickable(role = Role.Button, onClickLabel = "Create room", onClick = onClick)
            .padding(horizontal = 15.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(7.dp)
    ) {
        Icon(Icons.Filled.Add, contentDescription = null, modifier = Modifier.size(18.dp), tint = Color.White)
        Text("Create", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun HomeDiscoveryChip(filter: DiscoveryFilter, selected: Boolean, onClick: () -> Unit) {
    Row(
        Modifier.height(44.dp).clip(CircleShape)
            .background(if (selected) Brush.horizontalGradient(listOf(PrimaryPurple, Pink)) else Brush.horizontalGradient(listOf(Color(0xFF17192B), Color(0xFF22243A))))
            .border(1.dp, if (selected) Pink.copy(alpha = 0.6f) else Color.White.copy(alpha = 0.16f), CircleShape)
            .selectable(selected = selected, role = Role.Tab, onClick = onClick)
            .semantics(mergeDescendants = true) {
                contentDescription = filter.label
                selectedSemantics = selected
            }
            .padding(horizontal = 13.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(7.dp)
    ) {
        Icon(filter.icon, contentDescription = null, modifier = Modifier.size(18.dp), tint = if (selected) Color.White else TextMuted)
        Text(filter.label, color = if (selected) Color.White else TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold, maxLines = 1)
    }
}

@Composable
private fun HomeRoomCard(room: Room, onClick: () -> Unit) {
    val colors = room.gradient.takeIf { it.size >= 2 } ?: listOf(Color(0xFF36225B), Color(0xFF17172D))
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp).height(136.dp)
            .clip(RoundedCornerShape(20.dp))
            .background(Brush.linearGradient(colors))
            .border(1.dp, Color.White.copy(alpha = 0.12f), RoundedCornerShape(20.dp))
            .semantics { contentDescription = "${room.title}, ${room.participants} people listening" }
            .clickable(role = Role.Button, onClickLabel = "Open ${room.title}", onClick = onClick),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            Modifier.width(94.dp).fillMaxSize()
                .background(Brush.verticalGradient(listOf(Color(0xFF482678), Color(0xFF16152B)))),
            contentAlignment = Alignment.Center
        ) {
            room.host?.let { host ->
                Avatar(host.name.take(1), 70, host.avatar, host.activeCosmetics)
            } ?: Icon(Icons.Filled.Mic, contentDescription = "Empty room", modifier = Modifier.size(36.dp), tint = Color.White.copy(alpha = 0.85f))
        }
        Column(
            Modifier.weight(1f).fillMaxSize().padding(start = 13.dp, end = 12.dp, top = 13.dp, bottom = 12.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                Text(room.title.ifBlank { "Live voice room" }, color = Color.White, fontSize = 16.sp, lineHeight = 19.sp, fontWeight = FontWeight.Black, maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                Text("● LIVE", color = Color.White.copy(alpha = 0.88f), fontSize = 9.sp, fontWeight = FontWeight.Black)
            }
            Text(room.host?.name?.let { "Hosted by $it" } ?: room.category.ifBlank { "Join the conversation" }, color = Color.White.copy(alpha = 0.76f), fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Filled.Groups, contentDescription = null, modifier = Modifier.size(17.dp), tint = Color.White.copy(alpha = 0.9f))
                Text(" ${room.participants}", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.weight(1f))
                Row(Modifier.clip(CircleShape).background(Background.copy(alpha = 0.68f)).padding(horizontal = 10.dp, vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.ChatBubble, contentDescription = null, modifier = Modifier.size(14.dp), tint = Color.White)
                    Spacer(Modifier.width(4.dp))
                    Text("Chat", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun HomeEmptyRooms(error: String?, onCreateRoom: () -> Unit, onRetry: () -> Unit) {
    Column(
        Modifier.fillMaxWidth().padding(horizontal = 18.dp).clip(RoundedCornerShape(20.dp))
            .background(SurfaceElevated).padding(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(Icons.Filled.Mic, contentDescription = null, modifier = Modifier.size(36.dp), tint = Pink)
        Text(if (error == null) "No rooms are live right now" else "Couldn't load rooms", color = TextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 8.dp))
        Text(error ?: "Start a room and invite people to join.", color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
        TextButton(onClick = if (error == null) onCreateRoom else onRetry) {
            Text(if (error == null) "Create a room" else "Try again", color = Pink, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun HomeOnlineBubble(host: Host, onlineCount: Int, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Row(
        modifier.widthIn(min = 190.dp, max = 245.dp).height(70.dp)
            .clip(RoundedCornerShape(topStart = 38.dp, bottomStart = 38.dp, topEnd = 0.dp, bottomEnd = 0.dp))
            .background(Brush.horizontalGradient(listOf(PrimaryPurple, Color(0xFF9B3FE5))))
            .semantics { contentDescription = "$onlineCount people online. Open ${host.name}'s profile" }
            .clickable(role = Role.Button, onClickLabel = "View online people", onClick = onClick)
            .padding(start = 8.dp, end = 15.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Avatar(host.name.take(1), 48, host.avatar, host.activeCosmetics)
        Column(Modifier.weight(1f).padding(start = 9.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Filled.Groups, contentDescription = null, modifier = Modifier.size(17.dp), tint = Color.White)
                Text(" $onlineCount", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Black)
            }
            Text("Online now", color = Color.White.copy(alpha = 0.72f), fontSize = 12.sp)
        }
        Icon(Icons.Filled.ChevronRight, contentDescription = null, modifier = Modifier.size(22.dp), tint = Color.White)
    }
}

@Composable
private fun AmbientBackdrop() {
    Canvas(Modifier.fillMaxSize()) {
        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(PrimaryPurple.copy(alpha = 0.18f), Color.Transparent),
                center = Offset(size.width * 0.88f, size.height * 0.18f),
                radius = size.width * 0.72f
            ),
            radius = size.width * 0.72f,
            center = Offset(size.width * 0.88f, size.height * 0.18f)
        )
        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(Pink.copy(alpha = 0.10f), Color.Transparent),
                center = Offset(size.width * 0.05f, size.height * 0.60f),
                radius = size.width * 0.54f
            ),
            radius = size.width * 0.54f,
            center = Offset(size.width * 0.05f, size.height * 0.60f)
        )
    }
}

@Composable
private fun DiscoveryHeader(
    unreadCount: Int,
    onNotifications: () -> Unit,
    onCreateRoom: () -> Unit,
    onProfile: () -> Unit
) {
    val yourProfileLabel = stringResource(R.string.a11y_your_profile)
    Column(
        modifier = Modifier.padding(horizontal = 20.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            BrandHeader(compact = true)
            Spacer(Modifier.weight(1f))
            HeaderAction(icon = Icons.Filled.Notifications, accessibilityLabel = if (unreadCount > 0) stringResource(R.string.a11y_notifications_unread, unreadCount) else stringResource(R.string.a11y_notifications), badge = unreadCount, onClick = onNotifications)
            Spacer(Modifier.width(10.dp))
            HeaderAction(icon = Icons.Filled.Add, accessibilityLabel = stringResource(R.string.a11y_create_room), onClick = onCreateRoom, gradient = true)
            Spacer(Modifier.width(10.dp))
            Surface(
                onClick = onProfile,
                shape = CircleShape,
                color = SurfaceElevated,
                border = BorderStroke(1.dp, Pink.copy(alpha = 0.7f)),
                modifier = Modifier.sizeIn(minWidth = 48.dp, minHeight = 48.dp).semantics { contentDescription = yourProfileLabel }
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text("Y", color = Color.White, fontWeight = FontWeight.Black)
                    Box(
                        Modifier
                            .align(Alignment.BottomEnd)
                            .size(10.dp)
                            .clip(CircleShape)
                            .background(Success)
                            .border(2.dp, Background, CircleShape)
                    )
                }
            }
        }
        Column {
            Text("Good evening 👋", color = TextMuted, fontSize = 14.sp)
            Text("Find your room.", color = TextPrimary, fontSize = 28.sp, fontWeight = FontWeight.Black)
        }
    }
}

@Composable
private fun HeaderAction(
    icon: ImageVector,
    accessibilityLabel: String,
    badge: Int = 0,
    gradient: Boolean = false,
    onClick: () -> Unit
) {
    Box {
        Box(
            modifier = Modifier
                .sizeIn(minWidth = 48.dp, minHeight = 48.dp)
                .clip(RoundedCornerShape(15.dp))
                .then(
                    if (gradient) Modifier.background(Brush.linearGradient(listOf(Pink, PrimaryPurple)))
                    else Modifier.background(SurfaceElevated)
                )
                .border(1.dp, BorderColor, RoundedCornerShape(15.dp))
                .semantics { contentDescription = accessibilityLabel }
                .clickable(role = Role.Button, onClickLabel = accessibilityLabel, onClick = onClick),
            contentAlignment = Alignment.Center
        ) {
            Icon(icon, contentDescription = null, modifier = Modifier.size(22.dp), tint = Color.White)
        }
        if (badge > 0) {
            Box(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .size(17.dp)
                    .clip(CircleShape)
                    .background(Danger),
                contentAlignment = Alignment.Center
            ) {
                Text(if (badge > 9) "9+" else badge.toString(), color = Color.White, fontSize = 8.sp, fontWeight = FontWeight.Black)
            }
        }
    }
}

@Composable
private fun SearchPill(onSearch: () -> Unit) {
    GlassCard(
        onClick = onSearch,
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 0.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth().height(56.dp)
        ) {
            SearchGlyph()
            Text(
                "Search rooms, people, or topics…",
                color = TextMuted,
                fontSize = 14.sp,
                modifier = Modifier.padding(start = 12.dp).weight(1f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text("⌁", color = Pink, fontSize = 22.sp)
        }
    }
}

@Composable
private fun SearchGlyph() {
    Canvas(Modifier.size(20.dp)) {
        drawCircle(color = TextMuted, radius = size.minDimension * 0.34f, style = androidx.compose.ui.graphics.drawscope.Stroke(2.dp.toPx()))
        drawLine(
            color = TextMuted,
            start = Offset(size.width * 0.68f, size.height * 0.68f),
            end = Offset(size.width * 0.94f, size.height * 0.94f),
            strokeWidth = 2.dp.toPx()
        )
    }
}

@Composable
private fun FilterRail(selected: String, onSelected: (String) -> Unit) {
    Row(
        modifier = Modifier.horizontalScroll(rememberScrollState()).selectableGroup(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        discoveryFilters.forEach { filter ->
            val active = filter.label == selected
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(7.dp),
                modifier = Modifier
                    .heightIn(min = 48.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .then(
                        if (active) Modifier.background(Brush.linearGradient(listOf(Pink, PrimaryPurple)))
                        else Modifier.background(SurfaceElevated)
                    )
                    .border(1.dp, if (active) Pink.copy(alpha = 0.45f) else BorderColor, RoundedCornerShape(14.dp))
                    .selectable(selected = active, role = Role.Tab) { onSelected(filter.label) }
                    .semantics(mergeDescendants = true) {
                        contentDescription = filter.label
                        selectedSemantics = active
                    }
                    .padding(horizontal = 13.dp)
            ) {
                Icon(filter.icon, contentDescription = null, modifier = Modifier.size(18.dp), tint = if (active) Color.White else TextMuted)
                Text(filter.label, color = if (active) Color.White else TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun FeaturedRoomCard(room: Room, onOpen: () -> Unit) {
    Box(
        modifier = Modifier
            .padding(horizontal = 20.dp)
            .fillMaxWidth()
            .height(246.dp)
            .shadow(24.dp, RoundedCornerShape(26.dp), ambientColor = PrimaryPurple.copy(alpha = 0.35f))
            .clip(RoundedCornerShape(26.dp))
            .border(1.dp, Pink.copy(alpha = 0.5f), RoundedCornerShape(26.dp))
            .clickable(onClick = onOpen)
    ) {
        Image(
            painter = painterResource(android.R.drawable.ic_menu_gallery),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize()
        )
        Box(
            Modifier
                .fillMaxSize()
                .background(
                    Brush.horizontalGradient(
                        listOf(
                            Background.copy(alpha = 0.96f),
                            Background.copy(alpha = 0.70f),
                            Background.copy(alpha = 0.10f)
                        )
                    )
                )
        )
        Box(
            Modifier
                .fillMaxSize()
                .background(Brush.verticalGradient(listOf(Color.Transparent, Background.copy(alpha = 0.74f))))
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(18.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("✦  FEATURED LIVE", color = Color(0xFFD787FF), fontSize = 12.sp, fontWeight = FontWeight.Black)
                Spacer(Modifier.weight(1f))
                LiveBadge()
            }

            Column {
                Text(
                    room.title.ifBlank { "Late Night Talks ✨" },
                    color = Color.White,
                    fontSize = 25.sp,
                    lineHeight = 28.sp,
                    fontWeight = FontWeight.Black,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    room.description.ifBlank { "Deep conversations, good vibes and new people." },
                    color = Color.White.copy(alpha = 0.76f),
                    fontSize = 13.sp,
                    lineHeight = 18.sp,
                    modifier = Modifier.padding(top = 5.dp).fillMaxWidth(0.72f),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(top = 12.dp)
                ) {
                    room.host?.let { host ->
                        Avatar(
                            initial = host.name.firstOrNull()?.toString() ?: "?",
                            size = 34,
                            imageUrl = host.avatar,
                            cosmetics = host.activeCosmetics,
                            isSpeaking = false
                        )
                    }
                    Column(Modifier.padding(start = 4.dp).weight(1f)) {
                        Text(room.host?.name ?: "Yugm host", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        Text("${formatAudience(room.participants)} listening", color = Color.White.copy(alpha = 0.62f), fontSize = 11.sp)
                    }
                    Button(
                        onClick = onOpen,
                        contentPadding = PaddingValues(horizontal = 17.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                        modifier = Modifier
                            .heightIn(min = 48.dp)
                            .clip(RoundedCornerShape(14.dp))
                            .background(Brush.horizontalGradient(listOf(PrimaryPurple, Pink)))
                    ) {
                        Text("Join room", color = Color.White, fontWeight = FontWeight.Black, fontSize = 13.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun DiscoverySectionHeader(title: String, subtitle: String, onSeeAll: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 2.dp),
        verticalAlignment = Alignment.Bottom
    ) {
        Column(Modifier.weight(1f)) {
            Text(title, color = TextPrimary, fontSize = 19.sp, fontWeight = FontWeight.Black)
            Text(subtitle, color = TextMuted, fontSize = 11.sp, modifier = Modifier.padding(top = 2.dp))
        }
        Text("See all  ›", color = Pink, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.clickable(onClick = onSeeAll))
    }
}

@Composable
private fun NearbyHost(host: Host, onOpen: () -> Unit, onFollow: () -> Unit) {
    val hostStatusLabel = stringResource(if (host.isOnline) R.string.a11y_host_online else R.string.a11y_host_away, host.name)
    val openProfileLabel = stringResource(R.string.a11y_open_profile, host.name)
    val followLabel = stringResource(if (host.isFollowing) R.string.a11y_unfollow_user else R.string.a11y_follow_user, host.name)
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.width(76.dp).heightIn(min = 48.dp)
            .semantics(mergeDescendants = true) {
                contentDescription = hostStatusLabel
            }
            .clickable(role = Role.Button, onClickLabel = openProfileLabel, onClick = onOpen)
    ) {
        Box {
            Avatar(
                initial = host.name.firstOrNull()?.toString() ?: "?",
                size = 62,
                imageUrl = host.avatar,
                cosmetics = host.activeCosmetics
            )
            Box(
                Modifier
                    .align(Alignment.BottomEnd)
                    .size(13.dp)
                    .clip(CircleShape)
                    .background(if (host.isOnline) Success else Gold)
                    .border(2.dp, Background, CircleShape)
            )
        }
        Text(host.name, color = TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text(
            if (host.isFollowing) "Following" else host.city.ifBlank { "Nearby" },
            color = if (host.isFollowing) Pink else TextMuted,
            fontSize = 10.sp,
            maxLines = 1,
            modifier = Modifier.heightIn(min = 48.dp)
                .semantics { contentDescription = followLabel }
                .clickable(role = Role.Button, onClickLabel = followLabel, onClick = onFollow)
        )
    }
}

@Composable
private fun TrendingHost(host: Host, onOpen: () -> Unit) {
    val profileLabel = stringResource(R.string.a11y_host_followers, host.name, formatAudience(host.followers))
    val openProfileLabel = stringResource(R.string.a11y_open_profile, host.name)
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(82.dp).heightIn(min = 48.dp).semantics(mergeDescendants = true) {
        contentDescription = profileLabel
    }.clickable(role = Role.Button, onClickLabel = openProfileLabel, onClick = onOpen)) {
        Avatar(
            initial = host.name.firstOrNull()?.toString() ?: "?",
            size = 68,
            imageUrl = host.avatar,
            cosmetics = host.activeCosmetics,
            isSpeaking = false
        )
        Text(host.name, color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text("${formatAudience(host.followers)} followers", color = TextMuted, fontSize = 9.sp, maxLines = 1)
    }
}

private fun formatAudience(value: Int): String = when {
    value >= 1_000_000 -> "${value / 1_000_000}.${(value % 1_000_000) / 100_000}M"
    value >= 1_000 -> "${value / 1_000}.${(value % 1_000) / 100}K"
    else -> value.toString()
}
