package com.example.yugm.ui.screens

import android.widget.Toast
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.api.YugmApi
import com.example.yugm.model.FeedActivity
import com.example.yugm.model.FeedItem
import com.example.yugm.model.FeedResponse
import com.example.yugm.model.FeedRoom
import com.example.yugm.model.FeedUser
import com.example.yugm.model.StoryItem
import com.example.yugm.ui.components.Avatar
import com.example.yugm.ui.components.GlassCard
import com.example.yugm.ui.components.LoadingState
import com.example.yugm.ui.components.YugmAmbientBackground
import com.example.yugm.ui.components.YugmPageHeader
import com.example.yugm.ui.theme.TextMuted
import com.example.yugm.ui.theme.TextPrimary

@Composable
fun FeedScreen(
    token: String,
    onBack: () -> Unit,
    onOpenRoom: (String) -> Unit,
    onOpenProfile: (String) -> Unit,
    onOpenStory: (String) -> Unit
) {
    var feedItems by remember { mutableStateOf<List<FeedItem>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    val context = LocalContext.current

    LaunchedEffect(token) {
        isLoading = true
        runCatching { YugmApi.feed(token) }
            .onSuccess { feedItems = it.feed }
            .onFailure { Toast.makeText(context, it.message ?: "Failed to load feed", Toast.LENGTH_SHORT).show() }
        isLoading = false
    }

    YugmAmbientBackground {
        Column(Modifier.fillMaxSize()) {
            YugmPageHeader("Feed", onBack = onBack)

            if (isLoading) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    LoadingState("Loading feed…")
                }
                return@Column
            }

            if (feedItems.isEmpty()) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    GlassCard(modifier = Modifier.padding(horizontal = 20.dp)) {
                        Text("No feed activity yet", color = TextPrimary, fontWeight = FontWeight.Black)
                        Text("Follow people and join rooms to see activity here", color = TextMuted, fontSize = 13.sp, modifier = Modifier.padding(top = 6.dp))
                    }
                }
                return@Column
            }

            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(horizontal = 20.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(feedItems, key = { "${it.type}-${it.createdAt}-${it.room?._id ?: it.story?._id ?: it.activity?._id}" }) { item ->
                    FeedItemCard(
                        item = item,
                        onOpenRoom = onOpenRoom,
                        onOpenProfile = onOpenProfile,
                        onOpenStory = onOpenStory
                    )
                }
                item { Spacer(Modifier.height(80.dp)) }
            }
        }
    }
}

@Composable
private fun FeedItemCard(
    item: FeedItem,
    onOpenRoom: (String) -> Unit,
    onOpenProfile: (String) -> Unit,
    onOpenStory: (String) -> Unit
) {
    val (badge, description) = when (item.type) {
        "FRIEND_LIVE" -> {
            val name = item.room?.hostId?.name ?: "Someone"
            val roomTitle = item.room?.title ?: ""
            "🔴" to "$name is live in $roomTitle"
        }
        "FRIEND_STORY" -> {
            val name = item.story?.userName ?: "Someone"
            "📸" to "$name posted a story"
        }
        "ACTIVITY" -> {
            val name = item.activity?.userId?.name ?: "Someone"
            val activityType = item.activity?.type ?: "was active"
            val roomTitle = item.activity?.roomId?.title ?: ""
            "💬" to "$name $activityType in $roomTitle"
        }
        else -> "📌" to (item.activity?.userId?.name ?: "Activity")
    }

    val avatarUrl = when (item.type) {
        "FRIEND_LIVE" -> item.room?.hostId?.avatar
        "FRIEND_STORY" -> item.story?.userAvatar
        "ACTIVITY" -> item.activity?.userId?.avatar
        else -> null
    }

    val initial = when (item.type) {
        "FRIEND_LIVE" -> item.room?.hostId?.name?.firstOrNull()?.toString() ?: "?"
        "FRIEND_STORY" -> item.story?.userName?.firstOrNull()?.toString() ?: "?"
        "ACTIVITY" -> item.activity?.userId?.name?.firstOrNull()?.toString() ?: "?"
        else -> "?"
    }

    val onClick = when (item.type) {
        "FRIEND_LIVE" -> {
            val roomId = item.room?._id
            if (roomId != null) ({ onOpenRoom(roomId) }) else null
        }
        "FRIEND_STORY" -> {
            val userId = item.story?.userId
            if (userId != null) ({ onOpenStory(userId) }) else null
        }
        "ACTIVITY" -> null
        else -> null
    }

    val clickMod = if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier

    GlassCard(modifier = Modifier.fillMaxWidth().then(clickMod)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Avatar(initial = initial, size = 42, imageUrl = avatarUrl)
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(badge, fontSize = 14.sp)
                    Text(description, color = TextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Bold, maxLines = 2)
                }
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 4.dp)) {
                    if (item.createdAt.isNotBlank()) {
                        Text(item.createdAt.take(10), color = TextMuted, fontSize = 11.sp)
                    }
                }
            }
        }
    }
}
