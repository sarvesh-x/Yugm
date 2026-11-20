package com.yugm.app.feature.social.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.SportsEsports
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.yugm.app.core.ui.theme.LocalYugmColors
import com.yugm.app.feature.social.R

@Composable
fun GamesScreen(modifier: Modifier = Modifier, reselectSignal: Int = 0) {
    val colors = LocalYugmColors.current
    val scrollState = rememberScrollState()

    LaunchedEffect(reselectSignal) {
        if (reselectSignal > 0) {
            scrollState.animateScrollTo(0)
        }
    }

    Column(
        modifier
            .fillMaxSize()
            .background(colors.background)
            .statusBarsPadding()
            .padding(bottom = 24.dp)
    ) {
        Text(
            text = stringResource(R.string.arcade_title),
            color = colors.textPrimary,
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 24.dp, vertical = 20.dp).semantics { heading() }
        )
        Box(
            modifier = Modifier.weight(1f).fillMaxWidth().padding(24.dp),
            contentAlignment = Alignment.Center
        ) {
            Column(
                modifier = Modifier.verticalScroll(scrollState),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box(
                    modifier = Modifier.size(72.dp).background(colors.surfaceElevated, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Outlined.SportsEsports,
                        contentDescription = null,
                        tint = colors.secondary,
                        modifier = Modifier.size(34.dp)
                    )
                }
                Text(
                    text = stringResource(R.string.arcade_coming_soon),
                    color = colors.textSecondary,
                    style = MaterialTheme.typography.titleMedium,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = 20.dp)
                )
            }
        }
    }
}
