package com.yugm.app.core.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandHorizontally
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkHorizontally
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.TrendingDown
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CardGiftcard
import androidx.compose.material.icons.filled.ChatBubble
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckBox
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.MeetingRoom
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MonetizationOn
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.RadioButtonChecked
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.SportsEsports
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.spring
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.selected as selectedSemantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yugm.app.core.ui.cosmetics.RoomAmbienceBackdrop
import com.yugm.app.core.ui.theme.Background
import com.yugm.app.core.ui.theme.LocalMotionEnabled
import com.yugm.app.core.ui.theme.LocalYugmColors
import com.yugm.app.core.ui.theme.BorderColor
import com.yugm.app.core.ui.theme.Danger
import com.yugm.app.core.ui.theme.Gold
import com.yugm.app.core.ui.theme.Pink
import com.yugm.app.core.ui.theme.PrimaryPurple
import com.yugm.app.core.ui.theme.SurfaceElevated
import com.yugm.app.core.ui.theme.TextMuted
import com.yugm.app.core.ui.theme.TextPrimary
import kotlin.math.roundToInt

enum class YugmDockTab { GAME_ZONE, LIVE, DISCOVER, CHAT, PROFILE }

/** Main bottom dock sizing for consistent reserved content space in tab screens. */
object YugmBottomDockDefaults {
    val CapsuleHeight = 60.dp
    val HorizontalMargin = 16.dp
    val BottomMargin = 10.dp
    /** Space needed above the system navigation bar so scrollable content clears the floating dock. */
    val ReservedContentPaddingAboveNavBar = CapsuleHeight + BottomMargin + 8.dp
}

@Composable
fun YugmAmbientBackground(
    themeOverride: List<Color>? = null,
    ambienceId: String = "",
    content: @Composable () -> Unit
) {
    val bg = themeOverride?.getOrNull(0) ?: Background
    Box(Modifier.fillMaxSize().background(bg)) {
        if (themeOverride == null) {
            Canvas(Modifier.fillMaxSize()) {
                drawCircle(
                    brush = Brush.radialGradient(
                        listOf(PrimaryPurple.copy(alpha = 0.14f), Color.Transparent),
                        center = Offset(size.width * 0.92f, size.height * 0.18f),
                        radius = size.width * 0.75f
                    ),
                    center = Offset(size.width * 0.92f, size.height * 0.18f),
                    radius = size.width * 0.75f
                )
                drawCircle(
                    brush = Brush.radialGradient(
                        listOf(Pink.copy(alpha = 0.08f), Color.Transparent),
                        center = Offset(size.width * 0.04f, size.height * 0.74f),
                        radius = size.width * 0.58f
                    ),
                    center = Offset(size.width * 0.04f, size.height * 0.74f),
                    radius = size.width * 0.58f
                )
            }
        }
        if (ambienceId.isNotBlank()) {
            RoomAmbienceBackdrop(
                id = ambienceId,
                modifier = Modifier.fillMaxSize(),
                animate = LocalMotionEnabled.current
            )
        }
        content()
    }
}

