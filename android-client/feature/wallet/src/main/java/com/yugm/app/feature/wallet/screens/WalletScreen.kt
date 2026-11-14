package com.yugm.app.feature.wallet.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import android.widget.Toast
import com.yugm.app.core.model.CoinPack
import com.yugm.app.core.model.CreatorDashboardSummary
import com.yugm.app.core.model.GiftItem
import com.yugm.app.core.model.RazorpayCheckoutData
import com.yugm.app.core.model.WalletTransaction
import com.yugm.app.core.ui.components.*
import com.yugm.app.core.ui.theme.Background
import com.yugm.app.core.ui.theme.BorderColor
import com.yugm.app.core.ui.theme.Danger
import com.yugm.app.core.ui.theme.Gold
import com.yugm.app.core.ui.theme.Pink
import com.yugm.app.core.ui.theme.PrimaryPurple
import com.yugm.app.core.ui.theme.Success
import com.yugm.app.core.ui.theme.SurfaceElevated
import com.yugm.app.core.ui.theme.TextMuted
import com.yugm.app.core.ui.theme.TextPrimary
import com.yugm.app.feature.wallet.viewmodel.WalletViewModel
import java.util.Locale

@Composable
fun WalletScreen(
    token: String,
    initialBalance: Int,
    onBack: () -> Unit = {},
    onOpenEarnings: () -> Unit = {},
    onBalanceChanged: (Int) -> Unit = {},
    onRechargeOrderReady: (RazorpayCheckoutData) -> Unit = {},
    onStartGooglePlayPurchase: ((pack: CoinPack) -> Unit)? = null,
    onOpenGiftCatalog: () -> Unit = {},
    onOpenGiftInventory: () -> Unit = {}
) {
    var selectedTab by remember { mutableStateOf(0) }
    var earnings by remember { mutableStateOf(CreatorDashboardSummary()) }
    var status by remember { mutableStateOf("") }
    val context = LocalContext.current
    val viewModel: WalletViewModel = hiltViewModel()

    LaunchedEffect(token) { viewModel.loadWallet(token) }
    LaunchedEffect(viewModel.razorpayCheckoutData) {
        viewModel.razorpayCheckoutData?.let(onRechargeOrderReady)
    }

    YugmAmbientBackground {
        Box(Modifier.fillMaxSize()) {
            AuroraBackground(speed = 0.8f)
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(bottom = 30.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
            item {
                YugmPageHeader("Yugm", "Wallet & Gifts", onBack = onBack) {
                    RoundAction("♢", onClick = { Toast.makeText(context, "Coming soon", Toast.LENGTH_SHORT).show() })
                }
            }
            item {
                SegmentedTabs(
                    items = listOf("◉" to "Coins", "♢" to "Gifts", "↗" to "Earnings"),
                    selectedIndex = selectedTab,
                    onSelected = { selectedTab = it },
                    modifier = Modifier.padding(horizontal = 20.dp)
                )
            }
            if (viewModel.isLoading) {
                item { Box(Modifier.padding(horizontal = 20.dp)) { LoadingState("Loading your wallet…") } }
            } else {
                when (selectedTab) {
                    0 -> {
                         item {
                        AnimatedEntrance(delay = 100) {
                            BalanceHero(
                                balance = viewModel.balance,
                                canClaimReward = viewModel.dailyReward.canClaim,
                                isClaiming = viewModel.isClaimingReward,
                                rewardCoins = viewModel.dailyReward.coinReward,
                                onFreeCoins = {
                                    viewModel.claimDailyReward(token) { msg -> status = msg }
                                },
                                onRecharge = {
                                    viewModel.coinPacks.getOrNull(2)?.let { pack ->
                                        if (pack.googleProductId.isNotBlank() && onStartGooglePlayPurchase != null) {
                                            onStartGooglePlayPurchase(pack)
                                        } else {
                                            viewModel.createRazorpayOrder(token, pack.id)
                                            status = "Secure checkout created"
                                        }
                                    }
                                }
                            )
                        }
                        }
                        if (status.isNotBlank()) item { Text(status, color = Pink, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 20.dp)) }
                        item {
                            AnimatedEntrance(delay = 200) {
                                GlassCard(modifier = Modifier.padding(horizontal = 20.dp).fillMaxWidth()) {
                                    ReferenceSectionHeader("Recharge Packs", "View all")
                                    Row(
                                    Modifier.padding(top = 10.dp).horizontalScroll(rememberScrollState()),
                                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    viewModel.coinPacks.forEachIndexed { index, pack ->
                                        CoinPackCard(pack, popular = index == 2) {
                                            if (pack.googleProductId.isNotBlank() && onStartGooglePlayPurchase != null) {
                                                onStartGooglePlayPurchase(pack)
                                            } else {
                                                viewModel.createRazorpayOrder(token, pack.id)
                                                status = "Secure checkout created for ${pack.coinAmount} coins"
                                            }
                                        }
                                    }
                                }
                            }
                            }
                        }
                        item { AnimatedEntrance(delay = 300) { EarningsStrip(earnings, onOpenEarnings) } }
                        item { AnimatedEntrance(delay = 400) { GiftCatalog(viewModel.giftItems) } }
                        item { AnimatedEntrance(delay = 500) { TransactionList(viewModel.transactions) } }
                    }
                    1 -> {
                        item {
                            Row(Modifier.padding(horizontal = 20.dp).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                GradientAction("Explore gifts", modifier = Modifier.weight(1f), onClick = onOpenGiftCatalog)
                                GradientAction("My collection", modifier = Modifier.weight(1f), onClick = onOpenGiftInventory)
                            }
                        }
                        item { GiftCatalog(viewModel.giftItems, expanded = true) }
                        item {
                            Column(Modifier.padding(horizontal = 20.dp)) {
                                Text("Send gifts inside a live room or private conversation. The recipient earns creator coins instantly.", color = TextMuted, fontSize = 12.sp, lineHeight = 18.sp)
                            }
                        }
                    }
                    else -> {
                        item { EarningsPanel(earnings, onOpenEarnings) }
                        item { TransactionList(viewModel.transactions.filter { it.isCredit }) }
                    }
                }
            }
        }
    }
    }
}

