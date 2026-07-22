package com.example.yugm.feature.social.screens

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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.example.yugm.core.model.Host
import com.example.yugm.core.ui.components.Avatar
import com.example.yugm.core.ui.components.GlassCard
import com.example.yugm.core.ui.components.LoadingState
import com.example.yugm.core.ui.components.SectionTitle
import com.example.yugm.core.ui.components.YugmAmbientBackground
import com.example.yugm.core.ui.components.YugmPageHeader
import com.example.yugm.feature.social.viewmodel.SocialViewModel
import com.example.yugm.core.ui.theme.BorderColor
import com.example.yugm.core.ui.theme.SurfaceElevated
import com.example.yugm.core.ui.theme.TextMuted
import com.example.yugm.core.ui.theme.TextPrimary

@Composable
fun HostsScreen(
    token: String,
    onBack: () -> Unit,
    onOpenProfile: (String) -> Unit
) {
    val viewModel: SocialViewModel = hiltViewModel()

    LaunchedEffect(token) { viewModel.loadHosts(token) }

    YugmAmbientBackground {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 30.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                YugmPageHeader("Hosts", onBack = onBack)
            }
            if (viewModel.isLoading) {
                item { Box(Modifier.padding(horizontal = 20.dp)) { LoadingState("Loading hosts...") } }
            } else if (viewModel.suggestedHosts.isEmpty()) {
                item {
                    Box(Modifier.padding(horizontal = 20.dp)) {
                        GlassCard {
                            Text("No hosts found.", color = TextPrimary, fontWeight = FontWeight.Black)
                        }
                    }
                }
            } else {
                item {
                    Box(Modifier.padding(horizontal = 20.dp)) {
                        SectionTitle("Suggested Hosts")
                    }
                }
                items(viewModel.suggestedHosts, key = { it.id }) { host ->
                    HostRow(host = host, onClick = { onOpenProfile(host.id) })
                }
            }
        }
    }
}

@Composable
private fun HostRow(host: Host, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .padding(horizontal = 20.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(SurfaceElevated)
            .clickable(onClick = onClick)
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Avatar(
            initial = host.name.firstOrNull()?.toString() ?: "?",
            size = 48,
            imageUrl = host.avatar,
            cosmetics = host.activeCosmetics
        )
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(host.name, color = TextPrimary, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (host.username.isNotBlank()) {
                Text("@${host.username}", color = TextMuted, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
        Text("›", color = TextMuted, fontSize = 20.sp, fontWeight = FontWeight.Bold)
    }
}
