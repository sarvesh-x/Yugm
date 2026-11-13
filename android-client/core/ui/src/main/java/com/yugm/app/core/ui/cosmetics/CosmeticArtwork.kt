package com.yugm.app.core.ui.cosmetics

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yugm.app.core.ui.components.SlimLineFrame
import kotlin.math.cos
import kotlin.math.sin

@Composable
fun CosmeticArtwork(
    id: String,
    type: String,
    preview: String = "",
    modifier: Modifier = Modifier,
    animate: Boolean = false,
    showBackdrop: Boolean = true
) {
    val visual = cosmeticVisual(id, type, preview)
    when (type) {
        "AVATAR_FRAME" -> CosmeticFrameOverlay(id, modifier, animate = animate, showBackdrop = showBackdrop)
        "SPEAKING_WAVE" -> CosmeticWaveOverlay(id, modifier, animate = animate)
        "PROFILE_THEME" -> ThemeArtwork(visual, modifier, animate)
        "CHAT_BUBBLE" -> ChatBubbleArtwork(visual, modifier, animate)
        "NAME_STYLE" -> NameStyleArtwork(visual, modifier, animate)
        "INTRO_CARD" -> IntroCardArtwork(visual, preview, modifier, animate)
        "GIFT_SHELF" -> GiftShelfArtwork(visual, modifier, animate)
        "ROOM_ENTRY" -> RoomEntryArtwork(visual, modifier, animate)
        "ROOM_AMBIENCE" -> AmbienceArtwork(visual, modifier, animate)
        "AVATAR_ASSET" -> AvatarAssetArtwork(visual, modifier)
        else -> Box(modifier.clip(CircleShape).background(visual.primary.copy(alpha = 0.2f)))
    }
}

@Composable
fun CosmeticFrameOverlay(
    id: String,
    modifier: Modifier = Modifier,
    animate: Boolean = true,
    showBackdrop: Boolean = false
) {
    if (id == "frame_minimal") {
        SlimLineFrame(modifier = modifier, showBackdrop = showBackdrop, animate = animate)
        return
    }
    val visual = cosmeticVisual(id, "AVATAR_FRAME")
    val phase = rememberPhase(animate, 7000)
    Canvas(modifier) {
        val unit = minOf(size.width, size.height)
        val center = Offset(size.width / 2f, size.height / 2f)
        val radius = unit / 2f - unit * 0.055f
        if (showBackdrop) {
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(visual.primary.copy(alpha = 0.13f), Color(0xFF0B0D17)),
                    center = center,
                    radius = radius * 1.35f
                ),
                radius = radius,
                center = center
            )
        }
        drawCircle(
            color = visual.primary.copy(alpha = 0.16f),
            radius = radius + unit * 0.035f,
            center = center,
            style = Stroke(width = unit * 0.09f)
        )
        drawFrameRing(visual, center, radius, phase)
        drawFrameMotif(visual, center, radius, phase)
    }
}

@Composable
fun CosmeticWaveOverlay(
    id: String,
    modifier: Modifier = Modifier,
    animate: Boolean = true
) {
    val visual = cosmeticVisual(id, "SPEAKING_WAVE")
    val phase = rememberPhase(animate, 1200)
    Canvas(modifier) {
        when (visual.id) {
            "wave_soft" -> drawSoftWave(visual, phase)
            "wave_neon" -> drawNeonWave(visual, phase)
            "wave_royal" -> drawRoyalWave(visual, phase)
            "wave_pulse" -> drawPulseWave(visual, phase)
            "wave_fire" -> drawFireWave(visual, phase)
            "wave_rainbow" -> drawRainbowWave(visual, phase)
            "wave_cyber" -> drawCyberWave(visual, phase)
            else -> drawSoftWave(visual, phase)
        }
        if (visual.id != "wave_pulse" && visual.id != "wave_cyber") {
            drawCircle(
                brush = Brush.radialGradient(
                    listOf(visual.primary.copy(alpha = 0.20f), Color.Transparent),
                    center = center,
                    radius = minOf(size.width, size.height) * 0.55f
                ),
                radius = minOf(size.width, size.height) * 0.55f,
                center = center
            )
        }
    }
}

@Composable
fun StyledName(
    text: String,
    nameStyle: String,
    modifier: Modifier = Modifier,
    fontSize: Int = 25,
    maxLines: Int = 2
) {
    Text(
        text = text,
        modifier = modifier,
        style = TextStyle(
            brush = if (nameStyle.isBlank()) null else nameStyleBrush(nameStyle),
            fontWeight = FontWeight.Black,
            fontSize = fontSize.sp
        ),
        color = Color.White,
        maxLines = maxLines,
        overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
    )
}

@Composable
fun RoomAmbienceBackdrop(
    id: String,
    modifier: Modifier = Modifier,
    animate: Boolean = true
) {
    if (id.isBlank()) return
    val visual = cosmeticVisual(id, "ROOM_AMBIENCE")
    val phase = rememberPhase(animate, 9000)
    Canvas(modifier) {
        drawCircle(
            brush = Brush.radialGradient(
                listOf(visual.primary.copy(alpha = 0.12f), Color.Transparent),
                center = Offset(size.width * 0.82f, size.height * 0.16f),
                radius = size.width * 0.72f
            ),
            radius = size.width * 0.72f,
            center = Offset(size.width * 0.82f, size.height * 0.16f)
        )
        when (visual.id) {
            "ambience_rain" -> repeat(24) { index ->
                val x = size.width * (0.04f + ((index * 37) % 92) / 100f)
                val y = size.height * ((0.08f + (index * 0.11f + phase / 3600f) % 0.84f))
                drawLine(visual.accent.copy(alpha = 0.16f), Offset(x, y), Offset(x - 3f, y + 22f), strokeWidth = 2.2f, cap = StrokeCap.Round)
            }
            "ambience_lofi" -> repeat(3) { index ->
                drawCircle(visual.primary.copy(alpha = 0.06f), radius = size.width * (0.22f + index * 0.09f), center = Offset(size.width * 0.16f, size.height * 0.72f), style = Stroke(width = 2f))
            }
            "ambience_cafe" -> repeat(4) { index ->
                drawCircle(visual.accent.copy(alpha = 0.07f), radius = size.width * (0.16f + index * 0.06f), center = Offset(size.width * 0.74f, size.height * 0.76f))
            }
            "ambience_night" -> repeat(16) { index ->
                val x = size.width * (0.05f + ((index * 23) % 90) / 100f)
                val y = size.height * (0.08f + ((index * 41) % 55) / 100f)
                drawCircle(visual.accent.copy(alpha = 0.28f), radius = 1.8f, center = Offset(x, y))
            }
            else -> repeat(12) { index ->
                val p = point(phase + index * 30f, size.width * (0.18f + (index % 4) * 0.06f), Offset(size.width * 0.22f, size.height * 0.70f))
                drawCircle(visual.accent.copy(alpha = 0.20f), radius = 2.4f, center = p)
            }
        }
    }
}

