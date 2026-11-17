package com.yugm.app.core.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.yugm.app.core.ui.theme.LocalMotionEnabled

@Composable
fun AnimatedEqualizer(
    modifier: Modifier = Modifier,
    barCount: Int = 3,
    color: Color = Color.White,
    barWidth: Dp = 2.5.dp,
    barSpacing: Dp = 2.dp,
    maxHeight: Dp = 14.dp
) {
    val motionEnabled = LocalMotionEnabled.current
    if (!motionEnabled) {
        Canvas(modifier = modifier.size(width = (barWidth + barSpacing) * barCount, height = maxHeight)) {
            val totalBarWidthPx = barWidth.toPx()
            val spacingPx = barSpacing.toPx()
            val maxH = size.height
            val heights = listOf(0.4f, 0.9f, 0.6f, 0.8f, 0.5f)
            for (i in 0 until barCount) {
                val h = maxH * heights[i % heights.size]
                val x = i * (totalBarWidthPx + spacingPx)
                drawRoundRect(
                    color = color,
                    topLeft = Offset(x, maxH - h),
                    size = Size(totalBarWidthPx, h),
                    cornerRadius = CornerRadius(totalBarWidthPx / 2, totalBarWidthPx / 2)
                )
            }
        }
        return
    }

    val transition = rememberInfiniteTransition(label = "equalizer-anim")
    val heights = List(barCount) { index ->
        val duration = 400 + (index * 130) % 350
        transition.animateFloat(
            initialValue = 0.25f,
            targetValue = 0.95f,
            animationSpec = infiniteRepeatable(
                animation = tween(durationMillis = duration, easing = FastOutSlowInEasing),
                repeatMode = RepeatMode.Reverse
            ),
            label = "bar-$index"
        )
    }

    Canvas(modifier = modifier.size(width = (barWidth + barSpacing) * barCount, height = maxHeight)) {
        val totalBarWidthPx = barWidth.toPx()
        val spacingPx = barSpacing.toPx()
        val maxH = size.height
        for (i in 0 until barCount) {
            val h = (maxH * heights[i].value).coerceAtLeast(3.dp.toPx())
            val x = i * (totalBarWidthPx + spacingPx)
            drawRoundRect(
                color = color,
                topLeft = Offset(x, maxH - h),
                size = Size(totalBarWidthPx, h),
                cornerRadius = CornerRadius(totalBarWidthPx / 2, totalBarWidthPx / 2)
            )
        }
    }
}
