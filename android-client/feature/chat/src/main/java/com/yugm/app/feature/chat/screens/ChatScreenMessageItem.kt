package com.yugm.app.feature.chat.screens

import androidx.compose.animation.core.Animatable
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Reply
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import com.yugm.app.core.model.ActiveCosmetics
import com.yugm.app.core.model.DirectMessage
import com.yugm.app.core.model.Host
import com.yugm.app.core.model.RoomReaction
import com.yugm.app.core.model.RoomType
import com.yugm.app.core.ui.theme.LocalYugmColors
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

@Composable
internal fun ChatTimelineMessageItem(
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
    showIncomingAvatar: Boolean,
    showOutgoingAvatar: Boolean,
    groupedWithPrev: Boolean,
    groupedWithNext: Boolean,
    inSearchResults: Boolean,
    selectionMode: Boolean,
    voicePlayback: VoicePlaybackUiState?,
    startingCallType: RoomType?,
    isBlockedByMe: Boolean,
    reactionById: Map<String, RoomReaction>,
    isCurrentUserVip: Boolean,
    isPendingSend: Boolean,
    isFailedSend: Boolean,
    onReact: (DirectMessage, Rect) -> Unit,
    onLongPress: (DirectMessage, Rect) -> Unit,
    onOpenImage: (String) -> Unit,
    onOpenRoom: (String) -> Unit,
    onToggleVoice: () -> Unit,
    onSeekVoice: (Int) -> Unit,
    onAudioCall: () -> Unit,
    onVideoCall: () -> Unit,
    onRetrySend: () -> Unit,
    onJumpToReply: (String) -> Unit,
    onToggleSelection: () -> Unit,
    onSwipeReply: (DirectMessage) -> Unit,
) {
    var swipeOffsetPx by remember(message.id) { mutableFloatStateOf(0f) }
    val swipeSettle = remember(message.id) { Animatable(0f) }
    var swipeReplyTriggered by remember(message.id) { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    Box(
        Modifier
            .padding(
                top = if (groupedWithPrev) 1.dp else 6.dp,
                bottom = if (groupedWithNext) 1.dp else 2.dp
            )
            .pointerInput(message.id, selectionMode, inSearchResults) {
                if (selectionMode || inSearchResults) return@pointerInput
                detectHorizontalDragGestures(
                    onDragEnd = {
                        val shouldReply = swipeOffsetPx >= 72f && !swipeReplyTriggered
                        if (shouldReply) {
                            swipeReplyTriggered = true
                            onSwipeReply(message)
                        }
                        val start = swipeOffsetPx
                        swipeReplyTriggered = false
                        scope.launch {
                            swipeSettle.snapTo(start)
                            swipeSettle.animateTo(0f)
                            swipeOffsetPx = 0f
                        }
                    },
                    onDragCancel = {
                        val start = swipeOffsetPx
                        swipeReplyTriggered = false
                        scope.launch {
                            swipeSettle.snapTo(start)
                            swipeSettle.animateTo(0f)
                            swipeOffsetPx = 0f
                        }
                    },
                    onHorizontalDrag = { _, dragAmount ->
                        swipeOffsetPx = (swipeOffsetPx + dragAmount).coerceIn(0f, 96f)
                    }
                )
            }
    ) {
        val displaySwipe = if (swipeSettle.isRunning) swipeSettle.value else swipeOffsetPx
        if (displaySwipe > 8f) {
            Icon(
                Icons.AutoMirrored.Filled.Reply,
                contentDescription = null,
                tint = LocalYugmColors.current.secondary.copy(alpha = (displaySwipe / 72f).coerceIn(0.25f, 1f)),
                modifier = Modifier.align(Alignment.CenterStart).padding(start = 4.dp)
            )
        }
        Box(Modifier.offset { IntOffset(displaySwipe.roundToInt(), 0) }) {
            MessageBubble(
                message = message,
                mine = mine,
                selected = selected,
                highlighted = highlighted,
                bubbleId = bubbleId,
                partner = partner,
                currentUserId = currentUserId,
                myActiveCosmetics = myActiveCosmetics,
                myAvatarUrl = myAvatarUrl,
                myAvatarType = myAvatarType,
                myAvatarParts = myAvatarParts,
                showIncomingAvatar = showIncomingAvatar,
                showOutgoingAvatar = showOutgoingAvatar,
                groupedWithPrev = groupedWithPrev,
                groupedWithNext = groupedWithNext,
                voicePlayback = voicePlayback,
                startingCallType = startingCallType,
                isBlockedByMe = isBlockedByMe,
                reactionById = reactionById,
                isCurrentUserVip = isCurrentUserVip,
                onReact = { bounds -> onReact(message, bounds) },
                onLongPress = { bounds -> onLongPress(message, bounds) },
                onOpenImage = onOpenImage,
                onOpenRoom = onOpenRoom,
                onToggleVoice = onToggleVoice,
                onSeekVoice = onSeekVoice,
                onAudioCall = onAudioCall,
                onVideoCall = onVideoCall,
                isPendingSend = isPendingSend,
                isFailedSend = isFailedSend,
                onRetrySend = onRetrySend,
                onJumpToReply = onJumpToReply
            )
        }
    }
}