@Composable
private fun ThemeArtwork(visual: CosmeticVisual, modifier: Modifier, animate: Boolean) {
    val phase = rememberPhase(animate, 14000)
    Box(modifier.clip(RoundedCornerShape(14.dp))) {
        Canvas(Modifier.fillMaxSize()) {
            drawRect(
                brush = Brush.linearGradient(
                    listOf(visual.primary, visual.secondary),
                    start = Offset.Zero,
                    end = Offset(size.width, size.height)
                )
            )
            when (visual.id) {
                "theme_midnight" -> {
                    repeat(9) { index ->
                        val x = size.width * (0.12f + ((index * 37) % 80) / 100f)
                        val y = size.height * (0.10f + ((index * 53) % 70) / 100f)
                        drawCircle(Color.White.copy(alpha = 0.55f), radius = unit * 0.009f, center = Offset(x, y))
                    }
                    drawCircle(visual.accent.copy(alpha = 0.85f), radius = unit * 0.13f, center = Offset(size.width * 0.76f, size.height * 0.24f))
                    drawCircle(visual.primary, radius = unit * 0.11f, center = Offset(size.width * 0.80f, size.height * 0.21f))
                }
                "theme_saffron" -> {
                    rotate(phase, Offset(size.width * 0.5f, size.height * 0.58f)) {
                        repeat(12) { index ->
                            drawLine(
                                visual.accent.copy(alpha = 0.18f),
                                Offset(size.width * 0.5f, size.height * 0.58f),
                                point(phase + index * 30f, unit * 0.62f, Offset(size.width * 0.5f, size.height * 0.58f)),
                                strokeWidth = unit * 0.02f
                            )
                        }
                    }
                    drawCircle(visual.accent.copy(alpha = 0.92f), radius = unit * 0.15f, center = Offset(size.width * 0.5f, size.height * 0.58f))
                }
                "theme_aurora" -> {
                    repeat(4) { index ->
                        val offset = (phase / 360f + index * 0.19f) % 1f
                        drawArc(
                            brush = Brush.sweepGradient(listOf(Color.Transparent, visual.accent.copy(alpha = 0.42f), Color.Transparent)),
                            startAngle = -20f + index * 18f,
                            sweepAngle = 95f,
                            useCenter = false,
                            topLeft = Offset(-unit * 0.2f + offset * unit * 0.2f, unit * (0.05f + index * 0.12f)),
                            size = Size(size.width * 1.15f, size.height * 0.55f),
                            style = Stroke(width = unit * 0.035f, cap = StrokeCap.Round)
                        )
                    }
                }
                "theme_sunset" -> {
                    drawCircle(visual.accent.copy(alpha = 0.9f), radius = unit * 0.19f, center = Offset(size.width * 0.52f, size.height * 0.60f))
                    drawRect(
                        brush = Brush.verticalGradient(listOf(Color.Transparent, visual.secondary.copy(alpha = 0.9f))),
                        topLeft = Offset(0f, size.height * 0.60f),
                        size = Size(size.width, size.height * 0.4f)
                    )
                    repeat(3) { index ->
                        drawLine(Color.White.copy(alpha = 0.18f), Offset(0f, size.height * (0.70f + index * 0.08f)), Offset(size.width, size.height * (0.70f + index * 0.08f)), strokeWidth = unit * 0.006f)
                    }
                }
            }
        }
    }
}

@Composable
private fun ChatBubbleArtwork(visual: CosmeticVisual, modifier: Modifier, animate: Boolean) {
    val bubble = chatBubbleVisual(visual.id)
    val phase = rememberPhase(animate, 2600)
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(13.dp))
            .background(bubble.fill)
            .border(1.4.dp, bubble.border, RoundedCornerShape(13.dp)),
        contentAlignment = Alignment.Center
    ) {
        Canvas(Modifier.fillMaxSize()) {
            when (visual.id) {
                "bubble_neon" -> {
                    drawRoundRect(
                        color = visual.primary.copy(alpha = 0.24f),
                        topLeft = Offset(unit * 0.08f, unit * 0.12f),
                        size = Size(size.width * 0.84f, size.height * 0.62f),
                        cornerRadius = androidx.compose.ui.geometry.CornerRadius(unit * 0.13f),
                        style = Stroke(width = unit * 0.025f)
                    )
                    drawCircle(visual.secondary.copy(alpha = 0.8f), radius = unit * 0.045f, center = Offset(size.width * 0.82f, size.height * 0.22f))
                }
                "bubble_festive" -> {
                    repeat(7) { index ->
                        val x = size.width * (0.15f + ((index * 29) % 70) / 100f)
                        val y = size.height * (0.12f + ((index * 47) % 45) / 100f)
                        drawCircle(if (index % 2 == 0) visual.primary else visual.accent, radius = unit * 0.018f, center = Offset(x, y))
                    }
                }
                "bubble_royal" -> drawCrown(Offset(size.width * 0.5f, size.height * 0.20f), unit * 0.16f, visual.accent)
                "bubble_gold" -> {
                    rotate(phase, center) {
                        drawLine(Color.White.copy(alpha = 0.35f), Offset(size.width * 0.14f, size.height * 0.20f), Offset(size.width * 0.86f, size.height * 0.20f), strokeWidth = unit * 0.025f, cap = StrokeCap.Round)
                    }
                }
            }
        }
        Text(
            text = "Hi",
            color = bubble.text,
            fontSize = 13.sp,
            fontWeight = FontWeight.Black,
            textAlign = TextAlign.Center
        )
    }
}

