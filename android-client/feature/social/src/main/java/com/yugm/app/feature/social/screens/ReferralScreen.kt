package com.yugm.app.feature.social.screens

import android.widget.Toast
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.yugm.app.core.model.ReferralDetail
import com.yugm.app.core.model.ReferralStatsResponse
import com.yugm.app.core.ui.components.Avatar
import com.yugm.app.core.ui.components.GlassCard
import com.yugm.app.core.ui.components.GradientAction
import com.yugm.app.core.ui.components.LoadingState
import com.yugm.app.core.ui.components.SectionTitle
import com.yugm.app.core.ui.components.YugmAmbientBackground
import com.yugm.app.core.ui.components.YugmPageHeader
import com.yugm.app.core.ui.theme.Gold
import com.yugm.app.core.ui.theme.Line
import com.yugm.app.core.ui.theme.Panel
import com.yugm.app.core.ui.theme.Success
import com.yugm.app.core.ui.theme.TextMuted
import com.yugm.app.core.ui.theme.TextPrimary
import com.yugm.app.feature.social.viewmodel.SocialViewModel

@Composable
fun ReferralScreen(
    token: String,
    onBack: () -> Unit
) {
    val viewModel: SocialViewModel = hiltViewModel()
    val context = LocalContext.current
    @Suppress("DEPRECATION")
    val clipboard = LocalClipboardManager.current
    var claimInput by remember { mutableStateOf("") }
    var claimMessage by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(token) { viewModel.loadReferral(token) }

    YugmAmbientBackground {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 30.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item { YugmPageHeader("Referral", "Invite friends, earn coins", onBack = onBack) }

            if (viewModel.isLoading) {
                item { Box(Modifier.padding(horizontal = 20.dp)) { LoadingState("Loading referral stats…") } }
            } else {
                item {
                    Column(Modifier.padding(horizontal = 20.dp)) {
                        GlassCard {
                            Text("Your Referral Code", color = TextMuted, fontSize = 12.sp)
                            Spacer(Modifier.height(10.dp))
                            val code = viewModel.referralCode.ifBlank { "" }
                            if (code.isNotBlank()) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    OutlinedTextField(
                                        value = code,
                                        onValueChange = {},
                                        readOnly = true,
                                        singleLine = true,
                                        textStyle = androidx.compose.ui.text.TextStyle(
                                            color = TextPrimary,
                                            fontSize = 22.sp,
                                            fontWeight = FontWeight.Black,
                                            textAlign = TextAlign.Center
                                        ),
                                        colors = OutlinedTextFieldDefaults.colors(
                                            focusedTextColor = TextPrimary,
                                            unfocusedTextColor = TextPrimary,
                                            focusedBorderColor = Gold,
                                            unfocusedBorderColor = Line,
                                            focusedContainerColor = Panel,
                                            unfocusedContainerColor = Panel,
                                            cursorColor = Gold
                                        ),
                                        shape = RoundedCornerShape(12.dp),
                                        modifier = Modifier.weight(1f)
                                    )
                                    Spacer(Modifier.width(10.dp))
                                    TextButton(
                                        onClick = {
                                            clipboard.setText(AnnotatedString(code))
                                            Toast.makeText(context, "Copied!", Toast.LENGTH_SHORT).show()
                                        }
                                    ) {
                                        Text("Copy", color = Gold, fontWeight = FontWeight.Black)
                                    }
                                }
                            } else {
                                GradientAction("Generate Code", onClick = {
                                    viewModel.generateReferralCode(token)
                                    Toast.makeText(context, "Code generated!", Toast.LENGTH_SHORT).show()
                                })
                            }
                        }
                    }
                }

                viewModel.referralStats?.let { s ->
                    item {
                        Row(
                            Modifier.padding(horizontal = 20.dp),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            StatCard("Total", "${s.stats.total}", Modifier.weight(1f))
                            StatCard("Completed", "${s.stats.completed}", Modifier.weight(1f))
                        }
                    }
                    item {
                        Row(
                            Modifier.padding(horizontal = 20.dp),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            StatCard("Rewarded", "${s.stats.rewarded}", Modifier.weight(1f))
                            StatCard("Coins Earned", "${s.stats.totalCoins}", Modifier.weight(1f))
                        }
                    }
                }

                item {
                    Column(Modifier.padding(horizontal = 20.dp)) {
                        SectionTitle("Claim Referral")
                        Spacer(Modifier.height(10.dp))
                        OutlinedTextField(
                            value = claimInput,
                            onValueChange = { claimInput = it },
                            label = { Text("Enter referral code") },
                            singleLine = true,
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = TextPrimary,
                                unfocusedTextColor = TextPrimary,
                                focusedLabelColor = Gold,
                                unfocusedLabelColor = TextMuted,
                                focusedBorderColor = Gold,
                                unfocusedBorderColor = Line,
                                cursorColor = Gold,
                                focusedContainerColor = Panel,
                                unfocusedContainerColor = Panel
                            ),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(Modifier.height(8.dp))
                        GradientAction(
                            label = "Claim",
                            enabled = claimInput.isNotBlank(),
                            onClick = {
                                viewModel.claimReferral(token, claimInput.trim())
                                claimInput = ""
                                claimMessage = "Claimed!"
                                Toast.makeText(context, "Claimed!", Toast.LENGTH_SHORT).show()
                            }
                        )
                        claimMessage?.let {
                            Text(it, color = Success, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 6.dp))
                        }
                    }
                }

                val referrals = viewModel.referralStats?.referrals ?: emptyList()
                if (referrals.isEmpty()) {
                    item {
                        Box(Modifier.padding(horizontal = 20.dp)) {
                            GlassCard {
                                Text("No referrals yet. Share your code to earn coins!", color = TextMuted, fontSize = 12.sp)
                            }
                        }
                    }
                } else {
                    item { Box(Modifier.padding(horizontal = 20.dp)) { SectionTitle("Referral Details") } }
                    items(referrals, key = { it._id }) { detail ->
                        Column(Modifier.padding(horizontal = 20.dp)) {
                            ReferralDetailCard(detail)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ReferralDetailCard(detail: ReferralDetail) {
    val userName = detail.referredUserId?.name ?: detail.referredUserId?.username ?: "Unknown"
    val userAvatar = detail.referredUserId?.avatar
    val statusColor = when (detail.status) {
        "COMPLETED" -> Success
        "REWARDED" -> Gold
        else -> TextMuted
    }
    GlassCard {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Avatar(
                initial = userName.firstOrNull()?.toString() ?: "?",
                size = 42,
                imageUrl = userAvatar
            )
            Column(Modifier.weight(1f)) {
                Text(userName, color = TextPrimary, fontWeight = FontWeight.Bold)
                val createdAt = detail.createdAt
                if (createdAt != null) {
                    Text(createdAt.take(10), color = TextMuted, fontSize = 11.sp)
                }
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(detail.status, color = statusColor, fontWeight = FontWeight.Black, fontSize = 12.sp)
                if (detail.rewardCoins != null) {
                    Text("+${detail.rewardCoins} coins", color = Gold, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                }
            }
        }
    }
}

@Composable
private fun StatCard(label: String, value: String, modifier: Modifier = Modifier) {
    GlassCard(modifier = modifier) {
        Text(value, color = TextPrimary, fontWeight = FontWeight.Black, fontSize = 19.sp)
        Text(label, color = TextMuted, fontSize = 12.sp)
    }
}
