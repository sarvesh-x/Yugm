package com.yugm.app.feature.chat.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Icon
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.CardGiftcard
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.SentimentSatisfiedAlt
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.TextButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yugm.app.core.model.ActiveCosmetics
import com.yugm.app.core.model.DirectMessage
import com.yugm.app.core.model.GiftItem
import com.yugm.app.core.model.Host
import com.yugm.app.core.api.resolveMediaUrl
import com.yugm.app.feature.chat.R
import com.yugm.app.core.model.RelationshipStatus
import com.yugm.app.core.ui.components.*
import com.yugm.app.core.ui.cosmetics.chatBubbleVisual
import com.yugm.app.core.ui.theme.LocalMotionEnabled
import coil.compose.AsyncImage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private val Background = Color(0xFF060714)
private val SurfaceElevated = Color(0xFF171A2C)
private val BorderColor = Color(0x24FFFFFF)
private val TextPrimary = Color(0xFFF8FAFC)
private val TextMuted = Color(0xFF9EA3B9)
private val PrimaryPurple = Color(0xFF8D35F6)
private val Pink = Color(0xFFF6378B)
private val Danger = Color(0xFFFF3B4F)
private val Success = Color(0xFF3BE477)
private val ChatSurface = Color(0xFF0E1121)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(
    partner: Host?,
    currentUserId: String,
    myActiveCosmetics: ActiveCosmetics = ActiveCosmetics(),
    messages: List<DirectMessage>,
    relationship: RelationshipStatus?,
    gifts: List<GiftItem> = emptyList(),
    balance: Int = 0,
    loading: Boolean = false,
    isSending: Boolean = false,
    isPartnerTyping: Boolean = false,
    error: String = "",
    onBack: () -> Unit = {},
    onRetry: () -> Unit = {},
    onSend: (String) -> Unit = {},
    onGift: (GiftItem) -> Unit = {},
    onReactMessage: (DirectMessage) -> Unit = {},
    onTyping: (Boolean) -> Unit = {},
    onAudioCall: () -> Unit = {},
    onVideoCall: () -> Unit = {},
    onAttachmentSelected: (ByteArray, String, String) -> Unit = { _, _, _ -> },
    onReport: () -> Unit = {},
    onBlock: () -> Unit = {},
    onDeleteConversation: () -> Unit = {},
    onDeleteSelected: (List<String>, String) -> Unit = { _, _ -> },
    isMuted: Boolean = false,
    forwardTargets: List<Host> = emptyList(),
    searchResults: List<DirectMessage>? = null,
    hasMoreHistory: Boolean = false,
    isLoadingMore: Boolean = false,
    hasMoreSearchResults: Boolean = false,
    isLoadingMoreSearch: Boolean = false,
    onLoadOlder: () -> Unit = {},
    onReply: (String, DirectMessage) -> Unit = { _, _ -> },
    onEdit: (DirectMessage, String) -> Unit = { _, _ -> },
    onForward: (DirectMessage, String) -> Unit = { _, _ -> },
    onSearch: (String) -> Unit = {},
    onLoadMoreSearch: () -> Unit = {},
    onMute: (Boolean) -> Unit = {},
    onOpenProfile: (String) -> Unit = {}
) {
    var draft by rememberSaveable(partner?.id) { mutableStateOf("") }
    var showGiftSheet by rememberSaveable { mutableStateOf(false) }
    var showEmojiBar by rememberSaveable { mutableStateOf(false) }
    var showMore by rememberSaveable { mutableStateOf(false) }
    var confirmDeleteChat by rememberSaveable { mutableStateOf(false) }
    var showDeleteSelected by remember { mutableStateOf(false) }
    var selectedMessageIds by remember { mutableStateOf<Set<String>>(emptySet()) }
    var messageActionTarget by remember { mutableStateOf<DirectMessage?>(null) }
    var forwardMessage by remember { mutableStateOf<DirectMessage?>(null) }
    var infoMessage by remember { mutableStateOf<DirectMessage?>(null) }
    var replyTarget by remember(partner?.id) { mutableStateOf<DirectMessage?>(null) }
    var editingTarget by remember(partner?.id) { mutableStateOf<DirectMessage?>(null) }
    var searchVisible by rememberSaveable { mutableStateOf(false) }
    var searchQuery by rememberSaveable { mutableStateOf("") }
    var showSafety by rememberSaveable { mutableStateOf(true) }
    var typingSent by remember { mutableStateOf(false) }
    val listState = rememberLazyListState()
    val context = LocalContext.current
    val messageFieldLabel = stringResource(R.string.a11y_message_field)
    val attachPhotoLabel = stringResource(R.string.a11y_attach_photo)
    val sendMessageLabel = stringResource(R.string.a11y_send_message)
    val defaultMatchName = stringResource(R.string.a11y_default_match)
    val scope = rememberCoroutineScope()
    val showScrollToBottom by remember { derivedStateOf { listState.canScrollForward } }
    var didInitialScroll by remember(partner?.id) { mutableStateOf(false) }
    var lastMessageCount by remember(partner?.id) { mutableStateOf(0) }
    var forceScrollOnAppend by remember(partner?.id) { mutableStateOf(false) }
    val visibleMessages = when {
        searchQuery.length >= 2 -> searchResults.orEmpty()
        searchQuery.isNotBlank() -> messages.filter { it.message.contains(searchQuery, ignoreCase = true) }
        else -> messages
    }
    val selectionMode = selectedMessageIds.isNotEmpty()
    val selectedMessages = visibleMessages.filter { it.id in selectedMessageIds }
    val selectedOwnIds = selectedMessages.filter { it.senderId == currentUserId }.map { it.id }
    fun toggleSelection(messageId: String) {
        if (messageId.isBlank()) return
        showMore = false
        selectedMessageIds = if (messageId in selectedMessageIds) selectedMessageIds - messageId else selectedMessageIds + messageId
    }
    fun submitDraft() {
        val value = draft.trim()
        if (value.isBlank()) return
        val editing = editingTarget
        val replying = replyTarget
        draft = ""
        editingTarget = null
        replyTarget = null
        forceScrollOnAppend = true
        when {
            editing != null -> onEdit(editing, value)
            replying != null -> onReply(value, replying)
            else -> onSend(value)
        }
    }
    LaunchedEffect(searchQuery, searchVisible) {
        if (searchVisible) {
            kotlinx.coroutines.delay(300)
            onSearch(searchQuery)
        }
    }
    LaunchedEffect(visibleMessages.size, loading, partner?.id, searchQuery) {
        if (searchQuery.isNotBlank()) return@LaunchedEffect
        if (loading && visibleMessages.isEmpty()) return@LaunchedEffect
        if (visibleMessages.isEmpty()) {
            lastMessageCount = 0
            return@LaunchedEffect
        }
        val isInitial = !didInitialScroll
        val appended = visibleMessages.size > lastMessageCount
        val nearBottom = !listState.canScrollForward || listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index?.let { it >= (listState.layoutInfo.totalItemsCount - 3).coerceAtLeast(0) } == true
        if (isInitial || (appended && (nearBottom || forceScrollOnAppend))) {
            val target = (listState.layoutInfo.totalItemsCount - 1).coerceAtLeast(0)
            if (target >= 0) {
                if (isInitial) listState.scrollToItem(target) else listState.animateScrollToItem(target)
                didInitialScroll = true
            }
            if (appended) forceScrollOnAppend = false
        } else if (appended) {
            forceScrollOnAppend = false
        }
        lastMessageCount = visibleMessages.size
    }
    LaunchedEffect(isPartnerTyping) {
        if (!isPartnerTyping || searchQuery.isNotBlank()) return@LaunchedEffect
        val nearBottom = !listState.canScrollForward || listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index?.let { it >= (listState.layoutInfo.totalItemsCount - 3).coerceAtLeast(0) } == true
        if (nearBottom) {
            val target = (listState.layoutInfo.totalItemsCount - 1).coerceAtLeast(0)
            if (target >= 0) listState.animateScrollToItem(target)
        }
    }
    if (confirmDeleteChat) {
        AlertDialog(
            onDismissRequest = { confirmDeleteChat = false },
            containerColor = SurfaceElevated,
            title = { Text("Delete this chat?", color = TextPrimary) },
            text = { Text("This removes the conversation from your inbox. The other person will still keep their copy.", color = TextMuted) },
            confirmButton = { TextButton(onClick = { confirmDeleteChat = false; onDeleteConversation() }) { Text("Delete", color = Danger) } },
            dismissButton = { TextButton(onClick = { confirmDeleteChat = false }) { Text("Cancel", color = TextMuted) } }
        )
    }
    messageActionTarget?.let { selected ->
        AlertDialog(
            onDismissRequest = { messageActionTarget = null },
            containerColor = SurfaceElevated,
            title = { Text("Message options", color = TextPrimary) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    if (selected.message.isNotBlank()) {
                        TextButton(onClick = {
                            val clipboard = context.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                            clipboard.setPrimaryClip(android.content.ClipData.newPlainText("message", selected.message))
                            android.widget.Toast.makeText(context, "Message copied", android.widget.Toast.LENGTH_SHORT).show()
                            messageActionTarget = null
                            selectedMessageIds = emptySet()
                        }) { Text("Copy", color = TextPrimary) }
                    }
                    TextButton(onClick = { infoMessage = selected; messageActionTarget = null; selectedMessageIds = emptySet() }) { Text("Info", color = TextPrimary) }
                    if (selected.id.isNotBlank()) {
                        TextButton(onClick = { onReactMessage(selected); messageActionTarget = null; selectedMessageIds = emptySet() }) { Text("React", color = TextPrimary) }
                    }
                    TextButton(onClick = { replyTarget = selected; editingTarget = null; draft = ""; selectedMessageIds = emptySet(); messageActionTarget = null }) { Text("Reply", color = TextPrimary) }
                    if (selected.senderId == currentUserId && selected.canStillEdit()) {
                        TextButton(onClick = { editingTarget = selected; replyTarget = null; draft = selected.message; selectedMessageIds = emptySet(); messageActionTarget = null }) { Text("Edit", color = TextPrimary) }
                    }
                    TextButton(onClick = { forwardMessage = selected; selectedMessageIds = emptySet(); messageActionTarget = null }) { Text("Forward", color = TextPrimary) }
                    TextButton(onClick = { selectedMessageIds = setOf(selected.id); showDeleteSelected = true; messageActionTarget = null }) { Text("Delete for me", color = Danger) }
                    if (selected.senderId == currentUserId) TextButton(onClick = { selectedMessageIds = setOf(selected.id); showDeleteSelected = true; messageActionTarget = null }) { Text("Delete for everyone", color = Danger) }
                }
            },
            confirmButton = { TextButton(onClick = { messageActionTarget = null }) { Text("Close", color = TextMuted) } }
        )
    }
    forwardMessage?.let { selected ->
        AlertDialog(
            onDismissRequest = { forwardMessage = null },
            containerColor = SurfaceElevated,
            title = { Text("Forward message", color = TextPrimary) },
            text = {
                if (forwardTargets.isEmpty()) {
                    Text("Start a chat with someone before forwarding.", color = TextMuted)
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        forwardTargets.take(8).forEach { target ->
                            Row(
                                Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(12.dp))
                                    .clickable(role = Role.Button) { onForward(selected, target.id); forwardMessage = null }
                                    .padding(horizontal = 6.dp, vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Avatar(target.name.take(1), 34, target.avatar, target.activeCosmetics)
                                Column(Modifier.padding(start = 10.dp)) {
                                    Text(target.name.ifBlank { target.username.ifBlank { "User" } }, color = TextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                                    if (target.username.isNotBlank()) Text("@${target.username}", color = TextMuted, fontSize = 11.sp)
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = { TextButton(onClick = { forwardMessage = null }) { Text("Cancel", color = TextMuted) } }
        )
    }
    infoMessage?.let { msg ->
        val mine = msg.senderId == currentUserId
        AlertDialog(
            onDismissRequest = { infoMessage = null },
            containerColor = SurfaceElevated,
            title = { Text("Message info", color = TextPrimary) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(if (mine) "Sent by you" else "Received", color = TextMuted, fontSize = 12.sp)
                    Text("Time: ${runCatching { java.time.Instant.parse(msg.createdAt).atZone(java.time.ZoneId.systemDefault()).format(java.time.format.DateTimeFormatter.ofPattern("MMM d, yyyy · HH:mm")) }.getOrElse { msg.createdAt }}", color = TextPrimary, fontSize = 13.sp)
                    if (mine) Text(if (msg.read) "Status: Seen" else "Status: Sent", color = if (msg.read) Color(0xFF69F0AE) else TextMuted, fontSize = 13.sp, fontWeight = if (msg.read) FontWeight.SemiBold else FontWeight.Normal)
                    if (msg.isEdited) Text("Edited", color = TextMuted, fontSize = 13.sp)
                    if (msg.forwarded) Text("Forwarded message", color = TextMuted, fontSize = 13.sp)
                    if (msg.reactionCount > 0) Text("Reactions: ${msg.reactionCount}", color = TextMuted, fontSize = 13.sp)
                    msg.replyTo?.let { reply ->
                        Text("Reply to: ${reply.author.ifBlank { "message" }} — ${reply.text.ifBlank { "Media" }}", color = TextMuted, fontSize = 13.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    }
                    if (msg.mediaType.isNotBlank()) Text("Type: ${msg.mediaType.lowercase().replaceFirstChar { it.uppercase() }}", color = TextMuted, fontSize = 13.sp)
                }
            },
            confirmButton = { TextButton(onClick = { infoMessage = null }) { Text("Close", color = PrimaryPurple) } }
        )
    }
    if (showDeleteSelected) {
        AlertDialog(
            onDismissRequest = { showDeleteSelected = false },
            containerColor = SurfaceElevated,
            title = { Text("Delete selected messages?", color = TextPrimary) },
            text = { Text("Delete ${selectedMessageIds.size} selected message${if (selectedMessageIds.size == 1) "" else "s"} for you. This cannot be undone.", color = TextMuted) },
            confirmButton = {
                Column(horizontalAlignment = Alignment.End) {
                    TextButton(onClick = {
                        onDeleteSelected(selectedMessageIds.toList(), "ME")
                        selectedMessageIds = emptySet()
                        showDeleteSelected = false
                    }) { Text("Delete for me", color = Danger) }
                    if (selectedOwnIds.isNotEmpty()) TextButton(onClick = {
                        onDeleteSelected(selectedOwnIds, "EVERYONE")
                        selectedMessageIds = emptySet()
                        showDeleteSelected = false
                    }) { Text("Delete ${selectedOwnIds.size} for everyone", color = Danger) }
                }
            },
            dismissButton = { TextButton(onClick = { showDeleteSelected = false }) { Text("Cancel") } }
        )
    }
    val attachmentPicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) {
            scope.launch {
                val payload = withContext(Dispatchers.IO) {
                    val mime = context.contentResolver.getType(uri) ?: "image/jpeg"
                    val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                    Triple(bytes, mime, uri.lastPathSegment ?: "message-media")
                }
                val bytes = payload.first
                if (bytes != null && bytes.size <= 25 * 1024 * 1024) onAttachmentSelected(bytes, payload.second, payload.third)
            }
        }
    }

    LaunchedEffect(draft) {
        if (draft.isNotBlank()) {
            if (!typingSent) { typingSent = true; onTyping(true) }
            kotlinx.coroutines.delay(1500)
            typingSent = false
            onTyping(false)
        } else if (typingSent) {
            typingSent = false
            onTyping(false)
        }
    }
    // Scroll behavior is handled by the visible-messages auto-scroll effect above.

    Box(Modifier.fillMaxSize().background(Background)) {
        Column(Modifier.fillMaxSize().statusBarsPadding()) {
                GlassCard(
                    modifier = Modifier.fillMaxWidth(),
                    gradient = Brush.linearGradient(listOf(SurfaceElevated, ChatSurface)),
                    borderGradient = Brush.horizontalGradient(listOf(BorderColor, BorderColor)),
                    cornerRadius = 0.dp,
                    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 10.dp)
                ) {
                    if (selectionMode) {
                        Row(
                            Modifier.fillMaxWidth().padding(vertical = 2.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Text("${selectedMessageIds.size} selected", color = TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                            if (selectedMessageIds.size == 1) TextButton(onClick = { messageActionTarget = selectedMessages.firstOrNull() }) { Text("More", color = TextPrimary) }
                            TextButton(onClick = { showDeleteSelected = true }) { Text("Delete", color = Danger) }
                            TextButton(onClick = { selectedMessageIds = emptySet() }) { Text("Cancel", color = TextMuted) }
                        }
                    } else Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        LightChatAction(Icons.AutoMirrored.Filled.ArrowBack, stringResource(R.string.a11y_back), onBack)
                        Spacer(Modifier.width(10.dp))
                        Box(
                            Modifier.size(44.dp).clip(CircleShape).clickable(enabled = !partner?.id.isNullOrBlank(), role = Role.Button) {
                                partner?.id?.takeIf(String::isNotBlank)?.let(onOpenProfile)
                            }
                        ) {
                            Box(Modifier.fillMaxSize().border(2.dp, Brush.linearGradient(listOf(Pink, PrimaryPurple)), CircleShape).padding(2.dp)) {
                                Avatar(partner?.name?.take(1) ?: "?", 38, partner?.avatar, partner?.activeCosmetics ?: ActiveCosmetics(), accessibilityLabel = stringResource(R.string.a11y_profile_picture, partner?.name ?: defaultMatchName))
                            }
                            if (partner?.isOnline == true) {
                                Box(
                                    Modifier
                                        .align(Alignment.BottomEnd)
                                        .size(12.dp)
                                        .clip(CircleShape)
                                        .background(Success)
                                        .border(2.dp, SurfaceElevated, CircleShape)
                                )
                            }
                        }
                        Column(Modifier.weight(1f).padding(start = 10.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(partner?.name ?: "Loading match…", color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Spacer(Modifier.width(4.dp))
                                Box(
                                    Modifier
                                        .size(16.dp)
                                        .clip(CircleShape)
                                        .background(Brush.linearGradient(listOf(PrimaryPurple, Pink))),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text("✓", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Black)
                                }
                            }
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                Box(
                                    Modifier
                                        .size(7.dp)
                                        .clip(CircleShape)
                                        .background(if (partner?.isOnline == true) Success else TextMuted)
                                )
                                Text(
                                    if (partner?.isOnline == true) "Online" else partner?.username?.let { "@$it" } ?: "Your conversation",
                                    color = if (partner?.isOnline == true) Success else TextMuted,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                                if (isMuted) {
                                    Text("·", color = TextMuted, fontSize = 12.sp)
                                    Text("🔕 Muted", color = TextMuted, fontSize = 11.sp, maxLines = 1)
                                }
                            }
                        }
                        LightChatAction(Icons.Filled.Call, "Start voice call", onAudioCall)
                        Spacer(Modifier.width(6.dp))
                        LightChatAction(Icons.Filled.Videocam, "Start video call", onVideoCall)
                        Spacer(Modifier.width(6.dp))
                        LightChatAction(Icons.Filled.MoreVert, stringResource(R.string.a11y_conversation_options)) { showMore = !showMore }
                    }
                }

                if (showMore) {
                    Row(Modifier.fillMaxWidth().background(SurfaceElevated.copy(alpha = 0.97f)).padding(horizontal = 12.dp, vertical = 6.dp), horizontalArrangement = Arrangement.End) {
                        Text("Profile", color = TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.sizeIn(minHeight = 48.dp).clickable(enabled = !partner?.id.isNullOrBlank()) { showMore = false; partner?.id?.takeIf(String::isNotBlank)?.let(onOpenProfile) }.padding(10.dp))
                        Text("Search", color = TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.sizeIn(minHeight = 48.dp).clickable {
                            showMore = false
                            if (searchVisible) { searchVisible = false; searchQuery = "" } else searchVisible = true
                        }.padding(10.dp))
                        Text(if (isMuted) "Unmute" else "Mute", color = TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.sizeIn(minHeight = 48.dp).clickable { showMore = false; onMute(!isMuted) }.padding(10.dp))
                        Text("Report", color = Danger, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.sizeIn(minHeight = 48.dp).clickable(role = Role.Button, onClickLabel = stringResource(R.string.a11y_report_conversation)) { showMore = false; onReport() }.padding(10.dp))
                        Text("Block", color = Danger, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.sizeIn(minHeight = 48.dp).clickable(role = Role.Button, onClickLabel = stringResource(R.string.a11y_block_person)) { showMore = false; onBlock() }.padding(10.dp))
                        Text("Delete chat for me", color = Danger, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.sizeIn(minHeight = 48.dp).clickable { showMore = false; confirmDeleteChat = true }.padding(10.dp))
                    }
                }
                if (searchVisible) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(SurfaceElevated.copy(alpha = 0.98f))
                            .padding(horizontal = 14.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(16.dp))
                                .background(Color(0xFF131629))
                                .border(1.dp, Color(0x30FFFFFF), RoundedCornerShape(16.dp))
                                .padding(horizontal = 14.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            BasicTextField(
                                value = searchQuery,
                                onValueChange = { searchQuery = it.take(100) },
                                singleLine = true,
                                textStyle = androidx.compose.ui.text.TextStyle(color = TextPrimary, fontSize = 14.sp),
                                cursorBrush = androidx.compose.ui.graphics.SolidColor(Pink),
                                modifier = Modifier.weight(1f),
                                decorationBox = { inner ->
                                    Box {
                                        if (searchQuery.isBlank()) Text("Search in this chat…", color = TextMuted, fontSize = 14.sp)
                                        inner()
                                    }
                                }
                            )
                            if (searchQuery.isNotBlank()) {
                                Spacer(Modifier.width(8.dp))
                                Text(
                                    "Clear",
                                    color = TextMuted,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium,
                                    modifier = Modifier
                                        .clip(CircleShape)
                                        .clickable(role = Role.Button, onClickLabel = "Clear search") { searchQuery = ""; onSearch("") }
                                        .padding(horizontal = 8.dp, vertical = 4.dp)
                                )
                            }
                        }
                    }
                }

                Box(Modifier.weight(1f).fillMaxWidth()) {
                    if (loading && visibleMessages.isEmpty()) {
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                androidx.compose.material3.CircularProgressIndicator(color = PrimaryPurple)
                                Text("Loading conversation…", color = TextMuted, fontSize = 13.sp, modifier = Modifier.padding(top = 12.dp))
                            }
                        }
                    } else {
                        LazyColumn(
                            state = listState,
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(start = 14.dp, end = 14.dp, top = 12.dp, bottom = 20.dp),
                            verticalArrangement = Arrangement.spacedBy(2.dp)
                        ) {
                            if (messages.isEmpty()) item { MatchedBanner(partner?.name ?: "your match") }
                            if (showSafety) item { SafetyTip(onDismiss = { showSafety = false }) }
                            relationship?.let { bond -> item { BondStrip(bond) } }
                            if (searchQuery.isBlank() && visibleMessages.isNotEmpty() && hasMoreHistory) item {
                                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                                    Text(
                                        text = if (isLoadingMore) "Loading earlier messages…" else "Load earlier messages",
                                        color = if (isLoadingMore) TextMuted else TextPrimary,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        modifier = Modifier
                                            .clip(CircleShape)
                                            .background(Brush.horizontalGradient(listOf(SurfaceElevated, PrimaryPurple.copy(alpha = 0.18f))))
                                            .border(1.dp, Brush.horizontalGradient(listOf(BorderColor, PrimaryPurple.copy(alpha = 0.45f))), CircleShape)
                                            .clickable(enabled = !isLoadingMore, role = Role.Button, onClickLabel = "Load earlier messages", onClick = onLoadOlder)
                                            .padding(horizontal = 16.dp, vertical = 9.dp)
                                    )
                                }
                            }
                            if (error.isNotBlank()) item {
                                Text("$error · Retry", color = Pink, fontSize = 12.sp, modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite }.clickable(role = Role.Button, onClickLabel = stringResource(R.string.a11y_retry_messages), onClick = onRetry).padding(vertical = 12.dp))
                            }
                            if (searchQuery.length >= 2 && hasMoreSearchResults) item {
                                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                                    Text(
                                        text = if (isLoadingMoreSearch) "Loading more results…" else "Load more results",
                                        color = if (isLoadingMoreSearch) TextMuted else TextPrimary,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        modifier = Modifier
                                            .clip(CircleShape)
                                            .background(Brush.horizontalGradient(listOf(SurfaceElevated, PrimaryPurple.copy(alpha = 0.14f))))
                                            .border(1.dp, Brush.horizontalGradient(listOf(BorderColor, PrimaryPurple.copy(alpha = 0.35f))), CircleShape)
                                            .clickable(enabled = !isLoadingMoreSearch, role = Role.Button, onClickLabel = "Load more results", onClick = onLoadMoreSearch)
                                            .padding(horizontal = 16.dp, vertical = 9.dp)
                                    )
                                }
                            }
                            if (searchQuery.isNotBlank() && visibleMessages.isEmpty()) item {
                                Text("No matching messages", color = TextMuted, fontSize = 13.sp, modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 28.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                            }
                            if (visibleMessages.isEmpty() && !loading && error.isBlank() && searchQuery.isBlank()) {
                                item {
                                    Column(Modifier.fillParentMaxHeight(0.62f).fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                                        EmptyConversationState(partner?.name ?: "your match")
                                        Row(Modifier.padding(top = 18.dp).horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                            listOf("Hello!", "Hi~", "Good day!").forEach { greeting ->
                                                Text(greeting, color = TextPrimary, fontSize = 14.sp, modifier = Modifier.clip(CircleShape).background(SurfaceElevated).border(1.dp, BorderColor, CircleShape).clickable(role = Role.Button, onClickLabel = "Send $greeting") { onSend(greeting) }.padding(horizontal = 18.dp, vertical = 11.dp))
                                            }
                                        }
                                    }
                                }
                            }
                            itemsIndexed(visibleMessages, key = { index, message -> message.id.ifBlank { "$index-${message.createdAt}-${message.message}" } }) { index, message ->
                                val prev = visibleMessages.getOrNull(index - 1)
                                val next = visibleMessages.getOrNull(index + 1)
                                val currentDate = messageDateLabel(message.createdAt)
                                val previousDate = prev?.let { messageDateLabel(it.createdAt) }
                                if (currentDate.isNotBlank() && currentDate != previousDate) {
                                    ConversationDivider(currentDate)
                                }
                                val mine = message.senderId == currentUserId
                                val groupedWithPrev = prev != null && prev.senderId == message.senderId && previousDate == currentDate
                                val groupedWithNext = next != null && next.senderId == message.senderId && messageDateLabel(next.createdAt) == currentDate
                                Box(Modifier.padding(top = if (groupedWithPrev) 0.dp else 3.dp, bottom = if (groupedWithNext) 0.dp else 3.dp)) {
                                    MessageBubble(
                                        message = message,
                                        mine = mine,
                                        selected = message.id in selectedMessageIds,
                                        bubbleId = myActiveCosmetics.chatBubble,
                                        reactionCount = message.reactionCount,
                                        partner = partner,
                                        currentUserId = currentUserId,
                                        myActiveCosmetics = myActiveCosmetics,
                                        showIncomingAvatar = !mine && !groupedWithNext,
                                        showOutgoingAvatar = mine && !groupedWithNext,
                                        compact = groupedWithPrev,
                                        onReact = {
                                            if (selectionMode) toggleSelection(message.id)
                                            else if (message.id.isNotBlank()) onReactMessage(message)
                                        },
                                        onLongPress = { toggleSelection(message.id) }
                                    )
                                }
                            }
                            if (isPartnerTyping) item {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Avatar(partner?.name?.take(1) ?: "?", 30, partner?.avatar, partner?.activeCosmetics ?: com.yugm.app.core.model.ActiveCosmetics(), accessibilityLabel = stringResource(R.string.a11y_profile_picture, partner?.name ?: defaultMatchName))
                                    Column(Modifier.padding(start = 8.dp)) {
                                        TypingBubble()
                                        Text("${partner?.name ?: "Your match"} is typing…", color = TextMuted, fontSize = 10.sp)
                                    }
                                }
                            }
                        }
                    }
                    if (showScrollToBottom && !loading) {
                        Box(
                            modifier = Modifier
                                .align(Alignment.BottomEnd)
                                .padding(end = 14.dp, bottom = 14.dp)
                                .size(42.dp)
                                .clip(CircleShape)
                                .background(Brush.linearGradient(listOf(PrimaryPurple, Pink)))
                                .border(1.dp, Color.White.copy(alpha = 0.18f), CircleShape)
                                .clickable(role = Role.Button, onClickLabel = "Scroll to latest messages") {
                                    scope.launch {
                                        val target = (listState.layoutInfo.totalItemsCount - 1).coerceAtLeast(0)
                                        listState.animateScrollToItem(target)
                                    }
                                },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Filled.KeyboardArrowDown, contentDescription = null, tint = Color.White, modifier = Modifier.size(22.dp))
                        }
                    }
                }

                AnimatedVisibility(showEmojiBar) {
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .background(SurfaceElevated.copy(alpha = 0.98f))
                            .horizontalScroll(rememberScrollState())
                            .padding(horizontal = 14.dp, vertical = 10.dp),
                        horizontalArrangement = Arrangement.spacedBy(14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        listOf("😊", "😂", "❤️", "✨", "🔥", "👋", "🎧", "🌙").forEach { emoji ->
                            val insertEmojiLabel = stringResource(R.string.a11y_insert_emoji, emoji)
                            Box(
                                Modifier
                                    .sizeIn(minWidth = 42.dp, minHeight = 42.dp)
                                    .clip(CircleShape)
                                    .background(ChatSurface.copy(alpha = 0.55f))
                                    .semantics { contentDescription = insertEmojiLabel }
                                    .clickable(role = Role.Button, onClickLabel = insertEmojiLabel) { draft += emoji },
                                contentAlignment = Alignment.Center
                            ) {
                                Text(emoji, fontSize = 22.sp)
                            }
                        }
                    }
                }

                GlassCard(
                    modifier = Modifier.fillMaxWidth().navigationBarsPadding().imePadding(),
                    gradient = Brush.linearGradient(listOf(SurfaceElevated, ChatSurface)),
                    borderGradient = Brush.horizontalGradient(listOf(BorderColor, BorderColor)),
                    cornerRadius = 0.dp,
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 10.dp)
                ) {
                    if (replyTarget != null || editingTarget != null) {
                        val contextMessage = editingTarget ?: replyTarget!!
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .padding(bottom = 10.dp)
                                .clip(RoundedCornerShape(14.dp))
                                .background(Color(0xFF131629))
                                .border(1.dp, Color(0x30FFFFFF), RoundedCornerShape(14.dp))
                                .padding(horizontal = 12.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(Modifier.width(3.dp).height(28.dp).clip(CircleShape).background(Brush.verticalGradient(listOf(PrimaryPurple, Pink))))
                            Column(Modifier.weight(1f).padding(start = 10.dp, end = 8.dp)) {
                                Text(
                                    if (editingTarget != null) "Editing message" else "Replying to ${contextMessage.sender?.name ?: "message"}",
                                    color = TextPrimary,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                                Text(
                                    contextMessage.message.ifBlank { "Media message" },
                                    color = TextMuted,
                                    fontSize = 11.sp,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                            Text("Cancel", color = Pink, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.clickable(role = Role.Button) { replyTarget = null; editingTarget = null; draft = "" }.padding(horizontal = 6.dp, vertical = 4.dp))
                        }
                    }
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        LightChatAction(Icons.Filled.SentimentSatisfiedAlt, stringResource(R.string.a11y_toggle_emoji_picker)) { showEmojiBar = !showEmojiBar }
                        Row(
                            Modifier.weight(1f).height(52.dp).clip(RoundedCornerShape(26.dp))
                                .background(Color(0xFF131629))
                                .border(1.dp, Color(0x30FFFFFF), RoundedCornerShape(26.dp))
                                .padding(horizontal = 14.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            BasicTextField(
                                value = draft,
                                onValueChange = { draft = it.take(1000) },
                                textStyle = androidx.compose.ui.text.TextStyle(color = TextPrimary, fontSize = 14.sp),
                                cursorBrush = androidx.compose.ui.graphics.SolidColor(Pink),
                                modifier = Modifier.weight(1f).semantics { contentDescription = messageFieldLabel },
                                decorationBox = { inner ->
                                    Box {
                                        if (draft.isBlank()) Text(if (editingTarget != null) "Edit message…" else if (replyTarget != null) "Write a reply…" else "Type a message...", color = TextMuted, fontSize = 14.sp)
                                        inner()
                                    }
                                }
                            )
                            Spacer(Modifier.width(6.dp))
                            Box(Modifier.sizeIn(minWidth = 36.dp, minHeight = 36.dp).semantics { contentDescription = attachPhotoLabel }.clickable(role = Role.Button, onClickLabel = attachPhotoLabel) { attachmentPicker.launch("image/*") }, contentAlignment = Alignment.Center) {
                                Icon(Icons.Filled.AttachFile, contentDescription = null, tint = TextMuted, modifier = Modifier.size(19.dp))
                            }
                            Spacer(Modifier.width(4.dp))
                            Box(Modifier.sizeIn(minWidth = 36.dp, minHeight = 36.dp).semantics { contentDescription = "Select photo" }.clickable(role = Role.Button, onClickLabel = "Select photo") { attachmentPicker.launch("image/*") }, contentAlignment = Alignment.Center) {
                                Text("🖼️", fontSize = 16.sp)
                            }
                            Spacer(Modifier.width(4.dp))
                            Box(
                                Modifier
                                    .sizeIn(minWidth = 36.dp, minHeight = 36.dp)
                                    .semantics { contentDescription = "Send gift" }
                                    .clickable(role = Role.Button, onClickLabel = "Send gift") { showGiftSheet = true },
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(Icons.Filled.CardGiftcard, contentDescription = null, tint = TextMuted, modifier = Modifier.size(19.dp))
                            }
                        }
                        Box(
                            Modifier
                                .size(48.dp)
                                .clip(CircleShape)
                                .background(
                                    if (isSending) Brush.linearGradient(listOf(Color(0xFF6B2FD9).copy(alpha = 0.55f), Color(0xFF9E37F9).copy(alpha = 0.55f)))
                                    else Brush.linearGradient(listOf(Color(0xFF6B2FD9), Color(0xFF9E37F9)))
                                )
                                .semantics { contentDescription = sendMessageLabel }
                                .clickable(enabled = !isSending, role = Role.Button, onClickLabel = sendMessageLabel) {
                                    submitDraft()
                                },
                            contentAlignment = Alignment.Center
                        ) {
                            if (isSending) {
                                androidx.compose.material3.CircularProgressIndicator(
                                    modifier = Modifier.size(18.dp),
                                    color = Color.White,
                                    strokeWidth = 2.dp
                                )
                            } else {
                                Icon(Icons.AutoMirrored.Filled.Send, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
                            }
                        }
                    }
                }
            }
        if (showGiftSheet) {
            ModalBottomSheet(onDismissRequest = { showGiftSheet = false }, containerColor = ChatSurface) {
                Column(Modifier.fillMaxWidth().padding(20.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Send a Gift", color = TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Black, modifier = Modifier.weight(1f))
                        Text("● $balance", color = Color(0xFFFFC52F), fontWeight = FontWeight.Bold)
                    }
                    if (gifts.isEmpty()) {
                        Text(
                            "No gifts available right now.",
                            color = TextMuted,
                            fontSize = 13.sp,
                            modifier = Modifier.padding(top = 14.dp)
                        )
                    } else {
                        Row(Modifier.padding(top = 14.dp).horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            gifts.forEach { gift ->
                                Column(
                                    Modifier.width(105.dp).height(132.dp).clip(RoundedCornerShape(18.dp)).background(Background).border(1.dp, BorderColor, RoundedCornerShape(18.dp)).clickable(enabled = balance >= gift.price) { onGift(gift); showGiftSheet = false }.padding(10.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.Center
                                ) {
                                    if (gift.icon.startsWith("http", ignoreCase = true) || gift.icon.startsWith("/")) {
                                        AsyncImage(
                                            model = resolveMediaUrl(gift.icon),
                                            contentDescription = gift.name,
                                            contentScale = ContentScale.Fit,
                                            modifier = Modifier.size(44.dp)
                                        )
                                    } else {
                                        val emoji = getGiftEmoji(gift.name, gift.icon)
                                        Text(emoji, fontSize = 36.sp)
                                    }
                                    Text(gift.name, color = TextPrimary, fontSize = 11.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    Text("● ${gift.price}", color = if (balance >= gift.price) Color(0xFFFFC52F) else Danger, fontSize = 10.sp)
                                }
                            }
                        }
                    }
                    Spacer(Modifier.height(24.dp))
                }
            }
        }
    }
}

@Composable
private fun LightChatAction(icon: ImageVector, label: String, onClick: () -> Unit) {
    Box(
        Modifier.size(44.dp).clip(CircleShape).background(SurfaceElevated)
            .semantics { contentDescription = label }
            .clickable(role = Role.Button, onClickLabel = label, onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Icon(icon, contentDescription = null, tint = TextPrimary, modifier = Modifier.size(20.dp))
    }
}

@Composable
private fun MatchedBanner(name: String) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(Brush.horizontalGradient(listOf(PrimaryPurple.copy(alpha = 0.4f), Pink.copy(alpha = 0.3f)))).border(1.dp, Pink.copy(alpha = 0.4f), RoundedCornerShape(18.dp)).padding(14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(Modifier.size(42.dp).clip(RoundedCornerShape(13.dp)).background(Brush.linearGradient(listOf(Pink, PrimaryPurple))), contentAlignment = Alignment.Center) { Text("♡", color = Color.White, fontSize = 23.sp, fontWeight = FontWeight.Black) }
        Column(Modifier.padding(start = 12.dp)) {
            Text("You're Matched!", color = TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Black)
            Text("Say hello to $name and start your story ✨", color = TextMuted, fontSize = 11.sp)
        }
    }
}

@Composable
private fun EmptyConversationState(name: String) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Box(
            Modifier.size(56.dp).clip(CircleShape).background(Brush.linearGradient(listOf(PrimaryPurple.copy(alpha = 0.75f), Pink.copy(alpha = 0.75f)))),
            contentAlignment = Alignment.Center
        ) { Text("♡", color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Bold) }
        Text("Start the conversation", color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold)
        Text("Send ${name.substringBefore(' ')} a message and see where the conversation goes.", color = TextMuted, fontSize = 13.sp, lineHeight = 18.sp)
    }
}

@Composable
private fun SafetyTip(onDismiss: () -> Unit) {
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(SurfaceElevated).border(1.dp, BorderColor, RoundedCornerShape(18.dp)).padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
        Text("✦", color = Pink, fontSize = 28.sp)
        Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
            Text("Safety Tip", color = PrimaryPurple, fontWeight = FontWeight.Bold, fontSize = 13.sp)
            Text("Be kind, respectful and keep the conversation safe. Report or block anything that feels off.", color = TextMuted, fontSize = 10.sp, lineHeight = 14.sp)
        }
        Text("×", color = TextMuted, fontSize = 22.sp, modifier = Modifier.clickable(onClick = onDismiss))
    }
}