@Composable
private fun BalanceHero(
    balance: Int,
    canClaimReward: Boolean,
    isClaiming: Boolean,
    rewardCoins: Int,
    onFreeCoins: () -> Unit,
    onRecharge: () -> Unit
) {
    Column(
        modifier = Modifier
            .padding(horizontal = 20.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .background(Brush.linearGradient(listOf(Color(0xFF24103A), Color(0xFF5A126E), Color(0xFF1C0D32))))
            .border(1.dp, Pink.copy(alpha = 0.35f), RoundedCornerShape(24.dp))
            .padding(20.dp)
    ) {
        Text("Your Coin Balance", color = TextMuted, fontSize = 13.sp)
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 6.dp)) {
            Box(Modifier.size(42.dp).clip(CircleShape).background(Gold), contentAlignment = Alignment.Center) {
                Text("Y", color = Background, fontWeight = FontWeight.Black, fontSize = 20.sp)
            }
            Text("${String.format(Locale.US, "%,d", balance)}", color = Color.White, fontSize = 38.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(start = 10.dp))
            Spacer(Modifier.weight(1f))
            Text("✦", color = Gold, fontSize = 28.sp)
        }
        Text("≈ ₹${String.format(Locale.US, "%,.2f", balance / 10.0)}", color = TextMuted, fontSize = 14.sp, modifier = Modifier.padding(top = 2.dp))
        Row(Modifier.padding(top = 16.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            val claimLabel = when {
                isClaiming -> "Claiming…"
                canClaimReward -> "Daily Reward  +${if (rewardCoins > 0) rewardCoins else 25}"
                else -> "Reward Claimed"
            }
            Box(
                Modifier
                    .weight(1f)
                    .heightIn(min = 50.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color.White.copy(alpha = if (canClaimReward && !isClaiming) 0.12f else 0.05f))
                    .border(1.dp, BorderColor, RoundedCornerShape(16.dp))
                    .clickable(
                        enabled = canClaimReward && !isClaiming,
                        role = Role.Button,
                        onClickLabel = "Claim daily reward",
                        onClick = onFreeCoins
                    ),
                contentAlignment = Alignment.Center
            ) { Text("♢  $claimLabel", color = if (canClaimReward && !isClaiming) Color.White else TextMuted, fontWeight = FontWeight.Bold, fontSize = 12.sp) }
            GradientAction("Recharge Now", modifier = Modifier.weight(1f), leading = "ϟ", onClick = onRecharge)
        }
    }
}

@Composable
private fun CoinPackCard(pack: CoinPack, popular: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .width(116.dp)
            .height(132.dp)
            .clip(RoundedCornerShape(18.dp))
            .background(if (popular) PrimaryPurple.copy(alpha = 0.22f) else SurfaceElevated)
            .border(1.dp, if (popular) Pink else BorderColor, RoundedCornerShape(18.dp))
            .clickable(role = Role.Button, onClickLabel = "Buy ${pack.coinAmount} coins for ${pack.priceInr} rupees", onClick = onClick)
            .padding(12.dp)
    ) {
        if (popular) Text("Popular", color = Pink, fontSize = 9.sp, fontWeight = FontWeight.Black, modifier = Modifier.align(Alignment.TopCenter))
        Column(Modifier.align(Alignment.Center), horizontalAlignment = Alignment.CenterHorizontally) {
            Text("● ${String.format(Locale.US, "%,d", pack.coinAmount)}", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Black)
            Text("₹${pack.priceInr}.00", color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 7.dp))
        }
    }
}

