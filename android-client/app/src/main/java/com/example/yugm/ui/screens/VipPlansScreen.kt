package com.example.yugm.ui.screens

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
import com.example.yugm.api.YugmApi
import com.example.yugm.model.VipPlan
import com.example.yugm.model.VipStatus
import com.example.yugm.ui.components.GlassCard
import com.example.yugm.ui.components.LoadingState
import com.example.yugm.ui.theme.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VipPlansScreen(
    token: String,
    onBack: () -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    var vipStatus by remember { mutableStateOf(VipStatus()) }
    var plans by remember { mutableStateOf<List<VipPlan>>(emptyList()) }
    var balance by remember { mutableStateOf(0) }
    var isLoading by remember { mutableStateOf(true) }

    fun refreshVipInfo() {
        isLoading = true
        coroutineScope.launch {
            runCatching { YugmApi.vipPlans(token) }.onSuccess { (planList, status) ->
                plans = planList
                vipStatus = status
            }
            runCatching { YugmApi.wallet(token) }.onSuccess { balance = it }
            isLoading = false
        }
    }

    LaunchedEffect(token) {
        refreshVipInfo()
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
        if (isLoading) {
            Box(Modifier.fillMaxSize().padding(innerPadding), contentAlignment = Alignment.Center) {
                LoadingState("Opening the VIP doors...")
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding),
                contentPadding = PaddingValues(20.dp),
                verticalArrangement = Arrangement.spacedBy(18.dp)
            ) {
                // VIP Status Card
                item {
                    GlassCard(modifier = Modifier.fillMaxWidth()) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                            Text("👑", fontSize = 38.sp)
                            Spacer(modifier = Modifier.height(8.dp))
                            if (vipStatus.isVip) {
                                Text("VIP Active", color = Gold, fontSize = 20.sp, fontWeight = FontWeight.Black)
                                Text("Expires: ${vipStatus.vipExpiresAt.take(10)}", color = TextMuted, fontSize = 12.sp)
                            } else {
                                Text("Upgrade to Yugm VIP", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Black)
                                Text("Unlock profile boosts, premium frames, and more.", color = TextMuted, fontSize = 12.sp, textAlign = TextAlign.Center)
                            }
                        }
                    }
                }

                // Balance info
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Your Coins", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        Text("$balance Coins", color = Gold, fontWeight = FontWeight.Black, fontSize = 16.sp)
                    }
                }

                // Perks List
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

                // Plans list header
                item {
                    Text("Select a Subscription Plan", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }

                // Tiers
                items(plans) { plan ->
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
                                    if (balance >= plan.coinPrice) {
                                        coroutineScope.launch {
                                            runCatching {
                                                YugmApi.activateVip(token, plan.id)
                                            }.onSuccess {
                                                refreshVipInfo()
                                            }
                                        }
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
