package com.yugm.app.feature.chat.screens

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
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.yugm.app.core.model.DirectMessage
import com.yugm.app.core.model.Host
import com.yugm.app.core.ui.components.Avatar
import com.yugm.app.core.ui.components.YugmBottomDock
import com.yugm.app.core.ui.components.YugmPullToRefreshBox
import com.yugm.app.core.ui.components.YugmDockTab
import com.yugm.app.feature.chat.viewmodel.ChatListViewModel

private val ChatBg = Color(0xFF060714)
private val ChatInk = Color(0xFFF8FAFC)
private val ChatMuted = Color(0xFF9EA3B9)
private val ChatPurple = Color(0xFF8D35F6)
private val ChatLine = Color(0x24FFFFFF)
private val ChatCard = Color(0xFF0E1121)
private val ChatPanel = Color(0xFF171A2C)

@Composable
fun ChatListScreen(
    token: String,
    currentUserId: String,
    onOpenChat: (String) -> Unit,
    onDiscover: () -> Unit = {},
    onCreateRoom: () -> Unit = {},
    onLive: () -> Unit = {},
    onWallet: () -> Unit = {},
    onProfile: () -> Unit = {}
) {
    val viewModel: ChatListViewModel = hiltViewModel()
    var query by remember { mutableStateOf("") }
    var mainTab by remember { mutableIntStateOf(0) }
    var contactTab by remember { mutableIntStateOf(0) }

    LaunchedEffect(token, currentUserId) { viewModel.load(token, currentUserId) }

    val conversations = remember(viewModel.recentMessages, viewModel.matches, query, currentUserId) {
        viewModel.recentMessages.groupBy { if (it.senderId == currentUserId) it.receiverId else it.senderId }
            .mapNotNull { (partnerId, messages) ->
                val last = messages.maxByOrNull { it.createdAt } ?: return@mapNotNull null
                val messagePartner = if (last.senderId == currentUserId) last.receiver else last.sender
                val partner = viewModel.matches.find { it.id == partnerId }
                    ?: messagePartner?.takeIf { it.id == partnerId }
                    ?: Host(id = partnerId, name = "Yugm User")
                ConversationItem(partner, last)
            }
            .filter { query.isBlank() || it.partner.name.contains(query, true) || it.lastMessage.message.contains(query, true) }
            .sortedByDescending { it.lastMessage.createdAt }
    }
    val unread = conversations.count { !it.lastMessage.read && it.lastMessage.receiverId == currentUserId }
    val friendIds = remember(viewModel.followers, viewModel.following) { viewModel.followers.map { it.id }.intersect(viewModel.following.map { it.id }.toSet()) }
    val contactList = when (contactTab) {
        0 -> viewModel.following.filter { it.id in friendIds }
        1 -> viewModel.followers
        else -> viewModel.following
    }.filter { query.isBlank() || it.name.contains(query, true) || it.username.contains(query, true) }

    Box(Modifier.fillMaxSize().background(ChatBg)) {
        YugmPullToRefreshBox(
            isRefreshing = viewModel.isLoading,
            onRefresh = { viewModel.load(token, currentUserId) },
            modifier = Modifier.fillMaxSize()
        ) {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(top = 18.dp, bottom = 110.dp),
                verticalArrangement = Arrangement.spacedBy(18.dp)
            ) {
            item {
                Row(Modifier.fillMaxWidth().padding(horizontal = 22.dp), verticalAlignment = Alignment.CenterVertically) {
                    ChatTopTab("Chats", selected = mainTab == 0) { mainTab = 0 }
                    Spacer(Modifier.width(28.dp))
                    ChatTopTab("Contacts", selected = mainTab == 1) { mainTab = 1 }
                    Spacer(Modifier.weight(1f))
                    ChatSearch(query = query, onQuery = { query = it }, hint = "Search")
                    Spacer(Modifier.width(8.dp))
                    Box(Modifier.size(42.dp).clip(CircleShape).background(ChatPanel).clickable(role = Role.Button, onClickLabel = "Find people", onClick = onDiscover), contentAlignment = Alignment.Center) {
                        Text("＋", color = ChatInk, fontSize = 23.sp, fontWeight = FontWeight.Medium)
                    }
                }
            }
            if (viewModel.error != null) {
                item {
                    Column(Modifier.padding(horizontal = 20.dp).fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(ChatCard).padding(16.dp)) {
                        Text("Couldn't refresh your connections", color = ChatInk, fontWeight = FontWeight.Bold)
                        Text(viewModel.error.orEmpty(), color = ChatMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
                        TextButton(onClick = { viewModel.load(token, currentUserId) }) { Text("Try again", color = ChatPurple) }
                    }
                }
            }
            if (mainTab == 0) {
                // Recommended users to chat with - real data, online dot indicator
                if (viewModel.recommendedChatUsers.isNotEmpty() || viewModel.isLoading) {
                    item {
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Row(
                                Modifier.fillMaxWidth().padding(horizontal = 22.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text("Say Hi 👋", color = ChatInk, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                                Spacer(Modifier.weight(1f))
                                if (viewModel.isLoading && viewModel.recommendedChatUsers.isEmpty()) {
                                    CircularProgressIndicator(modifier = Modifier.size(16.dp), color = ChatPurple, strokeWidth = 2.dp)
                                }
                            }
                            LazyRow(
                                contentPadding = PaddingValues(horizontal = 20.dp),
                                horizontalArrangement = Arrangement.spacedBy(14.dp)
                            ) {
                                items(viewModel.recommendedChatUsers.take(25), key = { "rec-${it.id}" }) { user ->
                                    RecommendedUserChip(user = user, onClick = { onOpenChat(user.id) })
                                }
                            }
                        }
                    }
                }
                if (viewModel.matches.isNotEmpty()) item {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text("People you may know", color = ChatInk, fontSize = 19.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 22.dp))
                        LazyRow(contentPadding = PaddingValues(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                            items(viewModel.matches.take(20), key = { "match-${it.id}" }) { user ->
                                Column(Modifier.width(70.dp).clickable(role = Role.Button, onClickLabel = "Chat with ${user.name}") { onOpenChat(user.id) }, horizontalAlignment = Alignment.CenterHorizontally) {
                                    Avatar(user.name.take(1), 58, user.avatar, user.activeCosmetics)
                                    Text(user.name, color = ChatInk, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 5.dp))
                                }
                            }
                        }
                    }
                }
                item {
                    Row(Modifier.fillMaxWidth().padding(horizontal = 22.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text("Chatlist", color = ChatInk, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.weight(1f))
                            if (unread > 0) Text("Mark read", color = ChatPurple, fontSize = 12.sp, fontWeight = FontWeight.Bold,
                                modifier = Modifier.clickable(role = Role.Button, onClickLabel = "Mark all messages as read") { viewModel.markAllRead(token, currentUserId) }.padding(end = 10.dp))
                        Text("${conversations.size} chats", color = ChatMuted, fontSize = 12.sp)
                    }
                }
                if (viewModel.isLoading && conversations.isEmpty()) item {
                    Box(Modifier.fillMaxWidth().padding(48.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = ChatPurple) }
                } else if (conversations.isEmpty()) item {
                    Column(Modifier.fillMaxWidth().padding(horizontal = 26.dp, vertical = 55.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("▰", color = Color(0xFFC9B9FF), fontSize = 62.sp)
                        Text("No conversations yet", color = ChatInk, fontSize = 17.sp, fontWeight = FontWeight.Bold)
                        Text("Find interesting people and say hello.", color = ChatMuted, fontSize = 13.sp, modifier = Modifier.padding(top = 5.dp))
                        TextButton(onClick = onDiscover) { Text("Find friends", color = ChatPurple, fontWeight = FontWeight.Bold) }
                    }
                } else {
                    itemsIndexed(conversations, key = { _, item -> "conversation-${item.partner.id}" }) { index, item ->
                        Column(
                            Modifier.padding(horizontal = 16.dp, vertical = 1.dp)
                                .clip(RoundedCornerShape(18.dp))
                                .background(ChatCard)
                        ) {
                            if (index > 0) Box(Modifier.fillMaxWidth().padding(start = 82.dp).height(1.dp).background(ChatLine))
                            LightChatRow(item, unread = !item.lastMessage.read && item.lastMessage.receiverId == currentUserId) { onOpenChat(item.partner.id) }
                        }
                    }
                }
            } else {
                item {
                    Column(Modifier.padding(horizontal = 18.dp).clip(RoundedCornerShape(20.dp)).background(ChatCard).padding(5.dp)) {
                        Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                            listOf("Friends", "Followers", "Following").forEachIndexed { index, label ->
                                val selected = contactTab == index
                                Box(Modifier.weight(1f).height(46.dp).clip(RoundedCornerShape(15.dp)).background(if (selected) Color(0xFF28243A) else Color.Transparent)
                                    .clickable(role = Role.Tab) { contactTab = index }, contentAlignment = Alignment.Center) {
                                    Text(label, color = if (selected) ChatPurple else ChatMuted, fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium, fontSize = 13.sp)
                                }
                            }
                        }
                    }
                }
                item {
                    Text("${contactList.size} ${listOf("friends", "followers", "following")[contactTab]}", color = ChatMuted, fontSize = 13.sp, modifier = Modifier.padding(horizontal = 22.dp))
                }
                if (viewModel.isLoading && contactList.isEmpty()) item { Box(Modifier.fillMaxWidth().padding(48.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = ChatPurple) } }
                else if (contactList.isEmpty()) item { Text("No people to show yet.", color = ChatMuted, modifier = Modifier.padding(horizontal = 22.dp, vertical = 35.dp)) }
                else {
                    itemsIndexed(contactList, key = { _, person -> "contact-${person.id}" }) { index, person ->
                        Column(
                            Modifier.padding(horizontal = 16.dp, vertical = 1.dp)
                                .clip(RoundedCornerShape(18.dp))
                                .background(ChatCard)
                        ) {
                            if (index > 0) Box(Modifier.fillMaxWidth().padding(start = 74.dp).height(1.dp).background(ChatLine))
                            Row(Modifier.fillMaxWidth().height(76.dp).clickable(role = Role.Button, onClickLabel = "Open chat with ${person.name}") { onOpenChat(person.id) }.padding(horizontal = 14.dp), verticalAlignment = Alignment.CenterVertically) {
                                Avatar(person.name.take(1), 48, person.avatar, person.activeCosmetics)
                                Column(Modifier.weight(1f).padding(start = 12.dp)) {
                                    Text(person.name, color = ChatInk, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    Text(if (person.username.isNotBlank()) "@${person.username}" else if (person.isOnline) "Online" else "Yugm member", color = ChatMuted, fontSize = 12.sp)
                                }
                                Text("›", color = ChatMuted, fontSize = 25.sp)
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
            onCreate = onCreateRoom,
            onLive = onLive,
            onChat = {},
            onWallet = onWallet,
            onProfile = onProfile,
            chatBadge = unread.coerceAtMost(9),
            modifier = Modifier.align(Alignment.BottomCenter)
        )
    }
}

@Composable
private fun ChatTopTab(label: String, selected: Boolean, onClick: () -> Unit) {
    Column(Modifier.height(48.dp).clickable(role = Role.Tab, onClickLabel = label, onClick = onClick), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        Text(label, color = if (selected) ChatInk else ChatMuted, fontSize = 20.sp, fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium)
        Box(Modifier.padding(top = 2.dp).size(width = if (selected) 30.dp else 0.dp, height = 4.dp).clip(CircleShape).background(ChatPurple))
    }
}

@Composable
private fun ChatSearch(query: String, onQuery: (String) -> Unit, hint: String) {
    Row(Modifier.width(126.dp).height(42.dp).clip(CircleShape).background(ChatPanel).padding(horizontal = 12.dp), verticalAlignment = Alignment.CenterVertically) {
        Text("⌕", color = ChatMuted, fontSize = 20.sp)
        BasicTextField(query, onQuery, singleLine = true, textStyle = TextStyle(color = ChatInk, fontSize = 13.sp), cursorBrush = androidx.compose.ui.graphics.SolidColor(ChatPurple), modifier = Modifier.weight(1f).padding(start = 5.dp), decorationBox = { inner -> if (query.isBlank()) Text(hint, color = Color(0xFFB6B8C5), fontSize = 13.sp) else inner() })
    }
}

@Composable
private fun LightChatRow(item: ConversationItem, unread: Boolean, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().height(78.dp).clickable(role = Role.Button, onClickLabel = "Open conversation with ${item.partner.name}", onClick = onClick).padding(horizontal = 14.dp), verticalAlignment = Alignment.CenterVertically) {
        Box {
            Avatar(item.partner.name.take(1), 50, item.partner.avatar, item.partner.activeCosmetics)
            if (item.partner.isOnline) Box(Modifier.align(Alignment.BottomEnd).size(13.dp).clip(CircleShape).background(Color(0xFF39C891)).border(2.dp, ChatCard, CircleShape))
        }
        Column(Modifier.weight(1f).padding(start = 12.dp)) {
            Text(item.partner.name, color = ChatInk, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(item.lastMessage.message, color = ChatMuted, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 4.dp))
        }
        if (unread) Box(Modifier.size(9.dp).clip(CircleShape).background(ChatPurple))
    }
}

@Composable
private fun RecommendedUserChip(user: Host, onClick: () -> Unit) {
    Column(
        modifier = Modifier
            .width(66.dp)
            .clickable(role = Role.Button, onClickLabel = "Chat with ${user.name}", onClick = onClick),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(5.dp)
    ) {
        Box(contentAlignment = Alignment.BottomEnd) {
            // Avatar with frame cosmetics
            Box(
                modifier = Modifier
                    .size(58.dp)
                    .clip(CircleShape)
                    .background(ChatPanel)
                    .border(2.dp, if (user.isOnline) Color(0xFF39C891).copy(alpha = 0.6f) else Color(0xFF2E3050), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Avatar(
                    initial = user.name.take(1),
                    size = 54,
                    imageUrl = user.avatar,
                    cosmetics = user.activeCosmetics
                )
            }
            // Online / offline dot
            Box(
                modifier = Modifier
                    .size(14.dp)
                    .clip(CircleShape)
                    .background(if (user.isOnline) Color(0xFF39C891) else Color(0xFF4A4D6A))
                    .border(2.dp, ChatBg, CircleShape)
            )
        }
        Text(
            text = user.name.ifBlank { user.username }.take(10),
            color = ChatInk,
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

data class ConversationItem(val partner: Host, val lastMessage: DirectMessage)