@Composable
private fun NameStyleArtwork(visual: CosmeticVisual, modifier: Modifier, animate: Boolean) {
    val phase = rememberPhase(animate, 4200)
    Box(
        modifier = modifier.clip(RoundedCornerShape(12.dp)).background(Color(0xFF0D0F19)),
        contentAlignment = Alignment.Center
    ) {
        Canvas(Modifier.fillMaxSize()) {
            val glow = 0.35f + 0.25f * sin(phase * 0.017f)
            drawCircle(visual.primary.copy(alpha = glow * 0.22f), radius = unit * 0.46f, center = center)
            if (visual.id == "name_rainbow_pulse") {
                repeat(5) { index ->
                    drawArc(
                        color = when (index) {
                            0 -> Color(0xFFFF5252)
                            1 -> Color(0xFFFFD740)
                            2 -> Color(0xFF69F0AE)
                            3 -> Color(0xFF40C4FF)
                            else -> Color(0xFFE040FB)
                        }.copy(alpha = 0.55f),
                        startAngle = phase + index * 72f,
                        sweepAngle = 44f,
                        useCenter = false,
                        topLeft = Offset(unit * 0.10f, unit * 0.10f),
                        size = Size(unit * 0.80f, unit * 0.80f),
                        style = Stroke(width = unit * 0.026f, cap = StrokeCap.Round)
                    )
                }
            } else {
                drawCircle(visual.secondary.copy(alpha = 0.22f), radius = unit * 0.36f, center = center, style = Stroke(width = unit * 0.02f))
            }
        }
        Text(
            text = "Aa",
            style = TextStyle(
                brush = nameStyleBrush(visual.id),
                fontWeight = FontWeight.Black,
                fontSize = 21.sp
            )
        )
    }
}

@Composable
private fun IntroCardArtwork(visual: CosmeticVisual, preview: String, modifier: Modifier, animate: Boolean) {
    val phase = rememberPhase(animate, 8000)
    Box(
        modifier = modifier.clip(RoundedCornerShape(12.dp)).background(
            Brush.linearGradient(listOf(visual.primary, visual.secondary))
        ),
        contentAlignment = Alignment.Center
    ) {
        Canvas(Modifier.fillMaxSize()) {
            drawCircle(visual.accent.copy(alpha = 0.22f), radius = unit * 0.36f, center = Offset(size.width * 0.82f, size.height * 0.18f))
            when (visual.id) {
                "intro_ask_me" -> {
                    drawCircle(Color.White.copy(alpha = 0.22f), radius = unit * 0.19f, center = center, style = Stroke(width = unit * 0.03f))
                    drawCircle(Color.White.copy(alpha = 0.75f), radius = unit * 0.025f, center = Offset(center.x, center.y + unit * 0.29f))
                }
                "intro_my_vibe" -> {
                    repeat(3) { index ->
                        drawArc(
                            color = Color.White.copy(alpha = 0.46f - index * 0.10f),
                            startAngle = 200f + index * 10f,
                            sweepAngle = 140f,
                            useCenter = false,
                            topLeft = Offset(unit * (0.12f - index * 0.03f), unit * (0.42f + index * 0.04f)),
                            size = Size(unit * (0.76f + index * 0.06f), unit * 0.45f),
                            style = Stroke(width = unit * 0.022f, cap = StrokeCap.Round)
                        )
                    }
                }
                "intro_two_truths" -> {
                    drawLine(Color.White.copy(alpha = 0.28f), Offset(0f, size.height), Offset(size.width, 0f), strokeWidth = unit * 0.025f)
                    drawCircle(visual.accent.copy(alpha = 0.55f), radius = unit * 0.09f, center = Offset(size.width * 0.23f, size.height * 0.72f))
                }
                "intro_fun_facts" -> {
                    rotate(phase, center) {
                        repeat(8) { index ->
                            val p = point(phase + index * 45f, unit * 0.42f, center)
                            drawSparkle(p, unit * 0.035f, Color.White.copy(alpha = 0.6f))
                        }
                    }
                }
            }
        }
        Text(
            text = visual.label,
            color = Color.White,
            fontSize = 13.sp,
            fontWeight = FontWeight.Black,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = 6.dp)
        )
    }
}

