package com.yugm.app.feature.gift.screens

import com.yugm.app.core.api.SyncTopic
import com.yugm.app.core.ui.components.AutomaticSyncEffect
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.yugm.app.core.model.InventoryItem
import com.yugm.app.core.api.YugmApi
import com.yugm.app.core.ui.theme.LocalYugmColors
import com.yugm.app.feature.gift.viewmodel.GiftViewModel
import kotlinx.coroutines.launch

private enum class InventoryFilter { ALL, TRADABLE, UPGRADEABLE }
private enum class InventoryTab { GIFTS, COSMETICS, BADGES }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InventoryScreen(
    token: String,
    onBack: () -> Unit,
    viewModel: GiftViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsState()
    val colors = LocalYugmColors.current
    var upgradeTarget by remember { mutableStateOf<InventoryItem?>(null) }
    var query by remember { mutableStateOf("") }
    var filter by remember { mutableStateOf(InventoryFilter.ALL) }
    var tab by remember { mutableStateOf(InventoryTab.GIFTS) }
    val scope = rememberCoroutineScope()

    AutomaticSyncEffect(token, topics = setOf(SyncTopic.GIFTS), enabled = token.isNotBlank(), isBusy = { state.isLoading }) { viewModel.loadInventory(token) }

    val visibleItems = state.inventory.filter { item ->
        val matchesQuery = query.isBlank() || item.gift?.name?.contains(query.trim(), ignoreCase = true) == true
        val matchesFilter = when (filter) {
            InventoryFilter.ALL -> true
            InventoryFilter.TRADABLE -> item.tradable
            InventoryFilter.UPGRADEABLE -> item.gift?.upgradeable == true
        }
        matchesQuery && matchesFilter
    }
    val totalCopies = state.inventory.sumOf { it.quantity }
    val tradableCount = state.inventory.count { it.tradable }
    val upgradeableCount = state.inventory.count { it.gift?.upgradeable == true }

    val full = state.fullInventory
    val giftsCount = full?.summary?.totalGifts ?: totalCopies

    Scaffold(
        containerColor = colors.background,
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            "Gift inventory",
                            fontWeight = FontWeight.Black,
                            fontSize = 22.sp,
                            color = colors.textPrimary
                        )
                        Text(
                            "Your collection",
                            color = colors.textSecondary,
                            fontSize = 13.sp
                        )
                    }
                },
                navigationIcon = {
                    TextButton(onClick = onBack) {
                        Text("‹", color = colors.textPrimary, fontSize = 28.sp)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = colors.background)
            )
        }
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            Column(Modifier.padding(horizontal = 18.dp)) {
                // Top Banner Card
                val bannerGradient = Brush.horizontalGradient(
                    colors = if (colors.isDark) {
                        listOf(Color(0xFF2A1635), Color(0xFF1E1430), Color(0xFF171A2C))
                    } else {
                        listOf(Color(0xFFFDE8F2), Color(0xFFEFE8FF), Color(0xFFF8E6FA))
                    }
                )
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(24.dp))
                        .background(bannerGradient)
                        .border(1.dp, colors.border, RoundedCornerShape(24.dp))
                        .padding(20.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                "Your collection",
                                color = colors.textPrimary,
                                fontWeight = FontWeight.Bold,
                                fontSize = 18.sp
                            )
                            Spacer(Modifier.height(4.dp))
                            Text(
                                "$giftsCount gifts · ${full?.cosmetics?.size ?: 0} cosmetics · ${full?.badges?.size ?: 0} badges",
                                color = colors.textSecondary,
                                fontSize = 13.sp
                            )
                        }
                        Box(
                            modifier = Modifier
                                .size(64.dp)
                                .clip(RoundedCornerShape(20.dp))
                                .background(colors.primary.copy(alpha = 0.15f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("🎁✨", fontSize = 28.sp)
                        }
                    }
                }

                Spacer(Modifier.height(16.dp))

                // Category Tabs
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    InventoryCategoryTab(
                        label = "Gifts",
                        count = giftsCount.toString(),
                        selected = tab == InventoryTab.GIFTS,
                        onClick = { tab = InventoryTab.GIFTS }
                    )
                    InventoryCategoryTab(
                        label = "Cosmetics",
                        count = (full?.cosmetics?.size ?: 0).toString(),
                        selected = tab == InventoryTab.COSMETICS,
                        onClick = { tab = InventoryTab.COSMETICS }
                    )
                    InventoryCategoryTab(
                        label = "Badges",
                        count = (full?.badges?.size ?: 0).toString(),
                        selected = tab == InventoryTab.BADGES,
                        onClick = { tab = InventoryTab.BADGES }
                    )
                }

                if (tab == InventoryTab.GIFTS) {
                    Spacer(Modifier.height(12.dp))
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        InventorySubFilterChip("All", filter == InventoryFilter.ALL, state.inventory.size.toString()) { filter = InventoryFilter.ALL }
                        InventorySubFilterChip("Tradable", filter == InventoryFilter.TRADABLE, tradableCount.toString()) { filter = InventoryFilter.TRADABLE }
                        InventorySubFilterChip("Upgrade", filter == InventoryFilter.UPGRADEABLE, upgradeableCount.toString()) { filter = InventoryFilter.UPGRADEABLE }
                    }
                    Spacer(Modifier.height(12.dp))
                    OutlinedTextField(
                        value = query,
                        onValueChange = { query = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("Find a gift", color = colors.textSecondary) },
                        leadingIcon = {
                            Text("⌕", color = colors.textSecondary, fontSize = 24.sp)
                        },
                        singleLine = true,
                        shape = RoundedCornerShape(24.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = colors.surface,
                            unfocusedContainerColor = colors.surface,
                            disabledContainerColor = colors.surface,
                            focusedBorderColor = colors.primary.copy(alpha = 0.5f),
                            unfocusedBorderColor = colors.border
                        )
                    )
                }
            }

            Spacer(Modifier.height(8.dp))

            if (tab == InventoryTab.GIFTS) {
                when {
                    state.isLoading && state.inventory.isEmpty() -> {
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator(color = colors.primary)
                        }
                    }
                    state.error != null && state.inventory.isEmpty() -> {
                        Column(
                            Modifier
                                .fillMaxWidth()
                                .padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text("Couldn't load your gifts", color = colors.textPrimary, fontWeight = FontWeight.Bold)
                            Text(state.error.orEmpty(), color = colors.textSecondary, fontSize = 13.sp, modifier = Modifier.padding(top = 6.dp))
                            TextButton(onClick = { viewModel.loadInventory(token) }) {
                                Text("Try again", color = colors.primary)
                            }
                        }
                    }
                    visibleItems.isEmpty() -> {
                        Column(
                            Modifier
                                .fillMaxWidth()
                                .padding(34.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(
                                if (query.isBlank()) "No gifts in this view" else "No gifts match your search",
                                color = colors.textPrimary,
                                fontWeight = FontWeight.SemiBold
                            )
                            Text(
                                "Change the filter or try another name.",
                                color = colors.textSecondary,
                                fontSize = 13.sp,
                                modifier = Modifier.padding(top = 5.dp)
                            )
                        }
                    }
                    else -> {
                        LazyColumn(
                            contentPadding = PaddingValues(horizontal = 18.dp, vertical = 10.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            items(visibleItems, key = { it.id }) { item ->
                                val gift = item.gift
                                Surface(
                                    modifier = Modifier.fillMaxWidth(),
                                    color = colors.surface,
                                    shape = RoundedCornerShape(20.dp),
                                    border = BorderStroke(1.dp, colors.border)
                                ) {
                                    Row(
                                        Modifier.padding(16.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Box(
                                            modifier = Modifier
                                                .size(56.dp)
                                                .clip(RoundedCornerShape(16.dp))
                                                .background(colors.primary.copy(alpha = 0.1f)),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Text(
                                                gift?.icon?.takeIf { it.isNotBlank() } ?: "🎁",
                                                fontSize = 26.sp
                                            )
                                        }
                                        Column(
                                            modifier = Modifier
                                                .weight(1f)
                                                .padding(horizontal = 12.dp)
                                        ) {
                                            Text(
                                                gift?.name ?: "Unknown gift",
                                                color = colors.textPrimary,
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 16.sp
                                            )
                                            Spacer(Modifier.height(2.dp))
                                            Text(
                                                "${item.quantity} ${if (item.quantity == 1) "copy" else "copies"} · ${item.source.replace('_', ' ').lowercase()}",
                                                color = colors.textSecondary,
                                                fontSize = 13.sp
                                            )
                                            Spacer(Modifier.height(8.dp))
                                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                                InventoryTag(
                                                    if (item.tradable) "Tradable" else "Collection",
                                                    if (item.tradable) colors.success else colors.textSecondary
                                                )
                                                if (gift?.upgradeable == true) {
                                                    InventoryTag("Upgradeable", colors.secondary)
                                                }
                                            }
                                        }
                                        Column(
                                            horizontalAlignment = Alignment.End
                                        ) {
                                            Row(
                                                verticalAlignment = Alignment.CenterVertically,
                                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                                            ) {
                                                Text("🪙", fontSize = 13.sp)
                                                Text(
                                                    "${gift?.coinPrice ?: 0} coins",
                                                    color = colors.primary,
                                                    fontWeight = FontWeight.Bold,
                                                    fontSize = 13.sp
                                                )
                                            }
                                            if (gift?.upgradeable == true) {
                                                Spacer(Modifier.height(6.dp))
                                                Button(
                                                    onClick = { upgradeTarget = item },
                                                    enabled = !state.isLoading,
                                                    shape = CircleShape,
                                                    colors = ButtonDefaults.buttonColors(containerColor = colors.primary.copy(alpha = 0.15f)),
                                                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp)
                                                ) {
                                                    Text("Upgrade", color = colors.primary, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            } else {
                when (tab) {
                    InventoryTab.COSMETICS -> {
                        val cosmetics = state.fullInventory?.cosmetics.orEmpty()
                        if (cosmetics.isEmpty()) {
                            InventoryEmpty("No cosmetics yet", "Cosmetics you collect will appear here.")
                        } else {
                            LazyColumn(
                                contentPadding = PaddingValues(horizontal = 18.dp, vertical = 10.dp),
                                verticalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                items(cosmetics, key = { it.id }) { cosmetic ->
                                    Surface(
                                        modifier = Modifier.fillMaxWidth(),
                                        color = colors.surface,
                                        shape = RoundedCornerShape(20.dp),
                                        border = BorderStroke(1.dp, colors.border)
                                    ) {
                                        Row(
                                            Modifier.padding(16.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Box(
                                                modifier = Modifier
                                                    .size(56.dp)
                                                    .clip(RoundedCornerShape(16.dp))
                                                    .background(colors.primary.copy(alpha = 0.1f)),
                                                contentAlignment = Alignment.Center
                                            ) {
                                                Text("✦", color = colors.primary, fontSize = 26.sp)
                                            }
                                            Column(
                                                modifier = Modifier
                                                    .weight(1f)
                                                    .padding(horizontal = 12.dp)
                                            ) {
                                                Text(
                                                    cosmetic.name,
                                                    color = colors.textPrimary,
                                                    fontWeight = FontWeight.Bold,
                                                    fontSize = 16.sp
                                                )
                                                Spacer(Modifier.height(2.dp))
                                                Text(
                                                    cosmetic.type.replace('_', ' ').uppercase(),
                                                    color = colors.textSecondary,
                                                    fontSize = 12.sp,
                                                    fontWeight = FontWeight.Medium
                                                )
                                                Spacer(Modifier.height(8.dp))
                                                InventoryTag(
                                                    cosmetic.rarity.lowercase().replaceFirstChar { it.uppercase() },
                                                    if (cosmetic.rarity.equals("legendary", true)) colors.secondary else colors.textSecondary
                                                )
                                            }
                                            Button(
                                                onClick = {
                                                    scope.launch {
                                                        runCatching {
                                                            YugmApi.equipCosmetic(
                                                                token,
                                                                if (cosmetic.isEquipped) "" else cosmetic.id,
                                                                cosmetic.type
                                                            )
                                                        }
                                                        viewModel.loadInventory(token)
                                                    }
                                                },
                                                shape = CircleShape,
                                                colors = ButtonDefaults.buttonColors(
                                                    containerColor = if (cosmetic.isEquipped) colors.success.copy(alpha = 0.15f) else colors.primary.copy(alpha = 0.15f)
                                                ),
                                                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 6.dp)
                                            ) {
                                                if (cosmetic.isEquipped) {
                                                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                                        Text("✓", color = colors.success, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                                        Text("Equipped", color = colors.success, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                                    }
                                                } else {
                                                    Text("Equip", color = colors.primary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    InventoryTab.BADGES -> {
                        val badges = state.fullInventory?.badges.orEmpty()
                        if (badges.isEmpty()) {
                            InventoryEmpty("No badges yet", "Earn achievements to add badges to your collection.")
                        } else {
                            LazyColumn(
                                contentPadding = PaddingValues(horizontal = 18.dp, vertical = 10.dp),
                                verticalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                items(badges, key = { "${it.achievementId}-${it.tier}" }) { badge ->
                                    Surface(
                                        modifier = Modifier.fillMaxWidth(),
                                        color = colors.surface,
                                        shape = RoundedCornerShape(20.dp),
                                        border = BorderStroke(1.dp, colors.border)
                                    ) {
                                        Row(
                                            Modifier.padding(16.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Box(
                                                modifier = Modifier
                                                    .size(56.dp)
                                                    .clip(CircleShape)
                                                    .background(colors.primary.copy(alpha = 0.1f)),
                                                contentAlignment = Alignment.Center
                                            ) {
                                                Text(badge.icon, fontSize = 26.sp)
                                            }
                                            Column(
                                                modifier = Modifier
                                                    .weight(1f)
                                                    .padding(horizontal = 12.dp)
                                            ) {
                                                Text(
                                                    badge.title,
                                                    color = colors.textPrimary,
                                                    fontWeight = FontWeight.Bold,
                                                    fontSize = 16.sp
                                                )
                                                Spacer(Modifier.height(2.dp))
                                                Text(
                                                    "PROFILE BADGE",
                                                    color = colors.textSecondary,
                                                    fontSize = 12.sp,
                                                    fontWeight = FontWeight.Medium
                                                )
                                                Spacer(Modifier.height(8.dp))
                                                InventoryTag(
                                                    badge.tier.lowercase().replaceFirstChar { it.uppercase() },
                                                    colors.primary
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    InventoryTab.GIFTS -> Unit
                }
            }
        }
    }

    upgradeTarget?.let { item ->
        val gift = item.gift
        AlertDialog(
            onDismissRequest = { upgradeTarget = null },
            title = { Text("Upgrade ${gift?.name ?: "gift"}?", color = colors.textPrimary, fontWeight = FontWeight.Bold) },
            text = { Text("This spends ${item.upgradeCost.takeIf { it > 0 } ?: (gift?.coinPrice?.times(3)?.div(2) ?: 0)} coins and upgrades one copy in your inventory.", color = colors.textSecondary) },
            confirmButton = {
                Button(
                    onClick = { viewModel.upgradeGift(token, item.id); upgradeTarget = null },
                    colors = ButtonDefaults.buttonColors(containerColor = colors.primary)
                ) { Text("Upgrade", color = colors.primaryOn) }
            },
            dismissButton = { TextButton(onClick = { upgradeTarget = null }) { Text("Cancel", color = colors.textSecondary) } },
            containerColor = colors.surface
        )
    }

    state.upgradeResult?.let { result ->
        AlertDialog(
            onDismissRequest = viewModel::clearUpgradeResult,
            title = { Text("Gift upgraded", color = colors.textPrimary, fontWeight = FontWeight.Bold) },
            text = { Text("${result.fromGift?.name ?: "Gift"} became ${result.upgradedGift?.name ?: "a new gift"}.", color = colors.textSecondary) },
            confirmButton = { TextButton(onClick = viewModel::clearUpgradeResult) { Text("Done", color = colors.primary) } },
            containerColor = colors.surface
        )
    }
}

@Composable
private fun InventoryEmpty(title: String, detail: String) {
    val colors = LocalYugmColors.current
    Column(
        Modifier
            .fillMaxWidth()
            .padding(36.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(title, color = colors.textPrimary, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
        Text(detail, color = colors.textSecondary, fontSize = 13.sp, modifier = Modifier.padding(top = 6.dp))
    }
}

@Composable
private fun InventoryCategoryTab(
    label: String,
    count: String,
    selected: Boolean,
    onClick: () -> Unit
) {
    val colors = LocalYugmColors.current
    val gradient = Brush.horizontalGradient(listOf(Color(0xFFF6378B), Color(0xFF8D35F6)))

    Surface(
        onClick = onClick,
        shape = CircleShape,
        color = Color.Transparent,
        modifier = Modifier.background(
            brush = if (selected) gradient else Brush.linearGradient(listOf(colors.surface, colors.surface)),
            shape = CircleShape
        ),
        border = if (selected) null else BorderStroke(1.dp, colors.border)
    ) {
        Row(
            Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                label,
                color = if (selected) Color.White else colors.textPrimary,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold
            )
            Text(
                count,
                color = if (selected) Color.White.copy(alpha = 0.8f) else colors.textSecondary,
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium
            )
        }
    }
}

@Composable
private fun InventorySubFilterChip(
    label: String,
    selected: Boolean,
    count: String,
    onClick: () -> Unit
) {
    val colors = LocalYugmColors.current
    Surface(
        onClick = onClick,
        shape = CircleShape,
        color = if (selected) colors.primary.copy(alpha = 0.15f) else colors.surface,
        border = BorderStroke(1.dp, if (selected) colors.primary.copy(alpha = 0.5f) else colors.border)
    ) {
        Row(
            Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                label,
                color = if (selected) colors.primary else colors.textSecondary,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold
            )
            Text(
                count,
                color = if (selected) colors.primary else colors.textSecondary,
                fontSize = 11.sp
            )
        }
    }
}

@Composable
private fun InventoryTag(label: String, tint: Color) {
    Text(
        text = label,
        color = tint,
        fontSize = 11.sp,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier
            .clip(CircleShape)
            .background(tint.copy(alpha = 0.12f))
            .padding(horizontal = 10.dp, vertical = 4.dp)
    )
}
