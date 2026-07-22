package com.example.yugm.feature.social.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
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
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.example.yugm.core.model.RoomRecording
import com.example.yugm.core.ui.components.Avatar
import com.example.yugm.core.ui.components.GlassCard
import com.example.yugm.core.ui.components.LoadingState
import com.example.yugm.core.ui.components.YugmAmbientBackground
import com.example.yugm.core.ui.components.YugmPageHeader
import com.example.yugm.core.ui.theme.Cyan
import com.example.yugm.core.ui.theme.Gold
import com.example.yugm.core.ui.theme.Line
import com.example.yugm.core.ui.theme.Panel
import com.example.yugm.core.ui.theme.Pink
import com.example.yugm.core.ui.theme.Success
import com.example.yugm.core.ui.theme.TextMuted
import com.example.yugm.core.ui.theme.TextPrimary
import com.example.yugm.feature.social.viewmodel.RecordingViewModel

@Composable
fun RecordingsScreen(
    token: String,
    roomId: String? = null,
    onBack: () -> Unit,
    onPlayRecording: (String) -> Unit
) {
    val viewModel: RecordingViewModel = hiltViewModel()

    LaunchedEffect(token, roomId) {
        if (roomId != null) {
            viewModel.loadRecordings(token, roomId)
        }
    }

    YugmAmbientBackground {
        if (roomId == null) {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(bottom = 30.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                item { YugmPageHeader("Recordings", onBack = onBack) }
                item {
                    Box(
                        modifier = Modifier
                            .padding(horizontal = 20.dp)
                            .fillMaxWidth()
                            .height(200.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("Select a room to view recordings", color = TextMuted, fontSize = 16.sp)
                    }
                }
            }
        } else if (viewModel.isLoading) {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(bottom = 30.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                item { YugmPageHeader("Recordings", onBack = onBack) }
                item { Box(Modifier.padding(horizontal = 20.dp)) { LoadingState("Loading recordings…") } }
            }
        } else if (viewModel.recordings.isEmpty()) {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(bottom = 30.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                item { YugmPageHeader("Recordings", onBack = onBack) }
                item {
                    Box(Modifier.padding(horizontal = 20.dp)) {
                        GlassCard {
                            Text("No recordings for this room.", color = TextMuted, fontSize = 12.sp)
                        }
                    }
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(bottom = 30.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                item { YugmPageHeader("Recordings", "${viewModel.recordings.size} recordings", onBack = onBack) }
                items(viewModel.recordings, key = { it.id }) { recording ->
                    Column(Modifier.padding(horizontal = 20.dp)) {
                        RecordingItem(recording = recording, onClick = { onPlayRecording(recording.id) })
                    }
                }
            }
        }
    }
}

@Composable
private fun RecordingItem(recording: RoomRecording, onClick: () -> Unit) {
    val statusColor = when (recording.status) {
        "READY" -> Success
        "PROCESSING" -> Gold
        "FAILED" -> Pink
        else -> TextMuted
    }
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Panel)
            .border(1.dp, Line, RoundedCornerShape(16.dp))
            .clickable(onClick = onClick)
            .padding(14.dp)
    ) {
        Avatar(
            initial = recording.hostName.firstOrNull()?.toString() ?: "?",
            size = 44,
            imageUrl = recording.hostAvatar
        )
        Column(Modifier.weight(1f)) {
            Text(
                recording.title.ifBlank { "Untitled Recording" },
                color = TextPrimary,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(top = 4.dp)
            ) {
                Text(recording.hostName, color = TextMuted, fontSize = 12.sp)
                Box(Modifier.size(3.dp).clip(CircleShape).background(TextMuted))
                Text(formatDuration(recording.duration), color = Cyan, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                Box(Modifier.size(3.dp).clip(CircleShape).background(TextMuted))
                Text("${recording.viewCount} views", color = TextMuted, fontSize = 12.sp)
            }
        }
        Column(horizontalAlignment = Alignment.End) {
            Text(recording.status, color = statusColor, fontWeight = FontWeight.Black, fontSize = 11.sp)
        }
    }
}

private fun formatDuration(seconds: Int): String {
    val m = seconds / 60
    val s = seconds % 60
    return "$m:${s.toString().padStart(2, '0')}"
}
