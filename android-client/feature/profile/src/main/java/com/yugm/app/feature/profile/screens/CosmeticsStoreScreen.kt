package com.yugm.app.feature.profile.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.Canvas
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.sp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.yugm.app.feature.profile.viewmodel.CosmeticsViewModel
import com.yugm.app.core.model.ActiveCosmetics
import com.yugm.app.core.model.CosmeticBundle
import com.yugm.app.core.model.CosmeticCatalog
import com.yugm.app.core.model.ProfileCosmetic
import com.yugm.app.core.ui.components.Avatar
import com.yugm.app.core.ui.components.GlassCard
import com.yugm.app.core.ui.components.LoadingState
import com.yugm.app.core.ui.components.YugmPageHeader
import com.yugm.app.core.ui.theme.*
import kotlinx.coroutines.launch

private val typeEmoji = mapOf(
    "AVATAR_ASSET" to "👤",
    "AVATAR_FRAME" to "🖼️",
    "SPEAKING_WAVE" to "〰️",
    "PROFILE_THEME" to "🎨",
    "ENTRANCE_EFFECT" to "✨",
    "PROFILE_BADGE" to "🏅",
    "NAME_STYLE" to "✍️",
    "ROOM_ENTRY" to "🚪",
    "MOOD_STATUS" to "😎",
    "PROFILE_MUSIC" to "🎵",
    "VOICE_BADGE" to "🎤",
    "ROOM_THEME" to "🏠",
    "AVATAR_DECORATION" to "💎",
    "REACTION_PACK" to "💥",
    "PROFILE_LAYOUT" to "📐",
    "INTRO_CARD" to "🃏",
    "COLLECTIBLE_TITLE" to "👑",
    "GIFT_SHELF" to "🏆",
    "CHAT_BUBBLE" to "💬",
    "SEASONAL_EVENT" to "🎉",
    "CALL_SCREEN" to "📱",
    "ROOM_BADGE" to "🏷️",
    "ROOM_AMBIENCE" to "🎶"
)