@Composable
private fun GiftShelfArtwork(visual: CosmeticVisual, modifier: Modifier, animate: Boolean) {
    val phase = rememberPhase(animate, 6000)
    Box(modifier.clip(RoundedCornerShape(12.dp)).background(Color(0xFF120F1D))) {
        Canvas(Modifier.fillMaxSize()) {
            drawRect(Brush.verticalGradient(listOf(visual.primary.copy(alpha = 0.12f), Color.Transparent)))
            drawLine(visual.accent.copy(alpha = 0.8f), Offset(unit * 0.12f, size.height * 0.76f), Offset(size.width - unit * 0.12f, size.height * 0.76f), strokeWidth = unit * 0.035f, cap = StrokeCap.Round)
            drawLine(Color.White.copy(alpha = 0.18f), Offset(unit * 0.12f, size.height * 0.78f), Offset(size.width - unit * 0.12f, size.height * 0.78f), strokeWidth = unit * 0.008f)
            when (visual.id) {
                "shelf_rose_wall" -> {
                    repeat(3) { row ->
                        repeat(3) { col ->
                            drawRose(Offset(size.width * (0.24f + col * 0.26f), size.height * (0.34f + row * 0.16f)), unit * 0.075f, visual.primary, visual.accent)
                        }
                    }
                }
                "shelf_crown_case" -> {
                    drawRoundRect(
                        color = Color.White.copy(alpha = 0.14f),
                        topLeft = Offset(unit * 0.18f, unit * 0.18f),
                        size = Size(size.width * 0.64f, size.height * 0.50f),
                        cornerRadius = androidx.compose.ui.geometry.CornerRadius(unit * 0.10f),
                        style = Stroke(width = unit * 0.018f)
                    )
                    drawCrown(Offset(size.width * 0.50f, size.height * 0.42f), unit * 0.22f, visual.primary)
                }
                "shelf_diamond" -> {
                    drawDiamond(center, unit * 0.23f, visual.primary, visual.accent)
                    drawLine(Color.White.copy(alpha = 0.24f), Offset(center.x, center.y + unit * 0.23f), Offset(center.x, size.height * 0.76f), strokeWidth = unit * 0.02f)
                }
                else -> {
                    drawHeart(Offset(size.width * 0.50f, size.height * 0.44f), unit * 0.25f, visual.primary)
                    drawHeart(Offset(size.width * 0.25f, size.height * 0.34f), unit * 0.10f, visual.secondary)
                    drawHeart(Offset(size.width * 0.76f, size.height * 0.36f), unit * 0.08f, visual.accent)
                }
            }
            rotate(phase, Offset(size.width * 0.5f, size.height * 0.18f)) {
                drawSparkle(Offset(size.width * 0.5f, size.height * 0.18f), unit * 0.045f, visual.accent.copy(alpha = 0.7f))
            }
        }
    }
}

@Composable
private fun RoomEntryArtwork(visual: CosmeticVisual, modifier: Modifier, animate: Boolean) {
    val phase = rememberPhase(animate, 5000)
    Box(modifier.clip(CircleShape).background(Color(0xFF0D0F19))) {
        Canvas(Modifier.fillMaxSize()) {
            val portalRadius = unit * 0.28f
            drawCircle(
                brush = Brush.radialGradient(listOf(visual.primary.copy(alpha = 0.34f), Color.Transparent), center = center, radius = unit * 0.48f),
                radius = unit * 0.48f,
                center = center
            )
            when (visual.id) {
                "room_entry_confetti" -> {
                    drawCircle(visual.accent.copy(alpha = 0.35f), radius = portalRadius, center = center, style = Stroke(width = unit * 0.035f))
                    repeat(12) { index ->
                        val p = point(phase + index * 30f, unit * (0.20f + (index % 3) * 0.08f), center)
                        drawCircle(if (index % 2 == 0) visual.primary else visual.secondary, radius = unit * 0.024f, center = p)
                    }
                }
                "room_entry_spotlight" -> {
                    val beam = Path().apply {
                        moveTo(size.width * 0.50f, 0f)
                        lineTo(size.width * 0.20f, size.height * 0.78f)
                        lineTo(size.width * 0.80f, size.height * 0.78f)
                        close()
                    }
                    drawPath(beam, Brush.verticalGradient(listOf(visual.accent.copy(alpha = 0.45f), Color.Transparent)))
                    drawCircle(visual.primary.copy(alpha = 0.55f), radius = portalRadius * 0.75f, center = center)
                }
                "entry_rainbow" -> {
                    val colors = listOf(Color(0xFFFF5252), Color(0xFFFFD740), Color(0xFF69F0AE), Color(0xFF40C4FF), Color(0xFFE040FB))
                    colors.forEachIndexed { index, color ->
                        drawArc(color.copy(alpha = 0.72f), 190f, 160f, false, Offset(unit * (0.08f + index * 0.035f), unit * (0.12f + index * 0.035f)), Size(unit * (0.84f - index * 0.07f), unit * (0.84f - index * 0.07f)), style = Stroke(width = unit * 0.028f, cap = StrokeCap.Round))
                    }
                }
                else -> {
                    val ghost = Path().apply {
                        moveTo(size.width * 0.34f, size.height * 0.68f)
                        cubicTo(size.width * 0.30f, size.height * 0.24f, size.width * 0.70f, size.height * 0.24f, size.width * 0.66f, size.height * 0.68f)
                        lineTo(size.width * 0.60f, size.height * 0.60f)
                        lineTo(size.width * 0.54f, size.height * 0.70f)
                        lineTo(size.width * 0.48f, size.height * 0.60f)
                        lineTo(size.width * 0.42f, size.height * 0.70f)
                        close()
                    }
                    drawPath(ghost, visual.primary.copy(alpha = 0.75f))
                    drawCircle(Color(0xFF111425), radius = unit * 0.035f, center = Offset(size.width * 0.44f, size.height * 0.45f))
                    drawCircle(Color(0xFF111425), radius = unit * 0.035f, center = Offset(size.width * 0.56f, size.height * 0.45f))
                }
            }
        }
    }
}

