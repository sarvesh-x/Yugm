package com.yugm.app.core.ui.components

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import com.yugm.app.core.ui.theme.BrandOrange
import com.yugm.app.core.ui.theme.BrandPink
import com.yugm.app.core.ui.theme.BrandViolet
import com.yugm.app.core.ui.theme.LocalYugmColors
import kotlin.math.max

enum class YugmBackgroundStyle {
    Ambient,
    Aurora,
    Minimal,
    Arcade,
    /** No background drawn — use when a shared parent background (e.g. MainTabsScreen) is behind. */
    None
}

/**
 * Centralized production-ready Yugm background system.
 * Renders soft, static ambient lighting using native Compose radial gradients.
 * Zero infinite animation loops, zero full-screen bitmap textures.
 */
@Composable
fun YugmBackground(
    modifier: Modifier = Modifier,
    style: YugmBackgroundStyle = YugmBackgroundStyle.Ambient,
    glowIntensity: Float = 1f,
    content: @Composable BoxScope.() -> Unit = {}
) {
    val colors = LocalYugmColors.current
    val isDark = colors.isDark

    val drawModifier = Modifier.drawWithCache {
        val w = size.width
        val h = size.height
        val maxDim = max(w, h)

        when (style) {
            YugmBackgroundStyle.Ambient -> {
                // Shared main-tab background: low-contrast pastel mesh + subtle grain.
                // Stationary relative to root viewport; colors derive from Yugm theme tokens.
                val baseColor = colors.background
                val violetAlpha = (if (isDark) 0.15f else 0.11f) * glowIntensity
                val pinkAlpha = (if (isDark) 0.09f else 0.08f) * glowIntensity
                val orangeAlpha = (if (isDark) 0.07f else 0.09f) * glowIntensity
                val meshRadius = maxDim * 1.15f

                val violetBrush = Brush.radialGradient(
                    colors = listOf(
                        BrandViolet.copy(alpha = violetAlpha),
                        BrandViolet.copy(alpha = violetAlpha * 0.25f),
                        Color.Transparent
                    ),
                    center = Offset(w * 0.90f, h * 0.05f),
                    radius = meshRadius
                )

                val pinkBrush = Brush.radialGradient(
                    colors = listOf(
                        BrandPink.copy(alpha = pinkAlpha),
                        BrandPink.copy(alpha = pinkAlpha * 0.25f),
                        Color.Transparent
                    ),
                    center = Offset(w * 0.10f, h * 0.55f),
                    radius = meshRadius
                )

                val orangeBrush = Brush.radialGradient(
                    colors = listOf(
                        BrandOrange.copy(alpha = orangeAlpha),
                        BrandOrange.copy(alpha = orangeAlpha * 0.25f),
                        Color.Transparent
                    ),
                    center = Offset(w * 0.85f, h * 1.00f),
                    radius = meshRadius
                )

                // Cached monochrome micro-grain (128x128), tiled via BitmapShader.
                val grainPaint = android.graphics.Paint().apply {
                    isAntiAlias = false
                    alpha = ((if (isDark) 0.02f else 0.025f) * 255f).toInt().coerceIn(0, 255)
                    shader = android.graphics.BitmapShader(
                        createGrainBitmap(),
                        android.graphics.Shader.TileMode.REPEAT,
                        android.graphics.Shader.TileMode.REPEAT
                    )
                }

                onDrawBehind {
                    drawRect(baseColor)
                    drawRect(violetBrush)
                    drawRect(pinkBrush)
                    drawRect(orangeBrush)
                    drawIntoCanvas { canvas -> canvas.nativeCanvas.drawRect(0f, 0f, size.width, size.height, grainPaint) }
                }
            }

            YugmBackgroundStyle.Aurora -> {
                val auroraBrush = if (isDark) {
                    Brush.linearGradient(
                        colors = listOf(
                            Color(0xFF2D172A),
                            Color(0xFF23142F),
                            Color(0xFF171C42)
                        ),
                        start = Offset.Zero,
                        end = Offset(w, h)
                    )
                } else {
                    Brush.linearGradient(
                        colors = listOf(
                            Color(0xFFFCEADB),
                            Color(0xFFFBE6F3),
                            Color(0xFFE9E2FF)
                        ),
                        start = Offset.Zero,
                        end = Offset(w, h)
                    )
                }

                onDrawBehind {
                    drawRect(auroraBrush)
                }
            }

            YugmBackgroundStyle.Minimal -> {
                val baseColor = if (isDark) Color(0xFF090A15) else Color(0xFFF8F6FA)
                onDrawBehind {
                    drawRect(baseColor)
                }
            }

            YugmBackgroundStyle.Arcade -> {
                val baseColor = if (isDark) Color(0xFF0F0C1B) else Color(0xFFF9F6FC)
                val violetAlpha = (if (isDark) 0.25f else 0.18f) * glowIntensity
                val pinkAlpha = (if (isDark) 0.14f else 0.10f) * glowIntensity

                val violetBrush = Brush.radialGradient(
                    colors = listOf(
                        BrandViolet.copy(alpha = violetAlpha),
                        BrandViolet.copy(alpha = violetAlpha * 0.35f),
                        Color.Transparent
                    ),
                    center = Offset(w * 0.85f, h * 0.20f),
                    radius = maxDim * 0.90f
                )

                val pinkBrush = Brush.radialGradient(
                    colors = listOf(
                        BrandPink.copy(alpha = pinkAlpha),
                        Color.Transparent
                    ),
                    center = Offset(w * 0.15f, h * 0.80f),
                    radius = maxDim * 0.85f
                )

                onDrawBehind {
                    drawRect(baseColor)
                    drawRect(violetBrush)
                    drawRect(pinkBrush)
                }
            }

            YugmBackgroundStyle.None -> {
                onDrawBehind { /* Transparent: shared parent background renders behind this page. */ }
            }
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .then(drawModifier),
        content = content
    )
}

private val grainBitmap: android.graphics.Bitmap by lazy(LazyThreadSafetyMode.SYNCHRONIZED) {
    val size = 128
    val pixels = IntArray(size * size)
    val random = kotlin.random.Random(42)
    for (i in pixels.indices) {
        val v = random.nextInt(256)
        pixels[i] = android.graphics.Color.argb(255, v, v, v)
    }
    android.graphics.Bitmap.createBitmap(pixels, size, size, android.graphics.Bitmap.Config.ARGB_8888)
}

private fun createGrainBitmap(): android.graphics.Bitmap = grainBitmap
