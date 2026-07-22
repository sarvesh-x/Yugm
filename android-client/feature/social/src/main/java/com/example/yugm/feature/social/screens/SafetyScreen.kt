package com.example.yugm.feature.social.screens

import androidx.compose.foundation.clickable
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
import com.example.yugm.core.ui.components.GlassCard
import com.example.yugm.core.ui.components.LoadingState
import com.example.yugm.core.ui.theme.*
import com.example.yugm.feature.social.viewmodel.SocialViewModel
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SafetyScreen(
    token: String,
    onNavigateToBlocked: () -> Unit,
    onBack: () -> Unit,
    viewModel: SocialViewModel = hiltViewModel()
) {
    LaunchedEffect(token) {
        viewModel.loadSafetyCenter(token)
        viewModel.loadBlockedUsers(token)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Safety & Moderation", color = Color.White, fontWeight = FontWeight.Bold) },
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
        if (viewModel.isLoading) {
            Box(Modifier.fillMaxSize().padding(innerPadding), contentAlignment = Alignment.Center) {
                LoadingState("Loading safety center...")
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(innerPadding),
                contentPadding = PaddingValues(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                item {
                    Text("Safety Center", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Black)
                    Text("Yugm is built on mutual respect and safe vibe matching.", color = TextMuted, fontSize = 14.sp, modifier = Modifier.padding(top = 4.dp))
                }

                item {
                    GlassCard(Modifier.fillMaxWidth()) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Column {
                    Text("Trust Status", color = Color.White, fontWeight = FontWeight.Bold)
                            Text(viewModel.trustLabel, color = if (viewModel.trustLabel == "Good standing") Gold else DangerRed, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 2.dp))
                            }
                            if (viewModel.moderationStrikes > 0) {
                                Column(horizontalAlignment = Alignment.End) {
                                    Text("Strikes", color = TextMuted, fontSize = 12.sp)
                                    Text("${viewModel.moderationStrikes}", color = DangerRed, fontWeight = FontWeight.Black)
                                }
                            }
                        }
                    }
                }

                item {
                    GlassCard(Modifier.fillMaxWidth().clickable { onNavigateToBlocked() }) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Column {
                                Text("Blocked Users", color = Color.White, fontWeight = FontWeight.Bold)
                                Text(if (viewModel.blockedUsers.size > 0) "${viewModel.blockedUsers.size} users blocked" else "No users blocked", color = TextMuted, fontSize = 12.sp)
                            }
                            Text("❯", color = Gold, fontWeight = FontWeight.Bold)
                        }
                    }
                }

                    if (viewModel.safetyChecklist.isNotEmpty()) {
                    item { Text("Safety Checklist", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp) }
                    items(viewModel.safetyChecklist.size) { index ->
                        val (title, done) = viewModel.safetyChecklist[index]
                        GlassCard(Modifier.fillMaxWidth()) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(if (done) "✓" else "○", color = if (done) Gold else TextMuted, fontSize = 18.sp, modifier = Modifier.padding(end = 10.dp))
                                Text(title, color = Color.White, fontSize = 13.sp)
                            }
                        }
                    }
                }

                item { Text("Safety Tips", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp) }
                listOf(
                    "🔒 Keep private info private. Never share OTPs, addresses, or financial data on call or chat.",
                    "🚫 No matrimonial pressure. Report anyone pitching matrimonial matches or asking inappropriate details.",
                    "💬 Vibe check before offline meetings. Talk extensively in public rooms before moving offline.",
                    "🛡️ You are in control. Block anyone instantly using the top right options or within their profile details."
                ).forEach { tip ->
                    item { GlassCard(Modifier.fillMaxWidth()) { Text(tip, color = Color.White, fontSize = 13.sp, lineHeight = 18.sp) } }
                }

                item { Text("Community Guidelines", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp) }
                listOf(
                    "🤝 Respect everyone. Bullying, harassment, or verbal abuse is strictly prohibited.",
                    "🔞 18+ Age Gate. You must be over 18 to matching the vibe on Yugm. No kids/minors allowed.",
                    "❌ Zero nudity policy. NSFW files, profiles, or room title violations lead to permanent bans."
                ).forEach { guideline ->
                    item { GlassCard(Modifier.fillMaxWidth()) { Text(guideline, color = Color.White, fontSize = 13.sp, lineHeight = 18.sp) } }
                }
            }
        }
    }
}
