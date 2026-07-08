package com.example.yugm.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.model.Host
import com.example.yugm.ui.components.Avatar
import com.example.yugm.ui.components.GlassCard
import com.example.yugm.ui.components.StatCard
import com.example.yugm.ui.theme.TextMuted
import com.example.yugm.ui.theme.TextPrimary

@Composable
fun ProfileScreen(
    host: Host?,
    isOwnProfile: Boolean = false,
    onSettings: () -> Unit = {}
) {
    if (host == null) return

    LazyColumn(
        contentPadding = PaddingValues(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        modifier = Modifier.fillMaxSize()
    ) {
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Avatar(
                    initial = host.name.firstOrNull()?.toString() ?: "?",
                    size = 84,
                    imageUrl = host.avatar,
                    cosmetics = host.activeCosmetics
                )
                Column {
                    Text(host.name, color = TextPrimary, fontSize = 28.sp, fontWeight = FontWeight.Black)
                    Text("@${host.username}", color = TextMuted)
                }
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                StatCard("Followers", host.followers.toString(), Modifier.weight(1f))
                StatCard("Following", host.followingCount.toString(), Modifier.weight(1f))
            }
        }
        item {
            GlassCard {
                Text("Bio", color = TextPrimary, fontWeight = FontWeight.Bold)
                Text(host.bio ?: "No bio yet.", color = TextMuted, modifier = Modifier.padding(top = 4.dp))
            }
        }
    }
}
