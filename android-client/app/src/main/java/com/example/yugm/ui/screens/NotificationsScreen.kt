package com.example.yugm.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.api.YugmApi
import com.example.yugm.model.NotificationItem
import com.example.yugm.ui.components.LoadingState
import com.example.yugm.ui.theme.Gold
import com.example.yugm.ui.theme.Panel
import com.example.yugm.ui.theme.TextMuted
import com.example.yugm.ui.theme.TextPrimary
import kotlinx.coroutines.launch

@Composable
fun NotificationsScreen(
    token: String,
    onBack: () -> Unit,
    onOpenTarget: (NotificationItem) -> Unit
) {
    val scope = rememberCoroutineScope()
    var notifications by remember { mutableStateOf<List<NotificationItem>>(emptyList()) }
    var unreadCount by remember { mutableStateOf(0) }
    var isLoading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    fun refresh() {
        scope.launch {
            isLoading = true
            runCatching { YugmApi.getNotifications(token) }
                .onSuccess {
                    notifications = it.first
                    unreadCount = it.second
                    error = null
                }
                .onFailure { error = it.message ?: "Failed to load notifications" }
            isLoading = false
        }
    }

    LaunchedEffect(token) {
        if (token.isNotBlank()) refresh()
    }

    Column(Modifier.fillMaxSize().padding(horizontal = 20.dp)) {
        Spacer(Modifier.height(18.dp))
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            TextButton(onClick = onBack) { Text("Back", color = TextMuted) }
            Column(Modifier.weight(1f)) {
                Text("Notifications", color = TextPrimary, fontSize = 30.sp, fontWeight = FontWeight.Black)
                Text("$unreadCount unread", color = TextMuted, fontSize = 12.sp)
            }
            if (unreadCount > 0) {
                Button(
                    onClick = {
                        if (busy) return@Button
                        busy = true
                        scope.launch {
                            runCatching { YugmApi.markAllNotificationsRead(token) }
                                .onSuccess {
                                    notifications = notifications.map { it.copy(read = true) }
                                    unreadCount = 0
                                }
                            busy = false
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Gold)
                ) {
                    Text(if (busy) "..." else "Mark all", color = androidx.compose.ui.graphics.Color.Black, fontWeight = FontWeight.Black)
                }
            }
        }

        LazyColumn(
            contentPadding = PaddingValues(top = 18.dp, bottom = 100.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            when {
                isLoading -> item { LoadingState("Loading notifications...") }
                error != null -> item { Text(error ?: "", color = TextMuted) }
                notifications.isEmpty() -> item { Text("No notifications yet.", color = TextMuted) }
                else -> items(notifications, key = { it.id }) { item ->
                    NotificationRow(item = item) {
                        if (!item.read) {
                            scope.launch {
                                runCatching { YugmApi.markNotificationRead(token, item.id) }
                                notifications = notifications.map { if (it.id == item.id) it.copy(read = true) else it }
                                unreadCount = (unreadCount - 1).coerceAtLeast(0)
                            }
                        }
                        onOpenTarget(item)
                    }
                }
            }
        }
    }
}

@Composable
private fun NotificationRow(item: NotificationItem, onClick: () -> Unit) {
    val background by animateColorAsState(
        targetValue = if (item.read) Panel else Gold.copy(alpha = 0.12f),
        label = "notification-background"
    )
    val scale by animateFloatAsState(if (item.read) 1f else 1.01f, label = "notification-scale")
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(background)
            .graphicsLayer {
                scaleX = scale
                scaleY = scale
            }
            .clickable(onClick = onClick)
            .padding(14.dp)
    ) {
        Text(if (item.read) "Read" else "New", color = if (item.read) TextMuted else Gold, fontWeight = FontWeight.Black, fontSize = 12.sp)
        Column(Modifier.weight(1f)) {
            Text(item.actorName.ifBlank { item.type.replace("_", " ") }, color = TextPrimary, fontWeight = FontWeight.Black)
            Text(item.message, color = TextMuted, fontSize = 13.sp, modifier = Modifier.padding(top = 3.dp))
            if (item.createdAt.isNotBlank()) Text(item.createdAt.take(10), color = TextMuted, fontSize = 11.sp, modifier = Modifier.padding(top = 4.dp))
        }
        AnimatedVisibility(
            visible = !item.read,
            enter = fadeIn() + scaleIn(),
            exit = fadeOut() + scaleOut()
        ) {
            androidx.compose.foundation.Canvas(Modifier.padding(start = 4.dp).size(10.dp)) {
                drawCircle(Gold)
            }
        }
    }
}
