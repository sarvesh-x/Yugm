package com.yugm.app.core.ui.theme

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.runtime.Composable

val Purple80 = Color(0xFFD0BCFF)
val PurpleGrey80 = Color(0xFFCCC2DC)
val Pink80 = Color(0xFFEFB8C8)

val Purple40 = Color(0xFF6650a4)
val PurpleGrey40 = Color(0xFF625b71)
val Pink40 = Color(0xFF7D5260)

// Official Yugm Brand Reference (Derived from ic_launcher_background.xml)
val BrandStart = Color(0xFFFF8A22)   // Sunset Orange (Stop 0.00)
val BrandMiddle = Color(0xFFFF3E93)  // Vibe Pink     (Stop 0.52)
val BrandEnd = Color(0xFF8A5CFF)     // Electric Violet (Stop 1.00)

val BrandOrange = BrandStart
val BrandPink = BrandMiddle
val BrandViolet = BrandEnd
val OnBrand = Color.White

val YugmBrandColors = listOf(BrandStart, BrandMiddle, BrandEnd)

val YugmBrandStops = arrayOf(
    0.00f to BrandStart,
    0.52f to BrandMiddle,
    1.00f to BrandEnd,
)

// Reusable Brand Gradient System
object BrandGradients {
    // Official Diagonal Brand Gradient (bottom-left to top-right as in launcher icon)
    fun diagonal(
        start: Offset = Offset(0f, Float.POSITIVE_INFINITY),
        end: Offset = Offset(Float.POSITIVE_INFINITY, 0f)
    ) = Brush.linearGradient(
        colorStops = YugmBrandStops,
        start = start,
        end = end
    )

    // Horizontal Brand Gradient for buttons & wide UI elements
    val horizontal = Brush.horizontalGradient(colorStops = YugmBrandStops)

    // Contrast-Safe Darker Gradient Variant (used when crisp white text is required)
    val darkVariant = Brush.horizontalGradient(
        listOf(
            Color(0xFFD66A10),
            Color(0xFFD42173),
            Color(0xFF6C3CD6)
        )
    )

    // Low-Opacity Tinted Brand Gradient for subtle decorative accents
    val subtleTint = Brush.horizontalGradient(
        listOf(
            BrandStart.copy(alpha = 0.15f),
            BrandMiddle.copy(alpha = 0.15f),
            BrandEnd.copy(alpha = 0.15f)
        )
    )
}

// Standard crisp white text color over official brand gradient
val BrandGradientOnText = Color.White

// Theme-aware semantic colors. Keep these legacy names so existing screens
// automatically follow the selected app theme.
val Background: Color
    @Composable get() = LocalYugmColors.current.background
val Surface: Color
    @Composable get() = LocalYugmColors.current.surface
val SurfaceElevated: Color
    @Composable get() = LocalYugmColors.current.surfaceElevated
val PrimaryPink = Color(0xFFF6378B)
val AccessiblePrimaryPink = Color(0xFFB5125A)
val AccessibleSaffron = Color(0xFFB7462B)
val PrimaryPurple = Color(0xFF8D35F6)
val SaffronGold = Color(0xFFFFC52F)
val SuccessGreen = Color(0xFF3BE477)
val DangerRed = Color(0xFFFF3B4F)
val TextPrimaryColor: Color
    @Composable get() = LocalYugmColors.current.textPrimary
val TextSecondaryColor: Color
    @Composable get() = LocalYugmColors.current.textSecondary
val BorderColor: Color
    @Composable get() = LocalYugmColors.current.border

// Premium Onboarding design tokens matching visual reference specification
val OnboardingBgLight = Color(0xFFFBF8FC)
val OnboardingBgDark = Color(0xFF090A15)
val OnboardingGlowLavender = Color(0xFFF0E4FC)
val OnboardingGlowPink = Color(0xFFF9E7F1)
val OnboardingTextPrimaryLight = Color(0xFF20182A)
val OnboardingTextSecondaryLight = Color(0xFF62586D)

val OnboardingBrandStart = BrandStart
val OnboardingBrandMiddle = BrandMiddle
val OnboardingBrandEnd = BrandEnd
val onboardingBrandGradient = YugmBrandColors

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
val Ink: Color
    @Composable get() = Background
val Ink2: Color
    @Composable get() = Surface
val Panel: Color
    @Composable get() = SurfaceElevated
val PanelStrong: Color
    @Composable get() = LocalYugmColors.current.surfaceVariant
val Line: Color
    @Composable get() = LocalYugmColors.current.divider
val TextPrimary: Color
    @Composable get() = LocalYugmColors.current.textPrimary
val TextSecondary: Color
    @Composable get() = LocalYugmColors.current.textSecondary
val TextMuted: Color
    @Composable get() = LocalYugmColors.current.textSecondary
val SurfaceColor: Color
    @Composable get() = Surface
val Gold = SaffronGold
val Saffron = Color(0xFFFF684D)
val Pink = PrimaryPink
val Purple = PrimaryPurple
val Cyan = Color(0xFF27D3FF)
val Danger = DangerRed
val Success = SuccessGreen

