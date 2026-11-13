package com.yugm.app.feature.social.screens

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import kotlinx.coroutines.launch
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yugm.app.core.api.SocialApi
import com.yugm.app.core.model.VoicePoll
import com.yugm.app.core.model.VoicePollListResponse
import com.yugm.app.core.ui.components.Avatar
import com.yugm.app.core.ui.components.GlassButton
import com.yugm.app.core.ui.components.GlassCard
import com.yugm.app.core.ui.components.GlassTextField
import com.yugm.app.core.ui.components.YugmAmbientBackground
import com.yugm.app.core.ui.theme.*
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

@Composable
fun VoicePollScreen(
    token: String,
    onBack: () -> Unit,
    onPollDetail: (String) -> Unit
) {
    var polls by remember { mutableStateOf<VoicePollListResponse?>(null) }
    var showCreate by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(true) }
    val scope = rememberCoroutineScope()

    fun load() {
        scope.launch {
            try { polls = SocialApi.getActiveVoicePolls(token) } catch (_: Exception) { }
            isLoading = false
        }
    }

    LaunchedEffect(token) { load() }

    YugmAmbientBackground {
        Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Voice Polls", color = TextPrimary, fontSize = 24.sp, fontWeight = FontWeight.Black)
                GlassButton(
                    text = if (showCreate) "Cancel" else "Create",
                    height = 40.dp,
                    gradient = androidx.compose.ui.graphics.Brush.horizontalGradient(listOf(Purple, Pink)),
                    onClick = { showCreate = !showCreate }
                )
            }
            Spacer(Modifier.height(16.dp))

            if (showCreate) {
                CreatePollSection(token, onCreated = { showCreate = false; load() })
                Spacer(Modifier.height(16.dp))
            }

            if (isLoading) {
                com.yugm.app.core.ui.components.LoadingState("Loading polls...")
            } else {
                val list = polls
                if (list == null || list.polls.isEmpty()) {
                    GlassCard {
                        Text("No active polls", color = TextPrimary, fontWeight = FontWeight.Black, fontSize = 16.sp)
                        Text("Create one to start the conversation", color = TextMuted, fontSize = 13.sp)
                    }
                } else {
                    LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        items(list.polls, key = { it.id }) { poll ->
                            val totalVotes = poll.options.sumOf { it.votes }
                            GlassCard(
                                modifier = Modifier.fillMaxWidth(),
                                onClick = { onPollDetail(poll.id) }
                            ) {
                                Row(
                                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Avatar(poll.userName.firstOrNull()?.toString() ?: "?", 36, imageUrl = poll.userAvatar)
                                    Column(Modifier.weight(1f)) {
                                        Text(poll.userName, color = TextMuted, fontSize = 12.sp)
                                        Text(poll.question, color = TextPrimary, fontWeight = FontWeight.Black, fontSize = 15.sp)
                                        Text("${poll.options.size} options \u00B7 $totalVotes votes", color = TextMuted, fontSize = 12.sp)
                                    }
                                }
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

@Composable
private fun CreatePollSection(
    token: String,
    onCreated: () -> Unit
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    var question by remember { mutableStateOf("") }
    var options by remember { mutableStateOf(listOf("", "")) }
    var expiresInHours by remember { mutableStateOf("24") }
    val scope = rememberCoroutineScope()

    GlassCard {
        Text("New Poll", color = Gold, fontWeight = FontWeight.Bold, fontSize = 12.sp)
        Spacer(Modifier.height(8.dp))
        GlassTextField(value = question, onValueChange = { question = it }, label = "Your question")
        Spacer(Modifier.height(8.dp))
        options.forEachIndexed { idx, opt ->
            GlassTextField(
                value = opt,
                onValueChange = { v ->
                    val copy = options.toMutableList()
                    copy[idx] = v
                    options = copy
                },
                label = "Option ${idx + 1}"
            )
            Spacer(Modifier.height(6.dp))
        }
        GlassButton(
            text = "+ Add Option",
            gradient = androidx.compose.ui.graphics.Brush.horizontalGradient(listOf(Panel, Panel)),
            height = 42.dp,
            onClick = { options = options + "" }
        )
        Spacer(Modifier.height(8.dp))
        GlassTextField(value = expiresInHours, onValueChange = { expiresInHours = it }, label = "Expires in (hours)")
        Spacer(Modifier.height(12.dp))
        GlassButton(
            text = "Create Poll",
            enabled = question.isNotBlank() && options.count { it.isNotBlank() } >= 2,
            onClick = {
                scope.launch {
                    val validOptions = options.filter { it.isNotBlank() }.map { it to null as String? }
                    try {
                        SocialApi.createVoicePoll(token, question, validOptions, expiresInHours = expiresInHours.toIntOrNull() ?: 24)
                        Toast.makeText(context, "Poll created!", Toast.LENGTH_SHORT).show()
                        onCreated()
                    } catch (_: Exception) { }
                }
            }
        )
    }
}
