package com.example.yugm.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.model.Room
import com.example.yugm.model.RoomType
import com.example.yugm.ui.components.BrandHeader
import com.example.yugm.ui.components.CategoryChips
import com.example.yugm.ui.components.EmptyRoomsScreen
import com.example.yugm.ui.components.HostRow
import com.example.yugm.ui.components.LoadingState
import com.example.yugm.ui.components.RoomCarousel
import com.example.yugm.ui.components.RoomCard
import com.example.yugm.ui.components.SearchBar
import com.example.yugm.ui.components.SectionTitle
import com.example.yugm.ui.components.SmallAction
import com.example.yugm.ui.theme.TextMuted

@Composable
fun DiscoverScreen(
    name: String,
    rooms: List<Room>,
    loading: Boolean,
    error: String,
    onOpenRoom: (Room) -> Unit,
    onCreate: () -> Unit,
    onRetry: () -> Unit,
    onFollow: ((String) -> Unit)? = null,
    onSearch: () -> Unit = {}
) {
    val hosts = rooms.mapNotNull { it.host }.distinctBy { it.id }
    LazyColumn(
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 8.dp, bottom = 104.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
        modifier = Modifier.fillMaxSize()
    ) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                Column {
                    BrandHeader(compact = true)
                    Text("Hey ${name.split(" ").firstOrNull().orEmpty()}, find your room.", color = TextMuted, modifier = Modifier.padding(top = 8.dp))
                }
                SmallAction(label = "+", onClick = onCreate)
            }
            SearchBar(onSearch = onSearch)
            CategoryChips()
        }
        if (loading) {
            item { LoadingState("Loading live rooms...") }
        }
        if (error.isNotBlank()) {
            item { EmptyRoomsScreen(message = error, onAction = onRetry, action = "Retry") }
        }
        if (!loading && error.isBlank() && rooms.isEmpty()) {
            item { EmptyRoomsScreen(message = "No live rooms yet. Be the first to create one!", onAction = onCreate, action = "Create room") }
        }
        item { SectionTitle("Featured live") }
        if (rooms.isNotEmpty()) item { RoomCarousel(rooms = rooms, onOpenRoom = onOpenRoom) }
        if (rooms.any { it.type == RoomType.Voice }) item { SectionTitle("Voice rooms") }
        items(rooms.filter { it.type == RoomType.Voice }, key = { it.id }) { room -> RoomCard(room = room, wide = true, onClick = { onOpenRoom(room) }) }
        if (rooms.any { it.type == RoomType.Video }) item { SectionTitle("Video rooms") }
        items(rooms.filter { it.type == RoomType.Video }, key = { it.id }) { room -> RoomCard(room = room, wide = true, onClick = { onOpenRoom(room) }) }
        if (hosts.isNotEmpty()) item { SectionTitle("Popular hosts") }
        items(hosts, key = { it.id.ifBlank { it.username } }) { host -> HostRow(host = host, onFollow = onFollow) }
    }
}
