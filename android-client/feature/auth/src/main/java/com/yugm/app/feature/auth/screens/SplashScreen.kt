package com.yugm.app.feature.auth.screens

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yugm.app.core.ui.theme.*

@Composable
fun SplashScreen(onTimeout: suspend () -> Unit) {
    val scale = remember { Animatable(0.6f) }
    val motionEnabled = LocalMotionEnabled.current
    val colors = LocalYugmColors.current

    // Keyed on Unit: navigation must happen exactly once. Re-keying on the motion
    // preference would re-run the timer and issue a second navigate().
    LaunchedEffect(Unit) {
        if (motionEnabled) {
            scale.animateTo(1f, animationSpec = tween(durationMillis = 250))
        } else {
            scale.snapTo(1f)
        }
        onTimeout()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Background),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.scale(scale.value)
        ) {
            Box(
                modifier = Modifier
                    .size(100.dp)
                    .clip(RoundedCornerShape(28.dp))
                    .background(
                        Brush.linearGradient(
                            listOf(Saffron, Pink, Purple)
                        )
                    ),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "Y",
                    color = Color.White,
                    fontSize = 48.sp,
                    fontWeight = FontWeight.Black
                )
            }
            Spacer(modifier = Modifier.height(24.dp))
            Text(
                text = "Yugm",
                    color = colors.textPrimary,
                fontSize = 42.sp,
                fontWeight = FontWeight.Black
            )
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = "Match the Vibe",
                    color = if (colors.isDark) Gold else AccessibleSaffron,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold
            )
        }
    }
}
