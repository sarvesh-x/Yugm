package com.yugm.app.core.ui.components

import android.view.HapticFeedbackConstants
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.Explore
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.SportsEsports
import androidx.compose.material.icons.outlined.Chat
import androidx.compose.material.icons.outlined.Explore
import androidx.compose.material.icons.outlined.Mic
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.SportsEsports
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.asAndroidPath
import androidx.compose.ui.graphics.ClipOp
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.selected as selectedSemantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.Density
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.yugm.app.core.api.resolveMediaUrl
import com.yugm.app.core.model.AvatarPartsPayload
import com.yugm.app.core.ui.avatar.AvatarDescriptor
import com.yugm.app.core.ui.avatar.AvatarParts
import com.yugm.app.core.ui.avatar.GeneratedAvatar
import com.yugm.app.core.ui.theme.*
import kotlin.math.roundToInt

// ===========================================================================
// SINGLE COORDINATE SYSTEM
// ===========================================================================
// The dock is laid out in a single Box of height = topPadding + barHeight + bottomInset.
//
//   y=0 ──────────────────────────────────────────────  (dock top)
//   y=topPadding ──────────────────────────────────────  (surface top / circle center)
//   y=topPadding+barHeight ────────────────────────────  (bar bottom)
//   y=totalDockHeight ─────────────────────────────────  (physical bottom)
//
// Regions:
//   [0, topPadding)          : cradle zone — active circle center sits at y=topPadding
//   [topPadding, topPadding+barHeight): bar content area (icons + labels)
//   [topPadding+barHeight, totalDockHeight): system nav inset (filled by surface color)
//
// The concave notch (cradle) is cut into the surface from y=topPadding down to
// y=topPadding+notchDepth, centered at the active tab's X position.
//
// Responsibilities are separated into distinct composable layers:
//   1. DockBackground  — Canvas drawing the curved surface path
//   2. ActiveIndicator — elevated circle with gradient + icon
//   3. TabRow          — icons + labels + badges per tab
//   4. TouchTargets    — selectable modifiers on each tab Box
//   5. InsetHandling   — bottomInset in totalDockHeight
// ===========================================================================

// Painted surface height (bar only) — bottomInset is added at runtime by MainTabsScreen.
// The transparent cradle zone (topPadding) is NOT included; content extends behind it.
val YugmBottomDockBarHeight = 55.dp

// Active circle protrudes this much above the painted surface top.
val YugmBottomDockActiveIconProtrusion = 25.dp

// Extra breathing room so the last item clears the dock comfortably.
val YugmBottomDockBreathingSpace = 12.dp

/**
 * Bottom content clearance for scrollable containers in main tabs where the dock is visible.
 * Ensures the last interactive item can scroll fully above the highest point of the dock.
 *
 * Clearance = painted bar height + active icon protrusion + system nav inset + breathing space.
 * Use as LazyColumn/LazyGrid contentPadding bottom, or as trailing padding in verticalScroll.
 */
@Composable
fun mainDockBottomClearance(): androidx.compose.ui.unit.Dp {
    val navBarInset = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
    return YugmBottomDockBarHeight + YugmBottomDockActiveIconProtrusion + navBarInset + YugmBottomDockBreathingSpace
}

/**
 * CompositionLocal providing the dock bottom clearance for main tabs. 0.dp when dock is not shown.
 * Prefer [mainDockBottomClearance] or read this local in tab screens to keep padding consistent.
 */
val LocalMainDockBottomClearance = androidx.compose.runtime.compositionLocalOf { 0.dp }

