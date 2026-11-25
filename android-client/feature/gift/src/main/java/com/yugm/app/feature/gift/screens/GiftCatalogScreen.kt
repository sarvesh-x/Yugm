package com.yugm.app.feature.gift.screens

import com.yugm.app.core.api.SyncTopic
import com.yugm.app.core.ui.components.AutomaticSyncEffect
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.yugm.app.feature.gift.viewmodel.GiftViewModel
import com.yugm.app.core.ui.components.YugmLoadingSpinner
import com.yugm.app.core.ui.components.YugmTopBar

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GiftCatalogScreen(
    token: String,
    onBack: () -> Unit,
    viewModel: GiftViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsState()

    AutomaticSyncEffect(token, topics = setOf(SyncTopic.GIFTS), enabled = token.isNotBlank(), isBusy = { state.isLoading }) {
        viewModel.loadGifts(token, state.selectedCategory, state.selectedRarity, state.currentPage)
        viewModel.loadCollections(token)
    }

    val categories = listOf(null, "normal", "premium", "limited", "seasonal", "space", "dragon", "luxury")
    val rarities = listOf(null, "common", "rare", "epic", "legendary", "mythic")

    var showCategoryDropdown by remember { mutableStateOf(false) }
    var showRarityDropdown by remember { mutableStateOf(false) }
    var pendingBoxTier by remember { mutableStateOf<String?>(null) }
    var pendingGift by remember { mutableStateOf<com.yugm.app.core.model.GiftV2?>(null) }
    val boxPrices = mapOf("basic" to 500, "premium" to 2000, "luxury" to 10000)

    Scaffold(
        topBar = {
            YugmTopBar(
                title = "Gift Catalog",
                onBack = onBack,
            )
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                ExposedDropdownMenuBox(
                    expanded = showCategoryDropdown,
                    onExpandedChange = { showCategoryDropdown = it },
                    modifier = Modifier.weight(1f)
                ) {
                    OutlinedTextField(
                        value = state.selectedCategory ?: "All Categories",
                        onValueChange = {},
                        readOnly = true,
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = showCategoryDropdown) },
                        modifier = Modifier.menuAnchor(ExposedDropdownMenuAnchorType.PrimaryNotEditable)
                    )
                    ExposedDropdownMenu(
                        expanded = showCategoryDropdown,
                        onDismissRequest = { showCategoryDropdown = false }
                    ) {
                        categories.forEach { cat ->
                            DropdownMenuItem(
                                text = { Text(cat ?: "All") },
                                onClick = {
                                    showCategoryDropdown = false
                                    viewModel.loadGifts(token, cat, state.selectedRarity)
                                }
                            )
                        }
                    }
                }

                ExposedDropdownMenuBox(
                    expanded = showRarityDropdown,
                    onExpandedChange = { showRarityDropdown = it },
                    modifier = Modifier.weight(1f)
                ) {
                    OutlinedTextField(
                        value = state.selectedRarity ?: "All Rarities",
                        onValueChange = {},
                        readOnly = true,
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = showRarityDropdown) },
                        modifier = Modifier.menuAnchor(ExposedDropdownMenuAnchorType.PrimaryNotEditable)
                    )
                    ExposedDropdownMenu(
                        expanded = showRarityDropdown,
                        onDismissRequest = { showRarityDropdown = false }
                    ) {
                        rarities.forEach { rare ->
                            DropdownMenuItem(
                                text = { Text(rare ?: "All") },
                                onClick = {
                                    showRarityDropdown = false
                                    viewModel.loadGifts(token, state.selectedCategory, rare)
                                }
                            )
                        }
                    }
                }
            }

            Spacer(Modifier.height(8.dp))

            if (state.collections.isNotEmpty()) {
                Text("Gift collections", fontSize = 14.sp, fontWeight = FontWeight.Bold)
                LazyRow(
                    modifier = Modifier.fillMaxWidth().height(72.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    contentPadding = PaddingValues(vertical = 6.dp)
                ) {
                    items(state.collections) { collection ->
                        Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF2C1B3E))) {
                            Column(Modifier.widthIn(min = 132.dp).padding(horizontal = 12.dp, vertical = 8.dp)) {
                                Text(collection.name, fontSize = 12.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                                Text("${collection.gifts.size} gifts · ${collection.bonus.description.ifBlank { "Complete the set" }}", fontSize = 10.sp, color = Color(0xFFBEB3CC), maxLines = 1)
                            }
                        }
                    }
                }
                Spacer(Modifier.height(6.dp))
            }

            Text("Surprise boxes", fontSize = 14.sp, fontWeight = FontWeight.Bold)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                boxPrices.forEach { (tier, price) ->
                    OutlinedButton(
                        onClick = { pendingBoxTier = tier },
                        enabled = !state.isLoading,
                        modifier = Modifier.weight(1f)
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(tier.replaceFirstChar { it.uppercase() }, fontSize = 11.sp, maxLines = 1)
                            Text("$price coins", fontSize = 9.sp, maxLines = 1)
                        }
                    }
                }
            }
            Spacer(Modifier.height(8.dp))

            if (state.isLoading) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    YugmLoadingSpinner(size = 40.dp)
                }
            } else if (state.error != null) {
                Text("Error: ${state.error}", color = MaterialTheme.colorScheme.error)
            } else {
                Text("${state.giftTotal} gifts", fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(8.dp))

                LazyVerticalGrid(
                    modifier = Modifier.weight(1f),
                    columns = GridCells.Fixed(2),
                    contentPadding = PaddingValues(4.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(state.gifts) { gift ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(
                                containerColor = when (gift.rarity) {
                                    "common" -> Color(0xFF424242)
                                    "rare" -> Color(0xFF1565C0)
                                    "epic" -> Color(0xFF6A1B9A)
                                    "legendary" -> Color(0xFFF57F17)
                                    "mythic" -> Color(0xFFD32F2F)
                                    else -> MaterialTheme.colorScheme.surfaceVariant
                                }
                            )
                        ) {
                            Column(modifier = Modifier.padding(12.dp)) {
                                Text(gift.name, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                Spacer(Modifier.height(4.dp))
                                Text("${gift.coinPrice} coins", fontSize = 12.sp)
                                if (gift.diamondPrice > 0) {
                                    Text("${gift.diamondPrice} diamonds", fontSize = 12.sp, color = Color(0xFFFFD700))
                                }
                                Spacer(Modifier.height(2.dp))
                                Text(gift.rarity.uppercase(), fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                if (gift.interactive) Text("✨ Interactive", fontSize = 10.sp, color = Color(0xFF76FF03))
                                if (gift.comboMultiplier > 1) Text("x${gift.comboMultiplier} combo", fontSize = 10.sp, color = Color(0xFF40C4FF))
                                Spacer(Modifier.height(8.dp))
                                Button(
                                    onClick = { pendingGift = gift },
                                    enabled = !state.isLoading && gift.coinPrice > 0,
                                    modifier = Modifier.fillMaxWidth(),
                                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 6.dp)
                                ) { Text("Get for ${gift.coinPrice} coins", fontSize = 11.sp, maxLines = 1) }
                            }
                        }
                    }
                }
            }
        }
    }

    pendingBoxTier?.let { tier ->
        val price = boxPrices[tier] ?: 0
        AlertDialog(
            onDismissRequest = { pendingBoxTier = null },
            title = { Text("Open ${tier.replaceFirstChar { it.uppercase() }} box?") },
            text = { Text("${price} coins will be deducted and one gift from this tier will be added to your inventory.") },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.surpriseBox(token, tier)
                    pendingBoxTier = null
                }) { Text("Open box") }
            },
            dismissButton = { TextButton(onClick = { pendingBoxTier = null }) { Text("Cancel") } }
        )
    }

    pendingGift?.let { gift ->
        AlertDialog(
            onDismissRequest = { pendingGift = null },
            title = { Text("Add ${gift.name} to your collection?") },
            text = { Text("${gift.coinPrice} coins will be spent. You can send this gift from your inventory.") },
            confirmButton = {
                TextButton(enabled = !state.isLoading, onClick = {
                    viewModel.purchaseGift(token, gift.id)
                    pendingGift = null
                }) { Text("Buy gift") }
            },
            dismissButton = { TextButton(onClick = { pendingGift = null }) { Text("Cancel") } }
        )
    }

    state.surpriseResult?.let { result ->
        AlertDialog(
            onDismissRequest = viewModel::clearSurpriseResult,
            title = { Text("You got a gift!") },
            text = { Text("${result.revealedGift?.icon.orEmpty()} ${result.revealedGift?.name ?: "A new gift"} was added to your inventory.") },
            confirmButton = { TextButton(onClick = viewModel::clearSurpriseResult) { Text("View catalog") } }
        )
    }

    state.purchaseResult?.let { result ->
        AlertDialog(
            onDismissRequest = viewModel::clearPurchaseResult,
            title = { Text("Added to your collection") },
            text = { Text("${result.gift?.icon.orEmpty()} ${result.gift?.name ?: "Gift"} is ready in your inventory.") },
            confirmButton = { TextButton(onClick = viewModel::clearPurchaseResult) { Text("Done") } }
        )
    }
}
