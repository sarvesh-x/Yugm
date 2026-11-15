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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
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
import com.yugm.app.core.model.ClanMessage
import com.yugm.app.core.model.DirectMessage
import com.yugm.app.core.model.Host
import com.yugm.app.core.ui.components.Avatar
import com.yugm.app.core.ui.components.YugmBottomDock
import com.yugm.app.core.ui.components.YugmPullToRefreshBox
import com.yugm.app.core.ui.components.YugmDockTab
import com.yugm.app.feature.chat.viewmodel.ChatListViewModel
import com.yugm.app.feature.social.screens.ClanChatScreen
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

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
    onProfile: () -> Unit = {},
    onOpenClan: (String, String) -> Unit = { _, _ -> },
    onJoinClan: () -> Unit = {},
    onOpenClanDetail: (String) -> Unit = {}
) {
    val viewModel: ChatListViewModel = hiltViewModel()
    var mainTab by remember { mutableIntStateOf(0) }
    var contactTab by remember { mutableIntStateOf(0) }
    var showFindPeople by remember { mutableStateOf(false) }

    LaunchedEffect(token, currentUserId) { viewModel.load(token, currentUserId) }
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner, token, currentUserId) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) viewModel.load(token, currentUserId)
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    val conversations = remember(viewModel.recentMessages, viewModel.matches, currentUserId) {
        viewModel.recentMessages.groupBy { if (it.senderId == currentUserId) it.receiverId else it.senderId }
            .mapNotNull { (partnerId, messages) ->
                val last = messages.maxByOrNull { it.createdAt } ?: return@mapNotNull null
                val messagePartner = if (last.senderId == currentUserId) last.receiver else last.sender
                val partner = viewModel.matches.find { it.id == partnerId }
                    ?: messagePartner?.takeIf { it.id == partnerId }
                    ?: Host(id = partnerId, name = "Yugm User")
                ConversationItem(partner, last)
            }
            .sortedByDescending { it.lastMessage.createdAt }
    }
    val unread = viewModel.unreadCounts.values.sum()
    val friendIds = remember(viewModel.followers, viewModel.following) { viewModel.followers.map { it.id }.intersect(viewModel.following.map { it.id }.toSet()) }
    val contactList = when (contactTab) {
        0 -> viewModel.following.filter { it.id in friendIds }
        1 -> viewModel.followers
        else -> viewModel.following
    }

    Box(Modifier.fillMaxSize().background(ChatBg)) {
        Column(Modifier.fillMaxSize()) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
                ChatTopTab("Chats", selected = mainTab == 0) { mainTab = 0 }
                Spacer(Modifier.width(18.dp))
                ChatTopTab("Clan", selected = mainTab == 1) { mainTab = 1 }
                Spacer(Modifier.width(18.dp))
                ChatTopTab("Contacts", selected = mainTab == 2) { mainTab = 2 }
                Spacer(Modifier.weight(1f))
                Box(Modifier.size(42.dp).clip(CircleShape).background(ChatPanel).border(1.dp, ChatLine, CircleShape).clickable(role = Role.Button, onClickLabel = "Find people by username", onClick = { showFindPeople = true }), contentAlignment = Alignment.Center) {
                    Icon(Icons.Filled.PersonAdd, contentDescription = null, tint = ChatInk, modifier = Modifier.size(20.dp))
                }
            }

            if (viewModel.error != null) {
                Column(Modifier.padding(horizontal = 20.dp, vertical = 6.dp).fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(ChatCard).padding(16.dp)) {
                    Text("Couldn't refresh your connections", color = ChatInk, fontWeight = FontWeight.Bold)
                    Text(viewModel.error.orEmpty(), color = ChatMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
                    TextButton(onClick = { viewModel.load(token, currentUserId) }) { Text("Try again", color = ChatPurple) }
                }
            }

            Box(Modifier.weight(1f).fillMaxWidth()) {
                when (mainTab) {
                    0 -> {
                        YugmPullToRefreshBox(
                            isRefreshing = viewModel.isLoading,
                            onRefresh = { viewModel.load(token, currentUserId) },
                            modifier = Modifier.fillMaxSize()
                        ) {
                            LazyColumn(
                                modifier = Modifier.fillMaxSize(),
                                contentPadding = PaddingValues(top = 8.dp, bottom = 110.dp),
                                verticalArrangement = Arrangement.spacedBy(18.dp)
                            ) {
                                item {
                                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                        Row(
                                            Modifier.fillMaxWidth().padding(horizontal = 22.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text("People online", color = ChatInk, fontSize = 19.sp, fontWeight = FontWeight.Bold)
                                            Spacer(Modifier.weight(1f))
                                            if (viewModel.isLoading && viewModel.recommendedChatUsers.isEmpty()) {
                                                CircularProgressIndicator(modifier = Modifier.size(16.dp), color = ChatPurple, strokeWidth = 2.dp)
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
                                            Text("Random people online will show up here.", color = ChatMuted, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 20.dp))
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
                                            LightChatRow(
                                                item,
                                                unreadCount = viewModel.unreadCounts[item.partner.id] ?: if (!item.lastMessage.read && item.lastMessage.receiverId == currentUserId) 1 else 0,
                                                muted = item.partner.id in viewModel.mutedPartnerIds
                                            ) { onOpenChat(item.partner.id) }
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
                                    CircularProgressIndicator(color = ChatPurple)
                                }
                            }
                            clan == null -> {
                                Column(
                                    Modifier.fillMaxWidth().padding(horizontal = 22.dp, vertical = 42.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally
                                ) {
                                    Text("▰", color = Color(0xFFC9B9FF), fontSize = 62.sp)
                                    Text("No clan joined yet", color = ChatInk, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                                    Text(
                                        "Join a clan to unlock a shared family chat.",
                                        color = ChatMuted,
                                        fontSize = 13.sp,
                                        textAlign = TextAlign.Center,
                                        modifier = Modifier.padding(top = 6.dp)
                                    )
                                    TextButton(onClick = onJoinClan) {
                                        Text("Join Clan", color = ChatPurple, fontWeight = FontWeight.Bold)
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
                        YugmPullToRefreshBox(
                            isRefreshing = viewModel.isLoading,
                            onRefresh = { viewModel.load(token, currentUserId) },
                            modifier = Modifier.fillMaxSize()
                        ) {
                            LazyColumn(
                                modifier = Modifier.fillMaxSize(),
                                contentPadding = PaddingValues(top = 8.dp, bottom = 110.dp),
                                verticalArrangement = Arrangement.spacedBy(18.dp)
                            ) {
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
        containerColor = ChatBg,
        contentColor = ChatInk,
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
                    Modifier.size(44.dp).clip(RoundedCornerShape(15.dp)).background(ChatPurple.copy(alpha = 0.2f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Filled.PersonAdd, contentDescription = null, tint = Color(0xFFC9A5FF), modifier = Modifier.size(22.dp))
                }
                Column(Modifier.weight(1f).padding(start = 12.dp)) {
                    Text("Find people", color = ChatInk, fontSize = 21.sp, fontWeight = FontWeight.Bold)
                    Text("Search by username and start a conversation", color = ChatMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 3.dp))
                }
                IconButton(onClick = onDismiss) {
                    Icon(Icons.Filled.Close, contentDescription = "Close search", tint = ChatMuted)
                }
            }

            Row(
                Modifier.fillMaxWidth().padding(top = 20.dp).height(54.dp)
                    .clip(RoundedCornerShape(17.dp)).background(ChatPanel)
                    .border(1.dp, ChatLine, RoundedCornerShape(17.dp)).padding(horizontal = 15.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(Icons.Filled.Search, contentDescription = null, tint = ChatMuted, modifier = Modifier.size(21.dp))
                BasicTextField(
                    value = query,
                    onValueChange = { query = it.take(32) },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                    textStyle = TextStyle(color = ChatInk, fontSize = 15.sp),
                    cursorBrush = androidx.compose.ui.graphics.SolidColor(ChatPurple),
                    modifier = Modifier.weight(1f).padding(start = 11.dp),
                    decorationBox = { inner ->
                        Box {
                            if (query.isBlank()) Text("Enter a username", color = ChatMuted, fontSize = 14.sp)
                            inner()
                        }
                    }
                )
                if (query.isNotBlank()) {
                    Text("Clear", color = Color(0xFFC9A5FF), fontSize = 12.sp, fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.clickable(role = Role.Button, onClickLabel = "Clear username search") { query = "" }.padding(start = 10.dp))
                }
            }
            Text("Use at least 2 characters", color = ChatMuted, fontSize = 11.sp, modifier = Modifier.padding(start = 4.dp, top = 8.dp, bottom = 12.dp))

            Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                when {
                    query.trim().removePrefix("@").trim().length < 2 -> {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Filled.PersonAdd, contentDescription = null, tint = ChatPurple.copy(alpha = 0.75f), modifier = Modifier.size(38.dp))
                            Text("Find someone by their @username", color = ChatMuted, fontSize = 13.sp, modifier = Modifier.padding(top = 12.dp))
                        }
                    }
                    searching -> CircularProgressIndicator(color = ChatPurple, strokeWidth = 2.5.dp)
                    error != null -> Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(error.orEmpty(), color = ChatMuted, fontSize = 13.sp)
                        TextButton(onClick = { retry++ }) { Text("Try again", color = Color(0xFFC9A5FF)) }
                    }
                    results.isEmpty() -> Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("No users found", color = ChatInk, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                        Text("Check the spelling or try another username.", color = ChatMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 5.dp))
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
        Modifier.fillMaxWidth().clip(RoundedCornerShape(19.dp)).background(ChatCard)
            .border(1.dp, ChatLine, RoundedCornerShape(19.dp)).padding(horizontal = 13.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Avatar(user.name.take(1), 48, user.avatar, user.activeCosmetics)
        Column(
            Modifier.weight(1f).padding(start = 11.dp).clickable(role = Role.Button, onClickLabel = "Start a chat with ${user.name}", onClick = onOpenChat),
            verticalArrangement = Arrangement.Center
        ) {
            Text(user.name.ifBlank { user.username }, color = ChatInk, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text("@${user.username}", color = ChatMuted, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Box(
            Modifier.padding(start = 8.dp).clip(RoundedCornerShape(13.dp))
                .background(if (user.isFollowing) ChatPanel else ChatPurple.copy(alpha = 0.88f))
                .clickable(enabled = !followBusy, role = Role.Button, onClickLabel = if (user.isFollowing) "Unfollow ${user.name}" else "Follow ${user.name}", onClick = onFollow)
                .padding(horizontal = 12.dp, vertical = 9.dp),
            contentAlignment = Alignment.Center
        ) {
            if (followBusy) CircularProgressIndicator(Modifier.size(15.dp), color = ChatInk, strokeWidth = 2.dp)
            else Text(if (user.isFollowing) "Following" else "Follow", color = ChatInk, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        }
        TextButton(onClick = onOpenChat, modifier = Modifier.padding(start = 3.dp)) {
            Text("Message", color = Color(0xFFC9A5FF), fontSize = 11.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun ChatTopTab(label: String, selected: Boolean, onClick: () -> Unit) {
    Column(Modifier.height(48.dp).clickable(role = Role.Tab, onClickLabel = label, onClick = onClick), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        Text(label, color = if (selected) ChatInk else ChatMuted, fontSize = 17.sp, fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium)
        Box(Modifier.padding(top = 2.dp).size(width = if (selected) 30.dp else 0.dp, height = 4.dp).clip(CircleShape).background(ChatPurple))
    }
}


@Composable
private fun LightChatRow(item: ConversationItem, unreadCount: Int, muted: Boolean, onClick: () -> Unit) {
    val preview = buildConversationPreview(item.lastMessage)
    val time = conversationTimeLabel(item.lastMessage.createdAt)
    val hasUnread = unreadCount > 0
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 4.dp)
            .clip(RoundedCornerShape(18.dp))
            .background(if (hasUnread) ChatCard.copy(alpha = 0.98f) else ChatCard.copy(alpha = 0.78f))
            .border(1.dp, if (hasUnread) ChatPurple.copy(alpha = 0.28f) else ChatLine.copy(alpha = 0.7f), RoundedCornerShape(18.dp))
            .clickable(role = Role.Button, onClickLabel = "Open conversation with ${item.partner.name}", onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box {
            Avatar(item.partner.name.take(1), 52, item.partner.avatar, item.partner.activeCosmetics)
            if (item.partner.isOnline) Box(Modifier.align(Alignment.BottomEnd).size(13.dp).clip(CircleShape).background(Color(0xFF39C891)).border(2.dp, ChatCard, CircleShape))
        }
        Column(Modifier.weight(1f).padding(start = 12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    item.partner.name.ifBlank { item.partner.username.ifBlank { "User" } },
                    color = ChatInk,
                    fontSize = 15.sp,
                    fontWeight = if (hasUnread) FontWeight.Bold else FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )
                if (time.isNotBlank()) {
                    Text(
                        time,
                        color = if (hasUnread) Color(0xFFC9A5FF) else ChatMuted,
                        fontSize = 11.sp,
                        fontWeight = if (hasUnread) FontWeight.SemiBold else FontWeight.Normal
                    )
                }
            }
            Row(Modifier.padding(top = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                if (muted) Text("🔕 ", fontSize = 11.sp)
                Text(
                    preview,
                    color = if (hasUnread) ChatInk.copy(alpha = 0.9f) else ChatMuted,
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
                            .background(Brush.horizontalGradient(listOf(ChatPurple, Color(0xFF9F5CFF))))
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

private fun buildConversationPreview(message: DirectMessage): String {
    val prefix = if (message.forwarded) "Forwarded · " else ""
    return prefix + when {
        message.mediaType.equals("AUDIO", true) -> "🎤 Voice note"
        message.mediaType.equals("IMAGE", true) -> "📷 Photo"
        message.mediaType.equals("VIDEO", true) -> "🎬 Video"
        message.message.contains("call started", ignoreCase = true) || message.message.contains("call", ignoreCase = true) && message.message.contains("private", ignoreCase = true) -> "📞 Call"
        message.message.isNotBlank() -> message.message
        else -> "New message"
    }
}

private fun conversationTimeLabel(createdAt: String): String {
    if (createdAt.isBlank()) return ""
    return runCatching {
        val instant = java.time.Instant.parse(createdAt)
        val local = instant.atZone(java.time.ZoneId.systemDefault())
        val now = java.time.ZonedDateTime.now()
        when {
            local.toLocalDate() == now.toLocalDate() -> java.time.format.DateTimeFormatter.ofPattern("HH:mm").format(local)
            local.toLocalDate() == now.toLocalDate().minusDays(1) -> "Yesterday"
            local.year == now.year -> java.time.format.DateTimeFormatter.ofPattern("MMM d").format(local)
            else -> java.time.format.DateTimeFormatter.ofPattern("MMM d, yyyy").format(local)
        }
    }.getOrElse { if (createdAt.length >= 16) createdAt.substring(11, 16) else "" }
}

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
                    .background(ChatPanel)
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
