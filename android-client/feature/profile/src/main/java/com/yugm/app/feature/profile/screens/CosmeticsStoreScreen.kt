package com.yugm.app.feature.profile.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.CardGiftcard
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Discount
import androidx.compose.material.icons.filled.ShoppingBag
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import coil.compose.AsyncImage
import com.yugm.app.core.model.ActiveCosmetics
import com.yugm.app.core.model.ProfileCosmetic
import com.yugm.app.core.ui.components.AuroraBackground
import com.yugm.app.core.ui.components.LoadingState
import com.yugm.app.core.ui.cosmetics.CosmeticArtwork
import com.yugm.app.feature.profile.viewmodel.CosmeticsViewModel
import kotlinx.coroutines.launch

// Colors matching the dark, cosmic attire of the Yugm app
private val StoreBg = Color(0xFF060714)
private val StoreCardBg = Color(0xFF171A2C)
private val StorePrimaryPurple = Color(0xFF8D35F6)
private val StorePillInactiveBg = Color(0xFF14182B)
private val StoreTextDark = Color(0xFFF8FAFC)
private val StoreTextMuted = Color(0xFF9EA3B9)
private val StoreTextSubtle = Color(0xFF6E748B)
private val StoreGemColor = Color(0xFFFF2D55)
private val StoreBorder = Color(0x24FFFFFF)

// Category tab definition with illustrated icons and gradient backgrounds
private data class StoreCategory(
    val type: String,
    val title: String,
    val iconEmoji: String,
    val subcategoryHeading: String,
    val gradientColors: List<Color>
)

