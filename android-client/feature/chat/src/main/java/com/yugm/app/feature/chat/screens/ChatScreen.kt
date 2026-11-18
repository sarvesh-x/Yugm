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
import androidx.compose.foundation.layout.heightIn
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Icon
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.StopCircle
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
import androidx.compose.ui.platform.LocalConfiguration
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
import com.yugm.app.core.model.RoomReaction
import com.yugm.app.core.model.RoomReactionAccess
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
import com.yugm.app.core.ui.theme.chatBubbleBackground
import com.yugm.app.core.ui.theme.chatBubbleForeground
import com.yugm.app.core.ui.theme.chatBubbleMetadata
import coil.compose.AsyncImage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

// Theme-aware palette is read via LocalYugmColors inside composables.

private fun chatCanvas(dark: Boolean) = if (dark) Color(0xFF100D1D) else Color(0xFFFAF8FC)
private fun chatHeaderSurface(dark: Boolean) = if (dark) Color(0xFF1C182D) else Color.White
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
    isUploadingAttachment: Boolean = false,
    sendingMessageIds: Set<String> = emptySet(),
    failedMessageIds: Set<String> = emptySet(),
    isPartnerTyping: Boolean = false,
    startingCallType: RoomType? = null,
    error: String = "",
    onBack: () -> Unit = {},
    onRetry: () -> Unit = {},
    onSend: (String, () -> Unit, (String) -> Unit) -> Unit = { _, _, _ -> },
    onRetrySend: (String) -> Unit = {},
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
    onForward: (DirectMessage, List<String>, (String) -> Unit, (String) -> Unit) -> Unit = { _, _, _, _ -> },
    onSearch: (String) -> Unit = {},
    onLoadMoreSearch: () -> Unit = {},
    onEnsureForwardTargets: () -> Unit = {},
    onMute: (Boolean) -> Unit = {},
    onOpenProfile: (String) -> Unit = {},
    onOpenBonds: (String) -> Unit = {},
    reactionCatalog: List<RoomReaction> = emptyList(),
    isReactionCatalogLoading: Boolean = false,
    reactionCatalogError: String? = null,
    onReloadReactions: () -> Unit = {},
    isCurrentUserVip: Boolean = false,
    onOpenVip: () -> Unit = {},
    onOpenRoom: (String) -> Unit = {}
) {
    PrefetchReactionAssets(reactionCatalog.map { it.assetUrl })
    val reactionById = remember(reactionCatalog) { reactionCatalog.associateBy { it.id.lowercase() } }
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
    LaunchedEffect(forwardMessage != null) {
        if (forwardMessage != null) onEnsureForwardTargets()
    }
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
    val gatedAudioCall: () -> Unit = { if (!isCurrentUserVip) showVipCallDialog = true else onAudioCall() }
    val gatedVideoCall: () -> Unit = { if (!isCurrentUserVip) showVipCallDialog = true else onVideoCall() }
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
    val blockedChatMessage = "Unblock this user to send messages."
    fun ensureCanCompose(): Boolean {
        if (!isBlockedByMe) return true
        android.widget.Toast.makeText(context, blockedChatMessage, android.widget.Toast.LENGTH_SHORT).show()
        return false
    }
    fun submitDraft() {
        if (isBlockedByMe) {
            ensureCanCompose()
            return
        }
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
        if (searchQuery.isBlank() && messages.isNotEmpty() && hasMoreHistory) index += 1
        if (error.isNotBlank()) index += 1
        messages.forEach { msg ->
            if (msg.id == targetMessageId) return index
            index += 1
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
        val nearBottom = isNearBottom(listState)
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
        val nearBottom = isNearBottom(listState)
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
        var forwardQuery by remember(selected.id) { mutableStateOf("") }
        var selectedTargets by remember(selected.id) { mutableStateOf<Set<String>>(emptySet()) }
        var forwarding by remember(selected.id) { mutableStateOf(false) }
        val filteredTargets = remember(forwardTargets, forwardQuery) {
            val q = forwardQuery.trim().lowercase()
            if (q.isBlank()) forwardTargets else forwardTargets.filter {
                it.name.lowercase().contains(q) || it.username.lowercase().contains(q)
            }
        }
        AlertDialog(
            onDismissRequest = { if (!forwarding) forwardMessage = null },
            containerColor = LocalYugmColors.current.surfaceElevated,
            title = {
                Column {
                    Text("Forward message", color = LocalYugmColors.current.textPrimary, fontWeight = FontWeight.Bold)
                    Text(
                        if (selectedTargets.isEmpty()) "Select people or chats" else "${selectedTargets.size} selected",
                        color = LocalYugmColors.current.textSecondary,
                        fontSize = 12.sp
                    )
                }
            },
            text = {
                if (forwardTargets.isEmpty()) {
                    Text("Start a chat with someone before forwarding.", color = LocalYugmColors.current.textSecondary)
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(14.dp))
                                .background(LocalYugmColors.current.surface)
                                .border(1.dp, LocalYugmColors.current.border, RoundedCornerShape(14.dp))
                                .padding(horizontal = 12.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            BasicTextField(
                                value = forwardQuery,
                                onValueChange = { forwardQuery = it.take(60) },
                                singleLine = true,
                                textStyle = androidx.compose.ui.text.TextStyle(color = LocalYugmColors.current.textPrimary, fontSize = 14.sp),
                                cursorBrush = androidx.compose.ui.graphics.SolidColor(LocalYugmColors.current.primary),
                                modifier = Modifier.weight(1f),
                                decorationBox = { inner ->
                                    Box {
                                        if (forwardQuery.isBlank()) Text("Search people…", color = LocalYugmColors.current.textSecondary, fontSize = 14.sp)
                                        inner()
                                    }
                                }
                            )
                            if (forwardQuery.isNotBlank()) {
                                Text(
                                    "Clear",
                                    color = LocalYugmColors.current.secondary,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    modifier = Modifier.clickable(enabled = !forwarding) { forwardQuery = "" }.padding(start = 8.dp)
                                )
                            }
                        }
                        if (filteredTargets.isEmpty()) {
                            Text("No matches for \"$forwardQuery\".", color = LocalYugmColors.current.textSecondary, fontSize = 13.sp, modifier = Modifier.padding(vertical = 8.dp))
                        } else {
                            LazyColumn(
                                modifier = Modifier.heightIn(max = 320.dp),
                                verticalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                items(filteredTargets, key = { "forward-${it.id}" }) { target ->
                                    val isSelected = target.id in selectedTargets
                                    Row(
                                        Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(14.dp))
                                            .background(if (isSelected) LocalYugmColors.current.secondary.copy(alpha = 0.14f) else Color.Transparent)
                                            .border(1.dp, if (isSelected) LocalYugmColors.current.secondary.copy(alpha = 0.45f) else Color.Transparent, RoundedCornerShape(14.dp))
                                            .clickable(enabled = !forwarding, role = Role.Button) {
                                                selectedTargets = if (isSelected) selectedTargets - target.id else selectedTargets + target.id
                                            }
                                            .padding(horizontal = 10.dp, vertical = 10.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Avatar(target.name.take(1), 38, target.avatar, target.activeCosmetics)
                                        Column(Modifier.weight(1f).padding(start = 10.dp)) {
                                            Text(target.name.ifBlank { target.username.ifBlank { "User" } }, color = LocalYugmColors.current.textPrimary, fontSize = 14.sp, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                            if (target.username.isNotBlank()) Text("@${target.username}", color = LocalYugmColors.current.textSecondary, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                        }
                                        Box(
                                            Modifier
                                                .size(22.dp)
                                                .clip(CircleShape)
                                                .background(if (isSelected) LocalYugmColors.current.secondary else Color.Transparent)
                                                .border(1.5.dp, if (isSelected) LocalYugmColors.current.secondary else LocalYugmColors.current.textSecondary.copy(alpha = 0.6f), CircleShape),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            if (isSelected) Text("✓", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = {
                val count = selectedTargets.size
                TextButton(
                    enabled = !forwarding && count > 0 && forwardTargets.isNotEmpty(),
                    onClick = {
                        forwarding = true
                        onForward(
                            selected,
                            selectedTargets.toList(),
                            { msg ->
                                forwarding = false
                                forwardMessage = null
                                android.widget.Toast.makeText(context, msg, android.widget.Toast.LENGTH_SHORT).show()
                            },
                            { msg ->
                                forwarding = false
                                android.widget.Toast.makeText(context, msg, android.widget.Toast.LENGTH_LONG).show()
                            }
                        )
                    }
                ) {
                    Text(
                        when {
                            forwarding -> "Forwarding…"
                            count > 0 -> "Forward ($count)"
                            else -> "Forward"
                        },
                        color = if (!forwarding && count > 0) LocalYugmColors.current.secondary else LocalYugmColors.current.textSecondary,
                        fontWeight = FontWeight.Bold
                    )
                }
            },
            dismissButton = {
                TextButton(enabled = !forwarding, onClick = { forwardMessage = null }) {
                    Text("Cancel", color = LocalYugmColors.current.textSecondary)
                }
            }
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
                            .joinToString("  ") { (type, items) ->
                                val emoji = reactionById[type.lowercase()]?.emoji?.takeIf { it.isNotBlank() } ?: reactionEmoji(type)
                                "$emoji ${items.size}"
                            }
                        val mineReaction = currentUserId.takeIf { it.isNotBlank() }?.let { uid -> msg.reactions.firstOrNull { it.userId == uid }?.type }
                        Text("Reactions: $summary", color = LocalYugmColors.current.textSecondary, fontSize = 13.sp)
                        if (!mineReaction.isNullOrBlank()) {
                            val mineEmoji = reactionById[mineReaction.lowercase()]?.emoji?.takeIf { it.isNotBlank() } ?: reactionEmoji(mineReaction)
                            Text("Your reaction: $mineEmoji", color = LocalYugmColors.current.textPrimary, fontSize = 13.sp)
                        }
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
    LaunchedEffect(isBlockedByMe) {
        if (isBlockedByMe) showEmojiBar = false
    }
    DisposableEffect(Unit) {
        onDispose {
            if (typingSent) onTyping(false)
        }
    }
    // Scroll behavior is handled by the visible-messages auto-scroll effect above.

    Box(Modifier.fillMaxSize().background(chatCanvas(LocalYugmColors.current.isDark))) {
        Column(Modifier.fillMaxSize().statusBarsPadding()) {
                GlassCard(
                    modifier = Modifier.fillMaxWidth(),
                    gradient = Brush.linearGradient(listOf(chatHeaderSurface(LocalYugmColors.current.isDark), chatHeaderSurface(LocalYugmColors.current.isDark))),
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
                            Modifier.size(48.dp).clip(CircleShape).clickable(enabled = !partner?.id.isNullOrBlank(), role = Role.Button) {
                                partner?.id?.takeIf(String::isNotBlank)?.let(onOpenProfile)
                            }
                        ) {
                            Avatar(partner?.name?.take(1) ?: "?", 34, partner?.avatar, partner?.activeCosmetics ?: ActiveCosmetics(), accessibilityLabel = stringResource(R.string.a11y_profile_picture, partner?.name ?: defaultMatchName))
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
                            onClick = gatedAudioCall,
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
                            onClick = gatedVideoCall,
                            enabled = !isBlockedByMe && startingCallType == null,
                            loading = startingCallType == RoomType.Video,
                            locked = callsLockedForVip
                        )
                        Spacer(Modifier.width(6.dp))
                        ConversationOptionsMenu(
                            expanded = showMore,
                            isProfileEnabled = !partner?.id.isNullOrBlank(),
                            isMuted = isMuted,
                            isBlockedByMe = isBlockedByMe,
                            onExpandedChange = { showMore = it },
                            onProfile = { partner?.id?.takeIf(String::isNotBlank)?.let(onOpenProfile) },
                            onBonds = { partner?.id?.takeIf(String::isNotBlank)?.let(onOpenBonds) },
                            onSearch = {
                                if (searchVisible) { searchVisible = false; searchQuery = "" } else searchVisible = true
                            },
                            onMute = { onMute(!isMuted) },
                            onReport = { showReportDialog = true },
                            onToggleBlock = onToggleBlock,
                            onDelete = { confirmDeleteChat = true }
                        )
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
                                .background(LocalYugmColors.current.surface)
                                .border(1.dp, LocalYugmColors.current.border, RoundedCornerShape(16.dp))
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

                relationship?.let { bond ->
                    Box(Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 6.dp)) {
                        BondStrip(bond)
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
                                        .background(LocalYugmColors.current.danger.copy(alpha = 0.08f))
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
                                                        .clickable(
                                                            enabled = !isBlockedByMe && !isSending,
                                                            role = Role.Button,
                                                            onClickLabel = "Send $greeting"
                                                        ) {
                                                            if (ensureCanCompose()) onSend(greeting, {}, {})
                                                        }
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
                                            reactionById = reactionById,
                                            isCurrentUserVip = isCurrentUserVip,
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
                                            onOpenRoom = onOpenRoom,
                                            onToggleVoice = { toggleVoicePlayback(message) },
                                            onSeekVoice = { pos -> seekVoicePlayback(message.id, pos) },
                                            onAudioCall = gatedAudioCall,
                                            onVideoCall = gatedVideoCall,
                                            isPendingSend = message.id in sendingMessageIds,
                                            isFailedSend = message.id in failedMessageIds,
                                            onRetrySend = { onRetrySend(message.id) },
                                            onJumpToReply = { replyId ->
                                                val target = messages.firstOrNull { it.id == replyId }
                                                if (target != null) jumpToMessage(target)
                                                else android.widget.Toast.makeText(context, "Original message isn't loaded yet.", android.widget.Toast.LENGTH_SHORT).show()
                                            }
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
                                .background(LocalYugmColors.current.surface)
                                .border(1.dp, LocalYugmColors.current.border, RoundedCornerShape(14.dp))
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
                        LightChatAction(
                            Icons.Filled.SentimentSatisfiedAlt,
                            stringResource(R.string.a11y_toggle_emoji_picker),
                            enabled = !isBlockedByMe,
                            onClick = { if (ensureCanCompose()) showEmojiBar = !showEmojiBar }
                        )
                        Row(
                            Modifier.weight(1f).height(52.dp).clip(RoundedCornerShape(26.dp))
                                .background(LocalYugmColors.current.surface)
                                .border(1.dp, LocalYugmColors.current.border, RoundedCornerShape(26.dp))
                                .padding(horizontal = 14.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            BasicTextField(
                                value = draft,
                                onValueChange = { if (!isBlockedByMe) draft = it.take(1000) },
                                enabled = !isBlockedByMe,
                                textStyle = androidx.compose.ui.text.TextStyle(color = LocalYugmColors.current.textPrimary, fontSize = 14.sp),
                                cursorBrush = androidx.compose.ui.graphics.SolidColor(LocalYugmColors.current.primary),
                                modifier = Modifier.weight(1f).semantics { contentDescription = messageFieldLabel },
                                decorationBox = { inner ->
                                    Box {
                                        if (draft.isBlank()) Text(
                                            if (isBlockedByMe) "Unblock to send a message"
                                            else if (editingTarget != null) "Edit message…"
                                            else if (replyTarget != null) "Write a reply…"
                                            else "Type a message...",
                                            color = LocalYugmColors.current.textSecondary,
                                            fontSize = 14.sp
                                        )
                                        inner()
                                    }
                                }
                            )
                            Spacer(Modifier.width(6.dp))
                            if (isRecordingVoice) {
                                Box(
                                    Modifier
                                        .sizeIn(minWidth = 36.dp, minHeight = 36.dp)
                                        .semantics { contentDescription = "Cancel voice note" }
                                        .clickable(role = Role.Button, onClickLabel = "Cancel voice note") { stopVoiceRecording(send = false) },
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(Icons.Filled.Close, contentDescription = null, tint = Color(0xFFFF5F64), modifier = Modifier.size(19.dp))
                                }
                                Spacer(Modifier.width(4.dp))
                            }
                            Box(
                                Modifier
                                    .sizeIn(minWidth = 36.dp, minHeight = 36.dp)
                                    .semantics { contentDescription = "Attach media" }
                                    .clickable(
                                        enabled = !isBlockedByMe && !isUploadingAttachment && !isRecordingVoice,
                                        role = Role.Button,
                                        onClickLabel = "Attach media"
                                    ) {
                                        if (ensureCanCompose()) mediaPicker.launch(arrayOf("image/*", "video/*"))
                                    },
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(Icons.Filled.AttachFile, contentDescription = null, tint = if (isBlockedByMe || isUploadingAttachment || isRecordingVoice) LocalYugmColors.current.textSecondary.copy(alpha = 0.45f) else LocalYugmColors.current.textSecondary, modifier = Modifier.size(19.dp))
                            }
                            Spacer(Modifier.width(4.dp))
                            Box(
                                Modifier
                                    .sizeIn(minWidth = 36.dp, minHeight = 36.dp)
                                    .semantics { contentDescription = if (isRecordingVoice) "Stop and send voice note" else "Record voice note" }
                                    .clickable(
                                        enabled = (!isBlockedByMe && !isUploadingAttachment) || isRecordingVoice,
                                        role = Role.Button,
                                        onClickLabel = if (isRecordingVoice) "Stop and send voice note" else "Record voice note"
                                    ) {
                                        if (isRecordingVoice) {
                                            stopVoiceRecording(send = true)
                                        } else if (ensureCanCompose()) {
                                            val granted = androidx.core.content.ContextCompat.checkSelfPermission(context, android.Manifest.permission.RECORD_AUDIO) == android.content.pm.PackageManager.PERMISSION_GRANTED
                                            if (granted) startVoiceRecording() else audioPermissionLauncher.launch(android.Manifest.permission.RECORD_AUDIO)
                                        }
                                    },
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = if (isRecordingVoice) Icons.Filled.StopCircle else Icons.Filled.Mic,
                                    contentDescription = null,
                                    tint = if (isRecordingVoice) Color(0xFFFF5F64) else if (isBlockedByMe || isUploadingAttachment) LocalYugmColors.current.textSecondary.copy(alpha = 0.45f) else LocalYugmColors.current.textSecondary,
                                    modifier = Modifier.size(19.dp)
                                )
                            }
                            Spacer(Modifier.width(4.dp))
                            Box(
                                Modifier
                                    .sizeIn(minWidth = 36.dp, minHeight = 36.dp)
                                    .semantics { contentDescription = "Send gift" }
                                    .clickable(
                                        enabled = !isBlockedByMe && !isUploadingAttachment && !isRecordingVoice,
                                        role = Role.Button,
                                        onClickLabel = "Send gift"
                                    ) { if (ensureCanCompose()) showGiftSheet = true },
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(Icons.Filled.CardGiftcard, contentDescription = null, tint = if (isBlockedByMe || isUploadingAttachment || isRecordingVoice) LocalYugmColors.current.textSecondary.copy(alpha = 0.45f) else LocalYugmColors.current.textSecondary, modifier = Modifier.size(19.dp))
                            }
                        }
                        val canSendNow = draft.trim().isNotBlank() && !isBlockedByMe
                        Box(
                            Modifier
                                .size(48.dp)
                                .clip(CircleShape)
                                .background(
                                    if (!canSendNow) Brush.linearGradient(listOf(Color(0xFF6B2FD9).copy(alpha = 0.55f), Color(0xFF9E37F9).copy(alpha = 0.55f)))
                                    else Brush.linearGradient(listOf(Color(0xFF6B2FD9), Color(0xFF9E37F9)))
                                )
                                .semantics { contentDescription = sendMessageLabel }
                                .clickable(role = Role.Button, onClickLabel = sendMessageLabel) {
                                    submitDraft()
                                },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.AutoMirrored.Filled.Send, contentDescription = null, tint = Color.White.copy(alpha = if (canSendNow) 1f else 0.7f), modifier = Modifier.size(18.dp))
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
            val barWidth = (screenWidth - 24.dp).coerceAtMost(340.dp).coerceAtLeast(220.dp)
            val barHeight = 60.dp
            val edgeMargin = 8.dp
            val bubbleGap = 2.dp

            val preferredAboveY = bubbleTop - barHeight - bubbleGap
            val maxY = (screenHeight - barHeight - edgeMargin).coerceAtLeast(edgeMargin)
            val offsetY = preferredAboveY.coerceIn(edgeMargin, maxY)

            val bubbleCenterX = (bubbleLeft + bubbleRight) / 2
            val idealX = bubbleCenterX - (barWidth / 2)
            val offsetX = idealX.coerceIn(edgeMargin, (screenWidth - barWidth - edgeMargin).coerceAtLeast(edgeMargin))

            val fallbackCatalog = listOf(
                RoomReaction(id = "heart", label = "Heart", emoji = "\u2764\uFE0F", access = RoomReactionAccess.EVERYONE, sortOrder = 0),
                RoomReaction(id = "fire", label = "Fire", emoji = "\uD83D\uDD25", access = RoomReactionAccess.EVERYONE, sortOrder = 1),
                RoomReaction(id = "laugh", label = "Laugh", emoji = "\uD83D\uDE02", access = RoomReactionAccess.EVERYONE, sortOrder = 2),
                RoomReaction(id = "clap", label = "Clap", emoji = "\uD83D\uDC4F", access = RoomReactionAccess.EVERYONE, sortOrder = 3),
                RoomReaction(id = "wow", label = "Wow", emoji = "\uD83D\uDE2E", access = RoomReactionAccess.EVERYONE, sortOrder = 4),
                RoomReaction(id = "crown", label = "Crown", emoji = "\uD83D\uDC51", access = RoomReactionAccess.EVERYONE, sortOrder = 5),
                RoomReaction(id = "stars", label = "Stars", emoji = "\u2728", access = RoomReactionAccess.EVERYONE, sortOrder = 6),
                RoomReaction(id = "party", label = "Party", emoji = "\uD83C\uDF89", access = RoomReactionAccess.EVERYONE, sortOrder = 7)
            )
            val pickerReactions = (if (reactionCatalog.isNotEmpty()) reactionCatalog.sortedBy { it.sortOrder } else fallbackCatalog)
            .distinctBy { it.id.trim().lowercase() }

            Box(
                modifier = Modifier
                    .offset(x = offsetX, y = offsetY)
            ) {
                Column(
                    modifier = Modifier
                        .width(barWidth)
                        .clip(RoundedCornerShape(24.dp))
                        .background(LocalYugmColors.current.surfaceElevated)
                        .border(1.dp, LocalYugmColors.current.border, RoundedCornerShape(24.dp))
                        .padding(horizontal = 8.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    if (reactionCatalogError != null && reactionCatalog.isEmpty()) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                reactionCatalogError ?: "Couldn't load reactions",
                                color = LocalYugmColors.current.textSecondary,
                                fontSize = 12.sp,
                                modifier = Modifier.weight(1f)
                            )
                            TextButton(onClick = onReloadReactions) { Text("Retry", color = LocalYugmColors.current.secondary) }
                        }
                    }
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        val myReaction = currentUserId.takeIf { it.isNotBlank() }?.let { uid -> target.reactions.firstOrNull { it.userId == uid }?.type }
                        pickerReactions.forEach { reaction ->
                            val type = reaction.id
                            val isSelected = myReaction == type
                            val locked = !reaction.usable || (reaction.access == RoomReactionAccess.VIP_EXCLUSIVE && !isCurrentUserVip)
                            val lockedForVip = locked && (reaction.lockedReason == "VIP" || reaction.access == RoomReactionAccess.VIP_EXCLUSIVE)
                            Box(
                                modifier = Modifier
                                    .size(38.dp)
                                    .clip(CircleShape)
                                    .background(
                                        when {
                                            isSelected -> LocalYugmColors.current.secondary.copy(alpha = 0.3f)
                                            locked -> LocalYugmColors.current.surface.copy(alpha = 0.5f)
                                            else -> Color.Transparent
                                        }
                                    )
                                    .clickable(role = Role.Button, onClickLabel = "React with ${reaction.label.ifBlank { type }}") {
                                        if (locked) {
                                            reactDialogTarget = null
                                            if (lockedForVip) onOpenVip()
                                        } else {
                                            onReactMessage(target, type)
                                            reactDialogTarget = null
                                        }
                                    },
                                contentAlignment = Alignment.Center
                            ) {
                                ReactionArtwork(
                                    emoji = reaction.emoji.ifBlank { reactionEmoji(type) },
                                    assetUrl = reaction.assetUrl,
                                    label = reaction.label.ifBlank { type },
                                    emojiSize = 20.sp,
                                    modifier = Modifier.size(26.dp),
                                    contentDescription = reaction.label.ifBlank { type }
                                )
                                if (locked) {
                                    Box(
                                        modifier = Modifier
                                            .align(Alignment.BottomEnd)
                                            .size(14.dp)
                                            .clip(CircleShape)
                                            .background(LocalYugmColors.current.surfaceElevated),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(Icons.Default.Lock, contentDescription = if (lockedForVip) "VIP" else "Locked", tint = Color(0xFFFFD54F), modifier = Modifier.size(10.dp))
                                    }
                                }
                            }
                        }
                        if (isReactionCatalogLoading && reactionCatalog.isEmpty()) {
                            CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp, color = LocalYugmColors.current.secondary)
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
                        .offset(x = 4.dp, y = 4.dp)
                        .size(18.dp)
                        .clip(CircleShape)
                        .background(Color(0xFF1F2937))
                        .border(1.dp, Color(0xFFFFD166).copy(alpha = 0.9f), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Text("VIP", color = Color(0xFFFFD166), fontSize = 7.sp, fontWeight = FontWeight.Black)
                }
            }
        }
    }
}

@Composable
private fun ConversationOptionsMenu(
    expanded: Boolean,
    isProfileEnabled: Boolean,
    isMuted: Boolean,
    isBlockedByMe: Boolean,
    onExpandedChange: (Boolean) -> Unit,
    onProfile: () -> Unit,
    onBonds: () -> Unit,
    onSearch: () -> Unit,
    onMute: () -> Unit,
    onReport: () -> Unit,
    onToggleBlock: () -> Unit,
    onDelete: () -> Unit
) {
    val colors = LocalYugmColors.current
    Box {
        LightChatAction(
            Icons.Filled.MoreVert,
            stringResource(R.string.a11y_conversation_options),
            onClick = { onExpandedChange(!expanded) }
        )
        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { onExpandedChange(false) },
            modifier = Modifier.widthIn(min = 190.dp, max = 220.dp)
        ) {
            DropdownMenuItem(
                text = { Text("Profile", color = colors.textPrimary) },
                enabled = isProfileEnabled,
                onClick = { onExpandedChange(false); onProfile() }
            )
            DropdownMenuItem(
                text = { Text("Bonds", color = colors.textPrimary) },
                enabled = isProfileEnabled && !isBlockedByMe,
                onClick = { onExpandedChange(false); onBonds() }
            )
            DropdownMenuItem(
                text = { Text("Search in chat", color = colors.textPrimary) },
                onClick = { onExpandedChange(false); onSearch() }
            )
            DropdownMenuItem(
                text = { Text(if (isMuted) "Unmute" else "Mute", color = colors.textPrimary) },
                onClick = { onExpandedChange(false); onMute() }
            )
            DropdownMenuItem(
                text = { Text("Report", color = colors.danger) },
                onClick = { onExpandedChange(false); onReport() }
            )
            DropdownMenuItem(
                text = { Text(if (isBlockedByMe) "Unblock" else "Block", color = if (isBlockedByMe) colors.textPrimary else colors.danger) },
                onClick = { onExpandedChange(false); onToggleBlock() }
            )
            DropdownMenuItem(
                text = { Text("Delete chat", color = colors.danger) },
                onClick = { onExpandedChange(false); onDelete() }
            )
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
    reactionById: Map<String, RoomReaction> = emptyMap(),
    isCurrentUserVip: Boolean = false,
    onReact: (androidx.compose.ui.geometry.Rect) -> Unit,
    onLongPress: (androidx.compose.ui.geometry.Rect) -> Unit,
    onOpenImage: (String) -> Unit,
    onOpenRoom: (String) -> Unit = {},
    onToggleVoice: () -> Unit,
    onSeekVoice: (Int) -> Unit,
    onAudioCall: () -> Unit = {},
    onVideoCall: () -> Unit = {},
    isPendingSend: Boolean = false,
    isFailedSend: Boolean = false,
    onRetrySend: () -> Unit = {},
    onJumpToReply: (String) -> Unit = {}
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val colors = LocalYugmColors.current
    val bubble = if (mine) chatBubbleVisual(bubbleId) else null
    val bubbleText = colors.chatBubbleForeground(mine)
    val bubbleMeta = colors.chatBubbleMetadata(mine)
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
                Avatar(
                    initial = partner?.name?.firstOrNull()?.toString() ?: "?",
                    size = 28,
                    imageUrl = partner?.avatar,
                    cosmetics = partner?.activeCosmetics ?: ActiveCosmetics(),
                    accessibilityLabel = null
                )
            } else {
                Spacer(Modifier.width(42.dp))
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
                    .widthIn(max = (LocalConfiguration.current.screenWidthDp * 0.78f).dp)
                    .onGloballyPositioned { bubbleCoordinates = it }
                    .clip(bubbleShape)
                    .background(colors.chatBubbleBackground(mine))
                    .border(
                        width = if (selected || highlighted) 2.dp else 1.dp,
                        color = when {
                            highlighted -> Color(0xFFFFC107)
                            selected -> LocalYugmColors.current.primary
                            bubble?.border != null -> bubble.border
                            mine -> Color.White.copy(alpha = 0.14f)
                            else -> LocalYugmColors.current.border
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
                        Column(
                            Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(8.dp))
                                .background(bubbleText.copy(alpha = 0.08f))
                                .clickable(enabled = reply.messageId.isNotBlank(), role = Role.Button) { onJumpToReply(reply.messageId) }
                                .padding(horizontal = 8.dp, vertical = 6.dp)
                        ) {
                            Text(reply.author.ifBlank { "Replied message" }, color = LocalYugmColors.current.primary, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            Text(reply.text.ifBlank { "Media" }, color = bubbleMeta, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
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
                                    .background(bubbleText.copy(alpha = 0.08f))
                                    .padding(horizontal = 10.dp, vertical = 10.dp)
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Box(
                                        Modifier
                                            .size(34.dp)
                                            .clip(CircleShape)
                                            .background(bubbleText.copy(alpha = 0.16f))
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
                                                color = bubbleText,
                                                strokeWidth = 2.dp
                                            )
                                        } else {
                                            Icon(
                                                imageVector = if (isVoiceActive && isVoicePlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                                                contentDescription = null,
                                                tint = bubbleText,
                                                modifier = Modifier.size(18.dp)
                                            )
                                        }
                                    }
                                    Spacer(Modifier.width(10.dp))
                                    Column(Modifier.weight(1f)) {
                                        Text("Voice note", color = bubbleText, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                                        Text(
                                            when {
                                                isVoiceActive && isVoicePreparing -> "Loading…"
                                                isVoiceActive -> "${formatPlaybackTime(safeProgress)} / ${formatPlaybackTime(voiceDurationMs)}"
                                                else -> "Tap to play"
                                            },
                                            color = bubbleMeta,
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
                                            thumbColor = bubbleText,
                                            activeTrackColor = bubbleText.copy(alpha = 0.9f),
                                            inactiveTrackColor = bubbleText.copy(alpha = 0.25f)
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
                    if (message.message.startsWith("ROOM_INVITE:")) {
                        val inviteRoomId = message.message.substringAfter("ROOM_INVITE:").trim()
                        RoomInviteMessageCard(
                            roomId = inviteRoomId,
                            inviterName = partner?.name ?: "A friend",
                            onOpenRoom = onOpenRoom
                        )
                    }
                    if (message.message.isNotBlank() && !message.message.startsWith("ROOM_INVITE:")) {
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
                            val callsLockedForVip = !isCurrentUserVip
                            val callActionEnabled = !anyCallStarting && !isBlockedByMe
                            Column(
                                Modifier
                                    .clip(RoundedCornerShape(16.dp))
                                    .background(bubbleText.copy(alpha = 0.08f))
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
                                        Text(callType, color = bubbleText, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                                        Text(
                                            when {
                                                isBlockedByMe -> "Unblock to start a call"
                                                mine -> "You started a call"
                                                else -> "Call invitation"
                                            },
                                            color = bubbleMeta,
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
                                                Modifier.background(bubbleText.copy(alpha = 0.08f))
                                            }
                                        )
                                        .clickable(
                                            enabled = callActionEnabled,
                                            role = Role.Button,
                                            onClickLabel = when {
                                                isBlockedByMe -> "Unblock to call"
                                                callsLockedForVip -> if (isVideoCall) "Video call (VIP only)" else "Voice call (VIP only)"
                                                isVideoCall -> "Start video call again"
                                                else -> "Start voice call again"
                                            }
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
                                                callsLockedForVip -> "VIP only"
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
                            Text(message.message, color = bubbleText, fontSize = 14.sp, lineHeight = 20.sp)
                        }
                    }
                    Row(
                        Modifier
                            .align(Alignment.End)
                            .padding(top = if (message.message.isNotBlank()) 2.dp else 5.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        if (message.isEdited) {
                            Text("edited", color = bubbleMeta, fontSize = 10.sp)
                            Text(" · ", color = bubbleMeta, fontSize = 10.sp)
                        }
                        Text(messageTime(message.createdAt), color = bubbleMeta, fontSize = 10.sp)
                        if (mine) {
                            Spacer(Modifier.width(4.dp))
                            when {
                                isFailedSend -> Text(
                                    "Failed · Tap to retry",
                                    color = LocalYugmColors.current.danger,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    modifier = Modifier.clickable(role = Role.Button) { onRetrySend() }
                                )
                                isPendingSend -> Text(
                                    "Sending…",
                                    color = bubbleMeta,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Medium
                                )
                                else -> Text(
                                    if (message.read) "Seen" else "Sent",
                                    color = if (message.read) Color(0xFF69F0AE) else bubbleMeta,
                                    fontSize = 10.sp,
                                    fontWeight = if (message.read) FontWeight.SemiBold else FontWeight.Medium
                                )
                            }
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
                        val reaction = reactionById[type.lowercase()]
                        val emoji = reaction?.emoji?.takeIf { it.isNotBlank() } ?: reactionEmoji(type)
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                            if (reaction != null && reaction.assetUrl.isNotBlank()) {
                                ReactionArtwork(
                                    emoji = emoji,
                                    assetUrl = reaction.assetUrl,
                                    label = reaction.label.ifBlank { type },
                                    emojiSize = 10.sp,
                                    modifier = Modifier.size(14.dp),
                                    contentDescription = null
                                )
                            } else {
                                Text(
                                    emoji,
                                    color = if (type == myReaction) LocalYugmColors.current.textPrimary else LocalYugmColors.current.textSecondary,
                                    fontSize = 10.sp,
                                    fontWeight = if (type == myReaction) FontWeight.Bold else FontWeight.Medium
                                )
                            }
                            if (count > 1) {
                                Text(
                                    "$count",
                                    color = if (type == myReaction) LocalYugmColors.current.textPrimary else LocalYugmColors.current.textSecondary,
                                    fontSize = 10.sp,
                                    fontWeight = if (type == myReaction) FontWeight.Bold else FontWeight.Medium
                                )
                            }
                        }
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
                Avatar(
                    initial = "You".first().toString(),
                    size = 28,
                    imageUrl = null,
                    cosmetics = myActiveCosmetics,
                    accessibilityLabel = null
                )
            } else {
                Spacer(Modifier.width(42.dp))
            }
        }
    }
}

@Composable
private fun RoomInviteMessageCard(
    roomId: String,
    inviterName: String,
    onOpenRoom: (String) -> Unit
) {
    Column(
        Modifier.width(238.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(Brush.verticalGradient(listOf(Color(0xFFFFD452), Color(0xFFF6A62B))))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(7.dp)
    ) {
        Text("You’re invited to chat", color = Color(0xFF281B15), fontSize = 15.sp, fontWeight = FontWeight.Bold)
        Text("$inviterName invited you to their room", color = Color(0xFF493326), fontSize = 12.sp)
        androidx.compose.material3.Button(
            onClick = { if (roomId.isNotBlank()) onOpenRoom(roomId) },
            modifier = Modifier.fillMaxWidth(),
            colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = Color(0xFF0798EE))
        ) { Text("Join the room", color = Color.White) }
    }
}

private fun isNearBottom(state: androidx.compose.foundation.lazy.LazyListState): Boolean {
    if (!state.canScrollForward) return true
    val lastVisibleIndex = state.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: return false
    val lastContentIndex = (state.layoutInfo.totalItemsCount - 3).coerceAtLeast(0)
    return lastVisibleIndex >= lastContentIndex
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
