package com.yugm.app.core.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Fill
import androidx.compose.ui.platform.LocalDensity
import com.yugm.app.core.ui.theme.LocalMotionEnabled
import kotlin.math.cos
import kotlin.math.sin

private data class Particle(
    var x: Float = 0f,
    var y: Float = 0f,
    var vx: Float = 0f,
    var vy: Float = 0f,
    var alpha: Float = 1f,
    var size: Float = 4f,
    var life: Float = 1f,
    var maxLife: Float = 1f,
    var hue: Float = 0f,
)

@Composable
fun ParticleBackground(
    modifier: Modifier = Modifier,
    particleCount: Int = 60,
    colors: List<Color> = listOf(
        Color(0xFFF6378B),
        Color(0xFF8D35F6),
        Color(0xFF00F2FE),
        Color(0xFFFFC52F),
    ),
    speedMultiplier: Float = 1f,
) {
    val motionEnabled = LocalMotionEnabled.current
    val time = if (motionEnabled) {
        val infiniteTransition = rememberInfiniteTransition(label = "particles")
        val animatedTime by infiniteTransition.animateFloat(
            initialValue = 0f,
            targetValue = 1000f,
            animationSpec = infiniteRepeatable(
                animation = tween(20000, easing = LinearEasing),
                repeatMode = RepeatMode.Restart,
            ),
            label = "particle-time"
        )
        animatedTime
    } else 0f

    val particles = remember {
        List(particleCount) { i ->
            Particle(
                x = (i % 20) / 20f,
                y = (i * 7 % 20) / 20f,
                vx = (i % 5 - 2) * 0.003f,
                vy = -(i % 3 + 1) * 0.003f,
                size = (i % 5 + 2) * 2f,
                life = 1f,
                maxLife = 1f,
                hue = (i * 47) % 360f / 360f,
            )
        }
    }

    Canvas(modifier = modifier.fillMaxSize()) {
        val w = size.width
        val h = size.height

        particles.forEachIndexed { i, p ->
            if (motionEnabled) {
                p.x += p.vx * speedMultiplier
                p.y += p.vy * speedMultiplier

                val drift = sin(time + i) * 0.002f
                p.x += drift
                p.y += cos(time * 0.7f + i * 0.5f) * 0.001f
            }

            if (p.y < -0.1f) {
                p.y = 1.1f
                p.x = (i * 31 % 100) / 100f
            }
            if (p.x < -0.1f) p.x = 1.1f
            if (p.x > 1.1f) p.x = -0.1f

            val alpha = ((p.y.coerceIn(0f, 1f)) * 0.6f + 0.1f).coerceIn(0f, 1f)
            val color = colors[i % colors.size]
            val radius = p.size * if (motionEnabled) (0.5f + sin(time * 2f + i) * 0.3f) else 0.5f

            drawCircle(
                color = color.copy(alpha = alpha),
                radius = radius * density,
                center = Offset(p.x * w, p.y * h),
            )

            if (radius > 3f) {
                drawCircle(
                    color = color.copy(alpha = alpha * 0.2f),
                    radius = radius * density * 2.5f,
                    center = Offset(p.x * w, p.y * h),
                )
            }
        }
    }
}

@Composable
fun GiftExplosionEffect(
    modifier: Modifier = Modifier,
    color1: Color = Color(0xFFF6378B),
    color2: Color = Color(0xFFFFC52F),
    color3: Color = Color(0xFF00F2FE),
) {
    val progress = if (LocalMotionEnabled.current) {
        val infiniteTransition = rememberInfiniteTransition(label = "gift-explosion")
        val animatedProgress by infiniteTransition.animateFloat(
            initialValue = 0f,
            targetValue = 1f,
            animationSpec = infiniteRepeatable(
                animation = tween(3000, easing = FastOutSlowInEasing),
                repeatMode = RepeatMode.Restart,
            ),
            label = "gift-progress"
        )
        animatedProgress
    } else 0.5f

    val sparkleCount = 30
    val sparkles = remember {
        List(sparkleCount) { i ->
            val angle = (i * 360f / sparkleCount)
            val dist = 0.3f + (i % 5) * 0.1f
            Particle(
                x = cos(Math.toRadians(angle.toDouble())).toFloat() * dist,
                y = sin(Math.toRadians(angle.toDouble())).toFloat() * dist,
                size = (i % 4 + 2) * 2.5f,
                hue = (i * 37) % 360f / 360f,
            )
        }
    }

    Canvas(modifier = modifier.fillMaxSize()) {
        val w = size.width
        val h = size.height
        val cx = w / 2
        val cy = h / 2

        sparkles.forEachIndexed { i, s ->
            val p = (progress + i * 0.03f) % 1f
            val dist = p * 0.4f * w.coerceAtMost(h)
            val alpha = (1f - p).coerceIn(0f, 1f)

            val colors = listOf(color1, color2, color3)
            val color = colors[i % colors.size]

            drawCircle(
                color = color.copy(alpha = alpha),
                radius = s.size * (1f - p * 0.5f) * density,
                center = Offset(cx + s.x * dist, cy + s.y * dist),
            )
        }

        val pulseRadius = 20f + progress * 60f
        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(
                    color1.copy(alpha = (0.3f * (1f - progress)).coerceIn(0f, 1f)),
                    color1.copy(alpha = 0f),
                ),
            ),
            radius = pulseRadius * density,
            center = Offset(cx, cy),
        )
    }
}

@Composable
fun AuroraParticleField(
    modifier: Modifier = Modifier,
    speed: Float = 0.5f,
) {
    val colors = listOf(
        Color(0xFF00F2FE).copy(alpha = 0.3f),
        Color(0xFF4FACFE).copy(alpha = 0.2f),
        Color(0xFF8D35F6).copy(alpha = 0.15f),
    )

    ParticleBackground(
        modifier = modifier,
        particleCount = 40,
        colors = colors,
        speedMultiplier = speed,
    )
}
