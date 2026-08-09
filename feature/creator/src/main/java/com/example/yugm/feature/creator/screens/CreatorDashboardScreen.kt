package com.example.yugm.feature.creator.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.example.yugm.core.ui.components.AuroraBackground
import com.example.yugm.core.ui.components.GlassCard
import com.example.yugm.core.ui.theme.Background
import com.example.yugm.core.ui.theme.Gold
import com.example.yugm.core.ui.theme.Pink
import com.example.yugm.core.ui.theme.PrimaryPurple
import com.example.yugm.core.ui.theme.SaffronGold
import com.example.yugm.core.ui.theme.SuccessGreen
import com.example.yugm.core.ui.theme.SurfaceElevated
import com.example.yugm.core.ui.theme.TextMuted
import com.example.yugm.core.ui.theme.TextPrimary
import com.example.yugm.feature.creator.viewmodel.CreatorUiState
import com.example.yugm.feature.creator.viewmodel.CreatorViewModel

@Composable
fun CreatorDashboardScreen(
    token: String,
    onBack: () -> Unit,
    onWithdrawal: () -> Unit = {},
    onKyc: () -> Unit = {},
    viewModel: CreatorViewModel = hiltViewModel()
) {
    LaunchedEffect(token) {
        viewModel.loadData(token)
    }

    val state by viewModel.uiState.collectAsState()

    Box(Modifier.fillMaxSize()) {
        AuroraBackground(speed = 0.5f)
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Background.copy(alpha = 0.92f))
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 18.dp)
            ) {
                Spacer(Modifier.height(16.dp))

                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clip(CircleShape)
                            .background(SurfaceElevated)
                            .clickable { onBack() },
                        contentAlignment = Alignment.Center
                    ) {
                        Text("←", color = TextPrimary, fontSize = 20.sp)
                    }
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text("Creator Hub", color = TextPrimary, fontSize = 22.sp, fontWeight = FontWeight.Black)
                        Text("Analytics, earnings & growth", color = TextMuted, fontSize = 12.sp)
                    }
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .background(Brush.linearGradient(listOf(Pink, PrimaryPurple)))
                            .padding(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Text("PRO", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Black)
                    }
                }

                Spacer(Modifier.height(18.dp))

                when (val current = state) {
                    is CreatorUiState.Loading -> {
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator(color = SaffronGold)
                        }
                    }
                    is CreatorUiState.Error -> {
                        GlassCard(Modifier.fillMaxWidth()) {
                            Text(current.message, color = Color.Red, fontSize = 14.sp)
                            Spacer(Modifier.height(12.dp))
                            Button(
                                onClick = { viewModel.loadData(token) },
                                colors = ButtonDefaults.buttonColors(containerColor = PrimaryPurple)
                            ) {
                                Text("Retry")
                            }
                        }
                    }
                    is CreatorUiState.Success -> {
                        val db = current.dashboard
                        val exp = current.experience
                        val wd = current.withdrawal

                        LazyColumn(
                            contentPadding = PaddingValues(bottom = 32.dp),
                            verticalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            // Earnings Hero Card
                            item {
                                GlassCard(Modifier.fillMaxWidth()) {
                                    Column(Modifier.padding(4.dp)) {
                                        Text("TOTAL CREATOR EARNINGS", color = TextMuted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                        Spacer(Modifier.height(4.dp))
                                        Row(verticalAlignment = Alignment.Bottom) {
                                            Text(
                                                "🪙 ${db?.analytics?.totalGiftsValue ?: wd?.balance?.availableCoins ?: 0}",
                                                color = SaffronGold,
                                                fontSize = 32.sp,
                                                fontWeight = FontWeight.Black
                                            )
                                            Spacer(Modifier.width(8.dp))
                                            Text(
                                                "≈ ₹${(wd?.balance?.availableCoins ?: 0) * (wd?.coinToInrRate ?: 0.01)}",
                                                color = SuccessGreen,
                                                fontSize = 16.sp,
                                                fontWeight = FontWeight.Bold,
                                                modifier = Modifier.padding(bottom = 4.dp)
                                            )
                                        }
                                        Spacer(Modifier.height(14.dp))
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                                        ) {
                                            Button(
                                                onClick = onWithdrawal,
                                                modifier = Modifier.weight(1f).height(44.dp),
                                                shape = RoundedCornerShape(12.dp),
                                                colors = ButtonDefaults.buttonColors(containerColor = SaffronGold)
                                            ) {
                                                Text("Withdraw", color = Background, fontWeight = FontWeight.Black, fontSize = 13.sp)
                                            }
                                            Button(
                                                onClick = onKyc,
                                                modifier = Modifier.weight(1f).height(44.dp),
                                                shape = RoundedCornerShape(12.dp),
                                                colors = ButtonDefaults.buttonColors(containerColor = SurfaceElevated)
                                            ) {
                                                Text("KYC Status", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                            }
                                        }
                                    }
                                }
                            }

                            // Quick Stats Grid
                            item {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                                ) {
                                    StatBox(
                                        title = "Rooms Hosted",
                                        value = "${db?.analytics?.totalRoomsHosted ?: 0}",
                                        glyph = "🎙️",
                                        modifier = Modifier.weight(1f)
                                    )
                                    StatBox(
                                        title = "Live Hours",
                                        value = "${db?.analytics?.totalLiveMinutes?.let { it / 60 } ?: 0}h",
                                        glyph = "⏱️",
                                        modifier = Modifier.weight(1f)
                                    )
                                    StatBox(
                                        title = "Supporters",
                                        value = "${db?.analytics?.uniqueSupporters ?: 0}",
                                        glyph = "👑",
                                        modifier = Modifier.weight(1f)
                                    )
                                }
                            }

                            // Host Level Progress
                            if (exp != null) {
                                item {
                                    GlassCard(Modifier.fillMaxWidth()) {
                                        Text("Host Level & XP", color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                                        Spacer(Modifier.height(6.dp))
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Text(exp.level.title.ifBlank { "Rising Host" }, color = Pink, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                            Spacer(Modifier.weight(1f))
                                            Text("Level ${exp.level.level}", color = SaffronGold, fontWeight = FontWeight.Black, fontSize = 14.sp)
                                        }
                                        Spacer(Modifier.height(8.dp))
                                        val progress = if (exp.level.nextLevelXp > 0) {
                                            exp.level.currentXp.toFloat() / exp.level.nextLevelXp.toFloat()
                                        } else 1f
                                        LinearProgressIndicator(
                                            progress = { progress.coerceIn(0f, 1f) },
                                            modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)),
                                            color = Pink,
                                            trackColor = SurfaceElevated
                                        )
                                        Spacer(Modifier.height(4.dp))
                                        Text("${exp.level.currentXp} / ${exp.level.nextLevelXp} XP to Level ${exp.level.level + 1}", color = TextMuted, fontSize = 11.sp)
                                    }
                                }
                            }

                            // Top Supporters Section
                            item {
                                Text("Top Supporters", color = TextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Black)
                                Spacer(Modifier.height(8.dp))
                                val supporters = db?.topSupporters ?: emptyList()
                                if (supporters.isEmpty()) {
                                    GlassCard(Modifier.fillMaxWidth()) {
                                        Text("Host your first room to receive gifts from fans!", color = TextMuted, fontSize = 13.sp)
                                    }
                                } else {
                                    supporters.forEachIndexed { index, supporter ->
                                        GlassCard(
                                            modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp)
                                        ) {
                                            Row(verticalAlignment = Alignment.CenterVertically) {
                                                Text(
                                                    when (index) {
                                                        0 -> "🥇"
                                                        1 -> "🥈"
                                                        2 -> "🥉"
                                                        else -> "#${index + 1}"
                                                    },
                                                    fontSize = 18.sp,
                                                    fontWeight = FontWeight.Bold
                                                )
                                                Spacer(Modifier.width(12.dp))
                                                Column(Modifier.weight(1f)) {
                                                    Text(supporter.user?.name ?: "Anonymous", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                                    Text("${supporter.giftCount} gifts sent", color = TextMuted, fontSize = 11.sp)
                                                }
                                                Text("🪙 ${supporter.totalCoins}", color = Gold, fontWeight = FontWeight.Black, fontSize = 14.sp)
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
    }
}

@Composable
private fun StatBox(
    title: String,
    value: String,
    glyph: String,
    modifier: Modifier = Modifier
) {
    GlassCard(modifier = modifier) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
            Text(glyph, fontSize = 22.sp)
            Spacer(Modifier.height(4.dp))
            Text(value, color = TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Black)
            Text(title, color = TextMuted, fontSize = 10.sp, maxLines = 1)
        }
    }
}
