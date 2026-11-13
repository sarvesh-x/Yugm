package com.yugm.app.core.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.unit.dp
import com.yugm.app.core.ui.theme.LocalMotionEnabled

private val SlimObsidian = Color(0xFF0A0C14)
private val SlimObsidianLift = Color(0xFF161A2C)
private val SlimChampagne = Color(0xFFF5E6C4)
private val SlimWarmGold = Color(0xFFC9A24B)
private val SlimShadowGold = Color(0xFF6E5A2A)
private val SlimSoftWhite = Color(0xFFFFFCF2)

/**
 * Premium champagne double-hairline frame for the "Slim Line Frame" cosmetic.
 * Drawn as a vector so it stays crisp at every avatar and store-preview size.
 */
@Composable
fun SlimLineFrame(
    modifier: Modifier = Modifier,
    showBackdrop: Boolean = false,
    animate: Boolean = true
) {
    val motionEnabled = LocalMotionEnabled.current && animate
    val sheenAngle = if (motionEnabled) {
        val transition = rememberInfiniteTransition(label = "slim-line-frame")
        val animatedAngle by transition.animateFloat(
            initialValue = 0f,
            targetValue = 360f,
            animationSpec = infiniteRepeatable(
                animation = tween(durationMillis = 8000, easing = LinearEasing)
            ),
            label = "slim-line-sheen"
        )
        animatedAngle
    } else {
        205f
    }

    Canvas(modifier = modifier) {
        val unit = minOf(size.width, size.height)
        val center = Offset(size.width / 2f, size.height / 2f)
        val radius = unit / 2f - 2.5.dp.toPx()

        if (showBackdrop) {
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(SlimObsidianLift, SlimObsidian),
                    center = Offset(center.x, center.y * 0.72f),
                    radius = radius * 1.25f
                ),
                radius = radius - 1.dp.toPx(),
                center = center
            )
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(Color.White.copy(alpha = 0.10f), Color.Transparent),
                    center = Offset(center.x - radius * 0.35f, center.y - radius * 0.42f),
                    radius = radius * 0.9f
                ),
                radius = radius - 1.dp.toPx(),
                center = center
            )
        }

        drawCircle(
            color = SlimWarmGold.copy(alpha = 0.10f),
            radius = radius + 2.dp.toPx(),
            center = center,
            style = Stroke(width = 2.5.dp.toPx())
        )
        drawCircle(
            color = SlimChampagne.copy(alpha = 0.14f),
            radius = radius + 1.2.dp.toPx(),
            center = center,
            style = Stroke(width = 0.9.dp.toPx())
        )

        drawCircle(
            brush = Brush.sweepGradient(
                colors = listOf(
                    SlimWarmGold,
                    SlimChampagne,
                    SlimSoftWhite,
                    SlimChampagne,
                    SlimWarmGold,
                    SlimShadowGold,
                    SlimWarmGold
                ),
                center = center
            ),
            radius = radius,
            center = center,
            style = Stroke(width = 1.6.dp.toPx())
        )

        drawCircle(
            color = SlimSoftWhite.copy(alpha = 0.52f),
            radius = radius - 3.2.dp.toPx(),
            center = center,
            style = Stroke(width = 0.7.dp.toPx())
        )

        rotate(degrees = sheenAngle, pivot = center) {
            drawArc(
                brush = Brush.sweepGradient(
                    colors = listOf(
                        Color.Transparent,
                        Color.Transparent,
                        SlimSoftWhite.copy(alpha = 0.95f),
                        Color.Transparent
                    ),
                    center = center
                ),
                startAngle = -35f,
                sweepAngle = 70f,
                useCenter = false,
                topLeft = Offset(center.x - radius, center.y - radius),
                size = Size(radius * 2f, radius * 2f),
                style = Stroke(width = 1.8.dp.toPx(), cap = StrokeCap.Round)
            )
        }

        val sparkleRadius = 3.6.dp.toPx()
        val sparkleCenter = Offset(center.x, center.y - radius + sparkleRadius + 0.8.dp.toPx())
        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(
                    SlimSoftWhite.copy(alpha = 0.95f),
                    SlimChampagne.copy(alpha = 0.35f),
                    Color.Transparent
                ),
                center = sparkleCenter,
                radius = sparkleRadius * 1.8f
            ),
            radius = sparkleRadius * 1.8f,
            center = sparkleCenter
        )

        val sparkle = Path().apply {
            moveTo(sparkleCenter.x, sparkleCenter.y - sparkleRadius)
            quadraticTo(
                sparkleCenter.x + sparkleRadius * 0.18f,
                sparkleCenter.y - sparkleRadius * 0.18f,
                sparkleCenter.x + sparkleRadius,
                sparkleCenter.y
            )
            quadraticTo(
                sparkleCenter.x + sparkleRadius * 0.18f,
                sparkleCenter.y + sparkleRadius * 0.18f,
                sparkleCenter.x,
                sparkleCenter.y + sparkleRadius
            )
            quadraticTo(
                sparkleCenter.x - sparkleRadius * 0.18f,
                sparkleCenter.y + sparkleRadius * 0.18f,
                sparkleCenter.x - sparkleRadius,
                sparkleCenter.y
            )
            quadraticTo(
                sparkleCenter.x - sparkleRadius * 0.18f,
                sparkleCenter.y - sparkleRadius * 0.18f,
                sparkleCenter.x,
                sparkleCenter.y - sparkleRadius
            )
            close()
        }
        drawPath(sparkle, color = SlimSoftWhite)
    }
}