@Composable
private fun AmbienceArtwork(visual: CosmeticVisual, modifier: Modifier, animate: Boolean) {
    val phase = rememberPhase(animate, 9000)
    Box(modifier.clip(CircleShape).background(Color(0xFF0B0D16))) {
        Canvas(Modifier.fillMaxSize()) {
            drawCircle(
                brush = Brush.radialGradient(listOf(visual.primary.copy(alpha = 0.24f), Color.Transparent), center = center, radius = unit * 0.55f),
                radius = unit * 0.55f,
                center = center
            )
            when (visual.id) {
                "ambience_lofi" -> {
                    drawCircle(visual.primary.copy(alpha = 0.75f), radius = unit * 0.24f, center = center)
                    drawCircle(Color(0xFF0B0D16), radius = unit * 0.07f, center = center)
                    repeat(3) { index ->
                        drawArc(visual.accent.copy(alpha = 0.5f), startAngle = phase + index * 120f, sweepAngle = 56f, useCenter = false, topLeft = Offset(unit * 0.18f, unit * 0.18f), size = Size(unit * 0.64f, unit * 0.64f), style = Stroke(width = unit * 0.016f))
                    }
                }
                "ambience_rain" -> {
                    repeat(10) { index ->
                        val x = size.width * (0.12f + ((index * 31) % 76) / 100f)
                        val y = size.height * ((0.18f + (index * 0.12f + phase / 3600f) % 0.62f))
                        drawLine(visual.accent.copy(alpha = 0.58f), Offset(x, y), Offset(x - unit * 0.03f, y + unit * 0.11f), strokeWidth = unit * 0.012f, cap = StrokeCap.Round)
                    }
                    drawCircle(visual.primary.copy(alpha = 0.30f), radius = unit * 0.32f, center = Offset(center.x, center.y * 0.75f))
                }
                "ambience_cafe" -> {
                    drawRoundRect(visual.accent.copy(alpha = 0.55f), Offset(unit * 0.28f, unit * 0.40f), Size(unit * 0.44f, unit * 0.30f), androidx.compose.ui.geometry.CornerRadius(unit * 0.06f), style = Stroke(width = unit * 0.022f))
                    drawArc(visual.accent.copy(alpha = 0.55f), -70f, 140f, false, Offset(unit * 0.68f, unit * 0.46f), Size(unit * 0.18f, unit * 0.18f), style = Stroke(width = unit * 0.018f))
                    repeat(3) { index ->
                        drawLine(Color.White.copy(alpha = 0.22f), Offset(unit * (0.38f + index * 0.09f), unit * 0.34f), Offset(unit * (0.36f + index * 0.09f), unit * 0.22f), strokeWidth = unit * 0.012f, cap = StrokeCap.Round)
                    }
                }
                "ambience_night" -> {
                    drawCircle(visual.accent.copy(alpha = 0.82f), radius = unit * 0.10f, center = Offset(size.width * 0.72f, size.height * 0.25f))
                    repeat(5) { index ->
                        val left = size.width * (0.12f + index * 0.15f)
                        val top = size.height * (0.52f + (index % 2) * 0.08f)
                        drawRect(visual.primary.copy(alpha = 0.65f), Offset(left, top), Size(size.width * 0.11f, size.height * 0.34f))
                    }
                }
                else -> {
                    repeat(3) { index ->
                        val x = size.width * (0.25f + index * 0.25f)
                        drawRect(visual.primary.copy(alpha = 0.55f), Offset(x, size.height * (0.30f + (index % 2) * 0.10f)), Size(size.width * 0.20f, size.height * 0.48f))
                        drawCircle(visual.accent.copy(alpha = 0.25f), radius = unit * 0.13f, center = Offset(x + size.width * 0.10f, size.height * (0.32f + (index % 2) * 0.10f)))
                    }
                    repeat(6) { index ->
                        val p = point(phase + index * 60f, unit * (0.12f + (index % 3) * 0.08f), center)
                        drawCircle(visual.accent.copy(alpha = 0.75f), radius = unit * 0.018f, center = p)
                    }
                }
            }
        }
    }
}

@Composable
private fun AvatarAssetArtwork(visual: CosmeticVisual, modifier: Modifier) {
    Box(modifier.clip(CircleShape).background(Brush.linearGradient(listOf(visual.primary, visual.secondary)))) {
        Canvas(Modifier.fillMaxSize()) {
            drawCircle(Color.White.copy(alpha = 0.16f), radius = unit * 0.40f, center = center, style = Stroke(width = unit * 0.03f))
            drawCircle(Color.White.copy(alpha = 0.75f), radius = unit * 0.11f, center = Offset(center.x, center.y - unit * 0.08f))
            drawArc(Color.White.copy(alpha = 0.75f), 200f, 140f, false, Offset(unit * 0.28f, unit * 0.48f), Size(unit * 0.44f, unit * 0.40f), style = Stroke(width = unit * 0.04f, cap = StrokeCap.Round))
        }
    }
}

private fun DrawScope.drawFrameRing(visual: CosmeticVisual, center: Offset, radius: Float, phase: Float) {
    val unit = minOf(size.width, size.height)
    when (visual.id) {
        "frame_neon" -> {
            drawArc(visual.primary, phase, 210f, false, Offset(center.x - radius, center.y - radius), Size(radius * 2, radius * 2), style = Stroke(width = unit * 0.065f, cap = StrokeCap.Round))
            drawArc(visual.secondary, phase + 150f, 120f, false, Offset(center.x - radius, center.y - radius), Size(radius * 2, radius * 2), style = Stroke(width = unit * 0.045f, cap = StrokeCap.Round))
            drawArc(visual.accent.copy(alpha = 0.5f), phase + 40f, 50f, false, Offset(center.x - radius, center.y - radius), Size(radius * 2, radius * 2), style = Stroke(width = unit * 0.11f))
        }
        "frame_cyber_punk" -> {
            repeat(12) { index ->
                drawArc(
                    if (index % 2 == 0) visual.primary else visual.secondary,
                    index * 30f + 4f,
                    22f,
                    false,
                    Offset(center.x - radius, center.y - radius),
                    Size(radius * 2, radius * 2),
                    style = Stroke(width = unit * 0.07f, cap = StrokeCap.Butt)
                )
            }
            repeat(3) { index ->
                val y = center.y + (index - 1) * unit * 0.16f
                drawLine(visual.accent.copy(alpha = 0.65f), Offset(center.x - radius * 1.18f, y), Offset(center.x + radius * 0.55f, y), strokeWidth = unit * 0.018f)
            }
        }
        "frame_crystal" -> {
            drawCircle(Color.White.copy(alpha = 0.6f), radius = radius, center = center, style = Stroke(width = unit * 0.035f))
            val path = Path()
            repeat(6) { index ->
                val angle = Math.toRadians((index * 60f - 90f).toDouble())
                val p = Offset(center.x + cos(angle).toFloat() * radius, center.y + sin(angle).toFloat() * radius)
                if (index == 0) path.moveTo(p.x, p.y) else path.lineTo(p.x, p.y)
            }
            path.close()
            drawPath(path, visual.accent.copy(alpha = 0.28f), style = Stroke(width = unit * 0.018f))
            repeat(6) { index ->
                drawCircle(Color.White.copy(alpha = 0.75f), radius = unit * 0.024f, center = point(index * 60f, radius, center))
            }
        }
        "frame_iridescent" -> {
            val colors = listOf(visual.primary, visual.secondary, visual.accent)
            colors.forEachIndexed { index, color ->
                drawCircle(
                    color.copy(alpha = 0.55f),
                    radius = radius - index * unit * 0.035f,
                    center = center,
                    style = Stroke(width = unit * 0.022f)
                )
            }
            repeat(10) { index ->
                drawCircle(Color.White.copy(alpha = 0.55f), radius = unit * 0.012f, center = point(index * 36f + phase, radius, center))
            }
        }
        else -> {
            val colors = listOf(visual.primary, visual.secondary, visual.accent, visual.primary)
            drawCircle(
                brush = Brush.sweepGradient(colors, center = center),
                radius = radius,
                center = center,
                style = Stroke(width = unit * 0.065f)
            )
            drawCircle(
                Color.White.copy(alpha = 0.28f),
                radius = radius - unit * 0.055f,
                center = center,
                style = Stroke(width = unit * 0.012f)
            )
            rotate(phase, center) {
                drawArc(
                    brush = Brush.sweepGradient(listOf(Color.Transparent, Color.White.copy(alpha = 0.9f), Color.Transparent), center = center),
                    startAngle = -30f,
                    sweepAngle = 60f,
                    useCenter = false,
                    topLeft = Offset(center.x - radius, center.y - radius),
                    size = Size(radius * 2f, radius * 2f),
                    style = Stroke(width = unit * 0.026f, cap = StrokeCap.Round)
                )
            }
        }
    }
}