private data class MainDockItem(
    val tab: YugmDockTab,
    val icon: ImageVector,
    val activeIcon: ImageVector = icon,
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
    userAvatar: String? = null,
    userAvatarType: String? = null,
    userAvatarParts: AvatarPartsPayload? = null,
) {
    val items = remember {
        listOf(
            MainDockItem(YugmDockTab.GAME_ZONE, Icons.Outlined.SportsEsports, Icons.Filled.SportsEsports, "Yugm Arcade", compactLabel = "Arcade", accessibilityLabel = "Yugm Arcade"),
            MainDockItem(YugmDockTab.LIVE, Icons.Outlined.Mic, Icons.Filled.Mic, "Party"),
            MainDockItem(YugmDockTab.DISCOVER, Icons.Outlined.Explore, Icons.Filled.Explore, "Discover"),
            MainDockItem(YugmDockTab.CHAT, Icons.Outlined.Chat, Icons.Outlined.Chat, "Chat"),
            MainDockItem(YugmDockTab.PROFILE, Icons.Outlined.Person, Icons.Filled.Person, "Profile"),
        )
    }

    val colors = LocalYugmColors.current
    val motionEnabled = LocalMotionEnabled.current
    val density = LocalDensity.current

    val targetIndex = items.indexOfFirst { it.tab == selected }.coerceAtLeast(0)
    var previousIndex by remember { androidx.compose.runtime.mutableIntStateOf(targetIndex) }
    val direction = when {
        targetIndex > previousIndex -> 1f
        targetIndex < previousIndex -> -1f
        else -> 0f
    }

    // Position: notch/circle slide — responsive spring.
    val animatedIndex by animateFloatAsState(
        targetValue = targetIndex.toFloat(),
        animationSpec = if (motionEnabled) spring(dampingRatio = 0.84f, stiffness = 320f) else snap(),
        label = "curvedDockPositionIndex"
    )

    // Content: icon/label crossfade — slightly softer so it settles after the circle arrives.
    val contentIndex by animateFloatAsState(
        targetValue = targetIndex.toFloat(),
        animationSpec = if (motionEnabled) spring(dampingRatio = 0.88f, stiffness = 260f) else snap(),
        label = "curvedDockContentIndex"
    )

    // Subtle settle scale on the active circle when selection lands.
    val settleScale = remember { Animatable(1f) }
    LaunchedEffect(targetIndex, motionEnabled) {
        if (previousIndex != targetIndex) {
            previousIndex = targetIndex
        }
        if (!motionEnabled) {
            settleScale.snapTo(1f)
        } else {
            settleScale.snapTo(0.96f)
            settleScale.animateTo(
                1f,
                animationSpec = spring(dampingRatio = 0.55f, stiffness = 500f)
            )
        }
    }

    // === Dimensions (single source of truth) ===
    // All notch geometry is derived from the active indicator to keep circle and cradle in sync.
    val activeCircleSize = 50.dp
    val activeBorderWidth = 2.dp
    val notchClearance = 3.5.dp
    val cradleRadius = activeCircleSize / 2 + notchClearance // 28.5dp — includes clearance around indicator
    val shoulderWidth = 22.dp

    val topPadding = activeCircleSize / 2 + 3.dp   // 28dp: circle center on surface top
    val labelFontSize = 12.sp
    val labelLineHeight = 14.sp

    // Label positioned beneath the cradle's deepest point.
    val labelTop = topPadding + cradleRadius + 4.dp

    // Bar height from label position + measured text height + bottom clearance.
    val labelSlotHeight = labelLineHeight.value.toInt().dp
    val bottomClearance = 8.dp
    val barHeight = (labelTop - topPadding) + labelSlotHeight + bottomClearance

    val activeIconSize = 32.dp
    val inactiveIconSize = 30.dp
    val touchTargetMin = 48.dp

    // Reactive inset handling: use Compose WindowInsets directly (no cached view lookup).
    val bottomInset = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
    val totalDockHeight = topPadding + barHeight + bottomInset

    val dockColor = colors.bottomDockSurface
    val ringColor = colors.bottomDockSurface
    val shadowElevation = if (colors.isDark) 5.dp else 7.dp
    val view = LocalView.current

    val brandGradient = remember {
        Brush.linearGradient(
            colors = listOf(
                com.yugm.app.core.ui.theme.OnboardingBrandStart,
                com.yugm.app.core.ui.theme.OnboardingBrandMiddle,
                com.yugm.app.core.ui.theme.OnboardingBrandEnd
            )
        )
    }

    // === Layout ===
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
            val notchXPx = BottomDockGeometry.animatedNotchCenterPx(animatedIndex, totalWidthPx, items.size)

            val topPaddingPx = with(density) { topPadding.toPx() }
            val cradleRadiusPx = with(density) { cradleRadius.toPx() }
            val shoulderWidthPx = with(density) { shoulderWidth.toPx() }
            val circleSizePx = with(density) { activeCircleSize.toPx() }

            // No additional vertical spring lift: circle stays on the surface top boundary.
            val liftPx = 0f

            val curvedShape = remember(notchXPx, topPaddingPx, cradleRadiusPx, shoulderWidthPx, constraints.maxWidth, constraints.maxHeight) {
                CurvedDockShape(
                    centerX = notchXPx,
                    topY = topPaddingPx,
                    cradleRadiusPx = cradleRadiusPx,
                    shoulderWidthPx = shoulderWidthPx
                )
            }

            // 1. Background surface — drawn via Canvas (no Shape clipping).
            DockBackground(
                curvedShape = curvedShape,
                dockColor = dockColor,
                shadowColor = colors.bottomDockShadow,
                shadowElevationPx = with(density) { shadowElevation.toPx() },
                outlineColor = colors.bottomDockOutline,
                modifier = Modifier.fillMaxSize()
            )

            // 2. Elevated active circular indicator.
            ActiveIndicator(
                notchXPx = notchXPx,
                topPaddingPx = topPaddingPx,
                circleSizePx = circleSizePx,
                liftPx = liftPx,
                brandGradient = brandGradient,
                ringColor = ringColor,
                activeIconSize = activeIconSize,
                items = items,
                contentIndex = contentIndex,
                colors = colors,
                motionEnabled = motionEnabled,
                userAvatar = userAvatar,
                userAvatarType = userAvatarType,
                userAvatarParts = userAvatarParts,
                selectedTab = selected,
                onTabReselected = onTabReselected,
                settleScale = settleScale.value,
                direction = direction
            )

            // 3 & 4. Tab row with icons, labels, badges, and touch targets.
            TabRow(
                items = items,
                selected = selected,
                contentIndex = contentIndex,
                topPadding = topPadding,
                barHeight = barHeight,
                inactiveIconSize = inactiveIconSize,
                activeIconSize = activeIconSize,
                labelSlotHeight = labelSlotHeight,
                labelFontSize = labelFontSize,
                labelTop = labelTop,
                touchTargetMin = touchTargetMin,
                chatUnreadCount = chatUnreadCount,
                colors = colors,
                motionEnabled = motionEnabled,
                density = density,
                view = view,
                onTabSelected = onTabSelected,
                onTabReselected = onTabReselected,
                userAvatar = userAvatar,
                userAvatarType = userAvatarType,
                userAvatarParts = userAvatarParts,
                direction = direction
            )
        }
    }
}

