package com.yugm.app.core.ui.cosmetics

import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import com.yugm.app.core.ui.theme.Gold
import com.yugm.app.core.ui.theme.Pink
import com.yugm.app.core.ui.theme.Purple

data class CosmeticVisual(
    val id: String,
    val type: String,
    val primary: Color,
    val secondary: Color,
    val accent: Color,
    val label: String = ""
)

data class ChatBubbleVisual(
    val fill: Brush,
    val border: Color,
    val text: Color
)

fun cosmeticVisual(id: String, type: String, preview: String = ""): CosmeticVisual = when (id) {
    "avatar_nova_static" -> CosmeticVisual(id, type, Color(0xFFFFD5DC), Color(0xFF7C4DFF), Color(0xFFFFF1F4), "NOVA")
    "avatar_pixel_gif" -> CosmeticVisual(id, type, Color(0xFF69F0AE), Color(0xFF00B0FF), Color(0xFFE7F8FF), "PIXEL")
    "avatar_cosmic_gif" -> CosmeticVisual(id, type, Color(0xFF7C4DFF), Color(0xFFFF2D95), Color(0xFFB9F2FF), "COSMIC")
    "avatar_kitsune_gif" -> CosmeticVisual(id, type, Color(0xFFFF7043), Color(0xFFD50000), Color(0xFFFFF3E0), "KITSUNE")

    "frame_gold" -> CosmeticVisual(id, type, Color(0xFFFFD700), Color(0xFFFFA000), Color(0xFFFFE082), "GOLD")
    "frame_neon" -> CosmeticVisual(id, type, Color(0xFF00E5FF), Color(0xFFFF2D95), Color(0xFF7C4DFF), "NEON")
    "frame_crystal" -> CosmeticVisual(id, type, Color(0xFFB9F2FF), Color(0xFFE8FBFF), Color(0xFF9C6BFF), "CRYSTAL")
    "frame_royal" -> CosmeticVisual(id, type, Color(0xFFFFD54F), Color(0xFFE040FB), Color(0xFF8E24AA), "ROYAL")
    "frame_gradient" -> CosmeticVisual(id, type, Color(0xFFFF6FD8), Color(0xFF8B5CF6), Color(0xFF27D3FF), "SHIFT")
    "frame_floral" -> CosmeticVisual(id, type, Color(0xFFFF9EC4), Color(0xFFF06292), Color(0xFFA5D6A7), "FLORAL")
    "frame_iridescent" -> CosmeticVisual(id, type, Color(0xFF9BE7FF), Color(0xFFD9A6FF), Color(0xFFA0FFD8), "IRIS")
    "frame_minimal" -> CosmeticVisual(id, type, Color(0xFFF5E6C4), Color(0xFFC9A24B), Color(0xFFFFFCF2), "MINIMAL")
    "frame_dragon_fire" -> CosmeticVisual(id, type, Color(0xFFFF3D00), Color(0xFFFF9100), Color(0xFFFFEA00), "DRAGON")
    "frame_sakura_blossom" -> CosmeticVisual(id, type, Color(0xFFFFB7C5), Color(0xFFF06292), Color(0xFFF8BBD0), "SAKURA")
    "frame_cyber_punk" -> CosmeticVisual(id, type, Color(0xFF00FF9C), Color(0xFF00E5FF), Color(0xFFFF007F), "CYBER")
    "frame_phoenix_wings" -> CosmeticVisual(id, type, Color(0xFFC62828), Color(0xFFFF6D00), Color(0xFFFFD600), "PHOENIX")

    "wave_soft" -> CosmeticVisual(id, type, Color(0xFF27D3FF), Color(0xFF7C4DFF), Color(0xFFE0F7FF), "SOFT")
    "wave_neon" -> CosmeticVisual(id, type, Color(0xFFFF2D95), Color(0xFF00E5FF), Color(0xFF7C4DFF), "NEON")
    "wave_royal" -> CosmeticVisual(id, type, Color(0xFFFFD54F), Color(0xFFFF8A22), Color(0xFFFFF8E1), "ROYAL")
    "wave_pulse" -> CosmeticVisual(id, type, Color(0xFF8B5CF6), Color(0xFF27D3FF), Color(0xFFE9D5FF), "PULSE")
    "wave_fire" -> CosmeticVisual(id, type, Color(0xFFFF3D00), Color(0xFFFFD600), Color(0xFFFF8A65), "FIRE")
    "wave_rainbow" -> CosmeticVisual(id, type, Color(0xFFFF5252), Color(0xFF40C4FF), Color(0xFFE040FB), "PRISM")
    "wave_cyber" -> CosmeticVisual(id, type, Color(0xFF76FF03), Color(0xFF00E5FF), Color(0xFFFF007F), "MATRIX")

    "theme_midnight" -> CosmeticVisual(id, type, Color(0xFF171A3A), Color(0xFF0A0B16), Color(0xFF7C8BFF), "MIDNIGHT")
    "theme_saffron" -> CosmeticVisual(id, type, Color(0xFF6B3217), Color(0xFF24111D), Color(0xFFFFB300), "SAFFRON")
    "theme_aurora" -> CosmeticVisual(id, type, Color(0xFF07565C), Color(0xFF18102E), Color(0xFF5CFFD6), "AURORA")
    "theme_sunset" -> CosmeticVisual(id, type, Color(0xFF802E61), Color(0xFF281326), Color(0xFFFF9A62), "SUNSET")

    "bubble_gold" -> CosmeticVisual(id, type, Color(0xFFFFD54F), Color(0xFFFF8F00), Color(0xFFFFF8E1), "GOLD")
    "bubble_neon" -> CosmeticVisual(id, type, Color(0xFF111425), Color(0xFF00E5FF), Color(0xFFFF2D95), "NEON")
    "bubble_gradient" -> CosmeticVisual(id, type, Color(0xFFFF6FD8), Color(0xFF8B5CF6), Color(0xFF27D3FF), "GRADIENT")
    "bubble_rounded" -> CosmeticVisual(id, type, Color(0xFFF1E9FF), Color(0xFFCBB7FF), Color(0xFF3B1E6E), "SOFT")
    "bubble_festive" -> CosmeticVisual(id, type, Color(0xFFFF8A65), Color(0xFFE040FB), Color(0xFFFFD54F), "FESTIVE")
    "bubble_royal" -> CosmeticVisual(id, type, Color(0xFF3D1C78), Color(0xFF1B0E36), Color(0xFFFFD54F), "ROYAL")

    "name_gold_shimmer" -> CosmeticVisual(id, type, Color(0xFFFFD700), Color(0xFFFFF8E1), Color(0xFFC9A24B), "GOLD")
    "name_neon_glow" -> CosmeticVisual(id, type, Color(0xFF00E5FF), Color(0xFFFF2D95), Color(0xFF7C4DFF), "NEON")
    "name_rainbow_pulse" -> CosmeticVisual(id, type, Color(0xFFFF5252), Color(0xFF40C4FF), Color(0xFFE040FB), "RAINBOW")
    "name_fire_gradient" -> CosmeticVisual(id, type, Color(0xFFFFD600), Color(0xFFFF6D00), Color(0xFFD50000), "FIRE")

    "intro_ask_me" -> CosmeticVisual(id, type, Color(0xFF27D3FF), Color(0xFF7C4DFF), Color(0xFFE0F7FF), "ASK")
    "intro_my_vibe" -> CosmeticVisual(id, type, Color(0xFFFF8A65), Color(0xFFFF2D95), Color(0xFFFFF3E0), "VIBE")
    "intro_two_truths" -> CosmeticVisual(id, type, Color(0xFF00BFA5), Color(0xFFFFD54F), Color(0xFFE0FFF9), "2T")
    "intro_fun_facts" -> CosmeticVisual(id, type, Color(0xFF69F0AE), Color(0xFF40C4FF), Color(0xFFE9FFF2), "FUN")

    "shelf_rose_wall" -> CosmeticVisual(id, type, Color(0xFFFF8FB1), Color(0xFFC2185B), Color(0xFFFFE4EC), "ROSE")
    "shelf_crown_case" -> CosmeticVisual(id, type, Color(0xFFFFD54F), Color(0xFF7C4DFF), Color(0xFFFFF8E1), "CROWN")
    "shelf_diamond" -> CosmeticVisual(id, type, Color(0xFF9BE7FF), Color(0xFF2979FF), Color(0xFFF1FBFF), "DIAMOND")
    "shelf_heart" -> CosmeticVisual(id, type, Color(0xFFFF5252), Color(0xFFFF80AB), Color(0xFFFFE4E8), "HEART")

    "room_entry_confetti" -> CosmeticVisual(id, type, Color(0xFFFFD54F), Color(0xFFFF2D95), Color(0xFF27D3FF), "CONFETTI")
    "room_entry_spotlight" -> CosmeticVisual(id, type, Color(0xFFFFF8E1), Color(0xFFFFB300), Color(0xFFFF8F00), "SPOTLIGHT")
    "entry_rainbow" -> CosmeticVisual(id, type, Color(0xFFFF5252), Color(0xFF40C4FF), Color(0xFF69F0AE), "RAINBOW")
    "entry_ghost" -> CosmeticVisual(id, type, Color(0xFFB3E5FC), Color(0xFF7C4DFF), Color(0xFFF1FBFF), "GHOST")

    "ambience_lofi" -> CosmeticVisual(id, type, Color(0xFF7C4DFF), Color(0xFFFF80AB), Color(0xFFE9D5FF), "LO-FI")
    "ambience_rain" -> CosmeticVisual(id, type, Color(0xFF2979FF), Color(0xFF00E5FF), Color(0xFFE3F2FD), "RAIN")
    "ambience_cafe" -> CosmeticVisual(id, type, Color(0xFF8D6E63), Color(0xFFFFB300), Color(0xFFFFF3E0), "CAFE")
    "ambience_night" -> CosmeticVisual(id, type, Color(0xFF1A237E), Color(0xFF00E5FF), Color(0xFFE8EAF6), "NIGHT")
    "ambience_forest" -> CosmeticVisual(id, type, Color(0xFF1B5E20), Color(0xFF69F0AE), Color(0xFFE8F5E9), "FOREST")

    else -> fallbackVisual(id, type, preview)
}

