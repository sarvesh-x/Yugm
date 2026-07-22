package com.example.yugm.feature.profile.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.core.model.Host
import com.example.yugm.core.ui.components.Avatar
import com.example.yugm.core.ui.components.GlassCard
import com.example.yugm.core.ui.components.StatCard
import com.example.yugm.core.ui.theme.Gold
import com.example.yugm.core.ui.theme.Ink
import com.example.yugm.core.ui.theme.Line
import com.example.yugm.core.ui.theme.TextMuted
import com.example.yugm.core.ui.theme.TextPrimary

@Composable
fun ProfileScreen(
    host: Host?,
    isOwnProfile: Boolean = false,
    followBusy: Boolean = false,
    onFollowToggle: () -> Unit = {},
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
        if (!isOwnProfile) {
            item {
                if (host.isFollowing) {
                    OutlinedButton(
                        onClick = onFollowToggle,
                        enabled = !followBusy,
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = TextPrimary),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Line),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(if (followBusy) "Updating..." else "Following", fontWeight = FontWeight.Black)
                    }
                } else {
                    Button(
                        onClick = onFollowToggle,
                        enabled = !followBusy,
                        colors = ButtonDefaults.buttonColors(containerColor = Gold, contentColor = Ink),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(if (followBusy) "Following..." else "Follow", fontWeight = FontWeight.Black)
                    }
                }
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
