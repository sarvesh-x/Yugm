package com.yugm.app.feature.chat.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yugm.app.core.ui.theme.LocalYugmColors

@Composable
internal fun ChatSearchBar(
    query: String,
    onQueryChange: (String) -> Unit,
    onClear: () -> Unit,
    onClose: () -> Unit
) {
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
                value = query,
                onValueChange = onQueryChange,
                singleLine = true,
                textStyle = TextStyle(color = LocalYugmColors.current.textPrimary, fontSize = 14.sp),
                cursorBrush = SolidColor(LocalYugmColors.current.primary),
                modifier = Modifier.weight(1f),
                decorationBox = { inner ->
                    Box {
                        if (query.isBlank()) Text("Search in this chat…", color = LocalYugmColors.current.textSecondary, fontSize = 14.sp)
                        inner()
                    }
                }
            )
            if (query.isNotBlank()) {
                Spacer(Modifier.width(8.dp))
                Text(
                    "Clear",
                    color = LocalYugmColors.current.textSecondary,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier
                        .clip(CircleShape)
                        .clickable(role = Role.Button, onClickLabel = "Clear search", onClick = onClear)
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
                    .clickable(role = Role.Button, onClickLabel = "Close search", onClick = onClose)
                    .padding(horizontal = 8.dp, vertical = 4.dp)
            )
        }
    }
}

@Composable
internal fun ChatEmojiQuickBar(
    visible: Boolean,
    enabled: Boolean,
    onEmojiSelected: (String) -> Unit
) {
    AnimatedVisibility(visible) {
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
                            enabled = enabled,
                            role = Role.Button,
                            onClickLabel = stickerLabel
                        ) { onEmojiSelected(emoji) },
                    contentAlignment = Alignment.Center
                ) {
                    Text(emoji, fontSize = 22.sp)
                }
            }
        }
    }
}
