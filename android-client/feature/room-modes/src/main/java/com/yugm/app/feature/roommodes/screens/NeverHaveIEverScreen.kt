package com.yugm.app.feature.roommodes.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yugm.app.core.model.RoomModeState
import com.yugm.app.core.ui.components.AnimatedEntrance
import com.yugm.app.core.ui.components.GlassButton
import com.yugm.app.core.ui.components.GlassCard
import com.yugm.app.core.ui.theme.*

@Composable
fun NeverHaveIEverScreen(
    modeState: RoomModeState?,
    isHost: Boolean,
    onStart: () -> Unit,
    onNextRound: () -> Unit,
    onSubmitAnswer: (String) -> Unit,
    onEnd: () -> Unit,
    onBack: () -> Unit
) {
    var putFingerDown by remember { mutableStateOf<Boolean?>(null) }
    var submitted by remember { mutableStateOf(false) }
    val scrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0D1B1A))
            .verticalScroll(scrollState)
            .padding(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("←", color = TextPrimary, fontSize = 24.sp,
                modifier = Modifier.clip(CircleShape).clickable { onBack() }.padding(4.dp))
            Text("🫣 Never Have I Ever", color = TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Black)
            if (isHost && modeState?.status != "FINISHED") {
                Text("End", color = Danger, fontWeight = FontWeight.Bold, modifier = Modifier.clickable { onEnd() })
            }
        }

        Spacer(Modifier.height(20.dp))

        if (modeState == null || modeState.status == "WAITING") {
            NeverHaveIEverWaitingView(onStart, isHost)
        } else if (modeState.status == "ACTIVE" || modeState.status == "ROUND_END") {
            val prompt = modeState.currentQuestion ?: "Never have I ever..."

            AnimatedEntrance {
                GlassCard(modifier = Modifier.fillMaxWidth()) {
                    Text("Round ${modeState.round}", color = Gold, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(8.dp))
                    Text("Never have I ever...", color = TextMuted, fontSize = 14.sp)
                    Text(prompt, color = TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Black, lineHeight = 26.sp)
                }
            }

            Spacer(Modifier.height(24.dp))

            if (putFingerDown == null && !submitted && modeState.status == "ACTIVE") {
                Text("Have you done this?", color = TextMuted, fontSize = 14.sp)
                Spacer(Modifier.height(12.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                    Box(
                        modifier = Modifier.weight(1f).height(80.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color(0xFF1A3C3A))
                            .clickable { putFingerDown = true }.padding(16.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("🙋", fontSize = 28.sp)
                            Text("Yes, I have!", color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                    Box(
                        modifier = Modifier.weight(1f).height(80.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color(0xFF0D1B1A))
                            .clickable { putFingerDown = false }.padding(16.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("🤐", fontSize = 28.sp)
                            Text("Put a finger down", color = TextMuted, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            if (putFingerDown != null && !submitted) {
                Spacer(Modifier.height(12.dp))
                GlassButton(
                    text = if (putFingerDown == true) "Yes, I have! Submit" else "Finger down! Submit",
                    onClick = {
                        onSubmitAnswer(if (putFingerDown == true) "yes" else "no")
                        submitted = true
                    }
                )
            }

            if (submitted) {
                GlassCard(modifier = Modifier.fillMaxWidth()) {
                    Text("✓ Submitted!", color = Success, fontWeight = FontWeight.Bold)
                    Text("Waiting for others...", color = TextMuted, fontSize = 13.sp)
                }
            }

            if (isHost && (modeState.status == "ROUND_END" || submitted)) {
                Spacer(Modifier.height(16.dp))
                if (modeState.status != "FINISHED") {
                    GlassButton(text = "Next Prompt →", onClick = {
                        putFingerDown = null; submitted = false; onNextRound()
                    })
                }
            }
        } else if (modeState.status == "FINISHED") {
            NeverHaveIEverFinishedView(modeState, onBack)
        }
    }
}

@Composable
private fun NeverHaveIEverWaitingView(onStart: () -> Unit, isHost: Boolean) {
    Box(modifier = Modifier.fillMaxWidth().padding(vertical = 40.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("🫣", fontSize = 64.sp)
            Spacer(Modifier.height(16.dp))
            Text("Never Have I Ever", color = TextPrimary, fontSize = 24.sp, fontWeight = FontWeight.Black)
            Text("Confess your secrets!", color = TextMuted, fontSize = 14.sp, textAlign = TextAlign.Center)
            Spacer(Modifier.height(24.dp))
            if (isHost) GlassButton(text = "Start Game 🫣", onClick = onStart)
            else Text("Waiting for host to start...", color = TextMuted, fontSize = 14.sp)
        }
    }
}

@Composable
private fun NeverHaveIEverFinishedView(modeState: RoomModeState, onBack: () -> Unit) {
    Box(modifier = Modifier.fillMaxWidth().padding(vertical = 40.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("🎉", fontSize = 64.sp)
            Text("Game Over!", color = Gold, fontSize = 22.sp, fontWeight = FontWeight.Black)
            Text("${modeState.round} prompts played", color = TextMuted, fontSize = 14.sp)
            Spacer(Modifier.height(20.dp))
            GlassButton(text = "Back to Room", onClick = onBack)
        }
    }
}
