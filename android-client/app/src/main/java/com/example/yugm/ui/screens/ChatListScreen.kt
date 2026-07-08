package com.example.yugm.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.api.YugmApi
import com.example.yugm.model.DirectMessage
import com.example.yugm.model.Host
import com.example.yugm.ui.components.Avatar
import com.example.yugm.ui.components.GlassCard
import com.example.yugm.ui.components.LoadingState
import com.example.yugm.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun ChatListScreen(
    token: String,
    currentUserId: String,
    onOpenChat: (String) -> Unit
) {
    var matches by remember { mutableStateOf<List<Host>>(emptyList()) }
    var recentMessages by remember { mutableStateOf<List<DirectMessage>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }

    LaunchedEffect(token) {
        isLoading = true
        runCatching { YugmApi.datingMatches(token) }.onSuccess { matches = it }
        runCatching { YugmApi.getRecentMessages(token) }.onSuccess { recentMessages = it }
        isLoading = false
    }

    // Group messages by conversation partner
    val groupedConversations = remember(recentMessages, matches) {
        val groups = recentMessages.groupBy { msg ->
            if (msg.senderId == currentUserId) msg.receiverId else msg.senderId
        }
        groups.mapNotNull { (partnerId, msgs) ->
            val partner = matches.find { it.id == partnerId } ?: Host(id = partnerId, name = "Yugm User")
            val lastMsg = msgs.firstOrNull() ?: return@mapNotNull null
            ConversationItem(partner = partner, lastMessage = lastMsg)
        }.sortedByDescending { it.lastMessage.createdAt }
    }

    // Filter matches that do not have active chats
    val newMatches = remember(matches, groupedConversations) {
        val activeChatPartnerIds = groupedConversations.map { it.partner.id }.toSet()
        matches.filter { it.id !in activeChatPartnerIds }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Background)
    ) {
        if (isLoading) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                LoadingState("Retrieving conversations...")
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(bottom = 90.dp), // Space for bottom bar
                contentPadding = PaddingValues(top = 16.dp, bottom = 16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Header
                item {
                    Text(
                        text = "Conversations",
                        color = Color.White,
                        fontSize = 32.sp,
                        fontWeight = FontWeight.Black,
                        modifier = Modifier.padding(horizontal = 20.dp)
                    )
                }

                // New Matches Horizontal Row
                if (newMatches.isNotEmpty()) {
                    item {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(
                                text = "New Matches",
                                color = Gold,
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp,
                                modifier = Modifier.padding(horizontal = 20.dp)
                            )
                            LazyRow(
                                contentPadding = PaddingValues(horizontal = 20.dp),
                                horizontalArrangement = Arrangement.spacedBy(16.dp)
                            ) {
                                items(newMatches) { partner ->
                                    Column(
                                        horizontalAlignment = Alignment.CenterHorizontally,
                                        modifier = Modifier.clickable { onOpenChat(partner.id) }
                                    ) {
                                        Avatar(
                                            initial = partner.name.firstOrNull()?.toString() ?: "?",
                                            size = 64,
                                            imageUrl = partner.avatar,
                                            cosmetics = partner.activeCosmetics
                                        )
                                        Spacer(modifier = Modifier.height(6.dp))
                                        Text(
                                            text = partner.name.split(" ").firstOrNull() ?: "",
                                            color = Color.White,
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                // Active Chats
                item {
                    Text(
                        text = "Recent Chats",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp,
                        modifier = Modifier.padding(horizontal = 20.dp)
                    )
                }

                if (groupedConversations.isEmpty()) {
                    item {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 20.dp, vertical = 40.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "No active conversations yet.\nSwipe on cards to get matches!",
                                color = TextMuted,
                                fontSize = 14.sp,
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                } else {
                    items(groupedConversations) { conv ->
                        ChatThreadRow(
                            item = conv,
                            onClick = { onOpenChat(conv.partner.id) }
                        )
                    }
                }
            }
        }
    }
}

data class ConversationItem(
    val partner: Host,
    val lastMessage: DirectMessage
)

@Composable
fun ChatThreadRow(
    item: ConversationItem,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .padding(horizontal = 20.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Avatar(
            initial = item.partner.name.firstOrNull()?.toString() ?: "?",
            size = 54,
            imageUrl = item.partner.avatar,
            cosmetics = item.partner.activeCosmetics
        )
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.Center
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = item.partner.name,
                    color = Color.White,
                    fontWeight = FontWeight.Black,
                    fontSize = 16.sp
                )
                Text(
                    text = item.lastMessage.createdAt.take(16).replace("T", " "),
                    color = TextMuted,
                    fontSize = 11.sp
                )
            }
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = item.lastMessage.message,
                color = TextMuted,
                fontSize = 14.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}
