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

private class CurvedDockShape(
    private val notchX: Float,
    private val topPaddingPx: Float,
    private val notchWidthPx: Float,
    private val notchDepthPx: Float,
    private val cornerRadiusPx: Float,
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
            val r = cornerRadiusPx

            val halfNotch = notchWidthPx / 2f
            val notchLeft = notchX - halfNotch
            val notchRight = notchX + halfNotch

            // Bottom-left start
            moveTo(0f, h)

            // Left vertical side
            lineTo(0f, topY + r)

            // Top-left corner arc
            quadraticTo(0f, topY, r, topY)

            // Flat top edge to notch left shoulder
            if (notchLeft > r) {
                lineTo(notchLeft, topY)
            } else {
                lineTo(r.coerceAtMost(notchX), topY)
            }

            // Smooth cubic Bézier forming concave cradle with shoulders
            cubicTo(
                notchLeft + notchWidthPx * 0.25f, topY,
                notchX - notchWidthPx * 0.25f, topY + notchDepthPx,
                notchX, topY + notchDepthPx
            )
            cubicTo(
                notchX + notchWidthPx * 0.25f, topY + notchDepthPx,
                notchRight - notchWidthPx * 0.25f, topY,
                notchRight, topY
            )

            // Flat top edge to top-right corner
            if (notchRight < w - r) {
                lineTo(w - r, topY)
            } else {
                lineTo((w - r).coerceAtLeast(notchX), topY)
            }

            // Top-right corner arc
            quadraticTo(w, topY, w, topY + r)

            // Right vertical side
            lineTo(w, h)

            // Bottom edge across to bottom-left
            lineTo(0f, h)

            close()
        }
        return Outline.Generic(path)
    }
}

private data class MainDockItem(
    val tab: YugmDockTab,
    val icon: ImageVector,
    val label: String,
    val compactLabel: String = label,
    val accessibilityLabel: String = label,
)