private fun DrawScope.drawFrameMotif(visual: CosmeticVisual, center: Offset, radius: Float, phase: Float) {
    val unit = minOf(size.width, size.height)
    when (visual.id) {
        "frame_gold" -> {
            repeat(4) { index ->
                drawSparkle(point(45f + index * 90f, radius * (1.02f + (index % 2) * 0.05f), center), unit * 0.045f, visual.accent)
            }
        }
        "frame_royal" -> {
            drawCrown(Offset(center.x, center.y - radius - unit * 0.055f), unit * 0.20f, visual.primary)
            drawCircle(visual.secondary, radius = unit * 0.025f, center = Offset(center.x, center.y - radius - unit * 0.01f))
        }
        "frame_floral" -> {
            repeat(5) { index ->
                drawFlower(point(index * 72f - 90f, radius, center), unit * 0.075f, visual.primary, visual.accent)
            }
        }
        "frame_sakura_blossom" -> {
            repeat(4) { index ->
                drawFlower(point(index * 90f + 45f, radius * 1.03f, center), unit * 0.065f, visual.primary, visual.accent)
            }
            repeat(5) { index ->
                drawSparkle(point(phase + index * 72f, radius * 0.72f, center), unit * 0.025f, Color.White.copy(alpha = 0.75f))
            }
        }
        "frame_dragon_fire" -> {
            drawFlame(Offset(center.x - radius * 0.98f, center.y), unit * 0.20f, visual.primary, visual.accent, flip = true)
            drawFlame(Offset(center.x + radius * 0.98f, center.y), unit * 0.20f, visual.primary, visual.accent, flip = false)
            repeat(5) { index ->
                drawCircle(visual.accent, radius = unit * 0.015f, center = point(phase + index * 72f, radius * 0.86f, center))
            }
        }
        "frame_phoenix_wings" -> {
            drawWing(Offset(center.x - radius * 0.72f, center.y + unit * 0.04f), unit * 0.30f, visual.primary, visual.secondary, left = true)
            drawWing(Offset(center.x + radius * 0.72f, center.y + unit * 0.04f), unit * 0.30f, visual.primary, visual.secondary, left = false)
            drawCrown(Offset(center.x, center.y - radius - unit * 0.02f), unit * 0.14f, visual.accent)
        }
        "frame_gradient" -> {
            repeat(3) { index ->
                drawArc(visual.accent.copy(alpha = 0.35f), phase + index * 120f, 55f, false, Offset(center.x - radius * 1.1f, center.y - radius * 1.1f), Size(radius * 2.2f, radius * 2.2f), style = Stroke(width = unit * 0.018f, cap = StrokeCap.Round))
            }
        }
        else -> {
            repeat(3) { index ->
                drawSparkle(point(phase + index * 120f, radius * 0.95f, center), unit * 0.035f, Color.White.copy(alpha = 0.8f))
            }
        }
    }
}

private fun DrawScope.drawSoftWave(visual: CosmeticVisual, phase: Float) {
    val unit = minOf(size.width, size.height)
    val wave = Path()
    val mid = size.height * 0.5f
    for (x in 0..40) {
        val t = x / 40f
        val y = mid + sin((t * 4f + phase / 360f) * Math.PI).toFloat() * unit * 0.14f
        if (x == 0) wave.moveTo(t * size.width, y) else wave.lineTo(t * size.width, y)
    }
    drawPath(wave, visual.primary, style = Stroke(width = unit * 0.055f, cap = StrokeCap.Round))
    drawPath(wave, visual.accent.copy(alpha = 0.55f), style = Stroke(width = unit * 0.018f, cap = StrokeCap.Round))
}

private fun DrawScope.drawNeonWave(visual: CosmeticVisual, phase: Float) {
    val unit = minOf(size.width, size.height)
    repeat(3) { index ->
        val wave = Path()
        val mid = size.height * (0.42f + index * 0.08f)
        for (x in 0..28) {
            val t = x / 28f
            val y = mid + if (x % 2 == 0) -unit * 0.11f else unit * 0.10f
            if (x == 0) wave.moveTo(t * size.width, y) else {
                if (x % 2 == 0) wave.lineTo(t * size.width, y) else wave.cubicTo(
                    (t - 0.02f) * size.width, y - unit * 0.05f,
                    (t + 0.02f) * size.width, y + unit * 0.05f,
                    t * size.width, y
                )
            }
        }
        val color = when (index) {
            0 -> visual.primary
            1 -> visual.secondary
            else -> visual.accent
        }
        drawPath(wave, color.copy(alpha = 0.35f), style = Stroke(width = unit * 0.11f))
        drawPath(wave, color, style = Stroke(width = unit * 0.035f, cap = StrokeCap.Round))
    }
    drawCircle(visual.primary.copy(alpha = 0.18f), radius = unit * 0.48f, center = center)
}

