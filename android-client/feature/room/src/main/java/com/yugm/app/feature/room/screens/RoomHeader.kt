package com.yugm.app.feature.room.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.PowerSettingsNew
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.key
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.runtime.withFrameNanos
import com.yugm.app.core.model.ActiveCosmetics
import com.yugm.app.core.model.Room
import com.yugm.app.core.model.RoomParticipant
import com.yugm.app.core.ui.components.Avatar

private val HeaderText = Color.White
private val HeaderMuted = Color(0xFFCBC5D5)
private val HeaderSurface = Color(0x663C2A48)

@Composable
internal fun SharedRoomHeader(
    room: Room,
    participants: List<RoomParticipant>,
    isHost: Boolean,
    onShare: () -> Unit,
    onMore: () -> Unit,
    onRankClick: () -> Unit,
    onLeave: () -> Unit,
    modifier: Modifier = Modifier
) {
    val host = room.host
    val memberCount = room.participants.coerceAtLeast(participants.size)

    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(Color(0x42201831))
            .padding(start = 12.dp, end = 10.dp, top = 5.dp, bottom = 8.dp),
        verticalArrangement = Arrangement.spacedBy(3.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
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
            HeaderAction(Icons.Filled.MoreVert, "Room options", onMore)
            HeaderAction(Icons.Filled.PowerSettingsNew, if (isHost) "End room" else "Leave room", onLeave)
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                modifier = Modifier.weight(1f),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    modifier = Modifier
                        .clip(CircleShape)
                        .background(Color(0x664A3515))
                        .border(1.dp, Color(0x99FFC247), CircleShape)
                        .clickable(onClick = onRankClick)
                        .padding(horizontal = 9.dp, vertical = 5.dp)
                        .semantics { contentDescription = "Room rank 1" },
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("🏆", fontSize = 11.sp)
                    Text(" 1 ›", color = Color(0xFFFFC247), fontSize = 11.sp, fontWeight = FontWeight.Black)
                }
            }
            val membersScrollState = androidx.compose.foundation.rememberScrollState()
            val memberIds = participants.map { it.user.id.ifBlank { it.id } }
            LaunchedEffect(memberIds) {
                withFrameNanos { }
                membersScrollState.scrollTo(membersScrollState.maxValue)
            }
            BoxWithConstraints(
                modifier = Modifier
                    .weight(1f)
                    .semantics { contentDescription = "Room members, $memberCount total" }
            ) {
                Row(
                    modifier = Modifier.horizontalScroll(membersScrollState).widthIn(min = maxWidth),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.End)
                ) {
                    participants.asReversed().forEach { participant ->
                        key(participant.user.id.ifBlank { participant.id }) {
                            Avatar(
                                participant.user.name.firstOrNull()?.toString() ?: "?",
                                18,
                                participant.user.avatar,
                                participant.user.activeCosmetics
                            )
                        }
                    }
                }
            }
            Row(
                modifier = Modifier
                    .padding(start = 9.dp)
                    .clip(CircleShape)
                    .background(HeaderSurface)
                    .border(1.dp, Color(0x33FFFFFF), CircleShape)
                    .padding(horizontal = 7.dp, vertical = 5.dp)
                    .semantics { contentDescription = "$memberCount people in room" },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text("•", color = Color(0xFF64E69A), fontSize = 13.sp)
                Text("$memberCount", color = HeaderText, fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun HeaderAction(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, onClick: () -> Unit) {
    IconButton(
        onClick = onClick,
        modifier = Modifier.size(34.dp).semantics { contentDescription = label }
    ) {
        Icon(icon, contentDescription = null, tint = HeaderText, modifier = Modifier.size(19.dp))
    }
}
