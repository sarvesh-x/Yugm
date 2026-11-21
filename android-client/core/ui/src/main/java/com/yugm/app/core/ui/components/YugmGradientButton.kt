package com.yugm.app.core.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yugm.app.core.ui.theme.BrandGradients
import com.yugm.app.core.ui.theme.OnBrand

/**
 * Reusable Yugm Primary Action Button featuring the official brand gradient.
 * Enforces `OnBrand = Color.White` foreground text/icon color in BOTH light and dark themes.
 */
@Composable
fun YugmGradientButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    height: Dp = 54.dp,
    cornerRadius: Dp = 16.dp,
) {
    val interactionSource = remember { MutableInteractionSource() }
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(height)
            .clip(RoundedCornerShape(cornerRadius))
            .alpha(if (enabled) 1f else 0.42f)
            .background(BrandGradients.horizontal)
            .semantics { contentDescription = text }
            .clickable(
                enabled = enabled,
                interactionSource = interactionSource,
                role = Role.Button,
                onClickLabel = text,
                onClick = onClick
            ),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text,
            color = OnBrand,
            fontWeight = FontWeight.Bold,
            fontSize = 16.sp
        )
    }
}
