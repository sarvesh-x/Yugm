package com.example.yugm.ui.screens

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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Surface
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
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.example.yugm.R
import com.example.yugm.api.YugmApi
import com.example.yugm.model.Host
import com.example.yugm.model.Room
import com.example.yugm.model.RoomType
import com.example.yugm.ui.components.*
import com.example.yugm.ui.theme.Background
import com.example.yugm.ui.theme.BorderColor
import com.example.yugm.ui.theme.Danger
import com.example.yugm.ui.theme.Gold
import com.example.yugm.ui.theme.Ink2
import com.example.yugm.ui.theme.Pink
import com.example.yugm.ui.theme.PrimaryPurple
import com.example.yugm.ui.theme.Success
import com.example.yugm.ui.theme.SurfaceElevated
import com.example.yugm.ui.theme.TextMuted
import com.example.yugm.ui.theme.TextPrimary
import com.example.yugm.ui.viewmodel.DiscoverViewModel
import kotlinx.coroutines.launch

private data class DiscoveryFilter(val label: String, val glyph: String)

private val discoveryFilters = listOf(
    DiscoveryFilter("Trending", "✦"),
    DiscoveryFilter("Nearby", "⌖"),
    DiscoveryFilter("Voice", "◖"),
    DiscoveryFilter("Video", "▣"),
    DiscoveryFilter("Music", "♪"),
    DiscoveryFilter("Gaming", "◆"),
    DiscoveryFilter("Chill", "☕")
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
    onDating: () -> Unit = {},
    onChat: () -> Unit = {},
    onWallet: () -> Unit = {},
    onSelfProfile: () -> Unit = {},
    onVoiceRooms: () -> Unit = {},
    onMissions: () -> Unit = {},
    viewModel: DiscoverViewModel = hiltViewModel()
) {
    LaunchedEffect(Unit) { viewModel.refreshHome(token) }

    val scope = rememberCoroutineScope()
    var busyHostId by remember { mutableStateOf("") }
    var selectedFilter by remember { mutableStateOf("Trending") }
    var suggestedHosts by remember(viewModel.home) {
        mutableStateOf(viewModel.home?.suggestedHosts ?: emptyList())
    }
    var contentVisible by remember { mutableStateOf(false) }

    LaunchedEffect(viewModel.home?.suggestedHosts) {
        suggestedHosts = viewModel.home?.suggestedHosts ?: emptyList()
    }
    LaunchedEffect(Unit) { contentVisible = true }

    val allRooms = remember(viewModel.recommendedRooms, viewModel.rooms) {
        (viewModel.recommendedRooms + viewModel.rooms).distinctBy { it.id }
    }
    val featuredRoom = allRooms.firstOrNull()

    Box(Modifier.fillMaxSize()) {
        AuroraBackground(speed = 0.8f)
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Background)
        ) {
            AmbientBackdrop()

        AnimatedVisibility(
            visible = contentVisible,
            enter = fadeIn() + slideInVertically(initialOffsetY = { it / 20 })
        ) {
            LazyColumn(
                contentPadding = PaddingValues(top = 18.dp, bottom = 116.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp),
                modifier = Modifier.fillMaxSize()
            ) {
                item {
                    AnimatedEntrance(delay = 100) {
                        DiscoveryHeader(
                            unreadCount = viewModel.home?.unreadNotifications ?: 0,
                            onNotifications = onNotifications,
                            onCreateRoom = onCreateRoom,
                            onProfile = onSelfProfile,
                            onMissions = onMissions
                        )
                    }
                }

                item {
                    Column(
                        modifier = Modifier.padding(horizontal = 20.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        AnimatedEntrance(delay = 200) {
                            SearchPill(onSearch)
                        }
                        AnimatedEntrance(delay = 300) {
                            FilterRail(
                                selected = selectedFilter,
                                onSelected = { filter ->
                                    selectedFilter = filter
                                    when (filter) {
                                        "Voice" -> onVoiceRooms()
                                        "Video" -> viewModel.refreshRooms(RoomType.Video)
                                        "Gaming" -> onGames()
                                    }
                                }
                            )
                        }
                    }
                }

                if (viewModel.isLoading && allRooms.isEmpty()) {
                    item {
                        Box(Modifier.padding(horizontal = 20.dp)) {
                            LoadingState("Finding tonight's best rooms…")
                        }
                    }
                } else if (allRooms.isEmpty()) {
                    item {
                        GlassCard(Modifier.padding(horizontal = 20.dp).fillMaxWidth()) {
                            Text("The rooms are quiet for a moment.", color = TextPrimary, fontWeight = FontWeight.Bold)
                            Text(
                                viewModel.error ?: "Start a room and set tonight's vibe.",
                                color = TextMuted,
                                fontSize = 12.sp,
                                modifier = Modifier.padding(top = 4.dp)
                            )
                            Text(
                                "Create a room  ›",
                                color = Pink,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Black,
                                modifier = Modifier.padding(top = 12.dp).clickable(onClick = onCreateRoom)
                            )
                        }
                    }
                } else if (featuredRoom != null) {
                    item {
                        FeaturedRoomCard(
                            room = featuredRoom,
                            onOpen = { onOpenRoom(featuredRoom) }
                        )
                    }
                }

                if (suggestedHosts.isNotEmpty()) {
                    item {
                        DiscoverySectionHeader("People near you", "Meet someone new", onGrowth)
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = 20.dp),
                            horizontalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            items(suggestedHosts.take(8), key = { "near-${it.id}" }) { host ->
                                NearbyHost(
                                    host = host,
                                    onOpen = { onOpenProfile(host.id) },
                                    onFollow = {
                                        if (token.isBlank() || busyHostId.isNotBlank()) return@NearbyHost
                                        busyHostId = host.id
                                        scope.launch {
                                            runCatching {
                                                if (host.isFollowing) YugmApi.unfollowUser(token, host.id)
                                                else YugmApi.followUser(token, host.id)
                                            }.onSuccess {
                                                suggestedHosts = suggestedHosts.map {
                                                    if (it.id == host.id) it.copy(isFollowing = !it.isFollowing) else it
                                                }
                                            }
                                            busyHostId = ""
                                        }
                                    }
                                )
                            }
                        }
                    }
                }

                if (allRooms.isNotEmpty()) {
                    item {
                        DiscoverySectionHeader("Live now", "Real rooms, right now", onSearch)
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = 20.dp),
                            horizontalArrangement = Arrangement.spacedBy(14.dp)
                        ) {
                            items(allRooms.drop(1).ifEmpty { allRooms }.take(8), key = { "live-${it.id}" }) { room ->
                                RoomCard(room = room, wide = false, onClick = { onOpenRoom(room) })
                            }
                        }
                    }
                }

                if (suggestedHosts.isNotEmpty()) {
                    item {
                        DiscoverySectionHeader("Trending hosts", "Creators worth following", onGrowth)
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = 20.dp),
                            horizontalArrangement = Arrangement.spacedBy(18.dp)
                        ) {
                            items(suggestedHosts.take(8), key = { "trend-${it.id}" }) { host ->
                                TrendingHost(host = host, onOpen = { onOpenProfile(host.id) })
                            }
                        }
                    }
                }

                viewModel.home?.let { home ->
                    item {
                        GlassCard(
                            Modifier
                                .padding(horizontal = 20.dp)
                                .fillMaxWidth()
                                .clickable(onClick = onGrowth)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    modifier = Modifier
                                        .size(44.dp)
                                        .clip(RoundedCornerShape(14.dp))
                                        .background(Brush.linearGradient(listOf(Pink, PrimaryPurple))),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text("↗", color = Color.White, fontWeight = FontWeight.Black, fontSize = 22.sp)
                                }
                                Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
                                    Text("Your creator journey", color = TextPrimary, fontWeight = FontWeight.Bold)
                                    Text(
                                        "${home.profileCompletion.percent}% profile · Level ${home.level.level}",
                                        color = TextMuted,
                                        fontSize = 12.sp
                                    )
                                }
                                Text("Open  ›", color = Pink, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }

        YugmBottomDock(
            modifier = Modifier.align(Alignment.BottomCenter),
            selected = YugmDockTab.DISCOVER,
            onDiscover = {},
            onCreate = onCreateRoom,
            onMatch = onDating,
            onLive = onVoiceRooms,
            onChat = onChat,
            onWallet = onWallet,
            onProfile = onSelfProfile
        )
    }
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
    onProfile: () -> Unit,
    onMissions: () -> Unit = {}
) {
    Column(
        modifier = Modifier.padding(horizontal = 20.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            BrandHeader(compact = true)
            Spacer(Modifier.weight(1f))
            HeaderAction(glyph = "★", onClick = onMissions)
            Spacer(Modifier.width(10.dp))
            HeaderAction(glyph = "♢", badge = unreadCount, onClick = onNotifications)
            Spacer(Modifier.width(10.dp))
            HeaderAction(glyph = "+", onClick = onCreateRoom, gradient = true)
            Spacer(Modifier.width(10.dp))
            Surface(
                onClick = onProfile,
                shape = CircleShape,
                color = SurfaceElevated,
                border = BorderStroke(1.dp, Pink.copy(alpha = 0.7f)),
                modifier = Modifier.size(44.dp)
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
    glyph: String,
    badge: Int = 0,
    gradient: Boolean = false,
    onClick: () -> Unit
) {
    Box {
        Box(
            modifier = Modifier
                .size(44.dp)
                .clip(RoundedCornerShape(15.dp))
                .then(
                    if (gradient) Modifier.background(Brush.linearGradient(listOf(Pink, PrimaryPurple)))
                    else Modifier.background(SurfaceElevated)
                )
                .border(1.dp, BorderColor, RoundedCornerShape(15.dp))
                .clickable(onClick = onClick),
            contentAlignment = Alignment.Center
        ) {
            Text(glyph, color = Color.White, fontSize = 21.sp, fontWeight = FontWeight.Bold)
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
        modifier = Modifier.horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        discoveryFilters.forEach { filter ->
            val active = filter.label == selected
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(7.dp),
                modifier = Modifier
                    .height(42.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .then(
                        if (active) Modifier.background(Brush.linearGradient(listOf(Pink, PrimaryPurple)))
                        else Modifier.background(SurfaceElevated)
                    )
                    .border(1.dp, if (active) Pink.copy(alpha = 0.45f) else BorderColor, RoundedCornerShape(14.dp))
                    .clickable { onSelected(filter.label) }
                    .padding(horizontal = 13.dp)
            ) {
                Text(filter.glyph, color = if (active) Color.White else TextMuted, fontSize = 15.sp)
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
            painter = painterResource(R.drawable.late_night_rooftop),
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
                            isSpeaking = room.type == RoomType.Voice
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
                            .height(44.dp)
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
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(76.dp).clickable(onClick = onOpen)) {
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
            modifier = Modifier.clickable(onClick = onFollow)
        )
    }
}

@Composable
private fun TrendingHost(host: Host, onOpen: () -> Unit) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(82.dp).clickable(onClick = onOpen)) {
        Avatar(
            initial = host.name.firstOrNull()?.toString() ?: "?",
            size = 68,
            imageUrl = host.avatar,
            cosmetics = host.activeCosmetics,
            isSpeaking = host.isOnline
        )
        Text(host.name, color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text("${formatAudience(host.followers)} followers", color = TextMuted, fontSize = 9.sp, maxLines = 1)
    }
}

@Composable
private fun DiscoveryDock(
    modifier: Modifier,
    onDiscover: () -> Unit,
    onDating: () -> Unit,
    onCreate: () -> Unit,
    onChat: () -> Unit,
    onWallet: () -> Unit
) {
    Row(
        modifier = modifier
            .padding(horizontal = 14.dp, vertical = 12.dp)
            .fillMaxWidth()
            .height(78.dp)
            .shadow(28.dp, RoundedCornerShape(26.dp), ambientColor = Color.Black)
            .clip(RoundedCornerShape(26.dp))
            .background(Brush.verticalGradient(listOf(Color(0xF51A1D31), Color(0xFA101221))))
            .border(1.dp, BorderColor, RoundedCornerShape(26.dp))
            .padding(horizontal = 8.dp),
        horizontalArrangement = Arrangement.SpaceAround,
        verticalAlignment = Alignment.CenterVertically
    ) {
        DockItem("⌁", "Discover", active = true, onClick = onDiscover)
        DockItem("♡", "Match", onClick = onDating)
        Box(
            modifier = Modifier
                .size(62.dp)
                .shadow(18.dp, CircleShape, ambientColor = Pink.copy(alpha = 0.7f))
                .clip(CircleShape)
                .background(Brush.linearGradient(listOf(Color(0xFFFF5A73), Pink, PrimaryPurple)))
                .clickable(onClick = onCreate),
            contentAlignment = Alignment.Center
        ) {
            Text("+", color = Color.White, fontSize = 38.sp, fontWeight = FontWeight.Light)
        }
        DockItem("●●", "Chat", onClick = onChat, badge = true)
        DockItem("▰", "Wallet", onClick = onWallet)
    }
}

@Composable
private fun DockItem(glyph: String, label: String, active: Boolean = false, badge: Boolean = false, onClick: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
        modifier = Modifier.width(57.dp).clickable(onClick = onClick)
    ) {
        Box(contentAlignment = Alignment.Center) {
            Text(glyph, color = if (active) Gold else TextMuted, fontSize = if (glyph == "●●") 12.sp else 20.sp, fontWeight = FontWeight.Bold)
            if (badge) {
                Box(
                    Modifier
                        .align(Alignment.TopEnd)
                        .size(7.dp)
                        .clip(CircleShape)
                        .background(Pink)
                )
            }
        }
        Text(label, color = if (active) Gold else TextMuted, fontSize = 10.sp, fontWeight = if (active) FontWeight.Bold else FontWeight.Medium)
    }
}

private fun formatAudience(value: Int): String = when {
    value >= 1_000_000 -> "${value / 1_000_000}.${(value % 1_000_000) / 100_000}M"
    value >= 1_000 -> "${value / 1_000}.${(value % 1_000) / 100}K"
    else -> value.toString()
}
