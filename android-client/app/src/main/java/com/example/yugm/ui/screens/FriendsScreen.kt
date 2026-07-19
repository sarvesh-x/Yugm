package com.example.yugm.ui.screens

import android.widget.Toast
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.api.YugmApi
import com.example.yugm.model.FriendRequest
import com.example.yugm.model.FriendUser
import com.example.yugm.ui.components.Avatar
import com.example.yugm.ui.components.GlassCard
import com.example.yugm.ui.components.LoadingState
import com.example.yugm.ui.components.SegmentedTabs
import com.example.yugm.ui.components.YugmAmbientBackground
import com.example.yugm.ui.components.YugmPageHeader
import com.example.yugm.ui.theme.Danger
import com.example.yugm.ui.theme.Gold
import com.example.yugm.ui.theme.Success
import com.example.yugm.ui.theme.TextMuted
import com.example.yugm.ui.theme.TextPrimary
import kotlinx.coroutines.launch

@Composable
fun FriendsScreen(
    token: String,
    onBack: () -> Unit,
    onOpenProfile: (String) -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var selectedTab by remember { mutableIntStateOf(0) }
    var friends by remember { mutableStateOf<List<FriendUser>>(emptyList()) }
    var requests by remember { mutableStateOf<List<FriendRequest>>(emptyList()) }
    var sent by remember { mutableStateOf<List<FriendRequest>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var busy by remember { mutableStateOf(false) }

    fun loadFriends() {
        scope.launch {
            isLoading = true
            runCatching { YugmApi.friendList(token) }
                .onSuccess { friends = it }
                .onFailure { Toast.makeText(context, it.message ?: "Failed to load friends", Toast.LENGTH_SHORT).show() }
            isLoading = false
        }
    }

    fun loadRequests() {
        scope.launch {
            isLoading = true
            runCatching { YugmApi.friendRequests(token) }
                .onSuccess { requests = it }
                .onFailure { Toast.makeText(context, it.message ?: "Failed to load requests", Toast.LENGTH_SHORT).show() }
            isLoading = false
        }
    }

    fun loadSent() {
        scope.launch {
            isLoading = true
            runCatching { YugmApi.friendSent(token) }
                .onSuccess { sent = it }
                .onFailure { Toast.makeText(context, it.message ?: "Failed to load sent requests", Toast.LENGTH_SHORT).show() }
            isLoading = false
        }
    }

    LaunchedEffect(token, selectedTab) {
        when (selectedTab) {
            0 -> loadFriends()
            1 -> loadRequests()
            2 -> loadSent()
        }
    }

    YugmAmbientBackground {
        Column(Modifier.fillMaxSize()) {
            YugmPageHeader("Friends", onBack = onBack)

            SegmentedTabs(
                items = listOf("Friends" to "", "Requests" to "", "Sent" to ""),
                selectedIndex = selectedTab,
                onSelected = { selectedTab = it },
                modifier = Modifier.padding(horizontal = 20.dp)
            )

            if (isLoading) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    LoadingState("Loading...")
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(20.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    when (selectedTab) {
                        0 -> {
                            if (friends.isEmpty()) {
                                item { GlassCard { Text("No friends yet.", color = TextMuted) } }
                            } else {
                                items(friends, key = { it._id }) { friend ->
                                    Row(
                                        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(com.example.yugm.ui.theme.SurfaceElevated).clickable { onOpenProfile(friend._id) }.padding(12.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                                    ) {
                                        Avatar(initial = friend.name.firstOrNull()?.toString() ?: "?", size = 46, imageUrl = friend.avatar)
                                        Column(Modifier.weight(1f)) {
                                            Text(friend.name, color = TextPrimary, fontWeight = FontWeight.Bold)
                                            Text("Level ${friend.level}", color = TextMuted, fontSize = 12.sp)
                                        }
                                    }
                                }
                            }
                        }
                        1 -> {
                            if (requests.isEmpty()) {
                                item { GlassCard { Text("No pending requests.", color = TextMuted) } }
                            } else {
                                items(requests, key = { it._id }) { req ->
                                    val user = req.userId ?: req.friendId
                                    if (user != null) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(com.example.yugm.ui.theme.SurfaceElevated).padding(12.dp),
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                                        ) {
                                            Avatar(initial = user.name.firstOrNull()?.toString() ?: "?", size = 46, imageUrl = user.avatar)
                                            Column(Modifier.weight(1f)) {
                                                Text(user.name, color = TextPrimary, fontWeight = FontWeight.Bold)
                                                Text("Level ${user.level}", color = TextMuted, fontSize = 12.sp)
                                            }
                                            Button(
                                                onClick = {
                                                    if (busy) return@Button
                                                    busy = true
                                                    scope.launch {
                                                        runCatching { YugmApi.friendAccept(token, user._id) }
                                                            .onSuccess {
                                                                Toast.makeText(context, "Friend request accepted", Toast.LENGTH_SHORT).show()
                                                                loadRequests()
                                                            }
                                                            .onFailure { Toast.makeText(context, it.message ?: "Failed to accept", Toast.LENGTH_SHORT).show() }
                                                        busy = false
                                                    }
                                                },
                                                colors = ButtonDefaults.buttonColors(containerColor = Success),
                                                shape = RoundedCornerShape(8.dp)
                                            ) { Text("Accept", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 12.sp) }
                                            Button(
                                                onClick = {
                                                    if (busy) return@Button
                                                    busy = true
                                                    scope.launch {
                                                        runCatching { YugmApi.friendDecline(token, user._id) }
                                                            .onSuccess {
                                                                Toast.makeText(context, "Friend request declined", Toast.LENGTH_SHORT).show()
                                                                loadRequests()
                                                            }
                                                            .onFailure { Toast.makeText(context, it.message ?: "Failed to decline", Toast.LENGTH_SHORT).show() }
                                                        busy = false
                                                    }
                                                },
                                                colors = ButtonDefaults.buttonColors(containerColor = Danger),
                                                shape = RoundedCornerShape(8.dp)
                                            ) { Text("Decline", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 12.sp) }
                                        }
                                    }
                                }
                            }
                        }
                        2 -> {
                            if (sent.isEmpty()) {
                                item { GlassCard { Text("No sent requests.", color = TextMuted) } }
                            } else {
                                items(sent, key = { it._id }) { req ->
                                    val user = req.friendId ?: req.userId
                                    if (user != null) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(com.example.yugm.ui.theme.SurfaceElevated).padding(12.dp),
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                                        ) {
                                            Avatar(initial = user.name.firstOrNull()?.toString() ?: "?", size = 46, imageUrl = user.avatar)
                                            Column(Modifier.weight(1f)) {
                                                Text(user.name, color = TextPrimary, fontWeight = FontWeight.Bold)
                                                Text("Pending", color = Gold, fontSize = 12.sp)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