@Composable
fun YugmBottomDock(
    selected: YugmDockTab,
    modifier: Modifier = Modifier,
    onTabSelected: (YugmDockTab) -> Unit = {},
    onTabReselected: (YugmDockTab) -> Unit = {},
    chatUnreadCount: Int = 0,
) {
    val items = remember {
        listOf(
            MainDockItem(YugmDockTab.GAME_ZONE, Icons.Filled.SportsEsports, "Yugm Arcade", compactLabel = "Arcade", accessibilityLabel = "Yugm Arcade"),
            MainDockItem(YugmDockTab.LIVE, Icons.Filled.Mic, "Party"),
            MainDockItem(YugmDockTab.DISCOVER, Icons.Filled.Home, "Discover"),
            MainDockItem(YugmDockTab.CHAT, Icons.Filled.ChatBubble, "Chat"),
            MainDockItem(YugmDockTab.PROFILE, Icons.Filled.Person, "Profile"),
        )
    }

    val colors = LocalYugmColors.current
    val motionEnabled = LocalMotionEnabled.current
    val density = LocalDensity.current

    val targetIndex = items.indexOfFirst { it.tab == selected }.coerceAtLeast(0)
    val animatedIndex by animateFloatAsState(
        targetValue = targetIndex.toFloat(),
        animationSpec = if (motionEnabled) {
            spring(
                dampingRatio = 0.78f,
                stiffness = 350f
            )
        } else {
            snap()
        },
        label = "curvedDockAnimatedIndex"
    )

    val topPadding = 22.dp
    val barHeight = 60.dp
    val activeCircleSize = 48.dp
    val notchWidth = 72.dp
    val notchDepth = 32.dp
    val cornerRadius = 24.dp

    val bottomInset = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
    val totalDockHeight = topPadding + barHeight + bottomInset

    val dockColor = colors.surface
    val ringColor = if (colors.isDark) colors.surface else Color.White

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(totalDockHeight),
        contentAlignment = Alignment.BottomCenter
    ) {
        BoxWithConstraints(
            modifier = Modifier
                .fillMaxWidth()
                .height(totalDockHeight)
        ) {
            val totalWidthPx = constraints.maxWidth.toFloat()
            val tabWidthPx = totalWidthPx / items.size
            val notchXPx = (animatedIndex + 0.5f) * tabWidthPx

            val topPaddingPx = with(density) { topPadding.toPx() }
            val notchWidthPx = with(density) { notchWidth.toPx() }
            val notchDepthPx = with(density) { notchDepth.toPx() }
            val cornerRadiusPx = with(density) { cornerRadius.toPx() }
            val circleSizePx = with(density) { activeCircleSize.toPx() }
            val offset4Px = with(density) { 4.dp.toPx() }

            // Parabolic spring lift during transition
            val fractionalDist = kotlin.math.abs(animatedIndex - kotlin.math.round(animatedIndex.toDouble()).toFloat())
            val liftPx = if (motionEnabled) {
                with(density) { (kotlin.math.sin(fractionalDist * Math.PI.toFloat()) * 6.dp.toPx()) }
            } else {
                0f
            }

            val curvedShape = remember(notchXPx, topPaddingPx, notchWidthPx, notchDepthPx, cornerRadiusPx, constraints.maxHeight) {
                CurvedDockShape(
                    notchX = notchXPx,
                    topPaddingPx = topPaddingPx,
                    notchWidthPx = notchWidthPx,
                    notchDepthPx = notchDepthPx,
                    cornerRadiusPx = cornerRadiusPx
                )
            }

            // 1. Integrated Navigation Surface Background (flat, no bar shadow)
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .clip(curvedShape)
                    .background(dockColor)
            )

            // 2. Elevated Active 48dp Circular Button with Contrasting Ring & 4dp Clearance
            val circleX = (notchXPx - circleSizePx / 2f).roundToInt()
            val circleY = (topPaddingPx - circleSizePx / 2f + offset4Px - liftPx).roundToInt()

            Box(
                modifier = Modifier
                    .offset { IntOffset(circleX, circleY) }
                    .size(activeCircleSize)
                    .shadow(if (colors.isDark) 6.dp else 3.dp, CircleShape, clip = false)
                    .clip(CircleShape)
                    .background(colors.primary)
                    .border(2.dp, ringColor, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                items.forEachIndexed { i, item ->
                    val factor = (1f - kotlin.math.abs(animatedIndex - i)).coerceIn(0f, 1f)
                    if (factor > 0f) {
                        Icon(
                            imageVector = item.icon,
                            contentDescription = null,
                            tint = colors.primaryOn,
                            modifier = Modifier
                                .size(24.dp)
                                .graphicsLayer {
                                    alpha = factor
                                    scaleX = 0.75f + 0.25f * factor
                                    scaleY = 0.75f + 0.25f * factor
                                }
                        )
                    }
                }
            }

            // 3. Tab Destinations Row (24dp Icons, 11sp Labels, Badges & Clean Touch Targets)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(topPadding + barHeight)
                    .align(Alignment.TopCenter)
                    .selectableGroup(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Bottom
            ) {
                items.forEachIndexed { i, item ->
                    val isSelected = item.tab == selected
                    val factor = (1f - kotlin.math.abs(animatedIndex - i)).coerceIn(0f, 1f)
                    val badgeCount = if (item.tab == YugmDockTab.CHAT) chatUnreadCount.coerceAtLeast(0) else 0
                    val badgeText = when {
                        badgeCount <= 0 -> null
                        badgeCount > 99 -> "99+"
                        else -> badgeCount.toString()
                    }
                    val description = if (badgeCount > 0) {
                        "${item.accessibilityLabel}, $badgeCount unread messages"
                    } else {
                        item.accessibilityLabel
                    }
                    val itemInteractionSource = remember { MutableInteractionSource() }

                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxHeight()
                            .heightIn(min = 48.dp)
                            .selectable(
                                selected = isSelected,
                                interactionSource = itemInteractionSource,
                                indication = null,
                                role = Role.Tab,
                                onClick = {
                                    if (isSelected) onTabReselected(item.tab) else onTabSelected(item.tab)
                                }
                            )
                            .semantics(mergeDescendants = true) {
                                contentDescription = description
                                selectedSemantics = isSelected
                            },
                        contentAlignment = Alignment.BottomCenter
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 8.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Bottom
                        ) {
                            // Unselected 24dp icon slot
                            Box(
                                modifier = Modifier
                                    .height(28.dp)
                                    .fillMaxWidth(),
                                contentAlignment = Alignment.Center
                            ) {
                                if (factor < 0.99f) {
                                    Box(
                                        modifier = Modifier.graphicsLayer {
                                            alpha = 1f - factor
                                            scaleX = 0.85f + 0.15f * (1f - factor)
                                            scaleY = 0.85f + 0.15f * (1f - factor)
                                        }
                                    ) {
                                        Icon(
                                            imageVector = item.icon,
                                            contentDescription = null,
                                            modifier = Modifier.size(24.dp),
                                            tint = colors.textSecondary
                                        )
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(2.dp))

                            // Uniformly aligned destination label
                            val labelColor = lerp(colors.textSecondary, colors.primary, factor)
                            Text(
                                text = item.compactLabel,
                                color = labelColor,
                                fontSize = 11.sp,
                                fontWeight = if (factor > 0.5f) FontWeight.Bold else FontWeight.Medium,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.graphicsLayer {
                                    scaleX = 1f + 0.06f * factor
                                    scaleY = 1f + 0.06f * factor
                                }
                            )
                        }

                        // Unread Notification Badge
                        if (badgeText != null) {
                            val badgeYOffset = if (factor > 0.5f) 2.dp else 12.dp
                            Box(
                                modifier = Modifier
                                    .align(Alignment.TopCenter)
                                    .padding(start = 24.dp, top = badgeYOffset)
                                    .clip(CircleShape)
                                    .background(colors.secondary)
                                    .heightIn(min = 16.dp)
                                    .widthIn(min = 16.dp)
                                    .padding(horizontal = 4.dp, vertical = 1.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = badgeText,
                                    color = Color.White,
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Bold,
                                    maxLines = 1
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
