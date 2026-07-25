package com.example.yugm.core.ui.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
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
    onPrimary = Color.White,
    onSecondary = Color.White,
    onTertiary = Background,
    onBackground = Color.White,
    onSurface = Color.White
)

private val LightColorScheme = lightColorScheme(
    primary = PrimaryPink,
    secondary = PrimaryPurple,
    tertiary = SaffronGold,
    background = Background,
    surface = Surface
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
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

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
