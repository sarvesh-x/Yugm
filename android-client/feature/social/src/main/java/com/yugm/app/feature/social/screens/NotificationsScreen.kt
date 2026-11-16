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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.NotificationsNone
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import com.yugm.app.core.model.NotificationItem
import com.yugm.app.core.ui.components.LoadingState
import com.yugm.app.core.ui.theme.LocalYugmColors
import com.yugm.app.feature.social.viewmodel.NotificationsViewModel

private enum class NotificationFilter { ALL, UNREAD }

@Composable
fun NotificationsScreen(
    token: String,
    onBack: () -> Unit,
    onOpenTarget: (NotificationItem) -> Unit
) {
    val viewModel: NotificationsViewModel = hiltViewModel()
    val colors = LocalYugmColors.current
    var filter by remember { mutableStateOf(NotificationFilter.ALL) }

    LaunchedEffect(token) {
        if (token.isNotBlank()) viewModel.load(token)
    }

    Column(
        Modifier.fillMaxSize().background(colors.background).padding(horizontal = 18.dp)
    ) {
        Row(
            Modifier.fillMaxWidth().padding(top = 10.dp, bottom = 18.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = colors.textPrimary)
            }
            Column(Modifier.weight(1f).padding(start = 4.dp)) {
                Text("Notifications", color = colors.textPrimary, fontSize = 25.sp, fontWeight = FontWeight.Bold)
                Text(
                    if (viewModel.unreadCount == 0) "You're all caught up" else "${viewModel.unreadCount} unread updates",
                    color = colors.textSecondary,
                    fontSize = 12.sp
                )
            }
            if (viewModel.unreadCount > 0) {
                TextButton(
                    enabled = !viewModel.isMarkingAllRead,
                    onClick = { viewModel.markAllRead(token) }
                ) {
                    if (viewModel.isMarkingAllRead) {
                        CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp, color = colors.primary)
                    } else Text("Mark all read", color = colors.primary, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                }
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(bottom = 14.dp)) {
            NotificationFilterChip("All", filter == NotificationFilter.ALL, "${viewModel.notifications.size}") {
                filter = NotificationFilter.ALL
            }
            NotificationFilterChip("Unread", filter == NotificationFilter.UNREAD, "${viewModel.unreadCount}") {
                filter = NotificationFilter.UNREAD
            }
        }

        val visibleNotifications = if (filter == NotificationFilter.UNREAD) {
            viewModel.notifications.filterNot { it.read }
        } else viewModel.notifications

        when {
            viewModel.isLoading && viewModel.notifications.isEmpty() -> LoadingState("Loading your updates…")
            viewModel.error != null && viewModel.notifications.isEmpty() -> NotificationEmptyState(
                title = "Couldn't load notifications",
                message = viewModel.error.orEmpty(),
                action = "Try again",
                onAction = { viewModel.load(token) }
            )
            visibleNotifications.isEmpty() -> NotificationEmptyState(
                title = if (filter == NotificationFilter.UNREAD) "No unread updates" else "Nothing here yet",
                message = if (filter == NotificationFilter.UNREAD) "New activity will show up here." else "Messages, follows, room invites, and other activity will appear here.",
                action = if (filter == NotificationFilter.UNREAD) "Show all" else null,
                onAction = { filter = NotificationFilter.ALL }
            )
            else -> LazyColumn(
                contentPadding = PaddingValues(bottom = 100.dp),
                verticalArrangement = Arrangement.spacedBy(9.dp)
            ) {
                items(visibleNotifications, key = { it.id }) { item ->
                    NotificationRow(item) {
                        if (!item.read) viewModel.markRead(token, item.id)
                        onOpenTarget(item)
                    }
                }
            }
        }
    }
}

