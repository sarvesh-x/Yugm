package com.yugm.app.feature.profile.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ShoppingBag
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.yugm.app.core.model.ActiveCosmetics
import com.yugm.app.core.model.ProfileCosmetic
import com.yugm.app.core.ui.components.Avatar
import com.yugm.app.core.ui.components.GlassCard
import com.yugm.app.core.ui.components.LoadingState
import com.yugm.app.core.ui.components.YugmPageHeader
import com.yugm.app.core.ui.cosmetics.StyledName
import com.yugm.app.core.ui.cosmetics.profileThemeColors
import com.yugm.app.core.ui.cosmetics.profileBannerColors
import com.yugm.app.core.ui.theme.*
import com.yugm.app.feature.profile.viewmodel.CosmeticsViewModel
import com.yugm.app.feature.profile.viewmodel.ProfileViewModel
import kotlinx.coroutines.launch

private val customizeCategoryTabs = listOf(
    "AVATAR_FRAME" to "Frames",
    "PROFILE_THEME" to "Themes",
    "PROFILE_BANNER" to "Banners",
    "PROFILE_BADGE" to "Badges",
    "SPEAKING_WAVE" to "Waves",
    "CHAT_BUBBLE" to "Chat Bubbles",
    "NAME_STYLE" to "Name Styles",
    "ENTRANCE_EFFECT" to "Entrances",
    "ROOM_ENTRY" to "Room Entry",
    "MOOD_STATUS" to "Moods",
    "COLLECTIBLE_TITLE" to "Titles",
    "AVATAR_DECORATION" to "Decorations",
    "ROOM_THEME" to "Room Themes",
    "ROOM_AMBIENCE" to "Ambience",
    "CALL_SCREEN" to "Call Screens"
)

