package com.example.yugm.ui.screens

import androidx.compose.foundation.BorderStroke
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.example.yugm.R
import com.example.yugm.model.Room
import com.example.yugm.model.RoomType
import com.example.yugm.ui.components.Avatar
import com.example.yugm.ui.components.BrandHeader
import com.example.yugm.ui.components.GradientAction
import com.example.yugm.ui.components.LiveBadge
import com.example.yugm.ui.components.LoadingState
import com.example.yugm.ui.components.ReferenceChip
import com.example.yugm.ui.components.ReferenceSectionHeader
import com.example.yugm.ui.components.RoundAction
import com.example.yugm.ui.components.YugmAmbientBackground
import com.example.yugm.ui.components.YugmBottomDock
import com.example.yugm.ui.components.YugmDockTab
import com.example.yugm.ui.theme.Background
import com.example.yugm.ui.theme.BorderColor
import com.example.yugm.ui.theme.Gold
import com.example.yugm.ui.theme.Pink
import com.example.yugm.ui.theme.PrimaryPurple
import com.example.yugm.ui.theme.SurfaceElevated
import com.example.yugm.ui.theme.TextMuted
import com.example.yugm.ui.theme.TextPrimary
import com.example.yugm.util.cosmeticDisplayName
import com.example.yugm.ui.viewmodel.DiscoverViewModel

@Composable
fun VoiceRoomsScreen(
    token: String,
    onBack: () -> Unit,
    onOpenRoom: (Room) -> Unit,
    onCreateRoom: () -> Unit,
    onSearch: () -> Unit,
    onNotifications: () -> Unit,
    onDiscover: () -> Unit = {},
    onDating: () -> Unit = {},
    onChat: () -> Unit = {},
    onWallet: () -> Unit = {},
    onProfile: () -> Unit = {},
    viewModel: DiscoverViewModel = hiltViewModel()
) {
    var selectedFeed by remember { mutableStateOf("All Rooms") }
    var selectedCategory by remember { mutableStateOf("All") }

    LaunchedEffect(token) { viewModel.refreshRooms(RoomType.Voice) }
    val rooms = viewModel.rooms.filter { it.type == RoomType.Voice }
    val displayedRooms = remember(rooms, selectedCategory) {
        if (selectedCategory == "All") rooms else rooms.filter {
            it.category.equals(selectedCategory, true) || it.tags.any { tag -> tag.equals(selectedCategory, true) }
        }
    }

    YugmAmbientBackground {
        Box(Modifier.fillMaxSize()) {
            LazyColumn(
                contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 16.dp, bottom = 118.dp),
                verticalArrangement = Arrangement.spacedBy(15.dp),
                modifier = Modifier.fillMaxSize()
            ) {
                item {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        BrandHeader(compact = true)
                        Spacer(Modifier.weight(1f))
                        RoundAction("♢", badge = (viewModel.home?.unreadNotifications ?: 0).takeIf { it > 0 }?.toString(), onClick = onNotifications)
                        Spacer(Modifier.width(10.dp))
                        RoundAction("‹", onClick = onBack)
                    }
                }
                item {
                    Row(verticalAlignment = Alignment.Bottom) {
                        Column(Modifier.weight(1f)) {
                            Text("Voice Rooms", color = TextPrimary, fontSize = 28.sp, fontWeight = FontWeight.Black)
                            Text("Live conversations, real people.", color = TextMuted, fontSize = 13.sp)
                        }
                        ReferenceChip("My Rooms", glyph = "♙", onClick = onCreateRoom)
                    }
                }
                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Row(
                            modifier = Modifier
                                .weight(1f)
                                .height(56.dp)
                                .clip(RoundedCornerShape(18.dp))
                                .background(SurfaceElevated)
                                .border(1.dp, BorderColor, RoundedCornerShape(18.dp))
                                .clickable(onClick = onSearch)
                                .padding(horizontal = 16.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("⌕", color = TextMuted, fontSize = 24.sp)
                            Text("Search voice rooms, topics, people…", color = TextMuted, fontSize = 13.sp, modifier = Modifier.padding(start = 10.dp), maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                        RoundAction("☷", onClick = onSearch)
                    }
                }
                item {
                    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf("All Rooms" to "◖", "Trending" to "♨", "Nearby" to "⌖", "New" to "✦", "Following" to "♙").forEach { (label, glyph) ->
                            ReferenceChip(label, glyph = glyph, selected = selectedFeed == label, onClick = { selectedFeed = label })
                        }
                    }
                }
                item {
                    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf("All" to "", "Talks" to "◖", "Chill" to "☕", "Music" to "♪", "Gaming" to "◆", "Learning" to "▰", "Dating" to "♡").forEach { (label, glyph) ->
                            ReferenceChip(label, glyph = glyph, selected = selectedCategory == label, onClick = { selectedCategory = label })
                        }
                    }
                }

                if (viewModel.isLoading && rooms.isEmpty()) {
                    item { LoadingState("Finding live voice rooms…") }
                } else if (displayedRooms.isEmpty()) {
                    item {
                        Column(
                            modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(22.dp)).background(SurfaceElevated).border(1.dp, BorderColor, RoundedCornerShape(22.dp)).padding(22.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text("No rooms in this category yet", color = TextPrimary, fontWeight = FontWeight.Bold)
                            Text("Be the first to start the conversation.", color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp, bottom = 14.dp))
                            GradientAction("Create room", modifier = Modifier.fillMaxWidth(), leading = "+", onClick = onCreateRoom)
                        }
                    }
                } else {
                    item { FeaturedVoiceRoom(displayedRooms.first(), onClick = { onOpenRoom(displayedRooms.first()) }) }
                    item { ReferenceSectionHeader("Live rooms", "See all") }
                    items(displayedRooms.drop(1).ifEmpty { displayedRooms }, key = { "voice-${it.id}" }) { room ->
                        VoiceRoomRow(room = room, onClick = { onOpenRoom(room) })
                    }
                }
            }

            Box(
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(end = 22.dp, bottom = 98.dp)
                    .size(82.dp)
                    .clip(CircleShape)
                    .background(Brush.linearGradient(listOf(Color(0xFFFF5A64), Pink, PrimaryPurple)))
                    .clickable(onClick = onCreateRoom),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("+", color = Color.White, fontSize = 32.sp, fontWeight = FontWeight.Light)
                    Text("Create", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                }
            }
            YugmBottomDock(
                selected = YugmDockTab.LIVE,
                modifier = Modifier.align(Alignment.BottomCenter),
                onDiscover = onDiscover,
                onMatch = onDating,
                onCreate = onCreateRoom,
                onLive = {},
                onChat = onChat,
                onWallet = onWallet,
                onProfile = onProfile
            )
        }
    }
}