// ===========================================================================
// Separated composable layers
// ===========================================================================

@Composable
private fun DockBackground(
    curvedShape: CurvedDockShape,
    dockColor: Color,
    shadowColor: Color,
    shadowElevationPx: Float,
    outlineColor: Color,
    modifier: Modifier = Modifier
) {
    Canvas(modifier = modifier) {
        val outline = curvedShape.createOutline(size, layoutDirection, this)
        if (outline is Outline.Generic) {
            val path = outline.path
            // Shape-aware soft shadow: follows the dock curve but not the transparent notch opening.
            val notchOpening = curvedShape.createNotchOpeningPath(size)
            clipPath(notchOpening, clipOp = ClipOp.Difference) {
                drawIntoCanvas { canvas ->
                    val frameworkPaint = androidx.compose.ui.graphics.Paint().asFrameworkPaint().apply {
                        isAntiAlias = true
                        color = android.graphics.Color.TRANSPARENT
                        setShadowLayer(shadowElevationPx, 0f, 0f, shadowColor.toArgb())
                    }
                    canvas.nativeCanvas.drawPath(path.asAndroidPath(), frameworkPaint)
                }
            }
            drawPath(path, color = dockColor)
            drawPath(path, color = outlineColor, style = Stroke(width = 1.dp.toPx()))
        }
    }
}

