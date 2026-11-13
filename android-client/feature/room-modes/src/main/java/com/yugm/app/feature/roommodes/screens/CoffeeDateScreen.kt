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
fun CoffeeDateScreen(
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

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Background)
            .verticalScroll(scrollState)
            .padding(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("←", color = TextPrimary, fontSize = 24.sp,
                modifier = Modifier
                    .clip(CircleShape)
                    .clickable { onBack() }
                    .padding(4.dp))
            Text("☕ Coffee Date", color = TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Black)
            if (isHost && modeState?.status != "FINISHED") {
                Text("End", color = Danger, fontWeight = FontWeight.Bold,
                    modifier = Modifier.clickable { onEnd() })
            }
        }

        Spacer(Modifier.height(20.dp))

        if (modeState == null || modeState.status == "WAITING") {
            CoffeeDateWaitingView(onStart, isHost)
        } else if (modeState.status == "ACTIVE" || modeState.status == "ROUND_END") {
            val question = modeState.currentQuestion ?: "What's on your mind?"
            val answers = modeState.metadata["answers"] as? Map<*, *>
            val answerCount = answers?.size ?: 0

            AnimatedEntrance {
                GlassCard(modifier = Modifier.fillMaxWidth()) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("☕", fontSize = 28.sp)
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text("Question ${modeState.round}", color = Gold, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            Text(question, color = TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Bold, lineHeight = 24.sp)
                        }
                    }
                }
            }

            Spacer(Modifier.height(12.dp))
            Text("${answerCount} / ${modeState.participants.size} answered", color = TextMuted, fontSize = 13.sp)
            Spacer(Modifier.height(16.dp))

            if (!submitted && modeState.status == "ACTIVE") {
                YugmTextField(value = answer, onValueChange = { answer = it.take(280) }, label = "Your answer")
                Spacer(Modifier.height(12.dp))
                GlassButton(text = "Send Answer", onClick = {
                    if (answer.isNotBlank()) { onSubmitAnswer(answer.trim()); submitted = true }
                }, enabled = answer.isNotBlank())
            } else if (submitted || modeState.status == "ROUND_END") {
                GlassCard(modifier = Modifier.fillMaxWidth()) {
                    Text("✓ Answer submitted!", color = Success, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    Text("Waiting for others...", color = TextMuted, fontSize = 13.sp)
                }
            }

            if (isHost && (modeState.status == "ROUND_END" || answerCount >= modeState.participants.size)) {
                Spacer(Modifier.height(16.dp))
                GlassButton(text = "Next Question →", onClick = { submitted = false; answer = ""; onNextRound() })
            }
        } else if (modeState.status == "FINISHED") {
            CoffeeDateFinishedView(modeState, onBack)
        }
    }
}

@Composable
private fun CoffeeDateWaitingView(onStart: () -> Unit, isHost: Boolean) {
    Box(modifier = Modifier.fillMaxWidth().padding(vertical = 40.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("☕", fontSize = 64.sp)
            Spacer(Modifier.height(16.dp))
            Text("Coffee Date", color = TextPrimary, fontSize = 24.sp, fontWeight = FontWeight.Black)
            Text("Get to know someone over virtual coffee", color = TextMuted, fontSize = 14.sp, textAlign = TextAlign.Center)
            Spacer(Modifier.height(24.dp))
            if (isHost) GlassButton(text = "Start Coffee Date ☕", onClick = onStart)
            else Text("Waiting for host to start...", color = TextMuted, fontSize = 14.sp)
        }
    }
}

@Composable
private fun CoffeeDateFinishedView(modeState: RoomModeState, onBack: () -> Unit) {
    Box(modifier = Modifier.fillMaxWidth().padding(vertical = 40.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("☕", fontSize = 64.sp)
            Spacer(Modifier.height(12.dp))
            Text("Coffee Date Complete!", color = Gold, fontSize = 22.sp, fontWeight = FontWeight.Black)
            Text("${modeState.round} questions answered", color = TextMuted, fontSize = 14.sp)
            Spacer(Modifier.height(20.dp))
            GlassButton(text = "Back to Room", onClick = onBack)
        }
    }
}
