package com.yugm.app.feature.gift.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InventoryScreen(
    token: String,
    onBack: () -> Unit,
    viewModel: GiftViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsState()

    LaunchedEffect(token) {
        viewModel.loadInventory(token)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Gift Inventory") },
                navigationIcon = {
                    TextButton(onClick = onBack) { Text("< Back") }
                }
            )
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp)) {
            if (state.isLoading) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            } else if (state.error != null) {
                Text("Error: ${state.error}", color = MaterialTheme.colorScheme.error)
            } else if (state.inventory.isEmpty()) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("Your inventory is empty", fontSize = 16.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            } else {
                Text("${state.inventory.size} item types", fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(8.dp))

                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(state.inventory) { item ->
                        val itemGift = item.gift
                        Card(modifier = Modifier.fillMaxWidth()) {
                            Row(
                                modifier = Modifier.padding(12.dp).fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(itemGift?.name ?: "Unknown", fontWeight = FontWeight.Bold)
                                    Text("Qty: ${item.quantity}", fontSize = 13.sp)
                                    Text("Source: ${item.source}", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    if (item.tradable) {
                                        Text("Tradable", fontSize = 11.sp, color = Color(0xFF76FF03))
                                    }
                                    if (itemGift?.upgradeable == true) {
                                        Text("Upgradeable", fontSize = 11.sp, color = Color(0xFF40C4FF))
                                    }
                                }
                                if (itemGift != null) {
                                    Text(
                                        "${itemGift.coinPrice} coins",
                                        fontSize = 13.sp,
                                        color = MaterialTheme.colorScheme.primary
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
