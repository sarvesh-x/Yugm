package com.yugm.app.feature.wallet.screens

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
import com.yugm.app.core.model.VipStatus
import com.yugm.app.core.ui.components.GlassCard
import com.yugm.app.core.ui.components.LoadingState
import com.yugm.app.core.ui.theme.*
import com.yugm.app.core.util.UiState
import com.yugm.app.feature.wallet.viewmodel.VipViewModel
import com.yugm.app.feature.wallet.viewmodel.WalletViewModel

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
        LaunchedEffect(vipState) {
            if (vipState is UiState.Success) walletViewModel.refreshBalance(token)
        }
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
                                    Text("${vipStatus.daysRemaining} days remaining", color = Gold, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                    Text("Your VIP benefits stay active until this date. Buying another plan extends your membership.", color = TextMuted, fontSize = 12.sp, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 8.dp))
                                } else {
                                    Text("Upgrade to Yugm VIP", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Black)
                                    Text("Choose a plan to unlock its listed benefits.", color = TextMuted, fontSize = 12.sp, textAlign = TextAlign.Center)
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
                                    Text("${plan.durationDays} days · ${plan.coinPrice} coins", color = TextMuted, fontSize = 12.sp)
                                }
                                Button(
                                    onClick = {
                                        if (walletViewModel.balance >= plan.coinPrice) {
                                            vipViewModel.activateVip(token, plan.id)
                                        }
                                    },
                                    enabled = walletViewModel.balance >= plan.coinPrice,
                                    colors = ButtonDefaults.buttonColors(containerColor = Gold),
                                    shape = RoundedCornerShape(12.dp)
                                ) {
                                    Text(if (vipStatus?.isVip == true) "Extend" else "Buy", color = Background, fontWeight = FontWeight.Black)
                                }
                            }
                            if (walletViewModel.balance < plan.coinPrice) {
                                Text("You need ${plan.coinPrice - walletViewModel.balance} more coins", color = TextMuted, fontSize = 11.sp, modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 2.dp, bottom = 8.dp))
                            }
                            if (plan.benefits.isNotEmpty()) {
                                Column(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                                    plan.benefits.forEach { benefit ->
                                        Text("• $benefit", color = TextMuted, fontSize = 12.sp)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
