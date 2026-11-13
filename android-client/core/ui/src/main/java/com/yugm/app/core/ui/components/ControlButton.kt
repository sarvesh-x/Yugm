package com.yugm.app.core.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.Icon
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.CardGiftcard
import androidx.compose.material.icons.filled.ChatBubble
import androidx.compose.material.icons.filled.EmojiEmotions
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MicOff
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Palette
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.PictureInPictureAlt
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.StopCircle
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material.icons.filled.VolumeOff
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yugm.app.core.ui.theme.Danger
import com.yugm.app.core.ui.theme.Gold
import com.yugm.app.core.ui.theme.Line
import com.yugm.app.core.ui.theme.PanelStrong
import com.yugm.app.core.ui.theme.TextPrimary
import com.yugm.app.core.ui.theme.LocalMotionEnabled

@Composable
fun ControlButton(
    text: String,
    active: Boolean = false,
    danger: Boolean = false,
    accessibilityLabel: String = text,
    onClick: () -> Unit
) {
    val interactionSource = remember { MutableInteractionSource() }
    val pressed by interactionSource.collectIsPressedAsState()
    val scale = if (LocalMotionEnabled.current) {
        val animatedScale by animateFloatAsState(if (pressed) 0.94f else 1f, label = "control-scale")
        animatedScale
    } else 1f
    val container by animateColorAsState(
        targetValue = when {
            danger -> Danger.copy(alpha = if (pressed) 0.34f else 0.20f)
            active -> Gold.copy(alpha = if (pressed) 0.34f else 0.20f)
            else -> PanelStrong.copy(alpha = if (pressed) 0.86f else 1f)
        },
        label = "control-container"
    )
    val border by animateColorAsState(
        targetValue = when {
            danger -> Danger
            active -> Gold
            else -> Line
        },
        label = "control-border"
    )
    Surface(
        color = container,
        border = BorderStroke(1.dp, border),
        shape = RoundedCornerShape(18.dp),
        modifier = Modifier
            .width(68.dp)
            .height(72.dp)
            .graphicsLayer {
                scaleX = scale
                scaleY = scale
            }
            .semantics { contentDescription = accessibilityLabel }
            .clickable(
                interactionSource = interactionSource,
                role = Role.Button,
                onClickLabel = accessibilityLabel,
                onClick = onClick
            )
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(horizontal = 7.dp, vertical = 8.dp)) {
            Icon(controlIcon(text), contentDescription = null, modifier = Modifier.size(22.dp), tint = if (danger) Danger else if (active) Gold else TextPrimary)
            Text(text, color = TextPrimary, fontSize = 11.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

private fun controlIcon(text: String): ImageVector = when {
    text.contains("unmute", true) -> Icons.Filled.Mic
    text.contains("mute", true) || text.contains("mic", true) || text.contains("speak", true) -> Icons.Filled.MicOff
    text.contains("cam", true) -> Icons.Filled.Videocam
    text.contains("gift", true) -> Icons.Filled.CardGiftcard
    text.contains("react", true) -> Icons.Filled.EmojiEmotions
    text.contains("invite", true) -> Icons.Filled.PersonAdd
    text.contains("share", true) -> Icons.Filled.Share
    text.contains("minimize", true) || text.contains("keep room", true) -> Icons.Filled.PictureInPictureAlt
    text == "DM" -> Icons.Filled.ChatBubble
    text.contains("PK", true) -> Icons.Filled.Bolt
    text.contains("mode", true) -> Icons.Filled.EmojiEvents
    text.contains("theme", true) -> Icons.Filled.Palette
    text.contains("end", true) || text.contains("remove", true) -> Icons.Filled.StopCircle
    text.contains("report", true) -> Icons.Filled.Flag
    text.contains("leave", true) || text.contains("exit", true) -> Icons.Filled.ExitToApp
    text.contains("lock", true) -> Icons.Filled.Lock
    text.contains("volume", true) -> if (text.contains("off", true)) Icons.Filled.VolumeOff else Icons.Filled.VolumeUp
    else -> Icons.Filled.Mic
}
