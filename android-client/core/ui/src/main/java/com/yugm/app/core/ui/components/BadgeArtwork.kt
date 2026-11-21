package com.yugm.app.core.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import coil.compose.SubcomposeAsyncImage
import com.yugm.app.core.api.resolveMediaUrl
import com.yugm.app.core.model.Achievement
import com.yugm.app.core.model.BadgeGallery
import com.yugm.app.core.ui.theme.LocalYugmColors

@Composable
fun BadgeArtwork(badge: Achievement, modifier: Modifier = Modifier, locked: Boolean = false) {
    val colors = LocalYugmColors.current
    val tint = if (locked) colors.textSecondary else when (badge.earnedBadgeTier) {
        "BRONZE" -> Color(0xFFB06544)
        "SILVER" -> Color(0xFF667A97)
        "GOLD" -> Color(0xFFAA701A)
        "PLATINUM" -> Color(0xFF23807A)
        "DIAMOND" -> Color(0xFF3280BD)
        "MASTER" -> Color(0xFF9D53BF)
        else -> if (badge.badgeKind == "HONOR") Color(0xFF8D59BE) else colors.primary
    }
    val image = resolveMediaUrl(badge.imageUrl)
    val fallback: @Composable () -> Unit = {
        Icon(
            imageVector = when (badge.icon) {
                "sparkles" -> Icons.Filled.AutoAwesome
                "flame" -> Icons.Filled.LocalFireDepartment
                "users" -> Icons.Filled.Group
                "radio" -> Icons.Filled.Radio
                "gift" -> Icons.Filled.CardGiftcard
                "message-circle" -> Icons.Filled.ChatBubble
                "star" -> Icons.Filled.Star
                "headphones" -> Icons.Filled.Headphones
                "gamepad-2" -> Icons.Filled.SportsEsports
                "heart" -> Icons.Filled.Favorite
                "shield" -> Icons.Filled.Shield
                "medal" -> Icons.Filled.MilitaryTech
                else -> Icons.Filled.EmojiEvents
            },
            contentDescription = badge.title,
            modifier = Modifier.fillMaxSize(.58f),
            tint = tint
        )
    }
    Surface(modifier, shape = RoundedCornerShape(28), color = tint.copy(alpha = .12f), border = BorderStroke(1.dp, tint.copy(alpha = .25f))) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            if (image == null) fallback() else SubcomposeAsyncImage(
                model = image,
                contentDescription = badge.title,
                modifier = Modifier.fillMaxSize().padding(4.dp),
                contentScale = ContentScale.Fit,
                colorFilter = if (locked) ColorFilter.colorMatrix(ColorMatrix().apply { setToSaturation(0f) }) else null,
                alignment = Alignment.Center,
                loading = { Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { fallback() } },
                error = { Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { fallback() } }
            )
        }
    }
}

@Composable
fun WornBadgeRow(
    badges: List<Achievement>,
    modifier: Modifier = Modifier,
    capacity: Int = BadgeGallery.FALLBACK_CAPACITY
) {
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        badges.take(capacity.coerceAtLeast(0)).forEach { BadgeArtwork(it, Modifier.size(36.dp)) }
    }
}