@Composable
private fun FeaturedVoiceRoom(room: Room, onClick: () -> Unit) {
    Box(
        modifier = Modifier.fillMaxWidth().height(224.dp).clip(RoundedCornerShape(24.dp)).border(1.dp, Pink.copy(alpha = 0.55f), RoundedCornerShape(24.dp)).clickable(onClick = onClick)
    ) {
        Image(painterResource(R.drawable.late_night_rooftop), null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
        Box(Modifier.fillMaxSize().background(Brush.horizontalGradient(listOf(Background.copy(alpha = 0.96f), Background.copy(alpha = 0.45f), Color.Transparent))))
        Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.SpaceBetween) {
            Row {
                Text("★  FEATURED ROOM", color = Color(0xFFD98BFF), fontSize = 11.sp, fontWeight = FontWeight.Black)
                Spacer(Modifier.weight(1f))
                LiveBadge()
            }
            Column {
                Text(room.title, color = TextPrimary, fontSize = 24.sp, fontWeight = FontWeight.Black, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Text(room.description.ifBlank { "Deep conversations, good vibes and new people." }, color = Color.White.copy(alpha = 0.72f), fontSize = 12.sp, maxLines = 2, modifier = Modifier.fillMaxWidth(0.68f).padding(top = 4.dp))
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 10.dp)) {
                    room.host?.let { Avatar(it.name.take(1), 38, it.avatar, it.activeCosmetics, isSpeaking = true) }
                    Column(Modifier.weight(1f).padding(start = 6.dp)) {
                        Text(room.host?.name ?: "Yugm host", color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                        Text("${room.participants} listening", color = TextMuted, fontSize = 10.sp)
                    }
                    GradientAction("Join Room", modifier = Modifier.width(128.dp), leading = "◖", onClick = onClick)
                }
            }
        }
    }
}

@Composable
private fun VoiceRoomRow(room: Room, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(132.dp)
            .clip(RoundedCornerShape(20.dp))
            .background(SurfaceElevated)
            .border(1.dp, BorderColor, RoundedCornerShape(20.dp))
            .clickable(onClick = onClick)
            .padding(10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            Modifier.size(110.dp).clip(RoundedCornerShape(16.dp)).background(Brush.linearGradient(room.gradient.ifEmpty { listOf(PrimaryPurple, Pink) })),
            contentAlignment = Alignment.TopStart
        ) {
            Column {
                LiveBadge()
                if (room.vipOnly) {
                    Text("VIP", color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.Black, modifier = Modifier.background(Gold.copy(alpha = 0.85f), RoundedCornerShape(4.dp)).padding(horizontal = 6.dp, vertical = 2.dp).padding(top = 2.dp))
                }
            }
        }
        Column(Modifier.weight(1f).padding(start = 12.dp)) {
            Text(room.title, color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Black, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(room.description.ifBlank { "Open up. Speak freely." }, color = TextMuted, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 7.dp)) {
                room.host?.let { Avatar(it.name.take(1), 27, it.avatar, it.activeCosmetics) }
                Text("+${room.participants.coerceAtLeast(1)}", color = TextMuted, fontSize = 11.sp, modifier = Modifier.padding(start = 4.dp))
                if (room.badge.isNotBlank()) {
                    Text("🏷️${cosmeticDisplayName(room.badge)}", color = TextMuted, fontSize = 10.sp, modifier = Modifier.padding(start = 4.dp))
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(5.dp), modifier = Modifier.padding(top = 6.dp)) {
                ReferenceChip(room.category.ifBlank { "Talks" }, glyph = "◖")
                if (room.language.isNotBlank()) ReferenceChip(room.language)
            }
        }
        Box(
            Modifier.clip(RoundedCornerShape(14.dp)).background(Brush.horizontalGradient(listOf(PrimaryPurple, Pink))).clickable(onClick = onClick).padding(horizontal = 15.dp, vertical = 11.dp)
        ) {
            Text("Join", color = Color.White, fontWeight = FontWeight.Black, fontSize = 12.sp)
        }
    }
}
