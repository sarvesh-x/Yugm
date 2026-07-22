package com.example.yugm.core.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.random.Random
import androidx.compose.material3.Text

data class FloatingEmoji(
    val id: String,
    val emoji: String,
    val userName: String = ""
)

@Composable
fun FloatingEmojiOverlay(
    emojis: List<FloatingEmoji>,
    modifier: Modifier = Modifier
) {
    if (emojis.isEmpty()) return
    Box(modifier = modifier) {
        emojis.forEach { emoji ->
            key(emoji.id) {
                FloatingEmojiItem(emoji = emoji)
            }
        }
    }
}

@Composable
private fun FloatingEmojiItem(emoji: FloatingEmoji) {
    val startX = remember { Random.nextInt(-100, 100) }
    val endX = startX + Random.nextInt(-40, 40)
    val driftY = remember { Random.nextInt(-180, -80) }
    val textSize = remember { Random.nextInt(28, 48) }

    val progress = remember { Animatable(0f) }

    LaunchedEffect(emoji.id) {
        progress.animateTo(
            targetValue = 1f,
            animationSpec = tween(durationMillis = 1800, easing = LinearEasing)
        )
    }

    Box(
        modifier = Modifier
            .offset {
                val p = progress.value
                IntOffset(
                    x = (startX + (endX - startX) * p).dp.roundToPx(),
                    y = (driftY * p).dp.roundToPx()
                )
            }
            .graphicsLayer {
                alpha = 1f - progress.value
                scaleX = 1f - progress.value * 0.4f
                scaleY = 1f - progress.value * 0.4f
            }
    ) {
        Text(
            text = emoji.emoji,
            fontSize = textSize.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.size((textSize + 8).dp)
        )
    }
}
