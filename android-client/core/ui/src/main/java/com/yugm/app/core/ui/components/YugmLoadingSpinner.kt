package com.yugm.app.core.ui.components

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.airbnb.lottie.compose.LottieAnimation
import com.airbnb.lottie.compose.LottieCompositionSpec
import com.airbnb.lottie.compose.LottieConstants
import com.airbnb.lottie.compose.animateLottieCompositionAsState
import com.airbnb.lottie.compose.rememberLottieComposition
import com.yugm.app.core.ui.R
import com.yugm.app.core.ui.theme.LocalMotionEnabled

/**
 * App-wide loading spinner rendered with the official Yugm Lottie fluid animation,
 * styled with the canonical Yugm brand gradient palette (Sunset Orange -> Vibe Pink -> Electric Violet).
 * Works and remains clearly visible across both Light and Dark themes.
 */
@Composable
fun YugmLoadingSpinner(
    modifier: Modifier = Modifier,
    size: Dp = 40.dp,
    contentDescription: String = "Loading"
) {
    val motionEnabled = LocalMotionEnabled.current
    val composition by rememberLottieComposition(LottieCompositionSpec.RawRes(R.raw.loading_spinner))
    val progress by animateLottieCompositionAsState(
        composition = composition,
        iterations = if (motionEnabled) LottieConstants.IterateForever else 1
    )

    Box(
        modifier = modifier
            .size(size)
            .semantics { this.contentDescription = contentDescription },
        contentAlignment = Alignment.Center
    ) {
        LottieAnimation(
            composition = composition,
            progress = { if (motionEnabled) progress else 0f },
            modifier = Modifier.size(size)
        )
    }
}
