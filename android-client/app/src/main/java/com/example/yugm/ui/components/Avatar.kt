package com.example.yugm.ui.components

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
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.model.ActiveCosmetics
import com.example.yugm.ui.theme.Gold
import com.example.yugm.ui.theme.Ink
import com.example.yugm.ui.theme.PanelStrong
import com.example.yugm.ui.theme.Pink
import com.example.yugm.ui.theme.Purple

@Composable
fun Avatar(
    initial: String,
    size: Int,
    imageUrl: String? = null,
    cosmetics: ActiveCosmetics = ActiveCosmetics(),
    isSpeaking: Boolean = false,
    showEntry: Boolean = false
) {
    val transition = rememberInfiniteTransition(label = "avatar-wave")
    val wave by transition.animateFloat(
        initialValue = 0.9f,
        targetValue = 1.22f,
        animationSpec = infiniteRepeatable(animation = tween(820), repeatMode = RepeatMode.Restart),
        label = "wave-scale"
    )
    val waveAlpha by transition.animateFloat(
        initialValue = 0.58f,
        targetValue = 0f,
        animationSpec = infiniteRepeatable(animation = tween(820), repeatMode = RepeatMode.Restart),
        label = "wave-alpha"
    )
    val avatarAsset = avatarAssetUrl(cosmetics.avatarAsset)
    val finalImageUrl = avatarAsset ?: imageUrl
    val frameBrush = avatarFrameBrush(cosmetics.avatarFrame)
    val waveColor = speakingWaveColor(cosmetics.speakingWave)
    val radius = (size * 0.24f).dp
    val entryScale = remember { Animatable(if (showEntry) 0.86f else 1f) }
    val entryAlpha = remember { Animatable(if (showEntry) 0f else 1f) }

    LaunchedEffect(showEntry, cosmetics.entranceEffect) {
        if (showEntry) {
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
            },
        contentAlignment = Alignment.Center
    ) {
        if (isSpeaking) {
            Canvas(Modifier.fillMaxSize()) {
                val waveWidth = this.size.width * wave
                val waveHeight = this.size.height * wave
                drawRoundRect(
                    color = waveColor.copy(alpha = waveAlpha),
                    topLeft = Offset((this.size.width - waveWidth) / 2f, (this.size.height - waveHeight) / 2f),
                    size = Size(waveWidth, waveHeight),
                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(radius.toPx() + 18.dp.toPx()),
                    style = Stroke(width = 2.dp.toPx())
                )
            }

            // Second concentric ripple with offset phase
            val wave2 = (wave + 0.15f).let { if (it > 1.22f) it - 0.32f else it }
            val waveAlpha2 = (waveAlpha + 0.3f).let { if (it > 0.58f) it - 0.58f else it }
            Canvas(Modifier.fillMaxSize()) {
                val waveWidth = this.size.width * wave2
                val waveHeight = this.size.height * wave2
                drawRoundRect(
                    color = waveColor.copy(alpha = waveAlpha2),
                    topLeft = Offset((this.size.width - waveWidth) / 2f, (this.size.height - waveHeight) / 2f),
                    size = Size(waveWidth, waveHeight),
                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(radius.toPx() + 18.dp.toPx()),
                    style = Stroke(width = 1.5.dp.toPx())
                )
            }
        }
        Box(
            modifier = Modifier
                .size((size + 8).dp)
                .clip(RoundedCornerShape(radius + 5.dp))
                .background(frameBrush)
                .padding(4.dp),
            contentAlignment = Alignment.Center
        ) {
            Box(
                modifier = Modifier
                    .size(size.dp)
                    .clip(RoundedCornerShape(radius))
                    .background(PanelStrong)
                    .border(1.dp, Ink.copy(alpha = 0.72f), RoundedCornerShape(radius)),
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
                    Text(initial.uppercase(), color = Gold, fontSize = (size / 2.4).sp, fontWeight = FontWeight.Black)
                }
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
    else -> Brush.linearGradient(listOf(PanelStrong, Gold, PanelStrong))
}

private fun speakingWaveColor(id: String): Color = when (id) {
    "wave_neon" -> Pink
    "wave_royal" -> Gold
    "wave_soft" -> Color(0xFF27D3FF)
    else -> Gold
}

private fun entryLabel(id: String): String = when (id) {
    "entrance_crown" -> "ROYAL"
    "entrance_meteor" -> "METEOR"
    else -> "SPARK"
}

private fun decorationLabel(id: String): String = when (id) {
    "decor_crown" -> "CROWN"
    else -> "STARS"
}

private fun voiceBadgeLabel(id: String): String = when (id) {
    "voice_host_spotlight" -> "HOST"
    else -> "EQ"
}
