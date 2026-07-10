package com.example.yugm.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.TextButton
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.api.YugmApi
import com.example.yugm.model.Host
import com.example.yugm.model.Room
import com.example.yugm.ui.components.*
import kotlinx.coroutines.launch
import com.example.yugm.ui.theme.TextMuted
import com.example.yugm.ui.theme.TextPrimary

@Composable
fun SearchScreen(
    token: String,
    onBack: () -> Unit,
    onOpenRoom: (Room) -> Unit,
    onOpenProfile: (String) -> Unit
) {
    var query by remember { mutableStateOf("") }
    var rooms by remember { mutableStateOf<List<Room>>(emptyList()) }
    var users by remember { mutableStateOf<List<Host>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }
    var busyHostId by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    LaunchedEffect(query) {
        val trimmed = query.trim()
        if (trimmed.length < 2) {
            rooms = emptyList()
            users = emptyList()
            error = null
            return@LaunchedEffect
        }
        runCatching {
            val roomResults = YugmApi.searchRooms(trimmed)
            val userResults = YugmApi.searchUsers(trimmed, token.ifBlank { null })
            roomResults to userResults
        }.onSuccess {
            rooms = it.first
            users = it.second
            error = null
        }.onFailure {
            error = it.message ?: "Search failed"
        }
    }
    
    Column(modifier = Modifier.fillMaxSize().padding(horizontal = 20.dp)) {
        Spacer(modifier = Modifier.height(18.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            TextButton(onClick = onBack) { Text("Back", color = TextMuted) }
            Text("Search", color = TextPrimary, fontSize = 32.sp, fontWeight = FontWeight.Black)
        }
        YugmTextField(
            value = query,
            onValueChange = { query = it },
            label = "Search rooms, users, tags..."
        )
        
        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(14.dp),
            contentPadding = PaddingValues(top = 20.dp, bottom = 100.dp)
        ) {
            if (query.trim().length < 2) {
                item { Text("Type at least 2 characters to search.", color = TextMuted) }
            } else if (error != null) {
                item { Text(error ?: "", color = TextMuted) }
            } else {
                if (rooms.isNotEmpty()) item { SectionTitle("Rooms") }
                items(rooms, key = { "room-${it.id}" }) { room ->
                    RoomCard(room = room, wide = true, onClick = { onOpenRoom(room) })
                }
                if (users.isNotEmpty()) item { SectionTitle("People") }
                items(users, key = { "user-${it.id}" }) { host ->
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
                                    users = users.map { if (it.id == hostId) it.copy(isFollowing = !it.isFollowing) else it }
                                }
                                busyHostId = ""
                            }
                        }
                    )
                }
                if (rooms.isEmpty() && users.isEmpty()) {
                    item { Text("No rooms or people match this search.", color = TextMuted) }
                }
            }
        }
    }
}