private fun fallbackVisual(id: String, type: String, preview: String): CosmeticVisual = when (type) {
    "AVATAR_FRAME" -> CosmeticVisual(id, type, Gold, Pink, Purple, "FRAME")
    "SPEAKING_WAVE" -> CosmeticVisual(id, type, Purple, Pink, Color(0xFF27D3FF), "WAVE")
    "PROFILE_THEME" -> CosmeticVisual(id, type, Color(0xFF39206F), Color(0xFF111323), Purple, "THEME")
    "CHAT_BUBBLE" -> CosmeticVisual(id, type, Purple, Pink, Color(0xFFFF5866), "CHAT")
    "NAME_STYLE" -> CosmeticVisual(id, type, Gold, Pink, Purple, "NAME")
    "INTRO_CARD" -> CosmeticVisual(id, type, Purple, Color(0xFF1B1A28), Gold, preview.take(8).ifBlank { "HELLO" })
    "GIFT_SHELF" -> CosmeticVisual(id, type, Color(0xFFFF8FB1), Gold, Purple, "GIFT")
    "ROOM_ENTRY" -> CosmeticVisual(id, type, Color(0xFF27D3FF), Purple, Gold, "ENTRY")
    "ROOM_AMBIENCE" -> CosmeticVisual(id, type, Color(0xFF7C4DFF), Color(0xFF00E5FF), Pink, "AMBIENCE")
    "AVATAR_ASSET" -> CosmeticVisual(id, type, Purple, Pink, Gold, preview.take(6).ifBlank { "AVATAR" })
    "PROFILE_BANNER" -> CosmeticVisual(id, type, Color(0xFF6B21A8), Color(0xFF3B0764), Gold, "BANNER")
    else -> CosmeticVisual(id, type, Purple, Pink, Gold, preview.take(6).ifBlank { "YUGM" })
}

