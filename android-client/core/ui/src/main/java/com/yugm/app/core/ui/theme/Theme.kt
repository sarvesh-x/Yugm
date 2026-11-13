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
    background = Background,
    surface = Surface,
    onPrimary = Background,
    onSecondary = Color.White,
    onTertiary = Background,
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

    CompositionLocalProvider(LocalMotionEnabled provides motionEnabled) {
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