private fun Color.toArgb(): Int = android.graphics.Color.argb(
    (alpha * 255f).roundToInt(),
    (red * 255f).roundToInt(),
    (green * 255f).roundToInt(),
    (blue * 255f).roundToInt()
)

@Composable
private fun ActiveIndicator(
    notchXPx: Float,
    topPaddingPx: Float,
    circleSizePx: Float,
    liftPx: Float,
    brandGradient: Brush,
    ringColor: Color,
    activeIconSize: androidx.compose.ui.unit.Dp,
    items: List<MainDockItem>,
    contentIndex: Float,
    colors: YugmColors,
    motionEnabled: Boolean,
    userAvatar: String? = null,
    userAvatarType: String? = null,
    userAvatarParts: AvatarPartsPayload? = null,
    selectedTab: YugmDockTab = YugmDockTab.DISCOVER,
    onTabReselected: (YugmDockTab) -> Unit = {},
    settleScale: Float = 1f,
    direction: Float = 0f,
) {
    val circleX = (notchXPx - circleSizePx / 2f).roundToInt()
    val circleY = (topPaddingPx - circleSizePx / 2f - liftPx).roundToInt()

    Box(
        modifier = Modifier
            .offset { IntOffset(circleX, circleY) }
            .size(with(LocalDensity.current) { circleSizePx.toDp() })
            .graphicsLayer {
                scaleX = settleScale
                scaleY = settleScale
            }
            .shadow(if (colors.isDark) 3.dp else 1.5.dp, CircleShape, clip = false)
            .clip(CircleShape)
            .background(brandGradient)
            .border(2.dp, ringColor, CircleShape)
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null
            ) { onTabReselected(selectedTab) },
        contentAlignment = Alignment.Center
    ) {
        items.forEachIndexed { i, item ->
            val factor = (1f - kotlin.math.abs(contentIndex - i)).coerceIn(0f, 1f)
            if (factor > 0f) {
                val isProfileWithAvatar = item.tab == YugmDockTab.PROFILE && (
                    (userAvatarType == "GENERATED" && userAvatarParts != null) ||
                    !userAvatar.isNullOrBlank()
                )
                val iconShiftPx = with(LocalDensity.current) { 6.dp.toPx() }
                if (isProfileWithAvatar) {
                    DockAvatar(
                        avatar = userAvatar,
                        avatarType = userAvatarType,
                        avatarParts = userAvatarParts,
                        size = with(LocalDensity.current) { circleSizePx.toDp() },
                        modifier = Modifier
                            .fillMaxSize()
                            .graphicsLayer {
                                alpha = factor
                                val s = 0.84f + 0.16f * factor
                                scaleX = s
                                scaleY = s
                                translationX = direction * (1f - factor) * iconShiftPx
                            }
                    )
                } else {
                    Icon(
                        imageVector = item.activeIcon,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier
                            .size(activeIconSize)
                            .graphicsLayer {
                                alpha = factor
                                val s = 0.84f + 0.16f * factor
                                scaleX = s
                                scaleY = s
                                translationX = direction * (1f - factor) * iconShiftPx
                            }
                    )
                }
            }
        }
    }
}