fun profileBannerColors(id: String): List<Color> = when (id) {
    "banner_deep_purple" -> listOf(Color(0xFF4C1D95), Color(0xFF2E1065), Color(0xFF1E0942))
    "banner_cosmic_aurora" -> listOf(Color(0xFF0F766E), Color(0xFF1E1B4B), Color(0xFF0D9488))
    "banner_midnight_sky" -> listOf(Color(0xFF1E293B), Color(0xFF0F172A), Color(0xFF020617))
    "banner_royal_gold" -> listOf(Color(0xFF78350F), Color(0xFFB45309), Color(0xFF451A03))
    else -> listOf(Color(0xFF3B0764), Color(0xFF1E0942), Color(0xFF120324)) // Default rich purple banner
}

fun profileThemeColors(id: String): List<Color> = when (id) {
    "theme_midnight" -> listOf(Color(0xFF171A3A), Color(0xFF0A0B16))
    "theme_saffron" -> listOf(Color(0xFF6B3217), Color(0xFF24111D))
    "theme_aurora" -> listOf(Color(0xFF07565C), Color(0xFF18102E))
    "theme_sunset" -> listOf(Color(0xFF802E61), Color(0xFF281326))
    else -> listOf(Color(0xFF39206F), Color(0xFF111323))
}

