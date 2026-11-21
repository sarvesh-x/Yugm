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
import com.yugm.app.core.ui.components.YugmBackground
import com.yugm.app.core.ui.components.YugmBackgroundStyle
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
import com.yugm.app.core.ui.components.YugmLoadingSpinner

// Theme-aware palette is read via LocalYugmColors inside composables.

private fun chatCanvas(dark: Boolean) = if (dark) Color(0xFF100D1D) else Color(0xFFFAF8FC)
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(
    partner: Host?,
    currentUserId: String,
    myActiveCosmetics: ActiveCosmetics = ActiveCosmetics(),
    myAvatarUrl: String? = null,
    myAvatarType: String? = null,
    myAvatarParts: com.yugm.app.core.model.AvatarPartsPayload? = null,
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
    val visibleMessages = remember(messages, searchQuery, searchResults) {
        when {
            searchQuery.length >= 2 -> searchResults.orEmpty()
            searchQuery.isNotBlank() -> messages.filter { it.message.contains(searchQuery, ignoreCase = true) }
            else -> messages
        }
    }
    val selectionMode = selectedMessageIds.isNotEmpty()
    BackHandler(enabled = selectionMode) { selectedMessageIds = emptySet() }
    val selectedMessages = remember(visibleMessages, selectedMessageIds) {
        visibleMessages.filter { it.id in selectedMessageIds }
    }
    val selectedOwnIds = remember(selectedMessages, currentUserId) {
        selectedMessages.asSequence().filter { it.senderId == currentUserId }.map { it.id }.toList()
    }
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
        VipCallRequiredDialog(
            onDismiss = { showVipCallDialog = false },
            onOpenVip = onOpenVip
        )
    }

    if (confirmDeleteChat) {
        DeleteConversationDialog(
            onDismiss = { confirmDeleteChat = false },
            onConfirm = onDeleteConversation
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
        ForwardMessageDialog(
            message = selected,
            forwardTargets = forwardTargets,
            onDismiss = { forwardMessage = null },
            onForward = onForward
        )
    }
    infoMessage?.let { msg ->
        MessageInfoDialog(
            message = msg,
            mine = msg.senderId == currentUserId,
            currentUserId = currentUserId,
            reactionById = reactionById,
            onDismiss = { infoMessage = null }
        )
    }
    if (showDeleteSelected) {
        DeleteSelectedMessagesDialog(
            selectedCount = selectedMessageIds.size,
            selectedOwnCount = selectedOwnIds.size,
            onDismiss = { showDeleteSelected = false },
            onDeleteForMe = {
                onDeleteSelected(selectedMessageIds.toList(), "ME")
                selectedMessageIds = emptySet()
                showDeleteSelected = false
            },
            onDeleteForEveryone = {
                onDeleteSelected(selectedOwnIds, "EVERYONE")
                selectedMessageIds = emptySet()
                showDeleteSelected = false
            }
        )
    }
    val maxAttachmentBytes = 25L * 1024 * 1024
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
                    val declaredSize = runCatching {
                        context.contentResolver.query(uri, arrayOf(android.provider.OpenableColumns.SIZE), null, null, null)?.use { cursor ->
                            val idx = cursor.getColumnIndex(android.provider.OpenableColumns.SIZE)
                            if (cursor.moveToFirst() && idx >= 0 && !cursor.isNull(idx)) cursor.getLong(idx) else null
                        }
                    }.getOrNull()
                    if (declaredSize != null && declaredSize > maxAttachmentBytes) {
                        return@withContext Triple(Result.failure<ByteArray>(AttachmentTooLargeException(maxAttachmentBytes)), mime, name)
                    }
                    val result = runCatching {
                        context.contentResolver.openInputStream(uri)?.use { input ->
                            readBytesBounded(input, maxAttachmentBytes)
                        } ?: throw java.io.IOException("Couldn't read selected file")
                    }
                    Triple(result, mime, name)
                }
                payload.first
                    .onSuccess { bytes -> onAttachmentSelected(bytes, payload.second, payload.third) }
                    .onFailure { err ->
                        val message = when (err) {
                            is AttachmentTooLargeException -> "File is too large (max 25 MB)"
                            else -> "Couldn't read selected file"
                        }
                        android.widget.Toast.makeText(context, message, android.widget.Toast.LENGTH_SHORT).show()
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
                val sendResult = withContext(Dispatchers.IO) {
                    runCatching {
                        recorded.inputStream().use { input -> readBytesBounded(input, maxAttachmentBytes) }
                    }
                }
                sendResult
                    .onSuccess { bytes ->
                        if (bytes.isNotEmpty()) {
                            onAttachmentSelected(bytes, "audio/mp4", recorded.name.ifBlank { "voice-note.m4a" })
                        } else {
                            android.widget.Toast.makeText(context, "Couldn't send voice note", android.widget.Toast.LENGTH_SHORT).show()
                        }
                    }
                    .onFailure {
                        val message = if (it is AttachmentTooLargeException) "Voice note is too large (max 25 MB)" else "Couldn't send voice note"
                        android.widget.Toast.makeText(context, message, android.widget.Toast.LENGTH_SHORT).show()
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

    YugmBackground(style = YugmBackgroundStyle.Minimal) {
        Column(Modifier.fillMaxSize().statusBarsPadding()) {
                ChatScreenHeader(
                    selectionMode = selectionMode,
                    selectedCount = selectedMessageIds.size,
                    selectedMessage = selectedMessages.firstOrNull(),
                    selectedOwnCount = selectedOwnIds.size,
                    partner = partner,
                    isMuted = isMuted,
                    isBlockedByMe = isBlockedByMe,
                    startingCallType = startingCallType,
                    isCurrentUserVip = isCurrentUserVip,
                    showMore = showMore,
                    onToggleMore = { showMore = it },
                    searchVisible = searchVisible,
                    onToggleSearch = {
                        if (searchVisible) { searchVisible = false; searchQuery = "" } else searchVisible = true
                    },
                    isMatched = isMatched,
                    defaultMatchName = defaultMatchName,
                    onBack = onBack,
                    onOpenProfile = onOpenProfile,
                    onOpenBonds = onOpenBonds,
                    gatedAudioCall = gatedAudioCall,
                    gatedVideoCall = gatedVideoCall,
                    onMute = onMute,
                    onReport = { showReportDialog = true },
                    onToggleBlock = onToggleBlock,
                    onDeleteConversation = { confirmDeleteChat = true },
                    onOpenVip = onOpenVip,
                    onCancelSelection = { selectedMessageIds = emptySet() },
                    onCopySelected = {
                        val selected = selectedMessages.firstOrNull()
                        if (selected != null && selected.message.isNotBlank()) {
                            val clipboard = context.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                            clipboard.setPrimaryClip(android.content.ClipData.newPlainText("message", selected.message))
                            android.widget.Toast.makeText(context, "Message copied", android.widget.Toast.LENGTH_SHORT).show()
                        }
                        selectedMessageIds = emptySet()
                    },
                    onForwardSelected = {
                        forwardMessage = selectedMessages.firstOrNull()
                        selectedMessageIds = emptySet()
                    },
                    onDeleteSelected = { showDeleteSelected = true }
                )
                if (searchVisible) {
                    ChatSearchBar(
                        query = searchQuery,
                        onQueryChange = { searchQuery = it.take(100) },
                        onClear = { searchQuery = ""; onSearch("") },
                        onClose = {
                            searchVisible = false
                            searchQuery = ""
                            onSearch("")
                        }
                    )
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
                                YugmLoadingSpinner(size = 40.dp)
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
                                ChatTimelineMessageItem(
                                    message = message,
                                    mine = mine,
                                    selected = message.id in selectedMessageIds,
                                    highlighted = highlightedMessageId == message.id,
                                    bubbleId = myActiveCosmetics.chatBubble,
                                    partner = partner,
                                    currentUserId = currentUserId,
                                    myActiveCosmetics = myActiveCosmetics,
                                    myAvatarUrl = myAvatarUrl,
                                    myAvatarType = myAvatarType,
                                    myAvatarParts = myAvatarParts,
                                    showIncomingAvatar = !mine && !groupedWithNext,
                                    showOutgoingAvatar = mine && !groupedWithNext,
                                    groupedWithPrev = groupedWithPrev,
                                    groupedWithNext = groupedWithNext,
                                    inSearchResults = inSearchResults,
                                    selectionMode = selectionMode,
                                    voicePlayback = if (playingVoiceMessageId == message.id) VoicePlaybackUiState(playingVoiceMessageId, isVoicePlaying, isVoicePreparing, voiceProgressMs, voiceDurationMs) else null,
                                    startingCallType = startingCallType,
                                    isBlockedByMe = isBlockedByMe,
                                    reactionById = reactionById,
                                    isCurrentUserVip = isCurrentUserVip,
                                    isPendingSend = message.id in sendingMessageIds,
                                    isFailedSend = message.id in failedMessageIds,
                                    onReact = { msg, bounds ->
                                        when {
                                            selectionMode -> toggleSelection(msg.id)
                                            inSearchResults -> jumpToMessage(msg)
                                            msg.id.isNotBlank() -> {
                                                targetMessageBounds = bounds
                                                optionsDialogTarget = null
                                                reactDialogTarget = msg
                                            }
                                        }
                                    },
                                    onLongPress = { msg, bounds ->
                                        if (msg.id.isBlank()) return@ChatTimelineMessageItem
                                        if (selectionMode) {
                                            toggleSelection(msg.id)
                                        } else {
                                            targetMessageBounds = bounds
                                            reactDialogTarget = null
                                            optionsDialogTarget = msg
                                        }
                                    },
                                    onOpenImage = { url -> imageViewerUrl = url },
                                    onOpenRoom = onOpenRoom,
                                    onToggleVoice = { toggleVoicePlayback(message) },
                                    onSeekVoice = { pos -> seekVoicePlayback(message.id, pos) },
                                    onAudioCall = gatedAudioCall,
                                    onVideoCall = gatedVideoCall,
                                    onRetrySend = { onRetrySend(message.id) },
                                    onJumpToReply = { replyId ->
                                        val target = messages.firstOrNull { it.id == replyId }
                                        if (target != null) jumpToMessage(target)
                                        else android.widget.Toast.makeText(context, "Original message isn't loaded yet.", android.widget.Toast.LENGTH_SHORT).show()
                                    },
                                    onToggleSelection = { toggleSelection(message.id) },
                                    onSwipeReply = { msg ->
                                        replyTarget = msg
                                        editingTarget = null
                                        draft = ""
                                        selectedMessageIds = emptySet()
                                    }
                                )
                            }
                            if (isPartnerTyping) item {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Avatar(partner?.name?.take(1) ?: "?", 30, partner?.avatar, partner?.activeCosmetics ?: com.yugm.app.core.model.ActiveCosmetics(), avatarType = partner?.avatarType, avatarParts = partner?.avatarParts, accessibilityLabel = stringResource(R.string.a11y_profile_picture, partner?.name ?: defaultMatchName))
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

                ChatScreenComposer(
                    draft = draft,
                    onDraftChange = { draft = it },
                    replyTarget = replyTarget,
                    editingTarget = editingTarget,
                    onClearReplyEdit = { replyTarget = null; editingTarget = null; draft = "" },
                    onSubmitDraft = { submitDraft() },
                    isBlockedByMe = isBlockedByMe,
                    isSending = isSending,
                    isUploadingAttachment = isUploadingAttachment,
                    isRecordingVoice = isRecordingVoice,
                    showEmojiBar = showEmojiBar,
                    onToggleEmojiBar = { showEmojiBar = !showEmojiBar },
                    onSendEmoji = { emoji -> showEmojiBar = false; onSend(emoji, {}, {}) },
                    onLaunchMediaPicker = { mediaPicker.launch(arrayOf("image/*", "video/*")) },
                    onStopVoiceRecording = { send -> stopVoiceRecording(send) },
                    onStartVoiceRecording = {
                        val granted = androidx.core.content.ContextCompat.checkSelfPermission(context, android.Manifest.permission.RECORD_AUDIO) == android.content.pm.PackageManager.PERMISSION_GRANTED
                        if (granted) startVoiceRecording() else audioPermissionLauncher.launch(android.Manifest.permission.RECORD_AUDIO)
                    },
                    onEnsureCanCompose = { ensureCanCompose() },
                    onShowGiftSheet = { showGiftSheet = it },
                    messageFieldLabel = messageFieldLabel,
                    sendMessageLabel = sendMessageLabel
                )
            }
        imageViewerUrl?.let { url ->
            ChatImageViewerDialog(
                url = url,
                onDismiss = { imageViewerUrl = null },
                onOpenExternally = { openChatMedia(context, url) }
            )
        }
        if (showGiftSheet) {
            ChatGiftPickerSheet(
                gifts = gifts,
                balance = balance,
                onDismiss = { showGiftSheet = false },
                onGift = { gift -> onGift(gift); showGiftSheet = false }
            )
        }
    }

    reactDialogTarget?.let { target ->
        ReactionPickerOverlay(
            target = target,
            bounds = targetMessageBounds,
            reactionCatalog = reactionCatalog,
            isReactionCatalogLoading = isReactionCatalogLoading,
            reactionCatalogError = reactionCatalogError,
            currentUserId = currentUserId,
            isCurrentUserVip = isCurrentUserVip,
            onDismiss = { reactDialogTarget = null },
            onReloadReactions = onReloadReactions,
            onReact = { type -> onReactMessage(target, type) },
            onOpenVip = onOpenVip
        )
    }

    optionsDialogTarget?.let { target ->
        val mine = target.senderId == currentUserId
        MessageOptionsOverlay(
            target = target,
            bounds = targetMessageBounds,
            mine = mine,
            canEdit = mine && target.canStillEdit(),
            onDismiss = { optionsDialogTarget = null },
            onInfo = { infoMessage = target },
            onCopy = {
                if (target.message.isNotBlank()) {
                    val clipboard = context.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                    clipboard.setPrimaryClip(android.content.ClipData.newPlainText("message", target.message))
                    android.widget.Toast.makeText(context, "Message copied", android.widget.Toast.LENGTH_SHORT).show()
                }
            },
            onEdit = {
                editingTarget = target
                replyTarget = null
                draft = target.message
            },
            onReply = {
                replyTarget = target
                editingTarget = null
                draft = ""
            },
            onSelect = {
                selectedMessageIds = if (target.id in selectedMessageIds) selectedMessageIds else selectedMessageIds + target.id
            },
            onForward = { forwardMessage = target },
            onDelete = {
                selectedMessageIds = setOf(target.id)
                showDeleteSelected = true
            }
        )
    }
}