private val typeActiveExtractor: Map<String, (ActiveCosmetics) -> String> = mapOf(
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
fun CustomizeProfileScreen(
    token: String,
    userId: String,
    onBack: () -> Unit,
    onOpenStore: () -> Unit = {},
    onOpenPublicProfile: () -> Unit = {}
) {
    val coroutineScope = rememberCoroutineScope()
    val cosmeticsVm: CosmeticsViewModel = hiltViewModel()
    val profileVm: ProfileViewModel = hiltViewModel()
    var selectedCategory by remember { mutableStateOf("AVATAR_FRAME") }

    LaunchedEffect(token, userId) {
        cosmeticsVm.refresh(token)
        if (userId.isNotBlank()) {
            profileVm.loadProfile(token, userId)
        }
    }

    val catalog = cosmeticsVm.catalog
    val activeCosmetics = catalog?.activeCosmetics ?: ActiveCosmetics()
    val userProfile = profileVm.profile

    Scaffold(
        topBar = {
            YugmPageHeader(
                title = "Customize Profile",
                onBack = onBack,
                trailing = {
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        IconButton(onClick = onOpenPublicProfile) {
                            Icon(Icons.Filled.Visibility, contentDescription = "View public profile", tint = Gold)
                        }
                        IconButton(onClick = onOpenStore) {
                            Icon(Icons.Filled.ShoppingBag, contentDescription = "Cosmetics store", tint = TextPrimary)
                        }
                    }
                }
            )
        },
        containerColor = Background
    ) { innerPadding ->
        if (cosmeticsVm.isLoading && catalog == null) {
            Box(Modifier.fillMaxSize().padding(innerPadding), contentAlignment = Alignment.Center) {
                LoadingState("Opening wardrobe...")
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
            ) {
                // Live Interactive Avatar & Profile Preview Box
                LiveCustomizationPreview(
                    name = userProfile?.name ?: "You",
                    avatarUrl = userProfile?.avatar.orEmpty(),
                    activeCosmetics = activeCosmetics,
                    onViewPublicProfile = onOpenPublicProfile
                )

                cosmeticsVm.error?.let { err ->
                    Text(
                        text = err,
                        color = DangerRed,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(horizontal = 20.dp, vertical = 4.dp)
                    )
                }

                // Category Tabs
                PrimaryScrollableTabRow(
                    selectedTabIndex = customizeCategoryTabs.indexOfFirst { it.first == selectedCategory }.coerceAtLeast(0),
                    containerColor = Background,
                    contentColor = Gold,
                    edgePadding = 16.dp,
                    modifier = Modifier.padding(vertical = 4.dp)
                ) {
                    customizeCategoryTabs.forEach { (catType, catLabel) ->
                        Tab(
                            selected = selectedCategory == catType,
                            onClick = { selectedCategory = catType },
                            text = { Text(catLabel, fontWeight = FontWeight.Bold, fontSize = 13.sp) },
                            selectedContentColor = Gold,
                            unselectedContentColor = TextMuted
                        )
                    }
                }

                // Owned wearable items in selected category
                val ownedCosmeticIds = catalog?.ownedCosmeticIds ?: emptyList()
                val ownedInCategory = catalog?.cosmetics?.filter { item ->
                    item.type == selectedCategory && ownedCosmeticIds.contains(item.id)
                } ?: emptyList()

                val currentlyEquippedId = typeActiveExtractor[selectedCategory]?.invoke(activeCosmetics).orEmpty()

                if (ownedInCategory.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth()
                            .padding(24.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Text(
                                "No items owned in this category yet.",
                                color = TextMuted,
                                fontSize = 14.sp,
                                textAlign = TextAlign.Center
                            )
                            Button(
                                onClick = onOpenStore,
                                colors = ButtonDefaults.buttonColors(containerColor = PrimaryPurple),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Text("ðŸ›ï¸ Browse Store", color = Color.White, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                } else {
                    LazyVerticalGrid(
                        columns = GridCells.Fixed(2),
                        contentPadding = PaddingValues(16.dp),
                        horizontalArrangement = Arrangement.spacedBy(14.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        items(ownedInCategory, key = { it.id }) { item ->
                            val isEquipped = item.id == currentlyEquippedId

                            WearableCosmeticCard(
                                cosmetic = item,
                                isEquipped = isEquipped,
                                onEquip = {
                                    coroutineScope.launch {
                                        cosmeticsVm.equip(token, item.id, item.type)
                                    }
                                },
                                onUnequip = {
                                    coroutineScope.launch {
                                        cosmeticsVm.equip(token, "", item.type)
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
private fun LiveCustomizationPreview(
    name: String,
    avatarUrl: String,
    activeCosmetics: ActiveCosmetics,
    onViewPublicProfile: () -> Unit
) {
    val themeColors = profileThemeColors(activeCosmetics.profileTheme)
    val bannerColors = profileBannerColors(activeCosmetics.profileBanner)

    GlassCard(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(Brush.linearGradient(themeColors))
                .border(1.dp, PrimaryPurple.copy(alpha = 0.5f), RoundedCornerShape(16.dp))
        ) {
            Column(modifier = Modifier.fillMaxWidth()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(64.dp)
                        .background(Brush.horizontalGradient(bannerColors))
                        .padding(horizontal = 14.dp, vertical = 8.dp)
                ) {
                    Text("PROFILE BANNER", color = Gold, fontSize = 10.sp, fontWeight = FontWeight.Black)
                }

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("LIVE WARDROBE PREVIEW", color = Gold, fontSize = 11.sp, fontWeight = FontWeight.Black)
                        Button(
                            onClick = onViewPublicProfile,
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0x33FFFFFF)),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.height(30.dp)
                        ) {
                            Text("👁 View Public Profile", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        Avatar(
                            initial = name.firstOrNull()?.toString() ?: "Y",
                            size = 72,
                            imageUrl = avatarUrl,
                            cosmetics = activeCosmetics
                        )

                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            StyledName(
                                text = name,
                                nameStyle = activeCosmetics.nameStyle,
                                fontSize = 18,
                                maxLines = 1
                            )

                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                                if (activeCosmetics.avatarFrame.isNotBlank()) {
                                    PreviewMiniBadge("Frame: ${activeCosmetics.avatarFrame.substringAfterLast('_')}")
                                }
                                if (activeCosmetics.profileBadge.isNotBlank()) {
                                    PreviewMiniBadge("Badge: ${activeCosmetics.profileBadge.substringAfterLast('_')}")
                                }
                            }

                            if (activeCosmetics.profileBanner.isNotBlank()) {
                                PreviewMiniBadge("Banner: ${activeCosmetics.profileBanner.substringAfterLast('_')}")
                            }

                            if (activeCosmetics.speakingWave.isNotBlank()) {
                                Text(
                                    "Wave: ${activeCosmetics.speakingWave.substringAfterLast('_')}",
                                    color = TextMuted,
                                    fontSize = 10.sp
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
@Composable
private fun PreviewMiniBadge(text: String) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(Color.Black.copy(alpha = 0.4f))
            .border(1.dp, Color.White.copy(alpha = 0.2f), RoundedCornerShape(6.dp))
            .padding(horizontal = 6.dp, vertical = 2.dp)
    ) {
        Text(text, color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun WearableCosmeticCard(
    cosmetic: ProfileCosmetic,
    isEquipped: Boolean,
    onEquip: () -> Unit,
    onUnequip: () -> Unit
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = SurfaceElevated),
        border = BorderStroke(1.5.dp, if (isEquipped) Gold else Color(0x22FFFFFF)),
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            CosmeticPreviewBox(cosmetic = cosmetic, isActive = isEquipped)

            Text(
                text = cosmetic.name,
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 13.sp,
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
                fontSize = 10.sp,
                fontWeight = FontWeight.Black
            )

            if (isEquipped) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Button(
                        onClick = onUnequip,
                        colors = ButtonDefaults.buttonColors(containerColor = DangerRed.copy(alpha = 0.25f)),
                        border = BorderStroke(1.dp, DangerRed),
                        shape = RoundedCornerShape(8.dp),
                        contentPadding = PaddingValues(horizontal = 4.dp),
                        modifier = Modifier.weight(1f).height(38.dp)
                    ) {
                        Text("Remove", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .height(38.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(Gold.copy(alpha = 0.2f))
                            .border(1.dp, Gold, RoundedCornerShape(8.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("Active", color = Gold, fontSize = 11.sp, fontWeight = FontWeight.Black)
                    }
                }
            } else {
                Button(
                    onClick = onEquip,
                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryPurple),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.fillMaxWidth().height(38.dp)
                ) {
                    Text("Apply", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Black)
                }
            }
        }
    }
}
