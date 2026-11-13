package com.yugm.app.core.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.ChatBubble
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Person
import androidx.compose.runtime.Composable
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
import com.yugm.app.core.ui.theme.AccessiblePrimaryPink
import com.yugm.app.core.ui.theme.AccessibleSaffron
import com.yugm.app.core.ui.theme.BorderColor
import com.yugm.app.core.ui.theme.Danger
import com.yugm.app.core.ui.theme.Gold
import com.yugm.app.core.ui.theme.Pink
import com.yugm.app.core.ui.theme.PrimaryPurple
import com.yugm.app.core.ui.theme.SurfaceElevated
import com.yugm.app.core.ui.theme.TextMuted
import com.yugm.app.core.ui.theme.TextPrimary

enum class YugmDockTab { DISCOVER, LIVE, CHAT, WALLET, PROFILE }

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
            RoundAction("‹", onClick = onBack)
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
            if (imageVector != null) {
                Icon(imageVector, contentDescription = null, modifier = Modifier.size(22.dp), tint = Color.White)
            } else {
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
        if (glyph.isNotBlank()) Text(glyph, color = if (selected) Pink else TextMuted, fontSize = 14.sp)
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
                if (item.first.isNotBlank()) Text(item.first, color = if (selected) Color.White else TextMuted, fontSize = 15.sp)
                Spacer(Modifier.width(6.dp))
                Text(item.second, color = if (selected) Color.White else TextMuted, fontSize = 13.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
fun YugmBottomDock(
    selected: YugmDockTab,
    modifier: Modifier = Modifier,
    onDiscover: () -> Unit = {},
    onCreate: () -> Unit = {},
    onLive: () -> Unit = {},
    onChat: () -> Unit = {},
    onWallet: () -> Unit = {},
    onProfile: () -> Unit = {},
    chatBadge: Int = 0,
    compactSet: Boolean = false
) {
    val tabs = if (compactSet) {
        listOf(
            Triple(YugmDockTab.DISCOVER, Icons.Filled.Home, "Home"),
            Triple(YugmDockTab.LIVE, Icons.Filled.Mic, "Party"),
            Triple(YugmDockTab.CHAT, Icons.Filled.ChatBubble, "Chat"),
            Triple(YugmDockTab.WALLET, Icons.Filled.AccountBalanceWallet, "Wallet")
        )
    } else {
        listOf(
            Triple(YugmDockTab.DISCOVER, Icons.Filled.Home, "Home"),
            Triple(YugmDockTab.LIVE, Icons.Filled.Mic, "Party"),
            Triple(YugmDockTab.CHAT, Icons.Filled.ChatBubble, "Chat"),
            Triple(YugmDockTab.PROFILE, Icons.Filled.Person, "Mine")
        )
    }
    val dockColor = Color(0xF5181B2D)
    val inactiveColor = TextMuted
    Box(
        modifier = modifier
            .fillMaxWidth()
            .navigationBarsPadding()
            .padding(horizontal = 14.dp, vertical = 10.dp)
            .height(112.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(72.dp)
                .align(Alignment.BottomCenter)
                .shadow(24.dp, RoundedCornerShape(25.dp), ambientColor = Color.Black)
                .clip(RoundedCornerShape(25.dp))
                .background(dockColor)
                .border(1.dp, BorderColor, RoundedCornerShape(25.dp))
                .selectableGroup()
                .padding(horizontal = 5.dp),
            horizontalArrangement = Arrangement.SpaceAround,
            verticalAlignment = Alignment.CenterVertically
        ) {
            tabs.forEach { (tab, icon, label) ->
                val click = when (tab) {
                    YugmDockTab.DISCOVER -> onDiscover
                    YugmDockTab.LIVE -> onLive
                    YugmDockTab.CHAT -> onChat
                    YugmDockTab.WALLET -> onWallet
                    YugmDockTab.PROFILE -> onProfile
                }
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight()
                        .clip(RoundedCornerShape(16.dp))
                        .selectable(selected = tab == selected, role = Role.Tab, onClick = click)
                        .semantics(mergeDescendants = true) {
                            contentDescription = if (tab == YugmDockTab.CHAT && chatBadge > 0) {
                                "$label, ${chatBadge.coerceAtMost(99)} unread messages"
                            } else label
                            selectedSemantics = tab == selected
                        }
                ) {
                    Box {
                        Icon(
                            imageVector = icon,
                            contentDescription = null,
                            modifier = Modifier.size(24.dp),
                            tint = if (tab == selected) PrimaryPurple else inactiveColor
                        )
                        if (tab == YugmDockTab.CHAT && chatBadge > 0) {
                            Box(
                                Modifier.align(Alignment.TopEnd).clip(CircleShape).background(Pink).padding(horizontal = 4.dp, vertical = 1.dp)
                            ) { Text(chatBadge.coerceAtMost(99).toString(), color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Black) }
                        }
                    }
                    Text(label, color = if (tab == selected) PrimaryPurple else inactiveColor, fontSize = 12.sp, fontWeight = if (tab == selected) FontWeight.Bold else FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
        }
        if (compactSet) Box(
            Modifier
                .align(Alignment.TopCenter)
                .size(48.dp)
                .clip(CircleShape)
                .background(Brush.linearGradient(listOf(AccessibleSaffron, AccessiblePrimaryPink, PrimaryPurple)))
                .semantics { contentDescription = "Create a room" }
                .clickable(role = Role.Button, onClickLabel = "Create a room", onClick = onCreate),
            contentAlignment = Alignment.Center
        ) {
            Text("+", color = Color.White, fontSize = 32.sp, fontWeight = FontWeight.Light)
        }
    }
}
