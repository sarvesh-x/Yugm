package com.yugm.app.feature.room.screens

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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Search
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.yugm.app.core.model.Room
import com.yugm.app.core.model.RoomType
import com.yugm.app.core.ui.components.Avatar
import com.yugm.app.core.ui.components.YugmBottomDock
import com.yugm.app.core.ui.components.YugmPullToRefreshBox
import com.yugm.app.core.ui.components.YugmDockTab
import com.yugm.app.feature.room.viewmodel.RoomViewModel
import coil.compose.AsyncImage
import androidx.compose.ui.layout.ContentScale

private val PartyInk = Color(0xFFF8FAFC)
private val PartyMuted = Color(0xFF9EA3B9)
private val PartyPurple = Color(0xFF8D35F6)
private val PartyBorder = Color(0x24FFFFFF)
private val PartyBackground = Color(0xFF060714)
private val PartyPanel = Color(0xFF171A2C)

private enum class PartySection { Voice, Video, MultiMode }

@Composable
fun VoiceRoomsScreen(
    onOpenRoom: (Room) -> Unit,
    onCreateRoom: () -> Unit,
    onDiscover: () -> Unit,
    onChat: () -> Unit,
    onWallet: () -> Unit,
    onProfile: () -> Unit,
    onSearch: () -> Unit = {},
    viewModel: RoomViewModel = hiltViewModel()
) {
    var selectedSection by remember { mutableStateOf(PartySection.Voice) }
    LaunchedEffect(selectedSection) {
        when (selectedSection) {
            PartySection.Voice -> viewModel.loadRooms(RoomType.Voice)
            PartySection.Video -> viewModel.loadRooms(RoomType.Video)
            PartySection.MultiMode -> Unit
        }
    }
    val liveRooms = viewModel.rooms.filter { it.type == RoomType.Voice && it.status == "LIVE" }
    val liveVideoRooms = viewModel.rooms.filter { it.type == RoomType.Video && it.status == "LIVE" }
    Box(Modifier.fillMaxSize().background(PartyBackground)) {
        YugmPullToRefreshBox(
            isRefreshing = viewModel.isRoomListLoading,
            onRefresh = {
                when (selectedSection) {
                    PartySection.Voice -> viewModel.loadRooms(RoomType.Voice)
                    PartySection.Video -> viewModel.loadRooms(RoomType.Video)
                    PartySection.MultiMode -> Unit
                }
            },
            modifier = Modifier.fillMaxSize()
        ) {
            LazyColumn(
                contentPadding = PaddingValues(top = 14.dp, bottom = 120.dp),
                verticalArrangement = Arrangement.spacedBy(18.dp),
                modifier = Modifier.fillMaxSize()
            ) {
            item {
                Row(Modifier.fillMaxWidth().padding(horizontal = 22.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("Party", color = PartyInk, fontSize = 29.sp, fontWeight = FontWeight.ExtraBold)
                        Text("Find your way to connect", color = PartyMuted, fontSize = 13.sp)
                    }
                    PartyIcon(Icons.Filled.Search, "Search rooms", onSearch)
                    Spacer(Modifier.width(10.dp))
                    PartyIcon(Icons.Filled.Add, "Create a room", onCreateRoom)
                }
            }
            item {
                Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    PartyTab("Voice Party", selectedSection == PartySection.Voice, Modifier.weight(1f)) { selectedSection = PartySection.Voice }
                    PartyTab("Video Party", selectedSection == PartySection.Video, Modifier.weight(1f)) { selectedSection = PartySection.Video }
                    PartyTab("Multi-Mode Party", selectedSection == PartySection.MultiMode, Modifier.weight(1f)) { selectedSection = PartySection.MultiMode }
                }
            }
            if (selectedSection == PartySection.Voice) {
            if (liveRooms.isNotEmpty()) {
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Row(Modifier.fillMaxWidth().padding(horizontal = 22.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text("People in rooms", color = PartyInk, fontSize = 19.sp, fontWeight = FontWeight.Bold)
                            Spacer(Modifier.weight(1f))
                            Text("${liveRooms.size} live", color = PartyPurple, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                        }
                        LazyRow(contentPadding = PaddingValues(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                            items(liveRooms.take(12), key = { "host-${it.id}" }) { room ->
                                val host = room.host
                                if (host != null) Column(
                                    Modifier.width(74.dp).semantics { contentDescription = "Open ${host.name}'s room" }
                                        .clickable(role = Role.Button) { onOpenRoom(room) },
                                    horizontalAlignment = Alignment.CenterHorizontally
                                ) {
                                    Box {
                                        Avatar(host.name.take(1), 62, host.avatar, host.activeCosmetics)
                                        Box(Modifier.align(Alignment.BottomEnd).size(18.dp).clip(CircleShape).background(Color(0xFF39C891)).border(2.dp, PartyBackground, CircleShape))
                                    }
                                    Text(host.name, color = PartyInk, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 5.dp))
                                }
                            }
                        }
                    }
                }
                item {
                    Row(Modifier.fillMaxWidth().padding(horizontal = 22.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text("Rooms to join", color = PartyInk, fontSize = 19.sp, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.weight(1f))
                        Text("${liveRooms.size}", color = PartyMuted, fontSize = 13.sp)
                    }
                }
                items(liveRooms, key = { it.id }) { room -> PartyRoomCard(room = room, onClick = { onOpenRoom(room) }) }
            } else if (viewModel.isRoomListLoading) {
                item {
                    Column(Modifier.fillMaxWidth().padding(top = 90.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator(color = PartyPurple, strokeWidth = 3.dp)
                        Text("Finding live rooms…", color = PartyMuted, modifier = Modifier.padding(top = 14.dp))
                    }
                }
            } else {
                item {
                    Column(Modifier.fillMaxWidth().padding(horizontal = 28.dp, vertical = 90.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Filled.Mic, contentDescription = null, modifier = Modifier.size(42.dp), tint = PartyPurple)
                        Text(if (viewModel.roomListError == null) "Your next conversation starts here" else "Couldn't load rooms", color = PartyInk, fontSize = 18.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 10.dp))
                        Text(viewModel.roomListError ?: "No live rooms right now. Start one and invite your friends.", color = PartyMuted, fontSize = 13.sp, modifier = Modifier.padding(top = 6.dp))
                        TextButton(onClick = { if (viewModel.roomListError != null) viewModel.loadRooms(RoomType.Voice) else onCreateRoom() }) {
                            Text(if (viewModel.roomListError != null) "Try again" else "Create a room", color = PartyPurple, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
            } else if (selectedSection == PartySection.Video) {
                when {
                    viewModel.isRoomListLoading -> item {
                        PartyLoadingState("Finding live video parties…")
                    }
                    liveVideoRooms.isNotEmpty() -> {
                        item {
                            Row(Modifier.fillMaxWidth().padding(horizontal = 22.dp), verticalAlignment = Alignment.CenterVertically) {
                                Text("Live video parties", color = PartyInk, fontSize = 19.sp, fontWeight = FontWeight.Bold)
                                Spacer(Modifier.weight(1f))
                                Text("${liveVideoRooms.size} live", color = PartyPurple, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                        items(liveVideoRooms.chunked(2), key = { row -> row.joinToString { it.id } }) { rowRooms ->
                            Row(Modifier.fillMaxWidth().padding(horizontal = 14.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                rowRooms.forEach { room ->
                                    VideoPartyCard(room, Modifier.weight(1f)) { onOpenRoom(room) }
                                }
                                if (rowRooms.size == 1) Spacer(Modifier.weight(1f))
                            }
                        }
                    }
                    else -> item {
                        PartyEmptyState(
                            title = if (viewModel.roomListError == null) "No live video parties yet" else "Couldn't load video parties",
                            message = viewModel.roomListError ?: "When a video party goes live, you’ll find it here.",
                            action = if (viewModel.roomListError != null) "Try again" else "Refresh",
                            onAction = { viewModel.loadRooms(RoomType.Video) }
                        )
                    }
                }
            } else {
                item {
                    Column(
                        Modifier.fillMaxWidth().padding(horizontal = 28.dp, vertical = 78.dp)
                            .clip(RoundedCornerShape(26.dp)).background(Brush.verticalGradient(listOf(Color(0xFF24133D), PartyPanel)))
                            .border(1.dp, PartyBorder, RoundedCornerShape(26.dp)).padding(28.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text("✦", color = Color(0xFFC5A4FF), fontSize = 42.sp, fontWeight = FontWeight.Black)
                        Text("Multi-Mode Party", color = PartyInk, fontSize = 20.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 10.dp))
                        Text("Coming soon", color = Color(0xFFC5A4FF), fontSize = 13.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 5.dp))
                        Text("Voice and video together, in one shared party space.", color = PartyMuted, fontSize = 13.sp, modifier = Modifier.padding(top = 10.dp))
                    }
                }
            }
            }
        }
        YugmBottomDock(
            selected = YugmDockTab.LIVE,
            onDiscover = onDiscover,
            onCreate = onCreateRoom,
            onLive = {},
            onChat = onChat,
            onWallet = onWallet,
            onProfile = onProfile,
            modifier = Modifier.align(Alignment.BottomCenter)
        )
    }
}

@Composable
private fun PartyIcon(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, onClick: () -> Unit) {
    Box(Modifier.size(44.dp).clip(CircleShape).background(PartyPanel).border(1.dp, PartyBorder, CircleShape)
        .semantics { contentDescription = label }.clickable(role = Role.Button, onClickLabel = label, onClick = onClick), contentAlignment = Alignment.Center) {
        Icon(icon, contentDescription = null, modifier = Modifier.size(22.dp), tint = PartyInk)
    }
}

@Composable
private fun PartyTab(label: String, selected: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Box(
        modifier.height(42.dp).clip(RoundedCornerShape(14.dp))
            .background(if (selected) Color(0xFF7136C9) else PartyPanel)
            .border(1.dp, if (selected) Color(0xFFB98AFF) else PartyBorder, RoundedCornerShape(14.dp))
            .semantics { contentDescription = "$label${if (selected) ", selected" else ""}" }
            .clickable(role = Role.Button, onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Text(label, color = PartyInk, fontSize = 11.sp, fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium, maxLines = 1)
    }
}

@Composable
private fun PartyLoadingState(message: String) {
    Column(Modifier.fillMaxWidth().padding(vertical = 90.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        CircularProgressIndicator(color = PartyPurple, strokeWidth = 3.dp)
        Text(message, color = PartyMuted, modifier = Modifier.padding(top = 14.dp))
    }
}

@Composable
private fun PartyEmptyState(title: String, message: String, action: String, onAction: () -> Unit) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 28.dp, vertical = 72.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text("◉", color = PartyPurple, fontSize = 38.sp, fontWeight = FontWeight.Bold)
        Text(title, color = PartyInk, fontSize = 18.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 10.dp))
        Text(message, color = PartyMuted, fontSize = 13.sp, modifier = Modifier.padding(top = 6.dp))
        TextButton(onClick = onAction) { Text(action, color = PartyPurple, fontWeight = FontWeight.Bold) }
    }
}

@Composable
private fun VideoPartyCard(room: Room, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Box(
        modifier.height(224.dp).clip(RoundedCornerShape(20.dp))
            .background(Brush.linearGradient(room.gradient.takeIf { it.size >= 2 } ?: listOf(Color(0xFF302054), Color(0xFF9B4CD0))))
            .border(1.dp, PartyBorder, RoundedCornerShape(20.dp))
            .semantics { contentDescription = "Join video party ${room.title} hosted by ${room.host?.name.orEmpty()}" }
            .clickable(role = Role.Button, onClickLabel = "Join ${room.title}", onClick = onClick)
    ) {
        val image = room.coverImage ?: room.host?.avatar
        if (!image.isNullOrBlank()) {
            AsyncImage(model = image, contentDescription = null, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
        } else {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Avatar(room.host?.name?.take(1) ?: "V", 82, room.host?.avatar, room.host?.activeCosmetics ?: com.yugm.app.core.model.ActiveCosmetics())
            }
        }
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color.Transparent, Color(0xCC050610)))))
        Box(Modifier.align(Alignment.TopStart).padding(9.dp).clip(CircleShape).background(Color(0xFFE54866)).padding(horizontal = 9.dp, vertical = 5.dp)) {
            Text("● LIVE", color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.Black)
        }
        Row(
            Modifier.align(Alignment.TopEnd).padding(9.dp).clip(CircleShape).background(Color(0xCC10111A)).padding(horizontal = 8.dp, vertical = 5.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("◉ ${room.participants}", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold)
        }
        Column(Modifier.align(Alignment.BottomStart).fillMaxWidth().padding(11.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(room.title.ifBlank { "Video party" }, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(room.host?.name?.let { "Hosted by $it" } ?: "Join the party", color = Color.White.copy(alpha = 0.82f), fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
private fun PartyRoomCard(room: Room, onClick: () -> Unit) {
    val colors = room.gradient.takeIf { it.size >= 2 } ?: listOf(Color(0xFF482678), Color(0xFF9B4CD0))
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 18.dp).height(132.dp).clip(RoundedCornerShape(22.dp))
            .background(Brush.linearGradient(colors)).clickable(role = Role.Button, onClickLabel = "Join ${room.title}", onClick = onClick)
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Avatar(room.host?.name?.take(1) ?: "🎙", 86, room.host?.avatar, room.host?.activeCosmetics ?: com.yugm.app.core.model.ActiveCosmetics())
        Column(Modifier.weight(1f).padding(horizontal = 14.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(room.title.ifBlank { "Voice room" }, color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                Text("● LIVE", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Black)
            }
            Text(room.host?.name?.let { "Hosted by $it" } ?: "Join the conversation", color = Color.White.copy(alpha = .85f), fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(room.category.ifBlank { room.language }.ifBlank { "Voice party" }, color = Color.White.copy(alpha = .76f), fontSize = 11.sp, maxLines = 1)
        }
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("◖ ${room.participants}", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.sp)
            Box(Modifier.clip(CircleShape).background(Color.White.copy(alpha = .2f)).padding(horizontal = 14.dp, vertical = 8.dp)) {
                Text("Join", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 12.sp)
            }
        }
    }
}
