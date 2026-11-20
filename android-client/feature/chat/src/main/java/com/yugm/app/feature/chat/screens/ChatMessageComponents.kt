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
internal fun MatchedBanner(name: String) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(Brush.horizontalGradient(listOf(LocalYugmColors.current.secondary.copy(alpha = 0.4f), LocalYugmColors.current.primary.copy(alpha = 0.3f)))).border(1.dp, LocalYugmColors.current.primary.copy(alpha = 0.4f), RoundedCornerShape(18.dp)).padding(14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(Modifier.size(42.dp).clip(RoundedCornerShape(13.dp)).background(Brush.linearGradient(listOf(LocalYugmColors.current.primary, LocalYugmColors.current.secondary))), contentAlignment = Alignment.Center) { Text("â™¡", color = Color.White, fontSize = 23.sp, fontWeight = FontWeight.Black) }
        Column(Modifier.padding(start = 12.dp)) {
            Text("You're Matched!", color = LocalYugmColors.current.textPrimary, fontSize = 15.sp, fontWeight = FontWeight.Black)
            Text("Say hello to $name and start your story âœ¨", color = LocalYugmColors.current.textSecondary, fontSize = 11.sp)
        }
    }
}

@Composable
internal fun EmptyConversationState(name: String) {
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
internal fun SafetyTip(onDismiss: () -> Unit) {
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(LocalYugmColors.current.surfaceElevated).border(1.dp, LocalYugmColors.current.border, RoundedCornerShape(18.dp)).padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
        Text("🛡️", color = LocalYugmColors.current.primary, fontSize = 28.sp)
        Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
            Text("Safety Tip", color = LocalYugmColors.current.secondary, fontWeight = FontWeight.Bold, fontSize = 13.sp)
            Text("Be kind, respectful and keep the conversation safe. Report or block anything that feels off.", color = LocalYugmColors.current.textSecondary, fontSize = 10.sp, lineHeight = 14.sp)
        }
        Text("Ã—", color = LocalYugmColors.current.textSecondary, fontSize = 22.sp, modifier = Modifier.clickable(onClick = onDismiss))
    }
}

@Composable
internal fun BondStrip(bond: RelationshipStatus) {
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(LocalYugmColors.current.surfaceElevated).padding(12.dp)) {
        Row { Text("Bond Level ${bond.level}", color = LocalYugmColors.current.textPrimary, fontSize = 11.sp, fontWeight = FontWeight.Bold); Spacer(Modifier.weight(1f)); Text(bond.title, color = LocalYugmColors.current.primary, fontSize = 10.sp, fontWeight = FontWeight.Bold) }
        Box(Modifier.fillMaxWidth().padding(top = 7.dp).height(4.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.08f))) {
            Box(Modifier.fillMaxWidth(bond.progress.coerceIn(0f, 1f)).height(4.dp).background(Brush.horizontalGradient(listOf(LocalYugmColors.current.secondary, LocalYugmColors.current.primary))))
        }
    }
}

@Composable
internal fun ConversationDivider(label: String, highlight: Boolean = false) {
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
internal val BubbleRadius = 20.dp
internal val BubbleTailRadius = 5.dp
internal val BubbleStackedRadius = 7.dp

internal fun messageBubbleShape(
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
internal fun MessageBubble(
    message: DirectMessage,
    mine: Boolean,
    selected: Boolean,
    highlighted: Boolean,
    bubbleId: String,
    partner: Host?,
    currentUserId: String,
    myActiveCosmetics: ActiveCosmetics,
    myAvatarUrl: String? = null,
    myAvatarType: String? = null,
    myAvatarParts: com.yugm.app.core.model.AvatarPartsPayload? = null,
    showIncomingAvatar: Boolean = !mine,
    showOutgoingAvatar: Boolean = mine,
    groupedWithPrev: Boolean = false,
    groupedWithNext: Boolean = false,
    voicePlayback: VoicePlaybackUiState? = null,
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
    val activeVoice = voicePlayback?.takeIf { it.messageId == message.id }
    val isVoiceActive = activeVoice != null
    val effectiveDuration = (activeVoice?.durationMs ?: 0).coerceAtLeast(1)
    val safeProgress = if (isVoiceActive) (activeVoice?.progressMs ?: 0).coerceIn(0, effectiveDuration) else 0
    val isVoicePreparing = activeVoice?.isPreparing == true
    val isVoicePlaying = activeVoice?.isPlaying == true
    val voiceDurationMs = activeVoice?.durationMs ?: 0
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
                    avatarType = partner?.avatarType,
                    avatarParts = partner?.avatarParts,
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
                                            YugmLoadingSpinner(size = 16.dp)
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
                                            YugmLoadingSpinner(size = 12.dp)
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
                    imageUrl = myAvatarUrl,
                    cosmetics = myActiveCosmetics,
                    avatarType = myAvatarType,
                    avatarParts = myAvatarParts,
                    accessibilityLabel = null
                )
            } else {
                Spacer(Modifier.width(42.dp))
            }
        }
    }
}

@Composable
internal fun RoomInviteMessageCard(
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
        Text("Youâ€™re invited to chat", color = Color(0xFF281B15), fontSize = 15.sp, fontWeight = FontWeight.Bold)
        Text("$inviterName invited you to their room", color = Color(0xFF493326), fontSize = 12.sp)
        androidx.compose.material3.Button(
            onClick = { if (roomId.isNotBlank()) onOpenRoom(roomId) },
            modifier = Modifier.fillMaxWidth(),
            colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = Color(0xFF0798EE))
        ) { Text("Join the room", color = Color.White) }
    }
}
