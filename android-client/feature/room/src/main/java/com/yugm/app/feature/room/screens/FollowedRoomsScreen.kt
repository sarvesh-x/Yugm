package com.yugm.app.feature.room.screens

import com.yugm.app.core.api.SyncTopic
import com.yugm.app.core.ui.components.AutomaticSyncEffect
import com.yugm.app.core.ui.components.YugmTopBar
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yugm.app.core.api.YugmApi
import com.yugm.app.core.model.Room
import com.yugm.app.core.ui.theme.LocalYugmColors
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import com.yugm.app.core.ui.components.YugmLoadingSpinner

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FollowedRoomsScreen(
    token: String,
    onBack: () -> Unit,
    onOpenRoom: (Room) -> Unit
) {
    val colors = LocalYugmColors.current
    val scope = rememberCoroutineScope()
    val snackbar = remember { SnackbarHostState() }
    var rooms by remember { mutableStateOf<List<Room>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var busyRoomId by remember { mutableStateOf<String?>(null) }
    var reportRoom by remember { mutableStateOf<Room?>(null) }

    fun refresh() {
        scope.launch {
            loading = true
            error = null
            runCatching { withContext(Dispatchers.IO) { YugmApi.followedRooms(token) } }
                .onSuccess { rooms = it }
                .onFailure { error = it.message ?: "Could not load followed rooms" }
            loading = false
        }
    }

    AutomaticSyncEffect(token, topics = setOf(SyncTopic.ROOMS), enabled = token.isNotBlank(), isBusy = { loading }) { refresh() }

    fun unfollow(room: Room) {
        if (busyRoomId != null) return
        scope.launch {
            busyRoomId = room.id
            runCatching { withContext(Dispatchers.IO) { YugmApi.unfollowRoom(token, room.id) } }
                .onSuccess {
                    rooms = rooms.filterNot { it.id == room.id }
                    snackbar.showSnackbar("${room.title} removed from followed rooms")
                }
                .onFailure { snackbar.showSnackbar(it.message ?: "Could not remove room") }
            busyRoomId = null
        }
    }

    Scaffold(
        containerColor = colors.background,
        snackbarHost = { SnackbarHost(snackbar) },
        topBar = {
            YugmTopBar(
                title = "Followed rooms",
                onBack = onBack,
            )
        }
    ) { padding ->
        when {
            loading && rooms.isEmpty() -> Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                YugmLoadingSpinner(size = 40.dp)
            }
            error != null && rooms.isEmpty() -> Column(
                Modifier.fillMaxSize().padding(padding).padding(28.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Text("We couldn’t load your rooms", color = colors.textPrimary, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Text(error.orEmpty(), color = colors.textSecondary, fontSize = 13.sp, modifier = Modifier.padding(top = 6.dp))
                TextButton(onClick = ::refresh) { Text("Try again", color = colors.primary) }
            }
            rooms.isEmpty() -> Column(
                Modifier.fillMaxSize().padding(padding).padding(horizontal = 32.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Box(Modifier.size(68.dp).clip(CircleShape).background(colors.primary.copy(alpha = .12f)), contentAlignment = Alignment.Center) {
                    Icon(Icons.Filled.Bookmark, contentDescription = null, tint = colors.primary, modifier = Modifier.size(30.dp))
                }
                Text("Your room list is ready", color = colors.textPrimary, fontWeight = FontWeight.Bold, fontSize = 18.sp, modifier = Modifier.padding(top = 14.dp))
                Text("Follow rooms from Party to keep your favorites here and find them when they go live.", color = colors.textSecondary, fontSize = 13.sp, modifier = Modifier.padding(top = 6.dp))
                TextButton(onClick = onBack, modifier = Modifier.padding(top = 8.dp)) { Text("Explore Party", color = colors.primary, fontWeight = FontWeight.Bold) }
            }
            else -> LazyColumn(
                modifier = Modifier.fillMaxSize().padding(padding),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 14.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                item {
                    Text("Followed rooms stay easy to find. You can leave this list or report a room at any time.", color = colors.textSecondary, fontSize = 12.sp, modifier = Modifier.padding(bottom = 2.dp))
                }
                items(rooms, key = { it.id }) { room ->
                    val isLive = room.status.equals("LIVE", true)
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        color = colors.surface,
                        shape = RoundedCornerShape(20.dp),
                        border = BorderStroke(1.dp, colors.border)
                    ) {
                        Column(Modifier.padding(15.dp)) {
                            Row(verticalAlignment = Alignment.Top) {
                                Box(
                                    Modifier.size(44.dp).clip(RoundedCornerShape(14.dp)).background(colors.primary.copy(alpha = .12f)),
                                    contentAlignment = Alignment.Center
                                ) { Text(if (room.type.name.equals("VIDEO", true)) "📹" else "🎙️", fontSize = 21.sp) }
                                Column(Modifier.weight(1f).padding(start = 11.dp, end = 4.dp)) {
                                    Text(room.title.ifBlank { "Untitled room" }, color = colors.textPrimary, fontWeight = FontWeight.Bold, fontSize = 15.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    Text("Hosted by ${room.host?.name?.ifBlank { "Yugm creator" } ?: "Yugm creator"}", color = colors.textSecondary, fontSize = 12.sp, modifier = Modifier.padding(top = 3.dp), maxLines = 1, overflow = TextOverflow.Ellipsis)
                                }
                                TextButton(onClick = { reportRoom = room }) { Text("Report", color = colors.danger, fontSize = 11.sp) }
                            }
                            Row(
                                Modifier.fillMaxWidth().padding(top = 13.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Surface(color = if (isLive) colors.success.copy(alpha = .12f) else colors.surfaceElevated, shape = CircleShape) {
                                    Text(
                                        if (isLive) "● Live · ${room.participants} here" else room.status.lowercase().replaceFirstChar { it.uppercase() },
                                        color = if (isLive) colors.success else colors.textSecondary,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                                    )
                                }
                                Spacer(Modifier.weight(1f))
                                TextButton(onClick = { unfollow(room) }, enabled = busyRoomId != room.id) {
                                    if (busyRoomId == room.id) YugmLoadingSpinner(size = 15.dp)
                                    else Text("Remove", color = colors.textSecondary, fontSize = 12.sp)
                                }
                                if (isLive) {
                                    Button(
                                        onClick = { onOpenRoom(room) },
                                        colors = ButtonDefaults.buttonColors(containerColor = colors.primary),
                                        shape = RoundedCornerShape(12.dp),
                                        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp)
                                    ) {
                                        Icon(Icons.Filled.PlayArrow, contentDescription = null, modifier = Modifier.size(17.dp))
                                        Spacer(Modifier.width(3.dp))
                                        Text("Open", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    reportRoom?.let { room ->
        val reasons = listOf("Inappropriate content", "Harassment", "Spam", "Other")
        AlertDialog(
            onDismissRequest = { reportRoom = null },
            title = { Text("Report ${room.title.ifBlank { "room" }}", color = colors.textPrimary, fontWeight = FontWeight.Bold) },
            text = {
                Column {
                    Text("Choose the reason that best describes the issue.", color = colors.textSecondary, fontSize = 13.sp)
                    reasons.forEach { reason ->
                        TextButton(
                            onClick = {
                                reportRoom = null
                                scope.launch {
                                    runCatching {
                                        withContext(Dispatchers.IO) {
                                            YugmApi.reportUser(token, room.id, room.host?.id.orEmpty(), reason)
                                        }
                                    }.onSuccess { snackbar.showSnackbar("Report submitted for review") }
                                        .onFailure { snackbar.showSnackbar(it.message ?: "Could not submit report") }
                                }
                            },
                            modifier = Modifier.fillMaxWidth()
                        ) { Text(reason, color = colors.textPrimary, modifier = Modifier.fillMaxWidth()) }
                    }
                }
            },
            confirmButton = { TextButton(onClick = { reportRoom = null }) { Text("Cancel", color = colors.primary) } },
            containerColor = colors.surface
        )
    }
}
