package com.example.yugm.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.model.Host
import com.example.yugm.model.Room
import com.example.yugm.ui.components.EmptyRoomsScreen
import com.example.yugm.ui.components.HostRow
import com.example.yugm.ui.components.LoadingState
import com.example.yugm.ui.components.RoomCard
import com.example.yugm.ui.components.SectionTitle
import com.example.yugm.ui.components.YugmTextField
import com.example.yugm.ui.theme.TextMuted
import com.example.yugm.ui.theme.TextPrimary

@Composable
fun SearchScreen(
    onSearch: (String) -> Unit = {},
    results: List<Room> = emptyList(),
    userResults: List<Host> = emptyList(),
    loading: Boolean = false,
    error: String = "",
    onRetry: () -> Unit = {},
    onOpenRoom: (Room) -> Unit = {},
    onFollow: ((String) -> Unit)? = null
) {
    var query by rememberSaveable { mutableStateOf("") }
    LazyColumn(
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 18.dp, bottom = 104.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Text("Search", color = TextPrimary, fontSize = 32.sp, fontWeight = FontWeight.Black)
            Spacer(Modifier.height(12.dp))
            YugmTextField(query, { query = it; onSearch(it) }, "Rooms, hosts, interests")
        }
        if (loading) {
            item { LoadingState("Searching...") }
        }
        if (error.isNotBlank()) {
            item { EmptyRoomsScreen(message = error, onAction = onRetry, action = "Retry") }
        }
        if (!loading && error.isBlank() && query.isNotBlank() && results.isEmpty() && userResults.isEmpty()) {
            item {
                Text("No results for \"$query\"", color = TextMuted, modifier = Modifier.padding(top = 8.dp))
            }
        }
        if (results.isNotEmpty()) {
            item { SectionTitle("Rooms") }
            items(results, key = { it.id }) { room -> RoomCard(room = room, wide = true, onClick = { onOpenRoom(room) }) }
        }
        if (userResults.isNotEmpty()) {
            item { SectionTitle("Users") }
            items(userResults, key = { it.id.ifBlank { it.username } }) { host -> HostRow(host = host, onFollow = onFollow) }
        }
    }
}
