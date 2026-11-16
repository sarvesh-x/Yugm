package com.yugm.app.core.ui.theme

import android.os.Build
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp

private val DarkColorScheme = darkColorScheme(
    primary = PrimaryPink,
    secondary = PrimaryPurple,
    tertiary = SaffronGold,
    background = Color(0xFF060714),
    surface = Color(0xFF0E1121),
    onPrimary = Color(0xFF060714),
    onSecondary = Color.White,
    onTertiary = Color(0xFF060714),
    onBackground = Color.White,
    onSurface = Color.White
)

private val LightColorScheme = lightColorScheme(
    primary = Color(0xFFB5125A),
    onPrimary = Color.White,
    secondary = Color(0xFF6123AE),
    onSecondary = Color.White,
    tertiary = Color(0xFF795600),
    onTertiary = Color.White,
    background = Color(0xFFF7F6FB),
    onBackground = Color(0xFF191A22),
    surface = Color(0xFFFFFFFF),
    onSurface = Color(0xFF191A22),
    surfaceVariant = Color(0xFFE9E8F0),
    onSurfaceVariant = Color(0xFF474854),
    outline = Color(0xFF656575),
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
    val isDark: Boolean
)

val DarkYugmColors = YugmColors(
    background = Color(0xFF060714),
    surface = Color(0xFF0E1121),
    surfaceElevated = Color(0xFF171A2C),
    surfaceVariant = Color(0xFF1F2236),
    textPrimary = Color.White,
    textSecondary = Color(0xFF9EA3B9),
    border = Color(0x24FFFFFF),
    divider = Color(0x14FFFFFF),
    primary = Color(0xFFF6378B),
    primaryOn = Color(0xFF060714),
    secondary = Color(0xFF8D35F6),
    accent = Color(0xFFFFC52F),
    success = Color(0xFF3BE477),
    danger = Color(0xFFFF3B4F),
    warning = Color(0xFFFF9F43),
    isDark = true
)

val LightYugmColors = YugmColors(
    background = Color(0xFFF7F6FB),
    surface = Color(0xFFFFFFFF),
    surfaceElevated = Color(0xFFF1F1F7),
    surfaceVariant = Color(0xFFE9E8F0),
    textPrimary = Color(0xFF191A22),
    textSecondary = Color(0xFF5A5D70),
    border = Color(0x1A000000),
    divider = Color(0x0F000000),
    primary = Color(0xFFB5125A),
    primaryOn = Color.White,
    secondary = Color(0xFF6123AE),
    accent = Color(0xFF795600),
    success = Color(0xFF1E8E4E),
    danger = Color(0xFFBA1B1B),
    warning = Color(0xFFB7462B),
    isDark = false
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
    darkTheme: Boolean = true,
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
