package com.example.yugm.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.example.yugm.model.Room
import com.example.yugm.ui.components.CategoryChips
import com.example.yugm.ui.components.LoadingState
import com.example.yugm.ui.components.RoomCard
import com.example.yugm.ui.components.SearchBar
import com.example.yugm.ui.theme.TextMuted
import com.example.yugm.ui.theme.TextPrimary
import com.example.yugm.ui.viewmodel.DiscoverViewModel

@Composable
fun DiscoverScreen(
    onOpenRoom: (Room) -> Unit,
    onSearch: () -> Unit,
    viewModel: DiscoverViewModel = hiltViewModel()
) {
    LaunchedEffect(Unit) {
        viewModel.refreshRooms()
    }

    LazyColumn(
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 18.dp, bottom = 104.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
        modifier = Modifier.fillMaxSize()
    ) {
        item {
            Text("Discover", color = TextPrimary, fontSize = 32.sp, fontWeight = FontWeight.Black)
            Text("Find your tribe. Join live audio and video vibes.", color = TextMuted, modifier = Modifier.padding(top = 6.dp))
            SearchBar(onSearch = onSearch)
            CategoryChips()
        }

        if (viewModel.isLoading) {
            item { LoadingState("Fetching live rooms...") }
        } else {
            items(viewModel.rooms, key = { it.id }) { room ->
                RoomCard(room = room, wide = true, onClick = { onOpenRoom(room) })
            }
        }
    }
}
