package com.yugm.app.core.ui.components

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
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
 * App-wide loading spinner. Uses the single approved Lottie animation for consistency.
 * Callers control placement and size; [size] defaults to a compact inline spinner.
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
    LottieAnimation(
        composition = composition,
        progress = { if (motionEnabled) progress else 0f },
        modifier = modifier
            .size(size)
            .semantics { this.contentDescription = contentDescription }
    )
}