@Composable
private fun DockAvatar(
    avatar: String?,
    avatarType: String?,
    avatarParts: AvatarPartsPayload?,
    size: androidx.compose.ui.unit.Dp,
    modifier: Modifier = Modifier,
    borderColor: Color = Color.Transparent,
    borderWidth: androidx.compose.ui.unit.Dp = 0.dp,
) {
    val resolvedUrl = remember(avatar) { resolveMediaUrl(avatar) }
    val shape = CircleShape
    Box(
        modifier = modifier
            .size(size)
            .clip(shape)
            .then(if (borderWidth > 0.dp) Modifier.border(borderWidth, borderColor, shape) else Modifier),
        contentAlignment = Alignment.Center
    ) {
        if (avatarType == "GENERATED" && avatarParts != null) {
            GeneratedAvatar(
                descriptor = AvatarDescriptor(
                    parts = AvatarParts(
                        background = avatarParts.background,
                        clothes = avatarParts.clothes,
                        head = avatarParts.head,
                        mouth = avatarParts.mouth,
                        eyes = avatarParts.eyes,
                        top = avatarParts.top
                    )
                ),
                size = size,
                shape = shape,
                contentDescription = null,
                modifier = Modifier.fillMaxSize()
            )
        } else if (!resolvedUrl.isNullOrBlank()) {
            val context = LocalContext.current
            AsyncImage(
                model = ImageRequest.Builder(context)
                    .data(resolvedUrl)
                    .crossfade(true)
                    .build(),
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop
            )
        }
    }
}

