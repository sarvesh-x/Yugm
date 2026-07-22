package com.example.yugm.feature.social.screens

import android.widget.Toast
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.core.api.YugmApi
import com.example.yugm.core.model.WaveNudge
import com.example.yugm.core.ui.components.Avatar
import com.example.yugm.core.ui.components.GlassButton
import com.example.yugm.core.ui.components.GlassCard
import com.example.yugm.core.ui.components.YugmAmbientBackground
import com.example.yugm.core.ui.theme.*
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

@Composable
fun WaveInboxScreen(
    token: String,
    onBack: () -> Unit,
    onOpenProfile: (String) -> Unit
) {
    val context = LocalContext.current
    var waves by remember { mutableStateOf<List<WaveNudge>>(emptyList()) }
    var unreadCount by remember { mutableStateOf(0) }
    var isLoading by remember { mutableStateOf(true) }

    fun load() {
        runCatching {
            waves = YugmApi.SocialApi.getWaves(token)
            unreadCount = YugmApi.SocialApi.getUnreadWaveCount(token)
        }
        isLoading = false
    }

    LaunchedEffect(token) { load() }

    YugmAmbientBackground {
        Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Wave Inbox", color = TextPrimary, fontSize = 24.sp, fontWeight = FontWeight.Black)
                if (unreadCount > 0) {
                    Text("$unreadCount new", color = Gold, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                }
            }
            Spacer(Modifier.height(16.dp))

            if (isLoading) {
                com.example.yugm.core.ui.components.LoadingState("Loading waves...")
            } else if (waves.isEmpty()) {
                GlassCard {
                    Text("No waves yet", color = TextPrimary, fontWeight = FontWeight.Black, fontSize = 18.sp)
                    Text("When someone waves at you, it'll appear here", color = TextMuted, fontSize = 14.sp)
                }
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    items(waves, key = { it.id }) { wave ->
                        val sender = wave.senderId
                        val typeLabel = when (wave.type) {
                            "nudge" -> "nudged you"
                            "vibe_ping" -> "sent a vibe ping"
                            else -> "waved at you"
                        }
                        val dateStr = try {
                            val fmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
                            fmt.timeZone = TimeZone.getTimeZone("UTC")
                            val out = SimpleDateFormat("MMM d, h:mm a", Locale.US)
                            out.format(fmt.parse(wave.createdAt.take(19)) ?: return@items)
                        } catch (_: Exception) { wave.createdAt.take(10) }

                        GlassCard(
                            modifier = Modifier.fillMaxWidth(),
                            onClick = { wave.senderId?.let { onOpenProfile(it._id) } }
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                Avatar(
                                    initial = sender?.name?.firstOrNull()?.toString() ?: "?",
                                    size = 44,
                                    imageUrl = sender?.avatar
                                )
                                Column(Modifier.weight(1f)) {
                                    Text(sender?.name ?: "Someone", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                    Text(typeLabel, color = TextMuted, fontSize = 13.sp)
                                    Text(dateStr, color = TextMuted, fontSize = 11.sp)
                                }
                                if (!wave.read) {
                                    Box(
                                        modifier = Modifier
                                            .size(10.dp)
                                            .clip(RoundedCornerShape(5.dp))
                                            .background(Gold)
                                    )
                                }
                            }
                        }

                        if (!wave.read) {
                            LaunchedEffect(wave.id) {
                                runCatching { YugmApi.SocialApi.markWaveRead(token, wave.id) }
                            }
                        }
                    }
                }
            }

            Spacer(Modifier.weight(1f))
            GlassButton(text = "Back", gradient = androidx.compose.ui.graphics.Brush.horizontalGradient(listOf(Purple, Pink)), onClick = onBack)
        }
    }
}
