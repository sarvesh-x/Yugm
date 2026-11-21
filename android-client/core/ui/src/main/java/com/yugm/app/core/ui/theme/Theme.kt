package com.yugm.app.core.ui.theme

import android.os.Build
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp

private val DarkColorScheme = darkColorScheme(
    primary = Color(0xFFFF70AD),
    secondary = Color(0xFFB19AFF),
    tertiary = Color(0xFFFFB36C),
    background = Color(0xFF090A15),
    surface = Color(0xFF171626),
    surfaceVariant = Color(0xFF241D32),
    onPrimary = Color(0xFF171626),
    onSecondary = Color(0xFF171626),
    onTertiary = Color(0xFF171626),
    onBackground = Color(0xFFF8F4FC),
    onSurface = Color(0xFFF8F4FC),
    onSurfaceVariant = Color(0xFFBDB3CA),
    outline = Color(0xFF3B314A),
    error = Color(0xFFFF3B4F),
    onError = Color.White
)

private val LightColorScheme = lightColorScheme(
    primary = Color(0xFFB91E68),
    onPrimary = Color.White,
    secondary = Color(0xFF6744C5),
    onSecondary = Color.White,
    tertiary = Color(0xFFAC4E12),
    onTertiary = Color.White,
    background = Color(0xFFFBF8FC),
    onBackground = Color(0xFF20182A),
    surface = Color(0xFFFFFFFF),
    onSurface = Color(0xFF20182A),
    surfaceVariant = Color(0xFFF3EDF6),
    onSurfaceVariant = Color(0xFF62586D),
    outline = Color(0xFFD9CDDF),
    error = Color(0xFFBA1B1B),
    onError = Color.White
)

@Immutable
data class Gradients(
    val sunrise: List<Color> = Aurora.Sunrise,
    val sunset: List<Color> = Aurora.Sunset,
    val northern: List<Color> = Aurora.Northern,
    val ocean: List<Color> = Aurora.Ocean,
    val cosmos: List<Color> = Aurora.Cosmos,
    val fire: List<Color> = Aurora.Fire,
    val royal: List<Color> = Aurora.Royal,
    val neon: List<Color> = Aurora.Neon,
)

val LocalGradients = staticCompositionLocalOf { Gradients() }

@Immutable
data class YugmColors(
    val background: Color,
    val surface: Color,
    val surfaceElevated: Color,
    val surfaceVariant: Color,
    val textPrimary: Color,
    val textSecondary: Color,
    val border: Color,
    val divider: Color,
    val primary: Color,
    val primaryOn: Color,
    val secondary: Color,
    val accent: Color,
    val success: Color,
    val danger: Color,
    val warning: Color,
    val isDark: Boolean,
    val onboardingBackground: Color = OnboardingBgLight,
    val onboardingGlowLavender: Color = OnboardingGlowLavender,
    val onboardingGlowPink: Color = OnboardingGlowPink,
    val onboardingTextPrimary: Color = OnboardingTextPrimaryLight,
    val onboardingTextSecondary: Color = OnboardingTextSecondaryLight,
    val bottomDockSurface: Color = Color(0xFFFCF9FF),
    val bottomDockInactiveContent: Color = Color(0xFF62586D),
    val bottomDockActiveContent: Color = Color.White,
    val bottomDockOutline: Color = Color(0x66D9CDDF),
    val bottomDockShadow: Color = Color(0x1A8A5CFF),
)

/** Shared message colors keep direct and clan conversations visually aligned. */
fun YugmColors.chatBubbleBackground(isMine: Boolean): Color =
    if (isMine) secondary else surfaceVariant

fun YugmColors.chatBubbleForeground(isMine: Boolean): Color =
    if (isMine) Color.White else textPrimary

fun YugmColors.chatBubbleMetadata(isMine: Boolean): Color =
    if (isMine) Color.White else textSecondary

