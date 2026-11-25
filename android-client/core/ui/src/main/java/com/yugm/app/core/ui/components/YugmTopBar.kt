package com.yugm.app.core.ui.components

import androidx.compose.foundation.layout.RowScope
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import com.yugm.app.core.ui.theme.LocalYugmColors
import com.yugm.app.core.ui.theme.YugmTheme

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun YugmTopBar(
    title: String,
    modifier: Modifier = Modifier,
    onBack: (() -> Unit)? = null,
    actions: @Composable RowScope.() -> Unit = {},
) {
    val colors = LocalYugmColors.current
    TopAppBar(
        title = {
            Text(
                text = title,
                color = colors.textPrimary,
                style = MaterialTheme.typography.titleMedium,
            )
        },
        navigationIcon = {
            onBack?.let { action ->
                IconButton(onClick = action) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Back",
                        tint = colors.textPrimary,
                    )
                }
            }
        },
        actions = actions,
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = colors.background,
        ),
        modifier = modifier,
    )
}

@Preview(name = "Light Mode - With Back")
@Composable
private fun YugmTopBarLightPreview() {
    YugmTheme(darkTheme = false) {
        YugmTopBar(
            title = "Settings",
            onBack = {},
        )
    }
}

@Preview(name = "Dark Mode - With Back")
@Composable
private fun YugmTopBarDarkPreview() {
    YugmTheme(darkTheme = true) {
        YugmTopBar(
            title = "Settings",
            onBack = {},
        )
    }
}
