package com.yugm.app.feature.roommodes.screens

import androidx.compose.animation.core.*
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
import androidx.compose.ui.draw.alpha
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
import com.yugm.app.core.ui.components.YugmTextField
import com.yugm.app.core.ui.theme.*

@Composable
fun BlindDateScreen(
    modeState: RoomModeState?,
    isHost: Boolean,
    onStart: () -> Unit,
    onNextRound: () -> Unit,
    onSubmitAnswer: (String) -> Unit,
    onEnd: () -> Unit,
    onBack: () -> Unit
) {
    var answer by remember { mutableStateOf("") }
    var submitted by remember { mutableStateOf(false) }
    val scrollState = rememberScrollState()
    val revealed = modeState?.metadata?.get("hostRevealed") == true
    val countdown = (modeState?.metadata?.get("revealCountdown") as? Number)?.toInt() ?: 3

    val maskAlpha = if (LocalMotionEnabled.current) {
        val pulseAnim = rememberInfiniteTransition(label = "blind-date-mask")
        val animatedAlpha by pulseAnim.animateFloat(
            initialValue = 0.6f, targetValue = 1f,
            animationSpec = infiniteRepeatable(tween(800), RepeatMode.Reverse),
            label = "mask-alpha"
        )
        animatedAlpha
    } else 0.8f

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(if (revealed) Background else Color(0xFF1A0A2E))
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
            Text("🎭 Blind Date", color = TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Black)
            if (isHost && modeState?.status != "FINISHED") {
                Text("End", color = Danger, fontWeight = FontWeight.Bold, modifier = Modifier.clickable { onEnd() })
            }
        }

        Spacer(Modifier.height(20.dp))

        if (modeState == null || modeState.status == "WAITING") {
            BlindDateWaitingView(onStart, isHost)
        } else if (modeState.status == "ACTIVE" || modeState.status == "ROUND_END") {
            if (!revealed) {
                Box(
                    modifier = Modifier.fillMaxWidth().height(200.dp).clip(RoundedCornerShape(24.dp))
                        .background(Color(0xFF2D1B69)),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("🎭", fontSize = 72.sp, modifier = Modifier.alpha(maskAlpha))
                        Spacer(Modifier.height(8.dp))
                        Text("Hidden", color = TextMuted, fontSize = 12.sp)
                        Text("${countdown} questions until reveal", color = Gold, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    }
                }
            } else {
                Box(
                    modifier = Modifier.fillMaxWidth().height(200.dp).clip(RoundedCornerShape(24.dp))
                        .background(Background),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("🎉", fontSize = 72.sp)
                        Text("Revealed!", color = Gold, fontSize = 18.sp, fontWeight = FontWeight.Black)
                    }
                }
            }

            Spacer(Modifier.height(16.dp))

            val question = modeState.currentQuestion ?: "Tell us something about yourself!"
            GlassCard(modifier = Modifier.fillMaxWidth()) {
                Text("Round ${modeState.round}", color = Gold, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                Text(question, color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold, lineHeight = 22.sp)
            }

            Spacer(Modifier.height(16.dp))

            if (!submitted && modeState.status == "ACTIVE") {
                YugmTextField(value = answer, onValueChange = { answer = it.take(280) }, label = "Your answer")
                Spacer(Modifier.height(12.dp))
                GlassButton(text = "Send Answer", onClick = {
                    if (answer.isNotBlank()) { onSubmitAnswer(answer.trim()); submitted = true }
                }, enabled = answer.isNotBlank())
            } else if (submitted) {
                GlassCard(modifier = Modifier.fillMaxWidth()) {
                    Text("✓ Answer submitted!", color = Success, fontWeight = FontWeight.Bold)
                }
            }

            if (isHost && modeState.status == "ROUND_END") {
                Spacer(Modifier.height(16.dp))
                GlassButton(text = "Next Question →", onClick = { submitted = false; answer = ""; onNextRound() })
            }
        } else if (modeState.status == "FINISHED") {
            BlindDateFinishedView(onBack)
        }
    }
}

@Composable
private fun BlindDateWaitingView(onStart: () -> Unit, isHost: Boolean) {
    Box(modifier = Modifier.fillMaxWidth().padding(vertical = 40.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("🎭", fontSize = 64.sp)
            Spacer(Modifier.height(16.dp))
            Text("Blind Date", color = TextPrimary, fontSize = 24.sp, fontWeight = FontWeight.Black)
            Text("Meet someone new! Avatars hidden until reveal.", color = TextMuted, fontSize = 14.sp, textAlign = TextAlign.Center)
            Spacer(Modifier.height(24.dp))
            if (isHost) GlassButton(text = "Start Blind Date 🎭", onClick = onStart)
            else Text("Waiting for host to start...", color = TextMuted, fontSize = 14.sp)
        }
    }
}

@Composable
private fun BlindDateFinishedView(onBack: () -> Unit) {
    Box(modifier = Modifier.fillMaxWidth().padding(vertical = 40.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("🎉", fontSize = 64.sp)
            Spacer(Modifier.height(12.dp))
            Text("Blind Date Complete!", color = Gold, fontSize = 22.sp, fontWeight = FontWeight.Black)
            Spacer(Modifier.height(20.dp))
            GlassButton(text = "Back to Room", onClick = onBack)
        }
    }
}
