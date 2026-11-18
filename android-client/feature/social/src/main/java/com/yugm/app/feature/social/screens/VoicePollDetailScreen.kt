package com.yugm.app.feature.social.screens

import com.yugm.app.core.api.SyncTopic
import com.yugm.app.core.ui.components.AutomaticSyncEffect
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
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yugm.app.core.api.SocialApi
import com.yugm.app.core.model.VoicePoll
import com.yugm.app.core.ui.components.GlassButton
import com.yugm.app.core.ui.components.GlassCard
import com.yugm.app.core.ui.components.LoadingState
import com.yugm.app.core.ui.components.YugmAmbientBackground
import com.yugm.app.core.ui.theme.*
import com.yugm.app.core.util.DateUtils
import kotlinx.coroutines.launch

@Composable
fun VoicePollDetailScreen(
    token: String,
    userId: String,
    pollId: String,
    onBack: () -> Unit
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    var poll by remember { mutableStateOf<VoicePoll?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var loadError by remember { mutableStateOf<String?>(null) }
    var votingIndex by remember { mutableStateOf<Int?>(null) }
    var isClosing by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    fun isExpired(p: VoicePoll): Boolean {
        if (p.expiresAt.isBlank()) return false
        return DateUtils.isIsoBeforeNow(p.expiresAt)
    }

    fun loadPoll() {
        scope.launch {
            isLoading = true
            loadError = null
            try {
                poll = SocialApi.getVoicePollById(token, pollId)
            } catch (e: Exception) {
                loadError = e.message ?: "Failed to load poll"
            } finally {
                isLoading = false
            }
        }
    }

    AutomaticSyncEffect(pollId, token, topics = setOf(SyncTopic.SOCIAL), enabled = token.isNotBlank(), isBusy = { isLoading }) { loadPoll() }

    YugmAmbientBackground {
        Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
            Text("Poll", color = TextPrimary, fontSize = 24.sp, fontWeight = FontWeight.Black)
            Spacer(Modifier.height(16.dp))

            when {
                isLoading && (poll == null) -> LoadingState("Loading poll...")
                loadError != null && poll == null -> {
                    GlassCard {
                        Text("Couldn't load poll", color = TextPrimary, fontWeight = FontWeight.Black, fontSize = 16.sp)
                        Text(loadError ?: "Unknown error", color = TextMuted, fontSize = 13.sp, modifier = Modifier.padding(top = 4.dp))
                        Spacer(Modifier.height(12.dp))
                        GlassButton(text = "Retry", onClick = { loadPoll() })
                    }
                }
                poll != null -> {
                    val p = poll!!
                    val totalVotes = p.options.sumOf { it.votes }
                    val expired = isExpired(p)
                    val selectedIndex = p.selectedOptionIndexFor(userId)
                    val hasVoted = selectedIndex != null || p.voters.contains(userId)
                    val canVote = p.isActive && !expired && !hasVoted && votingIndex == null
                    val isOwner = p.userId == userId
                    val canClose = isOwner && p.isActive && !expired && !isClosing

                    GlassCard {
                        Text(p.question, color = TextPrimary, fontWeight = FontWeight.Black, fontSize = 18.sp)
                        if (p.userName.isNotBlank()) {
                            Text("by ${p.userName}", color = TextMuted, fontSize = 12.sp)
                        }
                        val selectedOptionText = selectedIndex?.let { p.options.getOrNull(it)?.text }?.takeIf { it.isNotBlank() }
                        val statusText = when {
                            !p.isActive -> "Poll closed"
                            expired -> "Poll expired"
                            selectedOptionText != null -> "Your vote: $selectedOptionText"
                            hasVoted -> "You voted"
                            else -> "Tap an option to vote"
                        }
                        Text(
                            statusText,
                            color = when {
                                selectedOptionText != null || hasVoted -> Gold
                                canVote -> Cyan
                                else -> TextMuted
                            },
                            fontSize = 12.sp,
                            modifier = Modifier.padding(top = 2.dp)
                        )
                        Spacer(Modifier.height(12.dp))

                        p.options.forEachIndexed { idx, opt ->
                            val pct = if (totalVotes > 0) opt.votes * 100f / totalVotes else 0f
                            val selectedByMe = selectedIndex == idx
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(
                                        when {
                                            votingIndex == idx || selectedByMe -> Purple.copy(alpha = 0.22f)
                                            else -> Panel
                                        }
                                    )
                                    .then(
                                        if (canVote) Modifier.clickable {
                                            votingIndex = idx
                                            scope.launch {
                                                try {
                                                    poll = SocialApi.voteVoicePoll(token, p.id, idx)
                                                    Toast.makeText(context, "Vote recorded", Toast.LENGTH_SHORT).show()
                                                } catch (e: Exception) {
                                                    Toast.makeText(context, e.message ?: "Failed to vote", Toast.LENGTH_SHORT).show()
                                                    try { poll = SocialApi.getVoicePollById(token, pollId) } catch (_: Exception) {}
                                                } finally {
                                                    votingIndex = null
                                                }
                                            }
                                        } else Modifier
                                    )
                                    .padding(12.dp)
                            ) {
                                Column {
                                    Row(
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically,
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Text(
                                            if (selectedByMe) "${opt.text}  ✓" else opt.text,
                                            color = if (selectedByMe) Gold else TextPrimary,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 14.sp,
                                            modifier = Modifier.weight(1f)
                                        )
                                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                            if (votingIndex == idx) {
                                                CircularProgressIndicator(modifier = Modifier.height(14.dp).padding(end = 0.dp), strokeWidth = 2.dp, color = Gold)
                                            }
                                            Text("${opt.votes} votes", color = TextMuted, fontSize = 12.sp)
                                        }
                                    }
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .height(6.dp)
                                            .padding(top = 6.dp)
                                            .clip(RoundedCornerShape(3.dp))
                                            .background(SurfaceElevated)
                                    ) {
                                        Box(
                                            modifier = Modifier
                                                .fillMaxWidth((pct / 100f).coerceIn(0f, 1f))
                                                .height(6.dp)
                                                .clip(RoundedCornerShape(3.dp))
                                                .background(if (hasVoted) Gold else Purple)
                                        )
                                    }
                                }
                            }
                        }
                    }

                    if (isOwner) {
                        Spacer(Modifier.height(12.dp))
                        GlassButton(
                            text = when {
                                !p.isActive || expired -> "Poll closed"
                                isClosing -> "Closing..."
                                else -> "Close poll"
                            },
                            enabled = canClose,
                            gradient = androidx.compose.ui.graphics.Brush.horizontalGradient(
                                if (canClose) listOf(Pink, Purple) else listOf(Panel, Panel)
                            ),
                            onClick = {
                                scope.launch {
                                    isClosing = true
                                    try {
                                        poll = SocialApi.closeVoicePoll(token, pollId)
                                        Toast.makeText(context, "Poll closed", Toast.LENGTH_SHORT).show()
                                    } catch (e: Exception) {
                                        Toast.makeText(context, e.message ?: "Failed to close poll", Toast.LENGTH_SHORT).show()
                                    } finally {
                                        isClosing = false
                                    }
                                }
                            }
                        )
                    }
                }
            }

            Spacer(Modifier.weight(1f))
            GlassButton(text = "Back", gradient = androidx.compose.ui.graphics.Brush.horizontalGradient(listOf(Purple, Pink)), onClick = onBack)
        }
    }
}
