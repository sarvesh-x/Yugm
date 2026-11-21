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

object YugmLoadingSpinnerDefaults {
    /** Global rendered-size multiplier for every `YugmLoadingSpinner` in the app. */
    const val SizeScale = 1.25f

    /** Baseline (pre-scale) size used when a caller does not provide one. */
    val BaselineSize: Dp = 40.dp
}

/** Call-site sizes are design baselines; the global scale is applied exactly once here. */
internal fun spinnerDisplaySize(requestedSize: Dp): Dp = requestedSize * YugmLoadingSpinnerDefaults.SizeScale

/**
 * App-wide loading spinner rendered with the official Yugm Lottie fluid animation,
 * styled with the canonical Yugm brand gradient palette (Sunset Orange -> Vibe Pink -> Electric Violet).
 * Works and remains clearly visible across both Light and Dark themes.
 */
@Composable
fun YugmLoadingSpinner(
    modifier: Modifier = Modifier,
    size: Dp = YugmLoadingSpinnerDefaults.BaselineSize,
    contentDescription: String = "Loading"
) {
    val motionEnabled = LocalMotionEnabled.current
    val composition by rememberLottieComposition(LottieCompositionSpec.RawRes(R.raw.loading_spinner))
    val progress by animateLottieCompositionAsState(
        composition = composition,
        iterations = if (motionEnabled) LottieConstants.IterateForever else 1
    )
    val displaySize = spinnerDisplaySize(size)

    Box(
        modifier = modifier
            .size(displaySize)
            .semantics { this.contentDescription = contentDescription },
        contentAlignment = Alignment.Center
    ) {
        LottieAnimation(
            composition = composition,
            progress = { if (motionEnabled) progress else 0f },
            modifier = Modifier.size(displaySize)
        )
    }
}