private fun DrawScope.drawRoyalWave(visual: CosmeticVisual, phase: Float) {
    val unit = minOf(size.width, size.height)
    repeat(3) { index ->
        drawArc(
            brush = Brush.sweepGradient(listOf(visual.primary, visual.secondary, visual.accent, visual.primary), center = center),
            startAngle = 200f + index * 18f + phase * 0.04f,
            sweepAngle = 140f - index * 12f,
            useCenter = false,
            topLeft = Offset(unit * (0.10f + index * 0.055f), unit * (0.16f + index * 0.055f)),
            size = Size(unit * (0.80f - index * 0.11f), unit * (0.80f - index * 0.11f)),
            style = Stroke(width = unit * (0.055f - index * 0.012f), cap = StrokeCap.Round)
        )
    }
    drawCrown(Offset(center.x, size.height * 0.18f), unit * 0.16f, visual.primary)
}

private fun DrawScope.drawPulseWave(visual: CosmeticVisual, phase: Float) {
    val unit = minOf(size.width, size.height)
    repeat(3) { index ->
        val progress = ((phase / 360f) + index / 3f) % 1f
        drawCircle(
            color = (if (index % 2 == 0) visual.primary else visual.secondary).copy(alpha = (1f - progress) * 0.7f),
            radius = unit * (0.16f + progress * 0.28f),
            center = center,
            style = Stroke(width = unit * 0.036f)
        )
    }
    drawCircle(visual.primary.copy(alpha = 0.18f), radius = unit * 0.49f, center = center, style = Stroke(width = unit * 0.02f))
}

private fun DrawScope.drawFireWave(visual: CosmeticVisual, phase: Float) {
    val unit = minOf(size.width, size.height)
    val path = Path().apply {
        moveTo(0f, size.height * 0.74f)
        for (x in 0..36) {
            val t = x / 36f
            val y = size.height * (0.64f - sin((t * 5f + phase / 300f) * Math.PI).toFloat() * 0.16f)
            lineTo(t * size.width, y)
        }
        lineTo(size.width, size.height)
        lineTo(0f, size.height)
        close()
    }
    drawPath(path, Brush.verticalGradient(listOf(visual.accent.copy(alpha = 0.85f), visual.primary.copy(alpha = 0.25f), Color.Transparent)))
    val line = Path()
    for (x in 0..36) {
        val t = x / 36f
        val y = size.height * (0.64f - sin((t * 5f + phase / 300f) * Math.PI).toFloat() * 0.16f)
        if (x == 0) line.moveTo(t * size.width, y) else line.lineTo(t * size.width, y)
    }
    drawPath(line, visual.accent, style = Stroke(width = unit * 0.045f, cap = StrokeCap.Round))
}

private fun DrawScope.drawRainbowWave(visual: CosmeticVisual, phase: Float) {
    val unit = minOf(size.width, size.height)
    val colors = listOf(Color(0xFFFF5252), Color(0xFFFFD740), Color(0xFF69F0AE), Color(0xFF40C4FF), Color(0xFFE040FB))
    colors.forEachIndexed { index, color ->
        val path = Path()
        for (x in 0..30) {
            val t = x / 30f
            val y = size.height * 0.5f + sin((t * 4f + index * 0.15f + phase / 500f) * Math.PI).toFloat() * unit * 0.15f
            if (x == 0) path.moveTo(t * size.width, y) else path.lineTo(t * size.width, y)
        }
        drawPath(path, color.copy(alpha = 0.7f), style = Stroke(width = unit * 0.028f, cap = StrokeCap.Round))
    }
}

private fun DrawScope.drawCyberWave(visual: CosmeticVisual, phase: Float) {
    val unit = minOf(size.width, size.height)
    val count = 9
    repeat(count) { index ->
        val barWidth = size.width * 0.055f
        val left = size.width * 0.12f + index * size.width * 0.085f
        val height = unit * (0.10f + (0.18f + 0.22f * sin(phase * 0.017f + index).toFloat()) * 0.5f)
        drawRoundRect(
            brush = Brush.verticalGradient(listOf(visual.primary, visual.secondary)),
            topLeft = Offset(left, size.height * 0.62f - height),
            size = Size(barWidth, height),
            cornerRadius = androidx.compose.ui.geometry.CornerRadius(barWidth * 0.4f)
        )
    }
    val line = Path()
    for (x in 0..20) {
        val t = x / 20f
        val y = if ((x / 4) % 2 == 0) size.height * 0.30f else size.height * 0.40f
        if (x == 0) line.moveTo(t * size.width, y) else line.lineTo(t * size.width, y)
    }
    drawPath(line, visual.accent.copy(alpha = 0.72f), style = Stroke(width = unit * 0.022f))
}

private fun DrawScope.drawCrown(center: Offset, radius: Float, color: Color) {
    val path = Path().apply {
        moveTo(center.x - radius, center.y + radius * 0.45f)
        lineTo(center.x - radius * 0.62f, center.y - radius * 0.55f)
        lineTo(center.x - radius * 0.20f, center.y + radius * 0.02f)
        lineTo(center.x, center.y - radius * 0.78f)
        lineTo(center.x + radius * 0.20f, center.y + radius * 0.02f)
        lineTo(center.x + radius * 0.62f, center.y - radius * 0.55f)
        lineTo(center.x + radius, center.y + radius * 0.45f)
        close()
    }
    drawPath(path, color)
    drawCircle(Color.White.copy(alpha = 0.65f), radius = radius * 0.12f, center = Offset(center.x, center.y - radius * 0.50f))
}

