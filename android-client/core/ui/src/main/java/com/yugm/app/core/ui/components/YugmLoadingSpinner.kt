package com.yugm.app.core.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.yugm.app.core.ui.theme.BrandOrange
import com.yugm.app.core.ui.theme.BrandPink
import com.yugm.app.core.ui.theme.BrandViolet
import com.yugm.app.core.ui.theme.LocalMotionEnabled
import com.yugm.app.core.ui.theme.LocalYugmColors

/**
 * App-wide loading spinner rendered with official Yugm brand gradient (Sunset Orange -> Vibe Pink -> Electric Violet).
 * Includes a theme-aware background track ensuring high visibility in both Light and Dark modes.
 */
@Composable
fun YugmLoadingSpinner(
    modifier: Modifier = Modifier,
    size: Dp = 40.dp,
    contentDescription: String = "Loading"
) {
    val motionEnabled = LocalMotionEnabled.current
    val colors = LocalYugmColors.current

    val infiniteTransition = rememberInfiniteTransition(label = "yugm_spinner_rotation")
    val rotationAngle by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(1100, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "yugm_spinner_angle"
    )

    val currentRotation = if (motionEnabled) rotationAngle else 0f
    val strokeWidth = (size * 0.1f).coerceIn(2.5.dp, 5.dp)

    Box(
        modifier = modifier
            .size(size)
            .semantics { this.contentDescription = contentDescription },
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val strokePx = strokeWidth.toPx()
            val arcSize = Size(this.size.width - strokePx, this.size.height - strokePx)
            val topLeft = Offset(strokePx / 2f, strokePx / 2f)

            // Subtle background track for high contrast & visibility across both Light and Dark themes
            val trackColor = if (colors.isDark) {
                Color.White.copy(alpha = 0.15f)
            } else {
                Color(0xFF20182A).copy(alpha = 0.12f)
            }

            drawArc(
                color = trackColor,
                startAngle = 0f,
                sweepAngle = 360f,
                useCenter = false,
                topLeft = topLeft,
                size = arcSize,
                style = Stroke(width = strokePx, cap = StrokeCap.Round)
            )

            // Rotating sweep gradient featuring official Yugm brand colors
            val brandSweepBrush = Brush.sweepGradient(
                colors = listOf(
                    BrandOrange,
                    BrandPink,
                    BrandViolet,
                    BrandOrange
                ),
                center = Offset(this.size.width / 2f, this.size.height / 2f)
            )

            rotate(degrees = currentRotation) {
                drawArc(
                    brush = brandSweepBrush,
                    startAngle = 0f,
                    sweepAngle = 280f,
                    useCenter = false,
                    topLeft = topLeft,
                    size = arcSize,
                    style = Stroke(width = strokePx, cap = StrokeCap.Round)
                )
            }
        }
    }
}
