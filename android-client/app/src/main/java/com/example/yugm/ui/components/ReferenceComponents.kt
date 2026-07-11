package com.example.yugm.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.ui.theme.Background
import com.example.yugm.ui.theme.BorderColor
import com.example.yugm.ui.theme.Danger
import com.example.yugm.ui.theme.Gold
import com.example.yugm.ui.theme.Pink
import com.example.yugm.ui.theme.PrimaryPurple
import com.example.yugm.ui.theme.SurfaceElevated
import com.example.yugm.ui.theme.TextMuted
import com.example.yugm.ui.theme.TextPrimary

enum class YugmDockTab { DISCOVER, MATCH, LIVE, CHAT, WALLET, PROFILE }

@Composable
fun YugmAmbientBackground(content: @Composable () -> Unit) {
    Box(Modifier.fillMaxSize().background(Background)) {
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
    onClick: () -> Unit
) {
    Box(modifier) {
        Box(
            modifier = Modifier
                .size(44.dp)
                .clip(CircleShape)
                .background(
                    when {
                        danger -> Danger
                        selected -> PrimaryPurple
                        else -> SurfaceElevated
                    }
                )
                .border(1.dp, if (danger) Danger else BorderColor, CircleShape)
                .clickable(onClick = onClick),
            contentAlignment = Alignment.Center
        ) {
            Text(glyph, color = Color.White, fontSize = 21.sp, fontWeight = FontWeight.Bold)
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
            .height(39.dp)
            .clip(shape)
            .background(if (selected) PrimaryPurple.copy(alpha = 0.26f) else SurfaceElevated)
            .border(1.dp, if (selected) Pink else BorderColor, shape)
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
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
            Text(action, color = Pink, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.clickable(onClick = onAction))
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
                    .clickable { onSelected(index) },
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
    onMatch: () -> Unit = {},
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
            Triple(YugmDockTab.DISCOVER, "⌁", "Discover"),
            Triple(YugmDockTab.LIVE, "◖", "Voice"),
            Triple(YugmDockTab.CHAT, "●●", "Chat"),
            Triple(YugmDockTab.WALLET, "▰", "Wallet")
        )
    } else {
        listOf(
            Triple(YugmDockTab.DISCOVER, "⌁", "Discover"),
            Triple(YugmDockTab.MATCH, "♡", "Match"),
            Triple(YugmDockTab.LIVE, "◖", "Live"),
            Triple(YugmDockTab.CHAT, "●●", "Chat"),
            Triple(YugmDockTab.PROFILE, "♙", "Profile")
        )
    }
    Row(
        modifier = modifier
            .fillMaxWidth()
            .navigationBarsPadding()
            .padding(horizontal = 14.dp, vertical = 10.dp)
            .height(74.dp)
            .shadow(24.dp, RoundedCornerShape(25.dp), ambientColor = Color.Black)
            .clip(RoundedCornerShape(25.dp))
            .background(Color(0xF5181B2D))
            .border(1.dp, BorderColor, RoundedCornerShape(25.dp))
            .padding(horizontal = 5.dp),
        horizontalArrangement = Arrangement.SpaceAround,
        verticalAlignment = Alignment.CenterVertically
    ) {
        tabs.forEachIndexed { index, (tab, glyph, label) ->
            if (index == 2) {
                Box(
                    Modifier
                        .size(58.dp)
                        .clip(CircleShape)
                        .background(Brush.linearGradient(listOf(Color(0xFFFF5B65), Pink, PrimaryPurple)))
                        .clickable(onClick = onCreate),
                    contentAlignment = Alignment.Center
                ) { Text("+", color = Color.White, fontSize = 36.sp, fontWeight = FontWeight.Light) }
            }
            val click = when (tab) {
                    YugmDockTab.DISCOVER -> onDiscover
                    YugmDockTab.MATCH -> onMatch
                    YugmDockTab.LIVE -> onLive
                    YugmDockTab.CHAT -> onChat
                    YugmDockTab.WALLET -> onWallet
                    YugmDockTab.PROFILE -> onProfile
                }
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.width(50.dp).clickable(onClick = click)
            ) {
                Box {
                    Text(glyph, color = if (tab == selected) Gold else TextMuted, fontSize = if (glyph == "●●") 11.sp else 20.sp, fontWeight = FontWeight.Bold)
                    if (tab == YugmDockTab.CHAT && chatBadge > 0) {
                        Box(
                            Modifier.align(Alignment.TopEnd).clip(CircleShape).background(Pink).padding(horizontal = 4.dp, vertical = 1.dp)
                        ) { Text(chatBadge.coerceAtMost(99).toString(), color = Color.White, fontSize = 7.sp, fontWeight = FontWeight.Black) }
                    }
                }
                Text(label, color = if (tab == selected) Gold else TextMuted, fontSize = 9.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}
