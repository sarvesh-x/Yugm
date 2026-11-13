package com.yugm.app.core.ui.theme

import androidx.compose.ui.graphics.Color

val Purple80 = Color(0xFFD0BCFF)
val PurpleGrey80 = Color(0xFFCCC2DC)
val Pink80 = Color(0xFFEFB8C8)

val Purple40 = Color(0xFF6650a4)
val PurpleGrey40 = Color(0xFF625b71)
val Pink40 = Color(0xFF7D5260)

// Premium Theme Colors
val Background = Color(0xFF060714)
val Surface = Color(0xFF0E1121)
val SurfaceElevated = Color(0xFF171A2C)
val PrimaryPink = Color(0xFFF6378B)
val AccessiblePrimaryPink = Color(0xFFB5125A)
val AccessibleSaffron = Color(0xFFB7462B)
val PrimaryPurple = Color(0xFF8D35F6)
val SaffronGold = Color(0xFFFFC52F)
val SuccessGreen = Color(0xFF3BE477)
val DangerRed = Color(0xFFFF3B4F)
val TextPrimaryColor = Color(0xFFFFFFFF)
val TextSecondaryColor = Color(0xFF9EA3B9)
val BorderColor = Color(0x24FFFFFF)

// Aurora Gradients - each is a list of colors for gradient transitions
object Aurora {
    val Sunrise = listOf(Color(0xFFFF6B35), Color(0xFFF7C59F), Color(0xFFEFEFBB))
    val Sunset = listOf(Color(0xFFFF512F), Color(0xFFDD2475), Color(0xFFE94057))
    val Northern = listOf(Color(0xFF00F2FE), Color(0xFF4FACFE), Color(0xFFA18CD1))
    val Ocean = listOf(Color(0xFF0BDEFF), Color(0xFF2AF598), Color(0xFF00F260))
    val Cosmos = listOf(Color(0xFF1A2980), Color(0xFF26D0CE), Color(0xFF00E1FD))
    val Fire = listOf(Color(0xFFF12711), Color(0xFFF5AF19), Color(0xFFFFE000))
    val Royal = listOf(Color(0xFF141E30), Color(0xFFE100FF), Color(0xFF4A00E0))
    val Neon = listOf(Color(0xFF00F2FE), Color(0xFFF20000), Color(0xFFFEAC5E))

    val all = listOf(Sunrise, Sunset, Northern, Ocean, Cosmos, Fire, Royal, Neon)
}

// Legacy mappings for backwards compatibility
val Ink = Background
val Ink2 = Surface
val Panel = Color(0xB3141728)
val PanelStrong = Color(0xFF20243A)
val Line = BorderColor
val TextPrimary = Color(0xFFF8FAFC)
val TextSecondary = TextSecondaryColor
val TextMuted = TextSecondaryColor
val SurfaceColor = Surface
val Gold = SaffronGold
val Saffron = Color(0xFFFF684D)
val Pink = PrimaryPink
val Purple = PrimaryPurple
val Cyan = Color(0xFF27D3FF)
val Danger = DangerRed
val Success = SuccessGreen