@Composable
private fun NotificationFilterChip(label: String, selected: Boolean, count: String, onClick: () -> Unit) {
    val colors = LocalYugmColors.current
    Surface(
        onClick = onClick,
        shape = CircleShape,
        color = if (selected) colors.primary.copy(alpha = 0.12f) else colors.surface,
        border = androidx.compose.foundation.BorderStroke(1.dp, if (selected) colors.primary.copy(alpha = 0.45f) else colors.border)
    ) {
        Row(
            Modifier.padding(horizontal = 14.dp, vertical = 9.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(7.dp)
        ) {
            Text(label, color = if (selected) colors.primary else colors.textSecondary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            Text(count, color = if (selected) colors.primary else colors.textSecondary, fontSize = 11.sp)
        }
    }
}

@Composable
private fun NotificationEmptyState(title: String, message: String, action: String?, onAction: () -> Unit) {
    val colors = LocalYugmColors.current
    Column(
        Modifier.fillMaxWidth().padding(top = 54.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(
            Modifier.size(62.dp).clip(CircleShape).background(colors.surfaceElevated),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Filled.NotificationsNone, contentDescription = null, tint = colors.textSecondary, modifier = Modifier.size(30.dp))
        }
        Text(title, color = colors.textPrimary, fontWeight = FontWeight.Bold, fontSize = 17.sp, modifier = Modifier.padding(top = 14.dp))
        Text(message, color = colors.textSecondary, fontSize = 13.sp, lineHeight = 19.sp, modifier = Modifier.padding(top = 5.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
        if (action != null) TextButton(onClick = onAction) { Text(action, color = colors.primary) }
    }
}

@Composable
private fun NotificationRow(item: NotificationItem, onClick: () -> Unit) {
    val colors = LocalYugmColors.current
    val tint = when (item.type.uppercase()) {
        "MESSAGE" -> colors.secondary
        "FOLLOW", "FRIEND_REQUEST", "FRIEND_ACCEPT" -> colors.primary
        "ROOM_LIVE", "ROOM_INVITE", "SPEAKER_APPROVED" -> colors.success
        "GIFT" -> colors.accent
        else -> colors.textSecondary
    }
    Surface(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        color = if (item.read) colors.surface else colors.surfaceElevated,
        border = androidx.compose.foundation.BorderStroke(1.dp, if (item.read) colors.border else tint.copy(alpha = 0.32f))
    ) {
        Row(
            Modifier.padding(horizontal = 14.dp, vertical = 14.dp),
            verticalAlignment = Alignment.Top,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Box(Modifier.padding(top = 2.dp).size(38.dp).clip(CircleShape).background(tint.copy(alpha = 0.12f)), contentAlignment = Alignment.Center) {
                Text(notificationGlyph(item.type), color = tint, fontSize = 17.sp, fontWeight = FontWeight.Bold)
            }
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        item.actorName.ifBlank { notificationTitle(item.type, item.callType) },
                        color = colors.textPrimary,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 14.sp,
                        modifier = Modifier.weight(1f),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    if (!item.read) Box(Modifier.padding(start = 8.dp).size(8.dp).clip(CircleShape).background(tint))
                }
                Text(item.message, color = colors.textSecondary, fontSize = 13.sp, lineHeight = 18.sp, modifier = Modifier.padding(top = 4.dp))
                Text(notificationDate(item.createdAt), color = colors.textSecondary.copy(alpha = 0.8f), fontSize = 11.sp, modifier = Modifier.padding(top = 7.dp))
            }
        }
    }
}

private fun notificationTitle(type: String, callType: String): String = when (type.uppercase()) {
    "MESSAGE" -> if (callType.isNotBlank()) "Incoming ${callType.lowercase()} call" else "New message"
    "FOLLOW" -> "New follower"
    "FRIEND_REQUEST" -> "Friend request"
    "FRIEND_ACCEPT" -> "Request accepted"
    "ROOM_LIVE" -> "Friend started a room"
    "ROOM_INVITE" -> "Room invitation"
    "GIFT" -> "Gift received"
    "COMMENT" -> "New comment"
    "MOMENT" -> "New moment"
    else -> type.replace('_', ' ').lowercase().replaceFirstChar { it.titlecase() }.ifBlank { "Update" }
}

private fun notificationGlyph(type: String): String = when (type.uppercase()) {
    "MESSAGE" -> "✉"
    "FOLLOW", "FRIEND_REQUEST", "FRIEND_ACCEPT" -> "♡"
    "ROOM_LIVE", "ROOM_INVITE", "SPEAKER_APPROVED" -> "◉"
    "GIFT" -> "✦"
    "COMMENT" -> "▤"
    else -> "•"
}

private fun notificationDate(value: String): String {
    if (value.isBlank()) return "Just now"
    return value.replace('T', ' ').take(16).ifBlank { "Just now" }
}