@Composable
private fun EarningsStrip(summary: CreatorDashboardSummary, onClick: () -> Unit) {
    Row(
        Modifier.padding(horizontal = 20.dp).fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(SurfaceElevated).border(1.dp, BorderColor, RoundedCornerShape(20.dp)).clickable(role = Role.Button, onClickLabel = "Open host earnings", onClick = onClick).padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(Modifier.size(48.dp).clip(CircleShape).background(PrimaryPurple.copy(alpha = 0.25f)), contentAlignment = Alignment.Center) { Text("↗", color = Pink, fontSize = 22.sp) }
        Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
            Text("Host Earnings", color = TextPrimary, fontWeight = FontWeight.Bold)
            Text("${summary.giftCount} gifts · ${summary.uniqueSupporters} supporters", color = TextMuted, fontSize = 10.sp)
        }
        Column(horizontalAlignment = Alignment.End) {
            Text("● ${String.format(Locale.US, "%,d", summary.giftCoins)}", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Black)
            Text("≈ ₹${String.format(Locale.US, "%,.0f", summary.estimatedInr)}", color = TextMuted, fontSize = 10.sp)
        }
    }
}

@Composable
private fun EarningsPanel(summary: CreatorDashboardSummary, onClick: () -> Unit) {
    Column(Modifier.padding(horizontal = 20.dp).fillMaxWidth().clip(RoundedCornerShape(24.dp)).background(Brush.linearGradient(listOf(PrimaryPurple.copy(alpha = 0.36f), SurfaceElevated))).border(1.dp, Pink.copy(alpha = 0.4f), RoundedCornerShape(24.dp)).padding(20.dp)) {
        Text("Creator earnings", color = TextMuted, fontSize = 12.sp)
        Text("${String.format(Locale.US, "%,d", summary.giftCoins)} coins", color = TextPrimary, fontSize = 30.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 4.dp))
        Text("₹${String.format(Locale.US, "%,.0f", summary.estimatedInr)} estimated · ${summary.hostedRooms} hosted rooms", color = TextMuted, fontSize = 12.sp)
        GradientAction("View earnings & payouts", modifier = Modifier.fillMaxWidth().padding(top = 16.dp), onClick = onClick)
    }
}

@Composable
private fun GiftCatalog(gifts: List<GiftItem>, expanded: Boolean = false) {
    Column(Modifier.padding(horizontal = 20.dp)) {
        ReferenceSectionHeader("Gift Catalog", "View all")
        Row(Modifier.padding(top = 10.dp).horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            gifts.take(if (expanded) 20 else 6).forEach { gift ->
                Column(
                    Modifier.width(110.dp).height(144.dp).clip(RoundedCornerShape(18.dp)).background(Brush.verticalGradient(listOf(PrimaryPurple.copy(alpha = 0.28f), SurfaceElevated))).border(1.dp, BorderColor, RoundedCornerShape(18.dp)).padding(10.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text(giftEmoji(gift.name), fontSize = 42.sp)
                    Text(gift.name, color = TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text("● ${gift.price}", color = Gold, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 4.dp))
                }
            }
        }
    }
}

@Composable
private fun TransactionList(transactions: List<WalletTransaction>) {
    Column(Modifier.padding(horizontal = 20.dp)) {
        ReferenceSectionHeader("Recent Transactions", "View all")
        Column(Modifier.padding(top = 10.dp).clip(RoundedCornerShape(20.dp)).background(SurfaceElevated).border(1.dp, BorderColor, RoundedCornerShape(20.dp))) {
            if (transactions.isEmpty()) {
                Text("No transactions yet.", color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(18.dp))
            } else {
                transactions.take(8).forEachIndexed { index, tx ->
                    Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                        val credit = tx.isCredit
                        Box(Modifier.size(38.dp).clip(CircleShape).background(if (credit) Success.copy(alpha = 0.18f) else Pink.copy(alpha = 0.18f)), contentAlignment = Alignment.Center) {
                            Text(if (credit) "+" else "−", color = if (credit) Success else Pink, fontSize = 18.sp, fontWeight = FontWeight.Black)
                        }
                        Column(Modifier.weight(1f).padding(horizontal = 10.dp)) {
                            Text(tx.description.ifBlank { tx.type.replace("_", " ").lowercase().replaceFirstChar { it.titlecase() } }, color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                            Text(tx.createdAt.take(10), color = TextMuted, fontSize = 10.sp)
                        }
                        Text("${if (credit) "+" else "-"}${tx.amount} ●", color = if (credit) Success else Danger, fontWeight = FontWeight.Black, fontSize = 13.sp)
                    }
                    if (index < transactions.take(8).lastIndex) Box(Modifier.fillMaxWidth().height(1.dp).background(BorderColor))
                }
            }
        }
    }
}

private fun giftEmoji(name: String): String = when {
    name.contains("rose", true) -> "🌹"
    name.contains("diya", true) -> "🪔"
    name.contains("lotus", true) -> "🪷"
    name.contains("crown", true) -> "👑"
    name.contains("star", true) || name.contains("astra", true) -> "🌌"
    name.contains("heart", true) -> "💖"
    else -> "🎁"
}
