package com.yugm.app.core.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.PullToRefreshDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshState
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yugm.app.core.ui.theme.Pink

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun YugmPullToRefreshBox(
    isRefreshing: Boolean,
    onRefresh: () -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable BoxScope.() -> Unit
) {
    val state = rememberPullToRefreshState()
    PullToRefreshBox(
        isRefreshing = isRefreshing,
        onRefresh = onRefresh,
        state = state,
        modifier = modifier,
        indicator = {
            HeartRefreshIndicator(state = state, isRefreshing = isRefreshing)
        },
        content = content
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun BoxScope.HeartRefreshIndicator(state: PullToRefreshState, isRefreshing: Boolean) {
    val pulse = remember { Animatable(1f) }
    LaunchedEffect(isRefreshing) {
        if (isRefreshing) {
            while (true) {
                pulse.animateTo(1.12f, tween(480, easing = FastOutSlowInEasing))
                pulse.animateTo(0.88f, tween(480, easing = FastOutSlowInEasing))
            }
        } else {
            pulse.snapTo(1f)
        }
    }
    val scale = if (isRefreshing) pulse.value else (0.7f + state.distanceFraction.coerceIn(0f, 1f) * 0.3f)

    PullToRefreshDefaults.IndicatorBox(
        state = state,
        isRefreshing = isRefreshing,
        modifier = Modifier.align(androidx.compose.ui.Alignment.TopCenter),
        containerColor = Color(0xFF201A31),
        elevation = 4.dp
    ) {
        Text(
            text = "♥",
            color = Pink,
            fontSize = 22.sp,
            fontWeight = FontWeight.Black,
            modifier = Modifier.graphicsLayer { scaleX = scale; scaleY = scale }
        )
    }
}
