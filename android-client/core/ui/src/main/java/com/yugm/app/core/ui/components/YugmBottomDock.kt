package com.yugm.app.core.ui.components

import android.view.HapticFeedbackConstants
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.selection.selectableGroup
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
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.selected as selectedSemantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.util.lerp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.yugm.app.core.api.resolveMediaUrl
import com.yugm.app.core.model.AvatarPartsPayload
import com.yugm.app.core.ui.avatar.AvatarDescriptor
import com.yugm.app.core.ui.avatar.AvatarParts
import com.yugm.app.core.ui.avatar.GeneratedAvatar
import com.yugm.app.core.ui.theme.*
import kotlinx.coroutines.delay
import kotlin.math.abs
import kotlin.math.roundToInt
import kotlin.time.Duration.Companion.seconds
import kotlin.time.Duration.Companion.seconds

// Painted surface height for bottom content clearance calculations.
val YugmBottomDockBarHeight = 52.dp

// Active circle is self-contained within the dock height.
val YugmBottomDockActiveIconProtrusion = 0.dp

// Extra breathing room so content clears the dock comfortably.
val YugmBottomDockBreathingSpace = 12.dp

/**
 * Bottom content clearance for scrollable containers in main tabs where the dock is visible.
 * Ensures the last interactive item can scroll fully above the highest point of the dock.
 */
@Composable
fun mainDockBottomClearance(): Dp {
    val navBarInset = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
    return YugmBottomDockBarHeight + YugmBottomDockActiveIconProtrusion + navBarInset + YugmBottomDockBreathingSpace
}

/**
 * CompositionLocal providing the dock bottom clearance for main tabs. 0.dp when dock is not shown.
 */
val LocalMainDockBottomClearance = compositionLocalOf { 0.dp }

private fun focusDockScale(distance: Float): Float {
    return when {
        distance <= 1.0f -> lerp(1.00f, 0.86f, distance)
        else -> lerp(0.86f, 0.72f, (distance - 1.0f).coerceIn(0f, 1f))
    }
}

private fun focusDockBaseAlpha(distance: Float): Float {
    return when {
        distance <= 1.0f -> lerp(1.00f, 0.60f, distance)
        else -> lerp(0.60f, 0.28f, (distance - 1.0f).coerceIn(0f, 1f))
    }
}

private data class MainDockItem(
    val tab: YugmDockTab,
    val icon: ImageVector,
    val activeIcon: ImageVector = icon,
    val label: String,
    val compactLabel: String = label,
    val accessibilityLabel: String = label,
)

/**
 * Yugm Focus Dock — Minimal, backgroundless floating navigation carousel with strong visual depth hierarchy.
 *
 * The circular selection ring stays permanently fixed at the horizontal center of the screen,
 * while all 5 tab icons slide through it synchronized with pager scrolling.
 *
 * Distance-based hierarchy:
 * - Active center icon (distance 0): scale 1.0, alpha 1.0, snugly framed by 52dp ring.
 * - Near inactive icons (distance 1): scale ~0.86, alpha ~0.60 when expanded.
 * - Far inactive icons (distance 2): scale ~0.72, alpha ~0.28 when expanded.
 *
 * When idle (after 2 seconds of inactivity), inactive icons auto-fade to 0% opacity.
 * Only the active center selector and icon remain visible.
 */
