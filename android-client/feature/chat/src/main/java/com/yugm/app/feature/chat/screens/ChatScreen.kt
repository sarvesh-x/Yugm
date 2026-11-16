package com.yugm.app.feature.chat.screens

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import android.content.Intent
import android.media.MediaPlayer
import android.net.Uri
import androidx.core.net.toUri
import kotlin.math.roundToInt
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
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
import androidx.compose.material.icons.automirrored.filled.Forward
import androidx.compose.material.icons.automirrored.filled.Reply
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.CardGiftcard
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.EmojiEmotions
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.SentimentSatisfiedAlt
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
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
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.boundsInRoot
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
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.yugm.app.core.model.ActiveCosmetics
import com.yugm.app.core.model.RoomType
import com.yugm.app.core.model.DirectMessage
import com.yugm.app.core.model.GiftItem
import com.yugm.app.core.model.Host
import com.yugm.app.core.api.resolveMediaUrl
import com.yugm.app.feature.chat.R
import com.yugm.app.core.model.RelationshipStatus
import com.yugm.app.core.ui.components.*
import com.yugm.app.core.ui.cosmetics.chatBubbleVisual
import com.yugm.app.core.ui.theme.LocalMotionEnabled
import com.yugm.app.core.ui.theme.LocalYugmColors
import coil.compose.AsyncImage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