@Composable
fun YugmPageHeader(
    title: String,
    subtitle: String = "",
    onBack: (() -> Unit)? = null,
    trailing: @Composable (() -> Unit)? = null
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        if (onBack != null) {
            YugmBackButton(onClick = onBack)
        } else {
            BrandHeader(compact = true)
        }
        Column(Modifier.weight(1f)) {
            Text(title, color = TextPrimary, fontSize = 25.sp, fontWeight = FontWeight.Black, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (subtitle.isNotBlank()) Text(subtitle, color = TextMuted, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        trailing?.invoke()
    }
}

@Composable
fun YugmBackButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    accessibilityLabel: String = "Back"
) {
    RoundAction(
        glyph = "",
        modifier = modifier,
        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
        accessibilityLabel = accessibilityLabel,
        onClick = onClick
    )
}

private fun resolveGlyphVector(glyph: String): ImageVector? {
    return when (glyph.trim()) {
        "⚙", "⚙️" -> Icons.Filled.Settings
        "+", "＋" -> Icons.Filled.Add
        "✓", "✔" -> Icons.Filled.Check
        "←" -> Icons.AutoMirrored.Filled.ArrowBack
        "♢", "✦" -> Icons.Filled.CardGiftcard
        "●●" -> Icons.Filled.GridView
        "☷" -> Icons.Filled.FilterList
        "◉" -> Icons.Filled.MonetizationOn
        "↗", "↗️" -> Icons.AutoMirrored.Filled.TrendingUp
        "↙", "↙️" -> Icons.AutoMirrored.Filled.TrendingDown
        "♛", "👑" -> Icons.Filled.EmojiEvents
        "⚡" -> Icons.Filled.Mic
        "◈" -> Icons.Filled.MeetingRoom
        "✉" -> Icons.Filled.Email
        "⌖" -> Icons.Filled.LocationOn
        "◇" -> Icons.Filled.Favorite
        "◎" -> Icons.Filled.RadioButtonChecked
        "▣" -> Icons.Filled.CheckBox
        "♪" -> Icons.Filled.MusicNote
        "◆" -> Icons.Filled.SportsEsports
        "♡", "♥" -> Icons.Filled.Favorite
        else -> null
    }
}

@Composable
fun RoundAction(
    glyph: String,
    modifier: Modifier = Modifier,
    danger: Boolean = false,
    selected: Boolean = false,
    badge: String? = null,
    imageVector: ImageVector? = null,
    accessibilityLabel: String? = null,
    onClick: () -> Unit
) {
    val resolvedVector = imageVector ?: resolveGlyphVector(glyph)
    Box(modifier) {
        Box(
            modifier = Modifier
                .size(48.dp)
                .clip(CircleShape)
                .background(
                    when {
                        danger -> Danger
                        selected -> PrimaryPurple
                        else -> SurfaceElevated
                    }
                )
                .border(1.dp, if (danger) Danger else BorderColor, CircleShape)
                .semantics {
                    if (accessibilityLabel != null) contentDescription = accessibilityLabel
                }
                .clickable(role = Role.Button, onClickLabel = accessibilityLabel, onClick = onClick),
            contentAlignment = Alignment.Center
        ) {
            if (resolvedVector != null) {
                Icon(resolvedVector, contentDescription = null, modifier = Modifier.size(22.dp), tint = Color.White)
            } else if (glyph.isNotBlank()) {
                Text(glyph, color = Color.White, fontSize = 21.sp, fontWeight = FontWeight.Bold)
            }
        }
        if (!badge.isNullOrBlank()) {
            Box(
                Modifier
                    .align(Alignment.TopEnd)
                    .clip(CircleShape)
                    .background(Pink)
                    .padding(horizontal = 5.dp, vertical = 2.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(badge, color = Color.White, fontSize = 8.sp, fontWeight = FontWeight.Black)
            }
        }
    }
}

@Composable
fun GradientAction(
    label: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    leading: String = "",
    onClick: () -> Unit
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent, disabledContainerColor = Color.Transparent),
        contentPadding = PaddingValues(),
        modifier = modifier
            .height(52.dp)
            .clip(RoundedCornerShape(17.dp))
            .background(
                if (enabled) Brush.horizontalGradient(listOf(PrimaryPurple, Pink, Color(0xFFFF5F64)))
                else Brush.horizontalGradient(listOf(Color.DarkGray, Color.Gray))
            )
    ) {
        Text(
            text = if (leading.isBlank()) label else "$leading  $label",
            color = Color.White,
            fontSize = 15.sp,
            fontWeight = FontWeight.Black
        )
    }
}

@Composable
fun ReferenceChip(
    text: String,
    selected: Boolean = false,
    glyph: String = "",
    onClick: (() -> Unit)? = null
) {
    val shape = RoundedCornerShape(13.dp)
    val resolvedVector = resolveGlyphVector(glyph)
    Row(
        modifier = Modifier
            .heightIn(min = 48.dp)
            .clip(shape)
            .background(if (selected) PrimaryPurple.copy(alpha = 0.26f) else SurfaceElevated)
            .border(1.dp, if (selected) Pink else BorderColor, shape)
            .then(if (onClick != null) Modifier.clickable(role = Role.Button, onClickLabel = text, onClick = onClick) else Modifier)
            .semantics { if (onClick != null) contentDescription = if (selected) "$text, selected" else text }
            .padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        if (resolvedVector != null) {
            Icon(resolvedVector, contentDescription = null, modifier = Modifier.size(16.dp), tint = if (selected) Pink else TextMuted)
        } else if (glyph.isNotBlank()) {
            Text(glyph, color = if (selected) Pink else TextMuted, fontSize = 14.sp)
        }
        Text(text, color = TextPrimary, fontSize = 12.sp, fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium)
    }
}