private val storeCategories = listOf(
    StoreCategory("AVATAR_FRAME", "Avatar", "👑", "Avatar Frame",
        listOf(Color(0xFF7B3FA0), Color(0xFF4A1980), Color(0xFF2D1060))),
    StoreCategory("AVATAR_ASSET", "Limited\nAvatar", "🧝", "Limited Avatar",
        listOf(Color(0xFF1A6B9A), Color(0xFF0D3D6B), Color(0xFF061B35))),
    StoreCategory("CHAT_BUBBLE", "Chat\nFrame", "💬", "Chat Frame",
        listOf(Color(0xFF2E6B4F), Color(0xFF145C38), Color(0xFF063020))),
    StoreCategory("GIFT_SHELF", "Intimacy", "🎁", "Intimacy Gifts",
        listOf(Color(0xFF8B1A4A), Color(0xFF5C0D2E), Color(0xFF2E0616))),
    StoreCategory("INTRO_CARD", "Entry\nMessage", "💌", "Entry Message",
        listOf(Color(0xFFB05000), Color(0xFF7A3300), Color(0xFF401800))),
    StoreCategory("SPEAKING_WAVE", "Speaking\nWave", "〰️", "Speaking Wave",
        listOf(Color(0xFF006080), Color(0xFF004060), Color(0xFF001F35))),
    StoreCategory("ROOM_ENTRY", "Ride\nEntrance", "🚀", "Ride Entrance",
        listOf(Color(0xFF4B2080), Color(0xFF2D1060), Color(0xFF130530))),
    StoreCategory("PROFILE_THEME", "Profile\nTheme", "🎨", "Profile Theme",
        listOf(Color(0xFF7A1A6B), Color(0xFF4A0D40), Color(0xFF25061F))),
    StoreCategory("PROFILE_BANNER", "Profile\nBanner", "🖼️", "Profile Banner",
        listOf(Color(0xFF6B21A8), Color(0xFF4C1D95), Color(0xFF2E1065))),
    StoreCategory("NAME_STYLE", "Name\nStyle", "✨", "Name Style",
        listOf(Color(0xFF804A00), Color(0xFF5A3300), Color(0xFF2E1800))),
    StoreCategory("ROOM_AMBIENCE", "Room\nAmbience", "🎶", "Room Ambience",
        listOf(Color(0xFF1E5080), Color(0xFF0D3055), Color(0xFF041525)))
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
    "PROFILE_BANNER" to { it.profileBanner },
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
    onBack: () -> Unit,
    onOpenCustomize: () -> Unit = {}
) {
    val coroutineScope = rememberCoroutineScope()
    val viewModel: CosmeticsViewModel = hiltViewModel()

    var selectedCategoryType by remember { mutableStateOf("AVATAR_FRAME") }
    var outfitFilter by remember { mutableStateOf("All") } // "All", "Normal Outfit", "Privilege Outfit"
    var showPurchaseDialogFor by remember { mutableStateOf<ProfileCosmetic?>(null) }
    var showBonusDialog by remember { mutableStateOf(false) }
    var showDiscountDialog by remember { mutableStateOf(false) }

    LaunchedEffect(token) {
        viewModel.refresh(token)
    }

    val selectedCategory = storeCategories.firstOrNull { it.type == selectedCategoryType } ?: storeCategories.first()

    Box(modifier = Modifier.fillMaxSize()) {
        AuroraBackground(speed = 0.5f)

        Scaffold(
            topBar = {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .statusBarsPadding()
                        .padding(horizontal = 16.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    // Back button in circular pill
                    IconButton(
                        onClick = onBack,
                        modifier = Modifier
                            .size(38.dp)
                            .clip(CircleShape)
                            .background(StorePillInactiveBg)
                            .border(1.dp, StoreBorder, CircleShape)
                    ) {
                        Icon(
                            imageVector = Icons.Filled.ArrowBack,
                            contentDescription = "Back",
                            tint = StoreTextDark,
                            modifier = Modifier.size(20.dp)
                        )
                    }

                    // Centered Store Title
                    Text(
                        text = "Store",
                        color = StoreTextDark,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Black
                    )

                    // Right action icons: Discount & Wardrobe/Bag
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        IconButton(
                            onClick = { showDiscountDialog = true },
                            modifier = Modifier
                                .size(38.dp)
                                .clip(CircleShape)
                                .background(StorePillInactiveBg)
                                .border(1.dp, StoreBorder, CircleShape)
                        ) {
                            Icon(
                                imageVector = Icons.Filled.Discount,
                                contentDescription = "Discounts",
                                tint = StoreTextDark,
                                modifier = Modifier.size(19.dp)
                            )
                        }

                        IconButton(
                            onClick = onOpenCustomize,
                            modifier = Modifier
                                .size(38.dp)
                                .clip(CircleShape)
                                .background(StorePillInactiveBg)
                                .border(1.dp, StoreBorder, CircleShape)
                        ) {
                            Icon(
                                imageVector = Icons.Filled.ShoppingBag,
                                contentDescription = "My Wardrobe",
                                tint = StoreTextDark,
                                modifier = Modifier.size(19.dp)
                            )
                        }
                    }
                }
            },
            containerColor = Color.Transparent
        ) { innerPadding ->
        if (viewModel.isLoading && viewModel.catalog == null) {
            Box(Modifier.fillMaxSize().padding(innerPadding), contentAlignment = Alignment.Center) {
                LoadingState("Loading store...")
            }
        } else {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
            ) {
                Column(
                    modifier = Modifier.fillMaxSize()
                ) {
                    // Balance Row: "Balance: 💎 63 +"
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Balance: ",
                            color = StoreTextMuted,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                        Text(
                            text = "💎",
                            fontSize = 16.sp,
                            modifier = Modifier.padding(horizontal = 4.dp)
                        )
                        Text(
                            text = "${viewModel.balance}",
                            color = StoreTextDark,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Black
                        )
                        Spacer(Modifier.width(6.dp))
                        Text(
                            text = "+",
                            color = StorePrimaryPurple,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Black,
                            modifier = Modifier
                                .clip(CircleShape)
                                .clickable { showBonusDialog = true }
                                .padding(horizontal = 4.dp)
                        )
                    }

                    // Upper Horizontal Category Icon Carousel
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 6.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        items(storeCategories) { cat ->
                            val isSelected = cat.type == selectedCategoryType

                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                modifier = Modifier
                                    .width(68.dp)
                                    .clickable { selectedCategoryType = cat.type }
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(62.dp)
                                        .clip(RoundedCornerShape(16.dp))
                                        .background(
                                            if (isSelected)
                                                Brush.radialGradient(cat.gradientColors)
                                            else
                                                Brush.radialGradient(
                                                    listOf(
                                                        cat.gradientColors[0].copy(alpha = 0.5f),
                                                        cat.gradientColors[2].copy(alpha = 0.5f)
                                                    )
                                                )
                                        )
                                        .border(
                                            width = if (isSelected) 2.dp else 1.dp,
                                            color = if (isSelected) StorePrimaryPurple else StoreBorder,
                                            shape = RoundedCornerShape(16.dp)
                                        ),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = cat.iconEmoji,
                                        fontSize = 26.sp
                                    )
                                }

                                Spacer(modifier = Modifier.height(6.dp))

                                Text(
                                    text = cat.title,
                                    color = if (isSelected) StorePrimaryPurple else StoreTextDark,
                                    fontSize = 11.sp,
                                    fontWeight = if (isSelected) FontWeight.Black else FontWeight.Medium,
                                    textAlign = TextAlign.Center,
                                    lineHeight = 13.sp,
                                    maxLines = 2
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    // Subcategory Header with purple underline accent
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp)
                    ) {
                        Text(
                            text = selectedCategory.subcategoryHeading,
                            color = StoreTextDark,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Black
                        )
                        // Purple underline accent under first word
                        Box(
                            modifier = Modifier
                                .padding(top = 4.dp, start = 12.dp)
                                .width(28.dp)
                                .height(3.dp)
                                .clip(RoundedCornerShape(2.dp))
                                .background(StorePrimaryPurple)
                        )
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    // Filter Pills: "All", "Normal Outfit", "Privilege Outfit"
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        listOf("All", "Normal Outfit", "Privilege Outfit").forEach { filterName ->
                            val isActive = outfitFilter == filterName
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(50))
                                    .background(if (isActive) StorePrimaryPurple else StorePillInactiveBg)
                                    .clickable { outfitFilter = filterName }
                                    .padding(horizontal = 14.dp, vertical = 6.dp)
                            ) {
                                Text(
                                    text = filterName,
                                    color = if (isActive) Color.White else StoreTextDark,
                                    fontSize = 12.sp,
                                    fontWeight = if (isActive) FontWeight.Bold else FontWeight.Medium
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    // Filter cosmetics in category
                    val catalog = viewModel.catalog
                    val allInCategory = catalog?.cosmetics?.filter { it.type == selectedCategoryType } ?: emptyList()
                    val filteredCosmetics = when (outfitFilter) {
                        "Normal Outfit" -> allInCategory.filter { it.rarity == "COMMON" || it.rarity == "RARE" }
                        "Privilege Outfit" -> allInCategory.filter { it.rarity == "EPIC" || it.rarity == "LEGENDARY" }
                        else -> allInCategory
                    }

                    if (filteredCosmetics.isEmpty()) {
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .fillMaxWidth()
                                .padding(24.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                "No items available in this category.",
                                color = StoreTextMuted,
                                fontSize = 14.sp
                            )
                        }
                    } else {
                        // 3-COLUMN ITEM GRID (Exact match to screenshot!)
                        LazyVerticalGrid(
                            columns = GridCells.Fixed(3),
                            contentPadding = PaddingValues(start = 12.dp, end = 12.dp, bottom = 80.dp),
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            verticalArrangement = Arrangement.spacedBy(16.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            items(filteredCosmetics, key = { it.id }) { cosmetic ->
                                val isOwned = catalog?.ownedCosmeticIds?.contains(cosmetic.id) == true
                                val isActive = catalog?.let { cat ->
                                    typeActiveField[cosmetic.type]?.invoke(cat.activeCosmetics)
                                } == cosmetic.id

                                StoreGridItemCard(
                                    cosmetic = cosmetic,
                                    isOwned = isOwned,
                                    isActive = isActive,
                                    onPurchaseClick = {
                                        if (isOwned) {
                                            coroutineScope.launch {
                                                val equipId = if (isActive) "" else cosmetic.id
                                                viewModel.equip(token, equipId, cosmetic.type)
                                            }
                                        } else {
                                            showPurchaseDialogFor = cosmetic
                                        }
                                    }
                                )
                            }
                        }
                    }
                }

                // Floating "Recharge Bonus" gift box in bottom-right corner
                Box(
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .padding(end = 16.dp, bottom = 18.dp)
                        .shadow(8.dp, RoundedCornerShape(14.dp))
                        .clip(RoundedCornerShape(14.dp))
                        .background(
                            Brush.verticalGradient(
                                listOf(Color(0xFFFFD54F), Color(0xFFFF8F00))
                            )
                        )
                        .clickable { showBonusDialog = true }
                        .padding(horizontal = 10.dp, vertical = 6.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Text("🎁", fontSize = 22.sp)
                        Text(
                            "Recharge\nBonus",
                            color = Color.White,
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Black,
                            textAlign = TextAlign.Center,
                            lineHeight = 10.sp
                        )
                    }
                }
            }
        }
    }

    // Purchase Confirmation Dialog
    showPurchaseDialogFor?.let { item ->
        AlertDialog(
            onDismissRequest = { showPurchaseDialogFor = null },
            title = {
                Text("Confirm Purchase", color = StoreTextDark, fontWeight = FontWeight.Black)
            },
            text = {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Box(
                        modifier = Modifier.size(80.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        CosmeticPreviewBox(cosmetic = item, isActive = false)
                    }
                    Text(item.name, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = StoreTextDark)
                    Text("Duration: Permanent", color = StoreTextMuted, fontSize = 12.sp)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Price: 💎 ", fontSize = 15.sp)
                        Text("${item.coinPrice} Coins", fontWeight = FontWeight.Black, fontSize = 16.sp, color = StorePrimaryPurple)
                    }
                    if (viewModel.balance < item.coinPrice) {
                        Text(
                            "Insufficient balance. Top up coins first.",
                            color = Color.Red,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        coroutineScope.launch {
                            viewModel.purchase(token, item.id)
                            showPurchaseDialogFor = null
                        }
                    },
                    enabled = viewModel.balance >= item.coinPrice,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFFF7043))
                ) {
                    Text("Confirm", color = Color.White, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showPurchaseDialogFor = null }) {
                    Text("Cancel", color = StoreTextMuted)
                }
            },
            containerColor = StoreCardBg
        )
    }

    // Recharge Bonus Dialog
    if (showBonusDialog) {
        AlertDialog(
            onDismissRequest = { showBonusDialog = false },
            title = { Text("🎁 Recharge Bonus", fontWeight = FontWeight.Black, color = StoreTextDark) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Get up to 20% bonus coins on your first recharge of the week!", color = StoreTextDark, fontSize = 13.sp)
                    Text("Current Balance: 💎 ${viewModel.balance} Coins", color = StorePrimaryPurple, fontWeight = FontWeight.Bold)
                    Text("Visit Wallet to top up coins and unlock exclusive limited frames.", color = StoreTextMuted, fontSize = 12.sp)
                }
            },
            confirmButton = {
                Button(
                    onClick = { showBonusDialog = false },
                    colors = ButtonDefaults.buttonColors(containerColor = StorePrimaryPurple)
                ) {
                    Text("Got It", color = Color.White)
                }
            },
            containerColor = StoreCardBg
        )
    }

    // Discount Offers Dialog
    if (showDiscountDialog) {
        AlertDialog(
            onDismissRequest = { showDiscountDialog = false },
            title = { Text("🏷️ Special Offers & Bundles", fontWeight = FontWeight.Black, color = StoreTextDark) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Bundle deals with up to 30% savings are available in your account!", color = StoreTextDark, fontSize = 13.sp)
                    Text("• Vibe Starter Pack: 3 essential frames for 150 💎", fontSize = 12.sp, color = StoreTextMuted)
                    Text("• Neon Nights Pack: 4 animated items for 350 💎", fontSize = 12.sp, color = StoreTextMuted)
                    Text("• Royal Collection: Premium VIP cosmetics for 500 💎", fontSize = 12.sp, color = StoreTextMuted)
                }
            },
            confirmButton = {
                Button(
                    onClick = { showDiscountDialog = false },
                    colors = ButtonDefaults.buttonColors(containerColor = StorePrimaryPurple)
                ) {
                    Text("Awesome", color = Color.White)
                }
            },
            containerColor = StoreCardBg
        )
    }
    }
}

