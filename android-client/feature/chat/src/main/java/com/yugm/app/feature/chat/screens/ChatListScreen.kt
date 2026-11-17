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
import androidx.compose.foundation.layout.fillMaxHeight
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
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.Tab
import androidx.compose.material3.PrimaryTabRow
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.Search
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.yugm.app.core.api.YugmApi
import com.yugm.app.core.model.Clan
import com.yugm.app.core.model.DirectMessage
import com.yugm.app.core.model.FriendRequest
import com.yugm.app.core.model.FriendUser
import com.yugm.app.core.model.Host
import com.yugm.app.core.ui.components.Avatar
import com.yugm.app.core.ui.theme.LocalYugmColors
import com.yugm.app.core.ui.components.YugmBottomDock
import com.yugm.app.core.ui.components.YugmDockTab
import com.yugm.app.feature.chat.viewmodel.ChatListViewModel
import com.yugm.app.feature.social.screens.ClanChatScreen
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

// Theme-aware palette is read via LocalYugmColors inside composables.

@Composable
fun ChatListScreen(
    token: String,
    currentUserId: String,
    onOpenChat: (String) -> Unit,
    onDiscover: () -> Unit = {},
    onCreateRoom: () -> Unit = {},
    onLive: () -> Unit = {},
    onWallet: () -> Unit = {},
    onProfile: () -> Unit = {},
    onJoinClan: () -> Unit = {},
    onOpenClanDetail: (String) -> Unit = {},
    onGameZone: () -> Unit = {},
    showBottomDock: Boolean = true,
    onClanTabActiveChanged: (Boolean) -> Unit = {},
    viewModel: com.yugm.app.feature.chat.viewmodel.ChatListViewModel = hiltViewModel()
) {
    var mainTab by remember { mutableIntStateOf(0) }
    var contactTab by remember { mutableIntStateOf(0) }
    var showFindPeople by remember { mutableStateOf(false) }
    var searchOpen by remember { mutableStateOf(false) }
    var searchQuery by remember { mutableStateOf("") }

    LaunchedEffect(mainTab) {
        onClanTabActiveChanged(mainTab == 1)
    }

    com.yugm.app.core.ui.components.AutomaticSyncEffect(token, currentUserId, topics = setOf(com.yugm.app.core.api.SyncTopic.CHAT, com.yugm.app.core.api.SyncTopic.CLANS, com.yugm.app.core.api.SyncTopic.SOCIAL), enabled = token.isNotBlank(), isBusy = { viewModel.isLoading }) { viewModel.load(token, currentUserId) }
    val listBottomPadding = if (showBottomDock) 120.dp else 100.dp

    val conversations = remember(viewModel.recentMessages, viewModel.matches, currentUserId) {
        viewModel.recentMessages.groupBy { if (it.senderId == currentUserId) it.receiverId else it.senderId }
            .mapNotNull { (partnerId, messages) ->
                val last = messages.maxByOrNull { it.createdAt } ?: return@mapNotNull null
                val messagePartner = if (last.senderId == currentUserId) last.receiver else last.sender
                val matched = viewModel.matches.find { it.id == partnerId }
                val resolvedPartner = when {
                    messagePartner != null && messagePartner.id == partnerId -> {
                        if (matched != null) {
                            matched.copy(
                                name = matched.name.ifBlank { messagePartner.name },
                                username = matched.username.ifBlank { messagePartner.username },
                                avatar = matched.avatar ?: messagePartner.avatar,
                                activeCosmetics = if (matched.activeCosmetics != com.yugm.app.core.model.ActiveCosmetics()) matched.activeCosmetics else messagePartner.activeCosmetics
                            )
                        } else messagePartner
                    }
                    matched != null -> matched
                    else -> Host(id = partnerId, name = "Yugm User")
                }
                ConversationItem(resolvedPartner, last)
            }
            .sortedByDescending { it.lastMessage.createdAt }
    }
    val displayUnreadCounts = remember(viewModel.unreadCounts, viewModel.mutedPartnerIds) {
        viewModel.unreadCounts.filterKeys { it !in viewModel.mutedPartnerIds }
    }
    val unread = displayUnreadCounts.values.sum()
    val normalizedQuery = searchQuery.trim().lowercase()

    val filteredConversations = remember(conversations, normalizedQuery) {
        if (normalizedQuery.isBlank()) conversations
        else conversations.filter { item ->
            item.partner.name.lowercase().contains(normalizedQuery) ||
                item.partner.username.lowercase().contains(normalizedQuery) ||
                item.lastMessage.message.lowercase().contains(normalizedQuery)
        }
    }
    val filteredFriends = remember(viewModel.friends, normalizedQuery) {
        if (normalizedQuery.isBlank()) viewModel.friends
        else viewModel.friends.filter {
            it.name.lowercase().contains(normalizedQuery) || it.username.lowercase().contains(normalizedQuery)
        }
    }
    val filteredRequests = remember(viewModel.friendRequests, normalizedQuery) {
        if (normalizedQuery.isBlank()) viewModel.friendRequests
        else viewModel.friendRequests.filter { request ->
            val person = request.userId ?: request.friendId
            person?.name?.lowercase()?.contains(normalizedQuery) == true ||
                person?.username?.lowercase()?.contains(normalizedQuery) == true
        }
    }
    val filteredFollowers = remember(viewModel.followers, normalizedQuery) {
        if (normalizedQuery.isBlank()) viewModel.followers
        else viewModel.followers.filter {
            it.name.lowercase().contains(normalizedQuery) || it.username.lowercase().contains(normalizedQuery)
        }
    }
    val filteredFollowing = remember(viewModel.following, normalizedQuery) {
        if (normalizedQuery.isBlank()) viewModel.following
        else viewModel.following.filter {
            it.name.lowercase().contains(normalizedQuery) || it.username.lowercase().contains(normalizedQuery)
        }
    }
    val contactCount = when (contactTab) {
        0 -> filteredFriends.size
        1 -> filteredRequests.size
        2 -> filteredFollowers.size
        else -> filteredFollowing.size
    }
    val contactLabel = when (contactTab) {
        0 -> "friend"
        1 -> "request"
        2 -> "follower"
        else -> "following"
    }

    Box(Modifier.fillMaxSize().background(LocalYugmColors.current.background)) {
        Column(Modifier.fillMaxSize()) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(top = 16.dp, bottom = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Messages", color = LocalYugmColors.current.textPrimary, fontSize = 24.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.weight(1f))
                Box(
                    Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(LocalYugmColors.current.surfaceElevated)
                        .border(1.dp, LocalYugmColors.current.border, CircleShape)
                        .clickable(role = Role.Button, onClickLabel = "Search chats", onClick = {
                            searchOpen = !searchOpen
                            if (!searchOpen) searchQuery = ""
                        }),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        if (searchOpen) Icons.Filled.Close else Icons.Filled.Search,
                        contentDescription = null,
                        tint = LocalYugmColors.current.textPrimary,
                        modifier = Modifier.size(18.dp)
                    )
                }
                Spacer(Modifier.width(10.dp))
                Box(
                    Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(LocalYugmColors.current.surfaceElevated)
                        .border(1.dp, LocalYugmColors.current.border, CircleShape)
                        .clickable(role = Role.Button, onClickLabel = "Find people by username", onClick = { showFindPeople = true }),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Filled.PersonAdd, contentDescription = null, tint = LocalYugmColors.current.textPrimary, modifier = Modifier.size(18.dp))
                }
            }

            val clan = viewModel.myClan
            PrimaryTabRow(
                selectedTabIndex = mainTab,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                containerColor = LocalYugmColors.current.background,
                contentColor = LocalYugmColors.current.textPrimary
            ) {
                listOf("Chats", "Clan", "Contacts").forEachIndexed { index, fallback ->
                    val clanTitle = clan?.name?.takeIf { it.isNotBlank() } ?: fallback
                    Tab(
                        selected = mainTab == index,
                        onClick = { mainTab = index },
                        selectedContentColor = LocalYugmColors.current.secondary,
                        unselectedContentColor = LocalYugmColors.current.textSecondary,
                        text = {
                            if (index == 1 && clan != null) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text(clanTitle, maxLines = 1, overflow = TextOverflow.Ellipsis, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                                    val onlineCount = clan.members.count { it.isOnline }
                                    Text("$onlineCount online", fontSize = 10.sp, maxLines = 1)
                                }
                            } else {
                                Text(fallback, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                            }
                        }
                    )
                }
            }

            if (searchOpen) {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 4.dp)
                        .height(48.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(LocalYugmColors.current.surfaceElevated)
                        .border(1.dp, LocalYugmColors.current.border, RoundedCornerShape(16.dp))
                        .padding(horizontal = 14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Filled.Search, contentDescription = null, tint = LocalYugmColors.current.textSecondary, modifier = Modifier.size(18.dp))
                    BasicTextField(
                        value = searchQuery,
                        onValueChange = { searchQuery = it.take(60) },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                        textStyle = TextStyle(color = LocalYugmColors.current.textPrimary, fontSize = 14.sp),
                        cursorBrush = androidx.compose.ui.graphics.SolidColor(LocalYugmColors.current.secondary),
                        modifier = Modifier.weight(1f).padding(start = 10.dp),
                        decorationBox = { inner ->
                            Box {
                                if (searchQuery.isBlank()) {
                                    Text(
                                        when (mainTab) {
                                            1 -> "Search clan chat"
                                            2 -> "Search people"
                                            else -> "Search chats, people or messages"
                                        },
                                        color = LocalYugmColors.current.textSecondary,
                                        fontSize = 13.sp
                                    )
                                }
                                inner()
                            }
                        }
                    )
                    if (searchQuery.isNotBlank()) {
                        Text(
                            "Clear",
                            color = Color(0xFFC9A5FF),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier
                                .clip(CircleShape)
                                .clickable(role = Role.Button, onClickLabel = "Clear search") { searchQuery = "" }
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        )
                    }
                }
            }

            if (viewModel.error != null) {
                Column(Modifier.padding(horizontal = 20.dp, vertical = 6.dp).fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(LocalYugmColors.current.surface).padding(16.dp)) {
                    Text("Couldn't refresh your connections", color = LocalYugmColors.current.textPrimary, fontWeight = FontWeight.Bold)
                    Text(viewModel.error.orEmpty(), color = LocalYugmColors.current.textSecondary, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
                    TextButton(onClick = { viewModel.load(token, currentUserId) }) { Text("Try again", color = LocalYugmColors.current.secondary) }
                }
            }

            Box(Modifier.weight(1f).fillMaxWidth()) {
                when (mainTab) {
                    0 -> {
                        Box(modifier = Modifier.fillMaxSize()) {
                            LazyColumn(
                                modifier = Modifier.fillMaxSize(),
                                contentPadding = PaddingValues(top = 10.dp, bottom = listBottomPadding),
                                verticalArrangement = Arrangement.spacedBy(16.dp)
                            ) {
                                item {
                                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                        Row(
                                            Modifier.fillMaxWidth().padding(horizontal = 20.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text("People online", color = LocalYugmColors.current.textPrimary, fontSize = 19.sp, fontWeight = FontWeight.Bold)
                                            Spacer(Modifier.weight(1f))
                                            if (viewModel.isLoading && viewModel.recommendedChatUsers.isEmpty()) {
                                                CircularProgressIndicator(modifier = Modifier.size(16.dp), color = LocalYugmColors.current.secondary, strokeWidth = 2.dp)
                                            }
                                        }
                                        if (viewModel.recommendedChatUsers.isNotEmpty()) {
                                            LazyRow(
                                                contentPadding = PaddingValues(horizontal = 20.dp),
                                                horizontalArrangement = Arrangement.spacedBy(14.dp)
                                            ) {
                                                items(viewModel.recommendedChatUsers.take(25), key = { "rec-${it.id}" }) { user ->
                                                    RecommendedUserChip(user = user, onClick = { onOpenChat(user.id) })
                                                }
                                            }
                                        } else if (!viewModel.isLoading) {
                                            Text("Random people online will show up here.", color = LocalYugmColors.current.textSecondary, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 20.dp))
                                        }
                                    }
                                }
                                if (viewModel.matches.isNotEmpty() && searchQuery.isBlank()) item {
                                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                        Text("People you may know", color = LocalYugmColors.current.textPrimary, fontSize = 19.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 20.dp))
                                        LazyRow(contentPadding = PaddingValues(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                                            items(viewModel.matches.take(20), key = { "match-${it.id}" }) { user ->
                                                Column(Modifier.width(70.dp).clickable(role = Role.Button, onClickLabel = "Chat with ${user.name}") { onOpenChat(user.id) }, horizontalAlignment = Alignment.CenterHorizontally) {
                                                    Avatar(user.name.take(1), 58, user.avatar, user.activeCosmetics)
                                                    Text(user.name, color = LocalYugmColors.current.textPrimary, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 5.dp))
                                                }
                                            }
                                        }
                                    }
                                }
                                item {
                                    Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp), verticalAlignment = Alignment.CenterVertically) {
                                        Text("Chatlist", color = LocalYugmColors.current.textPrimary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                                        Spacer(Modifier.weight(1f))
                                        if (unread > 0) Text("Mark read", color = LocalYugmColors.current.secondary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold,
                                            modifier = Modifier.clickable(role = Role.Button, onClickLabel = "Mark all messages as read") { viewModel.markAllRead(token, currentUserId) }.padding(horizontal = 8.dp, vertical = 4.dp))
                                        Text("${filteredConversations.size} chats", color = LocalYugmColors.current.textSecondary, fontSize = 12.sp)
                                    }
                                }
                                if (viewModel.isLoading && filteredConversations.isEmpty()) item {
                                    Box(Modifier.fillMaxWidth().padding(48.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = LocalYugmColors.current.secondary) }
                                } else if (filteredConversations.isEmpty() && searchQuery.isNotBlank()) item {
                                    Column(
                                        Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 40.dp),
                                        horizontalAlignment = Alignment.CenterHorizontally
                                    ) {
                                        Text("No chats found", color = LocalYugmColors.current.textPrimary, fontSize = 17.sp, fontWeight = FontWeight.Bold)
                                        Text(
                                            "Nothing matches \"$searchQuery\". Try a different name or word.",
                                            color = LocalYugmColors.current.textSecondary,
                                            fontSize = 12.sp,
                                            textAlign = TextAlign.Center,
                                            modifier = Modifier.padding(top = 6.dp)
                                        )
                                    }
                                } else if (filteredConversations.isEmpty()) item {
                                    Column(
                                        Modifier
                                            .fillMaxWidth()
                                            .padding(horizontal = 24.dp, vertical = 48.dp)
                                            .clip(RoundedCornerShape(22.dp))
                                            .background(LocalYugmColors.current.surface.copy(alpha = 0.55f))
                                            .border(1.dp, LocalYugmColors.current.border.copy(alpha = 0.7f), RoundedCornerShape(22.dp))
                                            .padding(horizontal = 22.dp, vertical = 30.dp),
                                        horizontalAlignment = Alignment.CenterHorizontally
                                    ) {
                                        Text("▰", color = Color(0xFFC9B9FF), fontSize = 56.sp)
                                        Text("No conversations yet", color = LocalYugmColors.current.textPrimary, fontSize = 18.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 4.dp))
                                        Text(
                                            "Find interesting people and say hello.",
                                            color = LocalYugmColors.current.textSecondary,
                                            fontSize = 13.sp,
                                            textAlign = TextAlign.Center,
                                            modifier = Modifier.padding(top = 8.dp)
                                        )
                                        TextButton(onClick = onDiscover, modifier = Modifier.padding(top = 6.dp)) {
                                            Text("Find friends", color = LocalYugmColors.current.secondary, fontWeight = FontWeight.Bold)
                                        }
                                    }
                                } else {
                                    itemsIndexed(filteredConversations, key = { _, item -> "conversation-${item.partner.id}" }) { _, item ->
                                        val isMutedConversation = item.partner.id in viewModel.mutedPartnerIds
                                        LightChatRow(
                                            item,
                                            currentUserId = currentUserId,
                                            unreadCount = viewModel.unreadCounts[item.partner.id]
                                                ?: if (viewModel.unreadCounts.isEmpty() && !item.lastMessage.read && item.lastMessage.receiverId == currentUserId) 1 else 0,
                                            muted = isMutedConversation
                                        ) { onOpenChat(item.partner.id) }
                                    }
                                    if (viewModel.hasMoreRecent) {
                                        item {
                                            Row(
                                                Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 10.dp),
                                                horizontalArrangement = Arrangement.Center
                                            ) {
                                                Text(
                                                    text = if (viewModel.isLoadingMoreRecent) "Loading more chats…" else "Load more chats",
                                                    color = if (viewModel.isLoadingMoreRecent) LocalYugmColors.current.textSecondary else LocalYugmColors.current.textPrimary,
                                                    fontSize = 12.sp,
                                                    fontWeight = FontWeight.SemiBold,
                                                    modifier = Modifier
                                                        .clip(CircleShape)
                                                        .background(LocalYugmColors.current.surfaceElevated)
                                                        .border(1.dp, LocalYugmColors.current.border, CircleShape)
                                                        .clickable(
                                                            enabled = !viewModel.isLoadingMoreRecent,
                                                            role = Role.Button,
                                                            onClickLabel = "Load more chats"
                                                        ) { viewModel.loadMoreRecentMessages(token) }
                                                        .padding(horizontal = 18.dp, vertical = 10.dp)
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    1 -> {
                        val clan = viewModel.myClan
                        when {
                            viewModel.isLoading && clan == null -> {
                                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                    CircularProgressIndicator(color = LocalYugmColors.current.secondary)
                                }
                            }
                            clan == null -> {
                                Column(
                                    Modifier
                                        .fillMaxWidth()
                                        .padding(horizontal = 24.dp, vertical = 48.dp)
                                        .clip(RoundedCornerShape(22.dp))
                                        .background(LocalYugmColors.current.surface.copy(alpha = 0.55f))
                                        .border(1.dp, LocalYugmColors.current.border.copy(alpha = 0.7f), RoundedCornerShape(22.dp))
                                        .padding(horizontal = 22.dp, vertical = 30.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally
                                ) {
                                    Text("▰", color = Color(0xFFC9B9FF), fontSize = 56.sp)
                                    Text("No clan joined yet", color = LocalYugmColors.current.textPrimary, fontSize = 18.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 4.dp))
                                    Text(
                                        "Join a clan to unlock a shared family chat.",
                                        color = LocalYugmColors.current.textSecondary,
                                        fontSize = 13.sp,
                                        textAlign = TextAlign.Center,
                                        modifier = Modifier.padding(top = 8.dp)
                                    )
                                    TextButton(onClick = onJoinClan, modifier = Modifier.padding(top = 6.dp)) {
                                        Text("Join Clan", color = LocalYugmColors.current.secondary, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                            else -> {
                                ClanChatScreen(
                                    token = token,
                                    clanId = clan.id,
                                    currentUserId = currentUserId,
                                    clanName = clan.name,
                                    onBack = {},
                                    onClanDetails = { onOpenClanDetail(clan.id) }
                                )
                            }
                        }
                    }
                    2 -> {
                        Box(modifier = Modifier.fillMaxSize()) {
                            LazyColumn(
                                modifier = Modifier.fillMaxSize(),
                                contentPadding = PaddingValues(top = 10.dp, bottom = listBottomPadding),
                                verticalArrangement = Arrangement.spacedBy(16.dp)
                            ) {
                                item {
                                    Column(Modifier.padding(horizontal = 18.dp).clip(RoundedCornerShape(20.dp)).background(LocalYugmColors.current.surface).padding(5.dp)) {
                                        Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                                            val requestCount = viewModel.friendRequests.size
                                            listOf(
                                                "Friends",
                                                if (requestCount > 0) "Requests ($requestCount)" else "Requests",
                                                "Followers",
                                                "Following"
                                            ).forEachIndexed { index, label ->
                                                val selected = contactTab == index
                                                Box(Modifier.weight(1f).height(46.dp).clip(RoundedCornerShape(15.dp)).background(if (selected) Color(0xFF28243A) else Color.Transparent)
                                                    .clickable(role = Role.Tab) { contactTab = index }, contentAlignment = Alignment.Center) {
                                                    Text(
                                                        label,
                                                        color = if (selected) LocalYugmColors.current.secondary else if (index == 1 && requestCount > 0) Color(0xFFFF7AAE) else LocalYugmColors.current.textSecondary,
                                                        fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
                                                        fontSize = 12.sp,
                                                        maxLines = 1
                                                    )
                                                }
                                            }
                                        }
                                    }
                                }
                                item {
                                    Row(
                                        Modifier.fillMaxWidth().padding(horizontal = 20.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            "$contactCount $contactLabel${if (contactCount == 1) "" else "s"}",
                                            color = LocalYugmColors.current.textSecondary,
                                            fontSize = 13.sp
                                        )
                                        Spacer(Modifier.weight(1f))
                                        if (contactTab == 0) {
                                            Text(
                                                "Add friends",
                                                color = LocalYugmColors.current.secondary,
                                                fontSize = 12.sp,
                                                fontWeight = FontWeight.SemiBold,
                                                modifier = Modifier
                                                    .clip(CircleShape)
                                                    .clickable(role = Role.Button, onClickLabel = "Find friends") { showFindPeople = true }
                                                    .padding(horizontal = 10.dp, vertical = 5.dp)
                                            )
                                        }
                                    }
                                }
                                when (contactTab) {
                                    0 -> {
                                        if (viewModel.isLoading && filteredFriends.isEmpty()) item {
                                            Box(Modifier.fillMaxWidth().padding(48.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = LocalYugmColors.current.secondary) }
                                        } else if (filteredFriends.isEmpty()) item {
                                            ContactEmptyState(
                                                title = if (searchQuery.isBlank()) "No friends yet" else "No friends found",
                                                body = if (searchQuery.isBlank()) {
                                                    "Accepted friend requests will appear here. Tap “Add friends” to find people."
                                                } else {
                                                    "Nothing matches \"$searchQuery\"."
                                                },
                                                actionLabel = if (searchQuery.isBlank()) "Find people" else null,
                                                onAction = { showFindPeople = true }
                                            )
                                        } else {
                                            itemsIndexed(filteredFriends, key = { _, friend -> "friend-${friend._id}" }) { index, friend ->
                                                FriendContactRow(
                                                    friend = friend,
                                                    showDivider = index > 0,
                                                    busy = viewModel.friendActionBusyId == friend._id,
                                                    onOpenChat = { onOpenChat(friend._id) }
                                                )
                                            }
                                        }
                                    }
                                    1 -> {
                                        if (filteredRequests.isEmpty()) item {
                                            ContactEmptyState(
                                                title = "No pending requests",
                                                body = "New friend requests will show up here so you can accept or decline them."
                                            )
                                        } else {
                                            itemsIndexed(filteredRequests, key = { _, request -> "request-${request._id}" }) { index, request ->
                                                val person = request.userId ?: request.friendId
                                                if (person != null) {
                                                    FriendRequestRow(
                                                        person = person,
                                                        showDivider = index > 0,
                                                        busy = viewModel.friendActionBusyId == person._id,
                                                        onAccept = { viewModel.acceptFriendRequest(token, person._id) },
                                                        onDecline = { viewModel.declineFriendRequest(token, person._id) }
                                                    )
                                                }
                                            }
                                        }
                                    }
                                    2 -> {
                                        if (viewModel.isLoading && filteredFollowers.isEmpty()) item {
                                            Box(Modifier.fillMaxWidth().padding(48.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = LocalYugmColors.current.secondary) }
                                        } else if (filteredFollowers.isEmpty()) item {
                                            ContactEmptyState(
                                                title = "No followers yet",
                                                body = if (searchQuery.isBlank()) "People who follow you will appear here." else "Nothing matches \"$searchQuery\"."
                                            )
                                        } else {
                                            itemsIndexed(filteredFollowers, key = { _, person -> "follower-${person.id}" }) { index, person ->
                                                PersonContactRow(person = person, showDivider = index > 0, onClick = { onOpenChat(person.id) })
                                            }
                                        }
                                    }
                                    else -> {
                                        if (viewModel.isLoading && filteredFollowing.isEmpty()) item {
                                            Box(Modifier.fillMaxWidth().padding(48.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = LocalYugmColors.current.secondary) }
                                        } else if (filteredFollowing.isEmpty()) item {
                                            ContactEmptyState(
                                                title = "Not following anyone yet",
                                                body = if (searchQuery.isBlank()) "People you follow will appear here." else "Nothing matches \"$searchQuery\"."
                                            )
                                        } else {
                                            itemsIndexed(filteredFollowing, key = { _, person -> "following-${person.id}" }) { index, person ->
                                                PersonContactRow(person = person, showDivider = index > 0, onClick = { onOpenChat(person.id) })
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
        if (showBottomDock && mainTab != 1) {
            YugmBottomDock(
                selected = YugmDockTab.CHAT,
                onDiscover = onDiscover,
                onCreate = onCreateRoom,
                onLive = onLive,
                onChat = {},
                onWallet = onWallet,
                onProfile = onProfile,
                onGameZone = onGameZone,
                chatBadge = unread.coerceAtMost(9),
                modifier = Modifier.align(Alignment.BottomCenter)
            )
        }
        if (showFindPeople) {
            FindPeopleSheet(
                token = token,
                currentUserId = currentUserId,
                onDismiss = { showFindPeople = false },
                onOpenChat = { userId ->
                    showFindPeople = false
                    onOpenChat(userId)
                },
                onFollowChanged = { viewModel.load(token, currentUserId) }
            )
        }
    }
}

@Composable
@OptIn(ExperimentalMaterial3Api::class)
private fun FindPeopleSheet(
    token: String,
    currentUserId: String,
    onDismiss: () -> Unit,
    onOpenChat: (String) -> Unit,
    onFollowChanged: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val scope = rememberCoroutineScope()
    var query by remember { mutableStateOf("") }
    var results by remember { mutableStateOf<List<Host>>(emptyList()) }
    var searching by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var busyUserId by remember { mutableStateOf("") }
    var retry by remember { mutableIntStateOf(0) }

    LaunchedEffect(query, token, currentUserId, retry) {
        val username = query.trim().removePrefix("@").trim()
        if (username.length < 2) {
            results = emptyList()
            error = null
            searching = false
            return@LaunchedEffect
        }
        delay(320)
        searching = true
        error = null
        try {
            results = withContext(Dispatchers.IO) {
                YugmApi.searchUsers(username, token, usernameOnly = true)
                    .filter { it.id != currentUserId }
                    .take(30)
            }
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (exception: Exception) {
            error = exception.message ?: "Search failed. Try again."
            results = emptyList()
        } finally {
            searching = false
        }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = LocalYugmColors.current.background,
        contentColor = LocalYugmColors.current.textPrimary,
        dragHandle = null
    ) {
        Column(
            Modifier.fillMaxWidth().fillMaxHeight(0.88f).padding(horizontal = 20.dp)
        ) {
            Row(
                Modifier.fillMaxWidth().padding(top = 20.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    Modifier.size(44.dp).clip(RoundedCornerShape(15.dp)).background(LocalYugmColors.current.secondary.copy(alpha = 0.2f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Filled.PersonAdd, contentDescription = null, tint = Color(0xFFC9A5FF), modifier = Modifier.size(22.dp))
                }
                Column(Modifier.weight(1f).padding(start = 12.dp)) {
                    Text("Find people", color = LocalYugmColors.current.textPrimary, fontSize = 21.sp, fontWeight = FontWeight.Bold)
                    Text("Search by username and start a conversation", color = LocalYugmColors.current.textSecondary, fontSize = 12.sp, modifier = Modifier.padding(top = 3.dp))
                }
                IconButton(onClick = onDismiss) {
                    Icon(Icons.Filled.Close, contentDescription = "Close search", tint = LocalYugmColors.current.textSecondary)
                }
            }

            Row(
                Modifier.fillMaxWidth().padding(top = 20.dp).height(54.dp)
                    .clip(RoundedCornerShape(17.dp)).background(LocalYugmColors.current.surfaceElevated)
                    .border(1.dp, LocalYugmColors.current.border, RoundedCornerShape(17.dp)).padding(horizontal = 15.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(Icons.Filled.Search, contentDescription = null, tint = LocalYugmColors.current.textSecondary, modifier = Modifier.size(21.dp))
                BasicTextField(
                    value = query,
                    onValueChange = { query = it.take(32) },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                    textStyle = TextStyle(color = LocalYugmColors.current.textPrimary, fontSize = 15.sp),
                    cursorBrush = androidx.compose.ui.graphics.SolidColor(LocalYugmColors.current.secondary),
                    modifier = Modifier.weight(1f).padding(start = 11.dp),
                    decorationBox = { inner ->
                        Box {
                            if (query.isBlank()) Text("Enter a username", color = LocalYugmColors.current.textSecondary, fontSize = 14.sp)
                            inner()
                        }
                    }
                )
                if (query.isNotBlank()) {
                    Text("Clear", color = Color(0xFFC9A5FF), fontSize = 12.sp, fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.clickable(role = Role.Button, onClickLabel = "Clear username search") { query = "" }.padding(start = 10.dp))
                }
            }
            Text("Use at least 2 characters", color = LocalYugmColors.current.textSecondary, fontSize = 11.sp, modifier = Modifier.padding(start = 4.dp, top = 8.dp, bottom = 12.dp))

            Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                when {
                    query.trim().removePrefix("@").trim().length < 2 -> {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Filled.PersonAdd, contentDescription = null, tint = LocalYugmColors.current.secondary.copy(alpha = 0.75f), modifier = Modifier.size(38.dp))
                            Text("Find someone by their @username", color = LocalYugmColors.current.textSecondary, fontSize = 13.sp, modifier = Modifier.padding(top = 12.dp))
                        }
                    }
                    searching -> CircularProgressIndicator(color = LocalYugmColors.current.secondary, strokeWidth = 2.5.dp)
                    error != null -> Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(error.orEmpty(), color = LocalYugmColors.current.textSecondary, fontSize = 13.sp)
                        TextButton(onClick = { retry++ }) { Text("Try again", color = Color(0xFFC9A5FF)) }
                    }
                    results.isEmpty() -> Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("No users found", color = LocalYugmColors.current.textPrimary, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                        Text("Check the spelling or try another username.", color = LocalYugmColors.current.textSecondary, fontSize = 12.sp, modifier = Modifier.padding(top = 5.dp))
                    }
                    else -> LazyColumn(
                        Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.spacedBy(9.dp),
                        contentPadding = PaddingValues(bottom = 24.dp)
                    ) {
                        items(results, key = { "find-${it.id}" }) { user ->
                            FindPeopleResultRow(
                                user = user,
                                followBusy = busyUserId == user.id,
                                onOpenChat = { onOpenChat(user.id) },
                                onFollow = {
                                    if (busyUserId.isNotBlank()) return@FindPeopleResultRow
                                    busyUserId = user.id
                                    scope.launch {
                                        val result = withContext(Dispatchers.IO) {
                                            runCatching {
                                                if (user.isFollowing) YugmApi.unfollowUser(token, user.id)
                                                else YugmApi.followUser(token, user.id)
                                            }
                                        }
                                        result.onSuccess {
                                            results = results.map { person ->
                                                if (person.id == user.id) person.copy(isFollowing = !user.isFollowing) else person
                                            }
                                            onFollowChanged()
                                        }.onFailure { exception ->
                                            error = exception.message ?: "Couldn't update this connection."
                                        }
                                        busyUserId = ""
                                    }
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun FindPeopleResultRow(
    user: Host,
    followBusy: Boolean,
    onOpenChat: () -> Unit,
    onFollow: () -> Unit
) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(19.dp)).background(LocalYugmColors.current.surface)
            .border(1.dp, LocalYugmColors.current.border, RoundedCornerShape(19.dp)).padding(horizontal = 13.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Avatar(user.name.take(1), 48, user.avatar, user.activeCosmetics)
        Column(
            Modifier.weight(1f).padding(start = 11.dp).clickable(role = Role.Button, onClickLabel = "Start a chat with ${user.name}", onClick = onOpenChat),
            verticalArrangement = Arrangement.Center
        ) {
            Text(user.name.ifBlank { user.username }, color = LocalYugmColors.current.textPrimary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text("@${user.username}", color = LocalYugmColors.current.textSecondary, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Box(
            Modifier.padding(start = 8.dp).clip(RoundedCornerShape(13.dp))
                .background(if (user.isFollowing) LocalYugmColors.current.surfaceElevated else LocalYugmColors.current.secondary.copy(alpha = 0.88f))
                .clickable(enabled = !followBusy, role = Role.Button, onClickLabel = if (user.isFollowing) "Unfollow ${user.name}" else "Follow ${user.name}", onClick = onFollow)
                .padding(horizontal = 12.dp, vertical = 9.dp),
            contentAlignment = Alignment.Center
        ) {
            if (followBusy) CircularProgressIndicator(Modifier.size(15.dp), color = LocalYugmColors.current.textPrimary, strokeWidth = 2.dp)
            else Text(if (user.isFollowing) "Following" else "Follow", color = LocalYugmColors.current.textPrimary, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        }
        TextButton(onClick = onOpenChat, modifier = Modifier.padding(start = 3.dp)) {
            Text("Message", color = Color(0xFFC9A5FF), fontSize = 11.sp, fontWeight = FontWeight.Bold)
        }
    }
}




@Composable
private fun ContactCard(showDivider: Boolean, content: @Composable () -> Unit) {
    Column(
        Modifier.padding(horizontal = 16.dp, vertical = 1.dp)
            .clip(RoundedCornerShape(18.dp))
            .background(LocalYugmColors.current.surface)
    ) {
        if (showDivider) Box(Modifier.fillMaxWidth().padding(start = 74.dp).height(1.dp).background(LocalYugmColors.current.border))
        content()
    }
}

@Composable
private fun ContactEmptyState(
    title: String,
    body: String,
    actionLabel: String? = null,
    onAction: () -> Unit = {}
) {
    Column(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp, vertical = 42.dp)
            .clip(RoundedCornerShape(20.dp))
            .background(LocalYugmColors.current.surface.copy(alpha = 0.55f))
            .border(1.dp, LocalYugmColors.current.border.copy(alpha = 0.7f), RoundedCornerShape(20.dp))
            .padding(horizontal = 20.dp, vertical = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(title, color = LocalYugmColors.current.textPrimary, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center)
        Text(
            body,
            color = LocalYugmColors.current.textSecondary,
            fontSize = 12.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 6.dp)
        )
        if (actionLabel != null) {
            TextButton(onClick = onAction, modifier = Modifier.padding(top = 4.dp)) {
                Text(actionLabel, color = LocalYugmColors.current.secondary, fontWeight = FontWeight.Bold, fontSize = 13.sp)
            }
        }
    }
}

@Composable
private fun FriendContactRow(
    friend: FriendUser,
    showDivider: Boolean,
    busy: Boolean,
    onOpenChat: () -> Unit
) {
    ContactCard(showDivider) {
        Row(
            Modifier.fillMaxWidth().height(76.dp)
                .clickable(role = Role.Button, onClickLabel = "Open chat with ${friend.name}", onClick = onOpenChat)
                .padding(horizontal = 14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Avatar(friend.name.take(1).uppercase(), 48, friend.avatar)
            Column(Modifier.weight(1f).padding(start = 12.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        friend.name.ifBlank { friend.username },
                        color = LocalYugmColors.current.textPrimary,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    if (friend.isVerified) Text(" ✓", color = Color(0xFF7CC7FF), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
                Text(
                    if (friend.username.isNotBlank()) "@${friend.username} · Level ${friend.level}" else "Level ${friend.level}",
                    color = LocalYugmColors.current.textSecondary,
                    fontSize = 12.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
            if (busy) CircularProgressIndicator(Modifier.size(16.dp), color = LocalYugmColors.current.secondary, strokeWidth = 2.dp)
            else Text("›", color = LocalYugmColors.current.textSecondary, fontSize = 25.sp)
        }
    }
}

@Composable
private fun FriendRequestRow(
    person: FriendUser,
    showDivider: Boolean,
    busy: Boolean,
    onAccept: () -> Unit,
    onDecline: () -> Unit
) {
    ContactCard(showDivider) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Avatar(person.name.take(1).uppercase(), 48, person.avatar)
            Column(Modifier.weight(1f).padding(start = 12.dp)) {
                Text(
                    person.name.ifBlank { person.username },
                    color = LocalYugmColors.current.textPrimary,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    if (person.username.isNotBlank()) "@${person.username}" else "Wants to connect",
                    color = LocalYugmColors.current.textSecondary,
                    fontSize = 12.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
            if (busy) {
                CircularProgressIndicator(Modifier.size(18.dp), color = LocalYugmColors.current.secondary, strokeWidth = 2.dp)
            } else {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(
                        Modifier.clip(CircleShape).background(Color(0xFF1F7A4A))
                            .clickable(role = Role.Button, onClickLabel = "Accept friend request from ${person.name}", onClick = onAccept)
                            .padding(horizontal = 13.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Filled.Check, contentDescription = null, tint = Color.White, modifier = Modifier.size(14.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Accept", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                    Text(
                        "Decline",
                        color = LocalYugmColors.current.textSecondary,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.clip(CircleShape).background(LocalYugmColors.current.surfaceElevated)
                            .clickable(role = Role.Button, onClickLabel = "Decline friend request from ${person.name}", onClick = onDecline)
                            .padding(horizontal = 11.dp, vertical = 8.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun PersonContactRow(person: Host, showDivider: Boolean, onClick: () -> Unit) {
    ContactCard(showDivider) {
        Row(
            Modifier.fillMaxWidth().height(76.dp)
                .clickable(role = Role.Button, onClickLabel = "Open chat with ${person.name}", onClick = onClick)
                .padding(horizontal = 14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box {
                Avatar(person.name.take(1).uppercase(), 48, person.avatar, person.activeCosmetics)
                if (person.isOnline) Box(Modifier.align(Alignment.BottomEnd).size(12.dp).clip(CircleShape).background(Color(0xFF39C891)).border(2.dp, LocalYugmColors.current.surface, CircleShape))
            }
            Column(Modifier.weight(1f).padding(start = 12.dp)) {
                Text(person.name, color = LocalYugmColors.current.textPrimary, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(
                    when {
                        person.username.isNotBlank() -> "@${person.username}"
                        person.isOnline -> "Online"
                        else -> "Yugm member"
                    },
                    color = LocalYugmColors.current.textSecondary,
                    fontSize = 12.sp
                )
            }
            Text("›", color = LocalYugmColors.current.textSecondary, fontSize = 25.sp)
        }
    }
}

@Composable
private fun LightChatRow(
    item: ConversationItem,
    currentUserId: String,
    unreadCount: Int,
    muted: Boolean,
    onClick: () -> Unit
) {
    val preview = buildConversationPreview(item.lastMessage, currentUserId)
    val time = conversationTimeLabel(item.lastMessage.createdAt)
    val hasUnread = unreadCount > 0
    Column(Modifier.fillMaxWidth()) {
        Row(
            Modifier
                .fillMaxWidth()
                .clickable(role = Role.Button, onClickLabel = "Open conversation with ${item.partner.name}", onClick = onClick)
                .padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
        Box {
            Avatar(item.partner.name.take(1), 52, item.partner.avatar, item.partner.activeCosmetics)
            if (item.partner.isOnline) Box(Modifier.align(Alignment.BottomEnd).size(13.dp).clip(CircleShape).background(Color(0xFF39C891)).border(2.dp, LocalYugmColors.current.surface, CircleShape))
        }
        Column(Modifier.weight(1f).padding(start = 12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    item.partner.name.ifBlank { item.partner.username.ifBlank { "User" } },
                    color = LocalYugmColors.current.textPrimary,
                    fontSize = 15.sp,
                    fontWeight = if (hasUnread) FontWeight.Bold else FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )
                if (time.isNotBlank()) {
                    Text(
                        time,
                        color = if (hasUnread) Color(0xFFC9A5FF) else LocalYugmColors.current.textSecondary,
                        fontSize = 11.sp,
                        fontWeight = if (hasUnread) FontWeight.SemiBold else FontWeight.Normal
                    )
                }
            }
            Row(Modifier.padding(top = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                if (muted) Text("🔇", fontSize = 11.sp)
                Text(
                    preview,
                    color = if (hasUnread) LocalYugmColors.current.textPrimary.copy(alpha = 0.9f) else LocalYugmColors.current.textSecondary,
                    fontSize = 12.sp,
                    fontWeight = if (hasUnread) FontWeight.Medium else FontWeight.Normal,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )
                if (hasUnread) {
                    Spacer(Modifier.width(8.dp))
                    Box(
                        Modifier
                            .clip(CircleShape)
                            .background(LocalYugmColors.current.secondary)
                            .border(1.dp, Color.White.copy(alpha = 0.12f), CircleShape)
                            .padding(horizontal = 7.dp, vertical = 3.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(unreadCount.coerceAtMost(99).toString(), color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
    }
}

private fun buildConversationPreview(message: DirectMessage, currentUserId: String): String {
    val minePrefix = if (currentUserId.isNotBlank() && message.senderId == currentUserId) "You: " else ""
    val forwardedPrefix = if (message.forwarded) "Forwarded · " else ""
    val text = message.message.trim()
    val lower = text.lowercase()
    val callLabel = when {
        lower.startsWith("private video call started") || lower.startsWith("video call started") -> "📹 Video call"
        lower.startsWith("private voice call started") || lower.startsWith("voice call started") -> "📞 Voice call"
        lower.contains("missed video call") -> "📹 Missed video call"
        lower.contains("missed voice call") || lower.contains("missed call") -> "📞 Missed call"
        else -> null
    }
    val body = when {
        message.mediaType.equals("AUDIO", true) -> "🎤 Voice note"
        message.mediaType.equals("IMAGE", true) -> "📷 Photo"
        message.mediaType.equals("VIDEO", true) -> "🎬 Video"
        callLabel != null -> callLabel
        text.isNotBlank() -> if (message.isEdited) "$text (edited)" else text
        else -> "New message"
    }
    return minePrefix + forwardedPrefix + body
}

private fun conversationTimeLabel(createdAt: String): String = com.yugm.app.feature.chat.formatConversationTimeLabel(createdAt)

@Composable
private fun RecommendedUserChip(user: Host, onClick: () -> Unit) {
    Column(
        modifier = Modifier
            .width(76.dp)
            .clickable(role = Role.Button, onClickLabel = "Chat with ${user.name}", onClick = onClick),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(5.dp)
    ) {
        Box(contentAlignment = Alignment.BottomEnd) {
            // Avatar with frame cosmetics
            Box(
                modifier = Modifier
                    .size(66.dp)
                    .clip(CircleShape)
                    .background(LocalYugmColors.current.surfaceElevated)
                    .border(2.dp, if (user.isOnline) Color(0xFF39C891).copy(alpha = 0.6f) else Color(0xFF2E3050), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Avatar(
                    initial = user.name.take(1),
                    size = 62,
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
                    .border(2.dp, LocalYugmColors.current.background, CircleShape)
            )
        }
        Text(
            text = user.name.ifBlank { user.username }.take(10),
            color = LocalYugmColors.current.textPrimary,
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

data class ConversationItem(val partner: Host, val lastMessage: DirectMessage)
