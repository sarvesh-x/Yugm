package com.example.yugm.feature.social.screens

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.core.api.YugmApi
import com.example.yugm.core.model.WatchParty
import com.example.yugm.core.ui.components.GlassCard
import com.example.yugm.core.ui.components.GradientAction
import com.example.yugm.core.ui.components.LoadingState
import com.example.yugm.core.ui.components.YugmAmbientBackground
import com.example.yugm.core.ui.components.YugmPageHeader
import com.example.yugm.core.ui.theme.Danger
import com.example.yugm.core.ui.theme.Gold
import com.example.yugm.core.ui.theme.Panel
import com.example.yugm.core.ui.theme.PanelStrong
import com.example.yugm.core.ui.theme.Pink
import com.example.yugm.core.ui.theme.Success
import com.example.yugm.core.ui.theme.TextMuted
import com.example.yugm.core.ui.theme.TextPrimary
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun WatchPartyPlayerScreen(
    token: String,
    roomId: String,
    onBack: () -> Unit,
    onStop: () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var watchParty by remember { mutableStateOf<WatchParty?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var isPlaying by remember { mutableStateOf(false) }
    var position by remember { mutableStateOf(0.0) }
    var busy by remember { mutableStateOf(false) }

    fun loadWatchParty() {
        scope.launch {
            isLoading = true
            runCatching {
                val wp = withContext(Dispatchers.IO) { YugmApi.watchPartyGet(token, roomId) }
                watchParty = wp
                isPlaying = wp.isPlaying
                position = wp.position
            }
            isLoading = false
        }
    }

    LaunchedEffect(roomId) { loadWatchParty() }

    YugmAmbientBackground {
        Column(Modifier.fillMaxSize()) {
            YugmPageHeader("Watch Party", "Synchronized playback", onBack = onBack)

            if (isLoading) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    LoadingState("Loading watch party...")
                }
            } else {
                val wp = watchParty
                if (wp == null) {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text("Watch party not found", color = TextMuted)
                    }
                } else {
                    Column(
                        Modifier.fillMaxSize().padding(20.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        GlassCard {
                            Text(wp.title, color = TextPrimary, fontSize = 22.sp, fontWeight = FontWeight.Black, maxLines = 2, overflow = TextOverflow.Ellipsis)
                            Text(wp.mediaUrl, color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp), maxLines = 2, overflow = TextOverflow.Ellipsis)
                        }

                        GlassCard {
                            Text("Position", color = TextMuted, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            Spacer(Modifier.height(8.dp))
                            Slider(
                                value = position.toFloat(),
                                onValueChange = { position = it.toDouble() },
                                valueRange = 0f..100f,
                                colors = SliderDefaults.colors(
                                    thumbColor = Gold,
                                    activeTrackColor = Gold,
                                    inactiveTrackColor = PanelStrong
                                )
                            )
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("%.1f%%".format(position), color = TextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                                Text(if (isPlaying) "Playing" else "Paused", color = if (isPlaying) Success else TextMuted, fontSize = 12.sp)
                            }
                        }

                        GradientAction(
                            label = if (isPlaying) "Pause" else "Play",
                            modifier = Modifier.fillMaxWidth(),
                            onClick = {
                                val newPlaying = !isPlaying
                                isPlaying = newPlaying
                                scope.launch {
                                    runCatching {
                                        withContext(Dispatchers.IO) { YugmApi.watchPartySync(token, roomId, position, newPlaying) }
                                    }
                                }
                            }
                        )

                        Button(
                            onClick = {
                                if (busy) return@Button
                                busy = true
                                scope.launch {
                                    runCatching {
                                        withContext(Dispatchers.IO) { YugmApi.watchPartyStop(token, roomId) }
                                    }
                                }
                                onStop()
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = Danger),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth().height(52.dp)
                        ) {
                            Text(if (busy) "Stopping..." else "Stop Watch Party", color = Color.White, fontWeight = FontWeight.Black)
                        }
                    }
                }
            }
        }
    }
}