@Composable
private fun BondStrip(bond: RelationshipStatus) {
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(SurfaceElevated).padding(12.dp)) {
        Row { Text("Bond Level ${bond.level}", color = TextPrimary, fontSize = 11.sp, fontWeight = FontWeight.Bold); Spacer(Modifier.weight(1f)); Text(bond.title, color = Pink, fontSize = 10.sp, fontWeight = FontWeight.Bold) }
        Box(Modifier.fillMaxWidth().padding(top = 7.dp).height(4.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.08f))) {
            Box(Modifier.fillMaxWidth(bond.progress.coerceIn(0f, 1f)).height(4.dp).background(Brush.horizontalGradient(listOf(PrimaryPurple, Pink))))
        }
    }
}

@Composable
private fun ConversationDivider(label: String, highlight: Boolean = false) {
    Box(Modifier.fillMaxWidth().padding(vertical = 12.dp), contentAlignment = Alignment.Center) {
        Box(
            Modifier
                .clip(RoundedCornerShape(50))
                .background(SurfaceElevated)
                .border(1.dp, BorderColor, RoundedCornerShape(50))
                .padding(horizontal = 16.dp, vertical = 6.dp)
        ) {
            Text(label, color = if (highlight) Pink else TextMuted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun MessageBubble(
    message: DirectMessage,
    mine: Boolean,
    selected: Boolean,
    bubbleId: String,
    reactionCount: Int,
    partner: Host?,
    currentUserId: String,
    myActiveCosmetics: ActiveCosmetics,
    showIncomingAvatar: Boolean = !mine,
    showOutgoingAvatar: Boolean = mine,
    compact: Boolean = false,
    onReact: () -> Unit,
    onLongPress: () -> Unit
) {
    val bubble = if (mine) chatBubbleVisual(bubbleId) else null
    Row(
        Modifier.fillMaxWidth(),
        horizontalArrangement = if (mine) Arrangement.End else Arrangement.Start,
        verticalAlignment = Alignment.Bottom
    ) {
        if (!mine) {
            if (showIncomingAvatar) {
                Box(Modifier.size(30.dp).clip(CircleShape).background(SurfaceElevated)) {
                    Avatar(
                        initial = partner?.name?.firstOrNull()?.toString() ?: "?",
                        size = 30,
                        imageUrl = partner?.avatar,
                        cosmetics = partner?.activeCosmetics ?: ActiveCosmetics(),
                        accessibilityLabel = null
                    )
                }
            } else {
                Spacer(Modifier.width(30.dp))
            }
            Spacer(Modifier.width(8.dp))
        }

        Column(horizontalAlignment = if (mine) Alignment.End else Alignment.Start) {
            Box(
                Modifier
                    .widthIn(max = 280.dp)
                    .clip(
                        RoundedCornerShape(
                            topStart = 20.dp,
                            topEnd = 20.dp,
                            bottomStart = if (mine) 20.dp else 6.dp,
                            bottomEnd = if (mine) 6.dp else 20.dp
                        )
                    )
                    .background(
                        bubble?.fill ?: if (mine) {
                            Brush.horizontalGradient(listOf(Color(0xFF6B2FD9), Color(0xFF9E37F9)))
                        } else {
                            Brush.linearGradient(listOf(Color(0xFF1E1736), Color(0xFF15122B)))
                        }
                    )
                    .border(
                        if (selected) 2.dp else 1.dp,
                        if (selected) Pink else bubble?.border ?: Color(0x33FFFFFF),
                        RoundedCornerShape(20.dp)
                    )
                    .combinedClickable(onClick = onReact, onLongClick = onLongPress)
                    .padding(horizontal = 14.dp, vertical = if (compact) 10.dp else 12.dp)
            ) {
                Column {
                    if (message.forwarded) {
                        Text("Forwarded", color = Pink, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(bottom = 4.dp))
                    }
                    message.replyTo?.let { reply ->
                        Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(Color.Black.copy(alpha = 0.22f)).padding(8.dp)) {
                            Text(reply.author.ifBlank { "Replied message" }, color = Pink, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            Text(reply.text.ifBlank { "Media" }, color = TextMuted, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                        Spacer(Modifier.height(6.dp))
                    }
                    if (message.mediaUrl.isNotBlank()) {
                        val isAudio = message.mediaType.equals("AUDIO", true)
                        val isVideo = message.mediaType.equals("VIDEO", true)
                        if (isAudio) {
                            Row(
                                Modifier
                                    .widthIn(min = 180.dp, max = 240.dp)
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(Color.White.copy(alpha = 0.12f))
                                    .padding(horizontal = 10.dp, vertical = 10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Box(
                                    Modifier.size(34.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.22f)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text("▶", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                }
                                Column(Modifier.weight(1f)) {
                                    Row(
                                        horizontalArrangement = Arrangement.spacedBy(2.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        repeat(16) { i ->
                                            val h = (8 + (i * 5) % 16).dp
                                            Box(Modifier.width(3.dp).height(h).clip(CircleShape).background(Color.White.copy(alpha = 0.85f)))
                                        }
                                    }
                                    Text("Voice note", color = (bubble?.text ?: TextMuted).copy(alpha = 0.8f), fontSize = 10.sp, modifier = Modifier.padding(top = 4.dp))
                                }
                            }
                        } else {
                            Box(
                                Modifier
                                    .widthIn(max = 240.dp)
                                    .height(if (isVideo) 160.dp else 170.dp)
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(Color.Black.copy(alpha = 0.18f))
                            ) {
                                AsyncImage(
                                    model = resolveMediaUrl(message.mediaUrl),
                                    contentDescription = if (isVideo) "Shared video" else "Shared photo",
                                    modifier = Modifier.fillMaxSize(),
                                    contentScale = ContentScale.Crop
                                )
                                if (isVideo) {
                                    Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.22f)))
                                    Box(
                                        Modifier
                                            .align(Alignment.Center)
                                            .size(40.dp)
                                            .clip(CircleShape)
                                            .background(Color.Black.copy(alpha = 0.45f))
                                            .border(1.dp, Color.White.copy(alpha = 0.35f), CircleShape),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text("▶", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                                    }
                                }
                                Box(
                                    Modifier
                                        .align(Alignment.TopEnd)
                                        .padding(8.dp)
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(Color.Black.copy(alpha = 0.45f))
                                        .padding(horizontal = 7.dp, vertical = 3.dp)
                                ) {
                                    Text(if (isVideo) "VIDEO" else "PHOTO", color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.SemiBold)
                                }
                            }
                        }
                        Spacer(Modifier.height(6.dp))
                    }
                    val isCallMessage = message.message.contains("call started", ignoreCase = true)
                    if (isCallMessage) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color.White.copy(alpha = 0.12f))
                                .padding(horizontal = 10.dp, vertical = 8.dp)
                        ) {
                            Text("📞", fontSize = 16.sp)
                            Spacer(Modifier.width(8.dp))
                            Column {
                                Text(
                                    if (message.message.contains("video", true)) "Video call" else "Voice call",
                                    color = bubble?.text ?: TextPrimary,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                                Text("Tap call actions above to start a new one", color = (bubble?.text ?: TextMuted).copy(alpha = 0.8f), fontSize = 10.sp)
                            }
                        }
                    } else if (message.message.isNotBlank()) {
                        val callType = when {
                            message.message.contains("video call", ignoreCase = true) || message.message.contains("📹") -> "Video call"
                            message.message.contains("voice call", ignoreCase = true) || message.message.contains("audio call", ignoreCase = true) || message.message.contains("📞") -> "Voice call"
                            else -> null
                        }
                        if (callType != null) {
                            Row(
                                Modifier
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(Color.White.copy(alpha = 0.12f))
                                    .padding(horizontal = 12.dp, vertical = 10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Box(
                                    Modifier
                                        .size(34.dp)
                                        .clip(CircleShape)
                                        .background(Brush.linearGradient(listOf(PrimaryPurple.copy(alpha = 0.95f), Pink.copy(alpha = 0.9f)))),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(if (callType == "Video call") "📹" else "📞", fontSize = 15.sp)
                                }
                                Column {
                                    Text(callType, color = bubble?.text ?: TextPrimary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                                    Text(
                                        if (mine) "Tap call to start again" else "Call in chat",
                                        color = (bubble?.text ?: TextMuted).copy(alpha = 0.78f),
                                        fontSize = 11.sp
                                    )
                                }
                            }
                        } else {
                            Text(message.message, color = bubble?.text ?: TextPrimary, fontSize = 14.sp, lineHeight = 20.sp)
                        }
                    }
                    Row(Modifier.align(Alignment.End).padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                        if (message.isEdited) {
                            Text("edited", color = (bubble?.text ?: TextMuted).copy(alpha = 0.7f), fontSize = 10.sp)
                            Text(" · ", color = (bubble?.text ?: TextMuted).copy(alpha = 0.6f), fontSize = 10.sp)
                        }
                        Text(messageTime(message.createdAt), color = (bubble?.text ?: TextMuted).copy(alpha = 0.78f), fontSize = 10.sp)
                        if (mine) {
                            Spacer(Modifier.width(4.dp))
                            Text(
                                if (message.read) "Seen" else "Sent",
                                color = if (message.read) Color(0xFF69F0AE) else (bubble?.text ?: Color.White).copy(alpha = 0.75f),
                                fontSize = 10.sp,
                                fontWeight = if (message.read) FontWeight.SemiBold else FontWeight.Medium
                            )
                        }
                    }
                }
            }
            if (reactionCount > 0) {
                Box(
                    Modifier
                        .offset(y = (-6).dp)
                        .clip(CircleShape)
                        .background(SurfaceElevated)
                        .border(1.dp, BorderColor, CircleShape)
                        .padding(horizontal = 8.dp, vertical = 3.dp)
                ) {
                    Text("❤️ $reactionCount", color = TextPrimary, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        if (mine) {
            Spacer(Modifier.width(8.dp))
            if (showOutgoingAvatar) {
                Box(Modifier.size(30.dp).clip(CircleShape).background(SurfaceElevated)) {
                    Avatar(
                        initial = "You".first().toString(),
                        size = 30,
                        imageUrl = null,
                        cosmetics = myActiveCosmetics,
                        accessibilityLabel = null
                    )
                }
            } else {
                Spacer(Modifier.width(30.dp))
            }
        }
    }
}

@Composable
fun TypingIndicatorDot(delay: Int) {
    val offsetY = if (LocalMotionEnabled.current) {
        val transition = rememberInfiniteTransition(label = "typing")
        val animatedOffset by transition.animateFloat(0f, -6f, infiniteRepeatable(tween(300, delayMillis = delay, easing = LinearEasing), RepeatMode.Reverse), label = "typing-dot")
        animatedOffset
    } else 0f
    Box(Modifier.size(5.dp).offset(y = offsetY.dp).clip(CircleShape).background(PrimaryPurple))
}

@Composable
fun TypingBubble() {
    Row(Modifier.clip(RoundedCornerShape(14.dp)).background(SurfaceElevated).padding(horizontal = 12.dp, vertical = 10.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        TypingIndicatorDot(0); TypingIndicatorDot(100); TypingIndicatorDot(200)
    }
}

private fun messageTime(value: String) = runCatching {
    val instant = java.time.Instant.parse(value)
    val local = instant.atZone(java.time.ZoneId.systemDefault())
    java.time.format.DateTimeFormatter.ofPattern("HH:mm").format(local)
}.getOrElse { if (value.length >= 16) value.substring(11, 16) else "now" }

private fun messageDateLabel(value: String): String = runCatching {
    val instant = java.time.Instant.parse(value)
    val local = instant.atZone(java.time.ZoneId.systemDefault()).toLocalDate()
    val today = java.time.LocalDate.now()
    when (local) {
        today -> "Today"
        today.minusDays(1) -> "Yesterday"
        else -> if (local.year == today.year) {
            local.format(java.time.format.DateTimeFormatter.ofPattern("MMM d"))
        } else {
            local.format(java.time.format.DateTimeFormatter.ofPattern("MMM d, yyyy"))
        }
    }
}.getOrDefault("")

private fun DirectMessage.canStillEdit(): Boolean = runCatching {
    java.time.Instant.parse(createdAt).isAfter(java.time.Instant.now().minusSeconds(15 * 60))
}.getOrDefault(false)
private fun getGiftEmoji(name: String, icon: String): String {
    val query = "$name $icon".lowercase()
    return when {
        query.contains("diya", true) -> "🪔"
        query.contains("rose", true) -> "🌹"
        query.contains("crown", true) -> "👑"
        query.contains("lotus", true) -> "🪷"
        query.contains("heart", true) -> "❤️"
        query.contains("ring", true) -> "💍"
        query.contains("car", true) -> "🏎️"
        query.contains("diamond", true) -> "💎"
        query.contains("fire", true) -> "🔥"
        query.contains("rocket", true) -> "🚀"
        query.contains("mic", true) -> "🎤"
        query.contains("cake", true) -> "🎂"
        query.contains("bear", true) -> "🧸"
        query.contains("star", true) -> "⭐"
        else -> {
            if (icon.isNotBlank() && icon.length <= 4 && !icon.any { it.isLetterOrDigit() }) icon
            else "🎁"
        }
    }
}
