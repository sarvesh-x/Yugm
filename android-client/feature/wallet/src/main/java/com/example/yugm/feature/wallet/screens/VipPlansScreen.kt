package com.example.yugm.feature.wallet.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.example.yugm.core.model.VipStatus
import com.example.yugm.core.ui.components.GlassCard
import com.example.yugm.core.ui.components.LoadingState
import com.example.yugm.core.ui.theme.*
import com.example.yugm.core.util.UiState
import com.example.yugm.feature.wallet.viewmodel.VipViewModel
import com.example.yugm.feature.wallet.viewmodel.WalletViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VipPlansScreen(
    token: String,
    onBack: () -> Unit
) {
    val vipViewModel: VipViewModel = hiltViewModel()
    val walletViewModel: WalletViewModel = hiltViewModel()

    LaunchedEffect(token) {
        vipViewModel.loadVip(token)
        walletViewModel.loadWallet(token)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("VIP Lounge", color = Color.White, fontWeight = FontWeight.Bold) },
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
        val vipState = vipViewModel.vipState
        when (vipState) {
            is UiState.Loading -> {
                Box(Modifier.fillMaxSize().padding(innerPadding), contentAlignment = Alignment.Center) {
                    LoadingState("Opening the VIP doors...")
                }
            }
            is UiState.Error -> {
                Box(Modifier.fillMaxSize().padding(innerPadding), contentAlignment = Alignment.Center) {
                    Text(vipState.message, color = Color.Red)
                }
            }
            else -> {
                val vipData = (vipState as? UiState.Success)?.data
                val vipPlans = vipData?.first ?: emptyList()
                val vipStatus = vipData?.second

                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(innerPadding),
                    contentPadding = PaddingValues(20.dp),
                    verticalArrangement = Arrangement.spacedBy(18.dp)
                ) {
                    item {
                        GlassCard(modifier = Modifier.fillMaxWidth()) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                                Text("👑", fontSize = 38.sp)
                                Spacer(modifier = Modifier.height(8.dp))
                                if (vipStatus?.isVip == true) {
                                    Text("VIP Active", color = Gold, fontSize = 20.sp, fontWeight = FontWeight.Black)
                                    Text("Expires: ${vipStatus.vipExpiresAt?.take(10).orEmpty()}", color = TextMuted, fontSize = 12.sp)
                                } else {
                                    Text("Upgrade to Yugm VIP", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Black)
                                    Text("Unlock profile boosts, premium frames, and more.", color = TextMuted, fontSize = 12.sp, textAlign = TextAlign.Center)
                                }
                            }
                        }
                    }

                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Your Coins", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            Text("${walletViewModel.balance} Coins", color = Gold, fontWeight = FontWeight.Black, fontSize = 16.sp)
                        }
                    }

                    item {
                        Text("VIP Benefits", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        Spacer(modifier = Modifier.height(8.dp))
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            listOf(
                                "👑 Golden Profile Crown & Glow Frame",
                                "🚀 Profile boosted in swiping algorithm",
                                "🔥 Double relationship bonding XP points",
                                "💬 Access to exclusive custom name styles",
                                "✨ Enter live rooms with custom flash effects"
                            ).forEach { perk ->
                                GlassCard(modifier = Modifier.fillMaxWidth()) {
                                    Text(perk, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                                }
                            }
                        }
                    }

                    item {
                        Text("Select a Subscription Plan", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    }

                    items(vipPlans) { plan ->
                        Card(
                            colors = CardDefaults.cardColors(containerColor = SurfaceElevated),
                            border = BorderStroke(1.dp, Color(0x1AFFFFFF)),
                            shape = RoundedCornerShape(16.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                modifier = Modifier.padding(16.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(plan.name, color = Color.White, fontWeight = FontWeight.Black, fontSize = 18.sp)
                                    Text("Duration: ${plan.durationDays} Days", color = TextMuted, fontSize = 12.sp)
                                }
                                Button(
                                    onClick = {
                                        if (walletViewModel.balance >= plan.coinPrice) {
                                            vipViewModel.activateVip(token, plan.id)
                                        }
                                    },
                                    colors = ButtonDefaults.buttonColors(containerColor = Gold),
                                    shape = RoundedCornerShape(12.dp)
                                ) {
                                    Text("${plan.coinPrice} Coins", color = Background, fontWeight = FontWeight.Black)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
