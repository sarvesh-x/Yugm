package com.yugm.app.feature.roommodes.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.ui.graphics.Brush
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
fun WouldYouRatherScreen(
    modeState: RoomModeState?,
    isHost: Boolean,
    onStart: () -> Unit,
    onNextRound: () -> Unit,
    onSubmitAnswer: (String) -> Unit,
    onEnd: () -> Unit,
    onBack: () -> Unit
) {
    var chosen by remember { mutableStateOf<String?>(null) }
    var submitted by remember { mutableStateOf(false) }
    val scrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0F1B2D))
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
            Text("🤔 Would You Rather", color = TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Black)
            if (isHost && modeState?.status != "FINISHED") {
                Text("End", color = Danger, fontWeight = FontWeight.Bold, modifier = Modifier.clickable { onEnd() })
            }
        }

        Spacer(Modifier.height(20.dp))

        if (modeState == null || modeState.status == "WAITING") {
            WouldYouRatherWaitingView(onStart, isHost)
        } else if (modeState.status == "ACTIVE" || modeState.status == "ROUND_END") {
            val optionA = modeState.currentOptions?.getOrNull(0) ?: "Option A"
            val optionB = modeState.currentOptions?.getOrNull(1) ?: "Option B"

            AnimatedEntrance {
                GlassCard(modifier = Modifier.fillMaxWidth()) {
                    Text("Round ${modeState.round}", color = Gold, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(8.dp))
                    Text("Would you rather...", color = TextMuted, fontSize = 14.sp)
                }
            }

            Spacer(Modifier.height(20.dp))

            if (chosen == null && !submitted && modeState.status == "ACTIVE") {
                Box(
                    modifier = Modifier.fillMaxWidth().height(120.dp)
                        .clip(RoundedCornerShape(20.dp))
                        .background(Brush.verticalGradient(listOf(Color(0xFF1A3A5C), Color(0xFF0F1B2D))))
                        .border(1.dp, if (chosen == "a") Gold else Line.copy(alpha = 0.3f), RoundedCornerShape(20.dp))
                        .clickable { chosen = "a" }.padding(16.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("Option A", color = Gold, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.height(4.dp))
                        Text(optionA, color = TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
                    }
                }

                Spacer(Modifier.height(12.dp))
                Text("OR", color = TextMuted, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
                Spacer(Modifier.height(12.dp))

                Box(
                    modifier = Modifier.fillMaxWidth().height(120.dp)
                        .clip(RoundedCornerShape(20.dp))
                        .background(Brush.verticalGradient(listOf(Color(0xFF3D1B40), Color(0xFF1B0A2E))))
                        .border(1.dp, if (chosen == "b") Pink else Line.copy(alpha = 0.3f), RoundedCornerShape(20.dp))
                        .clickable { chosen = "b" }.padding(16.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("Option B", color = Pink, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.height(4.dp))
                        Text(optionB, color = TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
                    }
                }

                Spacer(Modifier.height(20.dp))
                GlassButton(
                    text = if (chosen != null) "Submit Choice" else "Tap an option first",
                    onClick = {
                        if (chosen != null) {
                            onSubmitAnswer(chosen!!)
                            submitted = true
                        }
                    },
                    enabled = chosen != null
                )
            }

            if (submitted) {
                GlassCard(modifier = Modifier.fillMaxWidth()) {
                    Text("✓ Voted! ${if (chosen == "a") optionA else optionB}", color = Success, fontWeight = FontWeight.Bold)
                    Text("Waiting for others...", color = TextMuted, fontSize = 13.sp)
                }
            }

            if (isHost && (modeState.status == "ROUND_END" || submitted)) {
                Spacer(Modifier.height(16.dp))
                if (modeState.status != "FINISHED") {
                    GlassButton(text = "Next Round →", onClick = {
                        chosen = null; submitted = false; onNextRound()
                    })
                }
            }
        } else if (modeState.status == "FINISHED") {
            WouldYouRatherFinishedView(modeState, onBack)
        }
    }
}

@Composable
private fun WouldYouRatherWaitingView(onStart: () -> Unit, isHost: Boolean) {
    Box(modifier = Modifier.fillMaxWidth().padding(vertical = 40.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("🤔", fontSize = 64.sp)
            Spacer(Modifier.height(16.dp))
            Text("Would You Rather", color = TextPrimary, fontSize = 24.sp, fontWeight = FontWeight.Black)
            Text("Tough choices await!", color = TextMuted, fontSize = 14.sp, textAlign = TextAlign.Center)
            Spacer(Modifier.height(24.dp))
            if (isHost) GlassButton(text = "Start Game 🤔", onClick = onStart)
            else Text("Waiting for host to start...", color = TextMuted, fontSize = 14.sp)
        }
    }
}

@Composable
private fun WouldYouRatherFinishedView(modeState: RoomModeState, onBack: () -> Unit) {
    Box(modifier = Modifier.fillMaxWidth().padding(vertical = 40.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("🎉", fontSize = 64.sp)
            Text("Game Over!", color = Gold, fontSize = 22.sp, fontWeight = FontWeight.Black)
            Text("${modeState.round} rounds played", color = TextMuted, fontSize = 14.sp)
            Spacer(Modifier.height(20.dp))
            GlassButton(text = "Back to Room", onClick = onBack)
        }
    }
}