private val typeActiveField: Map<String, (ActiveCosmetics) -> String> = mapOf(
    "AVATAR_ASSET" to { it.avatarAsset },
    "AVATAR_FRAME" to { it.avatarFrame },
    "SPEAKING_WAVE" to { it.speakingWave },
    "PROFILE_THEME" to { it.profileTheme },
    "ENTRANCE_EFFECT" to { it.entranceEffect },
    "PROFILE_BADGE" to { it.profileBadge },
    "NAME_STYLE" to { it.nameStyle },
    "ROOM_ENTRY" to { it.roomEntry },
    "MOOD_STATUS" to { it.moodStatus },
    "PROFILE_MUSIC" to { it.profileMusic },
    "VOICE_BADGE" to { it.voiceBadge },
    "ROOM_THEME" to { it.roomTheme },
    "AVATAR_DECORATION" to { it.avatarDecoration },
    "REACTION_PACK" to { it.reactionPack },
    "PROFILE_LAYOUT" to { it.profileLayout },
    "INTRO_CARD" to { it.introCard },
    "COLLECTIBLE_TITLE" to { it.collectibleTitle },
    "GIFT_SHELF" to { it.giftShelf },
    "CHAT_BUBBLE" to { it.chatBubble },
    "SEASONAL_EVENT" to { it.seasonalEvent },
    "CALL_SCREEN" to { it.videoCallOverlay },
    "ROOM_BADGE" to { it.roomBadge },
    "ROOM_AMBIENCE" to { it.roomAmbience }
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CosmeticsStoreScreen(
    token: String,
    onBack: () -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    val viewModel: CosmeticsViewModel = hiltViewModel()
    var activeTab by remember { mutableStateOf("AVATAR_FRAME") }

    val tabs = listOf(
        "AVATAR_ASSET" to "Avatars",
        "AVATAR_FRAME" to "Frames",
        "SPEAKING_WAVE" to "Waves",
        "PROFILE_THEME" to "Themes",
        "ENTRANCE_EFFECT" to "Entrances",
        "PROFILE_BADGE" to "Badges",
        "NAME_STYLE" to "Name Styles",
        "ROOM_ENTRY" to "Room Entry",
        "MOOD_STATUS" to "Moods",
        "PROFILE_MUSIC" to "Music",
        "VOICE_BADGE" to "Voice",
        "ROOM_THEME" to "Room Themes",
        "AVATAR_DECORATION" to "Decorations",
        "REACTION_PACK" to "Reactions",
        "PROFILE_LAYOUT" to "Layouts",
        "INTRO_CARD" to "Intro Cards",
        "COLLECTIBLE_TITLE" to "Titles",
        "GIFT_SHELF" to "Gift Shelves",
        "CHAT_BUBBLE" to "Bubbles",
        "SEASONAL_EVENT" to "Seasonal",
        "CALL_SCREEN" to "Call Screens",
        "ROOM_BADGE" to "Room Badges",
        "ROOM_AMBIENCE" to "Ambience"
    )

    LaunchedEffect(token) {
        viewModel.refresh(token)
    }

    Scaffold(
        topBar = {
            YugmPageHeader(title = "Cosmetics Store", onBack = onBack)
        },
        containerColor = Background
    ) { innerPadding ->
        if (viewModel.isLoading) {
            Box(Modifier.fillMaxSize().padding(innerPadding), contentAlignment = Alignment.Center) {
                LoadingState("Entering the closet...")
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
            ) {
                // Wallet Header
                GlassCard(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 10.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text("Available Balance", color = TextMuted, fontSize = 12.sp)
                            Text("$viewModel.balance Coins", color = Gold, fontSize = 22.sp, fontWeight = FontWeight.Black)
                        }
                    }
                }

                // My Closet — currently equipped items
                val equippedItems = viewModel.catalog?.let { cat ->
                    cat.cosmetics.filter { c ->
                        typeActiveField[c.type]?.invoke(cat.activeCosmetics) == c.id
                    }
                } ?: emptyList()

                if (equippedItems.isNotEmpty()) {
                    Text(
                        "My Closet",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        modifier = Modifier.padding(start = 20.dp, top = 8.dp, bottom = 6.dp)
                    )
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.height(100.dp)
                    ) {
                        items(equippedItems.size) { index ->
                            val item = equippedItems[index]
                            GlassCard(modifier = Modifier.width(90.dp).fillMaxHeight()) {
                                Column(
                                    modifier = Modifier.fillMaxSize().padding(8.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.Center
                                ) {
                                    Text(
                                        text = typeEmoji[item.type] ?: "✨",
                                        fontSize = 20.sp
                                    )
                                    Text(
                                        text = item.name,
                                        color = Color.White,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                        textAlign = TextAlign.Center
                                    )
                                }
                            }
                        }
                    }
                }

                // Bundle Offers
                val bundles = listOf(
                    CosmeticBundle("vibe_starter", "Vibe Starter Pack", "3 essential moods & frames", 150, listOf("mood_chill", "frame_minimal", "mood_focused")),
                    CosmeticBundle("neon_nights", "Neon Nights Pack", "4 neon-themed cosmetics", 350, listOf("frame_neon", "name_neon_glow", "avatar_cosmic_gif", "room_theme_neon_club")),
                    CosmeticBundle("royal_collection", "Royal Collection", "Premium VIP cosmetics", 500, listOf("badge_vip_host", "frame_gold", "theme_cozy", "badge_premium")),
                    CosmeticBundle("call_pro", "Call Pro Pack", "3 call screen overlays", 200, listOf("call_soft_glow", "call_neon_frame", "call_bollywood_lights")),
                    CosmeticBundle("room_host_kit", "Room Host Kit", "Theme, badge & ambience", 400, listOf("badge_featured", "ambience_lofi", "room_theme_festive", "ambience_cafe"))
                )
                val ownedBundleIds = viewModel.catalog?.ownedCosmeticIds ?: emptyList()
                val availableBundles = bundles.filter { b -> b.cosmeticIds.any { !ownedBundleIds.contains(it) } }.take(3)
                if (availableBundles.isNotEmpty()) {
                    Text(
                        "Bundle Offers",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        modifier = Modifier.padding(start = 20.dp, top = 8.dp, bottom = 6.dp)
                    )
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.height(130.dp)
                    ) {
                        itemsIndexed(availableBundles) { index, bundle ->
                            val savingsText = bundle.cosmeticIds.sumOf { id -> viewModel.catalog?.cosmetics?.find { it.id == id }?.coinPrice ?: 0 } - bundle.coinPrice
                            Card(
                                colors = CardDefaults.cardColors(containerColor = PrimaryPurple.copy(alpha = 0.3f)),
                                border = BorderStroke(1.dp, Gold),
                                shape = RoundedCornerShape(14.dp),
                                modifier = Modifier.width(160.dp).fillMaxHeight().clickable {
                                    viewModel.purchaseBundle(token, bundle.id)
                                }
                            ) {
                                Column(Modifier.fillMaxSize().padding(10.dp), verticalArrangement = Arrangement.Center) {
                                    Text(bundle.title, color = Gold, fontWeight = FontWeight.Black, fontSize = 14.sp)
                                    Text(bundle.description, color = TextMuted, fontSize = 10.sp, modifier = Modifier.padding(top = 3.dp))
                                    Text("${bundle.coinPrice} 🪙", color = Color.White, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 6.dp))
                                    if (savingsText > 0) {
                                        Text("Save $savingsText coins!", color = Pink, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        }
                    }
                }

                // Featured / New Arrivals
                val featuredItems = viewModel.catalog?.cosmetics?.filter { it.rarity == "LEGENDARY" || it.rarity == "EPIC" }?.take(8) ?: emptyList()
                if (featuredItems.isNotEmpty()) {
                    Text(
                        "Featured & New",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        modifier = Modifier.padding(start = 20.dp, top = 8.dp, bottom = 6.dp)
                    )
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.height(120.dp)
                    ) {
                        items(featuredItems.size) { index ->
                            val item = featuredItems[index]
                            val isOwned = viewModel.catalog?.ownedCosmeticIds?.contains(item.id) == true
                            Card(
                                colors = CardDefaults.cardColors(containerColor = SurfaceElevated),
                                border = BorderStroke(
                                    1.dp,
                                    when (item.rarity) {
                                        "LEGENDARY" -> Color(0xFFFF8A22)
                                        "EPIC" -> PrimaryPurple
                                        else -> Color(0x1AFFFFFF)
                                    }
                                ),
                                shape = RoundedCornerShape(14.dp),
                                modifier = Modifier.width(100.dp).fillMaxHeight()
                            ) {
                                Column(
                                    modifier = Modifier.fillMaxSize().padding(8.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.Center
                                ) {
                                    Text(text = typeEmoji[item.type] ?: "✨", fontSize = 22.sp)
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = item.name,
                                        color = Color.White,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                        textAlign = TextAlign.Center
                                    )
                                    Text(
                                        text = if (isOwned) "Owned" else "${item.coinPrice}🪙",
                                        color = if (isOwned) Gold else TextMuted,
                                        fontSize = 10.sp
                                    )
                                }
                            }
                        }
                    }
                }

                // Category Tabs
                PrimaryScrollableTabRow(
                    selectedTabIndex = tabs.indexOfFirst { it.first == activeTab },
                    containerColor = Background,
                    contentColor = Gold,
                    edgePadding = 12.dp,
                    modifier = Modifier.padding(bottom = 12.dp)
                ) {
                    tabs.forEach { (type, label) ->
                        Tab(
                            selected = activeTab == type,
                            onClick = { activeTab = type },
                            text = { Text(label, fontWeight = FontWeight.Bold) },
                            selectedContentColor = Gold
                        )
                    }
                }

                val currentCosmetics = viewModel.catalog?.cosmetics?.filter { it.type == activeTab } ?: emptyList()

                if (currentCosmetics.isEmpty()) {
                    Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                        Text("No cosmetics available in this category.", color = TextMuted)
                    }
                } else {
                    LazyVerticalGrid(
                        columns = GridCells.Fixed(2),
                        contentPadding = PaddingValues(16.dp),
                        horizontalArrangement = Arrangement.spacedBy(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        items(currentCosmetics) { cosmetic ->
                            val isOwned = viewModel.catalog?.ownedCosmeticIds?.contains(cosmetic.id) == true
                            val isActive = viewModel.catalog?.let { cat ->
                                typeActiveField[cosmetic.type]?.invoke(cat.activeCosmetics)
                            } == cosmetic.id

                            CosmeticCard(
                                cosmetic = cosmetic,
                                isOwned = isOwned,
                                isActive = isActive,
                                onAction = {
                                    coroutineScope.launch {
                                        if (isOwned) {
                                            val equipId = if (isActive) null else cosmetic.id
                                            viewModel.equip(token, equipId ?: "", cosmetic.type)
                                        } else {
                                            if (viewModel.balance >= cosmetic.coinPrice) {
                                                viewModel.purchase(token, cosmetic.id)
                                            }
                                        }
                                    }
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun CosmeticCard(
    cosmetic: ProfileCosmetic,
    isOwned: Boolean,
    isActive: Boolean,
    onAction: () -> Unit
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = SurfaceElevated),
        border = BorderStroke(1.dp, if (isActive) Gold else Color(0x1AFFFFFF)),
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Visual Demo Avatar with cosmetic preview
            CosmeticPreviewBox(type = cosmetic.type, name = cosmetic.name, isActive = isActive)

            Text(
                text = cosmetic.name,
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 14.sp,
                textAlign = TextAlign.Center,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )

            Text(
                text = cosmetic.rarity,
                color = when (cosmetic.rarity) {
                    "LEGENDARY" -> Color(0xFFFF8A22)
                    "EPIC" -> PrimaryPurple
                    "RARE" -> Color(0xFF27D3FF)
                    else -> Color.Gray
                },
                fontSize = 11.sp,
                fontWeight = FontWeight.Black
            )

            Spacer(modifier = Modifier.height(4.dp))

            Button(
                onClick = onAction,
                colors = ButtonDefaults.buttonColors(
                    containerColor = when {
                        isActive -> PrimaryPink
                        isOwned -> Gold
                        else -> Surface
                    }
                ),
                border = if (!isOwned && !isActive) BorderStroke(1.dp, Color(0x33FFFFFF)) else null,
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier.fillMaxWidth().height(42.dp)
            ) {
                Text(
                    text = when {
                        isActive -> "Equipped"
                        isOwned -> "Equip"
                        else -> "${cosmetic.coinPrice} Coins"
                    },
                    color = if (isActive || !isOwned) Color.White else Background,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Black
                )
            }
        }
    }
}

@Composable
private fun CosmeticPreviewBox(type: String, name: String, isActive: Boolean) {
    val borderColor = if (isActive) Gold else Color.White.copy(alpha = 0.3f)
    val bgColor = Color.White.copy(alpha = 0.08f)
    val size = 64.dp

    Box(
        modifier = Modifier.size(size),
        contentAlignment = Alignment.Center
    ) {
        when (type) {
            "AVATAR_FRAME" -> {
                Box(
                    modifier = Modifier
                        .size(size)
                        .clip(CircleShape)
                        .background(bgColor)
                        .border(3.dp, borderColor, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Text("😎", fontSize = 22.sp)
                }
            }
            "SPEAKING_WAVE" -> {
                Canvas(modifier = Modifier.size(size)) {
                    val wavePath = Path().apply {
                        moveTo(0f, size.toPx() * 0.6f)
                        cubicTo(
                            size.toPx() * 0.2f, size.toPx() * 0.2f,
                            size.toPx() * 0.4f, size.toPx() * 0.8f,
                            size.toPx() * 0.5f, size.toPx() * 0.5f
                        )
                        cubicTo(
                            size.toPx() * 0.6f, size.toPx() * 0.2f,
                            size.toPx() * 0.8f, size.toPx() * 0.8f,
                            size.toPx(), size.toPx() * 0.4f
                        )
                    }
                    drawPath(wavePath, color = borderColor, style = Stroke(width = 3f))
                }
            }
            "PROFILE_THEME" -> {
                Box(
                    modifier = Modifier
                        .size(size)
                        .clip(RoundedCornerShape(12.dp))
                        .background(
                            Brush.linearGradient(
                                listOf(PrimaryPink, PrimaryPurple)
                            )
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Text("🎨", fontSize = 22.sp)
                }
            }
            "ENTRANCE_EFFECT" -> {
                Box(
                    modifier = Modifier.size(size).clip(CircleShape).background(bgColor),
                    contentAlignment = Alignment.Center
                ) {
                    Canvas(modifier = Modifier.size(size)) {
                        val cx = size.toPx() / 2
                        val cy = size.toPx() / 2
                        for (i in 0..11) {
                            val angle = Math.toRadians((i * 30).toDouble())
                            val startX = (cx + Math.cos(angle) * 8).toFloat()
                            val startY = (cy + Math.sin(angle) * 8).toFloat()
                            val endX = (cx + Math.cos(angle) * 28).toFloat()
                            val endY = (cy + Math.sin(angle) * 28).toFloat()
                            drawLine(
                                color = Gold.copy(alpha = 0.6f),
                                start = Offset(startX, startY),
                                end = Offset(endX, endY),
                                strokeWidth = 2f
                            )
                        }
                    }
                    Text("✨", fontSize = 16.sp)
                }
            }
            "NAME_STYLE" -> {
                Box(
                    modifier = Modifier.size(size).clip(CircleShape).background(bgColor),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        "Abc",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Black,
                        color = when {
                            name.contains("neon") -> Color(0xFF00FFF7)
                            name.contains("gold") -> Gold
                            name.contains("glow") -> PrimaryPink
                            else -> Color.White
                        }
                    )
                }
            }
            "ROOM_ENTRY" -> {
                Box(
                    modifier = Modifier.size(size).clip(RoundedCornerShape(12.dp)).background(bgColor),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("🚪", fontSize = 18.sp)
                        repeat(3) {
                            Box(
                                modifier = Modifier
                                    .size(width = 20.dp, height = 3.dp)
                                    .background(borderColor, RoundedCornerShape(2.dp))
                                    .padding(vertical = 1.dp)
                            )
                        }
                    }
                }
            }
            "CALL_SCREEN" -> {
                Box(
                    modifier = Modifier.size(size).clip(RoundedCornerShape(8.dp)).background(bgColor),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("📱", fontSize = 18.sp)
                        Box(
                            modifier = Modifier
                                .size(width = 24.dp, height = 16.dp)
                                .border(1.5.dp, borderColor, RoundedCornerShape(3.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("🎥", fontSize = 8.sp)
                        }
                    }
                }
            }
            "ROOM_BADGE" -> {
                Box(
                    modifier = Modifier.size(size).clip(CircleShape).background(bgColor),
                    contentAlignment = Alignment.Center
                ) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(50))
                            .background(
                                if (name.contains("vip") || name.contains("featured") || name.contains("premium")) Gold
                                else PrimaryPink
                            )
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        Text(
                            name.replace("badge_", "").replace("_", " ").take(6).uppercase(),
                            color = Background, fontSize = 7.sp, fontWeight = FontWeight.Black
                        )
                    }
                }
            }
            "ROOM_AMBIENCE" -> {
                Box(
                    modifier = Modifier.size(size).clip(RoundedCornerShape(12.dp)).background(bgColor),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("🎶", fontSize = 18.sp)
                        Spacer(Modifier.height(2.dp))
                        Text(name.replace("ambience_", "").replace("_", " ").take(8), fontSize = 8.sp, color = TextMuted)
                    }
                }
            }
            else -> {
                Box(
                    modifier = Modifier.size(size).clip(CircleShape).background(bgColor),
                    contentAlignment = Alignment.Center
                ) {
                    Text(typeEmoji[type] ?: "✨", fontSize = 24.sp)
                }
            }
        }
    }
}