@Composable
fun ReferenceSectionHeader(title: String, action: String = "", onAction: () -> Unit = {}) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(title, color = TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Black, modifier = Modifier.weight(1f))
        if (action.isNotBlank()) {
            Text(action, color = Pink, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier
                .heightIn(min = 48.dp)
                .clickable(role = Role.Button, onClickLabel = action, onClick = onAction))
        }
    }
}

@Composable
fun SegmentedTabs(
    items: List<Pair<String, String>>,
    selectedIndex: Int,
    onSelected: (Int) -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .height(58.dp)
            .clip(RoundedCornerShape(18.dp))
            .background(SurfaceElevated)
            .border(1.dp, BorderColor, RoundedCornerShape(18.dp))
            .padding(5.dp),
        horizontalArrangement = Arrangement.spacedBy(5.dp)
    ) {
        items.forEachIndexed { index, item ->
            val selected = index == selectedIndex
            val resolvedVector = resolveGlyphVector(item.first)
            Row(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxSize()
                    .clip(RoundedCornerShape(14.dp))
                    .background(
                        if (selected) Brush.horizontalGradient(listOf(PrimaryPurple, Pink))
                        else Brush.horizontalGradient(listOf(Color.Transparent, Color.Transparent))
                    )
                    .selectable(
                        selected = selected,
                        role = Role.Tab,
                        onClick = { onSelected(index) }
                    ),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                if (resolvedVector != null) {
                    Icon(resolvedVector, contentDescription = null, modifier = Modifier.size(18.dp), tint = if (selected) Color.White else TextMuted)
                    Spacer(Modifier.width(6.dp))
                } else if (item.first.isNotBlank()) {
                    Text(item.first, color = if (selected) Color.White else TextMuted, fontSize = 15.sp)
                    Spacer(Modifier.width(6.dp))
                }
                Text(item.second, color = if (selected) Color.White else TextMuted, fontSize = 13.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

internal class CurvedDockShape(
    private val notchX: Float,
    private val topPaddingPx: Float,
    private val notchWidthPx: Float,
    private val notchDepthPx: Float,
) : Shape {
    override fun createOutline(
        size: Size,
        layoutDirection: LayoutDirection,
        density: Density
    ): Outline {
        val path = Path().apply {
            val w = size.width
            val h = size.height
            val topY = topPaddingPx

            val halfNotch = notchWidthPx / 2f

            // Symmetrical shoulder widths: both shoulders have equal width from notch
            // center to the shoulder point. Adapt proportionally near screen edges.
            val maxShoulder = (notchX).coerceAtMost(w - notchX)
            val shoulderWidth = (halfNotch * 1.2f).coerceAtMost(maxShoulder)
            val leftShoulder = (notchX - shoulderWidth).coerceAtLeast(0f)
            val rightShoulder = (notchX + shoulderWidth).coerceAtMost(w)

            // Square full-width surface: straight left edge up to top boundary.
            moveTo(0f, h)
            lineTo(0f, topY)

            // Flat top edge to left shoulder.
            if (leftShoulder > 0f) lineTo(leftShoulder, topY)

            // Mirrored cubic Béziers: left and right use identical control-point
            // proportions, guaranteeing continuous tangents and symmetry.
            cubicTo(
                leftShoulder + (notchX - leftShoulder) * 0.5f, topY,
                notchX - halfNotch * 0.5f, topY + notchDepthPx,
                notchX, topY + notchDepthPx
            )
            cubicTo(
                notchX + halfNotch * 0.5f, topY + notchDepthPx,
                rightShoulder - (rightShoulder - notchX) * 0.5f, topY,
                rightShoulder, topY
            )

            // Flat top edge to right edge.
            lineTo(w, topY)
            lineTo(w, h)
            lineTo(0f, h)
            close()
        }
        return Outline.Generic(path)
    }
}

