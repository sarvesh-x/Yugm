package com.example.yugm.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
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
import androidx.compose.ui.unit.sp
import com.example.yugm.api.YugmApi
import com.example.yugm.model.CosmeticCatalog
import com.example.yugm.model.ProfileCosmetic
import com.example.yugm.ui.components.Avatar
import com.example.yugm.ui.components.GlassCard
import com.example.yugm.ui.components.LoadingState
import com.example.yugm.ui.theme.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CosmeticsStoreScreen(
    token: String,
    onBack: () -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    var catalog by remember { mutableStateOf<CosmeticCatalog?>(null) }
    var balance by remember { mutableStateOf(0) }
    var isLoading by remember { mutableStateOf(true) }
    var activeTab by remember { mutableStateOf("AVATAR_FRAME") }

    val tabs = listOf(
        "AVATAR_FRAME" to "Frames",
        "SPEAKING_WAVE" to "Waves",
        "CHAT_BUBBLE" to "Bubbles",
        "ENTRANCE_EFFECT" to "Entrances"
    )

    fun refreshCatalog() {
        isLoading = true
        coroutineScope.launch {
            runCatching { YugmApi.cosmetics(token) }.onSuccess { catalog = it }
            runCatching { YugmApi.wallet(token) }.onSuccess { balance = it }
            isLoading = false
        }
    }

    LaunchedEffect(token) {
        refreshCatalog()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Cosmetics Store", color = Color.White, fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    TextButton(onClick = onBack) {
                        Text("Back", color = Gold, fontWeight = FontWeight.Bold)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Background)
            )
        },
        containerColor = Background
    ) { innerPadding ->
        if (isLoading) {
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
                            Text("$balance Coins", color = Gold, fontSize = 22.sp, fontWeight = FontWeight.Black)
                        }
                    }
                }

                // Category Tabs
                TabRow(
                    selectedTabIndex = tabs.indexOfFirst { it.first == activeTab },
                    containerColor = Background,
                    contentColor = Gold,
                    modifier = Modifier.padding(bottom = 12.dp)
                ) {
                    tabs.forEach { (type, label) ->
                        Tab(
                            selected = activeTab == type,
                            onClick = { activeTab = type },
                            text = { Text(label, fontWeight = FontWeight.Bold) }
                        )
                    }
                }

                val currentCosmetics = catalog?.cosmetics?.filter { it.type == activeTab } ?: emptyList()

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
                            val isOwned = catalog?.ownedCosmeticIds?.contains(cosmetic.id) == true
                            val isActive = when (cosmetic.type) {
                                "AVATAR_FRAME" -> catalog?.activeCosmetics?.avatarFrame == cosmetic.id
                                "SPEAKING_WAVE" -> catalog?.activeCosmetics?.speakingWave == cosmetic.id
                                "CHAT_BUBBLE" -> catalog?.activeCosmetics?.chatBubble == cosmetic.id
                                "ENTRANCE_EFFECT" -> catalog?.activeCosmetics?.entranceEffect == cosmetic.id
                                else -> false
                            }

                            CosmeticCard(
                                cosmetic = cosmetic,
                                isOwned = isOwned,
                                isActive = isActive,
                                onAction = {
                                    coroutineScope.launch {
                                        if (isOwned) {
                                            // Equip or Unequip
                                            val equipId = if (isActive) null else cosmetic.id
                                            runCatching {
                                                YugmApi.equipCosmetic(token, equipId ?: "", cosmetic.type)
                                            }.onSuccess {
                                                refreshCatalog()
                                            }
                                        } else {
                                            // Purchase
                                            if (balance >= cosmetic.coinPrice) {
                                                runCatching {
                                                    YugmApi.purchaseCosmetic(token, cosmetic.id)
                                                }.onSuccess {
                                                    refreshCatalog()
                                                }
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
            // Visual Demo Avatar
            Box(
                modifier = Modifier
                    .size(64.dp)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.08f)),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = when (cosmetic.type) {
                        "AVATAR_FRAME" -> "🖼️"
                        "SPEAKING_WAVE" -> "🔊"
                        "CHAT_BUBBLE" -> "💬"
                        "ENTRANCE_EFFECT" -> "✨"
                        else -> "✨"
                    },
                    fontSize = 24.sp
                )
            }

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
