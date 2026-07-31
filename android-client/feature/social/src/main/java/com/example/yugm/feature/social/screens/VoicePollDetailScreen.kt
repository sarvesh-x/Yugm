package com.example.yugm.feature.social.screens

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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.core.api.SocialApi
import com.example.yugm.core.model.VoicePoll
import com.example.yugm.core.ui.components.GlassButton
import com.example.yugm.core.ui.components.GlassCard
import com.example.yugm.core.ui.components.YugmAmbientBackground
import com.example.yugm.core.ui.theme.*
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

@Composable
fun VoicePollDetailScreen(
    token: String,
    userId: String,
    pollId: String,
    onBack: () -> Unit
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    var poll by remember { mutableStateOf<VoicePoll?>(null) }
    var votedIndex by remember { mutableStateOf(-1) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(pollId) {
        try {
            val resp = SocialApi.getActiveVoicePolls(token, 1, 100)
            poll = resp.polls.find { it.id == pollId }
        } catch (_: Exception) { }
    }

    YugmAmbientBackground {
        Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
            Text("Poll", color = TextPrimary, fontSize = 24.sp, fontWeight = FontWeight.Black)
            Spacer(Modifier.height(16.dp))

            poll?.let { p ->
                GlassCard {
                    Text(p.question, color = TextPrimary, fontWeight = FontWeight.Black, fontSize = 18.sp)
                    Text("by ${p.userName}", color = TextMuted, fontSize = 12.sp)
                    Spacer(Modifier.height(12.dp))
                    val totalVotes = p.options.sumOf { it.votes }
                    p.options.forEachIndexed { idx, opt ->
                        val pct = if (totalVotes > 0) opt.votes * 100f / totalVotes else 0f
                        val isSelected = votedIndex == idx
                        val isVoter = p.voters.any { it == userId }
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(if (isSelected) Purple.copy(alpha = 0.2f) else Panel)
                                .then(
                                    if (!isVoter) Modifier.clickable {
                                        scope.launch {
                                            try {
                                                poll = SocialApi.voteVoicePoll(token, p.id, idx)
                                                votedIndex = idx
                                                Toast.makeText(context, "Vote recorded", android.widget.Toast.LENGTH_SHORT).show()
                                            } catch (_: Exception) { }
                                        }
                                    } else Modifier
                                )
                                .padding(12.dp)
                        ) {
                            Column {
                                Row(
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Text(opt.text, color = if (isSelected) Gold else TextPrimary, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                    Text("${opt.votes} votes", color = TextMuted, fontSize = 12.sp)
                                }
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(6.dp)
                                        .padding(top = 4.dp)
                                        .clip(RoundedCornerShape(3.dp))
                                        .background(SurfaceElevated)
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth(pct / 100f)
                                            .height(6.dp)
                                            .clip(RoundedCornerShape(3.dp))
                                            .background(if (isSelected) Gold else Purple)
                                    )
                                }
                            }
                        }
                    }
                }

                Spacer(Modifier.weight(1f))
            } ?: com.example.yugm.core.ui.components.LoadingState("Loading poll...")

            GlassButton(text = "Back", gradient = androidx.compose.ui.graphics.Brush.horizontalGradient(listOf(Purple, Pink)), onClick = onBack)
        }
    }
}