/**
 * 3-Column Item Card matching the exact visual style in the reference image:
 * - Circular frame preview
 * - Tier / Rarity shield badge on top-right (e.g. E, C, D, S)
 * - Item name truncated
 * - 💎 price
 * - Duration ("1 Day" or "Permanent")
 * - Rounded orange/gold gradient "Purchase" pill button
 */
@Composable
private fun StoreGridItemCard(
    cosmetic: ProfileCosmetic,
    isOwned: Boolean,
    isActive: Boolean,
    onPurchaseClick: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(StoreCardBg)
            .border(1.dp, StoreBorder, RoundedCornerShape(16.dp))
            .padding(vertical = 10.dp, horizontal = 6.dp)
    ) {
        // Preview area with top-right Tier Hexagon Badge
        Box(
            modifier = Modifier
                .size(76.dp)
                .padding(2.dp),
            contentAlignment = Alignment.Center
        ) {
            // Cosmetic graphic
            CosmeticPreviewBox(cosmetic = cosmetic, isActive = isActive)

            // Tier/Rarity badge in top-right corner (E, C, D, S)
            val (badgeText, badgeColor) = when (cosmetic.rarity) {
                "LEGENDARY" -> "S" to Color(0xFFFF8F00)
                "EPIC" -> "E" to Color(0xFF00B0FF)
                "RARE" -> "C" to Color(0xFFD84315)
                else -> "D" to Color(0xFF78909C)
            }

            Box(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .offset(x = 2.dp, y = (-2).dp)
                    .size(19.dp)
                    .clip(RoundedCornerShape(5.dp))
                    .background(badgeColor),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = badgeText,
                    color = Color.White,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Black
                )
            }
        }

        Spacer(modifier = Modifier.height(6.dp))

        // Item Name
        Text(
            text = cosmetic.name,
            color = StoreTextDark,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(3.dp))

        // Price Row with 💎
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            Text("💎", fontSize = 11.sp)
            Spacer(modifier = Modifier.width(3.dp))
            Text(
                text = "${cosmetic.coinPrice}",
                color = StoreTextDark,
                fontSize = 13.sp,
                fontWeight = FontWeight.Black
            )
        }

        // Validity / Duration
        Text(
            text = "1 Day",
            color = StoreTextSubtle,
            fontSize = 10.sp,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.padding(top = 1.dp, bottom = 6.dp)
        )

        // Action Pill Button (Orange/Gold gradient pill)
        val buttonGradient = when {
            isActive -> Brush.horizontalGradient(listOf(Color(0xFF6C38FF), Color(0xFF8B5CF6)))
            isOwned -> Brush.horizontalGradient(listOf(Color(0xFF10B981), Color(0xFF059669)))
            else -> Brush.horizontalGradient(listOf(Color(0xFFFFB300), Color(0xFFFF6D00)))
        }

        Box(
            modifier = Modifier
                .fillMaxWidth(0.92f)
                .height(28.dp)
                .clip(RoundedCornerShape(50))
                .background(buttonGradient)
                .clickable(onClick = onPurchaseClick),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = when {
                    isActive -> "Equipped"
                    isOwned -> "Equip"
                    else -> "Purchase"
                },
                color = Color.White,
                fontSize = 11.sp,
                fontWeight = FontWeight.Black
            )
        }
    }
}

/**
 * Reusable Cosmetic Preview Graphic with custom ring and themed visuals
 */
@Composable
fun CosmeticPreviewBox(cosmetic: ProfileCosmetic, isActive: Boolean) {
    val size = 66.dp

    Box(
        modifier = Modifier.size(size),
        contentAlignment = Alignment.Center
    ) {
        if (cosmetic.assetUrl.isNotBlank()) {
            AsyncImage(
                model = cosmetic.assetUrl,
                contentDescription = "Preview of ${cosmetic.name}",
                modifier = Modifier
                    .fillMaxSize()
                    .clip(CircleShape),
                contentScale = ContentScale.Fit
            )
        } else {
            CosmeticArtwork(
                id = cosmetic.id,
                type = cosmetic.type,
                preview = cosmetic.preview,
                modifier = Modifier.fillMaxSize(),
                animate = isActive,
                showBackdrop = true
            )
        }
    }
}
