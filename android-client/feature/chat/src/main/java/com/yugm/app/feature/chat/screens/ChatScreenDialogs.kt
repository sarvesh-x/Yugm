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

@Composable
internal fun ChatImageViewerDialog(
    url: String,
    onDismiss: () -> Unit,
    onOpenExternally: () -> Unit
) {
    Dialog(
        onDismissRequest = onDismiss,
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
                        .clickable(role = Role.Button, onClickLabel = "Open image externally") { onOpenExternally() }
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text("Open", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }
                Box(
                    Modifier
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.14f))
                        .clickable(role = Role.Button, onClickLabel = "Close image viewer") { onDismiss() }
                        .padding(10.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Filled.Close, contentDescription = null, tint = Color.White)
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun ChatGiftPickerSheet(
    gifts: List<com.yugm.app.core.model.GiftItem>,
    balance: Int,
    onDismiss: () -> Unit,
    onGift: (com.yugm.app.core.model.GiftItem) -> Unit
) {
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = LocalYugmColors.current.surface) {
        Column(Modifier.fillMaxWidth().padding(20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Send a Gift", color = LocalYugmColors.current.textPrimary, fontSize = 20.sp, fontWeight = FontWeight.Black, modifier = Modifier.weight(1f))
                Text("◆ $balance", color = Color(0xFFFFC52F), fontWeight = FontWeight.Bold)
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
                            Modifier.width(105.dp).height(132.dp).clip(RoundedCornerShape(18.dp)).background(LocalYugmColors.current.background).border(1.dp, LocalYugmColors.current.border, RoundedCornerShape(18.dp)).clickable(enabled = balance >= gift.price) { onGift(gift) }.padding(10.dp),
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
                            Text("◆ ${gift.price}", color = if (balance >= gift.price) Color(0xFFFFC52F) else LocalYugmColors.current.danger, fontSize = 10.sp)
                        }
                    }
                }
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
internal fun LightChatAction(
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
            YugmLoadingSpinner(size = 18.dp)
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
internal fun ConversationOptionsMenu(
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
internal fun ReportDialog(onDismiss: () -> Unit, onSubmit: (String) -> Unit) {
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
internal fun VipCallRequiredDialog(
    onDismiss: () -> Unit,
    onOpenVip: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = LocalYugmColors.current.surfaceElevated,
        title = { Text("VIP Exclusive Feature", color = LocalYugmColors.current.textPrimary, fontWeight = FontWeight.Bold) },
        text = { Text("Voice and video calls in 1:1 chat are available only for VIP members. Upgrade to VIP to unlock this feature.", color = LocalYugmColors.current.textSecondary) },
        confirmButton = {
            TextButton(onClick = { onDismiss(); onOpenVip() }) {
                Text("Go to VIP", color = Color(0xFFFFD166), fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Not now", color = LocalYugmColors.current.textSecondary)
            }
        }
    )
}

@Composable
internal fun DeleteConversationDialog(
    onDismiss: () -> Unit,
    onConfirm: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = LocalYugmColors.current.surfaceElevated,
        title = { Text("Delete this chat?", color = LocalYugmColors.current.textPrimary) },
        text = { Text("This removes the conversation from your inbox. The other person will still keep their copy.", color = LocalYugmColors.current.textSecondary) },
        confirmButton = { TextButton(onClick = { onDismiss(); onConfirm() }) { Text("Delete", color = LocalYugmColors.current.danger) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel", color = LocalYugmColors.current.textSecondary) } }
    )
}

@Composable
internal fun DeleteSelectedMessagesDialog(
    selectedCount: Int,
    selectedOwnCount: Int,
    onDismiss: () -> Unit,
    onDeleteForMe: () -> Unit,
    onDeleteForEveryone: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = LocalYugmColors.current.surfaceElevated,
        title = { Text(if (selectedCount == 1) "Delete message?" else "Delete selected messages?", color = LocalYugmColors.current.textPrimary) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    "Choose how to delete ${if (selectedCount == 1) "this message" else "$selectedCount messages"}.",
                    color = LocalYugmColors.current.textSecondary
                )
                Text("• Delete for me: removes it from your chat only.", color = LocalYugmColors.current.textSecondary, fontSize = 12.sp)
                if (selectedOwnCount > 0) {
                    Text("• Delete for everyone: removes ${if (selectedOwnCount == 1) "your selected message" else "$selectedOwnCount of your selected messages"} for both people.", color = LocalYugmColors.current.textSecondary, fontSize = 12.sp)
                }
            }
        },
        confirmButton = {
            Column(horizontalAlignment = Alignment.End) {
                TextButton(onClick = onDeleteForMe) { Text("Delete for me", color = LocalYugmColors.current.danger) }
                if (selectedOwnCount > 0) {
                    TextButton(onClick = onDeleteForEveryone) {
                        Text(if (selectedOwnCount == 1) "Delete for everyone" else "Delete $selectedOwnCount for everyone", color = LocalYugmColors.current.danger)
                    }
                }
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}

@Composable
internal fun MessageInfoDialog(
    message: DirectMessage,
    mine: Boolean,
    currentUserId: String,
    reactionById: Map<String, RoomReaction>,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = LocalYugmColors.current.surfaceElevated,
        title = { Text("Message info", color = LocalYugmColors.current.textPrimary) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(if (mine) "Sent by you" else "Received", color = LocalYugmColors.current.textSecondary, fontSize = 12.sp)
                Text("Time: ${com.yugm.app.feature.chat.formatMessageInfoTime(message.createdAt)}", color = LocalYugmColors.current.textPrimary, fontSize = 13.sp)
                if (mine) Text(if (message.read) "Status: Seen" else "Status: Sent", color = if (message.read) Color(0xFF69F0AE) else LocalYugmColors.current.textSecondary, fontSize = 13.sp, fontWeight = if (message.read) FontWeight.SemiBold else FontWeight.Normal)
                if (message.isEdited) Text("Edited", color = LocalYugmColors.current.textSecondary, fontSize = 13.sp)
                if (message.forwarded) Text("Forwarded message", color = LocalYugmColors.current.textSecondary, fontSize = 13.sp)
                if (message.reactions.isNotEmpty()) {
                    val summary = message.reactions
                        .groupBy { it.type }
                        .entries
                        .sortedByDescending { it.value.size }
                        .joinToString("  ") { (type, items) ->
                            val emoji = reactionById[type.lowercase()]?.emoji?.takeIf { it.isNotBlank() } ?: reactionEmoji(type)
                            "$emoji ${items.size}"
                        }
                    val mineReaction = currentUserId.takeIf { it.isNotBlank() }?.let { uid -> message.reactions.firstOrNull { it.userId == uid }?.type }
                    Text("Reactions: $summary", color = LocalYugmColors.current.textSecondary, fontSize = 13.sp)
                    if (!mineReaction.isNullOrBlank()) {
                        val mineEmoji = reactionById[mineReaction.lowercase()]?.emoji?.takeIf { it.isNotBlank() } ?: reactionEmoji(mineReaction)
                        Text("Your reaction: $mineEmoji", color = LocalYugmColors.current.textPrimary, fontSize = 13.sp)
                    }
                }
                message.replyTo?.let { reply ->
                    Text("Reply to: ${reply.author.ifBlank { "message" }} — ${reply.text.ifBlank { "Media" }}", color = LocalYugmColors.current.textSecondary, fontSize = 13.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
                if (message.mediaType.isNotBlank()) Text("Type: ${message.mediaType.lowercase().replaceFirstChar { it.uppercase() }}", color = LocalYugmColors.current.textSecondary, fontSize = 13.sp)
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Close", color = LocalYugmColors.current.secondary) } }
    )
}

@Composable
internal fun ReactionPickerOverlay(
    target: DirectMessage,
    bounds: androidx.compose.ui.geometry.Rect?,
    reactionCatalog: List<RoomReaction>,
    isReactionCatalogLoading: Boolean,
    reactionCatalogError: String?,
    currentUserId: String,
    isCurrentUserVip: Boolean,
    onDismiss: () -> Unit,
    onReloadReactions: () -> Unit,
    onReact: (String) -> Unit,
    onOpenVip: () -> Unit
) {
    var overlayOrigin by remember(target.id, bounds) { mutableStateOf(androidx.compose.ui.geometry.Offset.Zero) }
    BoxWithConstraints(
        Modifier
            .fillMaxSize()
            .onGloballyPositioned { overlayOrigin = it.boundsInRoot().topLeft }
            .background(Color.Black.copy(alpha = 0.4f))
            .clickable(role = Role.Button, onClickLabel = "Dismiss") { onDismiss() },
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

        val fallbackCatalog = remember {
            listOf(
                RoomReaction(id = "heart", label = "Heart", emoji = "\u2764\uFE0F", access = RoomReactionAccess.EVERYONE, sortOrder = 0),
                RoomReaction(id = "fire", label = "Fire", emoji = "\uD83D\uDD25", access = RoomReactionAccess.EVERYONE, sortOrder = 1),
                RoomReaction(id = "laugh", label = "Laugh", emoji = "\uD83D\uDE02", access = RoomReactionAccess.EVERYONE, sortOrder = 2),
                RoomReaction(id = "clap", label = "Clap", emoji = "\uD83D\uDC4F", access = RoomReactionAccess.EVERYONE, sortOrder = 3),
                RoomReaction(id = "wow", label = "Wow", emoji = "\uD83D\uDE2E", access = RoomReactionAccess.EVERYONE, sortOrder = 4),
                RoomReaction(id = "crown", label = "Crown", emoji = "\uD83D\uDC51", access = RoomReactionAccess.EVERYONE, sortOrder = 5),
                RoomReaction(id = "stars", label = "Stars", emoji = "\u2728", access = RoomReactionAccess.EVERYONE, sortOrder = 6),
                RoomReaction(id = "party", label = "Party", emoji = "\uD83C\uDF89", access = RoomReactionAccess.EVERYONE, sortOrder = 7)
            )
        }
        val pickerReactions = remember(reactionCatalog) {
            (if (reactionCatalog.isNotEmpty()) reactionCatalog.sortedBy { it.sortOrder } else fallbackCatalog)
                .distinctBy { it.id.trim().lowercase() }
        }

        Box(modifier = Modifier.offset(x = offsetX, y = offsetY)) {
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
                            reactionCatalogError,
                            color = LocalYugmColors.current.textSecondary,
                            fontSize = 12.sp,
                            modifier = Modifier.weight(1f)
                        )
                        TextButton(onClick = onReloadReactions) { Text("Retry", color = LocalYugmColors.current.secondary) }
                    }
                }
                Row(
                    modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
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
                                        if (lockedForVip) onOpenVip()
                                        onDismiss()
                                    } else {
                                        onReact(type)
                                        onDismiss()
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
                        YugmLoadingSpinner(size = 18.dp)
                    }
                }
            }
        }
    }
}

@Composable
internal fun MessageOptionsOverlay(
    target: DirectMessage,
    bounds: androidx.compose.ui.geometry.Rect?,
    mine: Boolean,
    canEdit: Boolean,
    onDismiss: () -> Unit,
    onInfo: () -> Unit,
    onCopy: () -> Unit,
    onEdit: () -> Unit,
    onReply: () -> Unit,
    onSelect: () -> Unit,
    onForward: () -> Unit,
    onDelete: () -> Unit
) {
    var overlayOrigin by remember(target.id, bounds) { mutableStateOf(androidx.compose.ui.geometry.Offset.Zero) }
    BoxWithConstraints(
        Modifier
            .fillMaxSize()
            .onGloballyPositioned { overlayOrigin = it.boundsInRoot().topLeft }
            .background(Color.Black.copy(alpha = 0.4f))
            .clickable(role = Role.Button, onClickLabel = "Dismiss") { onDismiss() },
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

        Box(modifier = Modifier.offset(x = offsetX, y = offsetY)) {
            Column(
                modifier = Modifier
                    .width(cardWidth)
                    .clip(RoundedCornerShape(16.dp))
                    .background(LocalYugmColors.current.surfaceElevated)
                    .border(1.dp, LocalYugmColors.current.border, RoundedCornerShape(16.dp))
                    .padding(vertical = 4.dp)
            ) {
                CompactOptionRow(icon = Icons.Filled.Info, label = "Info") { onInfo(); onDismiss() }
                CompactOptionRow(icon = Icons.Filled.ContentCopy, label = "Copy") { onCopy(); onDismiss() }
                if (mine && canEdit) {
                    CompactOptionRow(icon = Icons.Filled.Edit, label = "Edit") { onEdit(); onDismiss() }
                }
                CompactOptionRow(icon = Icons.AutoMirrored.Filled.Reply, label = "Reply") { onReply(); onDismiss() }
                CompactOptionRow(icon = Icons.Filled.CheckCircle, label = "Select") { onSelect(); onDismiss() }
                CompactOptionRow(icon = Icons.AutoMirrored.Filled.Forward, label = "Forward") { onForward(); onDismiss() }
                CompactOptionRow(icon = Icons.Filled.Delete, label = "Delete", tint = LocalYugmColors.current.danger) { onDelete(); onDismiss() }
            }
        }
    }
}

@Composable
internal fun ForwardMessageDialog(
    message: DirectMessage,
    forwardTargets: List<Host>,
    onDismiss: () -> Unit,
    onForward: (DirectMessage, List<String>, (String) -> Unit, (String) -> Unit) -> Unit
) {
    val context = LocalContext.current
    var forwardQuery by remember(message.id) { mutableStateOf("") }
    var selectedTargets by remember(message.id) { mutableStateOf<Set<String>>(emptySet()) }
    var forwarding by remember(message.id) { mutableStateOf(false) }
    val filteredTargets = remember(forwardTargets, forwardQuery) {
        val q = forwardQuery.trim().lowercase()
        if (q.isBlank()) forwardTargets else forwardTargets.filter {
            it.name.lowercase().contains(q) || it.username.lowercase().contains(q)
        }
    }
    AlertDialog(
        onDismissRequest = { if (!forwarding) onDismiss() },
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
                                    Avatar(target.name.take(1), 38, target.avatar, target.activeCosmetics, avatarType = target.avatarType, avatarParts = target.avatarParts)
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
                        message,
                        selectedTargets.toList(),
                        { msg ->
                            forwarding = false
                            onDismiss()
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
            TextButton(enabled = !forwarding, onClick = onDismiss) {
                Text("Cancel", color = LocalYugmColors.current.textSecondary)
            }
        }
    )
}