fun profileThemeAccent(id: String): Color = when (id) {
    "theme_midnight" -> Color(0xFF7C8BFF)
    "theme_saffron" -> Color(0xFFFFB300)
    "theme_aurora" -> Color(0xFF5CFFD6)
    "theme_sunset" -> Color(0xFFFF9A62)
    else -> Purple
}

fun nameStyleBrush(id: String): Brush = when (id) {
    "name_gold_shimmer" -> Brush.horizontalGradient(listOf(Gold, Color(0xFFFFF8E1), Color(0xFFC9A24B), Gold))
    "name_neon_glow" -> Brush.horizontalGradient(listOf(Color(0xFF00E5FF), Color(0xFFFF2D95), Color(0xFF7C4DFF)))
    "name_rainbow_pulse" -> Brush.horizontalGradient(listOf(Color(0xFFFF5252), Color(0xFFFFD740), Color(0xFF69F0AE), Color(0xFF40C4FF), Color(0xFFE040FB)))
    "name_fire_gradient" -> Brush.horizontalGradient(listOf(Color(0xFFFFD600), Color(0xFFFF6D00), Color(0xFFD50000)))
    else -> Brush.horizontalGradient(listOf(Color.White, Color.White))
}

fun chatBubbleVisual(id: String): ChatBubbleVisual = when (id) {
    "bubble_gold" -> ChatBubbleVisual(
        fill = Brush.horizontalGradient(listOf(Color(0xFFFFE082), Color(0xFFFFB300))),
        border = Color(0xFFFFF8E1),
        text = Color(0xFF2B1B00)
    )
    "bubble_neon" -> ChatBubbleVisual(
        fill = Brush.horizontalGradient(listOf(Color(0xFF101425), Color(0xFF1B1035))),
        border = Color(0xFF00E5FF),
        text = Color.White
    )
    "bubble_gradient" -> ChatBubbleVisual(
        fill = Brush.horizontalGradient(listOf(Color(0xFFFF6FD8), Color(0xFF8B5CF6), Color(0xFF27D3FF))),
        border = Color.White.copy(alpha = 0.22f),
        text = Color.White
    )
    "bubble_rounded" -> ChatBubbleVisual(
        fill = Brush.horizontalGradient(listOf(Color(0xFFF7F1FF), Color(0xFFE7D8FF))),
        border = Color(0xFFCBB7FF),
        text = Color(0xFF3B1E6E)
    )
    "bubble_festive" -> ChatBubbleVisual(
        fill = Brush.horizontalGradient(listOf(Color(0xFFFF8A65), Color(0xFFE040FB))),
        border = Color(0xFFFFD54F),
        text = Color.White
    )
    "bubble_royal" -> ChatBubbleVisual(
        fill = Brush.horizontalGradient(listOf(Color(0xFF4A238F), Color(0xFF1B0E36))),
        border = Color(0xFFFFD54F),
        text = Color(0xFFFFF6D8)
    )
    else -> ChatBubbleVisual(
        fill = Brush.horizontalGradient(listOf(Purple, Pink, Color(0xFFFF5866))),
        border = Pink.copy(alpha = 0.35f),
        text = Color.White
    )
}
