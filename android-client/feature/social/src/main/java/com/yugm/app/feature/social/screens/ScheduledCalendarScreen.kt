package com.yugm.app.feature.social.screens

import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yugm.app.core.api.YugmApi
import com.yugm.app.core.model.Room
import com.yugm.app.core.ui.components.GlassCard
import com.yugm.app.core.ui.components.LoadingState
import com.yugm.app.core.ui.components.YugmAmbientBackground
import com.yugm.app.core.ui.components.YugmPageHeader
import com.yugm.app.core.ui.theme.BorderColor
import com.yugm.app.core.ui.theme.Gold
import com.yugm.app.core.ui.theme.Panel
import com.yugm.app.core.ui.theme.SurfaceElevated
import com.yugm.app.core.ui.theme.TextMuted
import com.yugm.app.core.ui.theme.TextPrimary
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun ScheduledCalendarScreen(
    token: String,
    onBack: () -> Unit,
    onOpenRoom: (String) -> Unit,
) {
    var loading by remember { mutableStateOf(true) }
    var rooms by remember { mutableStateOf<List<Room>>(emptyList()) }

    LaunchedEffect(token) {
        loading = true
        runCatching {
            rooms = withContext(Dispatchers.IO) { YugmApi.scheduledRooms() }
        }
        loading = false
    }

    YugmAmbientBackground {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 30.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                YugmPageHeader("Scheduled Rooms", onBack = onBack)
            }
            if (loading) {
                item { Box(Modifier.padding(horizontal = 20.dp)) { LoadingState("Loading scheduled rooms...") } }
            } else if (rooms.isEmpty()) {
                item {
                    Box(Modifier.padding(horizontal = 20.dp)) {
                        GlassCard {
                            Text("No scheduled rooms yet.", color = TextPrimary, fontWeight = FontWeight.Black)
                        }
                    }
                }
            } else {
                items(rooms, key = { it.id }) { room ->
                    ScheduledRoomRow(room = room, onClick = { onOpenRoom(room.id) })
                }
            }
        }
    }
}

@Composable
private fun ScheduledRoomRow(room: Room, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .padding(horizontal = 20.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(SurfaceElevated)
            .clickable(onClick = onClick)
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .width(4.dp)
                .height(52.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(Gold)
        )
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(room.title, color = TextPrimary, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 4.dp)) {
                Text(room.host?.name ?: "Unknown", color = TextMuted, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.width(8.dp))
                Text("●", color = Gold, fontSize = 8.sp)
                Spacer(Modifier.width(8.dp))
                Text(room.category, color = TextMuted, fontSize = 12.sp)
            }
            if (room.scheduledFor.isNotBlank()) {
                Text(
                    room.scheduledFor,
                    color = Gold,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
        }
    }
}
