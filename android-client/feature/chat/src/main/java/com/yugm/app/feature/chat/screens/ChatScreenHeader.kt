package com.yugm.app.feature.chat.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Forward
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yugm.app.core.model.ActiveCosmetics
import com.yugm.app.core.model.Host
import com.yugm.app.core.model.RoomType
import com.yugm.app.core.ui.components.Avatar
import com.yugm.app.core.ui.components.GlassCard
import com.yugm.app.core.ui.theme.LocalYugmColors

@Composable
internal fun ChatScreenHeader(
    selectionMode: Boolean,
    selectedCount: Int,
    selectedMessage: com.yugm.app.core.model.DirectMessage?,
    selectedOwnCount: Int,
    partner: Host?,
    isMuted: Boolean,
    isBlockedByMe: Boolean,
    startingCallType: RoomType?,
    isCurrentUserVip: Boolean,
    showMore: Boolean,
    onToggleMore: (Boolean) -> Unit,
    searchVisible: Boolean,
    onToggleSearch: () -> Unit,
    isMatched: Boolean,
    defaultMatchName: String,
    onBack: () -> Unit,
    onOpenProfile: (String) -> Unit,
    onOpenBonds: (String) -> Unit,
    gatedAudioCall: () -> Unit,
    gatedVideoCall: () -> Unit,
    onMute: (Boolean) -> Unit,
    onReport: () -> Unit,
    onToggleBlock: () -> Unit,
    onDeleteConversation: () -> Unit,
    onOpenVip: () -> Unit,
    onCancelSelection: () -> Unit,
    onCopySelected: () -> Unit,
    onForwardSelected: () -> Unit,
    onDeleteSelected: () -> Unit,
) {
    GlassCard(
        modifier = Modifier.fillMaxWidth(),
        gradient = Brush.linearGradient(listOf(chatHeaderSurface(LocalYugmColors.current.isDark), chatHeaderSurface(LocalYugmColors.current.isDark))),
        borderGradient = Brush.horizontalGradient(listOf(LocalYugmColors.current.border, LocalYugmColors.current.border)),
        cornerRadius = 0.dp,
        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 10.dp)
    ) {
        if (selectionMode) {
            Row(
                Modifier.fillMaxWidth().padding(vertical = 2.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                IconButton(onClick = onCancelSelection) {
                    Icon(Icons.Filled.Close, contentDescription = "Cancel selection", tint = LocalYugmColors.current.textSecondary)
                }
                Text(
                    "$selectedCount selected",
                    color = LocalYugmColors.current.textPrimary,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(start = 2.dp)
                )
                Spacer(Modifier.weight(1f))
                if (selectedCount == 1 && selectedMessage != null) {
                    if (selectedMessage.message.isNotBlank()) {
                        IconButton(onClick = onCopySelected) { Icon(Icons.Filled.ContentCopy, contentDescription = "Copy", tint = LocalYugmColors.current.textPrimary) }
                    }
                    IconButton(onClick = onForwardSelected) { Icon(Icons.AutoMirrored.Filled.Forward, contentDescription = "Forward", tint = LocalYugmColors.current.textPrimary) }
                }
                IconButton(onClick = onDeleteSelected) {
                    Icon(Icons.Filled.Delete, contentDescription = "Delete", tint = LocalYugmColors.current.danger)
                }
            }
        } else Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            LightChatAction(Icons.AutoMirrored.Filled.ArrowBack, stringResource(com.yugm.app.feature.chat.R.string.a11y_back), onClick = onBack)
            Spacer(Modifier.width(10.dp))
            Box(
                Modifier.size(48.dp).clip(CircleShape).clickable(enabled = !partner?.id.isNullOrBlank(), role = androidx.compose.ui.semantics.Role.Button) {
                    partner?.id?.takeIf(String::isNotBlank)?.let(onOpenProfile)
                }
            ) {
                Avatar(partner?.name?.take(1) ?: "?", 34, partner?.avatar, partner?.activeCosmetics ?: ActiveCosmetics(), avatarType = partner?.avatarType, avatarParts = partner?.avatarParts, accessibilityLabel = stringResource(com.yugm.app.feature.chat.R.string.a11y_profile_picture, partner?.name ?: defaultMatchName))
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
                onExpandedChange = onToggleMore,
                onProfile = { partner?.id?.takeIf(String::isNotBlank)?.let(onOpenProfile) },
                onBonds = { partner?.id?.takeIf(String::isNotBlank)?.let(onOpenBonds) },
                onSearch = onToggleSearch,
                onMute = { onMute(!isMuted) },
                onReport = onReport,
                onToggleBlock = onToggleBlock,
                onDelete = onDeleteConversation
            )
        }
    }
}

private fun chatHeaderSurface(dark: Boolean) = if (dark) Color(0xFF1C182D) else Color.White
