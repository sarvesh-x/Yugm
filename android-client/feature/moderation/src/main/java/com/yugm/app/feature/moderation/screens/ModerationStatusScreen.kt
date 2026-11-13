package com.yugm.app.feature.moderation.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.yugm.app.feature.moderation.viewmodel.ModerationAction
import com.yugm.app.feature.moderation.viewmodel.ModerationViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ModerationStatusScreen(
    token: String,
    onBack: () -> Unit,
    onNavigateToReport: () -> Unit,
    onNavigateToAppeal: () -> Unit,
    viewModel: ModerationViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    viewModel.setToken(token)

    LaunchedEffect(Unit) {
        viewModel.onAction(ModerationAction.LoadStatus)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Safety & Moderation", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    TextButton(onClick = onBack) { Text("Back", color = MaterialTheme.colorScheme.primary) }
                },
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            if (state.isLoading && state.status == null) {
                Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
                return@Column
            }

            if (state.error != null && state.status == null) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF441111)),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(Modifier.padding(16.dp)) {
                        Text("Error loading status", color = Color(0xFFFF6B6B), fontWeight = FontWeight.Bold)
                        Spacer(Modifier.height(4.dp))
                        Text(state.error ?: "", color = Color(0xFFFFAAAA), fontSize = 13.sp)
                    }
                }
                return@Column
            }

            val status = state.status ?: return@Column

            TrustScoreCard(status.trustScore, status.riskLevel)

            if (status.isShadowBanned || status.isChatRestricted || status.isRoomRestricted || status.isWalletFrozen) {
                RestrictionsCard(status)
            }

            StrikesCard(status.moderationStrikes, status.warningCount, status.reportCount, status.suspensionCount)

            ActionButtons(onNavigateToReport, onNavigateToAppeal)

            if (status.pendingAppeals > 0) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF332200)),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Row(
                        Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Box(
                            Modifier.size(40.dp).clip(CircleShape).background(Color(0xFFFFA500)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text("!", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 20.sp)
                        }
                        Column {
                            Text("Pending Appeals", color = Color(0xFFFFA500), fontWeight = FontWeight.Bold)
                            Text("${status.pendingAppeals} appeal(s) awaiting review", color = Color(0xFFFFCC66), fontSize = 13.sp)
                        }
                    }
                }
            }

            if (status.recentActions.isNotEmpty()) {
                Text("Recent Actions", color = MaterialTheme.colorScheme.onBackground, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                status.recentActions.forEach { action ->
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = if (action.automated) Color(0xFF1A1A2E) else Color(0xFF111122),
                        ),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Row(
                                Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                            ) {
                                Text(
                                    action.action,
                                    color = when (action.action) {
                                        "BAN" -> Color(0xFFFF4444)
                                        "SUSPEND" -> Color(0xFFFF8800)
                                        "MUTE" -> Color(0xFFFFAA00)
                                        "WARN" -> Color(0xFFFFCC00)
                                        else -> MaterialTheme.colorScheme.primary
                                    },
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp,
                                )
                                if (action.automated) {
                                    Text("auto", color = Color(0xFF888888), fontSize = 11.sp)
                                }
                            }
                            Text(action.reason, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun TrustScoreCard(score: Int, riskLevel: String) {
    val scoreColor = when {
        score >= 80 -> Color(0xFF4CAF50)
        score >= 50 -> Color(0xFFFFA500)
        score >= 20 -> Color(0xFFFF6600)
        else -> Color(0xFFFF4444)
    }

    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            Modifier.fillMaxWidth().padding(20.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            Box(
                Modifier.size(80.dp).clip(CircleShape).background(
                    Brush.sweepGradient(listOf(scoreColor, scoreColor.copy(alpha = 0.3f)))
                ),
                contentAlignment = Alignment.Center,
            ) {
                Text("$score", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 28.sp)
            }
            Column {
                Text("Trust Score", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Text(
                    when (riskLevel) {
                        "LOW" -> "Good standing"
                        "MEDIUM" -> "Elevated risk"
                        "HIGH" -> "High risk"
                        "CRITICAL" -> "Critical risk"
                        else -> riskLevel
                    },
                    color = scoreColor,
                    fontSize = 14.sp,
                )
            }
        }
    }
}

@Composable
private fun RestrictionsCard(status: com.yugm.app.core.model.ModerationStatusResponse) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xFF220000)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Active Restrictions", color = Color(0xFFFF6666), fontWeight = FontWeight.Bold)
            if (status.isShadowBanned) RestrictionRow("Shadow Banned", "Your content is hidden from most users", Color(0xFFFF4444))
            if (status.isChatRestricted) RestrictionRow("Chat Restricted", "You cannot send messages", Color(0xFFFF8800))
            if (status.isRoomRestricted) RestrictionRow("Room Restricted", "You cannot join or create rooms", Color(0xFFFF8800))
            if (status.isWalletFrozen) RestrictionRow("Wallet Frozen", "Your wallet is temporarily frozen", Color(0xFFFFAA00))
        }
    }
}

@Composable
private fun RestrictionRow(label: String, description: String, color: Color) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Box(Modifier.size(8.dp).clip(CircleShape).background(color))
        Column {
            Text(label, color = color, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            Text(description, color = color.copy(alpha = 0.7f), fontSize = 12.sp)
        }
    }
}

@Composable
private fun StrikesCard(strikes: Int, warnings: Int, reports: Int, suspensions: Int) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Moderation History", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                StatItem("Strikes", "$strikes", if (strikes > 0) Color(0xFFFF6666) else Color(0xFF4CAF50))
                StatItem("Warnings", "$warnings", if (warnings > 0) Color(0xFFFFAA00) else Color(0xFF4CAF50))
                StatItem("Reports", "$reports", if (reports > 0) Color(0xFFFF8800) else Color(0xFF4CAF50))
                StatItem("Suspensions", "$suspensions", if (suspensions > 0) Color(0xFFFF4444) else Color(0xFF4CAF50))
            }
        }
    }
}

@Composable
private fun StatItem(label: String, value: String, color: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, color = color, fontWeight = FontWeight.Bold, fontSize = 22.sp)
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp)
    }
}

@Composable
private fun ActionButtons(onReport: () -> Unit, onAppeal: () -> Unit) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Button(
            onClick = onReport,
            modifier = Modifier.weight(1f),
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFCC3333)),
        ) {
            Text("Report")
        }
        OutlinedButton(
            onClick = onAppeal,
            modifier = Modifier.weight(1f),
        ) {
            Text("Appeal")
        }
    }
}
