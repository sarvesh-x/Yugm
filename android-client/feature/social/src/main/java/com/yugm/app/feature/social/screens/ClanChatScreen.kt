package com.yugm.app.feature.social.screens

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.yugm.app.core.model.ClanMessage
import com.yugm.app.core.ui.components.Avatar
import com.yugm.app.core.ui.components.LoadingState
import com.yugm.app.feature.social.viewmodel.ClanViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private val ClanChatBg = Color(0xFF080817)
private val ClanChatCard = Color(0xFF151629)
private val ClanChatLine = Color(0x24FFFFFF)
private val ClanChatMuted = Color(0xFF9EA3B9)
private val ClanChatPurple = Color(0xFF8D35F6)
private val ClanChatPink = Color(0xFFF6378B)
private val clanReactionTypes = listOf("heart", "fire", "laugh", "clap", "wow")

private sealed class ChatItem {
    data class DateHeader(val label: String) : ChatItem()
    data class MessageItem(
        val message: ClanMessage,
        val mine: Boolean,
        val showAvatar: Boolean,
        val showName: Boolean,
        val grouped: Boolean
    ) : ChatItem()
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun ClanChatScreen(
    token: String,
    clanId: String,
    currentUserId: String,
    clanName: String = "",
    onBack: () -> Unit = {},
    onClanDetails: () -> Unit = {}
) {
    val viewModel: ClanViewModel = hiltViewModel()
    var input by remember { mutableStateOf("") }
    var search by remember { mutableStateOf("") }
    var searchOpen by remember { mutableStateOf(false) }
    var menuOpen by remember { mutableStateOf(false) }
    var actionMessage by remember { mutableStateOf<ClanMessage?>(null) }
    var deleteMessage by remember { mutableStateOf<ClanMessage?>(null) }
    var cleanConfirm by remember { mutableStateOf(false) }
    var replyTo by remember { mutableStateOf<ClanMessage?>(null) }
    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()
    val clipboardManager = LocalClipboardManager.current
    val clan = viewModel.clanDetail

    val visibleMessages = remember(viewModel.messages, search) {
        if (search.isBlank()) viewModel.messages else viewModel.messages.filter { it.message.contains(search, ignoreCase = true) }
    }

    val chatItems = remember(visibleMessages, currentUserId) {
        val result = mutableListOf<ChatItem>()
        var lastDate = ""
        var lastSender: String? = null
        visibleMessages.forEach { msg ->
            val date = msgDateLabel(msg.createdAt)
            if (date != lastDate) {
                result.add(ChatItem.DateHeader(date))
                lastDate = date
                lastSender = null
            }
            val mine = msg.senderId?.id == currentUserId
            val showHeader = lastSender != msg.senderId?.id
            result.add(ChatItem.MessageItem(msg, mine, showAvatar = !mine && showHeader, showName = !mine && showHeader, grouped = !showHeader))
            lastSender = msg.senderId?.id
        }
        result
    }

    val isAtBottom by remember {
        derivedStateOf {
            val info = listState.layoutInfo
            val lastVisible = info.visibleItemsInfo.lastOrNull()?.index ?: 0
            info.totalItemsCount == 0 || lastVisible >= info.totalItemsCount - 2
        }
    }

    fun send() {
        val text = input.trim()
        if (text.isBlank() || viewModel.isSendingMessage) return
        val quoted = replyTo?.let { "↪️ ${it.senderId?.name ?: "Someone"}: ${it.message.take(80)}\n\n" } ?: ""
        viewModel.sendMessage(token, clanId, quoted + text) {
            if (input.trim() == text) input = ""
            replyTo = null
        }
    }

    LaunchedEffect(clanId) {
        viewModel.connect(token, clanId, currentUserId)
        viewModel.loadMessages(token, clanId)
        viewModel.loadDetail(token, clanId)
    }

    // Fallback refresh in case the socket drops.
    LaunchedEffect(clanId, searchOpen) {
        if (searchOpen) return@LaunchedEffect
        while (true) {
            delay(60_000)
            viewModel.loadMessages(token, clanId)
        }
    }

    // Emit typing status while the user is composing.
    LaunchedEffect(input) {
        if (input.isNotBlank()) {
            viewModel.sendTypingStatus(true)
            delay(2_000)
            if (input.isBlank()) viewModel.sendTypingStatus(false)
        } else {
            viewModel.sendTypingStatus(false)
        }
    }

    LaunchedEffect(chatItems.size, search) {
        if (search.isBlank() && chatItems.isNotEmpty() && isAtBottom) {
            listState.animateScrollToItem(chatItems.lastIndex)
        }
    }

    deleteMessage?.let { target ->
        AlertDialog(
            onDismissRequest = { deleteMessage = null },
            containerColor = Color(0xFF191A2C),
            title = { Text("Delete message?", color = Color.White, fontWeight = FontWeight.Bold) },
            text = { Text("This message will be removed from the clan chat.", color = ClanChatMuted) },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.deleteMessage(token, clanId, target.id)
                    deleteMessage = null
                }) { Text("Delete", color = ClanChatPink) }
            },
            dismissButton = { TextButton(onClick = { deleteMessage = null }) { Text("Cancel", color = ClanChatMuted) } }
        )
    }

    cleanConfirm.let { show ->
        if (show) AlertDialog(
            onDismissRequest = { cleanConfirm = false },
            containerColor = Color(0xFF191A2C),
            title = { Text("Clean chat?", color = Color.White, fontWeight = FontWeight.Bold) },
            text = { Text("This removes all messages for everyone in the clan. This cannot be undone.", color = ClanChatMuted) },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.cleanChat(token, clanId) { cleanConfirm = false }
                }) { Text("Clean", color = ClanChatPink) }
            },
            dismissButton = { TextButton(onClick = { cleanConfirm = false }) { Text("Cancel", color = ClanChatMuted) } }
        )
    }

    actionMessage?.let { target ->
        AlertDialog(
            onDismissRequest = { actionMessage = null },
            containerColor = Color(0xFF191A2C),
            title = { Text("Message actions", color = Color.White, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(target.message, color = ClanChatMuted, maxLines = 3, overflow = TextOverflow.Ellipsis)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        clanReactionTypes.forEach { type ->
                            Text(
                                reactionEmoji(type), fontSize = 22.sp,
                                modifier = Modifier.clip(CircleShape).clickable {
                                    viewModel.reactToMessage(token, clanId, target.id, type)
                                    actionMessage = null
                                }.padding(6.dp)
                            )
                        }
                    }
                    TextButton(onClick = {
                        clipboardManager.setText(AnnotatedString(target.message))
                        actionMessage = null
                    }) {
                        Icon(Icons.Filled.ContentCopy, contentDescription = null, tint = ClanChatMuted)
                        Text("  Copy message", color = ClanChatMuted)
                    }
                    TextButton(onClick = {
                        replyTo = target
                        actionMessage = null
                    }) {
                        Icon(Icons.AutoMirrored.Filled.Send, contentDescription = null, tint = ClanChatMuted)
                        Text("  Reply", color = ClanChatMuted)
                    }
                    if (target.senderId?.id == currentUserId || clan?.ownerId == currentUserId) {
                        TextButton(onClick = { deleteMessage = target; actionMessage = null }) {
                            Icon(Icons.Filled.DeleteOutline, contentDescription = null, tint = ClanChatPink)
                            Text("  Delete message", color = ClanChatPink)
                        }
                    } else {
                        TextButton(onClick = {
                            viewModel.reportMessage(token, clanId, target.id)
                            actionMessage = null
                        }) { Text("Report message", color = ClanChatPink) }
                    }
                }
            },
            confirmButton = { TextButton(onClick = { actionMessage = null }) { Text("Done", color = ClanChatPurple) } }
        )
    }

    Column(Modifier.fillMaxSize().background(ClanChatBg).statusBarsPadding().imePadding()) {
        // Header
        Row(
            Modifier.fillMaxWidth().background(Color(0xF3111222)).padding(start = 6.dp, end = 8.dp, top = 8.dp, bottom = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = Color.White) }
            Avatar((clanName.ifBlank { clan?.name ?: "C" }).take(1).uppercase(), 44, clan?.avatar)
            Column(Modifier.weight(1f).padding(start = 10.dp)) {
                Text(clanName.ifBlank { clan?.name ?: "Clan chat" }, color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text("${clan?.memberCount ?: 0} members  ·  ${clan?.myRole?.replace('_', ' ')?.lowercase()?.replaceFirstChar { it.uppercase() } ?: "Clan"}", color = ClanChatMuted, fontSize = 11.sp, maxLines = 1)
            }
            IconButton(onClick = { searchOpen = !searchOpen; search = "" }) {
                Icon(if (searchOpen) Icons.Filled.Close else Icons.Filled.Search, contentDescription = if (searchOpen) "Close search" else "Search messages", tint = Color.White)
            }
            IconButton(onClick = onClanDetails) { Icon(Icons.Filled.Groups, contentDescription = "Clan members and details", tint = Color.White) }
            Box {
                IconButton(onClick = { menuOpen = true }) { Icon(Icons.Filled.MoreVert, contentDescription = "More clan chat options", tint = Color.White) }
                DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                    DropdownMenuItem(
                        text = { Text("Refresh messages") }, leadingIcon = { Icon(Icons.Filled.Refresh, null) },
                        onClick = { menuOpen = false; viewModel.loadMessages(token, clanId) }
                    )
                    DropdownMenuItem(
                        text = { Text("Clan details") }, leadingIcon = { Icon(Icons.Filled.Groups, null) },
                        onClick = { menuOpen = false; onClanDetails() }
                    )
                    if (clan?.ownerId == currentUserId) {
                        DropdownMenuItem(
                            text = { Text("Clean chat", color = ClanChatPink) }, leadingIcon = { Icon(Icons.Filled.DeleteOutline, null, tint = ClanChatPink) },
                            onClick = { menuOpen = false; cleanConfirm = true }
                        )
                    }
                }
            }
        }

        if (searchOpen) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 8.dp).clip(RoundedCornerShape(16.dp))
                    .background(ClanChatCard).border(1.dp, ClanChatLine, RoundedCornerShape(16.dp)).padding(horizontal = 14.dp, vertical = 11.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                BasicTextField(
                    value = search,
                    onValueChange = { search = it.take(100) },
                    modifier = Modifier.weight(1f), singleLine = true,
                    textStyle = TextStyle(color = Color.White, fontSize = 14.sp),
                    cursorBrush = SolidColor(ClanChatPink),
                    decorationBox = { inner -> Box { if (search.isBlank()) Text("Search in clan chat…", color = ClanChatMuted); inner() } }
                )
                if (search.isNotBlank()) IconButton(onClick = { search = "" }, modifier = Modifier.size(28.dp)) {
                    Icon(Icons.Filled.Close, contentDescription = "Clear search", tint = ClanChatMuted)
                }
            }
            if (search.isNotBlank()) {
                Text(
                    "${visibleMessages.size} result${if (visibleMessages.size == 1) "" else "s"}",
                    color = ClanChatMuted, fontSize = 11.sp,
                    modifier = Modifier.padding(horizontal = 18.dp, vertical = 2.dp)
                )
            }
        }

        if (viewModel.error != null) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(viewModel.error.orEmpty(), color = ClanChatPink, fontSize = 12.sp, modifier = Modifier.weight(1f))
                Text("Retry", color = ClanChatPurple, fontSize = 12.sp, fontWeight = FontWeight.Bold,
                    modifier = Modifier.clickable { viewModel.clearError(); viewModel.loadMessages(token, clanId) }.padding(8.dp))
            }
        }

        Box(Modifier.weight(1f).fillMaxWidth()) {
            if (viewModel.isLoading && viewModel.messages.isEmpty()) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { LoadingState("Loading clan chat…") }
            } else {
                LazyColumn(
                    Modifier.fillMaxSize(),
                    state = listState,
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 16.dp)
                ) {
                    if (viewModel.hasMoreOlder && search.isBlank()) item {
                        Box(Modifier.fillMaxWidth().padding(vertical = 4.dp), contentAlignment = Alignment.Center) {
                            if (viewModel.isLoadingOlder) {
                                CircularProgressIndicator(color = ClanChatPurple, modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                            } else {
                                TextButton(onClick = { viewModel.loadOlderMessages(token, clanId) }) {
                                    Text("Load older messages", color = ClanChatPurple, fontSize = 12.sp)
                                }
                            }
                        }
                    }
                    if (chatItems.isEmpty()) item {
                        Column(Modifier.fillMaxWidth().padding(vertical = 55.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Avatar((clanName.ifBlank { "C" }).take(1).uppercase(), 58, clan?.avatar)
                            Text(if (search.isBlank()) "Start your clan conversation" else "No messages found", color = Color.White, fontSize = 17.sp, fontWeight = FontWeight.Bold)
                            Text(if (search.isBlank()) "Say hello and bring everyone together." else "Try another word or phrase.", color = ClanChatMuted, fontSize = 13.sp)
                        }
                    }
                    items(chatItems, key = { item ->
                        when (item) {
                            is ChatItem.DateHeader -> "date_${item.label}"
                            is ChatItem.MessageItem -> item.message.id
                        }
                    }) { item ->
                        when (item) {
                            is ChatItem.DateHeader -> DateSeparator(item.label)
                            is ChatItem.MessageItem -> ClanChatMessageRow(
                                message = item.message,
                                mine = item.mine,
                                showAvatar = item.showAvatar,
                                showName = item.showName,
                                grouped = item.grouped,
                                onOpenActions = { actionMessage = item.message },
                                onReact = { type -> viewModel.reactToMessage(token, clanId, item.message.id, type) }
                            )
                        }
                    }
                }
            }

            // Scroll to bottom button
            if (!isAtBottom && chatItems.isNotEmpty()) {
                Surface(
                    shape = CircleShape,
                    color = ClanChatCard,
                    border = androidx.compose.foundation.BorderStroke(1.dp, ClanChatLine),
                    onClick = { scope.launch { if (chatItems.isNotEmpty()) listState.animateScrollToItem(chatItems.lastIndex) } },
                    modifier = Modifier.align(Alignment.BottomEnd).padding(16.dp)
                ) {
                    Box(Modifier.size(40.dp), contentAlignment = Alignment.Center) {
                        Icon(Icons.Filled.KeyboardArrowDown, contentDescription = "Scroll to bottom", tint = Color.White)
                    }
                }
            }
        }

        // Typing indicator
        val typingNames = viewModel.typingUserIds.mapNotNull { id -> clan?.members?.firstOrNull { it.id == id }?.name }.ifEmpty { viewModel.typingUserIds.map { "Someone" } }
        if (typingNames.isNotEmpty()) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    if (typingNames.size == 1) "${typingNames.first()} is typing…" else "${typingNames.size} people are typing…",
                    color = ClanChatMuted, fontSize = 11.sp, fontStyle = androidx.compose.ui.text.font.FontStyle.Italic
                )
            }
        }

        // Reply preview
        replyTo?.let { target ->
            Row(
                Modifier.fillMaxWidth().background(Color(0xF3111222)).padding(horizontal = 14.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(Modifier.width(3.dp).height(32.dp).background(ClanChatPurple, RoundedCornerShape(2.dp)))
                Spacer(Modifier.width(8.dp))
                Column(Modifier.weight(1f)) {
                    Text(target.senderId?.name ?: "Message", color = ClanChatPurple, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    Text(target.message, color = ClanChatMuted, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                IconButton(onClick = { replyTo = null }, modifier = Modifier.size(28.dp)) {
                    Icon(Icons.Filled.Close, contentDescription = "Cancel reply", tint = ClanChatMuted)
                }
            }
        }

        // Input bar
        Row(
            Modifier.fillMaxWidth().navigationBarsPadding().background(Color(0xF3111222)).padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                Modifier.weight(1f).clip(RoundedCornerShape(26.dp)).background(ClanChatCard)
                    .border(1.dp, ClanChatLine, RoundedCornerShape(26.dp)).padding(horizontal = 16.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                BasicTextField(
                    value = input,
                    onValueChange = { input = it.take(600) },
                    modifier = Modifier.weight(1f).padding(vertical = 10.dp),
                    singleLine = true,
                    textStyle = TextStyle(color = Color.White, fontSize = 14.sp),
                    cursorBrush = SolidColor(ClanChatPink),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                    keyboardActions = KeyboardActions(onSend = { send() }),
                    decorationBox = { inner -> Box { if (input.isBlank()) Text("Message your clan…", color = ClanChatMuted, fontSize = 14.sp); inner() } }
                )
            }
            Spacer(Modifier.width(9.dp))
            Box(
                Modifier.size(48.dp).clip(CircleShape).background(Brush.linearGradient(listOf(ClanChatPurple, ClanChatPink)))
                    .clickable(enabled = input.isNotBlank() && !viewModel.isSendingMessage) { send() },
                contentAlignment = Alignment.Center
            ) {
                if (viewModel.isSendingMessage) {
                    CircularProgressIndicator(color = Color.White, modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                } else {
                    Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Send message", tint = Color.White, modifier = Modifier.size(21.dp))
                }
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun ClanChatMessageRow(
    message: ClanMessage,
    mine: Boolean,
    showAvatar: Boolean,
    showName: Boolean,
    grouped: Boolean,
    onOpenActions: () -> Unit,
    onReact: (String) -> Unit = {}
) {
    val sender = message.senderId
    Row(
        Modifier.fillMaxWidth().padding(top = if (grouped) 2.dp else 8.dp),
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = if (mine) Arrangement.End else Arrangement.Start
    ) {
        if (!mine) {
            if (showAvatar) {
                Avatar(sender?.name?.take(1)?.uppercase() ?: "?", 34, sender?.avatar, sender?.activeCosmetics ?: com.yugm.app.core.model.ActiveCosmetics())
            } else {
                Spacer(Modifier.width(34.dp))
            }
            Spacer(Modifier.width(8.dp))
        }
        Column(Modifier.widthIn(max = 300.dp), horizontalAlignment = if (mine) Alignment.End else Alignment.Start) {
            if (showName && sender != null) {
                Text(sender.name, color = ClanChatPurple, fontSize = 11.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(start = 5.dp, bottom = 4.dp))
            }
            Column(
                Modifier.clip(RoundedCornerShape(topStart = 19.dp, topEnd = 19.dp, bottomStart = if (mine) 19.dp else 5.dp, bottomEnd = if (mine) 5.dp else 19.dp))
                    .background(if (mine) Brush.linearGradient(listOf(Color(0xFF6428C6), Color(0xFF8D35F6))) else Brush.linearGradient(listOf(Color(0xFF191B30), Color(0xFF20243A))))
                    .border(1.dp, if (mine) Color(0x487D46E8) else ClanChatLine, RoundedCornerShape(topStart = 19.dp, topEnd = 19.dp, bottomStart = if (mine) 19.dp else 5.dp, bottomEnd = if (mine) 5.dp else 19.dp))
                    .combinedClickable(onClick = onOpenActions, onLongClick = onOpenActions)
                    .padding(horizontal = 14.dp, vertical = 11.dp)
            ) {
                val quoteEnd = message.message.indexOf("\n\n")
                val hasQuote = message.message.startsWith("↪️ ") && quoteEnd > 0
                if (hasQuote) {
                    val quote = message.message.substring(0, quoteEnd)
                    val body = message.message.substring(quoteEnd + 2)
                    Box(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp))
                            .background(Color.White.copy(alpha = 0.08f))
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        Text(quote, color = Color.White.copy(alpha = 0.75f), fontSize = 12.sp, lineHeight = 16.sp)
                    }
                    Spacer(Modifier.height(6.dp))
                    Text(body, color = Color.White, fontSize = 14.sp, lineHeight = 20.sp)
                } else {
                    Text(message.message, color = Color.White, fontSize = 14.sp, lineHeight = 20.sp)
                }
                Row(Modifier.align(Alignment.End).padding(top = 5.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(clanMessageTime(message.createdAt), color = Color.White.copy(alpha = 0.62f), fontSize = 9.sp)
                    if (mine) {
                        Spacer(Modifier.width(4.dp))
                        Text("✓", color = Color.White.copy(alpha = 0.62f), fontSize = 9.sp)
                    }
                }
            }
            if (message.reactions.isNotEmpty()) {
                Row(Modifier.padding(top = 5.dp), horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                    message.reactions.groupBy { it.type }.forEach { (type, reactions) ->
                        Text("${reactionEmoji(type)} ${reactions.size}", color = Color.White, fontSize = 10.sp,
                            modifier = Modifier.clip(CircleShape).background(ClanChatCard).border(1.dp, ClanChatLine, CircleShape).padding(horizontal = 8.dp, vertical = 4.dp)
                                .clickable { onReact(type) })
                    }
                }
            }
        }
        if (mine) Spacer(Modifier.width(2.dp))
    }
}

@Composable
private fun DateSeparator(label: String) {
    Row(Modifier.fillMaxWidth().padding(vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.weight(1f).height(1.dp).background(ClanChatLine))
        Text(label, color = ClanChatMuted, fontSize = 11.sp, fontWeight = FontWeight.Medium, modifier = Modifier.padding(horizontal = 10.dp))
        Box(Modifier.weight(1f).height(1.dp).background(ClanChatLine))
    }
}

private fun reactionEmoji(type: String): String = when (type) {
    "heart" -> "❤️"
    "fire" -> "🔥"
    "laugh" -> "😂"
    "clap" -> "👏"
    "wow" -> "😮"
    else -> "❤️"
}

private fun msgDateLabel(value: String): String = runCatching {
    val instant = java.time.Instant.parse(value)
    val date = instant.atZone(java.time.ZoneId.systemDefault()).toLocalDate()
    val today = java.time.LocalDate.now()
    when {
        date == today -> "Today"
        date == today.minusDays(1) -> "Yesterday"
        date.year == today.year -> date.format(java.time.format.DateTimeFormatter.ofPattern("MMMM d"))
        else -> date.format(java.time.format.DateTimeFormatter.ofPattern("MMMM d, yyyy"))
    }
}.getOrElse { if (value.length >= 10) value.substring(0, 10) else "Earlier" }

private fun clanMessageTime(value: String): String = runCatching {
    java.time.Instant.parse(value).atZone(java.time.ZoneId.systemDefault()).format(java.time.format.DateTimeFormatter.ofPattern("h:mm a"))
}.getOrElse { if (value.length >= 16) value.substring(11, 16) else "now" }