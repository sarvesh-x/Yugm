package com.yugm.app.core.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.yugm.app.core.ui.theme.LocalYugmColors

/**
 * Standardized surface card component for Yugm design system.
 * Uses theme-aware surface colors, subtle borders, and controlled elevation.
 */
@Composable
fun YugmSurface(
    modifier: Modifier = Modifier,
    shape: Shape = RoundedCornerShape(20.dp),
    containerColor: Color = LocalYugmColors.current.surface,
    borderColor: Color = LocalYugmColors.current.border,
    borderWidth: Dp = 1.dp,
    padding: Dp = 16.dp,
    content: @Composable ColumnScope.() -> Unit
) {
    Card(
        shape = shape,
        colors = CardDefaults.cardColors(containerColor = containerColor),
        border = BorderStroke(borderWidth, borderColor),
        modifier = modifier
    ) {
        Column(
            modifier = Modifier.padding(padding),
            content = content
        )
    }
}
