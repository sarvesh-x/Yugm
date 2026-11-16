package com.yugm.app.feature.gift.screens

import androidx.compose.foundation.background
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
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
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

    LaunchedEffect(token) { viewModel.loadInventory(token) }

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

    Scaffold(
        containerColor = colors.background,
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Gift inventory", fontWeight = FontWeight.Bold)
                        Text("Your collection", color = colors.textSecondary, fontSize = 12.sp)
                    }
                },
                navigationIcon = {
                    TextButton(onClick = onBack) { Text("‹", color = colors.textPrimary, fontSize = 28.sp) }
                },
                colors = androidx.compose.material3.TopAppBarDefaults.topAppBarColors(containerColor = colors.background)
            )
        }
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            Column(Modifier.padding(horizontal = 18.dp)) {
                val full = state.fullInventory
                val giftsCount = full?.summary?.totalGifts ?: totalCopies
                Row(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(22.dp)).background(colors.surfaceElevated).padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(Modifier.size(48.dp).clip(RoundedCornerShape(16.dp)).background(colors.primary.copy(alpha = 0.12f)), contentAlignment = Alignment.Center) {
                        Text("🎁", fontSize = 24.sp)
                    }
                    Column(Modifier.weight(1f).padding(start = 12.dp)) {
                        Text("Your collection", color = colors.textPrimary, fontWeight = FontWeight.Bold, fontSize = 17.sp)
                        Text("$giftsCount gifts · ${full?.cosmetics?.size ?: 0} cosmetics · ${full?.badges?.size ?: 0} badges", color = colors.textSecondary, fontSize = 12.sp, modifier = Modifier.padding(top = 3.dp))
                    }
                }
                Row(Modifier.fillMaxWidth().padding(top = 14.dp), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    InventoryFilterChip("Gifts", tab == InventoryTab.GIFTS, giftsCount.toString()) { tab = InventoryTab.GIFTS }
                    InventoryFilterChip("Cosmetics", tab == InventoryTab.COSMETICS, (full?.cosmetics?.size ?: 0).toString()) { tab = InventoryTab.COSMETICS }
                    InventoryFilterChip("Badges", tab == InventoryTab.BADGES, (full?.badges?.size ?: 0).toString()) { tab = InventoryTab.BADGES }
                }
                if (tab == InventoryTab.GIFTS) {
                    Row(Modifier.fillMaxWidth().padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        InventoryFilterChip("All", filter == InventoryFilter.ALL, state.inventory.size.toString()) { filter = InventoryFilter.ALL }
                        InventoryFilterChip("Tradable", filter == InventoryFilter.TRADABLE, tradableCount.toString()) { filter = InventoryFilter.TRADABLE }
                        InventoryFilterChip("Upgrade", filter == InventoryFilter.UPGRADEABLE, upgradeableCount.toString()) { filter = InventoryFilter.UPGRADEABLE }
                    }
                    OutlinedTextField(
                        value = query,
                        onValueChange = { query = it },
                        modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
                        placeholder = { Text("Find a gift") },
                        leadingIcon = { Text("⌕", color = colors.textSecondary, fontSize = 24.sp) },
                        singleLine = true,
                        shape = RoundedCornerShape(16.dp)
                    )
                }
            }

            if (tab == InventoryTab.GIFTS) when {
                state.isLoading && state.inventory.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = colors.primary)
                }
                state.error != null && state.inventory.isEmpty() -> Column(Modifier.fillMaxWidth().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("Couldn't load your gifts", color = colors.textPrimary, fontWeight = FontWeight.Bold)
                    Text(state.error.orEmpty(), color = colors.textSecondary, fontSize = 13.sp, modifier = Modifier.padding(top = 6.dp))
                    TextButton(onClick = { viewModel.loadInventory(token) }) { Text("Try again") }
                }
                visibleItems.isEmpty() -> Column(Modifier.fillMaxWidth().padding(34.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(if (query.isBlank()) "No gifts in this view" else "No gifts match your search", color = colors.textPrimary, fontWeight = FontWeight.SemiBold)
                    Text("Change the filter or try another name.", color = colors.textSecondary, fontSize = 13.sp, modifier = Modifier.padding(top = 5.dp))
                }
                else -> LazyColumn(
                    contentPadding = PaddingValues(horizontal = 18.dp, vertical = 14.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(visibleItems, key = { it.id }) { item ->
                        val gift = item.gift
                        Surface(
                            modifier = Modifier.fillMaxWidth(),
                            color = colors.surface,
                            shape = RoundedCornerShape(20.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, colors.border)
                        ) {
                            Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                                Box(Modifier.size(54.dp).clip(RoundedCornerShape(16.dp)).background(colors.surfaceElevated), contentAlignment = Alignment.Center) {
                                    Text(gift?.icon?.takeIf { it.isNotBlank() } ?: "🎁", fontSize = 25.sp)
                                }
                                Column(Modifier.weight(1f).padding(start = 12.dp)) {
                                    Text(gift?.name ?: "Unknown gift", color = colors.textPrimary, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                    Text("${item.quantity} ${if (item.quantity == 1) "copy" else "copies"} · ${item.source.replace('_', ' ').lowercase()}", color = colors.textSecondary, fontSize = 12.sp, modifier = Modifier.padding(top = 3.dp))
                                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(top = 8.dp)) {
                                        InventoryTag(if (item.tradable) "Tradable" else "Collection", if (item.tradable) colors.success else colors.textSecondary)
                                        if (gift?.upgradeable == true) InventoryTag("Upgradeable", colors.secondary)
                                    }
                                }
                                Column(horizontalAlignment = Alignment.End) {
                                    Text("${gift?.coinPrice ?: 0} coins", color = colors.primary, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                    if (gift?.upgradeable == true) {
                                        TextButton(
                                            enabled = !state.isLoading,
                                            onClick = { upgradeTarget = item },
                                            contentPadding = PaddingValues(horizontal = 4.dp, vertical = 0.dp)
                                        ) { Text("Upgrade", fontSize = 12.sp) }
                                    }
                                }
                            }
                        }
                    }
                }
            } else when (tab) {
                InventoryTab.COSMETICS -> {
                    val cosmetics = state.fullInventory?.cosmetics.orEmpty()
                    if (cosmetics.isEmpty()) InventoryEmpty("No cosmetics yet", "Cosmetics you collect will appear here.")
                    else LazyColumn(contentPadding = PaddingValues(horizontal = 18.dp, vertical = 14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        items(cosmetics, key = { it.id }) { cosmetic ->
                            Surface(Modifier.fillMaxWidth(), color = colors.surface, shape = RoundedCornerShape(18.dp), border = androidx.compose.foundation.BorderStroke(1.dp, colors.border)) {
                                Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                                    Box(Modifier.size(48.dp).clip(RoundedCornerShape(15.dp)).background(colors.primary.copy(alpha = .12f)), contentAlignment = Alignment.Center) { Text("✦", color = colors.primary, fontSize = 23.sp) }
                                    Column(Modifier.weight(1f).padding(start = 12.dp)) {
                                        Text(cosmetic.name, color = colors.textPrimary, fontWeight = FontWeight.Bold)
                                        Text("${cosmetic.type.replace('_', ' ')} · ${cosmetic.rarity.lowercase().replaceFirstChar { it.uppercase() }}", color = colors.textSecondary, fontSize = 12.sp, modifier = Modifier.padding(top = 3.dp))
                                    }
                                    TextButton(onClick = {
                                        scope.launch {
                                            runCatching { YugmApi.equipCosmetic(token, if (cosmetic.isEquipped) "" else cosmetic.id, cosmetic.type) }
                                            viewModel.loadInventory(token)
                                        }
                                    }) { Text(if (cosmetic.isEquipped) "Equipped" else "Equip", color = if (cosmetic.isEquipped) colors.success else colors.primary) }
                                }
                            }
                        }
                    }
                }
                InventoryTab.BADGES -> {
                    val badges = state.fullInventory?.badges.orEmpty()
                    if (badges.isEmpty()) InventoryEmpty("No badges yet", "Earn achievements to add badges to your collection.")
                    else LazyColumn(contentPadding = PaddingValues(horizontal = 18.dp, vertical = 14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        items(badges, key = { "${it.achievementId}-${it.tier}" }) { badge ->
                            Surface(Modifier.fillMaxWidth(), color = colors.surface, shape = RoundedCornerShape(18.dp), border = androidx.compose.foundation.BorderStroke(1.dp, colors.border)) {
                                Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                                    Box(Modifier.size(48.dp).clip(CircleShape).background(colors.primary.copy(alpha = .12f)), contentAlignment = Alignment.Center) { Text(badge.icon, fontSize = 24.sp) }
                                    Column(Modifier.weight(1f).padding(start = 12.dp)) {
                                        Text(badge.title, color = colors.textPrimary, fontWeight = FontWeight.Bold)
                                        Text("${badge.tier.lowercase().replaceFirstChar { it.uppercase() }} achievement", color = colors.primary, fontSize = 12.sp, modifier = Modifier.padding(top = 3.dp))
                                        if (badge.description.isNotBlank()) Text(badge.description, color = colors.textSecondary, fontSize = 12.sp, modifier = Modifier.padding(top = 5.dp))
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

    upgradeTarget?.let { item ->
        val gift = item.gift
        AlertDialog(
            onDismissRequest = { upgradeTarget = null },
            title = { Text("Upgrade ${gift?.name ?: "gift"}?") },
            text = { Text("This spends ${item.upgradeCost.takeIf { it > 0 } ?: (gift?.coinPrice?.times(3)?.div(2) ?: 0)} coins and upgrades one copy in your inventory.") },
            confirmButton = {
                Button(
                    onClick = { viewModel.upgradeGift(token, item.id); upgradeTarget = null },
                    colors = ButtonDefaults.buttonColors(containerColor = colors.primary)
                ) { Text("Upgrade") }
            },
            dismissButton = { TextButton(onClick = { upgradeTarget = null }) { Text("Cancel") } }
        )
    }

    state.upgradeResult?.let { result ->
        AlertDialog(
            onDismissRequest = viewModel::clearUpgradeResult,
            title = { Text("Gift upgraded") },
            text = { Text("${result.fromGift?.name ?: "Gift"} became ${result.upgradedGift?.name ?: "a new gift"}.") },
            confirmButton = { TextButton(onClick = viewModel::clearUpgradeResult) { Text("Done") } }
        )
    }
}

@Composable
private fun InventoryEmpty(title: String, detail: String) {
    val colors = LocalYugmColors.current
    Column(Modifier.fillMaxWidth().padding(36.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(title, color = colors.textPrimary, fontWeight = FontWeight.SemiBold)
        Text(detail, color = colors.textSecondary, fontSize = 13.sp, modifier = Modifier.padding(top = 6.dp))
    }
}

@Composable
private fun InventoryFilterChip(label: String, selected: Boolean, count: String, onClick: () -> Unit) {
    val colors = LocalYugmColors.current
    Surface(
        onClick = onClick,
        shape = CircleShape,
        color = if (selected) colors.primary.copy(alpha = 0.12f) else colors.surface,
        border = androidx.compose.foundation.BorderStroke(1.dp, if (selected) colors.primary.copy(alpha = 0.4f) else colors.border)
    ) {
        Row(Modifier.padding(horizontal = 12.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(label, color = if (selected) colors.primary else colors.textSecondary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            Text(count, color = if (selected) colors.primary else colors.textSecondary, fontSize = 11.sp)
        }
    }
}

@Composable
private fun InventoryTag(label: String, tint: androidx.compose.ui.graphics.Color) {
    Text(
        label,
        color = tint,
        fontSize = 10.sp,
        fontWeight = FontWeight.Medium,
        modifier = Modifier.clip(CircleShape).background(tint.copy(alpha = 0.11f)).padding(horizontal = 8.dp, vertical = 4.dp)
    )
}
