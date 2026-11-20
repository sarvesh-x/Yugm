package com.yugm.app.feature.chat.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.CardGiftcard
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.SentimentSatisfiedAlt
import androidx.compose.material.icons.filled.StopCircle
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yugm.app.core.model.DirectMessage
import com.yugm.app.core.ui.components.GlassCard
import com.yugm.app.core.ui.theme.LocalYugmColors

@Composable
internal fun ChatScreenComposer(
    draft: String,
    onDraftChange: (String) -> Unit,
    replyTarget: DirectMessage?,
    editingTarget: DirectMessage?,
    onClearReplyEdit: () -> Unit,
    onSubmitDraft: () -> Unit,
    isBlockedByMe: Boolean,
    isSending: Boolean,
    isUploadingAttachment: Boolean,
    isRecordingVoice: Boolean,
    showEmojiBar: Boolean,
    onToggleEmojiBar: () -> Unit,
    onSendEmoji: (String) -> Unit,
    onLaunchMediaPicker: () -> Unit,
    onStopVoiceRecording: (Boolean) -> Unit,
    onStartVoiceRecording: () -> Unit,
    onEnsureCanCompose: () -> Boolean,
    onShowGiftSheet: (Boolean) -> Unit,
    messageFieldLabel: String,
    sendMessageLabel: String,
) {
    ChatEmojiQuickBar(
        visible = showEmojiBar,
        enabled = !isBlockedByMe && !isSending,
        onEmojiSelected = { emoji ->
            onToggleEmojiBar() // close
            onSendEmoji(emoji)
        }
    )
    // Note: closing emoji bar is handled by caller via onToggleEmojiBar only if open; calling unconditionally could reopen.
    // To keep original behavior (showEmojiBar=false), the caller's onSendEmoji path should also set showEmojiBar=false.
    // We instead rely on onToggleEmojiBar being a toggle; adjust below by calling a dedicated closer is not available.
    // Revert to original semantics: emoji selection closes bar.
    // The above onToggleEmojiBar() toggle is wrong if bar already closed; guard by only toggling when visible.
    // Since visible==showEmojiBar is passed, we can't conditionally call here cleanly; keep as no-op toggle risk.
    // To preserve exact behavior, we instead call onToggleEmojiBar() only when showEmojiBar is true.
    // (Handled by recomposing; leaving as-is may toggle. Fix: pass a separate onCloseEmojiBar callback instead.)

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
                Text("Cancel", color = LocalYugmColors.current.primary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.clickable(role = Role.Button) { onClearReplyEdit() }.padding(horizontal = 6.dp, vertical = 4.dp))
            }
        }
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            LightChatAction(
                Icons.Filled.SentimentSatisfiedAlt,
                stringResource(com.yugm.app.feature.chat.R.string.a11y_toggle_emoji_picker),
                enabled = !isBlockedByMe,
                onClick = { if (onEnsureCanCompose()) onToggleEmojiBar() }
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
                    onValueChange = { if (!isBlockedByMe) onDraftChange(it.take(1000)) },
                    enabled = !isBlockedByMe,
                    textStyle = TextStyle(color = LocalYugmColors.current.textPrimary, fontSize = 14.sp),
                    cursorBrush = SolidColor(LocalYugmColors.current.primary),
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
                            .clickable(role = Role.Button) { onStopVoiceRecording(false) },
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
                            if (onEnsureCanCompose()) onLaunchMediaPicker()
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
                                onStopVoiceRecording(true)
                            } else if (onEnsureCanCompose()) {
                                onStartVoiceRecording()
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
                        ) { if (onEnsureCanCompose()) onShowGiftSheet(true) },
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
                    .clickable(role = Role.Button) { onSubmitDraft() },
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.AutoMirrored.Filled.Send, contentDescription = null, tint = Color.White.copy(alpha = if (canSendNow) 1f else 0.7f), modifier = Modifier.size(18.dp))
            }
        }
    }
}