package com.example.yugm.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.ui.theme.Danger
import com.example.yugm.ui.theme.Gold
import com.example.yugm.ui.theme.Line
import com.example.yugm.ui.theme.PanelStrong
import com.example.yugm.ui.theme.TextPrimary

@Composable
fun ControlButton(text: String, active: Boolean = false, danger: Boolean = false, onClick: () -> Unit) {
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
        shape = RoundedCornerShape(8.dp),
        modifier = Modifier
            .height(54.dp)
            .graphicsLayer {
                scaleX = scale
                scaleY = scale
            }
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                onClick = onClick
            )
    ) {
        Box(contentAlignment = Alignment.Center, modifier = Modifier.padding(horizontal = 14.dp)) {
            Text(text, color = TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Black)
        }
    }
}
