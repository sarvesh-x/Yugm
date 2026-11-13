package com.yugm.app.core.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.material3.Icon
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MicOff
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yugm.app.core.model.ActiveCosmetics
import com.yugm.app.core.ui.theme.Gold
import com.yugm.app.core.ui.theme.Ink
import com.yugm.app.core.ui.theme.PanelStrong
import com.yugm.app.core.ui.theme.Pink
import com.yugm.app.core.ui.theme.Purple
import com.yugm.app.core.ui.theme.LocalMotionEnabled

@Composable
fun Avatar(
    initial: String,
    size: Int,
    imageUrl: String? = null,
    cosmetics: ActiveCosmetics = ActiveCosmetics(),
    isSpeaking: Boolean = false,
    isMuted: Boolean = false,
    showEntry: Boolean = false,
    accessibilityLabel: String? = null
) {
    val avatarAsset = avatarAssetUrl(cosmetics.avatarAsset)
    val finalImageUrl = avatarAsset ?: imageUrl
    val frameBrush = avatarFrameBrush(cosmetics.avatarFrame)
    val waveColor = speakingWaveColor(cosmetics.speakingWave)
    val speakingLabel = stringResource(com.yugm.app.core.ui.R.string.a11y_speaking)
    val motionEnabled = LocalMotionEnabled.current
    val entryScale = remember(motionEnabled) { Animatable(if (showEntry && motionEnabled) 0.86f else 1f) }
    val entryAlpha = remember(motionEnabled) { Animatable(if (showEntry && motionEnabled) 0f else 1f) }

    LaunchedEffect(showEntry, cosmetics.entranceEffect, motionEnabled) {
        if (showEntry && motionEnabled) {
            entryScale.snapTo(0.86f)
            entryAlpha.snapTo(0f)
            entryAlpha.animateTo(1f, tween(180))
            entryScale.animateTo(1f, spring(dampingRatio = 0.56f, stiffness = 520f))
        } else {
            entryScale.snapTo(1f)
            entryAlpha.snapTo(1f)
        }
    }

    Box(
        modifier = Modifier
            .size((size + 14).dp)
            .graphicsLayer {
                scaleX = entryScale.value
                scaleY = entryScale.value
                alpha = entryAlpha.value
            }
            .semantics {
                if (!accessibilityLabel.isNullOrBlank()) contentDescription = accessibilityLabel
                if (isMuted) stateDescription = "Microphone muted" else if (isSpeaking) stateDescription = speakingLabel
            },
        contentAlignment = Alignment.Center
    ) {
        if (isSpeaking) {
            SpeakingWave(waveColor = waveColor)
        }
        Box(
            modifier = Modifier
                .size((size + 8).dp)
                .clip(CircleShape)
                .background(frameBrush)
                .padding(4.dp),
            contentAlignment = Alignment.Center
        ) {
            Box(
                modifier = Modifier
                    .size(size.dp)
                    .clip(CircleShape)
                    .background(PanelStrong)
                    .border(1.dp, Ink.copy(alpha = 0.72f), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                if (!finalImageUrl.isNullOrBlank()) {
                    Image(
                        painter = coil.compose.rememberAsyncImagePainter(model = finalImageUrl),
                        contentDescription = null,
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop
                    )
                } else {
                    DefaultAvatarPlaceholder(Modifier.fillMaxSize())
                }
            }
        }
        if (isSpeaking || isMuted) {
            val badgeColor = if (isMuted) Color(0xFFE54769) else Purple
            Box(
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                .size(22.dp)
                    .clip(CircleShape)
                    .background(badgeColor)
                    .border(1.5.dp, PanelStrong, CircleShape)
                    .semantics { contentDescription = if (isMuted) "Microphone muted" else speakingLabel },
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = if (isMuted) Icons.Filled.MicOff else Icons.Filled.Mic,
                    contentDescription = null,
                    modifier = Modifier.size(14.dp),
                    tint = Color.White
                )
            }
        }
        if (showEntry && cosmetics.entranceEffect.isNotBlank()) {
            Box(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .offset(y = 3.dp)
                    .clip(RoundedCornerShape(7.dp))
                    .background(Ink.copy(alpha = 0.9f))
                    .border(1.dp, Gold, RoundedCornerShape(7.dp))
                    .padding(horizontal = 6.dp, vertical = 2.dp)
            ) {
                Text(entryLabel(cosmetics.entranceEffect), color = Gold, fontSize = 8.sp, fontWeight = FontWeight.Black)
            }
        }
        if (cosmetics.avatarDecoration.isNotBlank()) {
            Box(
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .offset(x = (-1).dp, y = (-4).dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(Gold)
                    .padding(horizontal = 5.dp, vertical = 1.dp)
            ) {
                Text(decorationLabel(cosmetics.avatarDecoration), color = Ink, fontSize = 7.sp, fontWeight = FontWeight.Black)
            }
        }
        if (isSpeaking && cosmetics.voiceBadge.isNotBlank()) {
            Box(
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .offset(x = (-1).dp, y = (-1).dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(Color(0xFF27D3FF))
                    .padding(horizontal = 5.dp, vertical = 1.dp)
            ) {
                Text(voiceBadgeLabel(cosmetics.voiceBadge), color = Ink, fontSize = 7.sp, fontWeight = FontWeight.Black)
            }
        }
        if (isSpeaking) {
            Box(
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .offset(x = 2.dp, y = 2.dp)
                    .size(18.dp)
                    .clip(CircleShape)
                    .background(Color(0xFF14B8A6))
                    .border(1.5.dp, Color.White, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Text("🎤", color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.Black)
            }
        }
    }
}

@Composable
private fun DefaultAvatarPlaceholder(modifier: Modifier = Modifier) {
    Canvas(modifier) {
        val w = size.width
        val h = size.height
        val unit = minOf(w, h)
        val cyan = Color(0xFF39E8F4)
        val lilac = Color(0xFFC36BFF)

        drawRect(
            brush = Brush.radialGradient(
                colors = listOf(Color(0xFF152C43), Color(0xFF091421), Color(0xFF050A13)),
                center = Offset(w * 0.5f, h * 0.42f),
                radius = unit * 0.82f
            )
        )

        val gridStep = unit / 5f
        for (index in 1..4) {
            val position = gridStep * index
            drawLine(cyan.copy(alpha = 0.055f), Offset(position, 0f), Offset(position, h), strokeWidth = 1f)
            drawLine(cyan.copy(alpha = 0.055f), Offset(0f, position), Offset(w, position), strokeWidth = 1f)
        }

        val silhouette = Path().apply {
            moveTo(w * 0.39f, h * 0.53f)
            cubicTo(w * 0.35f, h * 0.48f, w * 0.34f, h * 0.40f, w * 0.35f, h * 0.34f)
            cubicTo(w * 0.31f, h * 0.23f, w * 0.39f, h * 0.12f, w * 0.50f, h * 0.12f)
            cubicTo(w * 0.63f, h * 0.12f, w * 0.69f, h * 0.23f, w * 0.65f, h * 0.35f)
            cubicTo(w * 0.67f, h * 0.42f, w * 0.64f, h * 0.49f, w * 0.61f, h * 0.53f)
            cubicTo(w * 0.60f, h * 0.58f, w * 0.61f, h * 0.62f, w * 0.65f, h * 0.65f)
            lineTo(w * 0.75f, h * 0.69f)
            cubicTo(w * 0.86f, h * 0.73f, w * 0.91f, h * 0.80f, w * 0.91f, h * 0.90f)
            lineTo(w * 0.09f, h * 0.90f)
            cubicTo(w * 0.09f, h * 0.80f, w * 0.14f, h * 0.73f, w * 0.25f, h * 0.69f)
            lineTo(w * 0.35f, h * 0.65f)
            cubicTo(w * 0.39f, h * 0.62f, w * 0.40f, h * 0.58f, w * 0.39f, h * 0.53f)
        }
        val strokeStyle = { width: Float -> Stroke(width = width, cap = StrokeCap.Round, join = StrokeJoin.Round) }
        drawPath(silhouette, cyan.copy(alpha = 0.12f), style = strokeStyle(unit * 0.13f))
        drawPath(silhouette, lilac.copy(alpha = 0.24f), style = strokeStyle(unit * 0.075f))
        drawPath(silhouette, cyan.copy(alpha = 0.95f), style = strokeStyle(unit * 0.032f))
        drawCircle(cyan.copy(alpha = 0.65f), radius = unit * 0.018f, center = Offset(w * 0.20f, h * 0.20f))
        drawCircle(lilac.copy(alpha = 0.7f), radius = unit * 0.014f, center = Offset(w * 0.79f, h * 0.29f))
    }
}

@Composable
private fun SpeakingWave(waveColor: Color) {
    val motionEnabled = LocalMotionEnabled.current
    val wave: Float
    val waveAlpha: Float
    if (motionEnabled) {
        val transition = rememberInfiniteTransition(label = "avatar-speaking-wave")
        val animatedWave by transition.animateFloat(
            initialValue = 0.9f,
            targetValue = 1.22f,
            animationSpec = infiniteRepeatable(animation = tween(820), repeatMode = RepeatMode.Restart),
            label = "wave-scale"
        )
        val animatedWaveAlpha by transition.animateFloat(
            initialValue = 0.58f,
            targetValue = 0f,
            animationSpec = infiniteRepeatable(animation = tween(820), repeatMode = RepeatMode.Restart),
            label = "wave-alpha"
        )
        wave = animatedWave
        waveAlpha = animatedWaveAlpha
    } else {
        wave = 1f
        waveAlpha = 0.9f
    }
    Canvas(Modifier.fillMaxSize()) {
        val ringRadius = minOf(size.width, size.height) * 0.43f * wave
        drawCircle(waveColor.copy(alpha = waveAlpha), radius = ringRadius, style = Stroke(width = 2.4.dp.toPx()))
    }

    val wave2 = if (motionEnabled) (wave + 0.15f).let { if (it > 1.22f) it - 0.32f else it } else 1f
    val waveAlpha2 = if (motionEnabled) (waveAlpha + 0.3f).let { if (it > 0.58f) it - 0.58f else it } else 0f
    Canvas(Modifier.fillMaxSize()) {
        val ringRadius = minOf(size.width, size.height) * 0.43f * wave2
        drawCircle(waveColor.copy(alpha = waveAlpha2), radius = ringRadius, style = Stroke(width = 1.7.dp.toPx()))
    }
}

private fun avatarAssetUrl(id: String): String? = when (id) {
    "avatar_nova_static" -> "https://api.dicebear.com/9.x/adventurer/png?seed=YugmNova&backgroundColor=ffd5dc"
    "avatar_pixel_gif" -> "https://media.giphy.com/media/3o7aD2saalBwwftBIY/giphy.gif"
    "avatar_cosmic_gif" -> "https://media.giphy.com/media/l0HlNaQ6gWfllcjDO/giphy.gif"
    else -> null
}

private fun avatarFrameBrush(id: String): Brush = when (id) {
    "frame_neon" -> Brush.linearGradient(listOf(Pink, Purple, Color(0xFF27D3FF)))
    "frame_crystal" -> Brush.linearGradient(listOf(Color(0xFFB9F2FF), Color.White, Purple))
    "frame_royal" -> Brush.linearGradient(listOf(Gold, Pink, Purple))
    "frame_gold" -> Brush.linearGradient(listOf(Gold, Color(0xFFFFE8A3), Color(0xFFFF8A22)))
    "frame_dragon_fire" -> Brush.linearGradient(listOf(Color(0xFFFF3D00), Color(0xFFFF9100), Color(0xFFFFEA00)))
    "frame_sakura_blossom" -> Brush.linearGradient(listOf(Color(0xFFFF80AB), Color(0xFFFF4081), Color(0xFFF8BBD0)))
    "frame_cyber_punk" -> Brush.linearGradient(listOf(Color(0xFF00E5FF), Color(0xFFFF007F), Color(0xFF76FF03)))
    "frame_phoenix_wings" -> Brush.linearGradient(listOf(Color(0xFFD50000), Color(0xFFFF6D00), Color(0xFFFFD600)))
    else -> Brush.linearGradient(listOf(PanelStrong, Gold, PanelStrong))
}

private fun speakingWaveColor(id: String): Color = when (id) {
    "wave_neon" -> Pink
    "wave_royal" -> Gold
    "wave_soft" -> Color(0xFF27D3FF)
    "wave_fire" -> Color(0xFFFF3D00)
    "wave_rainbow" -> Color(0xFFE040FB)
    "wave_cyber" -> Color(0xFF76FF03)
    else -> Gold
}

private fun entryLabel(id: String): String = when (id) {
    "entrance_crown" -> "👑 ROYAL"
    "entrance_meteor" -> "☄️ METEOR"
    "entrance_galaxy" -> "🌌 GALAXY"
    else -> "✨ SPARK"
}

private fun decorationLabel(id: String): String = when (id) {
    "decor_crown" -> "👑 CROWN"
    "decor_halo" -> "😇 HALO"
    "decor_headphones" -> "🎧 DJ"
    "decor_dragon_horns" -> "🐉 DRAGON"
    "decor_cat_ears" -> "🐱 NEKO"
    "decor_cyber_visor" -> "🕶️ CYBER"
    "decor_sakura_petals" -> "🌸 SAKURA"
    "decor_fire_aura" -> "🔥 AURA"
    else -> "⭐ STARS"
}

private fun voiceBadgeLabel(id: String): String = when (id) {
    "voice_host_spotlight" -> "🎙️ HOST"
    "voice_rockstar" -> "🎸 ROCK"
    "voice_legend" -> "👑 LEGEND"
    "voice_superstar" -> "⭐ STAR"
    else -> "📊 EQ"
}
