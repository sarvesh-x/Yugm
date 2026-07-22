package com.example.yugm.feature.chat.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.example.yugm.core.model.DirectMessage
import com.example.yugm.core.model.Host
import com.example.yugm.core.ui.components.Avatar
import com.example.yugm.core.ui.components.BrandHeader
import com.example.yugm.core.ui.components.LoadingState
import com.example.yugm.core.ui.components.ReferenceSectionHeader
import com.example.yugm.core.ui.components.RoundAction
import com.example.yugm.core.ui.components.SegmentedTabs
import com.example.yugm.core.ui.components.YugmAmbientBackground
import com.example.yugm.core.ui.components.YugmBottomDock
import com.example.yugm.core.ui.components.YugmDockTab
import com.example.yugm.core.ui.theme.BorderColor
import com.example.yugm.core.ui.theme.Pink
import com.example.yugm.core.ui.theme.Success
import com.example.yugm.core.ui.theme.SurfaceElevated
import com.example.yugm.core.ui.theme.TextMuted
import com.example.yugm.core.ui.theme.TextPrimary
import com.example.yugm.feature.chat.viewmodel.ChatListViewModel

@Composable
fun ChatListScreen(
    token: String,
    currentUserId: String,
    onOpenChat: (String) -> Unit,
    onDiscover: () -> Unit = {},
    onDating: () -> Unit = {},
    onCreateRoom: () -> Unit = {},
    onWallet: () -> Unit = {},
    onProfile: () -> Unit = {}
) {
    val viewModel: ChatListViewModel = hiltViewModel()
    var query by remember { mutableStateOf("") }
    var selectedTab by remember { mutableIntStateOf(0) }

    LaunchedEffect(token) {
        viewModel.load(token)
    }

    val groupedConversations = remember(viewModel.recentMessages, viewModel.matches, query) {
        viewModel.recentMessages.groupBy { if (it.senderId == currentUserId) it.receiverId else it.senderId }
            .mapNotNull { (partnerId, messages) ->
                val partner = viewModel.matches.find { it.id == partnerId } ?: Host(id = partnerId, name = "Yugm User")
                val last = messages.maxByOrNull { it.createdAt } ?: return@mapNotNull null
                ConversationItem(partner, last)
            }
            .filter { query.isBlank() || it.partner.name.contains(query, true) || it.lastMessage.message.contains(query, true) }
            .sortedByDescending { it.lastMessage.createdAt }
    }
    val newMatches = remember(viewModel.matches, groupedConversations, query) {
        val active = groupedConversations.map { it.partner.id }.toSet()
        viewModel.matches.filter { it.id !in active && (query.isBlank() || it.name.contains(query, true)) }
    }
    val visibleConversations = remember(groupedConversations, selectedTab, currentUserId) {
        if (selectedTab == 2) groupedConversations.filter { !it.lastMessage.read && it.lastMessage.receiverId == currentUserId }
        else groupedConversations
    }
    val unreadCount = groupedConversations.count { !it.lastMessage.read && it.lastMessage.receiverId == currentUserId }

    YugmAmbientBackground {
        Box(Modifier.fillMaxSize()) {
            if (viewModel.isLoading) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { LoadingState("Retrieving conversations…") }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(top = 18.dp, bottom = 112.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    item {
                        Row(Modifier.padding(horizontal = 20.dp), verticalAlignment = Alignment.CenterVertically) {
                            BrandHeader(compact = true)
                            Spacer(Modifier.weight(1f))
                            RoundAction("♢", onClick = {})
                            Spacer(Modifier.width(10.dp))
                            RoundAction("♙", onClick = onProfile)
                        }
                    }
                    item {
                        Column(Modifier.padding(horizontal = 20.dp)) {
                            Text("Matches & Messages ✨", color = TextPrimary, fontSize = 28.sp, fontWeight = FontWeight.Black)
                            Text("Where connections turn into conversations", color = TextMuted, fontSize = 13.sp, modifier = Modifier.padding(top = 3.dp))
                        }
                    }
                    item {
                        Row(
                            Modifier.padding(horizontal = 20.dp).fillMaxWidth().height(55.dp).clip(RoundedCornerShape(18.dp)).background(SurfaceElevated).border(1.dp, BorderColor, RoundedCornerShape(18.dp)).padding(horizontal = 16.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("⌕", color = TextMuted, fontSize = 23.sp)
                            BasicTextField(
                                query,
                                { query = it },
                                singleLine = true,
                                textStyle = androidx.compose.ui.text.TextStyle(color = TextPrimary, fontSize = 14.sp),
                                modifier = Modifier.weight(1f).padding(horizontal = 10.dp),
                                decorationBox = { inner -> if (query.isBlank()) Text("Search matches or messages…", color = TextMuted, fontSize = 13.sp) else inner() }
                            )
                            Text("☷", color = TextMuted, fontSize = 20.sp)
                        }
                    }
                    item {
                        SegmentedTabs(
                            items = listOf("" to "All", "" to "Matches", "" to "Unread"),
                            selectedIndex = selectedTab,
                            onSelected = { selectedTab = it },
                            modifier = Modifier.padding(horizontal = 20.dp)
                        )
                    }
                    if (newMatches.isNotEmpty() && selectedTab != 2) {
                        item {
                            Column {
                                Box(Modifier.padding(horizontal = 20.dp)) { ReferenceSectionHeader("New Matches", "See all") }
                                LazyRow(contentPadding = PaddingValues(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(14.dp), modifier = Modifier.padding(top = 10.dp)) {
                                    items(newMatches, key = { "match-${it.id}" }) { partner -> NewMatchAvatar(partner) { onOpenChat(partner.id) } }
                                }
                            }
                        }
                    }
                    if (selectedTab != 1) {
                        item {
                            Box(Modifier.padding(horizontal = 20.dp)) {
                                ReferenceSectionHeader("Messages", if (unreadCount > 0) "Mark all as read" else "") {
                                    viewModel.markAllRead(token)
                                }
                            }
                        }
                        if (visibleConversations.isEmpty()) {
                            item {
                                Text("No conversations yet. Match with someone and say hello.", color = TextMuted, fontSize = 13.sp, modifier = Modifier.padding(horizontal = 20.dp, vertical = 30.dp))
                            }
                        } else {
                            item {
                                Column(Modifier.padding(horizontal = 20.dp).clip(RoundedCornerShape(22.dp)).background(SurfaceElevated).border(1.dp, BorderColor, RoundedCornerShape(22.dp))) {
                                    visibleConversations.forEachIndexed { index, item ->
                                        ChatThreadRow(item = item, unread = !item.lastMessage.read && item.lastMessage.receiverId == currentUserId, onClick = { onOpenChat(item.partner.id) })
                                        if (index < visibleConversations.lastIndex) Box(Modifier.fillMaxWidth().height(1.dp).background(BorderColor))
                                    }
                                }
                            }
                        }
                    }
                }
            }
            YugmBottomDock(
                selected = YugmDockTab.CHAT,
                onDiscover = onDiscover,
                onMatch = onDating,
                onCreate = onCreateRoom,
                onLive = {},
                onChat = {},
                onWallet = onWallet,
                onProfile = onProfile,
                chatBadge = unreadCount.coerceAtMost(9),
                modifier = Modifier.align(Alignment.BottomCenter)
            )
        }
    }
}

data class ConversationItem(val partner: Host, val lastMessage: DirectMessage)

@Composable
private fun NewMatchAvatar(partner: Host, onClick: () -> Unit) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(76.dp).clickable(onClick = onClick)) {
        Box {
            Avatar(partner.name.take(1), 65, partner.avatar, partner.activeCosmetics)
            Box(Modifier.align(Alignment.BottomCenter).clip(RoundedCornerShape(9.dp)).background(Pink).padding(horizontal = 8.dp, vertical = 2.dp)) {
                Text("New", color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.Black)
            }
        }
        Text(partner.name.split(" ").first(), color = TextPrimary, fontSize = 11.sp, fontWeight = FontWeight.Bold, maxLines = 1, modifier = Modifier.padding(top = 3.dp))
    }
}

@Composable
fun ChatThreadRow(item: ConversationItem, unread: Boolean = false, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
        Box {
            Avatar(item.partner.name.take(1), 52, item.partner.avatar, item.partner.activeCosmetics)
            if (item.partner.isOnline) Box(Modifier.align(Alignment.BottomEnd).size(12.dp).clip(CircleShape).background(Success).border(2.dp, SurfaceElevated, CircleShape))
        }
        Column(Modifier.weight(1f).padding(start = 10.dp)) {
            Text(item.partner.name, color = TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Black)
            Text(item.lastMessage.message, color = TextMuted, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 3.dp))
        }
        Column(horizontalAlignment = Alignment.End) {
            Text(formatMessageTime(item.lastMessage.createdAt), color = TextMuted, fontSize = 10.sp)
            if (unread) Box(Modifier.padding(top = 6.dp).size(22.dp).clip(CircleShape).background(Pink), contentAlignment = Alignment.Center) {
                Text("1", color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.Black)
            }
        }
    }
}

private fun formatMessageTime(value: String): String = when {
    value.length >= 16 -> value.substring(11, 16)
    value.isNotBlank() -> value
    else -> "now"
}
