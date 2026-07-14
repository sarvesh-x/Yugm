package com.example.yugm.ui.components

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
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
import androidx.compose.ui.window.Dialog
import com.example.yugm.ui.theme.*

@OptIn(ExperimentalAnimationApi::class)
@Composable
fun IcebreakersDialog(
    onDismissRequest: () -> Unit
) {
    val prompts = listOf(
        "What is your go-to street food: Momo, Golgappa, or Vada Pav? 🥟",
        "If you could have dinner with one Indian celebrity, who would it be? 🎬",
        "Mountains or beaches: what's your ultimate vibe? ⛰️🏖️",
        "What is the most played song in your current Spotify playlist? 🎵",
        "What is your ultimate late-night snack default choice? 🍕",
        "Would you rather travel to the past or the future? ⏳",
        "If you had to change your first name, what name would you pick? 🏷️",
        "What is your absolute biggest pet peeve? 🙅‍♂️",
        "Are you an early bird or a dedicated night owl? 🦉🌅",
        "What's your favorite series/movie that you can watch over and over? 📺"
    )

    var currentPromptIndex by remember { mutableStateOf((0..prompts.lastIndex).random()) }

    Dialog(onDismissRequest = onDismissRequest) {
        Card(
            colors = CardDefaults.cardColors(containerColor = SurfaceElevated),
            shape = RoundedCornerShape(24.dp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Header
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text("⚡", fontSize = 22.sp)
                    Text(
                        text = "Vibe Check Game",
                        color = Gold,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Black
                    )
                }

                Text(
                    text = "Take turns answering the card prompt in the room!",
                    color = TextMuted,
                    fontSize = 12.sp,
                    textAlign = TextAlign.Center
                )

                // Prompt Card
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(140.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(
                            Brush.verticalGradient(
                                listOf(PrimaryPink.copy(alpha = 0.15f), PrimaryPurple.copy(alpha = 0.15f))
                            )
                        )
                        .padding(16.dp),
                    contentAlignment = Alignment.Center
                ) {
                    AnimatedContent(
                        targetState = prompts[currentPromptIndex],
                        transitionSpec = {
                            fadeIn() + slideInHorizontally() togetherWith fadeOut() + slideOutHorizontally()
                        }
                    ) { promptText ->
                        Text(
                            text = promptText,
                            color = Color.White,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            textAlign = TextAlign.Center,
                            lineHeight = 22.sp
                        )
                    }
                }

                // Buttons row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    OutlinedButton(
                        onClick = onDismissRequest,
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Close", color = Color.White)
                    }

                    Button(
                        onClick = {
                            var nextIndex = (0..prompts.lastIndex).random()
                            while (nextIndex == currentPromptIndex && prompts.size > 1) {
                                nextIndex = (0..prompts.lastIndex).random()
                            }
                            currentPromptIndex = nextIndex
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Gold),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Next Card", color = Background, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}
