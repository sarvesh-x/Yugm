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
import com.yugm.app.core.ui.theme.BrandOrange
import com.yugm.app.core.ui.theme.BrandPink
import com.yugm.app.core.ui.theme.BrandViolet
import com.yugm.app.core.ui.theme.LocalYugmColors
import kotlin.math.max

enum class YugmBackgroundStyle {
    Ambient,
    Aurora,
    Minimal,
    Arcade
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
                val baseColor = if (isDark) Color(0xFF090A15) else Color(0xFFFBF8FC)
                val violetAlpha = (if (isDark) 0.20f else 0.16f) * glowIntensity
                val pinkAlpha = (if (isDark) 0.12f else 0.10f) * glowIntensity
                val orangeAlpha = (if (isDark) 0.03f else 0.04f) * glowIntensity

                val violetBrush = Brush.radialGradient(
                    colors = listOf(
                        BrandViolet.copy(alpha = violetAlpha),
                        BrandViolet.copy(alpha = violetAlpha * 0.35f),
                        Color.Transparent
                    ),
                    center = Offset(w * 0.85f, h * 0.15f),
                    radius = maxDim * 0.85f
                )

                val pinkBrush = Brush.radialGradient(
                    colors = listOf(
                        BrandPink.copy(alpha = pinkAlpha),
                        BrandPink.copy(alpha = pinkAlpha * 0.35f),
                        Color.Transparent
                    ),
                    center = Offset(w * 0.15f, h * 0.85f),
                    radius = maxDim * 0.80f
                )

                val orangeBrush = Brush.radialGradient(
                    colors = listOf(
                        BrandOrange.copy(alpha = orangeAlpha),
                        Color.Transparent
                    ),
                    center = Offset(w * 0.10f, h * 0.20f),
                    radius = maxDim * 0.50f
                )

                onDrawBehind {
                    drawRect(baseColor)
                    drawRect(violetBrush)
                    drawRect(pinkBrush)
                    drawRect(orangeBrush)
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
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .then(drawModifier),
        content = content
    )
}