private fun DrawScope.drawHeart(center: Offset, size: Float, color: Color) {
    val path = Path().apply {
        moveTo(center.x, center.y + size * 0.70f)
        cubicTo(center.x - size * 1.15f, center.y - size * 0.10f, center.x - size * 0.55f, center.y - size * 0.85f, center.x, center.y - size * 0.32f)
        cubicTo(center.x + size * 0.55f, center.y - size * 0.85f, center.x + size * 1.15f, center.y - size * 0.10f, center.x, center.y + size * 0.70f)
        close()
    }
    drawPath(path, color)
    drawPath(path, Color.White.copy(alpha = 0.22f), style = Stroke(width = size * 0.08f))
}

private fun DrawScope.drawDiamond(center: Offset, radius: Float, color: Color, accent: Color) {
    val path = Path().apply {
        moveTo(center.x, center.y - radius)
        lineTo(center.x + radius * 0.78f, center.y - radius * 0.10f)
        lineTo(center.x, center.y + radius)
        lineTo(center.x - radius * 0.78f, center.y - radius * 0.10f)
        close()
    }
    drawPath(path, Brush.linearGradient(listOf(Color.White.copy(alpha = 0.85f), color, accent), start = Offset(center.x - radius, center.y - radius), end = Offset(center.x + radius, center.y + radius)))
    drawPath(path, Color.White.copy(alpha = 0.6f), style = Stroke(width = radius * 0.035f))
    drawLine(Color.White.copy(alpha = 0.5f), Offset(center.x, center.y - radius), Offset(center.x, center.y + radius), strokeWidth = radius * 0.025f)
    drawLine(Color.White.copy(alpha = 0.5f), Offset(center.x - radius * 0.78f, center.y - radius * 0.10f), Offset(center.x + radius * 0.78f, center.y - radius * 0.10f), strokeWidth = radius * 0.025f)
}

private fun DrawScope.drawFlower(center: Offset, radius: Float, petal: Color, core: Color) {
    repeat(5) { index ->
        drawCircle(petal.copy(alpha = 0.9f), radius = radius * 0.48f, center = point(index * 72f, radius * 0.55f, center))
    }
    drawCircle(core, radius = radius * 0.30f, center = center)
}

private fun DrawScope.drawRose(center: Offset, radius: Float, petal: Color, core: Color) {
    drawCircle(petal.copy(alpha = 0.9f), radius = radius, center = center)
    drawCircle(core.copy(alpha = 0.8f), radius = radius * 0.62f, center = center, style = Stroke(width = radius * 0.22f))
    drawCircle(Color.White.copy(alpha = 0.22f), radius = radius * 0.24f, center = center)
}

private fun DrawScope.drawFlame(center: Offset, radius: Float, color: Color, accent: Color, flip: Boolean) {
    val direction = if (flip) -1f else 1f
    val path = Path().apply {
        moveTo(center.x, center.y + radius * 0.50f)
        cubicTo(
            center.x + direction * radius * 0.60f, center.y + radius * 0.20f,
            center.x + direction * radius * 0.20f, center.y - radius * 0.45f,
            center.x + direction * radius * 0.05f, center.y - radius
        )
        cubicTo(
            center.x - direction * radius * 0.10f, center.y - radius * 0.30f,
            center.x - direction * radius * 0.55f, center.y - radius * 0.20f,
            center.x, center.y + radius * 0.50f
        )
        close()
    }
    drawPath(path, Brush.verticalGradient(listOf(accent, color)))
    drawCircle(Color.White.copy(alpha = 0.22f), radius = radius * 0.13f, center = center)
}

private fun DrawScope.drawWing(center: Offset, radius: Float, color: Color, accent: Color, left: Boolean) {
    val direction = if (left) -1f else 1f
    repeat(4) { index ->
        val path = Path().apply {
            moveTo(center.x, center.y)
            quadraticTo(
                center.x + direction * radius * (0.35f + index * 0.16f),
                center.y - radius * (0.78f - index * 0.10f),
                center.x + direction * radius * (0.55f + index * 0.20f),
                center.y + radius * (0.45f + index * 0.10f)
            )
            quadraticTo(
                center.x + direction * radius * (0.18f + index * 0.10f),
                center.y + radius * (0.20f + index * 0.08f),
                center.x, center.y
            )
            close()
        }
        drawPath(path, if (index % 2 == 0) color.copy(alpha = 0.85f) else accent.copy(alpha = 0.55f))
    }
}

private fun DrawScope.drawSparkle(center: Offset, radius: Float, color: Color) {
    val path = Path().apply {
        moveTo(center.x, center.y - radius)
        quadraticTo(center.x + radius * 0.18f, center.y - radius * 0.18f, center.x + radius, center.y)
        quadraticTo(center.x + radius * 0.18f, center.y + radius * 0.18f, center.x, center.y + radius)
        quadraticTo(center.x - radius * 0.18f, center.y + radius * 0.18f, center.x - radius, center.y)
        quadraticTo(center.x - radius * 0.18f, center.y - radius * 0.18f, center.x, center.y - radius)
        close()
    }
    drawPath(path, color)
}

private fun point(degrees: Float, radius: Float, center: Offset): Offset {
    val angle = Math.toRadians(degrees.toDouble())
    return Offset(center.x + cos(angle).toFloat() * radius, center.y + sin(angle).toFloat() * radius)
}

private val DrawScope.unit: Float
    get() = minOf(size.width, size.height)

private inline val DrawScope.center: Offset
    get() = Offset(size.width / 2f, size.height / 2f)

@Composable
private fun rememberPhase(animate: Boolean, durationMillis: Int): Float {
    if (!animate) return 0f
    val transition = rememberInfiniteTransition(label = "cosmetic-phase")
    val phase by transition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(animation = tween(durationMillis = durationMillis, easing = LinearEasing), repeatMode = RepeatMode.Restart),
        label = "cosmetic-phase-value"
    )
    return phase
}