val DarkYugmColors = YugmColors(
    background = Color(0xFF090A15),
    surface = Color(0xFF171626),
    surfaceElevated = Color(0xFF201D30),
    surfaceVariant = Color(0xFF241D32),
    textPrimary = Color(0xFFF8F4FC),
    textSecondary = Color(0xFFBDB3CA),
    border = Color(0xFF3B314A),
    divider = Color(0x3B3B314A),
    primary = Color(0xFFFF70AD),
    primaryOn = Color(0xFF171626),
    secondary = Color(0xFFB19AFF),
    accent = Color(0xFFFFB36C),
    success = Color(0xFF3BE477),
    danger = Color(0xFFFF3B4F),
    warning = Color(0xFFFF9F43),
    isDark = true,
    onboardingBackground = Color(0xFF090A15),
    onboardingGlowLavender = Color(0xFF281D3B),
    onboardingGlowPink = Color(0xFF3D192C),
    onboardingTextPrimary = Color(0xFFF8F4FC),
    onboardingTextSecondary = Color(0xFFBDB3CA),
    bottomDockSurface = Color(0xFF191624),
    bottomDockInactiveContent = Color(0xFFBDB3CA),
    bottomDockActiveContent = Color.White,
    bottomDockOutline = Color(0x33FFFFFF),
    bottomDockShadow = Color(0x26000000),
)

val LightYugmColors = YugmColors(
    background = Color(0xFFFBF8FC),
    surface = Color(0xFFFFFFFF),
    surfaceElevated = Color(0xFFFCFAFD),
    surfaceVariant = Color(0xFFF3EDF6),
    textPrimary = Color(0xFF20182A),
    textSecondary = Color(0xFF62586D),
    border = Color(0xFFD9CDDF),
    divider = Color(0x66D9CDDF),
    primary = Color(0xFFB91E68),
    primaryOn = Color.White,
    secondary = Color(0xFF6744C5),
    accent = Color(0xFFAC4E12),
    success = Color(0xFF1E8E4E),
    danger = Color(0xFFBA1B1B),
    warning = Color(0xFFB7462B),
    isDark = false,
    onboardingBackground = Color(0xFFFBF8FC),
    onboardingGlowLavender = Color(0xFFF0E4FC),
    onboardingGlowPink = Color(0xFFF9E7F1),
    onboardingTextPrimary = Color(0xFF20182A),
    onboardingTextSecondary = Color(0xFF62586D),
    bottomDockSurface = Color(0xFFFCF9FF),
    bottomDockInactiveContent = Color(0xFF62586D),
    bottomDockActiveContent = Color.White,
    bottomDockOutline = Color(0x40D9CDDF),
    bottomDockShadow = Color(0x148A5CFF),
)

val LocalYugmColors = staticCompositionLocalOf { DarkYugmColors }

object YugmShapes {
    val extraSmall = androidx.compose.foundation.shape.RoundedCornerShape(8.dp)
    val small = androidx.compose.foundation.shape.RoundedCornerShape(12.dp)
    val medium = androidx.compose.foundation.shape.RoundedCornerShape(18.dp)
    val large = androidx.compose.foundation.shape.RoundedCornerShape(24.dp)
    val extraLarge = androidx.compose.foundation.shape.RoundedCornerShape(30.dp)
    val pill = androidx.compose.foundation.shape.RoundedCornerShape(50)
}

@Composable
fun YugmTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit
) {
    val motionEnabled = rememberSystemMotionEnabled()
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    val yugmColors = if (darkTheme) DarkYugmColors else LightYugmColors
    CompositionLocalProvider(LocalMotionEnabled provides motionEnabled, LocalYugmColors provides yugmColors) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = YugmTypography,
            shapes = androidx.compose.material3.Shapes(
                extraSmall = YugmShapes.extraSmall,
                small = YugmShapes.small,
                medium = YugmShapes.medium,
                large = YugmShapes.large,
                extraLarge = YugmShapes.extraLarge
            ),
            content = content
        )
    }
}
