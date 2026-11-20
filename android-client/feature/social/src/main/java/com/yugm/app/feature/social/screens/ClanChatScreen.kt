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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material3.AlertDialog
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
import com.yugm.app.core.ui.theme.LocalYugmColors
import com.yugm.app.core.ui.theme.chatBubbleBackground
import com.yugm.app.core.ui.theme.chatBubbleForeground
import com.yugm.app.core.ui.theme.chatBubbleMetadata
import com.yugm.app.core.ui.components.LoadingState
import com.yugm.app.feature.social.viewmodel.ClanViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import com.yugm.app.core.ui.components.YugmLoadingSpinner

// Theme-aware palette is read via LocalYugmColors inside composables.
private val clanReactionTypes = listOf("heart", "fire", "laugh", "clap", "wow", "crown", "stars", "party")

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
    var actionMessage by remember { mutableStateOf<ClanMessage?>(null) }
    var deleteMessage by remember { mutableStateOf<ClanMessage?>(null) }
    var replyTo by remember { mutableStateOf<ClanMessage?>(null) }
    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()
    val clipboardManager = LocalClipboardManager.current
    val clan = viewModel.clanDetail

    val chatItems = remember(viewModel.messages, currentUserId) {
        val result = mutableListOf<ChatItem>()
        var lastDate = ""
        var lastSender: String? = null
        viewModel.messages.forEach { msg ->
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

    LaunchedEffect(token, clanId, currentUserId) {
        viewModel.connect(token, clanId, currentUserId)
    }

    // Fallback refresh in case the socket drops.
    com.yugm.app.core.ui.components.AutomaticSyncEffect(token, clanId, topics = setOf(com.yugm.app.core.api.SyncTopic.CLANS), enabled = token.isNotBlank(), isBusy = { viewModel.isLoading }) {
        viewModel.loadMessages(token, clanId).join()
        viewModel.loadDetail(token, clanId).join()
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

    LaunchedEffect(chatItems.size) {
        if (chatItems.isNotEmpty() && isAtBottom) {
            listState.animateScrollToItem(chatItems.lastIndex)
        }
    }

    deleteMessage?.let { target ->
        AlertDialog(
            onDismissRequest = { deleteMessage = null },
            containerColor = LocalYugmColors.current.surfaceElevated,
            title = { Text("Delete message?", color = LocalYugmColors.current.textPrimary, fontWeight = FontWeight.Bold) },
            text = { Text("This message will be removed from the clan chat.", color = LocalYugmColors.current.textSecondary) },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.deleteMessage(token, clanId, target.id)
                    deleteMessage = null
                }) { Text("Delete", color = LocalYugmColors.current.primary) }
            },
            dismissButton = { TextButton(onClick = { deleteMessage = null }) { Text("Cancel", color = LocalYugmColors.current.textSecondary) } }
        )
    }

    actionMessage?.let { target ->
        AlertDialog(
            onDismissRequest = { actionMessage = null },
            containerColor = LocalYugmColors.current.surfaceElevated,
            title = { Text("Message actions", color = LocalYugmColors.current.textPrimary, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    val myReaction = target.reactions.firstOrNull { it.userId == currentUserId }?.type
                    Text(target.message, color = LocalYugmColors.current.textSecondary, maxLines = 3, overflow = TextOverflow.Ellipsis)
                    Text(
                        if (myReaction.isNullOrBlank()) "Choose a reaction" else "Your reaction: ${reactionEmoji(myReaction)}  •  Tap it again to remove",
                        color = LocalYugmColors.current.textSecondary,
                        fontSize = 12.sp
                    )
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        clanReactionTypes.chunked(4).forEach { rowItems ->
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                rowItems.forEach { type ->
                                    val selected = myReaction == type
                                    Box(
                                        modifier = Modifier
                                            .weight(1f)
                                            .clip(RoundedCornerShape(12.dp))
                                            .background(if (selected) LocalYugmColors.current.secondary.copy(alpha = 0.18f) else LocalYugmColors.current.surface)
                                            .border(1.dp, if (selected) LocalYugmColors.current.secondary else LocalYugmColors.current.border, RoundedCornerShape(12.dp))
                                            .clickable {
                                                viewModel.reactToMessage(token, clanId, target.id, type)
                                                actionMessage = null
                                            }
                                            .padding(vertical = 8.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(reactionEmoji(type), fontSize = 20.sp)
                                    }
                                }
                                repeat((4 - rowItems.size).coerceAtLeast(0)) {
                                    Spacer(Modifier.weight(1f))
                                }
                            }
                        }
                    }
                    TextButton(onClick = {
                        clipboardManager.setText(AnnotatedString(target.message))
                        actionMessage = null
                    }) {
                        Icon(Icons.Filled.ContentCopy, contentDescription = null, tint = LocalYugmColors.current.textSecondary)
                        Text("  Copy message", color = LocalYugmColors.current.textSecondary)
                    }
                    TextButton(onClick = {
                        replyTo = target
                        actionMessage = null
                    }) {
                        Icon(Icons.AutoMirrored.Filled.Send, contentDescription = null, tint = LocalYugmColors.current.textSecondary)
                        Text("  Reply", color = LocalYugmColors.current.textSecondary)
                    }
                    if (target.senderId?.id == currentUserId || clan?.canModerate == true) {
                        TextButton(onClick = { deleteMessage = target; actionMessage = null }) {
                            Icon(Icons.Filled.DeleteOutline, contentDescription = null, tint = LocalYugmColors.current.primary)
                            Text("  Delete message", color = LocalYugmColors.current.primary)
                        }
                    } else {
                        TextButton(onClick = {
                            viewModel.reportMessage(token, clanId, target.id)
                            actionMessage = null
                        }) { Text("Report message", color = LocalYugmColors.current.primary) }
                    }
                }
            },
            confirmButton = { TextButton(onClick = { actionMessage = null }) { Text("Done", color = LocalYugmColors.current.secondary) } }
        )
    }

    Column(Modifier.fillMaxSize().background(LocalYugmColors.current.background).imePadding()) {
        if (viewModel.error != null) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(viewModel.error.orEmpty(), color = LocalYugmColors.current.primary, fontSize = 12.sp, modifier = Modifier.weight(1f))
                Text("Retry", color = LocalYugmColors.current.secondary, fontSize = 12.sp, fontWeight = FontWeight.Bold,
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
                    if (viewModel.hasMoreOlder) item {
                        Box(Modifier.fillMaxWidth().padding(vertical = 4.dp), contentAlignment = Alignment.Center) {
                            if (viewModel.isLoadingOlder) {
                                YugmLoadingSpinner(size = 20.dp)
                            } else {
                                TextButton(onClick = { viewModel.loadOlderMessages(token, clanId) }) {
                                    Text("Load older messages", color = LocalYugmColors.current.secondary, fontSize = 12.sp)
                                }
                            }
                        }
                    }
                    if (chatItems.isEmpty()) item {
                        Column(Modifier.fillMaxWidth().padding(vertical = 55.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Avatar((clanName.ifBlank { "C" }).take(1).uppercase(), 58, clan?.avatar, avatarType = clan?.avatarType, avatarParts = clan?.avatarParts)
                            Text("Start your clan conversation", color = LocalYugmColors.current.textPrimary, fontSize = 17.sp, fontWeight = FontWeight.Bold)
                            Text("Say hello and bring everyone together.", color = LocalYugmColors.current.textSecondary, fontSize = 13.sp)
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
                                currentUserId = currentUserId,
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
                    color = LocalYugmColors.current.surface,
                    border = androidx.compose.foundation.BorderStroke(1.dp, LocalYugmColors.current.border),
                    onClick = { scope.launch { if (chatItems.isNotEmpty()) listState.animateScrollToItem(chatItems.lastIndex) } },
                    modifier = Modifier.align(Alignment.BottomEnd).padding(16.dp)
                ) {
                    Box(Modifier.size(40.dp), contentAlignment = Alignment.Center) {
                        Icon(Icons.Filled.KeyboardArrowDown, contentDescription = "Scroll to bottom", tint = LocalYugmColors.current.textPrimary)
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
                    color = LocalYugmColors.current.textSecondary, fontSize = 11.sp, fontStyle = androidx.compose.ui.text.font.FontStyle.Italic
                )
            }
        }

        // Reply preview
        replyTo?.let { target ->
            Row(
                Modifier.fillMaxWidth().background(LocalYugmColors.current.surface).padding(horizontal = 14.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(Modifier.width(3.dp).height(32.dp).background(LocalYugmColors.current.secondary, RoundedCornerShape(2.dp)))
                Spacer(Modifier.width(8.dp))
                Column(Modifier.weight(1f)) {
                    Text(target.senderId?.name ?: "Message", color = LocalYugmColors.current.secondary, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    Text(target.message, color = LocalYugmColors.current.textSecondary, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                IconButton(onClick = { replyTo = null }, modifier = Modifier.size(28.dp)) {
                    Icon(Icons.Filled.Close, contentDescription = "Cancel reply", tint = LocalYugmColors.current.textSecondary)
                }
            }
        }

        // Input bar
        Row(
            Modifier.fillMaxWidth().navigationBarsPadding().background(LocalYugmColors.current.surface).padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                Modifier.weight(1f).clip(RoundedCornerShape(26.dp)).background(LocalYugmColors.current.surface)
                    .border(1.dp, LocalYugmColors.current.border, RoundedCornerShape(26.dp)).padding(horizontal = 14.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                BasicTextField(
                    value = input,
                    onValueChange = { input = it.take(600) },
                    modifier = Modifier.weight(1f).padding(vertical = 10.dp),
                    singleLine = true,
                    textStyle = TextStyle(color = LocalYugmColors.current.textPrimary, fontSize = 14.sp),
                    cursorBrush = SolidColor(LocalYugmColors.current.primary),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                    keyboardActions = KeyboardActions(onSend = { send() }),
                    decorationBox = { inner -> Box { if (input.isBlank()) Text("Message", color = LocalYugmColors.current.textSecondary, fontSize = 14.sp); inner() } }
                )
            }
            Spacer(Modifier.width(9.dp))
            Box(
                Modifier.size(48.dp).clip(CircleShape).background(LocalYugmColors.current.secondary)
                    .clickable(enabled = input.isNotBlank() && !viewModel.isSendingMessage) { send() },
                contentAlignment = Alignment.Center
            ) {
                if (viewModel.isSendingMessage) {
                    YugmLoadingSpinner(size = 20.dp)
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
    currentUserId: String = "",
    showAvatar: Boolean,
    showName: Boolean,
    grouped: Boolean,
    onOpenActions: () -> Unit,
    onReact: (String) -> Unit = {}
) {
    val colors = LocalYugmColors.current
    val bubbleText = colors.chatBubbleForeground(mine)
    val bubbleMeta = colors.chatBubbleMetadata(mine)
    val sender = message.senderId
    Row(
        Modifier.fillMaxWidth().padding(top = if (grouped) 2.dp else 8.dp),
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = if (mine) Arrangement.End else Arrangement.Start
    ) {
        if (!mine) {
            if (showAvatar) {
                Avatar(sender?.name?.take(1)?.uppercase() ?: "?", 34, sender?.avatar, sender?.activeCosmetics ?: com.yugm.app.core.model.ActiveCosmetics(), avatarType = sender?.avatarType, avatarParts = sender?.avatarParts)
            } else {
                Spacer(Modifier.width(34.dp))
            }
            Spacer(Modifier.width(8.dp))
        }
        Column(Modifier.widthIn(max = 300.dp), horizontalAlignment = if (mine) Alignment.End else Alignment.Start) {
            if (showName && sender != null) {
                Text(sender.name, color = LocalYugmColors.current.secondary, fontSize = 11.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(start = 5.dp, bottom = 4.dp))
            }
            Column(
                Modifier.clip(RoundedCornerShape(topStart = 19.dp, topEnd = 19.dp, bottomStart = if (mine) 19.dp else 5.dp, bottomEnd = if (mine) 5.dp else 19.dp))
                    .background(colors.chatBubbleBackground(mine))
                    .border(1.dp, if (mine) colors.secondary.copy(alpha = 0.45f) else colors.border, RoundedCornerShape(topStart = 19.dp, topEnd = 19.dp, bottomStart = if (mine) 19.dp else 5.dp, bottomEnd = if (mine) 5.dp else 19.dp))
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
                            .background(bubbleText.copy(alpha = 0.08f))
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        Text(quote, color = bubbleMeta, fontSize = 12.sp, lineHeight = 16.sp)
                    }
                    Spacer(Modifier.height(6.dp))
                    Text(body, color = bubbleText, fontSize = 14.sp, lineHeight = 20.sp)
                } else {
                    Text(message.message, color = bubbleText, fontSize = 14.sp, lineHeight = 20.sp)
                }
                Row(Modifier.align(Alignment.End).padding(top = 5.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(clanMessageTime(message.createdAt), color = bubbleMeta, fontSize = 9.sp)
                    if (mine) {
                        Spacer(Modifier.width(4.dp))
                        Text("✓", color = bubbleMeta, fontSize = 9.sp)
                    }
                }
            }
            if (message.reactions.isNotEmpty()) {
                val myReaction = message.reactions.firstOrNull { it.userId == currentUserId }?.type
                Row(Modifier.padding(top = 5.dp), horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                    message.reactions.groupBy { it.type }.forEach { (type, reactions) ->
                        val selected = myReaction == type
                        Text(
                            "${reactionEmoji(type)} ${reactions.size}",
                            color = colors.textPrimary,
                            fontSize = 10.sp,
                            modifier = Modifier
                                .clip(CircleShape)
                                .background(LocalYugmColors.current.surface)
                                .border(1.dp, if (selected) LocalYugmColors.current.secondary.copy(alpha = 0.7f) else LocalYugmColors.current.border, CircleShape)
                                .clickable { onReact(type) }
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        )
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
        Box(Modifier.weight(1f).height(1.dp).background(LocalYugmColors.current.border))
        Text(label, color = LocalYugmColors.current.textSecondary, fontSize = 11.sp, fontWeight = FontWeight.Medium, modifier = Modifier.padding(horizontal = 10.dp))
        Box(Modifier.weight(1f).height(1.dp).background(LocalYugmColors.current.border))
    }
}

private fun reactionEmoji(type: String): String = when (type.lowercase()) {
    "heart" -> "❤️"
    "fire" -> "🔥"
    "laugh" -> "😂"
    "clap" -> "👏"
    "wow" -> "😮"
    "crown" -> "👑"
    "stars" -> "✨"
    "party" -> "🎉"
    else -> "❤️"
}

private fun msgDateLabel(value: String): String {
    val fallback = if (value.length >= 10) value.substring(0, 10) else "Earlier"
    return runCatching {
        val normalized = if (value.endsWith("Z")) value.replace("Z", "+00:00") else value
        val dateObj = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX", java.util.Locale.US).apply {
            timeZone = java.util.TimeZone.getTimeZone("UTC")
        }.parse(normalized) ?: java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", java.util.Locale.US).apply {
            timeZone = java.util.TimeZone.getTimeZone("UTC")
        }.parse(normalized) ?: return fallback
        val cal = java.util.Calendar.getInstance().apply { time = dateObj }
        val today = java.util.Calendar.getInstance()
        fun java.util.Calendar.sameDay(other: java.util.Calendar) =
            get(java.util.Calendar.YEAR) == other.get(java.util.Calendar.YEAR) && get(java.util.Calendar.DAY_OF_YEAR) == other.get(java.util.Calendar.DAY_OF_YEAR)
        val yesterday = java.util.Calendar.getInstance().apply { add(java.util.Calendar.DAY_OF_YEAR, -1) }
        when {
            cal.sameDay(today) -> "Today"
            cal.sameDay(yesterday) -> "Yesterday"
            cal.get(java.util.Calendar.YEAR) == today.get(java.util.Calendar.YEAR) ->
                java.text.SimpleDateFormat("MMMM d", java.util.Locale.getDefault()).format(dateObj)
            else -> java.text.SimpleDateFormat("MMMM d, yyyy", java.util.Locale.getDefault()).format(dateObj)
        }
    }.getOrDefault(fallback)
}

private fun clanMessageTime(value: String): String {
    val fallback = if (value.length >= 16) value.substring(11, 16) else "now"
    return runCatching {
        val normalized = if (value.endsWith("Z")) value.replace("Z", "+00:00") else value
        val dateObj = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX", java.util.Locale.US).apply {
            timeZone = java.util.TimeZone.getTimeZone("UTC")
        }.parse(normalized) ?: java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", java.util.Locale.US).apply {
            timeZone = java.util.TimeZone.getTimeZone("UTC")
        }.parse(normalized) ?: return fallback
        java.text.SimpleDateFormat("h:mm a", java.util.Locale.getDefault()).format(dateObj)
    }.getOrDefault(fallback)
}
