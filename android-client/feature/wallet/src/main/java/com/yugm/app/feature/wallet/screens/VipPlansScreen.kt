package com.yugm.app.feature.wallet.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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
import com.yugm.app.core.ui.components.LoadingState
import com.yugm.app.core.util.UiState
import com.yugm.app.feature.wallet.viewmodel.VipViewModel
import com.yugm.app.feature.wallet.viewmodel.WalletViewModel

private val VipDark = Color(0xFF0A0A0E)
private val VipCard = Color(0xFF17171E)
private val VipGold = Color(0xFFFFCE6B)
private val VipMuted = Color(0xFFAAA7B4)
private val VipRequirements = listOf(0, 1000, 1500, 2500, 4000, 6000, 10000, 25000)
private val VipBenefits = listOf(
    Triple("👑", "VIP badge", 1), Triple("🖼️", "VIP avatar frame", 1), Triple("💬", "VIP chat frame", 1),
    Triple("🌌", "VIP room background", 1), Triple("🎁", "Exclusive VIP gifts", 1), Triple("👁️", "See profile visitors", 1),
    Triple("✉️", "Chat with anyone", 2), Triple("✨", "Special room entry message", 2), Triple("😎", "Exclusive VIP emojis", 3),
    Triple("🚘", "VIP car entry", 4), Triple("🖼️", "Send images in room chat", 4), Triple("♾️", "Unlimited text chat", 5),
    Triple("🎨", "Customize room background", 6), Triple("🪄", "Customize avatar", 7), Triple("🕵️", "Mysterious visitor privacy", 7),
    Triple("➕", "Add friends function", 7)
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VipPlansScreen(token: String, onBack: () -> Unit, onRecharge: () -> Unit = {}, onPrivacySettings: () -> Unit = {}) {
    val vipViewModel: VipViewModel = hiltViewModel()
    val walletViewModel: WalletViewModel = hiltViewModel()
    var showRules by remember { mutableStateOf(false) }

    LaunchedEffect(token) {
        vipViewModel.loadVip(token)
        walletViewModel.loadWallet(token)
    }

    val vipState = vipViewModel.vipState
    LaunchedEffect(vipState) {
        if (vipState is UiState.Success) walletViewModel.refreshBalance(token)
    }
    Scaffold(
        containerColor = VipDark,
        topBar = {
            TopAppBar(
                title = { Text("VIP Center", color = Color.White, fontWeight = FontWeight.Bold) },
                navigationIcon = { TextButton(onClick = onBack) { Text("‹", fontSize = 28.sp, color = Color.White) } },
                actions = {
                    TextButton(onClick = onPrivacySettings) { Text("Privacy", color = VipGold, fontWeight = FontWeight.SemiBold) }
                    TextButton(onClick = { showRules = true }) { Text("Rules", color = Color.White) }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = VipDark)
            )
        }
    ) { padding ->
        when (vipState) {
            is UiState.Loading, UiState.Idle -> Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) { LoadingState("Loading VIP membership…") }
            is UiState.Error -> Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) { Text(vipState.message, color = Color.White) }
            is UiState.Success -> {
                val status = vipState.data.second ?: VipStatus()
                val currentLevel = status.vipLevel.coerceIn(0, 7)
                val target = if (currentLevel == 7) status.vipExpRequired else (status.nextVipExpRequired ?: status.vipExpRequired).coerceAtLeast(1)
                val progress = (status.vipExp.toFloat() / target).coerceIn(0f, 1f)
                Column(Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(bottom = 24.dp)) {
                    VipProgressCard(status, currentLevel, target, progress)
                    Row(Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 18.dp).horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        (1..7).forEach { level ->
                            Box(
                                Modifier.size(66.dp).clip(CircleShape)
                                    .background(if (level <= currentLevel) Brush.linearGradient(listOf(VipGold, Color(0xFF9B55FF))) else Brush.linearGradient(listOf(Color(0xFF292831), Color(0xFF17171D))))
                                    .border(1.dp, if (level == currentLevel) VipGold else Color(0xFF3B3943), CircleShape),
                                contentAlignment = Alignment.Center
                            ) { Text("VIP$level", color = if (level <= currentLevel) VipDark else VipMuted, fontSize = 12.sp, fontWeight = FontWeight.Black) }
                        }
                    }
                    Column(Modifier.padding(horizontal = 16.dp).clip(RoundedCornerShape(22.dp)).background(VipCard).padding(17.dp), verticalArrangement = Arrangement.spacedBy(13.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text("Membership privileges", color = Color.White, fontSize = 17.sp, fontWeight = FontWeight.Bold)
                                Text("Features unlock as your VIP level grows", color = VipMuted, fontSize = 11.sp, modifier = Modifier.padding(top = 3.dp))
                            }
                            Text("${VipBenefits.count { it.third <= currentLevel }}/${VipBenefits.size}", color = VipGold, fontWeight = FontWeight.Bold)
                        }
                        VipBenefits.forEach { (icon, label, level) ->
                            val unlocked = currentLevel >= level && status.isVip
                            Row(
                                Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp))
                                    .background(if (unlocked) Color(0xFF25212B) else Color(0xFF1D1C23)).padding(horizontal = 12.dp, vertical = 11.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(11.dp)
                            ) {
                                Box(Modifier.size(38.dp).clip(CircleShape).background(if (unlocked) Color(0x33FFCE6B) else Color(0xFF292831)), contentAlignment = Alignment.Center) { Text(icon, fontSize = 18.sp) }
                                Text(label, color = if (unlocked) Color.White else VipMuted, fontSize = 13.sp, modifier = Modifier.weight(1f))
                                Text(if (unlocked) "Unlocked" else "VIP $level", color = if (unlocked) VipGold else Color(0xFF777480), fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                            }
                        }
                    }
                    Button(
                        onClick = onRecharge,
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 18.dp).height(56.dp),
                        shape = RoundedCornerShape(28.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = VipGold)
                    ) { Text("Recharge Now · ${walletViewModel.balance} coins", color = Color(0xFF402A08), fontSize = 15.sp, fontWeight = FontWeight.Black) }
                }
            }
        }
    }
    if (showRules) VipRulesDialog(onDismiss = { showRules = false })
}

