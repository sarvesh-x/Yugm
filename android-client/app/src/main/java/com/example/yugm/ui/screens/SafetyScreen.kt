package com.example.yugm.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.ui.components.GlassCard
import com.example.yugm.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SafetyScreen(
    onNavigateToBlocked: () -> Unit,
    onBack: () -> Unit
) {
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
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
            contentPadding = PaddingValues(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // General Title
            item {
                Text(
                    text = "Safety Center",
                    color = Color.White,
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Black
                )
                Text(
                    text = "Yugm is built on mutual respect and safe vibe matching. Here is how we protect you.",
                    color = TextMuted,
                    fontSize = 14.sp,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }

            // Blocked Users Shortcut
            item {
                GlassCard(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onNavigateToBlocked() }
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text("Blocked Users", color = Color.White, fontWeight = FontWeight.Bold)
                            Text("Unblock people you have previously blocked.", color = TextMuted, fontSize = 12.sp)
                        }
                        Text("❯", color = Gold, fontWeight = FontWeight.Bold)
                    }
                }
            }

            // Safety Tips
            item {
                Text("Safety Tips", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            }

            listOf(
                "🔒 Keep private info private. Never share OTPs, addresses, or financial data on call or chat.",
                "🚫 No matrimonial pressure. Report anyone pitching matrimonial matches or asking inappropriate details.",
                "💬 Vibe check before offline meetings. Talk extensively in public rooms before moving offline.",
                "🛡️ You are in control. Block anyone instantly using the top right options or within their profile details."
            ).forEach { tip ->
                item {
                    GlassCard(modifier = Modifier.fillMaxWidth()) {
                        Text(tip, color = Color.White, fontSize = 13.sp, lineHeight = 18.sp)
                    }
                }
            }

            // Community Guidelines
            item {
                Text("Community Guidelines", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            }

            listOf(
                "🤝 Respect everyone. Bullying, harassment, or verbal abuse is strictly prohibited.",
                "🔞 18+ Age Gate. You must be over 18 to matching the vibe on Yugm. No kids/minors allowed.",
                "❌ Zero nudity policy. NSFW files, profiles, or room title violations lead to permanent bans."
            ).forEach { guideline ->
                item {
                    GlassCard(modifier = Modifier.fillMaxWidth()) {
                        Text(guideline, color = Color.White, fontSize = 13.sp, lineHeight = 18.sp)
                    }
                }
            }
        }
    }
}
