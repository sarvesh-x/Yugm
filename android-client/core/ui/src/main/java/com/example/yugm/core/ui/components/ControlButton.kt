package com.example.yugm.core.ui.components

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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
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
import com.example.yugm.core.ui.theme.Danger
import com.example.yugm.core.ui.theme.Gold
import com.example.yugm.core.ui.theme.Line
import com.example.yugm.core.ui.theme.PanelStrong
import com.example.yugm.core.ui.theme.TextPrimary

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
    val scale by animateFloatAsState(if (pressed) 0.94f else 1f, label = "control-scale")
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
                indication = null,
                role = Role.Button,
                onClickLabel = accessibilityLabel,
                onClick = onClick
            )
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(horizontal = 7.dp, vertical = 8.dp)) {
            Text(controlGlyph(text), color = if (danger) Danger else if (active) Gold else TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Black)
            Text(text, color = TextPrimary, fontSize = 11.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

private fun controlGlyph(text: String): String = when {
    text.contains("mute", true) || text.contains("mic", true) || text.contains("speak", true) -> "◖"
    text.contains("cam", true) -> "▣"
    text.contains("flip", true) -> "↻"
    text.contains("gift", true) -> "♢"
    text.contains("react", true) -> "♡"
    text.contains("invite", true) -> "+"
    text.contains("share", true) -> "⇧"
    text.contains("leave", true) -> "↪"
    text == "DM" -> "●●"
    text.contains("PK", true) -> "⚡"
    text.contains("end", true) || text.contains("remove", true) -> "⌁"
    text.contains("report", true) -> "⚑"
    else -> "•"
}