@Composable
private fun VipProgressCard(status: VipStatus, level: Int, target: Int, progress: Float) {
    Column(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp).clip(RoundedCornerShape(25.dp))
            .background(Brush.linearGradient(listOf(Color(0xFF6F6F78), Color(0xFF32323A), Color(0xFF24242B))))
            .padding(18.dp), verticalArrangement = Arrangement.spacedBy(13.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(Modifier.size(58.dp).clip(CircleShape).background(Brush.linearGradient(listOf(VipGold, Color(0xFFB56AFF)))), contentAlignment = Alignment.Center) {
                Text(if (status.isVip) "👑" else "☆", fontSize = 28.sp)
            }
            Column(Modifier.weight(1f)) {
                Text(if (status.isVip) "VIP $level" else if (status.frozen) "VIP frozen" else "Begin your VIP journey", color = Color.White, fontSize = 19.sp, fontWeight = FontWeight.Black)
                Text(if (status.isVip) "${status.daysRemaining} days left in this 90-day cycle" else if (status.frozen) "Clear ${-status.vipExp} EXP to restore benefits" else "Earn VIP EXP with every qualifying purchase", color = Color(0xFFE3DDEB), fontSize = 11.sp, modifier = Modifier.padding(top = 3.dp))
            }
            Text("VIP$level", color = VipGold, fontWeight = FontWeight.Black, fontSize = 13.sp)
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("${status.vipExp} / $target VIP EXP", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
            Text(if (level < 7) "Next: VIP${level + 1}" else "MAX", color = VipGold, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        }
        LinearProgressIndicator(progress = { progress }, modifier = Modifier.fillMaxWidth().height(7.dp).clip(CircleShape), color = VipGold, trackColor = Color(0xFF929098))
    }
}

@Composable
private fun VipRulesDialog(onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("VIP membership rules", color = Color.White, fontWeight = FontWeight.Bold) },
        text = {
            Column(Modifier.height(430.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Earn 10 VIP EXP for every US$1 spent on a purchase. There is no daily limit. Refunded purchases reverse the EXP they earned.", color = VipMuted, fontSize = 13.sp)
                Text("Each level has a 90-day review cycle. Upgrade as soon as your EXP reaches the next level requirement; higher levels may be skipped when a purchase covers the cumulative requirement. EXP resets after an upgrade.", color = VipMuted, fontSize = 13.sp)
                Text("To keep your current level, earn that level's requirement again during its 90-day cycle. Otherwise your level is adjusted to the highest requirement your earned EXP supports. New members who do not reach VIP 1 in 90 days lose the unranked EXP.", color = VipMuted, fontSize = 13.sp)
                Text("If a refund removes more EXP than you have, VIP benefits freeze until the EXP deficit is cleared. If it remains uncleared for 90 days, VIP EXP and level reset.", color = VipMuted, fontSize = 13.sp)
                VipRequirements.forEachIndexed { level, exp ->
                    if (level > 0) Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(VipCard).padding(10.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("VIP $level", color = Color.White, fontWeight = FontWeight.SemiBold)
                        Text("$exp EXP", color = VipGold)
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Got it", color = VipGold) } },
        containerColor = Color(0xFF14141A)
    )
}