@Composable
fun YugmFocusDock(
    selected: YugmDockTab,
    modifier: Modifier = Modifier,
    onTabSelected: (YugmDockTab) -> Unit = {},
    onTabReselected: (YugmDockTab) -> Unit = {},
    chatUnreadCount: Int = 0,
    userAvatar: String? = null,
    userAvatarType: String? = null,
    userAvatarParts: AvatarPartsPayload? = null,
    pagerIndexProvider: (() -> Float)? = null,
    isScrollingProvider: (() -> Boolean)? = null,
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
    val view = LocalView.current

    val selectedIndex = remember(selected) {
        items.indexOfFirst { it.tab == selected }.coerceAtLeast(0)
    }

    val rawPagerIndex = pagerIndexProvider?.invoke()
    val isScrolling = isScrollingProvider?.invoke() ?: false

    val animatedIndex by animateFloatAsState(
        targetValue = rawPagerIndex ?: selectedIndex.toFloat(),
        animationSpec = if (motionEnabled) spring(dampingRatio = 0.85f, stiffness = 380f) else snap(),
        label = "focus_dock_index"
    )

    val currentIndex = rawPagerIndex ?: animatedIndex

    // Expanded vs Idle Auto-Fade
    var isExpanded by remember { mutableStateOf(true) }
    var lastInteractionTime by remember { mutableLongStateOf(System.currentTimeMillis()) }

    fun wakeUp() {
        isExpanded = true
        lastInteractionTime = System.currentTimeMillis()
    }

    LaunchedEffect(isScrolling, rawPagerIndex, selectedIndex) {
        wakeUp()
    }

    LaunchedEffect(isExpanded, lastInteractionTime) {
        if (isExpanded) {
            delay(2.seconds)
            isExpanded = false
        }
    }

    val expandedFactor by animateFloatAsState(
        targetValue = if (isExpanded) 1.0f else 0.0f,
        animationSpec = tween(durationMillis = if (isExpanded) 200 else 600, easing = FastOutSlowInEasing),
        label = "focus_dock_expanded_factor"
    )

    val navBarInset = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()

    // Dimensions: Snug ring diameter (52dp) and 38dp active icon
    val ringDiameter = 52.dp
    val baseIconSize = 38.dp
    val itemSpacing = 64.dp

    val brandGradient = remember {
        Brush.horizontalGradient(
            colors = listOf(
                OnboardingBrandStart,
                OnboardingBrandMiddle,
                OnboardingBrandEnd
            )
        )
    }

    Box(
        modifier = modifier
            .fillMaxWidth()
            .padding(bottom = navBarInset + 8.dp)
            .height(ringDiameter + 12.dp)
            .selectableGroup(),
        contentAlignment = Alignment.Center
    ) {
        // 1. Fixed Snug Selection Ring (Center Anchored)
        Box(
            modifier = Modifier
                .size(ringDiameter)
                .align(Alignment.Center)
                .shadow(
                    elevation = if (colors.isDark) 6.dp else 3.dp,
                    shape = CircleShape,
                    ambientColor = OnboardingBrandMiddle.copy(alpha = 0.30f),
                    spotColor = OnboardingBrandStart.copy(alpha = 0.40f)
                )
                .clip(CircleShape)
                .border(2.dp, brandGradient, CircleShape)
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                    role = Role.Button
                ) {
                    if (view.isHapticFeedbackEnabled) {
                        view.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
                    }
                    if (!isExpanded) {
                        wakeUp()
                    } else {
                        wakeUp()
                        onTabReselected(items[selectedIndex].tab)
                    }
                }
        )

        // 2. Icon Track (Translates through the fixed center ring with distance hierarchy)
        val density = LocalDensity.current
        val itemSpacingPx = with(density) { itemSpacing.toPx() }

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(ringDiameter),
            contentAlignment = Alignment.Center
        ) {
            items.forEachIndexed { i, item ->
                val distFromCenter = abs(i - currentIndex)
                val scale = focusDockScale(distFromCenter)
                val baseAlpha = focusDockBaseAlpha(distFromCenter)

                // Active icon (dist = 0) stays 1.0 alpha; inactive icons fade with expandedFactor
                val itemAlpha = if (distFromCenter < 0.05f) 1.0f else (baseAlpha * expandedFactor)
                val iconSize = baseIconSize * scale

                val xOffsetPx = (i - currentIndex) * itemSpacingPx

                Box(
                    modifier = Modifier
                        .offset { IntOffset(x = xOffsetPx.roundToInt(), y = 0) }
                        .size(52.dp)
                        .clip(CircleShape)
                        .graphicsLayer {
                            alpha = itemAlpha
                        }
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null,
                            role = Role.Tab
                        ) {
                            wakeUp()
                            if (view.isHapticFeedbackEnabled) {
                                view.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
                            }
                            if (item.tab == selected) {
                                onTabReselected(item.tab)
                            } else {
                                onTabSelected(item.tab)
                            }
                        }
                        .semantics {
                            selectedSemantics = (item.tab == selected)
                            contentDescription = item.accessibilityLabel
                        },
                    contentAlignment = Alignment.Center
                ) {
                    val badgeCount = if (item.tab == YugmDockTab.CHAT) chatUnreadCount.coerceAtLeast(0) else 0

                    if (item.tab == YugmDockTab.PROFILE) {
                        DockAvatar(
                            avatar = userAvatar,
                            avatarType = userAvatarType,
                            avatarParts = userAvatarParts,
                            size = iconSize,
                        )
                    } else {
                        Box(contentAlignment = Alignment.TopEnd) {
                            val isActive = distFromCenter < 0.3f
                            Icon(
                                imageVector = if (item.tab == selected) item.activeIcon else item.icon,
                                contentDescription = null,
                                modifier = Modifier
                                    .size(iconSize)
                                    .then(
                                        if (isActive) {
                                            Modifier
                                                .graphicsLayer {
                                                    compositingStrategy = CompositingStrategy.Offscreen
                                                }
                                                .drawWithCache {
                                                    onDrawWithContent {
                                                        drawContent()
                                                        drawRect(
                                                            brush = brandGradient,
                                                            blendMode = BlendMode.SrcAtop
                                                        )
                                                    }
                                                }
                                        } else Modifier
                                    ),
                                tint = if (isActive) Color.White else colors.textSecondary
                            )
                            if (badgeCount > 0) {
                                val badgeText = if (badgeCount > 99) "99+" else badgeCount.toString()
                                Box(
                                    modifier = Modifier
                                        .padding(start = 14.dp, top = 0.dp)
                                        .clip(CircleShape)
                                        .background(colors.secondary)
                                        .heightIn(min = 14.dp)
                                        .widthIn(min = 14.dp)
                                        .padding(horizontal = 3.dp, vertical = 1.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = badgeText,
                                        color = Color.White,
                                        fontSize = 8.sp,
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
}

/**
 * Backward-compatible entrypoint mapping YugmBottomDock callers directly to YugmFocusDock.
 */
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
    pagerIndexProvider: (() -> Float)? = null,
    isScrollingProvider: (() -> Boolean)? = null,
) {
    YugmFocusDock(
        selected = selected,
        modifier = modifier,
        onTabSelected = onTabSelected,
        onTabReselected = onTabReselected,
        chatUnreadCount = chatUnreadCount,
        userAvatar = userAvatar,
        userAvatarType = userAvatarType,
        userAvatarParts = userAvatarParts,
        pagerIndexProvider = pagerIndexProvider,
        isScrollingProvider = isScrollingProvider
    )
}

@Composable
private fun DockAvatar(
    avatar: String?,
    avatarType: String?,
    avatarParts: AvatarPartsPayload?,
    size: Dp,
    modifier: Modifier = Modifier,
) {
    val resolvedUrl = remember(avatar) { resolveMediaUrl(avatar) }
    val shape = CircleShape
    Box(
        modifier = modifier
            .size(size)
            .clip(shape),
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
        } else {
            val brandGradient = remember {
                Brush.horizontalGradient(
                    colors = listOf(
                        OnboardingBrandStart,
                        OnboardingBrandMiddle,
                        OnboardingBrandEnd
                    )
                )
            }
            Icon(
                imageVector = Icons.Filled.Person,
                contentDescription = null,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(4.dp)
                    .graphicsLayer {
                        compositingStrategy = CompositingStrategy.Offscreen
                    }
                    .drawWithCache {
                        onDrawWithContent {
                            drawContent()
                            drawRect(
                                brush = brandGradient,
                                blendMode = BlendMode.SrcAtop
                            )
                        }
                    },
                tint = Color.White
            )
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
        YugmFocusDock(selected = YugmDockTab.DISCOVER)
    }
}

@Preview(name = "Dock - Dark - Chat selected", showBackground = true, backgroundColor = 0xFF1A1A2E)
@Composable
private fun PreviewDockDarkChat() {
    YugmTheme(darkTheme = true) {
        YugmFocusDock(selected = YugmDockTab.CHAT, chatUnreadCount = 5)
    }
}

@Preview(name = "Dock - Light - Arcade selected", showBackground = true, backgroundColor = 0xFFF5F5F5)
@Composable
private fun PreviewDockLightArcade() {
    YugmTheme(darkTheme = false) {
        YugmFocusDock(selected = YugmDockTab.GAME_ZONE)
    }
}

@Preview(name = "Dock - Dark - Party selected", showBackground = true, backgroundColor = 0xFF1A1A2E)
@Composable
private fun PreviewDockDarkParty() {
    YugmTheme(darkTheme = true) {
        YugmFocusDock(selected = YugmDockTab.LIVE)
    }
}

@Preview(name = "Dock - Light - Profile selected", showBackground = true, backgroundColor = 0xFFF5F5F5)
@Composable
private fun PreviewDockLightProfile() {
    YugmTheme(darkTheme = false) {
        YugmFocusDock(selected = YugmDockTab.PROFILE)
    }
}
