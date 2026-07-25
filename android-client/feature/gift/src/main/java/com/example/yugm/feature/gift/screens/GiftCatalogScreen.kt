package com.example.yugm.feature.gift.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
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
import com.example.yugm.feature.gift.viewmodel.GiftViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GiftCatalogScreen(
    token: String,
    onBack: () -> Unit,
    viewModel: GiftViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsState()

    LaunchedEffect(token) {
        viewModel.loadGifts(token)
        viewModel.loadCollections(token)
    }

    val categories = listOf(null, "normal", "premium", "limited", "seasonal", "space", "dragon", "luxury")
    val rarities = listOf(null, "common", "rare", "epic", "legendary", "mythic")

    var showCategoryDropdown by remember { mutableStateOf(false) }
    var showRarityDropdown by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Gift Catalog") },
                navigationIcon = {
                    TextButton(onClick = onBack) { Text("< Back") }
                }
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

            if (state.isLoading) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            } else if (state.error != null) {
                Text("Error: ${state.error}", color = MaterialTheme.colorScheme.error)
            } else {
                Text("${state.giftTotal} gifts", fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(8.dp))

                LazyVerticalGrid(
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
                            }
                        }
                    }
                }
            }
        }
    }
}