// Theme-aware palette is read via LocalYugmColors inside composables.

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
    startingCallType: RoomType? = null,
    error: String = "",
    onBack: () -> Unit = {},
    onRetry: () -> Unit = {},
    onSend: (String, () -> Unit, (String) -> Unit) -> Unit = { _, _, _ -> },
    onGift: (GiftItem) -> Unit = {},
    onReactMessage: (DirectMessage, String) -> Unit = { _, _ -> },
    onTyping: (Boolean) -> Unit = {},
    onAudioCall: () -> Unit = {},
    onVideoCall: () -> Unit = {},
    onAttachmentSelected: (ByteArray, String, String) -> Unit = { _, _, _ -> },
    onReport: (String) -> Unit = {},
    isMatched: Boolean = false,
    onToggleBlock: () -> Unit = {},
    onDeleteConversation: () -> Unit = {},
    onDeleteSelected: (List<String>, String) -> Unit = { _, _ -> },
    isMuted: Boolean = false,
    isBlockedByMe: Boolean = false,
    forwardTargets: List<Host> = emptyList(),
    searchResults: List<DirectMessage>? = null,
    hasMoreHistory: Boolean = false,
    isLoadingMore: Boolean = false,
    hasMoreSearchResults: Boolean = false,
    isLoadingMoreSearch: Boolean = false,
    onLoadOlder: () -> Unit = {},
    onReply: (String, DirectMessage, () -> Unit, (String) -> Unit) -> Unit = { _, _, _, _ -> },
    onEdit: (DirectMessage, String, () -> Unit, (String) -> Unit) -> Unit = { _, _, _, _ -> },
    onForward: (DirectMessage, String) -> Unit = { _, _ -> },
    onSearch: (String) -> Unit = {},
    onLoadMoreSearch: () -> Unit = {},
    onMute: (Boolean) -> Unit = {},
    onOpenProfile: (String) -> Unit = {},
    isCurrentUserVip: Boolean = false,
    onOpenVip: () -> Unit = {}
) {
    var draft by rememberSaveable(partner?.id) { mutableStateOf("") }
    var showGiftSheet by rememberSaveable { mutableStateOf(false) }
    var showEmojiBar by rememberSaveable { mutableStateOf(false) }
    var showMore by rememberSaveable { mutableStateOf(false) }
    var showReportDialog by rememberSaveable { mutableStateOf(false) }
    var confirmDeleteChat by rememberSaveable { mutableStateOf(false) }
    var showVipCallDialog by rememberSaveable(partner?.id) { mutableStateOf(false) }
    var showDeleteSelected by remember(partner?.id) { mutableStateOf(false) }
    var selectedMessageIds by remember(partner?.id) { mutableStateOf<Set<String>>(emptySet()) }
    var forwardMessage by remember(partner?.id) { mutableStateOf<DirectMessage?>(null) }
    var infoMessage by remember(partner?.id) { mutableStateOf<DirectMessage?>(null) }
    var reactDialogTarget by remember(partner?.id) { mutableStateOf<DirectMessage?>(null) }
    var optionsDialogTarget by remember(partner?.id) { mutableStateOf<DirectMessage?>(null) }
    var targetMessageBounds by remember(partner?.id) { mutableStateOf<androidx.compose.ui.geometry.Rect?>(null) }
    var replyTarget by remember(partner?.id) { mutableStateOf<DirectMessage?>(null) }
    var editingTarget by remember(partner?.id) { mutableStateOf<DirectMessage?>(null) }
    var searchVisible by rememberSaveable { mutableStateOf(false) }
    var searchQuery by rememberSaveable { mutableStateOf("") }
    var typingSent by remember { mutableStateOf(false) }
    var highlightedMessageId by remember(partner?.id) { mutableStateOf<String?>(null) }
    var imageViewerUrl by remember(partner?.id) { mutableStateOf<String?>(null) }
    var playingVoiceMessageId by remember(partner?.id) { mutableStateOf<String?>(null) }
    var isVoicePlaying by remember(partner?.id) { mutableStateOf(false) }
    var isVoicePreparing by remember(partner?.id) { mutableStateOf(false) }
    var voiceProgressMs by remember(partner?.id) { mutableIntStateOf(0) }
    var voiceDurationMs by remember(partner?.id) { mutableIntStateOf(0) }
    var pendingJumpMessageId by remember(partner?.id) { mutableStateOf<String?>(null) }
    val voicePlayer = remember(partner?.id) { MediaPlayer() }
    val listState = rememberLazyListState()
    val context = LocalContext.current
    val safetyPrefs = remember(context) { context.getSharedPreferences("chat_safety_tip", android.content.Context.MODE_PRIVATE) }
    val safetyKey = remember(currentUserId, partner?.id) {
        val uid = currentUserId.trim()
        val pid = partner?.id?.trim().orEmpty()
        if (uid.isNotBlank() && pid.isNotBlank()) "dismissed_${uid}_$pid" else null
    }
    var showSafety by remember(safetyKey) { mutableStateOf(safetyKey?.let { !safetyPrefs.getBoolean(it, false) } ?: true) }
    val messageFieldLabel = stringResource(R.string.a11y_message_field)
    val attachPhotoLabel = stringResource(R.string.a11y_attach_photo)
    val sendMessageLabel = stringResource(R.string.a11y_send_message)
    val defaultMatchName = stringResource(R.string.a11y_default_match)
    val scope = rememberCoroutineScope()
    val showScrollToBottom by remember { derivedStateOf { listState.canScrollForward } }
    var didInitialScroll by remember(partner?.id) { mutableStateOf(false) }
    var lastMessageCount by remember(partner?.id) { mutableIntStateOf(0) }
    var forceScrollOnAppend by remember(partner?.id) { mutableStateOf(false) }
    val visibleMessages = when {
        searchQuery.length >= 2 -> searchResults.orEmpty()
        searchQuery.isNotBlank() -> messages.filter { it.message.contains(searchQuery, ignoreCase = true) }
        else -> messages
    }
    val selectionMode = selectedMessageIds.isNotEmpty()
    BackHandler(enabled = selectionMode) { selectedMessageIds = emptySet() }
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
        if (typingSent) {
            typingSent = false
            onTyping(false)
        }
        draft = ""
        editingTarget = null
        replyTarget = null
        forceScrollOnAppend = true
        val restoreOnFailure: (String) -> Unit = {
            if (draft.isBlank()) draft = value
            if (editing != null) editingTarget = editing
            if (replying != null) replyTarget = replying
        }
        when {
            editing != null -> onEdit(editing, value, {}, restoreOnFailure)
            replying != null -> onReply(value, replying, {}, restoreOnFailure)
            else -> onSend(value, {}, restoreOnFailure)
        }
    }

    fun toggleVoicePlayback(message: DirectMessage) {
        val messageId = message.id.ifBlank { return }
        val resolvedUrl = resolveMediaUrl(message.mediaUrl) ?: message.mediaUrl
        if (resolvedUrl.isBlank()) {
            openChatMedia(context, message.mediaUrl)
            return
        }
        if (playingVoiceMessageId == messageId) {
            if (isVoicePreparing) return
            if (runCatching { voicePlayer.isPlaying }.getOrDefault(false)) {
                runCatching { voicePlayer.pause() }
                isVoicePlaying = false
            } else {
                runCatching { voicePlayer.start() }
                isVoicePlaying = runCatching { voicePlayer.isPlaying }.getOrDefault(true)
            }
            return
        }
        runCatching {
            isVoicePreparing = true
            isVoicePlaying = false
            voiceProgressMs = 0
            voiceDurationMs = 0
            playingVoiceMessageId = messageId
            voicePlayer.reset()
            voicePlayer.setDataSource(resolvedUrl)
            voicePlayer.setOnPreparedListener { player ->
                isVoicePreparing = false
                voiceDurationMs = player.duration.coerceAtLeast(0)
                voiceProgressMs = 0
                player.start()
                isVoicePlaying = true
            }
            voicePlayer.setOnCompletionListener {
                isVoicePlaying = false
                voiceProgressMs = runCatching { voicePlayer.duration }.getOrDefault(voiceProgressMs)
            }
            voicePlayer.setOnErrorListener { _, _, _ ->
                isVoicePreparing = false
                isVoicePlaying = false
                playingVoiceMessageId = null
                android.widget.Toast.makeText(context, "Couldn't play voice note", android.widget.Toast.LENGTH_SHORT).show()
                true
            }
            voicePlayer.prepareAsync()
        }.onFailure {
            isVoicePreparing = false
            isVoicePlaying = false
            playingVoiceMessageId = null
            android.widget.Toast.makeText(context, "Couldn't play voice note", android.widget.Toast.LENGTH_SHORT).show()
            openChatMedia(context, resolvedUrl)
        }
    }

    fun seekVoicePlayback(messageId: String, positionMs: Int) {
        if (playingVoiceMessageId != messageId || isVoicePreparing) return
        val clamped = positionMs.coerceIn(0, voiceDurationMs.coerceAtLeast(0))
        runCatching { voicePlayer.seekTo(clamped) }
        voiceProgressMs = clamped
    }

    fun computeTimelineItemIndex(targetMessageId: String): Int? {
        if (targetMessageId.isBlank()) return null
        var index = 0
        if (isBlockedByMe) index += 1
        if (messages.isEmpty()) index += 1
        if (showSafety) index += 1
        if (relationship != null) index += 1
        if (searchQuery.isBlank() && messages.isNotEmpty() && hasMoreHistory) index += 1
        if (error.isNotBlank()) index += 1
        var previousDate = ""
        messages.forEach { msg ->
            val currentDate = messageDateLabel(msg.createdAt)
            if (currentDate.isNotBlank() && currentDate != previousDate) {
                index += 1
            }
            if (msg.id == targetMessageId) return index
            index += 1
            previousDate = currentDate
        }
        return null
    }

    fun jumpToMessage(target: DirectMessage) {
        val targetId = target.id
        if (targetId.isBlank()) return
        scope.launch {
            searchVisible = false
            searchQuery = ""
            onSearch("")
            kotlinx.coroutines.delay(60)
            val itemIndex = computeTimelineItemIndex(targetId)
            if (itemIndex != null) {
                pendingJumpMessageId = null
                highlightedMessageId = targetId
                val bounded = itemIndex.coerceIn(0, (listState.layoutInfo.totalItemsCount - 1).coerceAtLeast(0))
                listState.animateScrollToItem(bounded)
            } else if (hasMoreHistory && !isLoadingMore) {
                pendingJumpMessageId = targetId
                android.widget.Toast.makeText(context, "Loading earlier messages to find this result…", android.widget.Toast.LENGTH_SHORT).show()
                onLoadOlder()
            } else {
                pendingJumpMessageId = null
                android.widget.Toast.makeText(context, "Message not found in loaded history.", android.widget.Toast.LENGTH_SHORT).show()
            }
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
    if (showVipCallDialog) {
        AlertDialog(
            onDismissRequest = { showVipCallDialog = false },
            containerColor = LocalYugmColors.current.surfaceElevated,
            title = { Text("VIP Exclusive Feature", color = LocalYugmColors.current.textPrimary, fontWeight = FontWeight.Bold) },
            text = { Text("Voice and video calls in 1:1 chat are available only for VIP members. Upgrade to VIP to unlock this feature.", color = LocalYugmColors.current.textSecondary) },
            confirmButton = {
                TextButton(onClick = { showVipCallDialog = false; onOpenVip() }) {
                    Text("Go to VIP", color = Color(0xFFFFD166), fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showVipCallDialog = false }) {
                    Text("Not now", color = LocalYugmColors.current.textSecondary)
                }
            }
        )
    }

    if (confirmDeleteChat) {
        AlertDialog(
            onDismissRequest = { confirmDeleteChat = false },
            containerColor = LocalYugmColors.current.surfaceElevated,
            title = { Text("Delete this chat?", color = LocalYugmColors.current.textPrimary) },
            text = { Text("This removes the conversation from your inbox. The other person will still keep their copy.", color = LocalYugmColors.current.textSecondary) },
            confirmButton = { TextButton(onClick = { confirmDeleteChat = false; onDeleteConversation() }) { Text("Delete", color = LocalYugmColors.current.danger) } },
            dismissButton = { TextButton(onClick = { confirmDeleteChat = false }) { Text("Cancel", color = LocalYugmColors.current.textSecondary) } }
        )
    }

    if (showReportDialog) {
        ReportDialog(
            onDismiss = { showReportDialog = false },
            onSubmit = { category ->
                showReportDialog = false
                onReport(category)
            }
        )
    }
    forwardMessage?.let { selected ->
        AlertDialog(
            onDismissRequest = { forwardMessage = null },
            containerColor = LocalYugmColors.current.surfaceElevated,
            title = { Text("Forward message", color = LocalYugmColors.current.textPrimary) },
            text = {
                if (forwardTargets.isEmpty()) {
                    Text("Start a chat with someone before forwarding.", color = LocalYugmColors.current.textSecondary)
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
                                    Text(target.name.ifBlank { target.username.ifBlank { "User" } }, color = LocalYugmColors.current.textPrimary, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                                    if (target.username.isNotBlank()) Text("@${target.username}", color = LocalYugmColors.current.textSecondary, fontSize = 11.sp)
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = { TextButton(onClick = { forwardMessage = null }) { Text("Cancel", color = LocalYugmColors.current.textSecondary) } }
        )
    }
    infoMessage?.let { msg ->
        val mine = msg.senderId == currentUserId
        AlertDialog(
            onDismissRequest = { infoMessage = null },
            containerColor = LocalYugmColors.current.surfaceElevated,
            title = { Text("Message info", color = LocalYugmColors.current.textPrimary) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(if (mine) "Sent by you" else "Received", color = LocalYugmColors.current.textSecondary, fontSize = 12.sp)
                    Text("Time: ${com.yugm.app.feature.chat.formatMessageInfoTime(msg.createdAt)}", color = LocalYugmColors.current.textPrimary, fontSize = 13.sp)
                    if (mine) Text(if (msg.read) "Status: Seen" else "Status: Sent", color = if (msg.read) Color(0xFF69F0AE) else LocalYugmColors.current.textSecondary, fontSize = 13.sp, fontWeight = if (msg.read) FontWeight.SemiBold else FontWeight.Normal)
                    if (msg.isEdited) Text("Edited", color = LocalYugmColors.current.textSecondary, fontSize = 13.sp)
                    if (msg.forwarded) Text("Forwarded message", color = LocalYugmColors.current.textSecondary, fontSize = 13.sp)
                    if (msg.reactions.isNotEmpty()) {
                        val summary = msg.reactions
                            .groupBy { it.type }
                            .entries
                            .sortedByDescending { it.value.size }
                            .joinToString("  ") { (type, items) -> "${reactionEmoji(type)} ${items.size}" }
                        val mineReaction = currentUserId.takeIf { it.isNotBlank() }?.let { uid -> msg.reactions.firstOrNull { it.userId == uid }?.type }
                        Text("Reactions: $summary", color = LocalYugmColors.current.textSecondary, fontSize = 13.sp)
                        if (!mineReaction.isNullOrBlank()) Text("Your reaction: ${reactionEmoji(mineReaction)}", color = LocalYugmColors.current.textPrimary, fontSize = 13.sp)
                    }
                    msg.replyTo?.let { reply ->
                        Text("Reply to: ${reply.author.ifBlank { "message" }} — ${reply.text.ifBlank { "Media" }}", color = LocalYugmColors.current.textSecondary, fontSize = 13.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    }
                    if (msg.mediaType.isNotBlank()) Text("Type: ${msg.mediaType.lowercase().replaceFirstChar { it.uppercase() }}", color = LocalYugmColors.current.textSecondary, fontSize = 13.sp)
                }
            },
            confirmButton = { TextButton(onClick = { infoMessage = null }) { Text("Close", color = LocalYugmColors.current.secondary) } }
        )
    }
    if (showDeleteSelected) {
        val selectedCount = selectedMessageIds.size
        AlertDialog(
            onDismissRequest = { showDeleteSelected = false },
            containerColor = LocalYugmColors.current.surfaceElevated,
            title = { Text(if (selectedCount == 1) "Delete message?" else "Delete selected messages?", color = LocalYugmColors.current.textPrimary) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        "Choose how to delete ${if (selectedCount == 1) "this message" else "$selectedCount messages"}.",
                        color = LocalYugmColors.current.textSecondary
                    )
                    Text("• Delete for me: removes it from your chat only.", color = LocalYugmColors.current.textSecondary, fontSize = 12.sp)
                    if (selectedOwnIds.isNotEmpty()) {
                        Text("• Delete for everyone: removes ${if (selectedOwnIds.size == 1) "your selected message" else "${selectedOwnIds.size} of your selected messages"} for both people.", color = LocalYugmColors.current.textSecondary, fontSize = 12.sp)
                    }
                }
            },
            confirmButton = {
                Column(horizontalAlignment = Alignment.End) {
                    TextButton(onClick = {
                        onDeleteSelected(selectedMessageIds.toList(), "ME")
                        selectedMessageIds = emptySet()
                        showDeleteSelected = false
                    }) { Text("Delete for me", color = LocalYugmColors.current.danger) }
                    if (selectedOwnIds.isNotEmpty()) TextButton(onClick = {
                        onDeleteSelected(selectedOwnIds, "EVERYONE")
                        selectedMessageIds = emptySet()
                        showDeleteSelected = false
                    }) { Text(if (selectedOwnIds.size == 1) "Delete for everyone" else "Delete ${selectedOwnIds.size} for everyone", color = LocalYugmColors.current.danger) }
                }
            },
            dismissButton = { TextButton(onClick = { showDeleteSelected = false }) { Text("Cancel") } }
        )
    }
    val mediaPicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            scope.launch {
                val payload = withContext(Dispatchers.IO) {
                    val mime = context.contentResolver.getType(uri).orEmpty().ifBlank { "application/octet-stream" }
                    val name = runCatching {
                        context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                            val nameIndex = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                            if (cursor.moveToFirst() && nameIndex >= 0) cursor.getString(nameIndex) else null
                        }
                    }.getOrNull() ?: uri.lastPathSegment ?: "message-media"
                    val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                    Triple(bytes, mime, name)
                }
                val bytes = payload.first
                if (bytes != null && bytes.size <= 25 * 1024 * 1024) {
                    onAttachmentSelected(bytes, payload.second, payload.third)
                } else if (bytes != null) {
                    android.widget.Toast.makeText(context, "File is too large (max 25 MB)", android.widget.Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    var isRecordingVoice by remember { mutableStateOf(false) }
    var voiceRecorder by remember { mutableStateOf<android.media.MediaRecorder?>(null) }
    var voiceOutputFile by remember { mutableStateOf<java.io.File?>(null) }

    fun stopVoiceRecording(send: Boolean) {
        val recorder = voiceRecorder
        val file = voiceOutputFile
        voiceRecorder = null
        voiceOutputFile = null
        isRecordingVoice = false
        val recorded = runCatching {
            recorder?.apply {
                runCatching { stop() }
                runCatching { reset() }
                runCatching { release() }
            }
            file?.takeIf { it.exists() }
        }.getOrNull()
        if (send && recorded != null) {
            scope.launch {
                val bytes = withContext(Dispatchers.IO) { runCatching { recorded.readBytes() }.getOrNull() }
                if (bytes != null && bytes.isNotEmpty()) {
                    onAttachmentSelected(bytes, "audio/mp4", recorded.name.ifBlank { "voice-note.m4a" })
                } else {
                    android.widget.Toast.makeText(context, "Couldn't send voice note", android.widget.Toast.LENGTH_SHORT).show()
                }
                withContext(Dispatchers.IO) { runCatching { recorded.delete() } }
            }
        } else {
            scope.launch(Dispatchers.IO) { runCatching { recorded?.delete() } }
        }
    }

    fun startVoiceRecording() {
        if (isBlockedByMe || isSending) return
        val output = runCatching {
            java.io.File.createTempFile("voice_note_", ".m4a", context.cacheDir)
        }.getOrNull()
        if (output == null) {
            android.widget.Toast.makeText(context, "Couldn't start recording", android.widget.Toast.LENGTH_SHORT).show()
            return
        }
        val recorder = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
            android.media.MediaRecorder(context)
        } else {
            @Suppress("DEPRECATION")
            android.media.MediaRecorder()
        }
        val started = runCatching {
            recorder.setAudioSource(android.media.MediaRecorder.AudioSource.MIC)
            recorder.setOutputFormat(android.media.MediaRecorder.OutputFormat.MPEG_4)
            recorder.setAudioEncoder(android.media.MediaRecorder.AudioEncoder.AAC)
            recorder.setAudioEncodingBitRate(128000)
            recorder.setAudioSamplingRate(44100)
            recorder.setOutputFile(output.absolutePath)
            recorder.prepare()
            recorder.start()
            true
        }.getOrDefault(false)
        if (!started) {
            runCatching { recorder.release() }
            runCatching { output.delete() }
            android.widget.Toast.makeText(context, "Couldn't start recording", android.widget.Toast.LENGTH_SHORT).show()
            return
        }
        voiceRecorder = recorder
        voiceOutputFile = output
        isRecordingVoice = true
    }

    val audioPermissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) startVoiceRecording() else android.widget.Toast.makeText(context, "Microphone permission is required for voice notes", android.widget.Toast.LENGTH_SHORT).show()
    }

    DisposableEffect(Unit) {
        onDispose { stopVoiceRecording(send = false) }
    }

    DisposableEffect(partner?.id) {
        onDispose {
            runCatching { if (voicePlayer.isPlaying) voicePlayer.stop() }
            runCatching { voicePlayer.reset() }
            runCatching { voicePlayer.release() }
        }
    }

    LaunchedEffect(playingVoiceMessageId, isVoicePlaying) {
        while (isVoicePlaying && playingVoiceMessageId != null) {
            voiceProgressMs = runCatching { voicePlayer.currentPosition }.getOrDefault(voiceProgressMs)
            voiceDurationMs = runCatching { voicePlayer.duration.takeIf { it > 0 } ?: voiceDurationMs }.getOrDefault(voiceDurationMs)
            if (voiceDurationMs > 0 && voiceProgressMs >= voiceDurationMs - 150) {
                isVoicePlaying = false
                voiceProgressMs = voiceDurationMs
            }
            kotlinx.coroutines.delay(250)
        }
    }

    LaunchedEffect(highlightedMessageId) {
        if (highlightedMessageId != null) {
            kotlinx.coroutines.delay(2200)
            highlightedMessageId = null
        }
    }

    LaunchedEffect(messages.size, isLoadingMore, hasMoreHistory, pendingJumpMessageId) {
        val targetId = pendingJumpMessageId ?: return@LaunchedEffect
        if (isLoadingMore) return@LaunchedEffect
        val itemIndex = computeTimelineItemIndex(targetId)
        if (itemIndex != null) {
            pendingJumpMessageId = null
            highlightedMessageId = targetId
            val bounded = itemIndex.coerceIn(0, (listState.layoutInfo.totalItemsCount - 1).coerceAtLeast(0))
            listState.animateScrollToItem(bounded)
        } else if (hasMoreHistory) {
            onLoadOlder()
        } else {
            pendingJumpMessageId = null
            android.widget.Toast.makeText(context, "Message not found in loaded history.", android.widget.Toast.LENGTH_SHORT).show()
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
    DisposableEffect(Unit) {
        onDispose {
            if (typingSent) onTyping(false)
        }
    }
    // Scroll behavior is handled by the visible-messages auto-scroll effect above.

    Box(Modifier.fillMaxSize().background(LocalYugmColors.current.background)) {
        Column(Modifier.fillMaxSize().statusBarsPadding()) {
                GlassCard(
                    modifier = Modifier.fillMaxWidth(),
                    gradient = Brush.linearGradient(listOf(LocalYugmColors.current.surfaceElevated, LocalYugmColors.current.surface)),
                    borderGradient = Brush.horizontalGradient(listOf(LocalYugmColors.current.border, LocalYugmColors.current.border)),
                    cornerRadius = 0.dp,
                    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 10.dp)
                ) {
                    if (selectionMode) {
                        val selected = selectedMessages.firstOrNull()
                        Row(
                            Modifier.fillMaxWidth().padding(vertical = 2.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(2.dp)
                        ) {
                            IconButton(onClick = { selectedMessageIds = emptySet() }) {
                                Icon(Icons.Filled.Close, contentDescription = "Cancel selection", tint = LocalYugmColors.current.textSecondary)
                            }
                            Text(
                                "${selectedMessageIds.size} selected",
                                color = LocalYugmColors.current.textPrimary,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(start = 2.dp)
                            )
                            Spacer(Modifier.weight(1f))
                            if (selectedMessageIds.size == 1 && selected != null) {
                                if (selected.message.isNotBlank()) {
                                    IconButton(onClick = {
                                        val clipboard = context.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                                        clipboard.setPrimaryClip(android.content.ClipData.newPlainText("message", selected.message))
                                        android.widget.Toast.makeText(context, "Message copied", android.widget.Toast.LENGTH_SHORT).show()
                                        selectedMessageIds = emptySet()
                                    }) { Icon(Icons.Filled.ContentCopy, contentDescription = "Copy", tint = LocalYugmColors.current.textPrimary) }
                                }
                                IconButton(onClick = {
                                    forwardMessage = selected
                                    selectedMessageIds = emptySet()
                                }) { Icon(Icons.AutoMirrored.Filled.Forward, contentDescription = "Forward", tint = LocalYugmColors.current.textPrimary) }
                            }
                            IconButton(onClick = { showDeleteSelected = true }) {
                                Icon(Icons.Filled.Delete, contentDescription = "Delete", tint = LocalYugmColors.current.danger)
                            }
                        }
                    } else Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        LightChatAction(Icons.AutoMirrored.Filled.ArrowBack, stringResource(R.string.a11y_back), onClick = onBack)
                        Spacer(Modifier.width(10.dp))
                        Box(
                            Modifier.size(44.dp).clip(CircleShape).clickable(enabled = !partner?.id.isNullOrBlank(), role = Role.Button) {
                                partner?.id?.takeIf(String::isNotBlank)?.let(onOpenProfile)
                            }
                        ) {
                            Box(Modifier.fillMaxSize().border(2.dp, Brush.linearGradient(listOf(LocalYugmColors.current.primary, LocalYugmColors.current.secondary)), CircleShape).padding(2.dp)) {
                                Avatar(partner?.name?.take(1) ?: "?", 38, partner?.avatar, partner?.activeCosmetics ?: ActiveCosmetics(), accessibilityLabel = stringResource(R.string.a11y_profile_picture, partner?.name ?: defaultMatchName))
                            }
                            if (partner?.isOnline == true) {
                                Box(
                                    Modifier
                                        .align(Alignment.BottomEnd)
                                        .size(12.dp)
                                        .clip(CircleShape)
                                        .background(LocalYugmColors.current.success)
                                        .border(2.dp, LocalYugmColors.current.surfaceElevated, CircleShape)
                                )
                            }
                        }
                        Column(Modifier.weight(1f).padding(start = 10.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(partner?.name ?: "Loading match…", color = LocalYugmColors.current.textPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Spacer(Modifier.width(4.dp))
                                Box(
                                    Modifier
                                        .size(16.dp)
                                        .clip(CircleShape)
                                        .background(Brush.linearGradient(listOf(LocalYugmColors.current.secondary, LocalYugmColors.current.primary))),
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
                                        .background(if (partner?.isOnline == true) LocalYugmColors.current.success else LocalYugmColors.current.textSecondary)
                                )
                                Text(
                                    if (partner?.isOnline == true) "Online" else partner?.username?.let { "@$it" } ?: "Your conversation",
                                    color = if (partner?.isOnline == true) LocalYugmColors.current.success else LocalYugmColors.current.textSecondary,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                                if (isMuted) {
                                    Text("·", color = LocalYugmColors.current.textSecondary, fontSize = 12.sp)
                                    Text("🔕 Muted", color = LocalYugmColors.current.textSecondary, fontSize = 11.sp, maxLines = 1)
                                }
                                if (isBlockedByMe) {
                                    Text("·", color = LocalYugmColors.current.textSecondary, fontSize = 12.sp)
                                    Text("Blocked", color = LocalYugmColors.current.danger, fontSize = 11.sp, maxLines = 1, fontWeight = FontWeight.SemiBold)
                                }
                            }
                        }
                        val callsLockedForVip = !isCurrentUserVip
                        LightChatAction(
                            Icons.Filled.Call,
                            when {
                                startingCallType == RoomType.Voice -> "Starting voice call"
                                callsLockedForVip -> "Voice call (VIP only)"
                                else -> "Start voice call"
                            },
                            onClick = { if (callsLockedForVip) showVipCallDialog = true else onAudioCall() },
                            enabled = !isBlockedByMe && startingCallType == null,
                            loading = startingCallType == RoomType.Voice,
                            locked = callsLockedForVip
                        )
                        Spacer(Modifier.width(6.dp))
                        LightChatAction(
                            Icons.Filled.Videocam,
                            when {
                                startingCallType == RoomType.Video -> "Starting video call"
                                callsLockedForVip -> "Video call (VIP only)"
                                else -> "Start video call"
                            },
                            onClick = { if (callsLockedForVip) showVipCallDialog = true else onVideoCall() },
                            enabled = !isBlockedByMe && startingCallType == null,
                            loading = startingCallType == RoomType.Video,
                            locked = callsLockedForVip
                        )
                        Spacer(Modifier.width(6.dp))
                        LightChatAction(Icons.Filled.MoreVert, stringResource(R.string.a11y_conversation_options), onClick = { showMore = !showMore })
                    }
                }

                if (showMore) {
                    Row(Modifier.fillMaxWidth().background(LocalYugmColors.current.surfaceElevated.copy(alpha = 0.97f)).padding(horizontal = 12.dp, vertical = 6.dp), horizontalArrangement = Arrangement.End) {
                        Text("Profile", color = LocalYugmColors.current.textPrimary, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.sizeIn(minHeight = 48.dp).clickable(enabled = !partner?.id.isNullOrBlank()) { showMore = false; partner?.id?.takeIf(String::isNotBlank)?.let(onOpenProfile) }.padding(10.dp))
                        Text("Search", color = LocalYugmColors.current.textPrimary, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.sizeIn(minHeight = 48.dp).clickable {
                            showMore = false
                            if (searchVisible) { searchVisible = false; searchQuery = "" } else searchVisible = true
                        }.padding(10.dp))
                        Text(if (isMuted) "Unmute" else "Mute", color = LocalYugmColors.current.textPrimary, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.sizeIn(minHeight = 48.dp).clickable { showMore = false; onMute(!isMuted) }.padding(10.dp))
                        Text("Report", color = LocalYugmColors.current.danger, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.sizeIn(minHeight = 48.dp).clickable(role = Role.Button, onClickLabel = stringResource(R.string.a11y_report_conversation)) { showMore = false; showReportDialog = true }.padding(10.dp))
                        Text(if (isBlockedByMe) "Unblock" else "Block", color = if (isBlockedByMe) LocalYugmColors.current.textPrimary else LocalYugmColors.current.danger, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.sizeIn(minHeight = 48.dp).clickable(role = Role.Button, onClickLabel = if (isBlockedByMe) "Unblock user" else stringResource(R.string.a11y_block_person)) { showMore = false; onToggleBlock() }.padding(10.dp))
                        Text("Delete chat", color = LocalYugmColors.current.danger, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.sizeIn(minHeight = 48.dp).clickable { showMore = false; confirmDeleteChat = true }.padding(10.dp))
                    }
                }
                if (searchVisible) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(LocalYugmColors.current.surfaceElevated.copy(alpha = 0.98f))
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
                                textStyle = androidx.compose.ui.text.TextStyle(color = LocalYugmColors.current.textPrimary, fontSize = 14.sp),
                                cursorBrush = androidx.compose.ui.graphics.SolidColor(LocalYugmColors.current.primary),
                                modifier = Modifier.weight(1f),
                                decorationBox = { inner ->
                                    Box {
                                        if (searchQuery.isBlank()) Text("Search in this chat…", color = LocalYugmColors.current.textSecondary, fontSize = 14.sp)
                                        inner()
                                    }
                                }
                            )
                            if (searchQuery.isNotBlank()) {
                                Spacer(Modifier.width(8.dp))
                                Text(
                                    "Clear",
                                    color = LocalYugmColors.current.textSecondary,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium,
                                    modifier = Modifier
                                        .clip(CircleShape)
                                        .clickable(role = Role.Button, onClickLabel = "Clear search") { searchQuery = ""; onSearch("") }
                                        .padding(horizontal = 8.dp, vertical = 4.dp)
                                )
                            }
                            Spacer(Modifier.width(4.dp))
                            Text(
                                "Close",
                                color = LocalYugmColors.current.primary,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                modifier = Modifier
                                    .clip(CircleShape)
                                    .clickable(role = Role.Button, onClickLabel = "Close search") {
                                        searchVisible = false
                                        searchQuery = ""
                                        onSearch("")
                                    }
                                    .padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                    }
                }

                Box(Modifier.weight(1f).fillMaxWidth()) {
                    if (loading && visibleMessages.isEmpty()) {
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                androidx.compose.material3.CircularProgressIndicator(color = LocalYugmColors.current.secondary)
                                Text("Loading conversation…", color = LocalYugmColors.current.textSecondary, fontSize = 13.sp, modifier = Modifier.padding(top = 12.dp))
                            }
                        }
                    } else {
                        LazyColumn(
                            state = listState,
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(start = 14.dp, end = 14.dp, top = 12.dp, bottom = 20.dp),
                            verticalArrangement = Arrangement.spacedBy(2.dp)
                        ) {
                            if (isBlockedByMe) item {
                                Row(
                                    Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(16.dp))
                                        .background(Color(0xFF2A1020))
                                        .border(1.dp, LocalYugmColors.current.danger.copy(alpha = 0.45f), RoundedCornerShape(16.dp))
                                        .padding(horizontal = 14.dp, vertical = 12.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text("🚫", fontSize = 18.sp)
                                    Column(Modifier.padding(start = 10.dp).weight(1f)) {
                                        Text("You blocked this user", color = LocalYugmColors.current.textPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                                        Text("Unblock to send messages and calls again.", color = LocalYugmColors.current.textSecondary, fontSize = 11.sp, lineHeight = 15.sp)
                                    }
                                    Text("Unblock", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.clip(CircleShape).background(LocalYugmColors.current.danger.copy(alpha = 0.85f)).clickable(role = Role.Button, onClickLabel = "Unblock user") { onToggleBlock() }.padding(horizontal = 12.dp, vertical = 8.dp))
                                }
                            }
                            if (messages.isEmpty() && isMatched) item { MatchedBanner(partner?.name ?: "your match") }
                            if (showSafety) item {
                                SafetyTip(onDismiss = {
                                    showSafety = false
                                    safetyKey?.let { safetyPrefs.edit().putBoolean(it, true).apply() }
                                })
                            }
                            relationship?.let { bond -> item { BondStrip(bond) } }
                            if (searchQuery.isBlank() && visibleMessages.isNotEmpty() && hasMoreHistory) item {
                                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                                    Text(
                                        text = if (isLoadingMore) "Loading earlier messages…" else "Load earlier messages",
                                        color = if (isLoadingMore) LocalYugmColors.current.textSecondary else LocalYugmColors.current.textPrimary,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        modifier = Modifier
                                            .clip(CircleShape)
                                            .background(Brush.horizontalGradient(listOf(LocalYugmColors.current.surfaceElevated, LocalYugmColors.current.secondary.copy(alpha = 0.18f))))
                                            .border(1.dp, Brush.horizontalGradient(listOf(LocalYugmColors.current.border, LocalYugmColors.current.secondary.copy(alpha = 0.45f))), CircleShape)
                                            .clickable(enabled = !isLoadingMore, role = Role.Button, onClickLabel = "Load earlier messages", onClick = onLoadOlder)
                                            .padding(horizontal = 16.dp, vertical = 9.dp)
                                    )
                                }
                            }
                            if (error.isNotBlank()) item {
                                Text("$error · Retry", color = LocalYugmColors.current.primary, fontSize = 12.sp, modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite }.clickable(role = Role.Button, onClickLabel = stringResource(R.string.a11y_retry_messages), onClick = onRetry).padding(vertical = 12.dp))
                            }
                            if (searchQuery.length >= 2 && visibleMessages.isNotEmpty()) item {
                                Text(
                                    "Tap a result to jump to it in the conversation",
                                    color = LocalYugmColors.current.textSecondary,
                                    fontSize = 12.sp,
                                    modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 4.dp),
                                    textAlign = androidx.compose.ui.text.style.TextAlign.Center
                                )
                            }
                            if (searchQuery.length >= 2 && hasMoreSearchResults) item {
                                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                                    Text(
                                        text = if (isLoadingMoreSearch) "Loading more results…" else "Load more results",
                                        color = if (isLoadingMoreSearch) LocalYugmColors.current.textSecondary else LocalYugmColors.current.textPrimary,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        modifier = Modifier
                                            .clip(CircleShape)
                                            .background(Brush.horizontalGradient(listOf(LocalYugmColors.current.surfaceElevated, LocalYugmColors.current.secondary.copy(alpha = 0.14f))))
                                            .border(1.dp, Brush.horizontalGradient(listOf(LocalYugmColors.current.border, LocalYugmColors.current.secondary.copy(alpha = 0.35f))), CircleShape)
                                            .clickable(enabled = !isLoadingMoreSearch, role = Role.Button, onClickLabel = "Load more results", onClick = onLoadMoreSearch)
                                            .padding(horizontal = 16.dp, vertical = 9.dp)
                                    )
                                }
                            }
                            if (searchQuery.isNotBlank() && visibleMessages.isEmpty()) item {
                                Text("No matching messages", color = LocalYugmColors.current.textSecondary, fontSize = 13.sp, modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 28.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                            }
                            if (visibleMessages.isEmpty() && !loading && error.isBlank() && searchQuery.isBlank()) {
                                item {
                                    Column(Modifier.fillParentMaxHeight(0.62f).fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                                        EmptyConversationState(partner?.name ?: "your match")
                                        Row(Modifier.padding(top = 18.dp).horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                            listOf("Hello!", "Hi~", "Good day!").forEach { greeting ->
                                                Text(
                                                    greeting,
                                                    color = LocalYugmColors.current.textPrimary,
                                                    fontSize = 14.sp,
                                                    modifier = Modifier
                                                        .clip(CircleShape)
                                                        .background(LocalYugmColors.current.surfaceElevated)
                                                        .border(1.dp, LocalYugmColors.current.border, CircleShape)
                                                        .clickable(role = Role.Button, onClickLabel = "Send $greeting") { onSend(greeting, {}, {}) }
                                                        .padding(horizontal = 18.dp, vertical = 11.dp)
                                                )
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
                                val inSearchResults = searchQuery.length >= 2
                                val swipeOffset = remember(message.id) { Animatable(0f) }
                                var swipeReplyTriggered by remember(message.id) { mutableStateOf(false) }
                                Box(
                                    Modifier
                                        // Tight inside a sender group (2dp), roomier between
                                        // different senders (8dp) like WhatsApp/Telegram.
                                        .padding(
                                            top = if (groupedWithPrev) 1.dp else 6.dp,
                                            bottom = if (groupedWithNext) 1.dp else 2.dp
                                        )
                                        .pointerInput(message.id, selectionMode, inSearchResults) {
                                            if (selectionMode || inSearchResults) return@pointerInput
                                            detectHorizontalDragGestures(
                                                onDragEnd = {
                                                    scope.launch {
                                                        if (swipeOffset.value >= 72f && !swipeReplyTriggered) {
                                                            swipeReplyTriggered = true
                                                            replyTarget = message
                                                            editingTarget = null
                                                            draft = ""
                                                            selectedMessageIds = emptySet()
                                                        }
                                                        swipeOffset.animateTo(0f)
                                                        swipeReplyTriggered = false
                                                    }
                                                },
                                                onDragCancel = {
                                                    scope.launch {
                                                        swipeOffset.animateTo(0f)
                                                        swipeReplyTriggered = false
                                                    }
                                                },
                                                onHorizontalDrag = { _, dragAmount ->
                                                    val next = (swipeOffset.value + dragAmount).coerceIn(0f, 96f)
                                                    scope.launch { swipeOffset.snapTo(next) }
                                                }
                                            )
                                        }
                                ) {
                                    if (swipeOffset.value > 8f) {
                                        Icon(
                                            Icons.AutoMirrored.Filled.Reply,
                                            contentDescription = null,
                                            tint = LocalYugmColors.current.secondary.copy(alpha = (swipeOffset.value / 72f).coerceIn(0.25f, 1f)),
                                            modifier = Modifier.align(Alignment.CenterStart).padding(start = 4.dp)
                                        )
                                    }
                                    Box(Modifier.offset { androidx.compose.ui.unit.IntOffset(swipeOffset.value.roundToInt(), 0) }) {
                                        MessageBubble(
                                            message = message,
                                            mine = mine,
                                            selected = message.id in selectedMessageIds,
                                            highlighted = highlightedMessageId == message.id,
                                            bubbleId = myActiveCosmetics.chatBubble,
                                            partner = partner,
                                            currentUserId = currentUserId,
                                            myActiveCosmetics = myActiveCosmetics,
                                            showIncomingAvatar = !mine && !groupedWithNext,
                                            showOutgoingAvatar = mine && !groupedWithNext,
                                            groupedWithPrev = groupedWithPrev,
                                            groupedWithNext = groupedWithNext,
                                            playingVoiceMessageId = playingVoiceMessageId,
                                            isVoicePlaying = isVoicePlaying,
                                            isVoicePreparing = isVoicePreparing,
                                            voiceProgressMs = voiceProgressMs,
                                            voiceDurationMs = voiceDurationMs,
                                            startingCallType = startingCallType,
                                            isBlockedByMe = isBlockedByMe,
                                            onReact = { bounds ->
                                                when {
                                                    selectionMode -> toggleSelection(message.id)
                                                    inSearchResults -> jumpToMessage(message)
                                                    message.id.isNotBlank() -> {
                                                        targetMessageBounds = bounds
                                                        optionsDialogTarget = null
                                                        reactDialogTarget = message
                                                    }
                                                }
                                            },
                                            onLongPress = { bounds ->
                                                if (message.id.isBlank()) return@MessageBubble
                                                if (selectionMode) {
                                                    toggleSelection(message.id)
                                                } else {
                                                    targetMessageBounds = bounds
                                                    reactDialogTarget = null
                                                    optionsDialogTarget = message
                                                }
                                            },
                                            onOpenImage = { url -> imageViewerUrl = url },
                                            onToggleVoice = { toggleVoicePlayback(message) },
                                            onSeekVoice = { pos -> seekVoicePlayback(message.id, pos) },
                                            onAudioCall = onAudioCall,
                                            onVideoCall = onVideoCall
                                        )
                                    }
                                }
                            }
                            if (isPartnerTyping) item {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Avatar(partner?.name?.take(1) ?: "?", 30, partner?.avatar, partner?.activeCosmetics ?: com.yugm.app.core.model.ActiveCosmetics(), accessibilityLabel = stringResource(R.string.a11y_profile_picture, partner?.name ?: defaultMatchName))
                                    Column(Modifier.padding(start = 8.dp)) {
                                        TypingBubble()
                                        Text("${partner?.name ?: "Your match"} is typing…", color = LocalYugmColors.current.textSecondary, fontSize = 10.sp)
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
                                .background(Brush.linearGradient(listOf(LocalYugmColors.current.secondary, LocalYugmColors.current.primary)))
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
                            .background(LocalYugmColors.current.surfaceElevated.copy(alpha = 0.98f))
                            .horizontalScroll(rememberScrollState())
                            .padding(horizontal = 14.dp, vertical = 10.dp),
                        horizontalArrangement = Arrangement.spacedBy(14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        listOf("😊", "😂", "❤️", "✨", "🔥", "👋", "🎧", "🌙", "😍", "🥳").forEach { emoji ->
                            val stickerLabel = "Send sticker $emoji"
                            Box(
                                Modifier
                                    .sizeIn(minWidth = 42.dp, minHeight = 42.dp)
                                    .clip(CircleShape)
                                    .background(LocalYugmColors.current.surface.copy(alpha = 0.55f))
                                    .border(1.dp, LocalYugmColors.current.border.copy(alpha = 0.6f), CircleShape)
                                    .semantics { contentDescription = stickerLabel }
                                    .clickable(
                                        enabled = !isBlockedByMe && !isSending,
                                        role = Role.Button,
                                        onClickLabel = stickerLabel
                                    ) {
                                        showEmojiBar = false
                                        onSend(emoji, {}, {})
                                    },
                                contentAlignment = Alignment.Center
                            ) {
                                Text(emoji, fontSize = 22.sp)
                            }
                        }
                    }
                }

                GlassCard(
                    modifier = Modifier.fillMaxWidth().navigationBarsPadding().imePadding(),
                    gradient = Brush.linearGradient(listOf(LocalYugmColors.current.surfaceElevated, LocalYugmColors.current.surface)),
                    borderGradient = Brush.horizontalGradient(listOf(LocalYugmColors.current.border, LocalYugmColors.current.border)),
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
                            Box(Modifier.width(3.dp).height(28.dp).clip(CircleShape).background(Brush.verticalGradient(listOf(LocalYugmColors.current.secondary, LocalYugmColors.current.primary))))
                            Column(Modifier.weight(1f).padding(start = 10.dp, end = 8.dp)) {
                                Text(
                                    if (editingTarget != null) "Editing message" else "Replying to ${contextMessage.sender?.name ?: "message"}",
                                    color = LocalYugmColors.current.textPrimary,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                                Text(
                                    contextMessage.message.ifBlank { "Media message" },
                                    color = LocalYugmColors.current.textSecondary,
                                    fontSize = 11.sp,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                            Text("Cancel", color = LocalYugmColors.current.primary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.clickable(role = Role.Button) { replyTarget = null; editingTarget = null; draft = "" }.padding(horizontal = 6.dp, vertical = 4.dp))
                        }
                    }
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        LightChatAction(Icons.Filled.SentimentSatisfiedAlt, stringResource(R.string.a11y_toggle_emoji_picker), onClick = { showEmojiBar = !showEmojiBar })
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
                                textStyle = androidx.compose.ui.text.TextStyle(color = LocalYugmColors.current.textPrimary, fontSize = 14.sp),
                                cursorBrush = androidx.compose.ui.graphics.SolidColor(LocalYugmColors.current.primary),
                                modifier = Modifier.weight(1f).semantics { contentDescription = messageFieldLabel },
                                decorationBox = { inner ->
                                    Box {
                                        if (draft.isBlank()) Text(if (editingTarget != null) "Edit message…" else if (replyTarget != null) "Write a reply…" else "Type a message...", color = LocalYugmColors.current.textSecondary, fontSize = 14.sp)
                                        inner()
                                    }
                                }
                            )
                            Spacer(Modifier.width(6.dp))
                            Box(
                                Modifier
                                    .sizeIn(minWidth = 36.dp, minHeight = 36.dp)
                                    .semantics { contentDescription = "Attach media" }
                                    .clickable(role = Role.Button, onClickLabel = "Attach media") { mediaPicker.launch(arrayOf("image/*", "video/*")) },
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(Icons.Filled.AttachFile, contentDescription = null, tint = LocalYugmColors.current.textSecondary, modifier = Modifier.size(19.dp))
                            }
                            Spacer(Modifier.width(4.dp))
                            Box(
                                Modifier
                                    .sizeIn(minWidth = 36.dp, minHeight = 36.dp)
                                    .semantics { contentDescription = if (isRecordingVoice) "Stop and send voice note" else "Record voice note" }
                                    .clickable(role = Role.Button, onClickLabel = if (isRecordingVoice) "Stop and send voice note" else "Record voice note") {
                                        if (isRecordingVoice) {
                                            stopVoiceRecording(send = true)
                                        } else {
                                            val granted = androidx.core.content.ContextCompat.checkSelfPermission(context, android.Manifest.permission.RECORD_AUDIO) == android.content.pm.PackageManager.PERMISSION_GRANTED
                                            if (granted) startVoiceRecording() else audioPermissionLauncher.launch(android.Manifest.permission.RECORD_AUDIO)
                                        }
                                    },
                                contentAlignment = Alignment.Center
                            ) {
                                Text(if (isRecordingVoice) "⏹️" else "🎤", fontSize = 16.sp)
                            }
                            Spacer(Modifier.width(4.dp))
                            Box(
                                Modifier
                                    .sizeIn(minWidth = 36.dp, minHeight = 36.dp)
                                    .semantics { contentDescription = "Send gift" }
                                    .clickable(role = Role.Button, onClickLabel = "Send gift") { showGiftSheet = true },
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(Icons.Filled.CardGiftcard, contentDescription = null, tint = LocalYugmColors.current.textSecondary, modifier = Modifier.size(19.dp))
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
        imageViewerUrl?.let { url ->
            Dialog(
                onDismissRequest = { imageViewerUrl = null },
                properties = DialogProperties(usePlatformDefaultWidth = false)
            ) {
                var scale by remember(url) { mutableFloatStateOf(1f) }
                var offsetX by remember(url) { mutableFloatStateOf(0f) }
                var offsetY by remember(url) { mutableFloatStateOf(0f) }
                Box(
                    Modifier
                        .fillMaxSize()
                        .background(Color.Black.copy(alpha = 0.96f))
                ) {
                    AsyncImage(
                        model = url,
                        contentDescription = "Photo",
                        contentScale = ContentScale.Fit,
                        modifier = Modifier
                            .fillMaxSize()
                            .pointerInput(url) {
                                detectTransformGestures { _, pan, zoom, _ ->
                                    scale = (scale * zoom).coerceIn(1f, 4f)
                                    if (scale > 1f) {
                                        offsetX += pan.x
                                        offsetY += pan.y
                                    } else {
                                        offsetX = 0f
                                        offsetY = 0f
                                    }
                                }
                            }
                            .graphicsLayer(
                                scaleX = scale,
                                scaleY = scale,
                                translationX = offsetX,
                                translationY = offsetY
                            )
                    )
                    Row(
                        Modifier
                            .align(Alignment.TopEnd)
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            Modifier
                                .clip(CircleShape)
                                .background(Color.White.copy(alpha = 0.14f))
                                .clickable(role = Role.Button, onClickLabel = "Open image externally") { openChatMedia(context, url) }
                                .padding(horizontal = 12.dp, vertical = 10.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("Open", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                        }
                        Box(
                            Modifier
                                .clip(CircleShape)
                                .background(Color.White.copy(alpha = 0.14f))
                                .clickable(role = Role.Button, onClickLabel = "Close image viewer") { imageViewerUrl = null }
                                .padding(10.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Filled.Close, contentDescription = null, tint = Color.White)
                        }
                    }
                }
            }
        }
        if (showGiftSheet) {
            ModalBottomSheet(onDismissRequest = { showGiftSheet = false }, containerColor = LocalYugmColors.current.surface) {
                Column(Modifier.fillMaxWidth().padding(20.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Send a Gift", color = LocalYugmColors.current.textPrimary, fontSize = 20.sp, fontWeight = FontWeight.Black, modifier = Modifier.weight(1f))
                        Text("● $balance", color = Color(0xFFFFC52F), fontWeight = FontWeight.Bold)
                    }
                    if (gifts.isEmpty()) {
                        Text(
                            "No gifts available right now.",
                            color = LocalYugmColors.current.textSecondary,
                            fontSize = 13.sp,
                            modifier = Modifier.padding(top = 14.dp)
                        )
                    } else {
                        Row(Modifier.padding(top = 14.dp).horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            gifts.forEach { gift ->
                                Column(
                                    Modifier.width(105.dp).height(132.dp).clip(RoundedCornerShape(18.dp)).background(LocalYugmColors.current.background).border(1.dp, LocalYugmColors.current.border, RoundedCornerShape(18.dp)).clickable(enabled = balance >= gift.price) { onGift(gift); showGiftSheet = false }.padding(10.dp),
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
                                    Text(gift.name, color = LocalYugmColors.current.textPrimary, fontSize = 11.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    Text("● ${gift.price}", color = if (balance >= gift.price) Color(0xFFFFC52F) else LocalYugmColors.current.danger, fontSize = 10.sp)
                                }
                            }
                        }
                    }
                    Spacer(Modifier.height(24.dp))
                }
            }
        }
    }

    reactDialogTarget?.let { target ->
        val bounds = targetMessageBounds
        var overlayOrigin by remember(target.id, bounds) { mutableStateOf(androidx.compose.ui.geometry.Offset.Zero) }
        BoxWithConstraints(
            Modifier
                .fillMaxSize()
                .onGloballyPositioned { overlayOrigin = it.boundsInRoot().topLeft }
                .background(Color.Black.copy(alpha = 0.4f))
                .clickable(role = Role.Button, onClickLabel = "Dismiss") { reactDialogTarget = null },
        ) {
            val screenWidth = maxWidth
            val screenHeight = maxHeight
            val density = androidx.compose.ui.platform.LocalDensity.current
            val localLeftPx = (bounds?.left ?: 0f) - overlayOrigin.x
            val localRightPx = (bounds?.right ?: 0f) - overlayOrigin.x
            val localTopPx = (bounds?.top ?: 0f) - overlayOrigin.y
            val bubbleLeft = if (bounds != null) with(density) { localLeftPx.toDp() } else 20.dp
            val bubbleRight = if (bounds != null) with(density) { localRightPx.toDp() } else (screenWidth - 20.dp)
            val bubbleTop = if (bounds != null) with(density) { localTopPx.toDp() } else 200.dp
            val barWidth = 260.dp
            val barHeight = 52.dp
            val edgeMargin = 8.dp
            val bubbleGap = 2.dp

            val preferredAboveY = bubbleTop - barHeight - bubbleGap
            val maxY = (screenHeight - barHeight - edgeMargin).coerceAtLeast(edgeMargin)
            val offsetY = preferredAboveY.coerceIn(edgeMargin, maxY)

            val bubbleCenterX = (bubbleLeft + bubbleRight) / 2
            val idealX = bubbleCenterX - (barWidth / 2)
            val offsetX = idealX.coerceIn(edgeMargin, (screenWidth - barWidth - edgeMargin).coerceAtLeast(edgeMargin))

            Box(
                modifier = Modifier
                    .offset(x = offsetX, y = offsetY)
            ) {
                Row(
                    modifier = Modifier
                        .width(barWidth)
                        .clip(RoundedCornerShape(32.dp))
                        .background(LocalYugmColors.current.surfaceElevated)
                        .border(1.dp, LocalYugmColors.current.border, RoundedCornerShape(32.dp))
                        .padding(horizontal = 10.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    listOf(
                        "❤️" to "heart",
                        "🔥" to "fire",
                        "😂" to "laugh",
                        "👏" to "clap",
                        "😮" to "wow",
                        "👑" to "crown"
                    ).forEach { (emoji, type) ->
                        val myReaction = currentUserId.takeIf { it.isNotBlank() }?.let { uid -> target.reactions.firstOrNull { it.userId == uid }?.type }
                        val isSelected = myReaction == type
                        Box(
                            modifier = Modifier
                                .size(34.dp)
                                .clip(CircleShape)
                                .background(if (isSelected) LocalYugmColors.current.secondary.copy(alpha = 0.3f) else Color.Transparent)
                                .clickable(role = Role.Button, onClickLabel = "React with $emoji") {
                                    onReactMessage(target, type)
                                    reactDialogTarget = null
                                },
                            contentAlignment = Alignment.Center
                        ) {
                            Text(emoji, fontSize = 18.sp)
                        }
                    }
                }
            }
        }
    }
    optionsDialogTarget?.let { target ->
        val mine = target.senderId == currentUserId
        val bounds = targetMessageBounds
        var overlayOrigin by remember(target.id, bounds) { mutableStateOf(androidx.compose.ui.geometry.Offset.Zero) }
        BoxWithConstraints(
            Modifier
                .fillMaxSize()
                .onGloballyPositioned { overlayOrigin = it.boundsInRoot().topLeft }
                .background(Color.Black.copy(alpha = 0.4f))
                .clickable(role = Role.Button, onClickLabel = "Dismiss") { optionsDialogTarget = null },
        ) {
            val screenWidth = maxWidth
            val screenHeight = maxHeight
            val density = androidx.compose.ui.platform.LocalDensity.current
            val localLeftPx = (bounds?.left ?: 0f) - overlayOrigin.x
            val localRightPx = (bounds?.right ?: 0f) - overlayOrigin.x
            val localTopPx = (bounds?.top ?: 0f) - overlayOrigin.y
            val localBottomPx = (bounds?.bottom ?: 0f) - overlayOrigin.y
            val bubbleLeft = if (bounds != null) with(density) { localLeftPx.toDp() } else 20.dp
            val bubbleRight = if (bounds != null) with(density) { localRightPx.toDp() } else (screenWidth - 20.dp)
            val bubbleTop = if (bounds != null) with(density) { localTopPx.toDp() } else 200.dp
            val bubbleBottom = if (bounds != null) with(density) { localBottomPx.toDp() } else 250.dp
            val cardWidth = 230.dp
            val cardHeight = 360.dp
            val edgeMargin = 8.dp
            val bubbleGap = 2.dp

            val preferredBelowY = bubbleBottom + bubbleGap
            val preferredAboveY = bubbleTop - cardHeight - bubbleGap
            val maxY = (screenHeight - cardHeight - edgeMargin).coerceAtLeast(edgeMargin)
            val offsetY = if (preferredBelowY <= maxY) preferredBelowY else preferredAboveY.coerceIn(edgeMargin, maxY)

            val idealX = if (mine) bubbleRight - cardWidth else bubbleLeft
            val offsetX = idealX.coerceIn(edgeMargin, (screenWidth - cardWidth - edgeMargin).coerceAtLeast(edgeMargin))

            Box(
                modifier = Modifier
                    .offset(x = offsetX, y = offsetY)
            ) {
                Column(
                    modifier = Modifier
                        .width(cardWidth)
                        .clip(RoundedCornerShape(16.dp))
                        .background(LocalYugmColors.current.surfaceElevated)
                        .border(1.dp, LocalYugmColors.current.border, RoundedCornerShape(16.dp))
                        .padding(vertical = 4.dp)
                ) {
                    CompactOptionRow(icon = Icons.Filled.Info, label = "Info") {
                        optionsDialogTarget = null
                        infoMessage = target
                    }
                    CompactOptionRow(icon = Icons.Filled.ContentCopy, label = "Copy") {
                        optionsDialogTarget = null
                        if (target.message.isNotBlank()) {
                            val clipboard = context.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                            clipboard.setPrimaryClip(android.content.ClipData.newPlainText("message", target.message))
                            android.widget.Toast.makeText(context, "Message copied", android.widget.Toast.LENGTH_SHORT).show()
                        }
                    }
                    if (mine && target.canStillEdit()) {
                        CompactOptionRow(icon = Icons.Filled.Edit, label = "Edit") {
                            optionsDialogTarget = null
                            editingTarget = target
                            replyTarget = null
                            draft = target.message
                        }
                    }
                    CompactOptionRow(icon = Icons.AutoMirrored.Filled.Reply, label = "Reply") {
                        optionsDialogTarget = null
                        replyTarget = target
                        editingTarget = null
                        draft = ""
                    }
                    CompactOptionRow(icon = Icons.Filled.CheckCircle, label = "Select") {
                        optionsDialogTarget = null
                        selectedMessageIds = if (target.id in selectedMessageIds) selectedMessageIds else selectedMessageIds + target.id
                    }
                    CompactOptionRow(icon = Icons.AutoMirrored.Filled.Forward, label = "Forward") {
                        optionsDialogTarget = null
                        forwardMessage = target
                    }

                    CompactOptionRow(icon = Icons.Filled.Delete, label = "Delete", tint = LocalYugmColors.current.danger) {
                        optionsDialogTarget = null
                        selectedMessageIds = setOf(target.id)
                        showDeleteSelected = true
                    }
                }
            }
        }
    }
}

@Composable
private fun LightChatAction(
    icon: ImageVector,
    label: String,
    onClick: () -> Unit,
    enabled: Boolean = true,
    loading: Boolean = false,
    locked: Boolean = false
) {
    Box(
        Modifier.size(44.dp).clip(CircleShape).background(if (enabled) LocalYugmColors.current.surfaceElevated else LocalYugmColors.current.surfaceElevated.copy(alpha = 0.55f))
            .semantics { contentDescription = label }
            .clickable(enabled = enabled && !loading, role = Role.Button, onClickLabel = label, onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        if (loading) {
            androidx.compose.material3.CircularProgressIndicator(
                modifier = Modifier.size(18.dp),
                color = LocalYugmColors.current.textPrimary,
                strokeWidth = 2.dp
            )
        } else {
            Icon(icon, contentDescription = null, tint = if (enabled) LocalYugmColors.current.textPrimary else LocalYugmColors.current.textSecondary, modifier = Modifier.size(20.dp))
            if (locked) {
                Box(
                    Modifier
                        .align(Alignment.BottomEnd)
                        .offset(x = 2.dp, y = 2.dp)
                        .size(16.dp)
                        .clip(CircleShape)
                        .background(LocalYugmColors.current.surface)
                        .border(1.dp, LocalYugmColors.current.border, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Filled.Lock,
                        contentDescription = null,
                        tint = Color(0xFFFFD166),
                        modifier = Modifier.size(10.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun ReportDialog(onDismiss: () -> Unit, onSubmit: (String) -> Unit) {
    var selected by remember { mutableStateOf("harassment") }
    val categories = listOf(
        "harassment" to "Harassment",
        "spam" to "Spam",
        "nudity" to "Nudity",
        "hate_speech" to "Hate speech",
        "violence" to "Violence",
        "scam" to "Scam",
        "impersonation" to "Impersonation",
        "other" to "Other"
    )
    androidx.compose.material3.AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = LocalYugmColors.current.surfaceElevated,
        title = { Text("Report this conversation", color = LocalYugmColors.current.textPrimary) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Pick a reason. Our team reviews every report.", color = LocalYugmColors.current.textSecondary, fontSize = 12.sp)
                categories.forEach { (value, label) ->
                    Row(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp))
                            .background(if (selected == value) LocalYugmColors.current.secondary.copy(alpha = 0.2f) else Color.Transparent)
                            .clickable(role = Role.Button, onClickLabel = label) { selected = value }
                            .padding(horizontal = 10.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            Modifier.size(16.dp).clip(CircleShape).border(1.dp, if (selected == value) LocalYugmColors.current.secondary else LocalYugmColors.current.textSecondary, CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            if (selected == value) Box(Modifier.size(8.dp).clip(CircleShape).background(LocalYugmColors.current.secondary))
                        }
                        Spacer(Modifier.width(10.dp))
                        Text(label, color = LocalYugmColors.current.textPrimary, fontSize = 13.sp)
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = { onSubmit(selected) }) { Text("Submit report", color = LocalYugmColors.current.danger, fontWeight = FontWeight.Bold) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel", color = LocalYugmColors.current.textSecondary) } }
    )
}

@Composable
private fun MatchedBanner(name: String) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(Brush.horizontalGradient(listOf(LocalYugmColors.current.secondary.copy(alpha = 0.4f), LocalYugmColors.current.primary.copy(alpha = 0.3f)))).border(1.dp, LocalYugmColors.current.primary.copy(alpha = 0.4f), RoundedCornerShape(18.dp)).padding(14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(Modifier.size(42.dp).clip(RoundedCornerShape(13.dp)).background(Brush.linearGradient(listOf(LocalYugmColors.current.primary, LocalYugmColors.current.secondary))), contentAlignment = Alignment.Center) { Text("♡", color = Color.White, fontSize = 23.sp, fontWeight = FontWeight.Black) }
        Column(Modifier.padding(start = 12.dp)) {
            Text("You're Matched!", color = LocalYugmColors.current.textPrimary, fontSize = 15.sp, fontWeight = FontWeight.Black)
            Text("Say hello to $name and start your story ✨", color = LocalYugmColors.current.textSecondary, fontSize = 11.sp)
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
            Modifier.size(56.dp).clip(CircleShape).background(Brush.linearGradient(listOf(LocalYugmColors.current.secondary.copy(alpha = 0.75f), LocalYugmColors.current.primary.copy(alpha = 0.75f)))),
            contentAlignment = Alignment.Center
        ) { Text("💬", color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Bold) }
        Text("Start the conversation", color = LocalYugmColors.current.textPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold)
        Text("Send ${name.substringBefore(' ')} a message and see where the conversation goes.", color = LocalYugmColors.current.textSecondary, fontSize = 13.sp, lineHeight = 18.sp)
    }
}

@Composable
private fun SafetyTip(onDismiss: () -> Unit) {
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(LocalYugmColors.current.surfaceElevated).border(1.dp, LocalYugmColors.current.border, RoundedCornerShape(18.dp)).padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
        Text("🛡️", color = LocalYugmColors.current.primary, fontSize = 28.sp)
        Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
            Text("Safety Tip", color = LocalYugmColors.current.secondary, fontWeight = FontWeight.Bold, fontSize = 13.sp)
            Text("Be kind, respectful and keep the conversation safe. Report or block anything that feels off.", color = LocalYugmColors.current.textSecondary, fontSize = 10.sp, lineHeight = 14.sp)
        }
        Text("×", color = LocalYugmColors.current.textSecondary, fontSize = 22.sp, modifier = Modifier.clickable(onClick = onDismiss))
    }
}

@Composable
private fun BondStrip(bond: RelationshipStatus) {
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(LocalYugmColors.current.surfaceElevated).padding(12.dp)) {
        Row { Text("Bond Level ${bond.level}", color = LocalYugmColors.current.textPrimary, fontSize = 11.sp, fontWeight = FontWeight.Bold); Spacer(Modifier.weight(1f)); Text(bond.title, color = LocalYugmColors.current.primary, fontSize = 10.sp, fontWeight = FontWeight.Bold) }
        Box(Modifier.fillMaxWidth().padding(top = 7.dp).height(4.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.08f))) {
            Box(Modifier.fillMaxWidth(bond.progress.coerceIn(0f, 1f)).height(4.dp).background(Brush.horizontalGradient(listOf(LocalYugmColors.current.secondary, LocalYugmColors.current.primary))))
        }
    }
}

@Composable
private fun ConversationDivider(label: String, highlight: Boolean = false) {
    Box(Modifier.fillMaxWidth().padding(vertical = 12.dp), contentAlignment = Alignment.Center) {
        Box(
            Modifier
                .clip(RoundedCornerShape(50))
                .background(LocalYugmColors.current.surfaceElevated)
                .border(1.dp, LocalYugmColors.current.border, RoundedCornerShape(50))
                .padding(horizontal = 16.dp, vertical = 6.dp)
        ) {
            Text(label, color = if (highlight) LocalYugmColors.current.primary else LocalYugmColors.current.textSecondary, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        }
    }
}

// Bubble geometry. WhatsApp/Telegram shapes are a rounded rectangle with one
// nearly-square bottom corner on the sender's side, which reads as a tail without
// needing a custom path. Consecutive messages from the same sender also share a
// tight column of corners so a group looks like one continuous block.
private val BubbleRadius = 20.dp
private val BubbleTailRadius = 5.dp
private val BubbleStackedRadius = 7.dp

private fun messageBubbleShape(
    mine: Boolean,
    groupedWithPrev: Boolean,
    groupedWithNext: Boolean
): RoundedCornerShape {
    val senderEdgeTop = if (groupedWithPrev) BubbleStackedRadius else BubbleRadius
    return RoundedCornerShape(
        topStart = if (mine) BubbleRadius else senderEdgeTop,
        topEnd = if (mine) senderEdgeTop else BubbleRadius,
        bottomStart = when {
            mine -> BubbleRadius
            groupedWithNext -> BubbleStackedRadius
            else -> BubbleTailRadius
        },
        bottomEnd = when {
            !mine -> BubbleRadius
            groupedWithNext -> BubbleStackedRadius
            else -> BubbleTailRadius
        }
    )
}

@Composable
private fun MessageBubble(
    message: DirectMessage,
    mine: Boolean,
    selected: Boolean,
    highlighted: Boolean,
    bubbleId: String,
    partner: Host?,
    currentUserId: String,
    myActiveCosmetics: ActiveCosmetics,
    showIncomingAvatar: Boolean = !mine,
    showOutgoingAvatar: Boolean = mine,
    groupedWithPrev: Boolean = false,
    groupedWithNext: Boolean = false,
    playingVoiceMessageId: String?,
    isVoicePlaying: Boolean,
    isVoicePreparing: Boolean,
    voiceProgressMs: Int,
    voiceDurationMs: Int,
    startingCallType: RoomType? = null,
    isBlockedByMe: Boolean = false,
    onReact: (androidx.compose.ui.geometry.Rect) -> Unit,
    onLongPress: (androidx.compose.ui.geometry.Rect) -> Unit,
    onOpenImage: (String) -> Unit,
    onToggleVoice: () -> Unit,
    onSeekVoice: (Int) -> Unit,
    onAudioCall: () -> Unit = {},
    onVideoCall: () -> Unit = {}
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val bubble = if (mine) chatBubbleVisual(bubbleId) else null
    val isVoiceActive = playingVoiceMessageId == message.id
    val effectiveDuration = voiceDurationMs.coerceAtLeast(1)
    val safeProgress = if (isVoiceActive) voiceProgressMs.coerceIn(0, effectiveDuration) else 0
    var bubbleCoordinates by remember { mutableStateOf<androidx.compose.ui.layout.LayoutCoordinates?>(null) }
    Row(
        Modifier.fillMaxWidth(),
        horizontalArrangement = if (mine) Arrangement.End else Arrangement.Start,
        verticalAlignment = Alignment.Bottom
    ) {
        if (!mine) {
            if (showIncomingAvatar) {
                Box(Modifier.size(28.dp).clip(CircleShape).background(LocalYugmColors.current.surfaceElevated)) {
                    Avatar(
                        initial = partner?.name?.firstOrNull()?.toString() ?: "?",
                        size = 28,
                        imageUrl = partner?.avatar,
                        cosmetics = partner?.activeCosmetics ?: ActiveCosmetics(),
                        accessibilityLabel = null
                    )
                }
            } else {
                Spacer(Modifier.width(28.dp))
            }
            Spacer(Modifier.width(8.dp))
        }

        Column(horizontalAlignment = if (mine) Alignment.End else Alignment.Start) {
            val hasMedia = message.mediaUrl.isNotBlank()
            val mediaOnly = hasMedia && message.message.isBlank() && message.replyTo == null && !message.forwarded
            val bubbleShape = messageBubbleShape(mine, groupedWithPrev, groupedWithNext)
            Box(
                Modifier
                    // Hug the content, capped so long messages still leave the
                    // opposite side visible (WhatsApp/Telegram read at ~78%).
                    .widthIn(max = 290.dp)
                    .onGloballyPositioned { bubbleCoordinates = it }
                    .clip(bubbleShape)
                    .background(
                        bubble?.fill ?: if (mine) {
                            Brush.horizontalGradient(listOf(Color(0xFF6F35E8), Color(0xFFA24CFF)))
                        } else {
                            Brush.linearGradient(listOf(Color(0xFF1C1833), Color(0xFF141127)))
                        }
                    )
                    .border(
                        width = if (selected || highlighted) 2.dp else 1.dp,
                        color = when {
                            highlighted -> Color(0xFFFFC107)
                            selected -> LocalYugmColors.current.primary
                            bubble?.border != null -> bubble.border
                            mine -> Color.White.copy(alpha = 0.14f)
                            else -> Color(0x2EFFFFFF)
                        },
                        shape = bubbleShape
                    )
                    .combinedClickable(
                        onClick = {
                            val rect = bubbleCoordinates?.let { try { it.boundsInRoot() } catch (_: Exception) { null } } ?: androidx.compose.ui.geometry.Rect.Zero
                            onReact(rect)
                        },
                        onLongClick = {
                            val rect = bubbleCoordinates?.let { try { it.boundsInRoot() } catch (_: Exception) { null } } ?: androidx.compose.ui.geometry.Rect.Zero
                            onLongPress(rect)
                        }
                    )
                    .padding(
                        horizontal = if (mediaOnly) 4.dp else 10.dp,
                        vertical = if (mediaOnly) 4.dp else 6.dp
                    )
            ) {
                Column {
                    if (message.forwarded) {
                        Text("Forwarded", color = LocalYugmColors.current.primary, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(bottom = 3.dp))
                    }
                    message.replyTo?.let { reply ->
                        Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).background(Color.Black.copy(alpha = 0.22f)).padding(horizontal = 8.dp, vertical = 6.dp)) {
                            Text(reply.author.ifBlank { "Replied message" }, color = LocalYugmColors.current.primary, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            Text(reply.text.ifBlank { "Media" }, color = LocalYugmColors.current.textSecondary, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                        Spacer(Modifier.height(4.dp))
                    }
                    if (message.mediaUrl.isNotBlank()) {
                        val isAudio = message.mediaType.equals("AUDIO", true)
                        val isVideo = message.mediaType.equals("VIDEO", true)
                        if (isAudio) {
                            Column(
                                Modifier
                                    .widthIn(min = 190.dp, max = 250.dp)
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(Color.White.copy(alpha = 0.12f))
                                    .padding(horizontal = 10.dp, vertical = 10.dp)
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Box(
                                        Modifier
                                            .size(34.dp)
                                            .clip(CircleShape)
                                            .background(Color.White.copy(alpha = 0.22f))
                                            .clickable(
                                                enabled = !(isVoiceActive && isVoicePreparing),
                                                role = Role.Button,
                                                onClickLabel = if (isVoiceActive && isVoicePlaying) "Pause voice note" else "Play voice note"
                                            ) {
                                                onToggleVoice()
                                            },
                                        contentAlignment = Alignment.Center
                                    ) {
                                        if (isVoiceActive && isVoicePreparing) {
                                            androidx.compose.material3.CircularProgressIndicator(
                                                modifier = Modifier.size(16.dp),
                                                color = Color.White,
                                                strokeWidth = 2.dp
                                            )
                                        } else {
                                            Icon(
                                                imageVector = if (isVoiceActive && isVoicePlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                                                contentDescription = null,
                                                tint = Color.White,
                                                modifier = Modifier.size(18.dp)
                                            )
                                        }
                                    }
                                    Spacer(Modifier.width(10.dp))
                                    Column(Modifier.weight(1f)) {
                                        Text("Voice note", color = (bubble?.text ?: LocalYugmColors.current.textPrimary), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                                        Text(
                                            when {
                                                isVoiceActive && isVoicePreparing -> "Loading…"
                                                isVoiceActive -> "${formatPlaybackTime(safeProgress)} / ${formatPlaybackTime(voiceDurationMs)}"
                                                else -> "Tap to play"
                                            },
                                            color = (bubble?.text ?: LocalYugmColors.current.textSecondary).copy(alpha = 0.8f),
                                            fontSize = 10.sp
                                        )
                                    }
                                }
                                if (isVoiceActive && voiceDurationMs > 0 && !isVoicePreparing) {
                                    Slider(
                                        value = safeProgress.toFloat(),
                                        onValueChange = { onSeekVoice(it.toInt()) },
                                        valueRange = 0f..voiceDurationMs.toFloat(),
                                        modifier = Modifier.padding(top = 2.dp),
                                        colors = SliderDefaults.colors(
                                            thumbColor = Color.White,
                                            activeTrackColor = Color.White.copy(alpha = 0.9f),
                                            inactiveTrackColor = Color.White.copy(alpha = 0.25f)
                                        )
                                    )
                                }
                            }
                        } else {
                            Box(
                                Modifier
                                    .widthIn(max = 240.dp)
                                    .height(if (isVideo) 160.dp else 180.dp)
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(Color.Black.copy(alpha = 0.18f))
                                    .clickable(
                                        role = Role.Button,
                                        onClickLabel = if (isVideo) "Open video" else "Open photo"
                                    ) {
                                        val resolved = resolveMediaUrl(message.mediaUrl) ?: message.mediaUrl
                                        if (isVideo) openChatMedia(context, resolved) else onOpenImage(resolved)
                                    }
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
                                        Icon(Icons.Filled.PlayArrow, contentDescription = null, tint = Color.White)
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
                                    Text(
                                        if (isVideo) "VIDEO" else "PHOTO",
                                        color = Color.White,
                                        fontSize = 9.sp,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                }
                            }
                        }
                        Spacer(Modifier.height(4.dp))
                    }
                    if (message.message.isNotBlank()) {
                        val lower = message.message.lowercase()
                        val isCallInvite = lower.contains("call started") || (lower.contains("private") && lower.contains("call"))
                        val callType = when {
                            isCallInvite && lower.contains("video") -> "Video call"
                            isCallInvite && (lower.contains("voice") || lower.contains("audio")) -> "Voice call"
                            else -> null
                        }
                        if (callType != null) {
                            val isVideoCall = callType == "Video call"
                            val cardCallType = if (isVideoCall) RoomType.Video else RoomType.Voice
                            val isCardStarting = startingCallType == cardCallType
                            val anyCallStarting = startingCallType != null
                            val callActionEnabled = !anyCallStarting && !isBlockedByMe
                            Column(
                                Modifier
                                    .clip(RoundedCornerShape(16.dp))
                                    .background(Color.White.copy(alpha = 0.12f))
                                    .padding(horizontal = 12.dp, vertical = 10.dp),
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    Box(
                                        Modifier
                                            .size(34.dp)
                                            .clip(CircleShape)
                                            .background(Brush.linearGradient(listOf(LocalYugmColors.current.secondary.copy(alpha = 0.95f), LocalYugmColors.current.primary.copy(alpha = 0.9f)))),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(
                                            if (isVideoCall) Icons.Filled.Videocam else Icons.Filled.Call,
                                            contentDescription = null,
                                            tint = Color.White,
                                            modifier = Modifier.size(18.dp)
                                        )
                                    }
                                    Column(Modifier.weight(1f)) {
                                        Text(callType, color = bubble?.text ?: LocalYugmColors.current.textPrimary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                                        Text(
                                            when {
                                                isBlockedByMe -> "Unblock to start a call"
                                                mine -> "You started a call"
                                                else -> "Call invitation"
                                            },
                                            color = (bubble?.text ?: LocalYugmColors.current.textSecondary).copy(alpha = 0.8f),
                                            fontSize = 11.sp
                                        )
                                    }
                                }
                                Box(
                                    Modifier
                                        .clip(CircleShape)
                                        .then(
                                            if (callActionEnabled) {
                                                Modifier.background(
                                                    Brush.linearGradient(
                                                        listOf(LocalYugmColors.current.secondary.copy(alpha = 0.95f), LocalYugmColors.current.primary.copy(alpha = 0.9f))
                                                    )
                                                )
                                            } else {
                                                Modifier.background(Color.White.copy(alpha = 0.12f))
                                            }
                                        )
                                        .clickable(
                                            enabled = callActionEnabled,
                                            role = Role.Button,
                                            onClickLabel = if (isVideoCall) "Start video call again" else "Start voice call again"
                                        ) {
                                            if (isVideoCall) onVideoCall() else onAudioCall()
                                        }
                                        .padding(horizontal = 12.dp, vertical = 8.dp)
                                ) {
                                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                        if (isCardStarting) {
                                            androidx.compose.material3.CircularProgressIndicator(
                                                modifier = Modifier.size(12.dp),
                                                color = Color.White,
                                                strokeWidth = 2.dp
                                            )
                                        }
                                        Text(
                                            when {
                                                isCardStarting -> "Starting…"
                                                isBlockedByMe -> "Unblock to call"
                                                anyCallStarting -> "Please wait…"
                                                mine -> "Start again"
                                                else -> "Call back"
                                            },
                                            color = Color.White,
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.SemiBold
                                        )
                                    }
                                }
                            }
                        } else {
                            Text(message.message, color = bubble?.text ?: LocalYugmColors.current.textPrimary, fontSize = 14.sp, lineHeight = 20.sp)
                        }
                    }
                    Row(
                        Modifier
                            .align(Alignment.End)
                            .padding(top = if (message.message.isNotBlank()) 2.dp else 5.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        if (message.isEdited) {
                            Text("edited", color = (bubble?.text ?: LocalYugmColors.current.textSecondary).copy(alpha = 0.7f), fontSize = 10.sp)
                            Text(" · ", color = (bubble?.text ?: LocalYugmColors.current.textSecondary).copy(alpha = 0.6f), fontSize = 10.sp)
                        }
                        Text(messageTime(message.createdAt), color = (bubble?.text ?: LocalYugmColors.current.textSecondary).copy(alpha = 0.78f), fontSize = 10.sp)
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
            if (message.reactions.isNotEmpty()) {
                val grouped = message.reactions.groupBy { it.type }.mapValues { it.value.size }
                val aggregates = grouped.entries.sortedByDescending { it.value }.take(3).map { it.key to it.value }
                val myReaction = currentUserId.takeIf { it.isNotBlank() }?.let { uid -> message.reactions.firstOrNull { it.userId == uid }?.type }
                val hiddenTypes = (grouped.size - aggregates.size).coerceAtLeast(0)
                Row(
                    Modifier
                        .offset(y = (-6).dp)
                        .clip(RoundedCornerShape(999.dp))
                        .background(LocalYugmColors.current.surfaceElevated)
                        .border(1.dp, if (myReaction != null) LocalYugmColors.current.secondary.copy(alpha = 0.55f) else LocalYugmColors.current.border, RoundedCornerShape(999.dp))
                        .clickable(role = Role.Button, onClickLabel = "View or change reaction") {
                            val rect = bubbleCoordinates?.let { runCatching { it.boundsInRoot() }.getOrNull() } ?: androidx.compose.ui.geometry.Rect.Zero
                            onReact(rect)
                        }
                        .padding(horizontal = 9.dp, vertical = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    aggregates.forEach { (type, count) ->
                        Text(
                            "${reactionEmoji(type)}${if (count > 1) " $count" else ""}",
                            color = if (type == myReaction) LocalYugmColors.current.textPrimary else LocalYugmColors.current.textSecondary,
                            fontSize = 10.sp,
                            fontWeight = if (type == myReaction) FontWeight.Bold else FontWeight.Medium
                        )
                    }
                    if (hiddenTypes > 0) {
                        Text("+$hiddenTypes", color = LocalYugmColors.current.textSecondary, fontSize = 10.sp, fontWeight = FontWeight.Medium)
                    }
                }
            }
        }

        if (mine) {
            Spacer(Modifier.width(8.dp))
            if (showOutgoingAvatar) {
                Box(Modifier.size(28.dp).clip(CircleShape).background(LocalYugmColors.current.surfaceElevated)) {
                    Avatar(
                        initial = "You".first().toString(),
                        size = 28,
                        imageUrl = null,
                        cosmetics = myActiveCosmetics,
                        accessibilityLabel = null
                    )
                }
            } else {
                Spacer(Modifier.width(28.dp))
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
    Box(Modifier.size(5.dp).offset(y = offsetY.dp).clip(CircleShape).background(LocalYugmColors.current.secondary))
}

@Composable
fun TypingBubble() {
    Row(Modifier.clip(RoundedCornerShape(14.dp)).background(LocalYugmColors.current.surfaceElevated).padding(horizontal = 12.dp, vertical = 10.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        TypingIndicatorDot(0); TypingIndicatorDot(100); TypingIndicatorDot(200)
    }
}

private fun messageTime(value: String) = com.yugm.app.feature.chat.formatChatMessageTime(value)

private fun formatPlaybackTime(ms: Int): String {
    val totalSeconds = (ms.coerceAtLeast(0) / 1000)
    val minutes = totalSeconds / 60
    val seconds = totalSeconds % 60
    return "%d:%02d".format(minutes, seconds)
}

private fun messageDateLabel(value: String): String = com.yugm.app.feature.chat.formatChatDateLabel(value)

private fun DirectMessage.canStillEdit(): Boolean = com.yugm.app.feature.chat.canEditDirectMessage(createdAt)

@Composable
private fun ChatOptionRow(
    icon: ImageVector,
    label: String,
    tint: Color = LocalYugmColors.current.textPrimary,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(role = Role.Button, onClickLabel = label, onClick = onClick)
            .padding(horizontal = 20.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, color = tint, fontSize = 15.sp, fontWeight = FontWeight.Medium)
        Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(20.dp))
    }
}

@Composable
private fun CompactOptionRow(
    icon: ImageVector,
    label: String,
    tint: Color = LocalYugmColors.current.textPrimary,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(role = Role.Button, onClickLabel = label, onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, color = tint, fontSize = 13.sp, fontWeight = FontWeight.Medium)
        Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(16.dp))
    }
}

private fun getGiftEmoji(name: String, icon: String): String {
    val query = "$name $icon".lowercase()
    return when {
        query.contains("diya") -> "\uD83E\uDE94"
        query.contains("rose") -> "\uD83C\uDF39"
        query.contains("crown") -> "\uD83D\uDC51"
        query.contains("lotus") -> "\uD83E\uDEB7"
        query.contains("heart") -> "\u2764\uFE0F"
        query.contains("ring") -> "\uD83D\uDC8D"
        query.contains("car") -> "\uD83D\uDE97"
        query.contains("diamond") -> "\uD83D\uDC8E"
        query.contains("fire") -> "\uD83D\uDD25"
        query.contains("rocket") -> "\uD83D\uDE80"
        query.contains("mic") -> "\uD83C\uDFA4"
        query.contains("cake") -> "\uD83C\uDF82"
        query.contains("bear") -> "\uD83E\uDDF8"
        query.contains("star") -> "\u2B50"
        else -> {
            if (icon.isNotBlank() && icon.length <= 4 && !icon.any { it.isLetterOrDigit() }) icon
            else "\uD83C\uDF81"
        }
    }
}

private fun openChatMedia(context: android.content.Context, rawUrl: String) {
    val resolved = resolveMediaUrl(rawUrl) ?: rawUrl
    if (resolved.isBlank()) return
    runCatching {
        val intent = Intent(Intent.ACTION_VIEW, resolved.toUri()).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }.onFailure {
        android.widget.Toast.makeText(context, "Unable to open media", android.widget.Toast.LENGTH_SHORT).show()
    }
}
private fun reactionEmoji(type: String): String = when (type.lowercase()) {
    "heart" -> "\u2764\uFE0F"
    "fire" -> "\uD83D\uDD25"
    "laugh" -> "\uD83D\uDE02"
    "clap" -> "\uD83D\uDC4F"
    "wow" -> "\uD83D\uDE2E"
    "crown" -> "\uD83D\uDC51"
    "stars" -> "\u2728"
    "party" -> "\uD83C\uDF89"
    else -> "\u2764\uFE0F"
}
