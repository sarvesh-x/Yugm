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
import com.yugm.app.core.ui.components.YugmTextField
import com.yugm.app.core.ui.theme.*

@Composable
fun TruthOrDareScreen(
    modeState: RoomModeState?,
    currentUserId: String,
    isHost: Boolean,
    onStart: () -> Unit,
    onNextRound: () -> Unit,
    onSubmitAnswer: (String) -> Unit,
    onSubmitDare: (String) -> Unit,
    onVote: (String, Int) -> Unit,
    onEnd: () -> Unit,
    onBack: () -> Unit
) {
    var choice by remember { mutableStateOf<String?>(null) }
    var answer by remember { mutableStateOf("") }
    var dareText by remember { mutableStateOf("") }
    var choseAction by remember { mutableStateOf(false) }
    val scrollState = rememberScrollState()
    val isMyTurn = modeState?.currentTurnUserId == currentUserId
    val currentDare = modeState?.metadata?.get("currentDare") as? String

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF1B0A1A))
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
            Text("🎲 Truth or Dare", color = TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Black)
            if (isHost && modeState?.status != "FINISHED") {
                Text("End", color = Danger, fontWeight = FontWeight.Bold, modifier = Modifier.clickable { onEnd() })
            }
        }

        Spacer(Modifier.height(20.dp))

        if (modeState == null || modeState.status == "WAITING") {
            TruthDareWaitingView(onStart, isHost)
        } else if (modeState.status == "ACTIVE") {
            if (isMyTurn && !choseAction) {
                GlassCard(modifier = Modifier.fillMaxWidth()) {
                    Text("🎲 Your turn!", color = Gold, fontSize = 20.sp, fontWeight = FontWeight.Black)
                    Text("Round ${modeState.round}", color = TextMuted, fontSize = 13.sp)
                }
                Spacer(Modifier.height(16.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                    Box(
                        modifier = Modifier.weight(1f).height(80.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(Brush.verticalGradient(listOf(Color(0xFF2D1B69), Color(0xFF1A0533))))
                            .border(1.dp, Gold.copy(alpha = 0.5f), RoundedCornerShape(16.dp))
                            .clickable { choice = "truth" }.padding(16.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("Truth", color = Gold, fontSize = 20.sp, fontWeight = FontWeight.Black)
                            Text("Answer honestly", color = TextMuted, fontSize = 11.sp)
                        }
                    }
                    Box(
                        modifier = Modifier.weight(1f).height(80.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(Brush.verticalGradient(listOf(Color(0xFF3D1B40), Color(0xFF2D0A2E))))
                            .border(1.dp, Pink.copy(alpha = 0.5f), RoundedCornerShape(16.dp))
                            .clickable { choice = "dare" }.padding(16.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("Dare", color = Pink, fontSize = 20.sp, fontWeight = FontWeight.Black)
                            Text("Take the challenge", color = TextMuted, fontSize = 11.sp)
                        }
                    }
                }
            }

            if (choice == "truth" && !choseAction) {
                Spacer(Modifier.height(16.dp))
                YugmTextField(value = answer, onValueChange = { answer = it.take(280) }, label = "Your answer")
                Spacer(Modifier.height(12.dp))
                GlassButton(text = "Submit Truth", onClick = {
                    if (answer.isNotBlank()) { onSubmitAnswer(answer.trim()); choseAction = true }
                }, enabled = answer.isNotBlank())
            }

            if (choice == "dare" && !choseAction) {
                Spacer(Modifier.height(16.dp))
                YugmTextField(value = dareText, onValueChange = { dareText = it.take(280) }, label = "Create a dare")
                Spacer(Modifier.height(12.dp))
                GlassButton(text = "Submit Dare", onClick = {
                    if (dareText.isNotBlank()) { onSubmitDare(dareText.trim()); choseAction = true }
                }, enabled = dareText.isNotBlank())
            }

            if (choseAction) {
                GlassCard(modifier = Modifier.fillMaxWidth()) {
                    Text("✓ Done!", color = Success, fontWeight = FontWeight.Bold)
                    Text("Waiting for round to end...", color = TextMuted, fontSize = 13.sp)
                }
                Spacer(Modifier.height(12.dp))
                if (isHost) {
                    GlassButton(text = "Next Round →", onClick = {
                        choice = null; choseAction = false; answer = ""; dareText = ""; onNextRound()
                    })
                }
            }

            if (isMyTurn && currentDare != null) {
                Spacer(Modifier.height(12.dp))
                GlassCard(modifier = Modifier.fillMaxWidth()) {
                    Text("🎯 Dare: $currentDare", color = Pink, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }
            }

            if (!isMyTurn && choice == null) {
                GlassCard(modifier = Modifier.fillMaxWidth()) {
                    Text("Waiting for player's choice...", color = TextMuted, fontSize = 14.sp)
                }
            }
        } else if (modeState.status == "ROUND_END") {
            GlassCard(modifier = Modifier.fillMaxWidth()) {
                Text("Round ${modeState.round} complete!", color = Gold, fontWeight = FontWeight.Black)
            }
            if (isHost) {
                Spacer(Modifier.height(12.dp))
                GlassButton(text = "Next Round →", onClick = {
                    choice = null; choseAction = false; answer = ""; dareText = ""; onNextRound()
                })
            }
        } else if (modeState.status == "FINISHED") {
            TruthDareFinishedView(onBack)
        }
    }
}

@Composable
private fun TruthDareWaitingView(onStart: () -> Unit, isHost: Boolean) {
    Box(modifier = Modifier.fillMaxWidth().padding(vertical = 40.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("🎲", fontSize = 64.sp)
            Spacer(Modifier.height(16.dp))
            Text("Truth or Dare", color = TextPrimary, fontSize = 24.sp, fontWeight = FontWeight.Black)
            Text("Classic party game with a twist", color = TextMuted, fontSize = 14.sp, textAlign = TextAlign.Center)
            Spacer(Modifier.height(24.dp))
            if (isHost) GlassButton(text = "Start Game 🎲", onClick = onStart)
            else Text("Waiting for host to start...", color = TextMuted, fontSize = 14.sp)
        }
    }
}

@Composable
private fun TruthDareFinishedView(onBack: () -> Unit) {
    Box(modifier = Modifier.fillMaxWidth().padding(vertical = 40.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("🎉", fontSize = 64.sp)
            Text("Game Over!", color = Gold, fontSize = 22.sp, fontWeight = FontWeight.Black)
            Spacer(Modifier.height(20.dp))
            GlassButton(text = "Back to Room", onClick = onBack)
        }
    }
}