@Composable
private fun TabRow(
    items: List<MainDockItem>,
    selected: YugmDockTab,
    contentIndex: Float,
    topPadding: androidx.compose.ui.unit.Dp,
    barHeight: androidx.compose.ui.unit.Dp,
    inactiveIconSize: androidx.compose.ui.unit.Dp,
    activeIconSize: androidx.compose.ui.unit.Dp,
    labelSlotHeight: androidx.compose.ui.unit.Dp,
    labelFontSize: androidx.compose.ui.unit.TextUnit,
    labelTop: androidx.compose.ui.unit.Dp,
    touchTargetMin: androidx.compose.ui.unit.Dp,
    chatUnreadCount: Int,
    colors: YugmColors,
    motionEnabled: Boolean,
    density: Density,
    view: android.view.View,
    onTabSelected: (YugmDockTab) -> Unit,
    onTabReselected: (YugmDockTab) -> Unit,
    userAvatar: String? = null,
    userAvatarType: String? = null,
    userAvatarParts: AvatarPartsPayload? = null,
    direction: Float = 0f,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(topPadding + barHeight)
            .selectableGroup(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.Top
    ) {
        items.forEachIndexed { i, item ->
            val isSelected = item.tab == selected
            val factor = (1f - kotlin.math.abs(contentIndex - i)).coerceIn(0f, 1f)
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
            val pressed by itemInteractionSource.collectIsPressedAsState()
            val touchAlpha by animateFloatAsState(
                targetValue = if (pressed) 0.12f else 0f,
                animationSpec = if (motionEnabled) tween(durationMillis = 90) else snap(),
                label = "dockTabTouch"
            )

            // Touch target — bar area only; cradle zone above stays transparent to scroll/touch-through.
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight(),
                contentAlignment = Alignment.TopCenter
            ) {
                Box(
                    modifier = Modifier
                        .padding(top = topPadding)
                        .fillMaxWidth()
                        .height(barHeight)
                        .heightIn(min = touchTargetMin)
                        .selectable(
                            selected = isSelected,
                            interactionSource = itemInteractionSource,
                            indication = null,
                            role = Role.Tab,
                            onClick = {
                                view.performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK)
                                if (isSelected) onTabReselected(item.tab) else onTabSelected(item.tab)
                            }
                        )
                        .semantics(mergeDescendants = true) {
                            contentDescription = description
                            selectedSemantics = isSelected
                        }
                )

                // Inactive icon — vertically centered in the bar content area.
                // Bar content area is [topPadding .. topPadding + barHeight) within the Row.
                // The Row starts at dock top (0), so bar content starts at topPadding.
                val iconTopInRow = topPadding + (barHeight - inactiveIconSize) / 2
                Box(
                    modifier = Modifier
                        .padding(top = iconTopInRow)
                        .size(inactiveIconSize),
                    contentAlignment = Alignment.Center
                ) {
                    if (touchAlpha > 0f) {
                        Box(
                            modifier = Modifier
                                .size(48.dp)
                                .clip(CircleShape)
                                .background(colors.textPrimary.copy(alpha = touchAlpha))
                        )
                    }
                    if (factor < 0.995f) {
                        val isProfileWithAvatar = item.tab == YugmDockTab.PROFILE && (
                            (userAvatarType == "GENERATED" && userAvatarParts != null) ||
                            !userAvatar.isNullOrBlank()
                        )
                        if (isProfileWithAvatar) {
                            DockAvatar(
                                avatar = userAvatar,
                                avatarType = userAvatarType,
                                avatarParts = userAvatarParts,
                                size = inactiveIconSize,
                                modifier = Modifier
                                    .graphicsLayer {
                                        alpha = 1f - factor
                                        scaleX = 0.92f + 0.08f * (1f - factor)
                                        scaleY = 0.92f + 0.08f * (1f - factor)
                                        translationX = -direction * factor * with(density) { 4.dp.toPx() }
                                    }
                            )
                        } else {
                            Icon(
                                imageVector = item.icon,
                                contentDescription = null,
                                modifier = Modifier
                                    .size(inactiveIconSize)
                                    .graphicsLayer {
                                        alpha = 1f - factor
                                        scaleX = 0.92f + 0.08f * (1f - factor)
                                        scaleY = 0.92f + 0.08f * (1f - factor)
                                        translationX = -direction * factor * with(density) { 4.dp.toPx() }
                                    },
                                tint = colors.bottomDockInactiveContent
                            )
                        }
                    }
                }

                // Selected label — directly below the icon slot.
                if (factor > 0.01f) {
                    Text(
                        text = item.compactLabel,
                        color = colors.primary,
                        fontSize = labelFontSize,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        softWrap = false,
                        overflow = TextOverflow.Visible,
                        textAlign = TextAlign.Center,
                        modifier = Modifier
                            .padding(top = labelTop)
                            .graphicsLayer {
                                alpha = factor
                                translationY = (1f - factor) * with(density) { 4.dp.toPx() }
                                translationX = direction * (1f - factor) * with(density) { 6.dp.toPx() }
                            }
                    )
                }

                // Unread notification badge.
                if (badgeText != null) {
                    val badgeTop = if (factor > 0.5f) {
                        topPadding - 4.dp
                    } else {
                        iconTopInRow - 4.dp
                    }
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopCenter)
                            .padding(start = 22.dp, top = badgeTop)
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

// ===========================================================================
// Previews
// ===========================================================================

@Preview(name = "Dock - Light - Discover selected", showBackground = true, backgroundColor = 0xFFF5F5F5)
@Composable
private fun PreviewDockLightDiscover() {
    YugmTheme(darkTheme = false) {
        YugmBottomDock(selected = YugmDockTab.DISCOVER)
    }
}

@Preview(name = "Dock - Dark - Chat selected", showBackground = true, backgroundColor = 0xFF1A1A2E)
@Composable
private fun PreviewDockDarkChat() {
    YugmTheme(darkTheme = true) {
        YugmBottomDock(selected = YugmDockTab.CHAT, chatUnreadCount = 5)
    }
}

@Preview(name = "Dock - Light - Arcade selected", showBackground = true, backgroundColor = 0xFFF5F5F5)
@Composable
private fun PreviewDockLightArcade() {
    YugmTheme(darkTheme = false) {
        YugmBottomDock(selected = YugmDockTab.GAME_ZONE)
    }
}

@Preview(name = "Dock - Dark - Party selected", showBackground = true, backgroundColor = 0xFF1A1A2E)
@Composable
private fun PreviewDockDarkParty() {
    YugmTheme(darkTheme = true) {
        YugmBottomDock(selected = YugmDockTab.LIVE)
    }
}

@Preview(name = "Dock - Light - Profile selected", showBackground = true, backgroundColor = 0xFFF5F5F5)
@Composable
private fun PreviewDockLightProfile() {
    YugmTheme(darkTheme = false) {
        YugmBottomDock(selected = YugmDockTab.PROFILE)
    }
}