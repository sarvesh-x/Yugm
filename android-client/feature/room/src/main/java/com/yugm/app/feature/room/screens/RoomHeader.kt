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
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PowerSettingsNew
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.TextButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yugm.app.core.model.ActiveCosmetics
import com.yugm.app.core.model.Room
import com.yugm.app.core.model.RoomParticipant
import com.yugm.app.core.ui.components.Avatar
import coil.compose.AsyncImage

private val HeaderText = Color.White
private val HeaderMuted = Color(0xFFCBC5D5)
private val HeaderSurface = Color(0xFF3A1E3E)

@Composable
internal fun SharedRoomHeader(
    room: Room,
    participants: List<RoomParticipant>,
    isHost: Boolean,
    isRoomAdmin: Boolean = false,
    onShare: () -> Unit,
    onRoomInfo: () -> Unit = {},
    isFollowingRoom: Boolean = false,
    onToggleRoomFollow: () -> Unit = {},
    onViewListeners: () -> Unit = {},
    onMore: () -> Unit = {},
    onClearChat: () -> Unit = {},
    onMuteAll: () -> Unit = {},
    onUnmuteAll: () -> Unit = {},
    onLockAllMics: () -> Unit = {},
    onUnlockAllMics: () -> Unit = {},
    onReportRoom: () -> Unit = {},
    onBlockRoom: () -> Unit = {},
    onFeedback: () -> Unit = {},
    onRankClick: () -> Unit,
    onLeave: () -> Unit,
    modifier: Modifier = Modifier
) {
    var menuExpanded by remember { mutableStateOf(false) }
    val host = room.host
    val memberCount = participants.size

    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(HeaderSurface.copy(alpha = 0.58f))
            .padding(top = 5.dp, bottom = 8.dp),
        verticalArrangement = Arrangement.spacedBy(7.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(Modifier.clickable(onClick = onRoomInfo)) {
                if (!room.coverImage.isNullOrBlank()) {
                    Avatar(room.title.firstOrNull()?.toString() ?: "?", 38, room.coverImage, ActiveCosmetics())
                } else {
                    Box(
                        Modifier.size(42.dp).clip(CircleShape)
                            .background(Brush.linearGradient(listOf(Color(0xFF3A1761), Color(0xFF171326))))
                            .border(1.dp, Color(0x77B98AFF), CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Filled.Mic, contentDescription = "Room avatar", tint = Color(0xFFD9B8FF), modifier = Modifier.size(21.dp))
                    }
                }
                if (!isHost) {
                    Box(
                        Modifier.align(Alignment.BottomEnd).offset(x = 4.dp, y = 3.dp)
                            .size(21.dp).clip(CircleShape)
                            .background(if (isFollowingRoom) Color(0xFF29B77D) else Color(0xFF7045F5))
                            .border(1.5.dp, Color.White, CircleShape)
                            .clickable(onClick = onToggleRoomFollow)
                            .semantics { contentDescription = if (isFollowingRoom) "Unfollow room" else "Follow room" },
                        contentAlignment = Alignment.Center
                    ) {
                        Text(if (isFollowingRoom) "✓" else "+", color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.Black, lineHeight = 16.sp)
                    }
                }
            }
            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(start = 8.dp, end = 3.dp),
                verticalArrangement = Arrangement.Center
            ) {
                Text(
                    text = room.title.ifBlank { host?.name?.ifBlank { "Live room" } ?: "Live room" },
                    color = HeaderText,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text("ID:${room.id.takeLast(8)}", color = HeaderMuted, fontSize = 10.sp, maxLines = 1)
            }
            Spacer(Modifier.width(6.dp))
            HeaderAction(Icons.Filled.Share, "Share room", onShare)
            Box {
                HeaderAction(Icons.Filled.MoreVert, "Room options", { menuExpanded = true })
                DropdownMenu(expanded = menuExpanded, onDismissRequest = { menuExpanded = false }) {
                    if (isHost || isRoomAdmin) {
                        DropdownMenuItem(text = { Text("Clear room chat") }, onClick = { menuExpanded = false; onClearChat() })
                        DropdownMenuItem(text = { Text("Mute all") }, onClick = { menuExpanded = false; onMuteAll() })
                        DropdownMenuItem(text = { Text("Unmute all") }, onClick = { menuExpanded = false; onUnmuteAll() })
                        DropdownMenuItem(text = { Text("Lock all mics") }, onClick = { menuExpanded = false; onLockAllMics() })
                        DropdownMenuItem(text = { Text("Unlock all mics") }, onClick = { menuExpanded = false; onUnlockAllMics() })
                    } else {
                        DropdownMenuItem(text = { Text("Report room") }, onClick = { menuExpanded = false; onReportRoom() })
                        DropdownMenuItem(text = { Text("Block") }, onClick = { menuExpanded = false; onBlockRoom() })
                        DropdownMenuItem(text = { Text("Feedback") }, onClick = { menuExpanded = false; onFeedback() })
                    }
                }
            }
            HeaderAction(Icons.Filled.PowerSettingsNew, if (isHost) "End room" else "Leave room", onLeave)
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                modifier = Modifier
                    .clip(RoundedCornerShape(topStart = 0.dp, bottomStart = 0.dp, topEnd = 50.dp, bottomEnd = 50.dp))
                    .background(Color(0xFF7A6368).copy(alpha = 0.45f))
                    .clickable(onClick = onRankClick)
                    .padding(start = 9.dp, end = 12.dp, top = 6.dp, bottom = 6.dp)
                    .semantics { contentDescription = "Room rank 1" },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(5.dp)
            ) {
                Icon(Icons.Filled.EmojiEvents, contentDescription = null, tint = Color(0xFFFFB82E), modifier = Modifier.size(20.dp))
                Text("1", color = Color(0xFFFFB82E), fontSize = 15.sp, fontWeight = FontWeight.Bold)
                Text("›", color = Color(0xFFFFC75B), fontSize = 20.sp, fontWeight = FontWeight.Medium)
            }
            Box(
                modifier = Modifier
                    .weight(1f)
                    .padding(start = 8.dp, end = 12.dp)
                    .height(42.dp)
                    .semantics { contentDescription = "Room members, $memberCount total" },
                contentAlignment = Alignment.CenterEnd
            ) {
                LazyRow(
                    modifier = Modifier.fillMaxWidth(),
                    contentPadding = PaddingValues(end = 40.dp),
                    // Avatar includes a transparent frame inset; keep row spacing compact
                    // while leaving a small visible gap before the listener count.
                    horizontalArrangement = Arrangement.spacedBy(0.dp, Alignment.End),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    items(participants.asReversed(), key = { it.user.id.ifBlank { it.id } }) { participant ->
                        Avatar(
                            participant.user.name.firstOrNull()?.toString() ?: "?",
                            28,
                            participant.user.avatar,
                            participant.user.activeCosmetics
                        )
                    }
                }
                Box(
                    modifier = Modifier
                        .size(38.dp)
                        .clip(CircleShape)
                        .background(Color(0xFF7D6B82).copy(alpha = 0.55f))
                        .clickable(onClick = onViewListeners)
                        .semantics { contentDescription = "$memberCount people in room" },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Filled.Person, contentDescription = null, tint = Color.White.copy(alpha = 0.16f), modifier = Modifier.size(30.dp))
                    Text("$memberCount", color = HeaderText, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun HeaderAction(icon: ImageVector, label: String, onClick: () -> Unit) {
    IconButton(
        onClick = onClick,
        modifier = Modifier.size(34.dp).semantics { contentDescription = label }
    ) {
        Icon(icon, contentDescription = null, tint = HeaderText, modifier = Modifier.size(19.dp))
    }
}

@Composable
fun RoomFollowPromptDialog(room: Room, onDismiss: () -> Unit, onFollow: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = null,
        text = {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(18.dp)) {
                Row(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(Color(0xFFF0F8FF)).padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Box(Modifier.size(76.dp).clip(RoundedCornerShape(18.dp)).background(Brush.linearGradient(listOf(Color(0xFFBCEAFF), Color(0xFFDCD1FF)))), contentAlignment = Alignment.Center) {
                        if (!room.coverImage.isNullOrBlank()) AsyncImage(model = room.coverImage, contentDescription = "Room cover", modifier = Modifier.fillMaxWidth().height(76.dp).clip(RoundedCornerShape(18.dp)))
                        else Icon(Icons.Filled.Mic, contentDescription = null, tint = Color(0xFF7045F5), modifier = Modifier.size(30.dp))
                    }
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                        Text(room.title.ifBlank { "Live room" }, color = Color(0xFF171421), fontSize = 17.sp, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                        Text("ID:${room.id.takeLast(8)}", color = Color(0xFF8F91A0), fontSize = 13.sp)
                    }
                }
                Text("Follow the room to receive party news!", color = Color(0xFF171421), fontSize = 19.sp, lineHeight = 25.sp, fontWeight = FontWeight.Bold, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
            }
        },
        confirmButton = {
            Button(onClick = onFollow, modifier = Modifier.fillMaxWidth().height(54.dp), shape = RoundedCornerShape(18.dp), colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF3293F7))) {
                Text("Follow", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, modifier = Modifier.fillMaxWidth()) { Text("Maybe later", color = Color(0xFF898697)) }
        },
        shape = RoundedCornerShape(28.dp),
        containerColor = Color.White
    )
}
